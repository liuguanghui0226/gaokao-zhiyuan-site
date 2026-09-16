#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { runAdmissionPlanRouteTransitionAudit } from "./audit-admission-plan-route-transition-v3345.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const generatedAt = "2026-09-16T23:50:00+08:00";
const auditOutputFile = path.join(root, "data/admissions/evidence-v3366-admission-plan-overlay-readiness-manifest.json");
const runtimeOutputFile = path.join(root, "site/data/release-v3.275/province-plan-readiness.json.gz");
const supplementFiles = [356, 358, 359, 360, 361, 363, 365, 366]
  .map((version) => `site/data/release-v3.275/admission-plan-supplement-v${version}.json.gz`);

const expectedCounts = {
  allPlanRecords: 86229,
  ordinaryPlanRecords: 72777,
  eligibleRecentPlanRecords: 65094,
  currentYearPlanRecords: 38841,
  exactRouteMatchedCandidateGroups: 3915,
  routeTransitionMatchedCandidateGroups: 621,
  matchedCandidateGroups: 4536,
  exactCurrentYearMatchedCandidateGroups: 3686,
  transitionCurrentYearMatchedCandidateGroups: 537,
  currentYearMatchedCandidateGroups: 4223,
  exactNearYearMatchedCandidateGroups: 229,
  transitionNearYearMatchedCandidateGroups: 84,
  nearYearMatchedCandidateGroups: 313,
  ambiguousPlanRequirementGroups: 14,
  plansExcludedAsSpecialPath: 4125,
  provincesWithPlans: 31,
  provincesWithMatches: 31,
  provincesWithCurrentYearMatches: 31,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeGzipJsonAtomic(file, value) {
  const bytes = zlib.gzipSync(Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"), { level: 9, mtime: 0 });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, file);
  return bytes.length;
}

export function buildProvincePlanReadinessV366({ write = true, log = true } = {}) {
  const audit = runAdmissionPlanRouteTransitionAudit({
    outputFile: auditOutputFile,
    version: "v3.366",
    audit: "admission-plan-overlay-readiness",
    previousVersion: "v3.364",
    generatedAt,
    supplementFiles,
    expectedCounts,
    includeCurrentYearProvinceMetrics: true,
    normalizeOrdinaryPlanRoutes: true,
    write,
    log: false,
  });
  for (const [key, value] of Object.entries(expectedCounts)) assert(audit.counts[key] === value, `${key} drifted: ${audit.counts[key]}`);
  assert(audit.supplementOverlay.records === 14337, "Overlay record total drifted");
  assert(audit.supplementOverlay.assignedProvinceRecords === 14335, "Assigned overlay total drifted");
  assert(audit.supplementOverlay.unallocatedRecords === 2, "Unallocated overlay total drifted");
  assert(audit.supplementOverlay.ordinaryRecords === 10421, "Ordinary overlay total drifted");
  assert(audit.supplementOverlay.specialPathRecords === 3916, "Special-path overlay total drifted");
  assert(audit.provinceRows.every((row) => row.currentYearMatchedCandidateGroups > 0), "Every province must have a current-year match");
  assert(!audit.provinceRows.some((row) => row.province === "不分省"), "Unallocated rows must not become a province");

  const counts = audit.counts;
  const currentPlanPendingGroups = counts.candidateGroups - counts.currentYearMatchedCandidateGroups;
  const noRecentPlanMatchGroups = counts.candidateGroups - counts.matchedCandidateGroups;
  const currentPlanCoverageRate = Number((counts.currentYearMatchedCandidateGroups / counts.candidateGroups).toFixed(6));
  const provinceRows = audit.provinceRows.map((row) => {
    const candidateGroups = Number(row.candidateGroups || 0);
    const exactRouteMatchedCandidateGroups = Number(row.exactRouteMatchedCandidateGroups || 0);
    const routeTransitionMatchedCandidateGroups = Number(row.routeTransitionMatchedCandidateGroups || 0);
    const exactCurrentYearMatchedCandidateGroups = Number(row.exactCurrentYearMatchedCandidateGroups || 0);
    const transitionCurrentYearMatchedCandidateGroups = Number(row.transitionCurrentYearMatchedCandidateGroups || 0);
    const recentPlanMatchedCandidateGroups = exactRouteMatchedCandidateGroups + routeTransitionMatchedCandidateGroups;
    const currentYearMatchedCandidateGroups = exactCurrentYearMatchedCandidateGroups + transitionCurrentYearMatchedCandidateGroups;
    return {
      province: String(row.province || ""),
      candidateGroups,
      eligibleRecentPlans: Number(row.eligibleRecentPlans || 0),
      exactRouteMatchedCandidateGroups,
      routeTransitionMatchedCandidateGroups,
      recentPlanMatchedCandidateGroups,
      exactCurrentYearMatchedCandidateGroups,
      transitionCurrentYearMatchedCandidateGroups,
      currentYearTransitionMatchedCandidateGroups: transitionCurrentYearMatchedCandidateGroups,
      currentYearMatchedCandidateGroups,
      recentPlanCoverageRate: candidateGroups > 0 ? recentPlanMatchedCandidateGroups / candidateGroups : 0,
      currentYearCoverageRate: candidateGroups > 0 ? currentYearMatchedCandidateGroups / candidateGroups : 0,
    };
  });
  assert(provinceRows.reduce((total, row) => total + row.currentYearMatchedCandidateGroups, 0) === counts.currentYearMatchedCandidateGroups, "Per-province current-year matches do not sum to national total");

  const payload = {
    version: "v3.366",
    generatedAt,
    sourceAudit: path.relative(root, auditOutputFile),
    coverageScope: {
      recentPlanYears: audit.policy.planYearsAccepted,
      currentYear: audit.policy.currentYear,
      planSupplementAssets: audit.supplementOverlay.files,
      perProvinceCurrentYearMetric: "currentYearMatchedCandidateGroups",
      perProvinceCurrentYearMetricLabel: "2026计划匹配",
      missingMatchMeaning: audit.policy.missingMatchMeaning,
    },
    applicationPlanReadiness: {
      currentYear: audit.policy.currentYear,
      candidateGroups: counts.candidateGroups,
      currentPlanConfirmedGroups: counts.currentYearMatchedCandidateGroups,
      currentPlanPendingGroups,
      currentPlanCoverageRate,
      recentPlanMatchedGroups: counts.matchedCandidateGroups,
      noRecentPlanMatchGroups,
      exactCurrentPlanMatchedGroups: counts.exactCurrentYearMatchedCandidateGroups,
      transitionCurrentPlanMatchedGroups: counts.transitionCurrentYearMatchedCandidateGroups,
      ambiguousPlanRequirementGroups: counts.ambiguousPlanRequirementGroups,
      provincesWithCurrentYearMatches: counts.provincesWithCurrentYearMatches,
      provincesWithPlans: counts.provincesWithPlans,
      unknownMeansNotDiscontinued: audit.policy.missingMatchMeaning === "unknown-not-discontinued",
    },
    supplementOverlay: audit.supplementOverlay,
    provinceRows,
  };
  const compressedBytes = write ? writeGzipJsonAtomic(runtimeOutputFile, payload) : null;
  if (log) console.log(JSON.stringify({ status: "ok", version: payload.version, compressedBytes, currentPlanConfirmedGroups: payload.applicationPlanReadiness.currentPlanConfirmedGroups, currentPlanCoverageRate, provincesWithCurrentYearMatches: payload.applicationPlanReadiness.provincesWithCurrentYearMatches }, null, 2));
  return { audit, payload, compressedBytes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildProvincePlanReadinessV366();
