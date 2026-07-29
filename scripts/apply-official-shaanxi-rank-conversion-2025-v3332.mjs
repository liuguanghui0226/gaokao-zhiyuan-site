#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.331-guangdong-official-rank2025-dual-level-bonus-full-table-aligned-868426records";
const NEXT_VERSION = "local-deterministic-v3.332-shaanxi-official-rank2025-dual-domain-lower-absent-bucket-guard-868426records";
const SOURCE_ID = "official-shaanxi-rank-2025-v3332";
const EXISTING_2026_SOURCE_ID = "official-shaanxi-rank-2026";
const OLD_QUEUED_SOURCE_IDS = ["dxsbb-rank-39f42ed1c2", "dxsbb-rank-8bb3730424"];
const OLD_QUEUED_URLS = ["https://www.dxsbb.com/news/148806.html", "https://www.dxsbb.com/news/148805.html"];
const PROVINCE = "陕西";
const YEAR = 2025;
const SUBJECT_TYPES = ["历史类", "物理类"];
const SCORE_BASIS = "ordinary-gaokao-published-score";
const BASE_RANKS = 132497;
const ADDED_RANKS = 1143;
const NEXT_RANKS = 133640;
const RECORDS = 868426;
const BASE_PROVINCE_RANKS = 1163;
const NEXT_PROVINCE_RANKS = 2306;
const LINKED_RECORDS = 992;
const LINKED_SOURCE_NOTES = 93;
const SPECIAL_EXCLUDED = 289;
const AMBIGUOUS_EXCLUDED = 302;
const CONTROL_LINES = {
  "历史类": { undergraduate: 414, vocational: 200 },
  "物理类": { undergraduate: 394, vocational: 200 },
};

function parseArgs(argv) {
  const args = {
    importFile: "data/admissions/official-shaanxi-rank-conversion-2025-v3332-import.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-shaanxi-rank-conversion-2025-v3332-runtime-manifest.json",
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

function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function gzipBytes(bytes) {
  return zlib.gzipSync(bytes, { level: 9, mtime: 0 });
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

function removeValue(container, key, value) {
  container[key] = (container[key] || []).filter((item) => item !== value);
}

function verifyImport(payload) {
  assert(payload.dataset === "official-shaanxi-rank-conversion-2025-v3332-import", `Unexpected dataset ${payload.dataset}`);
  assert(payload.sourceNotes?.length === 1 && payload.sourceNotes[0].id === SOURCE_ID, "Shaanxi source note mismatch");
  assert(payload.rankConversions?.length === ADDED_RANKS, `Expected ${ADDED_RANKS} rank rows`);
  assert(payload.audit?.parsedRecords === ADDED_RANKS && payload.audit?.duplicateIds === 0, "Shaanxi import count audit drifted");
  assert(payload.audit?.usableRankRecords === 1141 && payload.audit?.lowerAbsentAggregateRecords === 2, "Shaanxi lower-bucket audit drifted");
  assert(payload.audit?.comparedDualDomainCells === 3429 && payload.audit?.dualDomainDifferences === 0, "Shaanxi dual-domain audit drifted");
  assert(payload.audit?.cumulativeArithmeticErrors === 0, "Shaanxi cumulative arithmetic drifted");
  assert(payload.audit?.controlLines?.["历史类"]?.undergraduate === 414, "Shaanxi history control line drifted");
  assert(payload.audit?.controlLines?.["物理类"]?.undergraduate === 394, "Shaanxi physics control line drifted");
  assert(payload.audit?.controlLines?.["历史类"]?.vocational === 200 && payload.audit?.controlLines?.["物理类"]?.vocational === 200, "Shaanxi vocational control line drifted");
  assert(payload.audit?.scoreBasis === SCORE_BASIS && payload.audit?.policyBonusStatus === "authority-page-not-explicit", "Shaanxi score-basis audit drifted");
  assert(new Set(payload.rankConversions.map((row) => row.id)).size === ADDED_RANKS, "Duplicate rank IDs");
  assert(payload.rankConversions.every((row) => (
    row.province === PROVINCE
    && row.year === YEAR
    && SUBJECT_TYPES.includes(row.subjectType)
    && row.sourceId === SOURCE_ID
    && row.scoreBasis === SCORE_BASIS
    && row.rankPolicyBonusIncluded === null
  )), "Import contains out-of-scope rows");
}

function isBaseRanklessRecord(record) {
  const score = Number(record.minScore);
  return Number(record.year) === YEAR
    && SUBJECT_TYPES.includes(record.subjectType)
    && Number.isInteger(score)
    && score >= 101
    && score <= 750
    && !Number(record.minRankEnd || record.minRank)
    && !["plan", "control"].includes(record.dataType);
}

function rankUsageForRecord(record) {
  if (!isBaseRanklessRecord(record) || record.formalScoreScope === "special-path-only") return "";
  const score = Number(record.minScore);
  const batch = String(record.batch || "");
  if (/专科|高职/.test(batch) && score >= CONTROL_LINES[record.subjectType].vocational) return "vocational";
  const ordinaryUndergraduate = /本科|普通类|中外合作|综合/.test(batch)
    && !/专科|高职|高校专项|艺术|体育|提前|航海|国家专项|地方专项|公费|军|警|定向|少数民族|预科/.test(batch);
  if (ordinaryUndergraduate && score >= CONTROL_LINES[record.subjectType].undergraduate) return "undergraduate";
  return "";
}

function rankForScore(record, rankIndex, topBySubject) {
  const score = Number(record.minScore);
  const exact = rankIndex.get(`${record.subjectType}|${score}`);
  if (exact) return exact;
  const top = topBySubject.get(record.subjectType);
  return top && score >= top.scoreRange.min ? top : null;
}

function mapAdmissionRecord(record, rank, usage) {
  const rankRangeText = rank.rankStart === rank.rankEnd ? `${rank.rankEnd}` : `${rank.rankStart}-${rank.rankEnd}`;
  const obsoleteCaution = /(缺最低位次|未公开最低位次|不提供最低位次|生成假位次|rankUnavailable\s*=\s*true|不得仅凭本行分数单独输出录取概率)/i;
  const cautions = (record.cautions || []).filter((caution) => !obsoleteCaution.test(caution));
  cautions.splice(
    Math.min(1, cautions.length),
    0,
    `该位次由陕西2025官方${record.subjectType}普通高考分数段表按最低分换算，非原录取/投档表直接公布；官方页未单独说明政策加分口径。`,
  );
  if (rank.topMerged) cautions.push(`${rank.score}分及以上仅公开${rankRangeText}名合并区间，不生成档内伪精确位次。`);
  return {
    ...record,
    scoreOnly: false,
    rankUnavailable: false,
    nativeAdmissionRankUnavailable: true,
    rankDerivedFromScore: true,
    rankEvidenceScope: "score-derived-provincial-segment",
    rankUsage: usage,
    rankUsageLabel: usage === "vocational" ? "普通高考专科批共用分数段" : "普通高考本科批共用分数段",
    rankScoreBasis: SCORE_BASIS,
    rankPolicyBonusIncluded: null,
    rankPolicyBonusStatus: "authority-page-not-explicit",
    minRank: rank.rankEnd,
    minRankStart: rank.rankStart,
    minRankEnd: rank.rankEnd,
    rankRangeText: `${rankRangeText}（最低分换算）`,
    rankSourceId: SOURCE_ID,
    cautions,
  };
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
  assert(
    coverage.sources === 220
      && coverage.parsedSources === 154
      && coverage.queuedSources === 64
      && coverage.supersededSources === 2
      && coverage.parsedRecords === BASE_RANKS,
    "Base rank-source coverage drifted",
  );
  coverage.sources += 1;
  coverage.parsedSources += 1;
  coverage.queuedSources -= 2;
  coverage.imageQueuedSources -= 2;
  coverage.supersededSources += 2;
  coverage.parsedRecords += ADDED_RANKS;
  addSorted(coverage, "parsedProvinces", PROVINCE);
  addSorted(coverage, "parsedYears", YEAR, { numeric: true });
  for (const subjectType of SUBJECT_TYPES) addSorted(coverage, "subjects", subjectType);
  coverage.sampleQueuedSources = (coverage.sampleQueuedSources || []).filter((row) => !OLD_QUEUED_URLS.includes(row.url));

  const row = coverage.byYear?.find((item) => Number(item.year) === YEAR);
  assert(row, "2025 rank-source coverage row is missing");
  assert(
    row.sources === 86
      && row.parsedSources === 62
      && row.queuedSources === 22
      && row.supersededSources === 2
      && row.parsedRecords === 28844,
    "Base 2025 rank-source coverage drifted",
  );
  row.sources += 1;
  row.parsedSources += 1;
  row.queuedSources -= 2;
  row.supersededSources += 2;
  row.parsedRecords += ADDED_RANKS;
  addSorted(row, "parsedProvinces", PROVINCE);
  removeValue(row, "queuedProvinces", PROVINCE);
}

function scoreDerivedRankBoundary(note, count) {
  const existing = String(note.rankAlignmentBoundary || "").trim();
  const addition = `陕西2025年${count}条普通类整数最低分记录按同年官方分数段表换算；本科仅在历史414分、物理394分及以上匹配，明确专科批仅在200分及以上匹配；政策加分口径未在官方页单独说明。`;
  return existing ? `${existing} ${addition}` : addition;
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
    assert(shard.rankConversions.filter((row) => row.sourceId === SOURCE_ID).length === ADDED_RANKS, "Applied Shaanxi rank rows drifted");
    assert(shard.records.filter((row) => row.rankSourceId === SOURCE_ID).length === LINKED_RECORDS, "Applied Shaanxi admission links drifted");
    assert(
      shard.rankConversions.filter((row) => row.sourceId === EXISTING_2026_SOURCE_ID && row.containsAbsentCandidates).every((row) => row.rankEstimateUsable === false),
      "Applied 2026 lower-bucket guard drifted",
    );
    console.log(JSON.stringify({ status: "already-applied", modelVersion: NEXT_VERSION, rankConversionCount: manifest.rankConversionCount }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing to merge on unexpected core ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION && manifest.recordCount === RECORDS && manifest.rankConversionCount === BASE_RANKS, "Base manifest drifted");
  const layer = core.admissionScoreLayer;
  assert(layer.structuredRecords === RECORDS && layer.rankConversionRecords === BASE_RANKS, "Base core counts drifted");
  assert(!layer.sourceNotes.some((note) => note.id === SOURCE_ID), `${SOURCE_ID} already exists`);

  const item = manifest.shards[PROVINCE];
  assert(item, "Shaanxi runtime shard is missing");
  const slug = path.basename(item.file, ".json");
  const shardFile = path.join(releaseDir, `${slug}.json.gz`);
  const shard = readGzipJson(shardFile);
  assert(shard.records.length === 16003 && shard.records.length === item.records, "Shaanxi record count drifted");
  assert(shard.rankConversions.length === BASE_PROVINCE_RANKS && item.rankConversions === BASE_PROVINCE_RANKS, "Shaanxi rank count drifted");
  assert(!shard.rankConversions.some((row) => row.year === YEAR), "Shaanxi 2025 rank rows unexpectedly already exist");

  const guarded2026Buckets = shard.rankConversions.filter((row) => (
    row.sourceId === EXISTING_2026_SOURCE_ID
    && Number(row.scoreRange?.min) === 0
    && row.scoreRange?.max !== undefined
  ));
  assert(guarded2026Buckets.length === 2, `Expected two 2026 lower aggregate buckets, got ${guarded2026Buckets.length}`);
  for (const row of guarded2026Buckets) {
    row.rankEstimateUsable = false;
    row.containsAbsentCandidates = true;
    row.lowerAggregate = true;
    row.aggregateReason = "published-lower-score-range-includes-absent-candidates";
  }

  const usableRanks = payload.rankConversions.filter((row) => row.rankEstimateUsable !== false);
  const rankIndex = new Map(usableRanks.filter((row) => !row.topMerged).map((row) => [`${row.subjectType}|${row.score}`, row]));
  const topBySubject = new Map(usableRanks.filter((row) => row.topMerged).map((row) => [row.subjectType, row]));
  const linkedBySource = new Map();
  const linkedByType = new Map();
  const linkedByUsage = new Map();
  const linkedBySubject = new Map();
  let linkedRecords = 0;
  let officialLinked = 0;
  let thirdPartyLinked = 0;
  let schoolOfficialScopeLinked = 0;
  let topBucketLinked = 0;

  const specialExcluded = shard.records.filter((record) => isBaseRanklessRecord(record) && record.formalScoreScope === "special-path-only").length;
  const ambiguousExcluded = shard.records.filter((record) => (
    isBaseRanklessRecord(record)
    && record.formalScoreScope !== "special-path-only"
    && !rankUsageForRecord(record)
  )).length;
  assert(specialExcluded === SPECIAL_EXCLUDED, `Expected ${SPECIAL_EXCLUDED} special-path exclusions, got ${specialExcluded}`);
  assert(ambiguousExcluded === AMBIGUOUS_EXCLUDED, `Expected ${AMBIGUOUS_EXCLUDED} ambiguous exclusions, got ${ambiguousExcluded}`);

  shard.records = shard.records.map((record) => {
    const usage = rankUsageForRecord(record);
    if (!usage) return record;
    const rank = rankForScore(record, rankIndex, topBySubject);
    assert(rank, `No Shaanxi rank mapping for ${record.id} at ${record.minScore}`);
    const mapped = mapAdmissionRecord(record, rank, usage);
    linkedRecords += 1;
    linkedBySource.set(mapped.sourceId, Number(linkedBySource.get(mapped.sourceId) || 0) + 1);
    linkedByType.set(mapped.dataType, Number(linkedByType.get(mapped.dataType) || 0) + 1);
    linkedByUsage.set(usage, Number(linkedByUsage.get(usage) || 0) + 1);
    linkedBySubject.set(mapped.subjectType, Number(linkedBySubject.get(mapped.subjectType) || 0) + 1);
    if (String(record.sourceQuality || "").startsWith("official")) officialLinked += 1;
    else thirdPartyLinked += 1;
    if (record.formalScoreScope === "school-official-only") schoolOfficialScopeLinked += 1;
    if (rank.topMerged) topBucketLinked += 1;
    return mapped;
  });
  assert(linkedRecords === LINKED_RECORDS, `Expected ${LINKED_RECORDS} linked records, got ${linkedRecords}`);
  assert(officialLinked === 537 && thirdPartyLinked === 455 && schoolOfficialScopeLinked === 537, "Linked provenance split drifted");
  assert(linkedBySource.size === LINKED_SOURCE_NOTES, `Expected ${LINKED_SOURCE_NOTES} linked source notes`);
  assert(linkedByUsage.get("undergraduate") === 986 && linkedByUsage.get("vocational") === 6, "Linked level split drifted");
  assert(linkedBySubject.get("历史类") === 263 && linkedBySubject.get("物理类") === 729, "Linked subject split drifted");
  assert(
    linkedByType.get("institution-admission") === 106
      && linkedByType.get("major-admission") === 876
      && linkedByType.get("major-group-admission") === 7
      && linkedByType.get("school-admission-summary") === 3,
    "Linked data-type split drifted",
  );
  assert(topBucketLinked === 0, `Expected no top-bucket admission links, got ${topBucketLinked}`);

  shard.rankConversions = [...payload.rankConversions, ...shard.rankConversions];
  shard.rankConversions.sort((left, right) => (
    Number(right.year) - Number(left.year)
    || String(left.subjectType).localeCompare(String(right.subjectType), "zh-CN")
    || Number(right.score) - Number(left.score)
    || Number(left.rankStart) - Number(right.rankStart)
  ));
  shard.generatedAt = payload.generatedAt;
  assert(shard.rankConversions.length === NEXT_PROVINCE_RANKS, "Shaanxi rank count drifted after merge");
  assert(shard.rankConversions.filter((row) => row.sourceId === SOURCE_ID).length === ADDED_RANKS, "New Shaanxi rank rows drifted");
  assert(shard.rankConversions.filter((row) => row.sourceId === SOURCE_ID && row.rankEstimateUsable === false).length === 2, "New lower-bucket guards drifted");
  const history500 = rankIndex.get("历史类|500");
  const physics500 = rankIndex.get("物理类|500");
  assert(history500?.rankEnd === 17255 && physics500?.rankEnd === 55138, "Shaanxi 500-point checkpoints drifted");

  const sourceNote = { ...payload.sourceNotes[0], file: args.importFile };
  const noteById = new Map(layer.sourceNotes.map((note) => [note.id, note]));
  for (const oldSourceId of OLD_QUEUED_SOURCE_IDS) {
    const note = noteById.get(oldSourceId);
    assert(note && Number(note.parsedRecords || 0) === 0, `Missing queued source ${oldSourceId}`);
    note.status = "superseded";
    note.supersededBy = SOURCE_ID;
    note.activeRuntimeRecords = 0;
    note.supersededAt = payload.generatedAt;
    note.replacementReason = "陕西省教育考试院与陕西招生考试信息网双官方域HTML完整表已逐单元核验，不再依赖第三方图片队列。";
  }

  const existing2026Note = noteById.get(EXISTING_2026_SOURCE_ID);
  assert(existing2026Note, "Shaanxi 2026 source note is missing");
  existing2026Note.lowerAggregateEstimateGuard = true;
  existing2026Note.lowerAggregateGuardedRecords = 2;
  existing2026Note.usage = `${String(existing2026Note.usage || "").replace(/。?$/, "")}；两个含缺考人数的末端汇总桶仅保留证据，不参与位次估算。`;
  existing2026Note.cautions = sortedUnique([
    ...(existing2026Note.cautions || []),
    "末端“及以下及缺考”汇总桶含无法分离的缺考人数，已禁止用于分数到位次估算。",
  ]);

  const missingLinkedNotes = [...linkedBySource.keys()].filter((sourceId) => !noteById.has(sourceId));
  assert(missingLinkedNotes.length === 0, `Missing linked source notes: ${missingLinkedNotes.join(", ")}`);
  for (const [sourceId, count] of linkedBySource) {
    const note = noteById.get(sourceId);
    note.scoreDerivedRankRecords = Number(note.scoreDerivedRankRecords || 0) + count;
    note.shaanxi2025ScoreDerivedRankRecords = count;
    note.shaanxi2025RankScoreBasis = SCORE_BASIS;
    note.shaanxi2025RankPolicyBonusIncluded = null;
    note.shaanxi2025PolicyBonusStatus = "authority-page-not-explicit";
    if (Number.isFinite(Number(note.rankUnavailableRecords))) {
      assert(Number(note.rankUnavailableRecords) >= count, `${sourceId} rank-unavailable count is smaller than linked count`);
      note.rankUnavailableRecords = Number(note.rankUnavailableRecords) - count;
    }
    if (Number.isFinite(Number(note.derivedRankRecords))) note.derivedRankRecords = Number(note.derivedRankRecords) + count;
    if (Number.isFinite(Number(note.scoreOnlyRecords))) {
      assert(Number(note.scoreOnlyRecords) >= count, `${sourceId} score-only count is smaller than linked count`);
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
  layer.currentFinding = `${layer.currentFinding} 陕西2025年历史/物理双官方域HTML表逐单元核验一致，新增1143条分数段记录，其中1141条可用于估算、2条含缺考人数的低分汇总仅保留证据。992条陕西普通类整数最低分获得同年省级位次，其中本科986条、专科6条；289条特殊路径和302条批次或控制线边界不明记录继续隔离。`;
  layer.downgradeReason = `${String(layer.downgradeReason || "").replace(BASE_VERSION, NEXT_VERSION)} 陕西补充边界：官方页面未单独说明政策加分是否计入分数段，因此不擅自标注含加分或不含加分；本科仅在历史414分、物理394分及以上且批次明确时换算，专科仅在200分及以上且批次明确时换算；含缺考人数的末端汇总桶禁止参与估算。`;
  layer.sourceNotes.push(sourceNote);
  assert(layer.sourceNotes.length === 5136, `Expected 5136 source notes, got ${layer.sourceNotes.length}`);
  layer.availableEvidenceIds = sortedUnique([...(layer.availableEvidenceIds || []), SOURCE_ID]);
  layer.rankCoverage.records = NEXT_RANKS;
  addSorted(layer.rankCoverage, "provinces", PROVINCE);
  addSorted(layer.rankCoverage, "years", YEAR, { numeric: true });
  for (const subjectType of SUBJECT_TYPES) addSorted(layer.rankCoverage, "subjects", subjectType);
  updateRankSourceCoverage(layer.rankSourceCoverage);
  layer.coverage.rankConversionRecords = NEXT_RANKS;
  refreshReadiness(layer.provinceReadiness, shard);
  refreshReadiness(layer.coverage.provinceReadiness, shard);

  const shardBytes = jsonBytes(shard);
  const coreBytes = jsonBytes(core);
  manifest.generatedAt = payload.generatedAt;
  manifest.modelVersion = NEXT_VERSION;
  manifest.rankConversionCount = NEXT_RANKS;
  manifest.runtimeProfile = {
    ...(manifest.runtimeProfile || {}),
    version: "v3.332",
    initialCore: "knowledge-core-lite.json.gz",
    fullEvidenceCore: "knowledge-core.json.gz",
  };
  item.rankConversions = shard.rankConversions.length;
  item.bytes = shardBytes.byteLength;
  item.sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = jsonBytes(manifest);

  const tempDir = path.join(releaseDir, `.v3332-${process.pid}`);
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
    dataset: "official-shaanxi-rank-conversion-2025-v3332-runtime",
    generatedAt: payload.generatedAt,
    sourceId: SOURCE_ID,
    importFile: args.importFile,
    releaseDir: args.releaseDir,
    before: {
      modelVersion: BASE_VERSION,
      records: RECORDS,
      rankConversions: BASE_RANKS,
      provinceRecords: shard.records.length,
      provinceRankConversions: BASE_PROVINCE_RANKS,
      queuedRankSources: 2,
    },
    after: {
      modelVersion: NEXT_VERSION,
      records: RECORDS,
      rankConversions: NEXT_RANKS,
      rankConversionsAdded: ADDED_RANKS,
      usableRankRecordsAdded: 1141,
      lowerAbsentAggregateRecordsAdded: 2,
      guardedExisting2026LowerAggregateRecords: guarded2026Buckets.length,
      provinceRecords: shard.records.length,
      provinceRankConversions: shard.rankConversions.length,
      linkedAdmissionRecords: linkedRecords,
      officialLinkedRecords: officialLinked,
      thirdPartyLinkedRecords: thirdPartyLinked,
      schoolOfficialScopeLinkedRecords: schoolOfficialScopeLinked,
      specialPathExcludedRecords: specialExcluded,
      ambiguousExcludedRecords: ambiguousExcluded,
      topBucketLinkedRecords: topBucketLinked,
      linkedSourceNotes: linkedBySource.size,
      linkedByUsage: Object.fromEntries([...linkedByUsage].sort((left, right) => left[0].localeCompare(right[0]))),
      linkedBySubject: Object.fromEntries([...linkedBySubject].sort((left, right) => left[0].localeCompare(right[0], "zh-CN"))),
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
    specialPathExcludedRecords: specialExcluded,
    ambiguousExcludedRecords: ambiguousExcluded,
    guardedExisting2026LowerAggregateRecords: guarded2026Buckets.length,
    sourceNotes: layer.sourceNotes.length,
    shardSha256: runtimeManifest.after.shardSha256,
    coreSha256: runtimeManifest.after.coreSha256,
  }, null, 2));
}

main();
