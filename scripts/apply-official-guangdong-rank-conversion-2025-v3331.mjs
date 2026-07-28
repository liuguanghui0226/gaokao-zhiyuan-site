#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.330-jiangxi-official-rank2025-filing-score-policy-bonus-inclusive-full-table-replaced-868426records";
const NEXT_VERSION = "local-deterministic-v3.331-guangdong-official-rank2025-dual-level-bonus-full-table-aligned-868426records";
const SOURCE_ID = "official-guangdong-rank-2025-v3331";
const OLD_QUEUED_SOURCE_IDS = ["dxsbb-rank-4aadc8d7d9", "dxsbb-rank-311e47f782"];
const OLD_QUEUED_URLS = ["https://www.dxsbb.com/news/148857.html", "https://www.dxsbb.com/news/148856.html"];
const PROVINCE = "广东";
const YEAR = 2025;
const SUBJECT_TYPES = ["历史类", "物理类"];
const BASE_RANKS = 130155;
const ADDED_RANKS = 2342;
const NEXT_RANKS = 132497;
const RECORDS = 868426;
const BASE_PROVINCE_RANKS = 8816;
const NEXT_PROVINCE_RANKS = 11158;
const LINKED_RECORDS = 1253;
const LINKED_SOURCE_NOTES = 92;
const SPECIAL_EXCLUDED = 54;
const AMBIGUOUS_EXCLUDED = 94;
const CONTROL_LINES = { "历史类": 464, "物理类": 436 };

function parseArgs(argv) {
  const args = {
    importFile: "data/admissions/official-guangdong-rank-conversion-2025-v3331-import.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-guangdong-rank-conversion-2025-v3331-runtime-manifest.json",
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

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
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
  assert(payload.dataset === "official-guangdong-rank-conversion-2025-v3331-import", `Unexpected dataset ${payload.dataset}`);
  assert(payload.sourceNotes?.length === 1 && payload.sourceNotes[0].id === SOURCE_ID, "Guangdong source note mismatch");
  assert(payload.rankConversions?.length === ADDED_RANKS, `Expected ${ADDED_RANKS} rank rows`);
  assert(payload.audit?.rawScoreRows === 1171, "Guangdong raw score row count drifted");
  assert(payload.audit?.parsedHistoryRows === 573 && payload.audit?.parsedPhysicsRows === 598, "Guangdong subject row count drifted");
  assert(payload.audit?.usageRecords?.undergraduate === 1171 && payload.audit?.usageRecords?.vocational === 1171, "Dual-usage row count drifted");
  assert(payload.audit?.mirrorZipByteIdentical === true, "Official and mirror ZIP identity drifted");
  assert(payload.audit?.scoreGaps === 0 && payload.audit?.cumulativeArithmeticErrors === 0, "Rank-table arithmetic audit drifted");
  assert(
    payload.audit?.rankUsageBucketDifferences?.["历史类"] === 399
      && payload.audit?.rankUsageBucketDifferences?.["物理类"] === 422,
    "Dual-level difference audit drifted",
  );
  assert(new Set(payload.rankConversions.map((row) => row.id)).size === ADDED_RANKS, "Duplicate rank IDs");
  assert(payload.rankConversions.every((row) => (
    row.province === PROVINCE
    && row.year === YEAR
    && SUBJECT_TYPES.includes(row.subjectType)
    && ["undergraduate", "vocational"].includes(row.rankUsage)
    && row.sourceId === SOURCE_ID
    && row.rankPolicyBonusIncluded === true
  )), "Import contains out-of-scope rows");
}

function isBaseRanklessRecord(record) {
  const score = Number(record.minScore);
  return Number(record.year) === YEAR
    && SUBJECT_TYPES.includes(record.subjectType)
    && Number.isInteger(score)
    && score >= 100
    && score <= 750
    && !Number(record.minRankEnd || record.minRank)
    && !["plan", "control"].includes(record.dataType);
}

function rankUsageForRecord(record) {
  if (!isBaseRanklessRecord(record) || record.formalScoreScope === "special-path-only") return "";
  const batch = String(record.batch || "");
  if (/专科|高职/.test(batch)) return "vocational";
  const ordinaryUndergraduate = /本科|普通类|中外合作|综合/.test(batch)
    && !/专科|高职|高校专项|艺术|体育|提前|航海/.test(batch);
  if (ordinaryUndergraduate && Number(record.minScore) >= CONTROL_LINES[record.subjectType]) return "undergraduate";
  return "";
}

function mapAdmissionRecord(record, rank, usage) {
  const rankRangeText = rank.rankStart === rank.rankEnd ? `${rank.rankEnd}` : `${rank.rankStart}-${rank.rankEnd}`;
  const label = usage === "vocational" ? "专科层次加分" : "本科层次加分";
  const obsoleteCaution = /(缺最低位次|未公开最低位次|不提供最低位次|生成假位次|rankUnavailable\s*=\s*true|不得仅凭本行分数单独输出录取概率)/i;
  const cautions = (record.cautions || []).filter((caution) => !obsoleteCaution.test(caution));
  cautions.splice(
    Math.min(1, cautions.length),
    0,
    `该位次由广东2025官方${record.subjectType}${label}分档表按最低分换算，非原录取/投档表直接公布。`,
  );
  return {
    ...record,
    scoreOnly: false,
    rankUnavailable: false,
    nativeAdmissionRankUnavailable: true,
    rankDerivedFromScore: true,
    rankEvidenceScope: "score-derived-provincial-segment",
    rankUsage: usage,
    rankUsageLabel: label,
    rankScoreBasis: rank.scoreBasis,
    rankPolicyBonusIncluded: true,
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
    coverage.sources === 219
      && coverage.parsedSources === 153
      && coverage.queuedSources === 66
      && coverage.parsedRecords === BASE_RANKS,
    "Base rank-source coverage drifted",
  );
  coverage.sources += 1;
  coverage.parsedSources += 1;
  coverage.queuedSources -= 2;
  coverage.imageQueuedSources -= 2;
  coverage.supersededSources = Number(coverage.supersededSources || 0) + 2;
  coverage.parsedRecords += ADDED_RANKS;
  addSorted(coverage, "parsedProvinces", PROVINCE);
  addSorted(coverage, "parsedYears", YEAR, { numeric: true });
  for (const subjectType of SUBJECT_TYPES) addSorted(coverage, "subjects", subjectType);
  coverage.sampleQueuedSources = (coverage.sampleQueuedSources || []).filter((row) => !OLD_QUEUED_URLS.includes(row.url));

  const row = coverage.byYear?.find((item) => Number(item.year) === YEAR);
  assert(row, "2025 rank-source coverage row is missing");
  assert(
    row.sources === 85 && row.parsedSources === 61 && row.queuedSources === 24 && row.parsedRecords === 26502,
    "Base 2025 rank-source coverage drifted",
  );
  row.sources += 1;
  row.parsedSources += 1;
  row.queuedSources -= 2;
  row.supersededSources = Number(row.supersededSources || 0) + 2;
  row.parsedRecords += ADDED_RANKS;
  addSorted(row, "parsedProvinces", PROVINCE);
  removeValue(row, "queuedProvinces", PROVINCE);
}

function scoreDerivedRankBoundary(note, count) {
  const existing = String(note.rankAlignmentBoundary || "").trim();
  const addition = `广东2025年${count}条普通类整数最低分记录按同年官方分数段表换算；本科/专科严格使用各自层次加分位次，本科线下模糊批次不自动套表。`;
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
    assert(shard.rankConversions.filter((row) => row.sourceId === SOURCE_ID).length === ADDED_RANKS, "Applied Guangdong rank rows drifted");
    assert(shard.records.filter((row) => row.rankSourceId === SOURCE_ID).length === LINKED_RECORDS, "Applied Guangdong admission links drifted");
    console.log(JSON.stringify({ status: "already-applied", modelVersion: NEXT_VERSION, rankConversionCount: manifest.rankConversionCount }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing to merge on unexpected core ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION && manifest.recordCount === RECORDS && manifest.rankConversionCount === BASE_RANKS, "Base manifest drifted");
  const layer = core.admissionScoreLayer;
  assert(layer.structuredRecords === RECORDS && layer.rankConversionRecords === BASE_RANKS, "Base core counts drifted");
  assert(!layer.sourceNotes.some((note) => note.id === SOURCE_ID), `${SOURCE_ID} already exists`);

  const item = manifest.shards[PROVINCE];
  assert(item, "Guangdong runtime shard is missing");
  const slug = path.basename(item.file, ".json");
  const shardFile = path.join(releaseDir, `${slug}.json.gz`);
  const shard = readGzipJson(shardFile);
  assert(shard.records.length === 18409 && shard.records.length === item.records, "Guangdong record count drifted");
  assert(shard.rankConversions.length === BASE_PROVINCE_RANKS && item.rankConversions === BASE_PROVINCE_RANKS, "Guangdong rank count drifted");
  assert(!shard.rankConversions.some((row) => row.year === YEAR), "Guangdong 2025 rank rows unexpectedly already exist");

  const rankIndex = new Map(payload.rankConversions.map((row) => [`${row.subjectType}|${row.rankUsage}|${row.score}`, row]));
  const linkedBySource = new Map();
  const linkedByType = new Map();
  const linkedByUsage = new Map();
  const linkedBySubject = new Map();
  let linkedRecords = 0;
  let officialLinked = 0;
  let thirdPartyLinked = 0;
  let schoolOfficialScopeLinked = 0;

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
    const rank = rankIndex.get(`${record.subjectType}|${usage}|${Number(record.minScore)}`);
    assert(rank, `No Guangdong ${usage} rank mapping for ${record.id} at ${record.minScore}`);
    const mapped = mapAdmissionRecord(record, rank, usage);
    linkedRecords += 1;
    linkedBySource.set(mapped.sourceId, Number(linkedBySource.get(mapped.sourceId) || 0) + 1);
    linkedByType.set(mapped.dataType, Number(linkedByType.get(mapped.dataType) || 0) + 1);
    linkedByUsage.set(usage, Number(linkedByUsage.get(usage) || 0) + 1);
    linkedBySubject.set(mapped.subjectType, Number(linkedBySubject.get(mapped.subjectType) || 0) + 1);
    if (String(record.sourceQuality || "").startsWith("official")) officialLinked += 1;
    else thirdPartyLinked += 1;
    if (record.formalScoreScope === "school-official-only") schoolOfficialScopeLinked += 1;
    return mapped;
  });
  assert(linkedRecords === LINKED_RECORDS, `Expected ${LINKED_RECORDS} linked records, got ${linkedRecords}`);
  assert(officialLinked === 562 && thirdPartyLinked === 691 && schoolOfficialScopeLinked === 562, "Linked provenance split drifted");
  assert(linkedBySource.size === LINKED_SOURCE_NOTES, `Expected ${LINKED_SOURCE_NOTES} linked source notes`);
  assert(linkedByUsage.get("undergraduate") === 1251 && linkedByUsage.get("vocational") === 2, "Linked rank-usage split drifted");
  assert(linkedBySubject.get("历史类") === 358 && linkedBySubject.get("物理类") === 895, "Linked subject split drifted");
  assert(
    linkedByType.get("institution-admission") === 126
      && linkedByType.get("major-admission") === 1114
      && linkedByType.get("major-group-admission") === 10
      && linkedByType.get("school-admission-summary") === 3,
    "Linked data-type split drifted",
  );

  shard.rankConversions = [...payload.rankConversions, ...shard.rankConversions];
  shard.rankConversions.sort((left, right) => (
    Number(right.year) - Number(left.year)
    || String(left.subjectType).localeCompare(String(right.subjectType), "zh-CN")
    || String(left.rankUsage || "").localeCompare(String(right.rankUsage || ""))
    || Number(right.score) - Number(left.score)
  ));
  shard.generatedAt = payload.generatedAt;
  assert(shard.rankConversions.length === NEXT_PROVINCE_RANKS, "Guangdong rank count drifted after merge");
  assert(shard.rankConversions.filter((row) => row.sourceId === SOURCE_ID).length === ADDED_RANKS, "New Guangdong rank rows drifted");
  const historyUg500 = rankIndex.get("历史类|undergraduate|500");
  const historyVoc500 = rankIndex.get("历史类|vocational|500");
  const physicsUg500 = rankIndex.get("物理类|undergraduate|500");
  const physicsVoc500 = rankIndex.get("物理类|vocational|500");
  assert(historyUg500?.rankEnd === 58353 && historyVoc500?.rankEnd === 58355, "History 500 dual-usage boundary drifted");
  assert(physicsUg500?.rankEnd === 165626 && physicsVoc500?.rankEnd === 165633, "Physics 500 dual-usage boundary drifted");

  const sourceNote = { ...payload.sourceNotes[0], file: args.importFile };
  const noteById = new Map(layer.sourceNotes.map((note) => [note.id, note]));
  for (const oldSourceId of OLD_QUEUED_SOURCE_IDS) {
    const note = noteById.get(oldSourceId);
    assert(note && Number(note.parsedRecords || 0) === 0, `Missing queued source ${oldSourceId}`);
    note.status = "superseded";
    note.supersededBy = SOURCE_ID;
    note.activeRuntimeRecords = 0;
    note.supersededAt = payload.generatedAt;
    note.replacementReason = "广东省教育考试院官方ZIP已取得，且与独立镜像逐字节一致；不再依赖图片队列抽取。";
  }
  const missingLinkedNotes = [...linkedBySource.keys()].filter((sourceId) => !noteById.has(sourceId));
  assert(missingLinkedNotes.length === 0, `Missing linked source notes: ${missingLinkedNotes.join(", ")}`);
  for (const [sourceId, count] of linkedBySource) {
    const note = noteById.get(sourceId);
    note.scoreDerivedRankRecords = Number(note.scoreDerivedRankRecords || 0) + count;
    note.guangdong2025ScoreDerivedRankRecords = count;
    note.guangdong2025RankUsage = "本科/专科层次加分分别匹配";
    note.guangdong2025RankPolicyBonusIncluded = true;
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
  layer.currentFinding = `${layer.currentFinding} 广东2025年1171个普通类分数档已从考试院官方PDF提取为2342条本科/专科双口径位次；官方ZIP与独立镜像逐字节一致。1253条广东普通类整数最低分记录获得省级位次，其中本科1251条、专科2条；54条特殊路径、94条批次或控制线边界不明记录和3条非整数综合计分继续隔离。`;
  layer.downgradeReason = `${String(layer.downgradeReason || "").replace(BASE_VERSION, NEXT_VERSION)} 广东补充边界：同一分数按本科层次加分和专科层次加分分别统计，禁止跨层次混用；本科记录仅在历史464分、物理436分及以上且批次明确时自动换算，艺术体育、特殊类型、非整数分、已有原生位次和模糊批次不套表。`;
  layer.sourceNotes.push(sourceNote);
  assert(layer.sourceNotes.length === 5135, `Expected 5135 source notes, got ${layer.sourceNotes.length}`);
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
    version: "v3.331",
    initialCore: "knowledge-core-lite.json.gz",
    fullEvidenceCore: "knowledge-core.json.gz",
  };
  item.rankConversions = shard.rankConversions.length;
  item.bytes = shardBytes.byteLength;
  item.sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = jsonBytes(manifest);

  const tempDir = path.join(releaseDir, `.v3331-${process.pid}`);
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
    dataset: "official-guangdong-rank-conversion-2025-v3331-runtime",
    generatedAt: payload.generatedAt,
    sourceId: SOURCE_ID,
    importFile: args.importFile,
    releaseDir: args.releaseDir,
    before: {
      modelVersion: BASE_VERSION,
      records: RECORDS,
      rankConversions: BASE_RANKS,
      provinceRankConversions: BASE_PROVINCE_RANKS,
      queuedRankSources: 2,
    },
    after: {
      modelVersion: NEXT_VERSION,
      records: RECORDS,
      rankConversions: NEXT_RANKS,
      rankConversionsAdded: ADDED_RANKS,
      provinceRankConversions: shard.rankConversions.length,
      linkedAdmissionRecords: linkedRecords,
      officialLinkedRecords: officialLinked,
      thirdPartyLinkedRecords: thirdPartyLinked,
      schoolOfficialScopeLinkedRecords: schoolOfficialScopeLinked,
      specialPathExcludedRecords: specialExcluded,
      ambiguousExcludedRecords: ambiguousExcluded,
      linkedSourceNotes: linkedBySource.size,
      linkedByUsage: Object.fromEntries([...linkedByUsage].sort()),
      linkedBySubject: Object.fromEntries([...linkedBySubject].sort()),
      linkedByType: Object.fromEntries([...linkedByType].sort()),
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
    rankConversionsAdded: ADDED_RANKS,
    linkedAdmissionRecords: linkedRecords,
    linkedByUsage: runtimeManifest.after.linkedByUsage,
    specialPathExcludedRecords: specialExcluded,
    ambiguousExcludedRecords: ambiguousExcluded,
    sourceNotes: layer.sourceNotes.length,
    shardSha256: runtimeManifest.after.shardSha256,
    coreSha256: runtimeManifest.after.coreSha256,
  }, null, 2));
}

main();
