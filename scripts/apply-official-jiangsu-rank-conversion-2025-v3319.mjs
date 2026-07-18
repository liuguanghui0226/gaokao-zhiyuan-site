#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.318-hunan-education-department-rank2025-aligned-868426records";
const NEXT_VERSION = "local-deterministic-v3.319-jiangsu-jseea-first-stage-rank2025-aligned-868426records";
const SOURCE_ID = "official-jiangsu-rank-2025-v3319";
const PROVINCE = "江苏";
const YEAR = 2025;
const BASE_RANKS = 121889;
const ADDED_RANKS = 398;
const NEXT_RANKS = 122287;
const RECORDS = 868426;
const LINKED_RECORDS = 7060;
const EXCLUDED_SPECIAL_RECORDS = 123;
const BELOW_PUBLISHED_FLOOR_RECORDS = 1496;
const LINKED_SOURCE_NOTES = 113;

function parseArgs(argv) {
  const args = {
    importFile: "data/admissions/official-jiangsu-rank-conversion-2025-v3319-import.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-jiangsu-rank-conversion-2025-v3319-runtime-manifest.json",
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--import") args.importFile = argv[++index];
    else if (argv[index] === "--release") args.releaseDir = argv[++index];
    else if (argv[index] === "--runtime-manifest") args.runtimeManifest = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return args;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function gzipBytes(value) {
  return zlib.gzipSync(value, { level: 9, mtime: 0 });
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sortedUnique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))]
    .sort((left, right) => String(left).localeCompare(String(right), "zh-CN"));
}

function addSorted(container, key, value, { numeric = false } = {}) {
  container[key] = sortedUnique([...(container[key] || []), value]);
  if (numeric) container[key] = container[key].map(Number).sort((left, right) => left - right);
}

function scoreDerivedRankBoundary(note, jiangsuCount) {
  const fields = [
    ["河北", "hebei2025ScoreDerivedRankRecords"],
    ["重庆", "chongqing2025ScoreDerivedRankRecords"],
    ["辽宁", "liaoning2025ScoreDerivedRankRecords"],
    ["湖南", "hunan2025ScoreDerivedRankRecords"],
    ["江苏", "jiangsu2025ScoreDerivedRankRecords"],
  ];
  const scopes = [];
  for (const [province, field] of fields) {
    const count = field === "jiangsu2025ScoreDerivedRankRecords" ? jiangsuCount : Number(note[field] || 0);
    if (count > 0) scopes.push(`${province}2025年${count}条`);
  }
  return `${scopes.join("、")}历史/物理类整数最低分记录按同年一分一段表换算省级位次区间；江苏仅覆盖第一阶段历史类482分及以上、物理类463分及以上，其他省份、年份、低于公布下限和特殊路径保持原证据状态。`;
}

function refreshReadiness(container, shard) {
  const row = container?.rows?.find((item) => item.province === PROVINCE);
  if (!row) return;
  row.records = shard.records.length;
  row.rankConversionRecords = shard.rankConversions.length;
  row.officialRankRecords = shard.rankConversions.filter((record) => String(record.sourceQuality || "").startsWith("official")).length;
  row.officialRecords = shard.records.filter((record) => String(record.sourceQuality || "").startsWith("official")).length;
  row.officialEvidenceRecords = row.officialRecords + row.officialRankRecords;
  row.rankParsedSource = row.rankConversionRecords > 0;
  row.majorWithRank = shard.records.filter((record) => record.dataType === "major-admission" && Number(record.minRankEnd || record.minRank) > 0).length;
  row.majorWithScoreDerivedRank = shard.records.filter((record) => record.dataType === "major-admission" && record.rankDerivedFromScore === true).length;
  row.institutionWithRank = shard.records.filter((record) => record.dataType === "institution-admission" && Number(record.minRankEnd || record.minRank) > 0).length;
  row.institutionWithScoreDerivedRank = shard.records.filter((record) => record.dataType === "institution-admission" && record.rankDerivedFromScore === true).length;
}

function updateRankSourceCoverage(coverage) {
  coverage.sources = Number(coverage.sources || 0) + 1;
  coverage.parsedSources = Number(coverage.parsedSources || 0) + 1;
  coverage.parsedRecords = Number(coverage.parsedRecords || 0) + ADDED_RANKS;
  addSorted(coverage, "provinces", PROVINCE);
  addSorted(coverage, "parsedProvinces", PROVINCE);
  addSorted(coverage, "years", YEAR, { numeric: true });
  addSorted(coverage, "parsedYears", YEAR, { numeric: true });
  addSorted(coverage, "subjects", "历史类");
  addSorted(coverage, "subjects", "物理类");
  const yearRow = coverage.byYear?.find((row) => Number(row.year) === YEAR);
  assert(yearRow, "2025 rank source coverage row is missing");
  yearRow.sources = Number(yearRow.sources || 0) + 1;
  yearRow.parsedSources = Number(yearRow.parsedSources || 0) + 1;
  yearRow.parsedRecords = Number(yearRow.parsedRecords || 0) + ADDED_RANKS;
  addSorted(yearRow, "provinces", PROVINCE);
  addSorted(yearRow, "parsedProvinces", PROVINCE);
}

function verifyImport(payload) {
  assert(payload.dataset === "official-jiangsu-rank-conversion-2025-v3319-import", `Unexpected dataset ${payload.dataset}`);
  assert(payload.sourceNotes?.length === 1 && payload.sourceNotes[0].id === SOURCE_ID, "Jiangsu source note mismatch");
  assert(payload.rankConversions?.length === ADDED_RANKS, `Expected ${ADDED_RANKS} rank rows`);
  assert(payload.audit?.parsedRecords === ADDED_RANKS && payload.audit?.duplicateIds === 0, "Jiangsu import audit drifted");
  assert(payload.audit?.rowComparisons === 398 && payload.audit?.cellComparisons === 1194 && payload.audit?.sourceDifferences === 0, "Jiangsu evidence comparison drifted");
  assert(payload.audit?.ocrCorrections === 15 && payload.audit?.secondStageExcluded === true, "Jiangsu OCR or stage boundary drifted");
  assert(payload.rankConversions.filter((row) => row.subjectType === "历史类").length === 177, "History row count drifted");
  assert(payload.rankConversions.filter((row) => row.subjectType === "物理类").length === 221, "Physics row count drifted");
  assert(payload.rankConversions.every((row) => row.province === PROVINCE && row.year === YEAR && row.sourceId === SOURCE_ID), "Import contains out-of-scope rows");
}

function isEligibleRecord(record, rankIndex, topBySubject) {
  const score = Number(record.minScore);
  const top = topBySubject.get(record.subjectType);
  const hasPublishedRank = rankIndex.has(`${record.subjectType}|${score}`) || (top && score > top.score);
  return Number(record.year) === YEAR
    && ["历史类", "物理类"].includes(record.subjectType)
    && Number.isInteger(score)
    && score <= 750
    && hasPublishedRank
    && !Number(record.minRankEnd || record.minRank)
    && record.formalScoreScope !== "special-path-only";
}

function mapAdmissionRecord(record, rankIndex, topBySubject) {
  const score = Number(record.minScore);
  const exact = rankIndex.get(`${record.subjectType}|${score}`);
  const top = topBySubject.get(record.subjectType);
  const rank = exact || (top && score > top.score ? top : null);
  assert(rank, `No ${record.subjectType} rank mapping for ${record.id} at score ${record.minScore}`);
  const rankRangeText = rank.rankStart === rank.rankEnd ? `${rank.rankEnd}` : `${rank.rankStart}-${rank.rankEnd}`;
  const replacementCaution = "该位次由江苏2025第一阶段逐分段统计表按最低分换算，非原录取/投档表直接公布。";
  const obsoleteCaution = /(缺最低位次|未公开最低位次|不提供最低位次|不生成假位次|不得仅凭本行分数单独输出录取概率)/;
  const cautions = (record.cautions || []).filter((caution) => !obsoleteCaution.test(caution));
  cautions.splice(Math.min(1, cautions.length), 0, replacementCaution);
  if (rank.rankStart === 1) cautions.push(`最高分合并档仅可确定为${rankRangeText}名，不生成档内伪精确位次。`);
  return {
    ...record,
    scoreOnly: false,
    rankUnavailable: false,
    nativeAdmissionRankUnavailable: true,
    rankDerivedFromScore: true,
    rankEvidenceScope: "score-derived-provincial-segment",
    minRank: rank.rankEnd,
    minRankStart: rank.rankStart,
    minRankEnd: rank.rankEnd,
    rankRangeText: `${rankRangeText}（最低分换算）`,
    rankSourceId: SOURCE_ID,
    cautions,
  };
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const importFile = path.resolve(PROJECT_ROOT, args.importFile);
  const releaseDir = path.resolve(PROJECT_ROOT, args.releaseDir);
  const runtimeManifestFile = path.resolve(PROJECT_ROOT, args.runtimeManifest);
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  verifyImport(payload);

  if (core.modelVersion === NEXT_VERSION) {
    const item = manifest.shards[PROVINCE];
    const shard = readGzipJson(path.join(releaseDir, `${path.basename(item.file, ".json")}.json.gz`));
    assert(shard.rankConversions.filter((row) => row.sourceId === SOURCE_ID).length === ADDED_RANKS, "Already-applied rank rows drifted");
    assert(shard.records.filter((row) => row.rankSourceId === SOURCE_ID).length === LINKED_RECORDS, "Already-applied admission links drifted");
    console.log(JSON.stringify({ status: "already-applied", modelVersion: NEXT_VERSION, rankConversionCount: manifest.rankConversionCount }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing to merge on unexpected core ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION && manifest.recordCount === RECORDS && manifest.rankConversionCount === BASE_RANKS, "Base manifest drifted");
  assert(core.admissionScoreLayer.structuredRecords === RECORDS && core.admissionScoreLayer.rankConversionRecords === BASE_RANKS, "Base core counts drifted");
  assert(!core.admissionScoreLayer.sourceNotes.some((note) => note.id === SOURCE_ID), `${SOURCE_ID} already exists`);

  const item = manifest.shards[PROVINCE];
  assert(item, "Jiangsu runtime shard is missing");
  const slug = path.basename(item.file, ".json");
  const shardFile = path.join(releaseDir, `${slug}.json.gz`);
  const shard = readGzipJson(shardFile);
  assert(shard.records.length === 26991 && shard.records.length === item.records, "Jiangsu record count drifted before merge");
  assert(shard.rankConversions.length === 408 && shard.rankConversions.length === item.rankConversions, "Jiangsu rank count drifted before merge");
  assert(!shard.rankConversions.some((row) => row.sourceId === SOURCE_ID), "Jiangsu v3.319 ranks already exist");

  const sourceNote = { ...payload.sourceNotes[0], file: args.importFile };
  const rankIndex = new Map(payload.rankConversions.map((row) => [`${row.subjectType}|${row.score}`, row]));
  const topBySubject = new Map(payload.rankConversions.filter((row) => row.scoreRange).map((row) => [row.subjectType, row]));
  const linkedBySource = new Map();
  const linkedByType = new Map();
  let linkedRecords = 0;
  let officialLinked = 0;
  let thirdPartyLinked = 0;
  let schoolOfficialScopeLinked = 0;
  let topBucketLinked = 0;

  const inPublishedRange = (record) => {
    const score = Number(record.minScore);
    const top = topBySubject.get(record.subjectType);
    return Number(record.year) === YEAR
      && Number.isInteger(score)
      && top
      && (rankIndex.has(`${record.subjectType}|${score}`) || score > top.score);
  };
  const specialExcludedBefore = shard.records.filter((record) => inPublishedRange(record)
    && !Number(record.minRankEnd || record.minRank)
    && record.formalScoreScope === "special-path-only").length;
  assert(specialExcludedBefore === EXCLUDED_SPECIAL_RECORDS, `Expected ${EXCLUDED_SPECIAL_RECORDS} isolated special-path rows, got ${specialExcludedBefore}`);
  const belowPublishedFloorBefore = shard.records.filter((record) => Number(record.year) === YEAR
    && ["历史类", "物理类"].includes(record.subjectType)
    && Number.isInteger(Number(record.minScore))
    && !Number(record.minRankEnd || record.minRank)
    && record.formalScoreScope !== "special-path-only"
    && !inPublishedRange(record)).length;
  assert(belowPublishedFloorBefore === BELOW_PUBLISHED_FLOOR_RECORDS, `Expected ${BELOW_PUBLISHED_FLOOR_RECORDS} below-floor rows, got ${belowPublishedFloorBefore}`);

  shard.records = shard.records.map((record) => {
    if (!isEligibleRecord(record, rankIndex, topBySubject)) return record;
    const mapped = mapAdmissionRecord(record, rankIndex, topBySubject);
    linkedRecords += 1;
    linkedBySource.set(mapped.sourceId, Number(linkedBySource.get(mapped.sourceId) || 0) + 1);
    linkedByType.set(mapped.dataType, Number(linkedByType.get(mapped.dataType) || 0) + 1);
    if (String(record.sourceQuality || "").startsWith("official")) officialLinked += 1;
    else thirdPartyLinked += 1;
    if (record.formalScoreScope === "school-official-only") schoolOfficialScopeLinked += 1;
    if (mapped.minRankStart === 1) topBucketLinked += 1;
    return mapped;
  });
  assert(linkedRecords === LINKED_RECORDS, `Expected ${LINKED_RECORDS} linked admission records, got ${linkedRecords}`);
  assert(officialLinked === 5912 && thirdPartyLinked === 1148, "Official/third-party linked split drifted");
  assert(schoolOfficialScopeLinked === 796, "School-official-only linked count drifted");
  assert(topBucketLinked === 8, `Expected 8 top-bucket linked rows, got ${topBucketLinked}`);
  assert(linkedBySource.size === LINKED_SOURCE_NOTES, `Expected ${LINKED_SOURCE_NOTES} linked source IDs, got ${linkedBySource.size}`);
  assert(linkedByType.get("major-admission") === 1750, "Major linked count drifted");
  assert(linkedByType.get("institution-admission") === 152, "Institution linked count drifted");
  assert(linkedByType.get("vocational-admission") === 330, "Vocational linked count drifted");
  assert(linkedByType.get("major-group-admission") === 4826, "Major-group linked count drifted");
  assert(linkedByType.get("school-admission-summary") === 2, "School-summary linked count drifted");

  shard.rankConversions.push(...payload.rankConversions);
  shard.rankConversions.sort((left, right) => (
    Number(right.year) - Number(left.year)
    || String(left.subjectType).localeCompare(String(right.subjectType), "zh-CN")
    || Number(right.score) - Number(left.score)
  ));
  shard.generatedAt = payload.generatedAt;
  assert(shard.rankConversions.length === 806, "Jiangsu rank count drifted after merge");

  const layer = core.admissionScoreLayer;
  const noteById = new Map(layer.sourceNotes.map((note) => [note.id, note]));
  const missingLinkedNotes = [...linkedBySource.keys()].filter((sourceId) => !noteById.has(sourceId));
  assert(missingLinkedNotes.length === 0, `Missing linked source notes: ${missingLinkedNotes.join(", ")}`);
  for (const [sourceId, count] of linkedBySource) {
    const note = noteById.get(sourceId);
    note.scoreDerivedRankRecords = Number(note.scoreDerivedRankRecords || 0) + count;
    note.jiangsu2025ScoreDerivedRankRecords = count;
    if (Number.isFinite(Number(note.rankUnavailableRecords))) {
      assert(Number(note.rankUnavailableRecords) >= count, `${sourceId} rank-unavailable source count is smaller than the Jiangsu linked count`);
      note.rankUnavailableRecords = Number(note.rankUnavailableRecords) - count;
    }
    if (Number.isFinite(Number(note.derivedRankRecords))) note.derivedRankRecords = Number(note.derivedRankRecords) + count;
    if (Number.isFinite(Number(note.scoreOnlyRecords))) {
      assert(Number(note.scoreOnlyRecords) >= count, `${sourceId} score-only source count is smaller than the Jiangsu linked count`);
      note.scoreOnlyRecords = Number(note.scoreOnlyRecords) - count;
    }
    if (Number.isFinite(Number(note.recordsWithScoreDerivedRank))) note.recordsWithScoreDerivedRank = Number(note.recordsWithScoreDerivedRank) + count;
    if (Number.isFinite(Number(note.recordsWithAnyRank))) note.recordsWithAnyRank = Number(note.recordsWithAnyRank) + count;
    note.rankSourceIds = sortedUnique([...(note.rankSourceIds || []), SOURCE_ID]);
    note.rankEvidenceScope = "score-derived-provincial-segment";
    note.rankAlignmentBoundary = scoreDerivedRankBoundary(note, count);
  }

  core.generatedAt = payload.generatedAt;
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;
  layer.rankConversionRecords = NEXT_RANKS;
  layer.statusLabel = `已接入${RECORDS}条结构化录取/计划数据 + ${NEXT_RANKS}条一分一段记录`;
  layer.currentFinding = "新增江苏2025年第一阶段历史类177档、物理类221档逐分段记录；江苏省教育考试院原图与阳光高考图逐字节一致，独立全尺寸镜像398行、1194个分数/同分人数/累计人数单元零差异，15处OCR噪声均由固定分数网格或累计人数闭合恢复。由此为7060条江苏2025历史/物理类普通整数最低分记录补充省级位次区间；1496条低于第一阶段公布下限、123条特殊路径继续保持缺位次。";
  layer.downgradeReason = `当前数据层 ${NEXT_VERSION} 严格区分院校原生最低位次与最低分换算的省级分数段位次；江苏第一阶段表只覆盖历史类482分及以上、物理类463分及以上，第二阶段剩余考生统计不得拼接成全体位次，低于公布下限、艺体综合分、科类不明、非整数分和特殊路径不混入普通推荐。`;
  layer.sourceNotes.push(sourceNote);
  layer.availableEvidenceIds = sortedUnique([...(layer.availableEvidenceIds || []), SOURCE_ID]);
  layer.rankCoverage.records = NEXT_RANKS;
  addSorted(layer.rankCoverage, "provinces", PROVINCE);
  addSorted(layer.rankCoverage, "years", YEAR, { numeric: true });
  addSorted(layer.rankCoverage, "subjects", "历史类");
  addSorted(layer.rankCoverage, "subjects", "物理类");
  updateRankSourceCoverage(layer.rankSourceCoverage);
  layer.coverage.rankConversionRecords = NEXT_RANKS;
  refreshReadiness(layer.provinceReadiness, shard);
  refreshReadiness(layer.coverage.provinceReadiness, shard);

  const shardBytes = encodeJson(shard);
  const coreBytes = encodeJson(core);
  manifest.generatedAt = payload.generatedAt;
  manifest.modelVersion = NEXT_VERSION;
  manifest.rankConversionCount = NEXT_RANKS;
  manifest.runtimeProfile = { ...(manifest.runtimeProfile || {}), version: "v3.319", initialCore: "knowledge-core-lite.json.gz", fullEvidenceCore: "knowledge-core.json.gz" };
  item.rankConversions = shard.rankConversions.length;
  item.bytes = shardBytes.byteLength;
  item.sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);

  const tempDir = path.join(releaseDir, `.v3319-${process.pid}`);
  fs.mkdirSync(tempDir, { recursive: true });
  const shardTemp = path.join(tempDir, `${slug}.json.gz`);
  const coreTemp = path.join(tempDir, "knowledge-core.json.gz");
  const manifestTemp = path.join(tempDir, "manifest.json.gz");
  fs.writeFileSync(shardTemp, gzipBytes(shardBytes));
  fs.writeFileSync(coreTemp, gzipBytes(coreBytes));
  fs.writeFileSync(manifestTemp, gzipBytes(manifestBytes));
  fs.renameSync(shardTemp, shardFile);
  fs.renameSync(coreTemp, coreFile);
  fs.renameSync(manifestTemp, manifestFile);
  fs.rmdirSync(tempDir);

  const runtimeManifest = {
    dataset: "official-jiangsu-rank-conversion-2025-v3319-runtime",
    generatedAt: payload.generatedAt,
    sourceId: SOURCE_ID,
    importFile: args.importFile,
    releaseDir: args.releaseDir,
    before: { modelVersion: BASE_VERSION, records: RECORDS, rankConversions: BASE_RANKS, provinceRankConversions: 408 },
    after: {
      modelVersion: NEXT_VERSION,
      records: RECORDS,
      rankConversions: NEXT_RANKS,
      rankConversionsAdded: ADDED_RANKS,
      provinceRecords: shard.records.length,
      provinceRankConversions: shard.rankConversions.length,
      linkedAdmissionRecords: linkedRecords,
      officialLinkedRecords: officialLinked,
      thirdPartyLinkedRecords: thirdPartyLinked,
      schoolOfficialScopeLinkedRecords: schoolOfficialScopeLinked,
      specialPathExcludedRecords: specialExcludedBefore,
      belowPublishedFloorRecords: belowPublishedFloorBefore,
      topBucketLinkedRecords: topBucketLinked,
      linkedSourceNotes: linkedBySource.size,
      linkedByType: Object.fromEntries([...linkedByType].sort((left, right) => left[0].localeCompare(right[0]))),
      sourceNotes: layer.sourceNotes.length,
      shardBytes: shardBytes.byteLength,
      shardSha256: sha256(shardBytes),
      coreBytes: coreBytes.byteLength,
      coreSha256: sha256(coreBytes),
      manifestBytesBeforeLiteRebuild: manifestBytes.byteLength,
      manifestSha256BeforeLiteRebuild: sha256(manifestBytes),
    },
    cautions: payload.notes,
  };
  writeJson(runtimeManifestFile, runtimeManifest);
  console.log(JSON.stringify({
    status: "applied",
    modelVersion: NEXT_VERSION,
    records: RECORDS,
    rankConversions: NEXT_RANKS,
    linkedAdmissionRecords: linkedRecords,
    officialLinkedRecords: officialLinked,
    thirdPartyLinkedRecords: thirdPartyLinked,
    belowPublishedFloorRecords: belowPublishedFloorBefore,
    specialPathExcludedRecords: specialExcludedBefore,
    sourceNotes: layer.sourceNotes.length,
    shardSha256: runtimeManifest.after.shardSha256,
    coreSha256: runtimeManifest.after.coreSha256,
  }, null, 2));
}

main();
