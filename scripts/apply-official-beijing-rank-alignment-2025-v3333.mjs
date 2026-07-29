#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.332-shaanxi-official-rank2025-dual-domain-lower-absent-bucket-guard-868426records";
const NEXT_VERSION = "local-deterministic-v3.333-beijing-official-undergraduate-rank2025-national-bonus-municipal-local-bonus-guard-868426records";
const RANK_SOURCE_ID = "official-beijing-rank-2025-v3271";
const FILING_SOURCE_ID = "official-beijing-undergraduate-filing-2025";
const VOCATIONAL_SOURCE_ID = "official-beijing-vocational-filing-2025";
const SCORE_BASIS = "gaokao-total-including-national-policy-bonus";
const PROVINCE = "北京";
const YEAR = 2025;
const RECORDS = 868426;
const RANKS = 133640;
const SOURCE_NOTES = 5136;
const PROVINCE_RECORDS = 6623;
const PROVINCE_RANKS = 688;
const RANK_SOURCE_ROWS = 347;
const FILING_RECORDS = 1397;
const LINKED_RECORDS = 1271;
const MUNICIPAL_GUARDED_RECORDS = 126;
const VOCATIONAL_GUARDED_RECORDS = 580;
const MUNICIPAL_REASON = "beijing-municipal-local-bonus-not-represented-in-national-bonus-rank-table";
const VOCATIONAL_REASON = "beijing-vocational-three-subject-total-incompatible-with-undergraduate-rank-table";

function parseArgs(argv) {
  const args = {
    releaseDir: "site/data/release-v3.275",
    evidenceManifest: "data/admissions/evidence-v3333-beijing-rank-alignment-2025-manifest.json",
    runtimeManifest: "data/admissions/official-beijing-rank-alignment-2025-v3333-runtime-manifest.json",
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--release") args.releaseDir = argv[++index];
    else if (argv[index] === "--evidence-manifest") args.evidenceManifest = argv[++index];
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
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

function addCaution(cautions, caution, obsoletePattern) {
  const retained = (cautions || []).filter((item) => !obsoletePattern.test(item));
  if (!retained.includes(caution)) retained.splice(Math.min(1, retained.length), 0, caution);
  return sortedUnique(retained);
}

function isMunicipalUniversity(schoolName, baseNames) {
  return baseNames.some((baseName) => (
    schoolName === baseName
    || schoolName.startsWith(`${baseName}(`)
    || schoolName.startsWith(`${baseName}（`)
  ));
}

function isFilingRecord(record) {
  return record.sourceId === FILING_SOURCE_ID
    && record.province === PROVINCE
    && Number(record.year) === YEAR
    && record.subjectType === "综合"
    && record.batch === "本科普通批"
    && record.dataType === "major-group-admission"
    && Number.isInteger(Number(record.minScore))
    && Number(record.minScore) >= 430
    && Number(record.minScore) <= 697;
}

function mapRank(record, rank) {
  const range = rank.rankStart === rank.rankEnd ? `${rank.rankEnd}` : `${rank.rankStart}-${rank.rankEnd}`;
  const caution = "该位次由北京2025官方含全国性照顾加分的一分一段表按本科普通批最低总分换算，非原投档表直接公布；北京市属高校因地方5分政策另行隔离。";
  return {
    ...record,
    scoreOnly: false,
    rankUnavailable: false,
    nativeAdmissionRankUnavailable: true,
    rankDerivedFromScore: true,
    rankEvidenceScope: "score-derived-provincial-segment",
    rankUsage: "undergraduate",
    rankUsageLabel: "本科六科750分总成绩分数段",
    rankScoreBasis: SCORE_BASIS,
    rankPolicyBonusIncluded: true,
    rankPolicyBonusStatus: "official-national-bonus-explicit",
    minRank: rank.rankEnd,
    minRankStart: rank.rankStart,
    minRankEnd: rank.rankEnd,
    rankRangeText: `${range}（最低分换算）`,
    rankSourceId: RANK_SOURCE_ID,
    cautions: addCaution(
      record.cautions,
      caution,
      /(原表不含最低位次|不生成假位次|未公开最低位次|缺最低位次)/,
    ),
  };
}

function guardMunicipalRecord(record) {
  const caution = "该院校属于北京市属高校，投档时可能使用仅限市属高校的地方5分照顾政策；官方一分一段只含全国性照顾加分，因此不自动换算位次。";
  return {
    ...record,
    scoreOnly: true,
    rankUnavailable: true,
    nativeAdmissionRankUnavailable: true,
    rankDerivedFromScore: false,
    rankAlignmentBlocked: true,
    rankAlignmentBlockReason: MUNICIPAL_REASON,
    rankEvidenceScope: "score-only-local-bonus-scope-mismatch",
    cautions: addCaution(
      record.cautions,
      caution,
      /(原表不含最低位次|不生成假位次|未公开最低位次|缺最低位次)/,
    ),
  };
}

function guardVocationalRecord(record) {
  const caution = "北京专科普通批使用语文、数学、外语三科总分，不能套用本科六科750分一分一段表；本记录保持无位次。";
  return {
    ...record,
    scoreOnly: true,
    rankUnavailable: true,
    nativeAdmissionRankUnavailable: true,
    rankDerivedFromScore: false,
    rankAlignmentBlocked: true,
    rankAlignmentBlockReason: VOCATIONAL_REASON,
    rankEvidenceScope: "score-only-three-subject-total",
    cautions: addCaution(
      record.cautions,
      caution,
      /(原表不含最低位次|不生成假位次|未公开最低位次|缺最低位次)/,
    ),
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
  row.majorGroupRecords = shard.records.filter((record) => record.dataType === "major-group-admission").length;
  row.majorGroupWithRank = shard.records.filter((record) => record.dataType === "major-group-admission" && Number(record.minRankEnd || record.minRank) > 0).length;
  row.majorGroupWithScoreDerivedRank = shard.records.filter((record) => record.dataType === "major-group-admission" && record.rankDerivedFromScore === true).length;
}

function verifyEvidence(evidence) {
  assert(evidence.dataset === "evidence-v3333-beijing-rank-alignment-2025", "Unexpected Beijing evidence manifest");
  assert(evidence.rankSourceId === RANK_SOURCE_ID && evidence.filingSourceId === FILING_SOURCE_ID, "Evidence source IDs drifted");
  assert(evidence.scoreBasis === SCORE_BASIS, "Evidence score basis drifted");
  assert(evidence.officialFacts?.rankDistributionIncludesNationalPolicyBonus === true, "National policy bonus evidence drifted");
  assert(evidence.officialFacts?.localMinorityBonusScope === "beijing-municipal-universities-only", "Municipal bonus scope drifted");
  assert(evidence.officialFacts?.vocationalSubjectCount === 3, "Vocational score-basis evidence drifted");
  assert(evidence.runtimeBoundary?.nationalBonusCompatibleRecords === LINKED_RECORDS, "Compatible record count drifted");
  assert(evidence.runtimeBoundary?.municipalLocalBonusGuardedRecords === MUNICIPAL_GUARDED_RECORDS, "Municipal guard count drifted");
  assert(evidence.runtimeBoundary?.vocationalThreeSubjectGuardedRecords === VOCATIONAL_GUARDED_RECORDS, "Vocational guard count drifted");
  assert(evidence.municipalUniversityBaseNames?.length === 20, "Municipal university list drifted");
  assert(evidence.files?.length === 7, "Evidence file inventory drifted");
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const releaseDir = path.resolve(PROJECT_ROOT, args.releaseDir);
  const evidenceFile = path.resolve(PROJECT_ROOT, args.evidenceManifest);
  const runtimeManifestFile = path.resolve(PROJECT_ROOT, args.runtimeManifest);
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const evidence = readJson(evidenceFile);
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  verifyEvidence(evidence);

  const item = manifest.shards[PROVINCE];
  assert(item, "Beijing runtime shard is missing");
  const slug = path.basename(item.file, ".json");
  const shardFile = path.join(releaseDir, `${slug}.json.gz`);
  const shard = readGzipJson(shardFile);

  if (core.modelVersion === NEXT_VERSION) {
    assert(shard.records.filter((row) => row.rankSourceId === RANK_SOURCE_ID && row.sourceId === FILING_SOURCE_ID).length === LINKED_RECORDS, "Applied Beijing links drifted");
    assert(shard.records.filter((row) => row.rankAlignmentBlockReason === MUNICIPAL_REASON).length === MUNICIPAL_GUARDED_RECORDS, "Applied municipal guards drifted");
    assert(shard.records.filter((row) => row.rankAlignmentBlockReason === VOCATIONAL_REASON).length === VOCATIONAL_GUARDED_RECORDS, "Applied vocational guards drifted");
    console.log(JSON.stringify({ status: "already-applied", modelVersion: NEXT_VERSION, linkedRecords: LINKED_RECORDS }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing to align on unexpected core ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION && manifest.recordCount === RECORDS && manifest.rankConversionCount === RANKS, "Base manifest drifted");
  const layer = core.admissionScoreLayer;
  assert(layer.structuredRecords === RECORDS && layer.rankConversionRecords === RANKS, "Base core counts drifted");
  assert(layer.sourceNotes.length === SOURCE_NOTES, "Base source-note count drifted");
  assert(shard.records.length === PROVINCE_RECORDS && item.records === PROVINCE_RECORDS, "Beijing record count drifted");
  assert(shard.rankConversions.length === PROVINCE_RANKS && item.rankConversions === PROVINCE_RANKS, "Beijing rank count drifted");

  const rankRows = shard.rankConversions.filter((row) => row.sourceId === RANK_SOURCE_ID);
  assert(rankRows.length === RANK_SOURCE_ROWS, "Beijing 2025 rank rows drifted");
  const exactRankIndex = new Map(
    rankRows
      .filter((row) => !row.scoreRange && Number(row.score) >= 380 && Number(row.score) <= 697)
      .map((row) => [Number(row.score), row]),
  );
  assert(exactRankIndex.size === 318, "Beijing exact rank index drifted");
  assert(exactRankIndex.get(600)?.rankStart === 11660 && exactRankIndex.get(600)?.rankEnd === 11883, "Beijing 600-point rank checkpoint drifted");
  assert(exactRankIndex.get(500)?.rankStart === 37269 && exactRankIndex.get(500)?.rankEnd === 37553, "Beijing 500-point rank checkpoint drifted");
  assert(exactRankIndex.get(430)?.rankStart === 53798 && exactRankIndex.get(430)?.rankEnd === 53994, "Beijing 430-point rank checkpoint drifted");

  const filingRows = shard.records.filter((record) => record.sourceId === FILING_SOURCE_ID);
  const vocationalRows = shard.records.filter((record) => record.sourceId === VOCATIONAL_SOURCE_ID);
  assert(filingRows.length === FILING_RECORDS && filingRows.every(isFilingRecord), "Official Beijing undergraduate filing scope drifted");
  assert(vocationalRows.length === VOCATIONAL_GUARDED_RECORDS, "Official Beijing vocational runtime scope drifted");
  assert(filingRows.every((record) => !Number(record.minRankEnd || record.minRank) && !record.rankSourceId), "Beijing filing rows already contain ranks");
  assert(vocationalRows.every((record) => !Number(record.minRankEnd || record.minRank) && !record.rankSourceId), "Beijing vocational rows unexpectedly contain ranks");

  let linkedRecords = 0;
  let municipalGuardedRecords = 0;
  let vocationalGuardedRecords = 0;
  const linkedByScore = new Map();
  shard.records = shard.records.map((record) => {
    if (isFilingRecord(record)) {
      if (isMunicipalUniversity(record.schoolName, evidence.municipalUniversityBaseNames)) {
        municipalGuardedRecords += 1;
        return guardMunicipalRecord(record);
      }
      const rank = exactRankIndex.get(Number(record.minScore));
      assert(rank, `No exact Beijing 2025 rank row for ${record.id} at ${record.minScore}`);
      linkedRecords += 1;
      linkedByScore.set(Number(record.minScore), Number(linkedByScore.get(Number(record.minScore)) || 0) + 1);
      return mapRank(record, rank);
    }
    if (record.sourceId === VOCATIONAL_SOURCE_ID) {
      vocationalGuardedRecords += 1;
      return guardVocationalRecord(record);
    }
    return record;
  });

  assert(linkedRecords === LINKED_RECORDS, `Expected ${LINKED_RECORDS} linked records, got ${linkedRecords}`);
  assert(municipalGuardedRecords === MUNICIPAL_GUARDED_RECORDS, `Expected ${MUNICIPAL_GUARDED_RECORDS} municipal guards, got ${municipalGuardedRecords}`);
  assert(vocationalGuardedRecords === VOCATIONAL_GUARDED_RECORDS, `Expected ${VOCATIONAL_GUARDED_RECORDS} vocational guards, got ${vocationalGuardedRecords}`);
  assert(linkedByScore.get(600) === 10 && linkedByScore.get(500) === 6 && linkedByScore.get(430) === 53, "Beijing score checkpoint link counts drifted");
  assert(shard.records.filter((row) => row.rankSourceId === RANK_SOURCE_ID && row.sourceId === FILING_SOURCE_ID).length === LINKED_RECORDS, "Beijing linked runtime rows drifted");
  assert(shard.records.filter((row) => row.sourceId === VOCATIONAL_SOURCE_ID && row.rankSourceId).length === 0, "Vocational rows must remain rankless");
  shard.generatedAt = evidence.generatedAt;

  const noteById = new Map(layer.sourceNotes.map((note) => [note.id, note]));
  const rankNote = noteById.get(RANK_SOURCE_ID);
  const filingNote = noteById.get(FILING_SOURCE_ID);
  const vocationalNote = noteById.get(VOCATIONAL_SOURCE_ID);
  assert(rankNote && filingNote && vocationalNote, "Beijing source notes are incomplete");

  rankNote.scoreBasis = SCORE_BASIS;
  rankNote.rankPolicyBonusIncluded = true;
  rankNote.policyBonusStatus = "official-national-bonus-explicit-local-bonus-municipal-only";
  rankNote.automaticAdmissionScoreAlignmentAllowed = true;
  rankNote.automaticAdmissionScoreAlignmentScope = "2025本科普通批非北京市属高校整数总分430-697";
  rankNote.alignmentBlockReason = "北京市属高校可能使用仅限市属高校的地方5分，专科使用语数外三科总分；两类均禁止套用本科全国性加分位次表。";
  rankNote.scoreDerivedAdmissionRecords = LINKED_RECORDS;
  rankNote.municipalLocalBonusGuardedRecords = MUNICIPAL_GUARDED_RECORDS;
  rankNote.vocationalThreeSubjectGuardedRecords = VOCATIONAL_GUARDED_RECORDS;
  rankNote.provenanceRevision = {
    directOfficialRedownloadStatus: "success",
    evidenceManifest: args.evidenceManifest,
    files: Object.fromEntries(evidence.files.map((file) => [file.name, {
      url: file.url,
      bytes: file.bytes,
      sha256: file.sha256,
      ...(file.pages ? { pages: file.pages } : {}),
    }])),
  };
  rankNote.cautions = sortedUnique([
    ...(rankNote.cautions || []),
    "仅为非北京市属高校的本科普通批官方投档最低总分自动换算位次；市属高校地方5分口径和专科三科总分均隔离。",
  ]);

  filingNote.usage = "北京考试院本科普通批院校专业组投档线1397条：1271条非市属高校记录按同年含全国性照顾加分的一分一段表换算位次；126条市属高校记录因地方5分口径保持无位次。";
  filingNote.nativeAdmissionRankUnavailableRecords = FILING_RECORDS;
  filingNote.scoreDerivedRankRecords = LINKED_RECORDS;
  filingNote.beijing2025ScoreDerivedRankRecords = LINKED_RECORDS;
  filingNote.recordsWithScoreDerivedRank = LINKED_RECORDS;
  filingNote.recordsWithAnyRank = LINKED_RECORDS;
  filingNote.rankUnavailableRecords = MUNICIPAL_GUARDED_RECORDS;
  filingNote.rankAlignmentBlockedRecords = MUNICIPAL_GUARDED_RECORDS;
  filingNote.rankSourceIds = sortedUnique([...(filingNote.rankSourceIds || []), RANK_SOURCE_ID]);
  filingNote.rankEvidenceScope = "score-derived-provincial-segment";
  filingNote.rankScoreBasis = SCORE_BASIS;
  filingNote.rankPolicyBonusIncluded = true;
  filingNote.rankAlignmentBoundary = "仅对2025本科普通批、非北京市属高校、430-697分整数总分记录换算；北京市属高校地方5分口径不在全国性加分一分一段内，126条保持无位次。";
  filingNote.cautions = sortedUnique([
    ...(filingNote.cautions || []),
    "换算位次不是投档表原生位次，不等同于组内具体专业录取最低位次或录取概率。",
    "北京市属高校可能使用仅限市属高校的地方5分，已从自动位次换算中排除。",
  ]);

  vocationalNote.activeRuntimeRecords = VOCATIONAL_GUARDED_RECORDS;
  vocationalNote.rankUnavailableRecords = VOCATIONAL_GUARDED_RECORDS;
  vocationalNote.rankAlignmentBlockedRecords = VOCATIONAL_GUARDED_RECORDS;
  vocationalNote.automaticAdmissionScoreAlignmentAllowed = false;
  vocationalNote.scoreBasis = "three-subject-unified-exam-total";
  vocationalNote.alignmentBlockReason = "北京专科普通批总分只含语文、数学、外语三科，不能套用本科六科750分一分一段表。";
  vocationalNote.cautions = sortedUnique([
    ...(vocationalNote.cautions || []),
    "专科三科总分与本科六科总分口径不同，580条运行时记录全部保持无位次。",
  ]);

  core.generatedAt = evidence.generatedAt;
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;
  layer.currentFinding = `${layer.currentFinding} 北京2025本科普通批官方投档表与含全国性照顾加分的一分一段表完成安全对齐：1271条非市属高校院校专业组最低总分获得省级位次区间；126条市属高校因地方5分政策与一分一段口径不一致保持无位次；580条专科三科总分记录继续隔离。`;
  layer.downgradeReason = `${String(layer.downgradeReason || "").replace(BASE_VERSION, NEXT_VERSION)} 北京补充边界：一分一段只含全国性照顾加分；仅限北京市属高校的地方5分可能改变市属高校投档排序，因此市属高校记录不自动套表；专科仅用语数外三科总分，也不套用本科六科位次表。`;
  assert(layer.rankConversionRecords === RANKS && layer.sourceNotes.length === SOURCE_NOTES, "Alignment must not change rank or source-note counts");
  refreshReadiness(layer.provinceReadiness, shard);
  refreshReadiness(layer.coverage.provinceReadiness, shard);

  const shardBytes = jsonBytes(shard);
  const coreBytes = jsonBytes(core);
  manifest.generatedAt = evidence.generatedAt;
  manifest.modelVersion = NEXT_VERSION;
  manifest.runtimeProfile = {
    ...(manifest.runtimeProfile || {}),
    version: "v3.333",
    initialCore: "knowledge-core-lite.json.gz",
    fullEvidenceCore: "knowledge-core.json.gz",
  };
  item.bytes = shardBytes.byteLength;
  item.sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = jsonBytes(manifest);

  const tempDir = path.join(releaseDir, `.v3333-${process.pid}`);
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
    dataset: "official-beijing-rank-alignment-2025-v3333-runtime",
    generatedAt: evidence.generatedAt,
    rankSourceId: RANK_SOURCE_ID,
    filingSourceId: FILING_SOURCE_ID,
    evidenceManifest: args.evidenceManifest,
    releaseDir: args.releaseDir,
    before: {
      modelVersion: BASE_VERSION,
      records: RECORDS,
      rankConversions: RANKS,
      sourceNotes: SOURCE_NOTES,
      provinceRecords: PROVINCE_RECORDS,
      provinceRankConversions: PROVINCE_RANKS,
      ranklessOfficialUndergraduateFilingRecords: FILING_RECORDS,
    },
    after: {
      modelVersion: NEXT_VERSION,
      records: RECORDS,
      rankConversions: RANKS,
      rankConversionsAdded: 0,
      sourceNotes: SOURCE_NOTES,
      provinceRecords: shard.records.length,
      provinceRankConversions: shard.rankConversions.length,
      linkedAdmissionRecords: linkedRecords,
      municipalLocalBonusGuardedRecords: municipalGuardedRecords,
      vocationalThreeSubjectGuardedRecords: vocationalGuardedRecords,
      linkedByScoreCheckpoints: Object.fromEntries([600, 500, 430].map((score) => [score, linkedByScore.get(score)])),
      shardBytes: shardBytes.byteLength,
      shardSha256: sha256(shardBytes),
      coreBytes: coreBytes.byteLength,
      coreSha256: sha256(coreBytes),
      manifestBytesBeforeLiteRebuild: manifestBytes.byteLength,
      manifestSha256BeforeLiteRebuild: sha256(manifestBytes),
    },
    boundary: evidence.boundary,
  };
  writeJson(runtimeManifestFile, runtimeManifest);
  console.log(JSON.stringify({
    status: "applied",
    modelVersion: NEXT_VERSION,
    linkedAdmissionRecords: linkedRecords,
    municipalLocalBonusGuardedRecords: municipalGuardedRecords,
    vocationalThreeSubjectGuardedRecords: vocationalGuardedRecords,
    rankConversions: RANKS,
    sourceNotes: SOURCE_NOTES,
    shardSha256: runtimeManifest.after.shardSha256,
    coreSha256: runtimeManifest.after.coreSha256,
  }, null, 2));
}

main();
