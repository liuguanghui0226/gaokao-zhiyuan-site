#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const baseVersion = "local-deterministic-v3.343-multiyear-official-boundary-guard-868426records";
const nextVersion = "local-deterministic-v3.344-current-official-plan-corroboration-868426records";
const counts = { records: 868426, ranks: 133640, notes: 5136 };
const generatedAt = "2026-07-30T07:30:00+08:00";

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
  const evidenceFile = path.join(
    root,
    "data/admissions/evidence-v3344-admission-current-plan-corroboration-manifest.json",
  );
  const auditFile = path.join(
    root,
    "data/admissions/admission-current-plan-corroboration-v3344-runtime-manifest.json",
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
  assert(evidence.version === "v3.344", "Current-plan evidence version drifted");
  assert(evidence.policy.evidenceDirection === "positive-corroboration-only", "Plan evidence direction drifted");
  assert(evidence.policy.missingMatchMeaning === "unknown-not-discontinued", "Missing-plan policy drifted");
  assert(evidenceCounts.provinces === 31, "Plan evidence province count drifted");
  assert(evidenceCounts.ordinaryPlanRecords === 66735, "Ordinary plan count drifted");
  assert(evidenceCounts.eligibleRecentPlanRecords === 59052, "Recent plan count drifted");
  assert(evidenceCounts.currentYearPlanRecords === 28422, "Current plan count drifted");
  assert(evidenceCounts.matchedCandidateGroups === 1869, "Matched candidate count drifted");
  assert(evidenceCounts.currentYearMatchedCandidateGroups === 1640, "Current-year match count drifted");
  assert(evidenceCounts.nearYearMatchedCandidateGroups === 229, "Near-year match count drifted");
  assert(evidenceCounts.admissionMissingElectiveButPlanSupplies === 1489, "Elective enrichment count drifted");
  assert(evidenceCounts.provincesWithCurrentYearMatches === 21, "Current-year matched province count drifted");

  const admissionPolicy = core.modelPolicy?.admissionEvidencePolicy || {};
  assert(admissionPolicy.multiyearBoundaryGuard?.guardDirection === "downgrade-only", "v3.343 multi-year guard missing");
  assert(admissionPolicy.optionNameCanonicalization?.unicodeNormalization === "NFKC", "v3.342 name policy missing");
  const currentPlanCorroboration = {
    positiveEvidenceOnly: true,
    officialOrdinaryPlansOnly: true,
    currentYear: evidence.policy.currentYear,
    acceptedPlanYears: evidence.policy.planYearsAccepted,
    schoolAndMajorIdentityMustMatch: true,
    canonicalTypographyOnly: true,
    semanticMajorRenamesNeverMerged: true,
    canonicalBatchRouteMustMatch: true,
    subjectAndOptionalRouteMustBeCompatible: true,
    vacancyAndRestrictedPlansExcluded: true,
    missingMatchMeansUnknownNotDiscontinued: true,
    currentPlanElectiveConflictExcludesOption: true,
    priorYearPlanElectiveConflictDoesNotExclude: true,
    planPresenceNeverCreatesAdmissionProbability: true,
    planPresenceNeverRaisesAdmissionFitZone: true,
    maximumRankingEvidenceBonus: 8,
    ordinaryPlanRecords: evidenceCounts.ordinaryPlanRecords,
    eligibleRecentPlanRecords: evidenceCounts.eligibleRecentPlanRecords,
    currentYearPlanRecords: evidenceCounts.currentYearPlanRecords,
    matchedCandidateGroups: evidenceCounts.matchedCandidateGroups,
    currentYearMatchedCandidateGroups: evidenceCounts.currentYearMatchedCandidateGroups,
    nearYearMatchedCandidateGroups: evidenceCounts.nearYearMatchedCandidateGroups,
    matchedWithPlanCount: evidenceCounts.matchedWithPlanCount,
    matchedWithElectiveRequirement: evidenceCounts.matchedWithElectiveRequirement,
    admissionMissingElectiveButPlanSupplies: evidenceCounts.admissionMissingElectiveButPlanSupplies,
    oldPlanRecordsExcluded: evidenceCounts.oldPlanRecordsExcluded,
    provincesWithPlans: evidenceCounts.provincesWithPlans,
    provincesWithCurrentYearMatches: evidenceCounts.provincesWithCurrentYearMatches,
  };

  core.generatedAt = generatedAt;
  core.modelVersion = nextVersion;
  core.modelPolicy.version = nextVersion;
  core.modelPolicy.reliabilityDefinition = "全国通用录取分数据层优先；历史录取边界先按批次、专业组、校区、合作类型、选科、专业代码、考生类别和分数/位次口径隔离，并应用多年官方保守边界。只有2025-2026官方普通招生计划与省份、院校、专业、批次及科类严格匹配时，才显示计划在招佐证；未匹配到计划只表示本地证据待补，不判定停招。2026计划明确选科冲突时排除候选；计划存在不生成录取概率。";
  core.modelPolicy.formula = "有可核验结构化录取分时：录取可达性仍由最新边界与多年官方保守边界取较低结果；2026严格匹配官方计划只增加最多8分的证据排序权重，不改变录取可达性区间或概率。匹配要求省份、院校/专业代码或规范名称、批次路径、科类及可比招生路径一致；旧计划、征集、专项、提前、预科、定向和语义改名不用于当前在招佐证。";
  core.modelPolicy.admissionEvidencePolicy = {
    ...admissionPolicy,
    currentPlanCorroboration,
  };
  core.admissionScoreLayer.currentFinding = `${core.admissionScoreLayer.currentFinding} v3.344在${evidenceCounts.ordinaryPlanRecords}条普通计划中，仅采用${evidenceCounts.eligibleRecentPlanRecords}条2025-2026官方计划；严格确认${evidenceCounts.matchedCandidateGroups}个录取候选组，其中${evidenceCounts.currentYearMatchedCandidateGroups}组有2026计划在招证据。`;
  core.admissionScoreLayer.downgradeReason = `${String(core.admissionScoreLayer.downgradeReason || "").replaceAll(baseVersion, nextVersion)} 未匹配计划不等于停招；${evidenceCounts.oldPlanRecordsExcluded}条2022/2024旧计划、征集与限定路径不用于当前在招佐证。`;

  manifest.generatedAt = generatedAt;
  manifest.modelVersion = nextVersion;
  manifest.runtimeProfile = {
    ...(manifest.runtimeProfile || {}),
    version: "v3.344",
    initialCore: "knowledge-core-lite.json.gz",
    fullEvidenceCore: "knowledge-core.json.gz",
  };

  const coreRaw = jsonBytes(core);
  manifest.core.bytes = coreRaw.byteLength;
  manifest.core.sha256 = sha256(coreRaw);
  const manifestRaw = jsonBytes(manifest);
  const temporary = path.join(releaseDir, `.v3344-${process.pid}`);
  fs.mkdirSync(temporary, { recursive: true });
  const writes = [
    [path.join(temporary, "knowledge-core.json.gz"), gzipBytes(coreRaw), coreFile],
    [path.join(temporary, "manifest.json.gz"), gzipBytes(manifestRaw), manifestFile],
  ];
  for (const [tempFile, bytes] of writes) fs.writeFileSync(tempFile, bytes);
  for (const [tempFile, , targetFile] of writes) fs.renameSync(tempFile, targetFile);
  fs.rmdirSync(temporary);

  const audit = {
    dataset: "admission-current-plan-corroboration-v3344-runtime",
    generatedAt,
    before: { modelVersion: baseVersion, ...counts },
    after: {
      modelVersion: nextVersion,
      ...counts,
      currentPlanCorroboration,
      coreBytes: coreRaw.byteLength,
      coreSha256: sha256(coreRaw),
      manifestBytesBeforeLiteRebuild: manifestRaw.byteLength,
      manifestSha256BeforeLiteRebuild: sha256(manifestRaw),
    },
    boundary: "No admission, rank, plan, or source-note record changed. Exact recent official plan matches add visible positive evidence only. A missing match never means discontinued; only an exact 2026 plan with an explicit elective conflict can remove a historical candidate.",
  };
  writeJson(auditFile, audit);
  console.log(JSON.stringify({
    status: "ok",
    modelVersion: nextVersion,
    counts,
    currentPlanCorroboration,
  }, null, 2));
}

main();
