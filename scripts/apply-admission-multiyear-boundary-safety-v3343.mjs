#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const baseVersion = "local-deterministic-v3.342-typography-safe-admission-options-868426records";
const nextVersion = "local-deterministic-v3.343-multiyear-official-boundary-guard-868426records";
const counts = { records: 868426, ranks: 133640, notes: 5136 };
const generatedAt = "2026-07-30T06:30:00+08:00";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function gzipBytes(value) {
  return zlib.gzipSync(value, { level: 9, mtime: 0 });
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  if (root.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const releaseDir = path.join(root, "site/data/release-v3.275");
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const evidenceFile = path.join(root, "data/admissions/evidence-v3343-admission-multiyear-boundary-volatility-manifest.json");
  const auditFile = path.join(root, "data/admissions/admission-multiyear-boundary-safety-v3343-runtime-manifest.json");
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  const evidence = JSON.parse(fs.readFileSync(evidenceFile, "utf8"));

  if (core.modelVersion === nextVersion) {
    assert(manifest.modelVersion === nextVersion, "Applied runtime manifest version drifted");
    console.log(JSON.stringify({ status: "already-applied", modelVersion: nextVersion }, null, 2));
    return;
  }

  assert(core.modelVersion === baseVersion, `Refusing unexpected core ${core.modelVersion}`);
  assert(manifest.modelVersion === baseVersion, "Base runtime manifest drifted");
  assert(core.admissionScoreLayer.structuredRecords === counts.records, "Record count drifted");
  assert(core.admissionScoreLayer.rankConversionRecords === counts.ranks, "Rank count drifted");
  assert(core.admissionScoreLayer.sourceNotes.length === counts.notes, "Source-note count drifted");
  assert(evidence.provinces === 31, "Multi-year evidence province count drifted");
  assert(evidence.admissionRecords === 794934, "Multi-year evidence record count drifted");
  assert(evidence.namedMajorRecords === 596431, "Named-major record count drifted");
  assert(evidence.canonicalTrendGroups === 460081, "Comparable route-group count drifted");
  assert(evidence.officialMultiyearGroups === 70735, "Official multi-year group count drifted");
  assert(evidence.officialRankMultiyearGroups === 41133, "Official rank group count drifted");
  assert(evidence.officialScoreMultiyearGroups === 29211, "Official score group count drifted");
  assert(evidence.guardedGroups === 36799, "Guarded group count drifted");
  assert(evidence.rankGuardedGroups === 25100, "Rank-guarded group count drifted");
  assert(evidence.scoreGuardedGroups === 11699, "Score-guarded group count drifted");
  assert(evidence.rankPotentialZoneShiftGroups === 18659, "Rank zone-shift count drifted");
  assert(evidence.rankSevereVolatilityGroups === 5309, "Severe rank-volatility count drifted");
  assert(evidence.scoreSevereVolatilityGroups === 6639, "Severe score-volatility count drifted");
  assert(evidence.discardedSingleOutlierGroups === 21630, "Outlier-discard count drifted");
  assert(evidence.mixedRankBasisGroups === 503, "Mixed rank-basis group count drifted");
  assert(evidence.mixedScoreBasisGroups === 394, "Mixed score-basis group count drifted");

  const admissionPolicy = core.modelPolicy?.admissionEvidencePolicy || {};
  assert(admissionPolicy.routeSafeDedupe === true, "v3.338 route-safe dedupe policy missing");
  assert(admissionPolicy.batchRoutePolicy?.semanticBatchRouteIsolation === true, "v3.341 batch policy missing");
  assert(
    admissionPolicy.trendEvidencePolicy?.typographyCanonicalization?.unicodeNormalization === "NFKC",
    "v3.340 trend typography policy missing",
  );
  assert(
    admissionPolicy.optionNameCanonicalization?.unicodeNormalization === "NFKC",
    "v3.342 option-name canonicalization policy missing",
  );
  const multiyearBoundaryGuard = {
    officialEvidenceOnly: evidence.policy.officialEvidenceOnly,
    maximumRecentYears: evidence.policy.maximumRecentYears,
    rankBasisMustMatchLatest: evidence.policy.rankBasisMustMatchLatest,
    scoreBasisMustMatchLatest: evidence.policy.scoreBasisMustMatchLatest,
    candidateCategoryAndRankUsageMustMatch: evidence.policy.candidateCategoryAndRankUsageMustMatch,
    majorCodeRouteMustMatch: evidence.policy.majorCodeRouteMustMatch,
    oneExtremeOutlierDiscardedWhenThreeOrMoreYears: evidence.policy.oneExtremeOutlierDiscardedWhenThreeOrMoreYears,
    guardDirection: evidence.policy.guardDirection,
    neverPromotesFromHistoricalBoundary: evidence.policy.neverPromotesFromHistoricalBoundary,
    officialMultiyearGroups: evidence.officialMultiyearGroups,
    officialRankMultiyearGroups: evidence.officialRankMultiyearGroups,
    officialScoreMultiyearGroups: evidence.officialScoreMultiyearGroups,
    guardedGroups: evidence.guardedGroups,
    rankGuardedGroups: evidence.rankGuardedGroups,
    scoreGuardedGroups: evidence.scoreGuardedGroups,
    rankPotentialZoneShiftGroups: evidence.rankPotentialZoneShiftGroups,
    rankSevereVolatilityGroups: evidence.rankSevereVolatilityGroups,
    scoreSevereVolatilityGroups: evidence.scoreSevereVolatilityGroups,
    discardedSingleOutlierGroups: evidence.discardedSingleOutlierGroups,
    mixedRankBasisGroupsIsolated: evidence.mixedRankBasisGroups,
    mixedScoreBasisGroupsIsolated: evidence.mixedScoreBasisGroups,
    latestYearRemainsVisible: true,
    safetyBoundaryVisibleInRecommendation: true,
  };

  core.generatedAt = generatedAt;
  core.modelVersion = nextVersion;
  core.modelPolicy.version = nextVersion;
  core.modelPolicy.reliabilityDefinition = "全国通用录取分数据层优先；候选先隔离批次、专业组、校区、合作类型、学费、选科、专业代码、考生类别、位次用途和分数/位次口径，再安全处理纯排版名称；最近一年官方边界若比近2至6年同路径保守边界更宽，只允许降低可达性，不允许用历史数据抬高候选；三年以上保留第二严格边界以排除一个极端值，不输出录取概率。";
  core.modelPolicy.formula = "有可核验结构化录取分时：总分 = 40%录取分/位次安全边界 + 20%硬匹配 + 15%专业适配 + 10%城市预算 + 10%证据充分度 + 5%风险控制；单年可达性与近2至6年同路径官方保守边界分别计算，取较低结果；两年取更严格边界，三年以上取第二严格边界；第三方、特殊路径、专业代码或资格/分数位次口径不同的记录不参与多年保护。";
  core.modelPolicy.admissionEvidencePolicy = {
    ...admissionPolicy,
    multiyearBoundaryGuard,
  };
  core.admissionScoreLayer.currentFinding = `${core.admissionScoreLayer.currentFinding} v3.343全国审计确认${evidence.officialMultiyearGroups}组同校同专业同路径多年官方边界可比，其中${evidence.guardedGroups}组最近一年更宽；位次保护${evidence.rankGuardedGroups}组、分数保护${evidence.scoreGuardedGroups}组。`;
  core.admissionScoreLayer.downgradeReason = `${String(core.admissionScoreLayer.downgradeReason || "").replaceAll(baseVersion, nextVersion)} 多年保护只使用考试院或学校官网近2至6年同路径记录；${evidence.mixedRankBasisGroups}组位次口径混合和${evidence.mixedScoreBasisGroups}组分数口径混合已隔离，保护只降不升。`;

  manifest.generatedAt = generatedAt;
  manifest.modelVersion = nextVersion;
  manifest.runtimeProfile = {
    ...(manifest.runtimeProfile || {}),
    version: "v3.343",
    initialCore: "knowledge-core-lite.json.gz",
    fullEvidenceCore: "knowledge-core.json.gz",
  };

  const coreRaw = jsonBytes(core);
  manifest.core.bytes = coreRaw.byteLength;
  manifest.core.sha256 = sha256(coreRaw);
  const manifestRaw = jsonBytes(manifest);
  const temporary = path.join(releaseDir, `.v3343-${process.pid}`);
  fs.mkdirSync(temporary, { recursive: true });
  const writes = [
    [path.join(temporary, "knowledge-core.json.gz"), gzipBytes(coreRaw), coreFile],
    [path.join(temporary, "manifest.json.gz"), gzipBytes(manifestRaw), manifestFile],
  ];
  for (const [tempFile, bytes] of writes) fs.writeFileSync(tempFile, bytes);
  for (const [tempFile, , targetFile] of writes) fs.renameSync(tempFile, targetFile);
  fs.rmdirSync(temporary);

  const audit = {
    dataset: "admission-multiyear-boundary-safety-v3343-runtime",
    generatedAt,
    before: { modelVersion: baseVersion, ...counts },
    after: {
      modelVersion: nextVersion,
      ...counts,
      provincesAudited: evidence.provinces,
      admissionRecordsAudited: evidence.admissionRecords,
      officialMultiyearGroups: evidence.officialMultiyearGroups,
      officialRankMultiyearGroups: evidence.officialRankMultiyearGroups,
      officialScoreMultiyearGroups: evidence.officialScoreMultiyearGroups,
      guardedGroups: evidence.guardedGroups,
      rankGuardedGroups: evidence.rankGuardedGroups,
      scoreGuardedGroups: evidence.scoreGuardedGroups,
      rankPotentialZoneShiftGroups: evidence.rankPotentialZoneShiftGroups,
      rankSevereVolatilityGroups: evidence.rankSevereVolatilityGroups,
      scoreSevereVolatilityGroups: evidence.scoreSevereVolatilityGroups,
      discardedSingleOutlierGroups: evidence.discardedSingleOutlierGroups,
      mixedRankBasisGroupsIsolated: evidence.mixedRankBasisGroups,
      mixedScoreBasisGroupsIsolated: evidence.mixedScoreBasisGroups,
      multiyearBoundaryGuard,
      coreBytes: coreRaw.byteLength,
      coreSha256: sha256(coreRaw),
      manifestBytesBeforeLiteRebuild: manifestRaw.byteLength,
      manifestSha256BeforeLiteRebuild: sha256(manifestRaw),
    },
    boundary: "No admission, rank, plan, or source-note record changed. This release adds a downgrade-only fit guard based on 2-6 years of comparable official records. Third-party, special-path, different major-code, candidate-category, score-basis, and rank-basis records cannot drive the guard; the latest published boundary remains visible.",
  };
  writeJson(auditFile, audit);
  console.log(JSON.stringify({
    status: "ok",
    modelVersion: nextVersion,
    counts,
    admissionRecordsAudited: evidence.admissionRecords,
    officialMultiyearGroups: evidence.officialMultiyearGroups,
    guardedGroups: evidence.guardedGroups,
    rankGuardedGroups: evidence.rankGuardedGroups,
    scoreGuardedGroups: evidence.scoreGuardedGroups,
    rankPotentialZoneShiftGroups: evidence.rankPotentialZoneShiftGroups,
    mixedRankBasisGroupsIsolated: evidence.mixedRankBasisGroups,
    mixedScoreBasisGroupsIsolated: evidence.mixedScoreBasisGroups,
  }, null, 2));
}

main();
