#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.325-hainan-official-rank2025-policy-bonus-inclusive-published-floor-aligned-868426records";
const NEXT_VERSION = "local-deterministic-v3.326-xinjiang-rank2025-score-basis-conflict-blocked-868426records";
const SOURCE_ID = "sohu-xinjiang-rank-2025-cb85600e32";
const EVIDENCE_ID = "verified-xinjiang-rank-score-basis-2025-v3326";
const PROVINCE = "新疆";
const YEAR = 2025;
const RECORDS = 868426;
const RANKS = 128591;
const BLOCKED_RECORDS = 4234;
const OFFICIAL_FILING_RECORDS = 2302;
const SOURCE_NOTES = 5130;
const SUBJECTS = ["历史类", "物理类"];
const OFFICIAL_FILING_SOURCE_IDS = new Set([
  "official-xinjiang-undergraduate1-filing-2025-v3311",
  "official-xinjiang-undergraduate2-filing-2025-v3312",
  "official-xinjiang-undergraduate2-filing-2025",
]);
const DOWNGRADE_REASON = `当前数据层 ${NEXT_VERSION} 严格区分院校原生最低位次、同口径最低分换算位次和口径未闭合分数；海南2025表使用全体考生综合投档成绩，口径含照顾加分并公开至246分，800分及以上仅保留1-105名合并档。历史/物理类标签、艺术体育综合分、科类不明、非整数分、低于公开分数档和特殊路径不混入海南综合普通类自动推荐。新疆2025镜像表的政策加分口径未说明，且与官方含政策加分投档排序分出现9个0人分数冲突，4234条录取记录保持缺位次，不以覆盖率冒充准确率。`;

function parseArgs(argv) {
  const args = {
    audit: "data/admissions/xinjiang-rank-score-basis-audit-2025-v3326.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/xinjiang-rank-score-basis-safety-v3326-runtime-manifest.json",
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--audit") args.audit = argv[++index];
    else if (argv[index] === "--release-dir") args.releaseDir = argv[++index];
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

function sortedUnique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))]
    .sort((left, right) => String(left).localeCompare(String(right), "zh-CN"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isBlockedRecord(record) {
  return Number(record.year) === YEAR
    && SUBJECTS.includes(record.subjectType)
    && Number.isInteger(Number(record.minScore))
    && !Number(record.minRankEnd || record.minRank);
}

function refreshReadiness(container, shard) {
  const row = container?.rows?.find((item) => item.province === PROVINCE);
  if (!row) return;
  row.records = shard.records.length;
  row.rankConversionRecords = shard.rankConversions.length;
  row.blockedRankAlignmentRecords = shard.records.filter((record) => record.rankAlignmentStatus === "blocked-score-basis-unresolved").length;
  row.rankScoreBasisAuditEvidenceId = EVIDENCE_ID;
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const auditFile = path.resolve(PROJECT_ROOT, args.audit);
  const releaseDir = path.resolve(PROJECT_ROOT, args.releaseDir);
  const runtimeManifestFile = path.resolve(PROJECT_ROOT, args.runtimeManifest);
  const audit = JSON.parse(fs.readFileSync(auditFile, "utf8"));
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);

  assert(audit.dataset === "xinjiang-rank-score-basis-audit-2025-v3326", "Unexpected Xinjiang audit dataset");
  assert(audit.evidenceId === EVIDENCE_ID && audit.sourceId === SOURCE_ID, "Xinjiang audit IDs drifted");
  assert(audit.mirrorComparison?.exactPositiveMatches === 996 && audit.mirrorComparison?.valueDiffs === 0, "Mirror comparison is not closed");
  assert(audit.scoreBasisAudit?.officialZeroCandidateConflicts === 9, "Official score-basis conflict count drifted");
  assert(audit.scoreBasisAudit?.automaticAdmissionScoreAlignmentAllowed === false, "Unsafe alignment was not blocked");

  const item = manifest.shards[PROVINCE];
  assert(item, "Xinjiang runtime shard is missing");
  const slug = path.basename(item.file, ".json");
  const shardFile = path.join(releaseDir, `${slug}.json.gz`);
  const shard = readGzipJson(shardFile);

  if (core.modelVersion === NEXT_VERSION) {
    assert(shard.rankConversions.filter((row) => row.year === YEAR && row.sourceId === SOURCE_ID && row.automaticAdmissionScoreAlignmentAllowed === false).length === 996, "Already-applied Xinjiang rank safety rows drifted");
    assert(shard.records.filter((row) => row.rankAlignmentEvidenceId === EVIDENCE_ID).length === BLOCKED_RECORDS, "Already-applied Xinjiang blocked records drifted");
    core.admissionScoreLayer.downgradeReason = DOWNGRADE_REASON;
    const coreBytes = encodeJson(core);
    manifest.core.bytes = coreBytes.byteLength;
    manifest.core.sha256 = sha256(coreBytes);
    const manifestBytes = encodeJson(manifest);
    const tempDir = path.join(releaseDir, `.v3326-refresh-${process.pid}`);
    fs.mkdirSync(tempDir, { recursive: true });
    const coreTemp = path.join(tempDir, "knowledge-core.json.gz");
    const manifestTemp = path.join(tempDir, "manifest.json.gz");
    fs.writeFileSync(coreTemp, gzipBytes(coreBytes));
    fs.writeFileSync(manifestTemp, gzipBytes(manifestBytes));
    fs.renameSync(coreTemp, coreFile);
    fs.renameSync(manifestTemp, manifestFile);
    fs.rmdirSync(tempDir);
    console.log(JSON.stringify({ status: "already-applied-refreshed", modelVersion: NEXT_VERSION }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION && manifest.modelVersion === BASE_VERSION, `Refusing to merge on unexpected model ${core.modelVersion}`);
  assert(manifest.recordCount === RECORDS && manifest.rankConversionCount === RANKS, "Base runtime counts drifted");
  assert(core.admissionScoreLayer.structuredRecords === RECORDS && core.admissionScoreLayer.rankConversionRecords === RANKS, "Base core counts drifted");
  assert(shard.records.length === 11518 && shard.rankConversions.length === 2823, "Xinjiang shard counts drifted");
  assert(!core.admissionScoreLayer.sourceNotes.some((note) => note.id === EVIDENCE_ID), `${EVIDENCE_ID} already exists`);

  let rankRowsAudited = 0;
  shard.rankConversions = shard.rankConversions.map((row) => {
    if (Number(row.year) !== YEAR || row.sourceId !== SOURCE_ID) return row;
    rankRowsAudited += 1;
    return {
      ...row,
      sourceQuality: "third-party-xinjiang-rank-table-two-complete-mirrors-value-crosschecked-score-basis-unresolved",
      scoreBasis: "gaokao-cultural-total-policy-bonus-unspecified",
      rankPolicyBonusIncluded: null,
      automaticAdmissionScoreAlignmentAllowed: false,
      scoreBasisAuditEvidenceId: EVIDENCE_ID,
    };
  });
  assert(rankRowsAudited === 996, `Expected 996 audited rank rows, got ${rankRowsAudited}`);

  let blockedRecords = 0;
  let officialFilingRecords = 0;
  shard.records = shard.records.map((record) => {
    if (!isBlockedRecord(record)) return record;
    blockedRecords += 1;
    const officialFiling = OFFICIAL_FILING_SOURCE_IDS.has(record.sourceId);
    if (officialFiling) officialFilingRecords += 1;
    return {
      ...record,
      ...(officialFiling ? {
        admissionScoreBasis: "gaokao-filing-total-including-policy-bonus",
        admissionScorePolicyBonusIncluded: true,
      } : {}),
      rankAlignmentStatus: "blocked-score-basis-unresolved",
      rankAlignmentReasonCode: "xinjiang-2025-policy-bonus-scope-unresolved",
      rankAlignmentEvidenceId: EVIDENCE_ID,
    };
  });
  assert(blockedRecords === BLOCKED_RECORDS, `Expected ${BLOCKED_RECORDS} blocked rows, got ${blockedRecords}`);
  assert(officialFilingRecords === OFFICIAL_FILING_RECORDS, `Expected ${OFFICIAL_FILING_RECORDS} official filing rows, got ${officialFilingRecords}`);
  assert(shard.records.filter((record) => record.rankSourceId === SOURCE_ID).length === 0, "Unsafe Xinjiang score-derived ranks already exist");

  const layer = core.admissionScoreLayer;
  const rankSource = layer.sourceNotes.find((note) => note.id === SOURCE_ID);
  assert(rankSource, "Existing Xinjiang 2025 rank source note is missing");
  rankSource.quality = "third-party-xinjiang-rank-table-two-complete-mirrors-value-crosschecked-score-basis-unresolved";
  rankSource.usage = "新疆2025普通文科/理科996个正人数分数档在搜狐与高考100两份完整表间逐行零差异；可供考生按同口径分数查询位次。因镜像未说明政策加分口径，且官方含政策加分投档表存在9个0人分数冲突，不自动换算院校投档/录取最低位次。";
  rankSource.scoreBasis = "gaokao-cultural-total-policy-bonus-unspecified";
  rankSource.rankPolicyBonusIncluded = null;
  rankSource.automaticAdmissionScoreAlignmentAllowed = false;
  rankSource.alignmentBlockReason = "官方含政策加分投档排序分与镜像分段表存在9个0人分数冲突，政策加分口径未闭合。";
  rankSource.independentMirrorUrl = audit.evidence.independentGk100.url;
  rankSource.independentMirrorHtmlSha256 = audit.evidence.independentGk100.htmlSha256;
  rankSource.independentMirrorExactMatches = audit.mirrorComparison.exactPositiveMatches;
  rankSource.scoreBasisAuditEvidenceId = EVIDENCE_ID;
  rankSource.relatedUrls = sortedUnique([
    ...(rankSource.relatedUrls || []),
    audit.evidence.independentGk100.url,
    audit.evidence.officialPolicy.url,
    audit.evidence.officialControlLines.url,
  ]);

  const evidenceNote = {
    ...audit.sourceNotes[0],
    file: args.audit,
    evidence: audit.evidence,
    mirrorComparison: audit.mirrorComparison,
    scoreBasisAudit: audit.scoreBasisAudit,
  };
  layer.sourceNotes.push(evidenceNote);
  assert(layer.sourceNotes.length === SOURCE_NOTES, `Expected ${SOURCE_NOTES} source notes, got ${layer.sourceNotes.length}`);
  layer.availableEvidenceIds = sortedUnique([...(layer.availableEvidenceIds || []), EVIDENCE_ID]);
  layer.currentFinding = "海南2025年555条官方综合投档分位次已为4241条海南2025综合普通类整数最低分完成同口径换算。新疆2025普通文理996个正人数分数档又与第二份完整表逐行零差异，但官方含政策加分投档表有9条最低分落在镜像0人分数档；因此4234条无原生位次记录全部禁止自动套表，等待含政策加分口径的官方位次证据。";
  layer.downgradeReason = DOWNGRADE_REASON;

  core.generatedAt = audit.generatedAt;
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;
  refreshReadiness(layer.provinceReadiness, shard);
  refreshReadiness(layer.coverage?.provinceReadiness, shard);
  shard.generatedAt = audit.generatedAt;

  const shardBytes = encodeJson(shard);
  const coreBytes = encodeJson(core);
  manifest.generatedAt = audit.generatedAt;
  manifest.modelVersion = NEXT_VERSION;
  manifest.runtimeProfile = {
    ...(manifest.runtimeProfile || {}),
    version: "v3.326",
    initialCore: "knowledge-core-lite.json.gz",
    fullEvidenceCore: "knowledge-core.json.gz",
  };
  item.bytes = shardBytes.byteLength;
  item.sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);

  const tempDir = path.join(releaseDir, `.v3326-${process.pid}`);
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
    dataset: "xinjiang-rank-score-basis-safety-v3326-runtime",
    generatedAt: audit.generatedAt,
    evidenceId: EVIDENCE_ID,
    sourceId: SOURCE_ID,
    auditFile: args.audit,
    releaseDir: args.releaseDir,
    before: {
      modelVersion: BASE_VERSION,
      records: RECORDS,
      rankConversions: RANKS,
      provinceRecords: 11518,
      provinceRankConversions: 2823,
      sourceNotes: SOURCE_NOTES - 1,
    },
    after: {
      modelVersion: NEXT_VERSION,
      records: RECORDS,
      rankConversions: RANKS,
      rankRowsAudited,
      blockedAdmissionRecords: blockedRecords,
      officialFilingRecords,
      unsafeDerivedRanks: 0,
      sourceNotes: layer.sourceNotes.length,
      provinceRecords: shard.records.length,
      provinceRankConversions: shard.rankConversions.length,
      shardBytes: shardBytes.byteLength,
      shardSha256: sha256(shardBytes),
      coreBytes: coreBytes.byteLength,
      coreSha256: sha256(coreBytes),
      manifestBytesBeforeLiteRebuild: manifestBytes.byteLength,
      manifestSha256BeforeLiteRebuild: sha256(manifestBytes),
    },
  };
  writeJson(runtimeManifestFile, runtimeManifest);
  console.log(JSON.stringify({
    status: "applied",
    modelVersion: NEXT_VERSION,
    rankRowsAudited,
    blockedAdmissionRecords: blockedRecords,
    officialFilingRecords,
    sourceNotes: layer.sourceNotes.length,
  }, null, 2));
}

main();
