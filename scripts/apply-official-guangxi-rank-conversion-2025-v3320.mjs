#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.319-jiangsu-jseea-first-stage-rank2025-aligned-868426records";
const NEXT_VERSION = "local-deterministic-v3.320-guangxi-dual-bonus-scope-rank2025-aligned-868426records";
const SOURCE_ID = "official-guangxi-rank-2025-v3320";
const PROVINCE = "广西";
const YEAR = 2025;
const BASE_RANKS = 122287;
const ADDED_RANKS = 1896;
const NEXT_RANKS = 124183;
const RECORDS = 868426;
const LINKED_RECORDS = 8222;
const EXCLUDED_SPECIAL_RECORDS = 110;
const LINKED_SOURCE_NOTES = 105;
const LOCAL_SCOPE = "inside-guangxi";
const OUTSIDE_SCOPE = "outside-guangxi";

function parseArgs(argv) {
  const args = {
    importFile: "data/admissions/official-guangxi-rank-conversion-2025-v3320-import.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-guangxi-rank-conversion-2025-v3320-runtime-manifest.json",
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

function scoreDerivedRankBoundary(note, guangxiCount) {
  const fields = [
    ["河北", "hebei2025ScoreDerivedRankRecords"],
    ["重庆", "chongqing2025ScoreDerivedRankRecords"],
    ["辽宁", "liaoning2025ScoreDerivedRankRecords"],
    ["湖南", "hunan2025ScoreDerivedRankRecords"],
    ["江苏", "jiangsu2025ScoreDerivedRankRecords"],
    ["广西", "guangxi2025ScoreDerivedRankRecords"],
  ];
  const scopes = [];
  for (const [province, field] of fields) {
    const count = field === "guangxi2025ScoreDerivedRankRecords" ? guangxiCount : Number(note[field] || 0);
    if (count > 0) scopes.push(`${province}2025年${count}条`);
  }
  return `${scopes.join("、")}历史/物理类整数最低分记录按同年一分一段表换算省级位次区间；广西严格按目标院校区内/区外选用对应加分表，200分以下、其他年份和特殊路径保持原证据状态。`;
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
  assert(payload.dataset === "official-guangxi-rank-conversion-2025-v3320-import", `Unexpected dataset ${payload.dataset}`);
  assert(payload.sourceNotes?.length === 1 && payload.sourceNotes[0].id === SOURCE_ID, "Guangxi source note mismatch");
  assert(payload.rankConversions?.length === ADDED_RANKS, `Expected ${ADDED_RANKS} rank rows`);
  assert(payload.audit?.parsedRecords === ADDED_RANKS && payload.audit?.duplicateIds === 0, "Guangxi import audit drifted");
  assert(payload.audit?.rowComparisons === 1892 && payload.audit?.cellComparisons === 7568 && payload.audit?.sourceDifferences === 0, "Guangxi evidence comparison drifted");
  assert(payload.audit?.nationalInstitutionCount === 2919 && payload.audit?.localInstitutionCount === 89, "MOE institution scope inventory drifted");
  assert(payload.rankConversions.filter((row) => row.subjectType === "历史类").length === 920, "History row count drifted");
  assert(payload.rankConversions.filter((row) => row.subjectType === "物理类").length === 976, "Physics row count drifted");
  assert(payload.rankConversions.filter((row) => row.rankInstitutionScope === LOCAL_SCOPE).length === 948, "Local-scope rank count drifted");
  assert(payload.rankConversions.filter((row) => row.rankInstitutionScope === OUTSIDE_SCOPE).length === 948, "Outside-scope rank count drifted");
  assert(payload.rankConversions.every((row) => row.province === PROVINCE && row.year === YEAR && row.sourceId === SOURCE_ID), "Import contains out-of-scope rows");
}

function normalizeSchoolName(value) {
  return String(value || "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function createInstitutionScopeClassifier(payload) {
  const localCodes = new Set(payload.localInstitutions.map((row) => row.schoolCode));
  const localNames = new Set(payload.localInstitutions.map((row) => normalizeSchoolName(row.schoolName)));
  const nationalCodes = new Set(payload.nationalInstitutions.map((row) => row.schoolCode));
  const nationalNames = new Set(payload.nationalInstitutions.map((row) => normalizeSchoolName(row.schoolName)));
  const localCities = new Set(["南宁", "柳州", "桂林", "梧州", "北海", "防城港", "钦州", "贵港", "玉林", "百色", "贺州", "河池", "来宾", "崇左"]);
  const aliases = new Map([
    ["桂林医学院", "桂林医科大学"],
    ["桂林师范高等专科学校", "桂林师范学院"],
    ["南宁职业技术学院", "南宁职业技术大学"],
    ["柳州职业技术学院", "柳州职业技术大学"],
  ]);
  return (record) => {
    const schoolCode = String(record.schoolCode || "").match(/\d+/)?.[0]?.slice(-5) || "";
    if (schoolCode && localCodes.has(schoolCode)) return LOCAL_SCOPE;
    let schoolName = normalizeSchoolName(record.schoolName);
    schoolName = aliases.get(schoolName) || schoolName;
    if (localNames.has(schoolName)) return LOCAL_SCOPE;
    const city = String(record.city || "").replace(/市/g, "").trim();
    if (city && localCities.has(city)) return LOCAL_SCOPE;
    if (schoolCode && nationalCodes.has(schoolCode)) return OUTSIDE_SCOPE;
    if (schoolName && nationalNames.has(schoolName)) return OUTSIDE_SCOPE;
    if (schoolCode && /^\d{5}$/.test(schoolCode)) return OUTSIDE_SCOPE;
    if (city && !/未知|全国|待核/.test(city)) return OUTSIDE_SCOPE;
    return "unknown";
  };
}

function rankKey(scope, subjectType, score) {
  return `${scope}|${subjectType}|${score}`;
}

function isEligibleRecord(record, classifyScope, rankIndex, topByScopeSubject) {
  const score = Number(record.minScore);
  const scope = classifyScope(record);
  const top = topByScopeSubject.get(`${scope}|${record.subjectType}`);
  const hasRank = rankIndex.has(rankKey(scope, record.subjectType, score)) || (top && score > top.score);
  return Number(record.year) === YEAR
    && ["历史类", "物理类"].includes(record.subjectType)
    && Number.isInteger(score)
    && score >= 200
    && score <= 750
    && scope !== "unknown"
    && hasRank
    && !Number(record.minRankEnd || record.minRank)
    && record.formalScoreScope !== "special-path-only";
}

function mapAdmissionRecord(record, scope, rankIndex, topByScopeSubject) {
  const score = Number(record.minScore);
  const exact = rankIndex.get(rankKey(scope, record.subjectType, score));
  const top = topByScopeSubject.get(`${scope}|${record.subjectType}`);
  const rank = exact || (top && score > top.score ? top : null);
  assert(rank, `No ${scope} ${record.subjectType} rank mapping for ${record.id} at score ${record.minScore}`);
  const rankRangeText = rank.rankStart === rank.rankEnd ? `${rank.rankEnd}` : `${rank.rankStart}-${rank.rankEnd}`;
  const scopeText = scope === LOCAL_SCOPE ? "区内院校最高加分" : "区外院校全国性加分";
  const replacementCaution = `该位次由广西2025${scopeText}一分一档表按最低分换算，非原录取/投档表直接公布。`;
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
    rankInstitutionScope: rank.rankInstitutionScope,
    rankInstitutionScopeLabel: rank.rankInstitutionScopeLabel,
    scoreBonusScope: rank.scoreBonusScope,
    scoreBonusScopeLabel: rank.scoreBonusScopeLabel,
    minRank: rank.rankEnd,
    minRankStart: rank.rankStart,
    minRankEnd: rank.rankEnd,
    rankRangeText: `${rankRangeText}（${scopeText}最低分换算）`,
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
  assert(item, "Guangxi runtime shard is missing");
  const slug = path.basename(item.file, ".json");
  const shardFile = path.join(releaseDir, `${slug}.json.gz`);
  const shard = readGzipJson(shardFile);
  assert(shard.records.length === 20452 && shard.records.length === item.records, "Guangxi record count drifted before merge");
  assert(shard.rankConversions.length === 1012 && shard.rankConversions.length === item.rankConversions, "Guangxi rank count drifted before merge");
  assert(!shard.rankConversions.some((row) => row.sourceId === SOURCE_ID), "Guangxi v3.320 ranks already exist");

  const sourceNote = { ...payload.sourceNotes[0], file: args.importFile };
  const classifyScope = createInstitutionScopeClassifier(payload);
  const rankIndex = new Map(payload.rankConversions.map((row) => [rankKey(row.rankInstitutionScope, row.subjectType, row.score), row]));
  const topByScopeSubject = new Map(payload.rankConversions.filter((row) => row.scoreRange).map((row) => [`${row.rankInstitutionScope}|${row.subjectType}`, row]));
  const linkedBySource = new Map();
  const linkedByType = new Map();
  const linkedByScope = new Map();
  let linkedRecords = 0;
  let officialLinked = 0;
  let thirdPartyLinked = 0;
  let schoolOfficialScopeLinked = 0;
  let topBucketLinked = 0;

  const isRankableBase = (record) => Number(record.year) === YEAR
    && ["历史类", "物理类"].includes(record.subjectType)
    && Number.isInteger(Number(record.minScore))
    && Number(record.minScore) >= 200
    && Number(record.minScore) <= 750
    && !Number(record.minRankEnd || record.minRank);
  const specialExcludedBefore = shard.records.filter((record) => isRankableBase(record) && record.formalScoreScope === "special-path-only").length;
  assert(specialExcludedBefore === EXCLUDED_SPECIAL_RECORDS, `Expected ${EXCLUDED_SPECIAL_RECORDS} isolated special-path rows, got ${specialExcludedBefore}`);
  const eligibleBefore = shard.records.filter((record) => isRankableBase(record) && record.formalScoreScope !== "special-path-only");
  const unclassifiedBefore = eligibleBefore.filter((record) => classifyScope(record) === "unknown");
  assert(unclassifiedBefore.length === 0, `Unclassified Guangxi target institutions: ${sortedUnique(unclassifiedBefore.map((row) => row.schoolName)).join(", ")}`);

  shard.records = shard.records.map((record) => {
    if (!isEligibleRecord(record, classifyScope, rankIndex, topByScopeSubject)) return record;
    const scope = classifyScope(record);
    const mapped = mapAdmissionRecord(record, scope, rankIndex, topByScopeSubject);
    linkedRecords += 1;
    linkedBySource.set(mapped.sourceId, Number(linkedBySource.get(mapped.sourceId) || 0) + 1);
    linkedByType.set(mapped.dataType, Number(linkedByType.get(mapped.dataType) || 0) + 1);
    linkedByScope.set(scope, Number(linkedByScope.get(scope) || 0) + 1);
    if (String(record.sourceQuality || "").startsWith("official")) officialLinked += 1;
    else thirdPartyLinked += 1;
    if (record.formalScoreScope === "school-official-only") schoolOfficialScopeLinked += 1;
    if (mapped.minRankStart === 1) topBucketLinked += 1;
    return mapped;
  });
  assert(linkedRecords === LINKED_RECORDS, `Expected ${LINKED_RECORDS} linked admission records, got ${linkedRecords}`);
  assert(officialLinked === 7554 && thirdPartyLinked === 668, "Official/third-party linked split drifted");
  assert(schoolOfficialScopeLinked === 633, "School-official-only linked count drifted");
  assert(topBucketLinked === 1, `Expected 1 top-bucket linked row, got ${topBucketLinked}`);
  assert(linkedBySource.size === LINKED_SOURCE_NOTES, `Expected ${LINKED_SOURCE_NOTES} linked source IDs, got ${linkedBySource.size}`);
  assert(linkedByScope.get(OUTSIDE_SCOPE) === 7018 && linkedByScope.get(LOCAL_SCOPE) === 1204, "Institution-scope linked split drifted");
  assert(linkedByType.get("major-admission") === 1148, "Major linked count drifted");
  assert(linkedByType.get("institution-admission") === 135, "Institution linked count drifted");
  assert(linkedByType.get("vocational-admission") === 1871, "Vocational linked count drifted");
  assert(linkedByType.get("major-group-admission") === 5062, "Major-group linked count drifted");
  assert(linkedByType.get("school-admission-summary") === 6, "School-summary linked count drifted");

  shard.rankConversions.push(...payload.rankConversions);
  shard.rankConversions.sort((left, right) => (
    Number(right.year) - Number(left.year)
    || String(left.subjectType).localeCompare(String(right.subjectType), "zh-CN")
    || String(left.rankInstitutionScope || "").localeCompare(String(right.rankInstitutionScope || ""))
    || Number(right.score) - Number(left.score)
  ));
  shard.generatedAt = payload.generatedAt;
  assert(shard.rankConversions.length === 2908, "Guangxi rank count drifted after merge");

  const layer = core.admissionScoreLayer;
  const noteById = new Map(layer.sourceNotes.map((note) => [note.id, note]));
  const missingLinkedNotes = [...linkedBySource.keys()].filter((sourceId) => !noteById.has(sourceId));
  assert(missingLinkedNotes.length === 0, `Missing linked source notes: ${missingLinkedNotes.join(", ")}`);
  for (const [sourceId, count] of linkedBySource) {
    const note = noteById.get(sourceId);
    note.scoreDerivedRankRecords = Number(note.scoreDerivedRankRecords || 0) + count;
    note.guangxi2025ScoreDerivedRankRecords = count;
    if (Number.isFinite(Number(note.rankUnavailableRecords))) {
      assert(Number(note.rankUnavailableRecords) >= count, `${sourceId} rank-unavailable source count is smaller than the Guangxi linked count`);
      note.rankUnavailableRecords = Number(note.rankUnavailableRecords) - count;
    }
    if (Number.isFinite(Number(note.derivedRankRecords))) note.derivedRankRecords = Number(note.derivedRankRecords) + count;
    if (Number.isFinite(Number(note.scoreOnlyRecords))) {
      assert(Number(note.scoreOnlyRecords) >= count, `${sourceId} score-only source count is smaller than the Guangxi linked count`);
      note.scoreOnlyRecords = Number(note.scoreOnlyRecords) - count;
    }
    if (Number.isFinite(Number(note.recordsWithScoreDerivedRank))) note.recordsWithScoreDerivedRank = Number(note.recordsWithScoreDerivedRank) + count;
    if (Number.isFinite(Number(note.recordsWithAnyRank))) note.recordsWithAnyRank = Number(note.recordsWithAnyRank) + count;
    note.rankSourceIds = sortedUnique([...(note.rankSourceIds || []), SOURCE_ID]);
    note.rankEvidenceScope = "score-derived-provincial-segment";
    note.rankInstitutionScopes = sortedUnique([...(note.rankInstitutionScopes || []), LOCAL_SCOPE, OUTSIDE_SCOPE]);
    note.rankAlignmentBoundary = scoreDerivedRankBoundary(note, count);
  }

  core.generatedAt = payload.generatedAt;
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;
  layer.rankConversionRecords = NEXT_RANKS;
  layer.statusLabel = `已接入${RECORDS}条结构化录取/计划数据 + ${NEXT_RANKS}条一分一段记录`;
  layer.currentFinding = "新增广西2025年历史/物理普通类四张一分一档表，共1896条位次记录；1892条公开分数档与独立完整HTML表7568个分数、人数、累计人数、名次单元逐项一致，并用教育部2025年2919所普通高校名单中的89所广西高校校码锁定区内院校。由此为8222条广西2025普通整数最低分记录补充目标院校对应口径的省级位次，其中区外7018条、区内1204条；110条特殊路径继续隔离。";
  layer.downgradeReason = `当前数据层 ${NEXT_VERSION} 严格区分院校原生最低位次与最低分换算位次；广西区外院校只使用总成绩加全国性加分表，区内院校只使用全国性/地方性加分取最高表。200分以下、艺体综合分、科类不明、非整数分和特殊路径不混入普通类推荐。`;
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
  manifest.runtimeProfile = { ...(manifest.runtimeProfile || {}), version: "v3.320", initialCore: "knowledge-core-lite.json.gz", fullEvidenceCore: "knowledge-core.json.gz" };
  item.rankConversions = shard.rankConversions.length;
  item.bytes = shardBytes.byteLength;
  item.sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);

  const tempDir = path.join(releaseDir, `.v3320-${process.pid}`);
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
    dataset: "official-guangxi-rank-conversion-2025-v3320-runtime",
    generatedAt: payload.generatedAt,
    sourceId: SOURCE_ID,
    importFile: args.importFile,
    releaseDir: args.releaseDir,
    before: { modelVersion: BASE_VERSION, records: RECORDS, rankConversions: BASE_RANKS, provinceRankConversions: 1012 },
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
      unclassifiedEligibleRecords: unclassifiedBefore.length,
      topBucketLinkedRecords: topBucketLinked,
      linkedSourceNotes: linkedBySource.size,
      linkedByInstitutionScope: Object.fromEntries([...linkedByScope].sort((left, right) => left[0].localeCompare(right[0]))),
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
    linkedByInstitutionScope: runtimeManifest.after.linkedByInstitutionScope,
    officialLinkedRecords: officialLinked,
    thirdPartyLinkedRecords: thirdPartyLinked,
    specialPathExcludedRecords: specialExcludedBefore,
    sourceNotes: layer.sourceNotes.length,
    shardSha256: runtimeManifest.after.shardSha256,
    coreSha256: runtimeManifest.after.coreSha256,
  }, null, 2));
}

main();
