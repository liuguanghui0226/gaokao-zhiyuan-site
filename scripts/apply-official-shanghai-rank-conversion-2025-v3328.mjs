#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.327-tianjin-official-rank2025-policy-bonus-inclusive-full-table-aligned-868426records";
const NEXT_VERSION = "local-deterministic-v3.328-shanghai-official-rank2025-policy-bonus-inclusive-undergraduate-floor-aligned-868426records";
const SOURCE_ID = "official-shanghai-rank-2025-v3328";
const PROVINCE = "上海";
const YEAR = 2025;
const SUBJECT_TYPE = "综合";
const SCORE_BASIS = "gaokao-total-including-policy-bonus";
const BASE_RANKS = 128972;
const ADDED_RANKS = 222;
const NEXT_RANKS = 129194;
const RECORDS = 868426;
const LINKED_RECORDS = 1964;
const EXCLUDED_SPECIAL_RECORDS = 14;
const LINKED_SOURCE_NOTES = 70;
const SCORE_FLOOR = 402;
const SCORE_MAXIMUM = 660;

function parseArgs(argv) {
  const args = {
    importFile: "data/admissions/official-shanghai-rank-conversion-2025-v3328-import.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-shanghai-rank-conversion-2025-v3328-runtime-manifest.json",
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

function scoreDerivedRankBoundary(note, shanghaiCount) {
  const fields = [
    ["河北", "hebei2025ScoreDerivedRankRecords"],
    ["重庆", "chongqing2025ScoreDerivedRankRecords"],
    ["辽宁", "liaoning2025ScoreDerivedRankRecords"],
    ["湖南", "hunan2025ScoreDerivedRankRecords"],
    ["江苏", "jiangsu2025ScoreDerivedRankRecords"],
    ["广西", "guangxi2025ScoreDerivedRankRecords"],
    ["山西", "shanxi2025ScoreDerivedRankRecords"],
    ["湖北", "hubei2025ScoreDerivedRankRecords"],
    ["福建", "fujian2025ScoreDerivedRankRecords"],
    ["黑龙江", "heilongjiang2025ScoreDerivedRankRecords"],
    ["海南", "hainan2025ScoreDerivedRankRecords"],
    ["天津", "tianjin2025ScoreDerivedRankRecords"],
    ["上海", "shanghai2025ScoreDerivedRankRecords"],
  ];
  const scopes = [];
  for (const [province, field] of fields) {
    const count = field === "shanghai2025ScoreDerivedRankRecords" ? shanghaiCount : Number(note[field] || 0);
    if (count > 0) scopes.push(`${province}2025年${count}条`);
  }
  return `${scopes.join("、")}普通类整数最低分记录按同年一分一段表换算省级位次区间；广西严格按目标院校区内/区外选用对应加分表；山西仅覆盖本科线及以上，湖北使用含政策性加分的普通类全分段表，福建覆盖官方已公布至215分的分数档，黑龙江使用不含照顾政策分且公开至130分的文化课表，海南使用含照顾加分且公开至246分的全体考生综合投档分表，天津使用含政策加分且公开至300分的普通高考总成绩表，上海使用含政策加分且公开至402分本科线的高考总成绩表；其他年份和特殊路径保持原证据状态。`;
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
  addSorted(coverage, "subjects", SUBJECT_TYPE);
  const yearRow = coverage.byYear?.find((row) => Number(row.year) === YEAR);
  assert(yearRow, "2025 rank source coverage row is missing");
  yearRow.sources = Number(yearRow.sources || 0) + 1;
  yearRow.parsedSources = Number(yearRow.parsedSources || 0) + 1;
  yearRow.parsedRecords = Number(yearRow.parsedRecords || 0) + ADDED_RANKS;
  addSorted(yearRow, "provinces", PROVINCE);
  addSorted(yearRow, "parsedProvinces", PROVINCE);
}

function verifyImport(payload) {
  assert(payload.dataset === "official-shanghai-rank-conversion-2025-v3328-import", `Unexpected dataset ${payload.dataset}`);
  assert(payload.sourceNotes?.length === 1 && payload.sourceNotes[0].id === SOURCE_ID, "Shanghai source note mismatch");
  assert(payload.rankConversions?.length === ADDED_RANKS, `Expected ${ADDED_RANKS} rank rows`);
  assert(payload.audit?.parsedRecords === ADDED_RANKS && payload.audit?.duplicateIds === 0, "Shanghai import audit drifted");
  assert(payload.audit?.officialPdfPages === 4 && payload.audit?.officialPdfOcrRows === 221, "Shanghai official PDF OCR audit drifted");
  assert(payload.audit?.crossCheckHtmlRows === 222 && payload.audit?.comparedOcrCells === 663, "Shanghai cross-check audit drifted");
  assert(payload.audit?.retainedOcrCorrections === 2, "Shanghai retained OCR correction audit drifted");
  assert(payload.audit?.allScoresContinuous === true && payload.audit?.allCumulativeCountsClose === true, "Shanghai arithmetic audit drifted");
  assert(payload.audit?.policyBonusRuleVerified === true && payload.audit?.ordinaryFilingTotalScoreOrderVerified === true, "Shanghai score-basis evidence drifted");
  assert(payload.audit?.scoreBasis === SCORE_BASIS && payload.audit?.rankPolicyBonusIncluded === true, "Shanghai score basis drifted");
  assert(payload.audit?.topMergedCandidates === 52 && payload.audit?.publishedFloorRankEnd === 49276, "Shanghai boundary audit drifted");
  assert(payload.rankConversions.every((row) => (
    row.province === PROVINCE
    && row.year === YEAR
    && row.subjectType === SUBJECT_TYPE
    && row.sourceId === SOURCE_ID
    && row.scoreBasis === SCORE_BASIS
    && row.rankPolicyBonusIncluded === true
  )), "Import contains out-of-scope rows");
}

function isRankableBase(record) {
  if (record.minScore === null || record.minScore === undefined || record.minScore === "") return false;
  const score = Number(record.minScore);
  return Number(record.year) === YEAR
    && ["综合", "综合改革"].includes(record.subjectType)
    && Number.isInteger(score)
    && score >= SCORE_FLOOR
    && score <= SCORE_MAXIMUM
    && !Number(record.minRankEnd || record.minRank)
    && !["plan", "control"].includes(record.dataType);
}

function isEligibleRecord(record, rankIndex, topBySubject) {
  if (!isRankableBase(record) || record.formalScoreScope === "special-path-only") return false;
  const score = Number(record.minScore);
  const exact = rankIndex.has(`${SUBJECT_TYPE}|${score}`);
  const top = topBySubject.get(SUBJECT_TYPE);
  return exact || Boolean(top && score > top.score);
}

function mapAdmissionRecord(record, rankIndex, topBySubject) {
  const score = Number(record.minScore);
  const exact = rankIndex.get(`${SUBJECT_TYPE}|${score}`);
  const top = topBySubject.get(SUBJECT_TYPE);
  const rank = exact || (top && score > top.score ? top : null);
  assert(rank, `No Shanghai rank mapping for ${record.id} at score ${record.minScore}`);
  const rankRangeText = rank.rankStart === rank.rankEnd ? `${rank.rankEnd}` : `${rank.rankStart}-${rank.rankEnd}`;
  const replacementCaution = "该位次由上海2025官方本科线上考生高考成绩分布表按最低分换算，口径含政策加分，非原录取/投档表直接公布。";
  const obsoleteCaution = /(缺最低位次|未公开最低位次|不提供最低位次|不生成假位次|不得仅凭本行分数单独输出录取概率)/;
  const cautions = (record.cautions || []).filter((caution) => !obsoleteCaution.test(caution));
  cautions.splice(Math.min(1, cautions.length), 0, replacementCaution);
  if (rank.rankStart === 1) cautions.push(`623分及以上合并档仅可确定为${rankRangeText}名，不生成档内伪精确位次。`);
  return {
    ...record,
    scoreOnly: false,
    rankUnavailable: false,
    nativeAdmissionRankUnavailable: true,
    rankDerivedFromScore: true,
    rankEvidenceScope: "score-derived-provincial-segment",
    rankScoreBasis: SCORE_BASIS,
    rankPolicyBonusIncluded: true,
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
    assert(shard.rankConversions.filter((row) => row.sourceId === SOURCE_ID).length === ADDED_RANKS, "Already-applied Shanghai rank rows drifted");
    assert(shard.records.filter((row) => row.rankSourceId === SOURCE_ID).length === LINKED_RECORDS, "Already-applied Shanghai admission links drifted");
    console.log(JSON.stringify({ status: "already-applied", modelVersion: NEXT_VERSION, rankConversionCount: manifest.rankConversionCount }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing to merge on unexpected core ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION && manifest.recordCount === RECORDS && manifest.rankConversionCount === BASE_RANKS, "Base manifest drifted");
  assert(core.admissionScoreLayer.structuredRecords === RECORDS && core.admissionScoreLayer.rankConversionRecords === BASE_RANKS, "Base core counts drifted");
  assert(!core.admissionScoreLayer.sourceNotes.some((note) => note.id === SOURCE_ID), `${SOURCE_ID} already exists`);

  const item = manifest.shards[PROVINCE];
  assert(item, "Shanghai runtime shard is missing");
  const slug = path.basename(item.file, ".json");
  const shardFile = path.join(releaseDir, `${slug}.json.gz`);
  const shard = readGzipJson(shardFile);
  assert(shard.records.length === 6247 && shard.records.length === item.records, "Shanghai record count drifted before merge");
  assert(shard.rankConversions.length === 214 && shard.rankConversions.length === item.rankConversions, "Shanghai rank count drifted before merge");
  assert(!shard.rankConversions.some((row) => row.sourceId === SOURCE_ID), "Shanghai v3.328 ranks already exist");

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

  const specialExcludedBefore = shard.records.filter((record) => isRankableBase(record) && record.formalScoreScope === "special-path-only").length;
  assert(specialExcludedBefore === EXCLUDED_SPECIAL_RECORDS, `Expected ${EXCLUDED_SPECIAL_RECORDS} isolated special-path rows, got ${specialExcludedBefore}`);

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
  assert(officialLinked === 1708 && thirdPartyLinked === 256, "Official/third-party linked split drifted");
  assert(schoolOfficialScopeLinked === 235, "School-official-only linked count drifted");
  assert(topBucketLinked === 1, `Expected one top-bucket linked row, got ${topBucketLinked}`);
  assert(linkedBySource.size === LINKED_SOURCE_NOTES, `Expected ${LINKED_SOURCE_NOTES} linked source IDs, got ${linkedBySource.size}`);
  assert(linkedByType.get("major-group-admission") === 1480, "Major-group linked count drifted");
  assert(linkedByType.get("major-admission") === 437, "Major linked count drifted");
  assert(linkedByType.get("institution-admission") === 47, "Institution linked count drifted");

  shard.rankConversions = [...payload.rankConversions, ...shard.rankConversions];
  shard.rankConversions.sort((left, right) => (
    Number(right.year) - Number(left.year)
    || String(left.subjectType).localeCompare(String(right.subjectType), "zh-CN")
    || Number(right.score) - Number(left.score)
  ));
  shard.generatedAt = payload.generatedAt;
  assert(shard.rankConversions.length === 436, "Shanghai rank count drifted after merge");
  const firstAt600 = shard.rankConversions.find((row) => row.year === YEAR && row.subjectType === SUBJECT_TYPE && row.score === 600);
  assert(firstAt600?.sourceId === SOURCE_ID, "Runtime lookup does not prioritize the official Shanghai 2025 source");

  const layer = core.admissionScoreLayer;
  const noteById = new Map(layer.sourceNotes.map((note) => [note.id, note]));
  const missingLinkedNotes = [...linkedBySource.keys()].filter((sourceId) => !noteById.has(sourceId));
  assert(missingLinkedNotes.length === 0, `Missing linked source notes: ${missingLinkedNotes.join(", ")}`);
  for (const [sourceId, count] of linkedBySource) {
    const note = noteById.get(sourceId);
    note.scoreDerivedRankRecords = Number(note.scoreDerivedRankRecords || 0) + count;
    note.shanghai2025ScoreDerivedRankRecords = count;
    note.shanghai2025RankScoreBasis = SCORE_BASIS;
    note.shanghai2025RankPolicyBonusIncluded = true;
    if (Number.isFinite(Number(note.rankUnavailableRecords))) {
      assert(Number(note.rankUnavailableRecords) >= count, `${sourceId} rank-unavailable source count is smaller than the Shanghai linked count`);
      note.rankUnavailableRecords = Number(note.rankUnavailableRecords) - count;
    }
    if (Number.isFinite(Number(note.derivedRankRecords))) note.derivedRankRecords = Number(note.derivedRankRecords) + count;
    if (Number.isFinite(Number(note.scoreOnlyRecords))) {
      assert(Number(note.scoreOnlyRecords) >= count, `${sourceId} score-only source count is smaller than the Shanghai linked count`);
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
  layer.currentFinding = "海南2025年555条官方综合投档分位次已为4241条海南2025综合普通类整数最低分完成同口径换算。新疆2025因政策加分口径未闭合，4234条无原生位次记录全部禁止自动套表。天津2025年381条官方含政策加分总成绩分数档已为3195条普通记录补充位次。新增上海2025年222条官方本科线上高考成绩分数档，官方扫描表OCR与完整HTML交叉复核，为1964条上海2025综合普通类整数最低分补充含政策加分口径的市级位次区间，其中1708条来自官方来源；14条特殊路径继续隔离。";
  layer.downgradeReason = `当前数据层 ${NEXT_VERSION} 严格区分院校原生最低位次、同口径最低分换算位次和口径未闭合分数；海南2025表使用全体考生综合投档成绩，口径含照顾加分并公开至246分。新疆2025镜像表与官方含政策加分投档排序分出现9个0人分数冲突，4234条录取记录继续保持缺位次。天津2025表口径含政策加分并公开至300分。上海2025表口径含政策加分并仅公开本科线402分及以上，623分及以上只保留1-52名合并档；401分及以下、历史/物理标签、艺术体育综合分、非整数分、低于公开分数档和特殊路径不自动套表。`;
  layer.sourceNotes.push(sourceNote);
  assert(layer.sourceNotes.length === 5132, `Expected 5132 source notes, got ${layer.sourceNotes.length}`);
  layer.availableEvidenceIds = sortedUnique([...(layer.availableEvidenceIds || []), SOURCE_ID]);
  layer.rankCoverage.records = NEXT_RANKS;
  addSorted(layer.rankCoverage, "provinces", PROVINCE);
  addSorted(layer.rankCoverage, "years", YEAR, { numeric: true });
  addSorted(layer.rankCoverage, "subjects", SUBJECT_TYPE);
  updateRankSourceCoverage(layer.rankSourceCoverage);
  layer.coverage.rankConversionRecords = NEXT_RANKS;
  refreshReadiness(layer.provinceReadiness, shard);
  refreshReadiness(layer.coverage.provinceReadiness, shard);

  const shardBytes = encodeJson(shard);
  const coreBytes = encodeJson(core);
  manifest.generatedAt = payload.generatedAt;
  manifest.modelVersion = NEXT_VERSION;
  manifest.rankConversionCount = NEXT_RANKS;
  manifest.runtimeProfile = { ...(manifest.runtimeProfile || {}), version: "v3.328", initialCore: "knowledge-core-lite.json.gz", fullEvidenceCore: "knowledge-core.json.gz" };
  item.rankConversions = shard.rankConversions.length;
  item.bytes = shardBytes.byteLength;
  item.sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);

  const tempDir = path.join(releaseDir, `.v3328-${process.pid}`);
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
    dataset: "official-shanghai-rank-conversion-2025-v3328-runtime",
    generatedAt: payload.generatedAt,
    sourceId: SOURCE_ID,
    importFile: args.importFile,
    releaseDir: args.releaseDir,
    before: { modelVersion: BASE_VERSION, records: RECORDS, rankConversions: BASE_RANKS, provinceRankConversions: 214 },
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
    cautions: sourceNote.cautions,
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
    specialPathExcludedRecords: specialExcludedBefore,
    sourceNotes: layer.sourceNotes.length,
    shardSha256: runtimeManifest.after.shardSha256,
    coreSha256: runtimeManifest.after.coreSha256,
  }, null, 2));
}

main();
