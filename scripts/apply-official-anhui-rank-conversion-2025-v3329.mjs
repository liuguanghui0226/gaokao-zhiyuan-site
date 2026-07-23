#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.328-shanghai-official-rank2025-policy-bonus-inclusive-undergraduate-floor-aligned-868426records";
const NEXT_VERSION = "local-deterministic-v3.329-anhui-official-rank2025-policy-bonus-inclusive-full-table-aligned-868426records";
const SOURCE_ID = "official-anhui-rank-2025-v3329";
const PROVINCE = "安徽";
const YEAR = 2025;
const SUBJECT_TYPES = ["历史类", "物理类"];
const SCORE_BASIS = "gaokao-total-including-policy-bonus";
const BASE_RANKS = 129194;
const ADDED_RANKS = 961;
const NEXT_RANKS = 130155;
const RECORDS = 868426;
const LINKED_RECORDS = 1804;
const EXCLUDED_SPECIAL_RECORDS = 179;
const LINKED_SOURCE_NOTES = 102;
const SCORE_FLOOR = 200;
const SCORE_MAXIMUM = 750;

function parseArgs(argv) {
  const args = {
    importFile: "data/admissions/official-anhui-rank-conversion-2025-v3329-import.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-anhui-rank-conversion-2025-v3329-runtime-manifest.json",
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

function scoreDerivedRankBoundary(note, anhuiCount) {
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
    ["安徽", "anhui2025ScoreDerivedRankRecords"],
  ];
  const scopes = [];
  for (const [province, field] of fields) {
    const count = field === "anhui2025ScoreDerivedRankRecords" ? anhuiCount : Number(note[field] || 0);
    if (count > 0) scopes.push(`${province}2025年${count}条`);
  }
  return `${scopes.join("、")}普通类整数最低分记录按同年一分一段表换算省级位次区间；广西严格按目标院校区内/区外选用对应加分表；山西仅覆盖本科线及以上，湖北使用含政策性加分的普通类全分段表，福建覆盖官方已公布至215分的分数档，黑龙江使用不含照顾政策分且公开至130分的文化课表，海南使用含照顾加分且公开至246分的全体考生综合投档分表，天津使用含政策加分且公开至300分的普通高考总成绩表，上海使用含政策加分且公开至402分本科线的高考总成绩表，安徽按历史/物理分别使用含加分且公开至200分的完整分档表；其他年份和特殊路径保持原证据状态。`;
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
  for (const subjectType of SUBJECT_TYPES) addSorted(coverage, "subjects", subjectType);
  const yearRow = coverage.byYear?.find((row) => Number(row.year) === YEAR);
  assert(yearRow, "2025 rank source coverage row is missing");
  yearRow.sources = Number(yearRow.sources || 0) + 1;
  yearRow.parsedSources = Number(yearRow.parsedSources || 0) + 1;
  yearRow.parsedRecords = Number(yearRow.parsedRecords || 0) + ADDED_RANKS;
  addSorted(yearRow, "provinces", PROVINCE);
  addSorted(yearRow, "parsedProvinces", PROVINCE);
}

function verifyImport(payload) {
  assert(payload.dataset === "official-anhui-rank-conversion-2025-v3329-import", `Unexpected dataset ${payload.dataset}`);
  assert(payload.sourceNotes?.length === 1 && payload.sourceNotes[0].id === SOURCE_ID, "Anhui source note mismatch");
  assert(payload.rankConversions?.length === ADDED_RANKS, `Expected ${ADDED_RANKS} rank rows`);
  assert(payload.audit?.parsedRecords === ADDED_RANKS && payload.audit?.duplicateIds === 0, "Anhui import audit drifted");
  assert(payload.audit?.pdfPages === 6 && payload.audit?.parsedHistoryRows === 469 && payload.audit?.parsedPhysicsRows === 492, "Anhui PDF audit drifted");
  assert(payload.audit?.mirrorPdfsByteIdentical === true, "Anhui mirror identity audit drifted");
  assert(payload.audit?.duplicateScores === 0 && payload.audit?.scoreGaps === 0 && payload.audit?.cumulativeArithmeticErrors === 0, "Anhui table audit drifted");
  assert(payload.audit?.allScoresContinuous === true && payload.audit?.allCumulativeCountsClose === true, "Anhui arithmetic audit drifted");
  assert(payload.audit?.policyBonusTitleVerified === true && payload.audit?.populationBoundaryVerified === true, "Anhui score-basis evidence drifted");
  assert(payload.audit?.scoreBasis === SCORE_BASIS && payload.audit?.rankPolicyBonusIncluded === true, "Anhui score basis drifted");
  assert(payload.audit?.topMergedCandidates?.["历史类"] === 23 && payload.audit?.topMergedCandidates?.["物理类"] === 43, "Anhui top boundaries drifted");
  assert(payload.audit?.publishedFloorRankEnd?.["历史类"] === 141400 && payload.audit?.publishedFloorRankEnd?.["物理类"] === 320779, "Anhui floor boundaries drifted");
  assert(payload.rankConversions.every((row) => (
    row.province === PROVINCE
    && row.year === YEAR
    && SUBJECT_TYPES.includes(row.subjectType)
    && row.sourceId === SOURCE_ID
    && row.scoreBasis === SCORE_BASIS
    && row.rankPolicyBonusIncluded === true
  )), "Import contains out-of-scope rows");
}

function isRankableBase(record) {
  if (record.minScore === null || record.minScore === undefined || record.minScore === "") return false;
  const score = Number(record.minScore);
  return Number(record.year) === YEAR
    && SUBJECT_TYPES.includes(record.subjectType)
    && Number.isInteger(score)
    && score >= SCORE_FLOOR
    && score <= SCORE_MAXIMUM
    && !Number(record.minRankEnd || record.minRank)
    && !["plan", "control"].includes(record.dataType);
}

function isEligibleRecord(record, rankIndex, topBySubject) {
  if (!isRankableBase(record) || record.formalScoreScope === "special-path-only") return false;
  const score = Number(record.minScore);
  const exact = rankIndex.has(`${record.subjectType}|${score}`);
  const top = topBySubject.get(record.subjectType);
  return exact || Boolean(top && score > top.score);
}

function mapAdmissionRecord(record, rankIndex, topBySubject) {
  const score = Number(record.minScore);
  const exact = rankIndex.get(`${record.subjectType}|${score}`);
  const top = topBySubject.get(record.subjectType);
  const rank = exact || (top && score > top.score ? top : null);
  assert(rank, `No Anhui rank mapping for ${record.id} at score ${record.minScore}`);
  const rankRangeText = rank.rankStart === rank.rankEnd ? `${rank.rankEnd}` : `${rank.rankStart}-${rank.rankEnd}`;
  const replacementCaution = `该位次由安徽2025官方${record.subjectType}含加分成绩分档表按最低分换算，非原录取/投档表直接公布。`;
  const obsoleteCaution = /(缺最低位次|未公开最低位次|不提供最低位次|不生成假位次|不得仅凭本行分数单独输出录取概率)/;
  const cautions = (record.cautions || []).filter((caution) => !obsoleteCaution.test(caution));
  cautions.splice(Math.min(1, cautions.length), 0, replacementCaution);
  if (rank.rankStart === 1) cautions.push(`${rank.score}分及以上合并档仅可确定为${rankRangeText}名，不生成档内伪精确位次。`);
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
    assert(shard.rankConversions.filter((row) => row.sourceId === SOURCE_ID).length === ADDED_RANKS, "Already-applied Anhui rank rows drifted");
    assert(shard.records.filter((row) => row.rankSourceId === SOURCE_ID).length === LINKED_RECORDS, "Already-applied Anhui admission links drifted");
    console.log(JSON.stringify({ status: "already-applied", modelVersion: NEXT_VERSION, rankConversionCount: manifest.rankConversionCount }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing to merge on unexpected core ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION && manifest.recordCount === RECORDS && manifest.rankConversionCount === BASE_RANKS, "Base manifest drifted");
  assert(core.admissionScoreLayer.structuredRecords === RECORDS && core.admissionScoreLayer.rankConversionRecords === BASE_RANKS, "Base core counts drifted");
  assert(!core.admissionScoreLayer.sourceNotes.some((note) => note.id === SOURCE_ID), `${SOURCE_ID} already exists`);

  const item = manifest.shards[PROVINCE];
  assert(item, "Anhui runtime shard is missing");
  const slug = path.basename(item.file, ".json");
  const shardFile = path.join(releaseDir, `${slug}.json.gz`);
  const shard = readGzipJson(shardFile);
  assert(shard.records.length === 16250 && shard.records.length === item.records, "Anhui record count drifted before merge");
  assert(shard.rankConversions.length === 976 && shard.rankConversions.length === item.rankConversions, "Anhui rank count drifted before merge");
  assert(!shard.rankConversions.some((row) => row.sourceId === SOURCE_ID), "Anhui v3.329 ranks already exist");

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
  assert(officialLinked === 658 && thirdPartyLinked === 1146, "Official/third-party linked split drifted");
  assert(schoolOfficialScopeLinked === 658, "School-official-only linked count drifted");
  assert(topBucketLinked === 0, `Expected no top-bucket linked rows, got ${topBucketLinked}`);
  assert(linkedBySource.size === LINKED_SOURCE_NOTES, `Expected ${LINKED_SOURCE_NOTES} linked source IDs, got ${linkedBySource.size}`);
  assert(linkedByType.get("major-admission") === 1633, "Major linked count drifted");
  assert(linkedByType.get("institution-admission") === 157, "Institution linked count drifted");
  assert(linkedByType.get("major-group-admission") === 8, "Major-group linked count drifted");
  assert(linkedByType.get("school-admission-summary") === 6, "School-summary linked count drifted");

  shard.rankConversions = [...payload.rankConversions, ...shard.rankConversions];
  shard.rankConversions.sort((left, right) => (
    Number(right.year) - Number(left.year)
    || String(left.subjectType).localeCompare(String(right.subjectType), "zh-CN")
    || Number(right.score) - Number(left.score)
  ));
  shard.generatedAt = payload.generatedAt;
  assert(shard.rankConversions.length === 1937, "Anhui rank count drifted after merge");
  const historyAt600 = shard.rankConversions.find((row) => row.year === YEAR && row.subjectType === "历史类" && row.score === 600);
  const physicsAt600 = shard.rankConversions.find((row) => row.year === YEAR && row.subjectType === "物理类" && row.score === 600);
  assert(historyAt600?.sourceId === SOURCE_ID && historyAt600.rankEnd === 3415, "Anhui history runtime lookup drifted");
  assert(physicsAt600?.sourceId === SOURCE_ID && physicsAt600.rankEnd === 27089, "Anhui physics runtime lookup drifted");

  const layer = core.admissionScoreLayer;
  const noteById = new Map(layer.sourceNotes.map((note) => [note.id, note]));
  const missingLinkedNotes = [...linkedBySource.keys()].filter((sourceId) => !noteById.has(sourceId));
  assert(missingLinkedNotes.length === 0, `Missing linked source notes: ${missingLinkedNotes.join(", ")}`);
  for (const [sourceId, count] of linkedBySource) {
    const note = noteById.get(sourceId);
    note.scoreDerivedRankRecords = Number(note.scoreDerivedRankRecords || 0) + count;
    note.anhui2025ScoreDerivedRankRecords = count;
    note.anhui2025RankScoreBasis = SCORE_BASIS;
    note.anhui2025RankPolicyBonusIncluded = true;
    if (Number.isFinite(Number(note.rankUnavailableRecords))) {
      assert(Number(note.rankUnavailableRecords) >= count, `${sourceId} rank-unavailable source count is smaller than the Anhui linked count`);
      note.rankUnavailableRecords = Number(note.rankUnavailableRecords) - count;
    }
    if (Number.isFinite(Number(note.derivedRankRecords))) note.derivedRankRecords = Number(note.derivedRankRecords) + count;
    if (Number.isFinite(Number(note.scoreOnlyRecords))) {
      assert(Number(note.scoreOnlyRecords) >= count, `${sourceId} score-only source count is smaller than the Anhui linked count`);
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
  layer.currentFinding = "海南2025年555条官方综合投档分位次已为4241条海南2025综合普通类整数最低分完成同口径换算。新疆2025因政策加分口径未闭合，4234条无原生位次记录全部禁止自动套表。天津2025年381条官方含政策加分总成绩分数档已为3195条普通记录补充位次。上海2025年222条官方本科线上高考成绩分数档已为1964条上海2025综合普通类整数最低分补充含政策加分口径的市级位次区间。新增安徽2025年961条官方含加分分数档，双PDF副本字节一致且逐分累计闭合，为1804条安徽历史类/物理类普通整数最低分补充省级位次区间，其中658条来自官方院校来源；179条特殊路径继续隔离。";
  layer.downgradeReason = `当前数据层 ${NEXT_VERSION} 严格区分院校原生最低位次、同口径最低分换算位次和口径未闭合分数；海南2025表使用全体考生综合投档成绩，口径含照顾加分并公开至246分。新疆2025镜像表与官方含政策加分投档排序分出现9个0人分数冲突，4234条录取记录继续保持缺位次。天津2025表口径含政策加分并公开至300分。上海2025表口径含政策加分并仅公开本科线402分及以上，低于公开分数档不自动外推。安徽2025表按历史/物理分别统计，口径含加分并公开至200分；199分及以下、艺术体育综合分、非整数分和特殊路径不自动套表，历史668分及以上与物理691分及以上只保留官方合并位次区间。`;
  layer.sourceNotes.push(sourceNote);
  assert(layer.sourceNotes.length === 5133, `Expected 5133 source notes, got ${layer.sourceNotes.length}`);
  layer.availableEvidenceIds = sortedUnique([...(layer.availableEvidenceIds || []), SOURCE_ID]);
  layer.rankCoverage.records = NEXT_RANKS;
  addSorted(layer.rankCoverage, "provinces", PROVINCE);
  addSorted(layer.rankCoverage, "years", YEAR, { numeric: true });
  for (const subjectType of SUBJECT_TYPES) addSorted(layer.rankCoverage, "subjects", subjectType);
  updateRankSourceCoverage(layer.rankSourceCoverage);
  layer.coverage.rankConversionRecords = NEXT_RANKS;
  refreshReadiness(layer.provinceReadiness, shard);
  refreshReadiness(layer.coverage.provinceReadiness, shard);

  const shardBytes = encodeJson(shard);
  const coreBytes = encodeJson(core);
  manifest.generatedAt = payload.generatedAt;
  manifest.modelVersion = NEXT_VERSION;
  manifest.rankConversionCount = NEXT_RANKS;
  manifest.runtimeProfile = { ...(manifest.runtimeProfile || {}), version: "v3.329", initialCore: "knowledge-core-lite.json.gz", fullEvidenceCore: "knowledge-core.json.gz" };
  item.rankConversions = shard.rankConversions.length;
  item.bytes = shardBytes.byteLength;
  item.sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);

  const tempDir = path.join(releaseDir, `.v3329-${process.pid}`);
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
    dataset: "official-anhui-rank-conversion-2025-v3329-runtime",
    generatedAt: payload.generatedAt,
    sourceId: SOURCE_ID,
    importFile: args.importFile,
    releaseDir: args.releaseDir,
    before: { modelVersion: BASE_VERSION, records: RECORDS, rankConversions: BASE_RANKS, provinceRankConversions: 976 },
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
