#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const baseVersion = "local-deterministic-v3.345-plan-route-transition-safety-868426records";
const nextVersion = "local-deterministic-v3.346-current-plan-readiness-gate-868426records";
const counts = { records: 868426, ranks: 133640, notes: 5136 };
const generatedAt = "2026-07-30T10:45:00+08:00";

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
  if (root.startsWith("/Volumes/")) {
    throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  }
  const releaseDir = path.join(root, "site/data/release-v3.275");
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const evidenceFile = path.join(
    root,
    "data/admissions/evidence-v3346-application-plan-readiness-manifest.json",
  );
  const auditFile = path.join(
    root,
    "data/admissions/application-plan-readiness-v3346-runtime-manifest.json",
  );
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  const evidence = JSON.parse(fs.readFileSync(evidenceFile, "utf8"));
  const evidenceCounts = evidence.counts;

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
  assert(evidence.version === "v3.346", "Application-plan readiness evidence drifted");
  assert(evidence.policy.executableClaimRemoved === true, "Executable-claim removal drifted");
  assert(evidence.policy.perOptionReadinessRequired === true, "Per-option readiness drifted");
  assert(evidenceCounts.provinces === 31, "Province count drifted");
  assert(evidenceCounts.candidateGroups === 389435, "Candidate group count drifted");
  assert(evidenceCounts.currentPlanConfirmedGroups === 2142, "Current-plan confirmation count drifted");
  assert(evidenceCounts.currentPlanPendingGroups === 387293, "Current-plan pending count drifted");
  assert(evidenceCounts.nearYearOnlyGroups === 313, "Near-year-only count drifted");
  assert(evidenceCounts.noRecentPlanMatchGroups === 386980, "No-recent-plan count drifted");
  assert(evidenceCounts.currentPlanCoverageRate === 0.0055, "Current-plan coverage rate drifted");

  const admissionPolicy = core.modelPolicy?.admissionEvidencePolicy || {};
  assert(
    admissionPolicy.currentPlanCorroboration?.matchedCandidateGroups === 2455,
    "v3.345 current-plan policy missing",
  );
  const applicationPlanReadiness = {
    currentYear: 2026,
    listTitle: evidence.policy.listTitle,
    executableClaimRemoved: evidence.policy.executableClaimRemoved,
    historicalFitTierKeptSeparateFromCurrentPlanReadiness:
      evidence.policy.historicalFitTierKeptSeparateFromCurrentPlanReadiness,
    perOptionReadinessRequired: evidence.policy.perOptionReadinessRequired,
    headerConfirmedCountRequired: evidence.policy.headerConfirmedCountRequired,
    missingCurrentPlanMeansUnknownNotDiscontinued:
      evidence.policy.missingCurrentPlanMeansUnknownNotDiscontinued,
    unresolvedCurrentPlanNeverPresentedAsFormalListEligible:
      evidence.policy.unresolvedCurrentPlanNeverPresentedAsFormalListEligible,
    currentPlanEvidenceNeverCreatesAdmissionProbability:
      evidence.policy.currentPlanEvidenceNeverCreatesAdmissionProbability,
    readinessStateIds: evidence.readinessStates.map((item) => item.id),
    candidateGroups: evidenceCounts.candidateGroups,
    currentPlanConfirmedGroups: evidenceCounts.currentPlanConfirmedGroups,
    currentPlanPendingGroups: evidenceCounts.currentPlanPendingGroups,
    nearYearOnlyGroups: evidenceCounts.nearYearOnlyGroups,
    recentPlanMatchedGroups: evidenceCounts.recentPlanMatchedGroups,
    noRecentPlanMatchGroups: evidenceCounts.noRecentPlanMatchGroups,
    exactCurrentPlanMatchedGroups: evidenceCounts.exactCurrentPlanMatchedGroups,
    transitionCurrentPlanMatchedGroups: evidenceCounts.transitionCurrentPlanMatchedGroups,
    currentPlanCoverageRate: evidenceCounts.currentPlanCoverageRate,
  };

  core.generatedAt = generatedAt;
  core.modelVersion = nextVersion;
  core.modelPolicy.version = nextVersion;
  core.modelPolicy.reliabilityDefinition =
    "全国通用录取分数据层优先；历史录取边界继续按专业、招生类型、校区、合作类型、选科和考生类别隔离。冲稳分层只描述历史边界，不等于2026年可报。每个院校专业独立显示当前计划状态；只有命中2026官方计划且科类、选科未发现冲突时标记为计划已佐证，未匹配、仅2025、冲突或多口径状态均不得直接进入正式志愿单。";
  core.modelPolicy.formula =
    "录取可达性仍由最新历史边界与多年官方保守边界决定；当前计划只提供独立佐证。列表同时计算已展示录取候选数与2026计划已佐证数，不把未闭合计划的历史候选称为可执行清单，不用计划证据生成录取概率。";
  core.modelPolicy.admissionEvidencePolicy = {
    ...admissionPolicy,
    applicationPlanReadiness,
  };
  core.admissionScoreLayer.currentFinding =
    `${core.admissionScoreLayer.currentFinding} v3.346确认${evidenceCounts.candidateGroups}个历史候选组中仅${evidenceCounts.currentPlanConfirmedGroups}组命中2026计划，覆盖率${(evidenceCounts.currentPlanCoverageRate * 100).toFixed(2)}%；院校专业总表改为候选清单并逐项显示计划闭合状态。`;
  core.admissionScoreLayer.downgradeReason =
    `${String(core.admissionScoreLayer.downgradeReason || "").replaceAll(baseVersion, nextVersion)} 冲稳层与当前计划闭合状态分开展示；未命中2026计划、仅近年计划、选科待核或多口径状态都不能被表述为正式可报结论。`;

  manifest.generatedAt = generatedAt;
  manifest.modelVersion = nextVersion;
  manifest.runtimeProfile = {
    ...(manifest.runtimeProfile || {}),
    version: "v3.346",
    initialCore: "knowledge-core-lite.json.gz",
    fullEvidenceCore: "knowledge-core.json.gz",
  };

  const coreRaw = jsonBytes(core);
  manifest.core.bytes = coreRaw.byteLength;
  manifest.core.sha256 = sha256(coreRaw);
  const manifestRaw = jsonBytes(manifest);
  const temporary = path.join(releaseDir, `.v3346-${process.pid}`);
  fs.mkdirSync(temporary, { recursive: true });
  const writes = [
    [path.join(temporary, "knowledge-core.json.gz"), gzipBytes(coreRaw), coreFile],
    [path.join(temporary, "manifest.json.gz"), gzipBytes(manifestRaw), manifestFile],
  ];
  for (const [tempFile, bytes] of writes) fs.writeFileSync(tempFile, bytes);
  for (const [tempFile, , targetFile] of writes) fs.renameSync(tempFile, targetFile);
  fs.rmdirSync(temporary);

  const audit = {
    dataset: "application-plan-readiness-v3346-runtime",
    generatedAt,
    before: { modelVersion: baseVersion, ...counts },
    after: {
      modelVersion: nextVersion,
      ...counts,
      applicationPlanReadiness,
      coreBytes: coreRaw.byteLength,
      coreSha256: sha256(coreRaw),
      manifestBytesBeforeLiteRebuild: manifestRaw.byteLength,
      manifestSha256BeforeLiteRebuild: sha256(manifestRaw),
    },
    boundary:
      "No admission, rank, plan, or source-note record changed. Historical fit tiers remain visible, but every admission option now carries a separate current-plan readiness state and unresolved states never claim formal-list eligibility.",
  };
  writeJson(auditFile, audit);
  console.log(JSON.stringify({
    status: "ok",
    modelVersion: nextVersion,
    counts,
    applicationPlanReadiness,
  }, null, 2));
}

main();
