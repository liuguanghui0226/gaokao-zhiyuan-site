#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const baseVersion = "local-deterministic-v3.344-current-official-plan-corroboration-868426records";
const nextVersion = "local-deterministic-v3.345-plan-route-transition-safety-868426records";
const counts = { records: 868426, ranks: 133640, notes: 5136 };
const generatedAt = "2026-07-30T10:30:00+08:00";

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
    "data/admissions/evidence-v3345-admission-plan-route-transition-manifest.json",
  );
  const auditFile = path.join(
    root,
    "data/admissions/admission-plan-route-transition-v3345-runtime-manifest.json",
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
  assert(evidence.version === "v3.345", "Plan-route evidence version drifted");
  assert(evidence.policy.strictRoutePriority === true, "Strict route priority drifted");
  assert(
    evidence.policy.allowedFallback === "ordinary-undergraduate-batch-label-transition-only",
    "Plan route fallback drifted",
  );
  assert(evidenceCounts.provinces === 31, "Plan evidence province count drifted");
  assert(evidenceCounts.allPlanRecords === 71894, "All-plan count drifted");
  assert(evidenceCounts.ordinaryPlanRecords === 62358, "Ordinary plan count drifted");
  assert(evidenceCounts.eligibleRecentPlanRecords === 54675, "Recent plan count drifted");
  assert(evidenceCounts.currentYearPlanRecords === 28422, "Current plan count drifted");
  assert(evidenceCounts.exactRouteMatchedCandidateGroups === 1869, "Exact match count drifted");
  assert(evidenceCounts.routeTransitionMatchedCandidateGroups === 586, "Transition count drifted");
  assert(evidenceCounts.matchedCandidateGroups === 2455, "Combined match count drifted");
  assert(evidenceCounts.currentYearMatchedCandidateGroups === 2142, "Current-year match count drifted");
  assert(evidenceCounts.nearYearMatchedCandidateGroups === 313, "Near-year match count drifted");
  assert(evidenceCounts.supplementPlansExcluded === 1902, "Supplement isolation drifted");
  assert(evidenceCounts.plansExcludedAsVacancy === 6534, "Vacancy isolation drifted");
  assert(evidenceCounts.provincesWithRouteTransitions === 4, "Transition province count drifted");

  const admissionPolicy = core.modelPolicy?.admissionEvidencePolicy || {};
  assert(admissionPolicy.multiyearBoundaryGuard?.guardDirection === "downgrade-only", "v3.343 guard missing");
  assert(
    admissionPolicy.currentPlanCorroboration?.matchedCandidateGroups === 1869,
    "v3.344 current-plan policy missing",
  );
  const currentPlanCorroboration = {
    positiveEvidenceOnly: true,
    officialOrdinaryPlansOnly: true,
    currentYear: evidence.policy.currentYear,
    acceptedPlanYears: evidence.policy.planYearsAccepted,
    schoolAndMajorIdentityMustMatch: true,
    canonicalTypographyOnly: true,
    semanticMajorRenamesNeverMerged: true,
    strictBatchRouteMatchPreferred: true,
    canonicalBatchRouteMustMatchForExactEvidence: true,
    ordinaryUndergraduateRouteTransitionFallback: true,
    exactSchoolMajorIdentityRequiredForTransition: true,
    explicitBatchQualifierConflictRejected: true,
    transitionNeverCrossesEducationOrSpecialRoute: true,
    subjectAndOptionalRouteMustBeCompatible: true,
    vacancySupplementAndRestrictedPlansExcluded: true,
    missingMatchMeansUnknownNotDiscontinued: true,
    exactCurrentPlanElectiveConflictExcludesOption: true,
    transitionElectiveConflictReviewOnly: true,
    priorYearPlanElectiveConflictDoesNotExclude: true,
    ambiguousPlanRequirementsReviewOnly: true,
    missingOptionalPlanFieldIsNotAConflict: true,
    planPresenceNeverCreatesAdmissionProbability: true,
    planPresenceNeverRaisesAdmissionFitZone: true,
    maximumRankingEvidenceBonus: 8,
    transitionCurrentYearMaximumRankingBonus: evidence.policy.fallbackCurrentYearMaximumRankingBonus,
    allPlanRecords: evidenceCounts.allPlanRecords,
    ordinaryPlanRecords: evidenceCounts.ordinaryPlanRecords,
    eligibleRecentPlanRecords: evidenceCounts.eligibleRecentPlanRecords,
    currentYearPlanRecords: evidenceCounts.currentYearPlanRecords,
    exactRouteMatchedCandidateGroups: evidenceCounts.exactRouteMatchedCandidateGroups,
    routeTransitionMatchedCandidateGroups: evidenceCounts.routeTransitionMatchedCandidateGroups,
    matchedCandidateGroups: evidenceCounts.matchedCandidateGroups,
    exactCurrentYearMatchedCandidateGroups: evidenceCounts.exactCurrentYearMatchedCandidateGroups,
    transitionCurrentYearMatchedCandidateGroups: evidenceCounts.transitionCurrentYearMatchedCandidateGroups,
    currentYearMatchedCandidateGroups: evidenceCounts.currentYearMatchedCandidateGroups,
    nearYearMatchedCandidateGroups: evidenceCounts.nearYearMatchedCandidateGroups,
    matchedWithPlanCount: evidenceCounts.matchedWithPlanCount,
    matchedWithElectiveRequirement: evidenceCounts.matchedWithElectiveRequirement,
    admissionMissingElectiveButPlanSupplies: evidenceCounts.admissionMissingElectiveButPlanSupplies,
    plansExcludedAsVacancy: evidenceCounts.plansExcludedAsVacancy,
    supplementPlansExcluded: evidenceCounts.supplementPlansExcluded,
    oldPlanRecordsExcluded: evidenceCounts.oldPlanRecordsExcluded,
    provincesWithPlans: evidenceCounts.provincesWithPlans,
    provincesWithRouteTransitions: evidenceCounts.provincesWithRouteTransitions,
    provincesWithCurrentYearMatches: evidenceCounts.provincesWithCurrentYearMatches,
  };

  core.generatedAt = generatedAt;
  core.modelVersion = nextVersion;
  core.modelPolicy.version = nextVersion;
  core.modelPolicy.reliabilityDefinition = "全国通用录取分数据层优先；历史录取边界继续按专业、招生类型、校区、合作类型、选科和考生类别隔离。2025-2026官方普通计划严格批次路径匹配优先；只有院校、专业、科类及可比招生路径完全一致时，才允许普通本科旧批次名称与新普通本科批之间作降权佐证。征集、补录、剩余计划和限定路径全部隔离。批次衔接不改变录取边界，选科冲突只提示复核，不自动删除候选。";
  core.modelPolicy.formula = "录取可达性仍由最新历史边界与多年官方保守边界决定。严格2026计划最多增加8分证据排序权重；普通本科批次口径衔接最多增加5分且不改变录取区间。衔接必须同省、同院校、同专业、科类兼容且不得跨本科/专科/提前/专项/预科/征集路径；明确批次限定冲突时拒绝匹配。";
  core.modelPolicy.admissionEvidencePolicy = {
    ...admissionPolicy,
    currentPlanCorroboration,
  };
  core.admissionScoreLayer.currentFinding = `${core.admissionScoreLayer.currentFinding} v3.345将${evidenceCounts.plansExcludedAsVacancy}条征集、补录或剩余计划移出普通证据池；保留${evidenceCounts.exactRouteMatchedCandidateGroups}个严格匹配，并新增${evidenceCounts.routeTransitionMatchedCandidateGroups}个普通本科批次口径衔接佐证，总计${evidenceCounts.matchedCandidateGroups}组。`;
  core.admissionScoreLayer.downgradeReason = `${String(core.admissionScoreLayer.downgradeReason || "").replaceAll(baseVersion, nextVersion)} 普通本科批次衔接只作降权专业池佐证；衔接选科冲突不自动排除，计划多口径冲突降为人工核验。`;

  manifest.generatedAt = generatedAt;
  manifest.modelVersion = nextVersion;
  manifest.runtimeProfile = {
    ...(manifest.runtimeProfile || {}),
    version: "v3.345",
    initialCore: "knowledge-core-lite.json.gz",
    fullEvidenceCore: "knowledge-core.json.gz",
  };

  const coreRaw = jsonBytes(core);
  manifest.core.bytes = coreRaw.byteLength;
  manifest.core.sha256 = sha256(coreRaw);
  const manifestRaw = jsonBytes(manifest);
  const temporary = path.join(releaseDir, `.v3345-${process.pid}`);
  fs.mkdirSync(temporary, { recursive: true });
  const writes = [
    [path.join(temporary, "knowledge-core.json.gz"), gzipBytes(coreRaw), coreFile],
    [path.join(temporary, "manifest.json.gz"), gzipBytes(manifestRaw), manifestFile],
  ];
  for (const [tempFile, bytes] of writes) fs.writeFileSync(tempFile, bytes);
  for (const [tempFile, , targetFile] of writes) fs.renameSync(tempFile, targetFile);
  fs.rmdirSync(temporary);

  const audit = {
    dataset: "admission-plan-route-transition-v3345-runtime",
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
    boundary: "No admission, rank, plan, or source-note record changed. Strict plan matches remain preferred. Ordinary-undergraduate batch-label transitions add reduced positive evidence only; supplement and vacancy plans are excluded, and transition elective conflicts never auto-remove a candidate.",
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
