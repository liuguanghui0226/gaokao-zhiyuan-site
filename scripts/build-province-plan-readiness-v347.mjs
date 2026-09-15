#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const routeAuditFile = path.join(root, "data/admissions/evidence-v3345-admission-plan-route-transition-manifest.json");
const readinessFile = path.join(root, "data/admissions/evidence-v3346-application-plan-readiness-manifest.json");
const outputFile = path.join(root, "site/data/release-v3.275/province-plan-readiness.json.gz");

const routeAudit = JSON.parse(fs.readFileSync(routeAuditFile, "utf8"));
const readiness = JSON.parse(fs.readFileSync(readinessFile, "utf8"));
const current = readiness.counts || {};
const provinceRows = (routeAudit.provinceRows || []).map((row) => {
  const exactRouteMatchedCandidateGroups = Number(row.exactRouteMatchedCandidateGroups || 0);
  const routeTransitionMatchedCandidateGroups = Number(row.routeTransitionMatchedCandidateGroups || 0);
  const candidateGroups = Number(row.candidateGroups || 0);
  return {
    province: String(row.province || ""),
    candidateGroups,
    eligibleRecentPlans: Number(row.eligibleRecentPlans || 0),
    exactRouteMatchedCandidateGroups,
    routeTransitionMatchedCandidateGroups,
    recentPlanMatchedCandidateGroups: exactRouteMatchedCandidateGroups + routeTransitionMatchedCandidateGroups,
    currentYearTransitionMatchedCandidateGroups: Number(row.transitionCurrentYearMatchedCandidateGroups || 0),
    recentPlanCoverageRate: candidateGroups > 0
      ? (exactRouteMatchedCandidateGroups + routeTransitionMatchedCandidateGroups) / candidateGroups
      : 0,
  };
});

const payload = {
  version: "v3.347",
  generatedAt: readiness.generatedAt,
  sourceAudit: routeAuditFile.replace(`${root}/`, ""),
  sourceReadiness: readinessFile.replace(`${root}/`, ""),
  coverageScope: {
    recentPlanYears: routeAudit.policy?.planYearsAccepted || [2025, 2026],
    currentYear: Number(routeAudit.policy?.currentYear || 2026),
    perProvinceCurrentYearMetric: "transitionCurrentYearMatchedCandidateGroups",
    perProvinceCurrentYearMetricLabel: "2026衔接匹配",
    missingMatchMeaning: routeAudit.policy?.missingMatchMeaning || "unknown-not-discontinued",
  },
  applicationPlanReadiness: {
    currentYear: Number(current.currentYear || routeAudit.policy?.currentYear || 2026),
    candidateGroups: Number(current.candidateGroups || 0),
    currentPlanConfirmedGroups: Number(current.currentPlanConfirmedGroups || 0),
    currentPlanPendingGroups: Number(current.currentPlanPendingGroups || 0),
    currentPlanCoverageRate: Number(current.currentPlanCoverageRate || 0),
    noRecentPlanMatchGroups: Number(current.noRecentPlanMatchGroups || 0),
    provincesWithCurrentYearMatches: Number(routeAudit.counts?.provincesWithCurrentYearMatches || 0),
    provincesWithPlans: Number(routeAudit.counts?.provincesWithPlans || 0),
    unknownMeansNotDiscontinued: routeAudit.policy?.missingMatchMeaning === "unknown-not-discontinued",
  },
  provinceRows,
};

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
const json = `${JSON.stringify(payload, null, 2)}\n`;
fs.writeFileSync(outputFile, zlib.gzipSync(Buffer.from(json, "utf8"), { level: 9 }));
console.log(JSON.stringify({
  status: "ok",
  output: outputFile,
  version: payload.version,
  provinces: payload.provinceRows.length,
  bytes: fs.statSync(outputFile).size,
}, null, 2));
