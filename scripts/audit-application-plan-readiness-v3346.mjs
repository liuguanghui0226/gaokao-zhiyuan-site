#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
if (root.startsWith("/Volumes/")) {
  throw new Error("Refusing external-volume audit execution.");
}

const sourceFile = path.join(
  root,
  "data/admissions/evidence-v3345-admission-plan-route-transition-manifest.json",
);
const outputFile = path.join(
  root,
  "data/admissions/evidence-v3346-application-plan-readiness-manifest.json",
);
const source = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
const sourceCounts = source.counts;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const candidateGroups = sourceCounts.candidateGroups;
const currentPlanConfirmedGroups = sourceCounts.currentYearMatchedCandidateGroups;
const nearYearOnlyGroups = sourceCounts.nearYearMatchedCandidateGroups;
const recentPlanMatchedGroups = sourceCounts.matchedCandidateGroups;
const currentPlanPendingGroups = candidateGroups - currentPlanConfirmedGroups;
const noRecentPlanMatchGroups = candidateGroups - recentPlanMatchedGroups;
const currentPlanCoverageRate = Number(
  (currentPlanConfirmedGroups / candidateGroups).toFixed(6),
);

assert(source.version === "v3.345", `Unexpected source audit ${source.version}`);
assert(candidateGroups === 389435, `Candidate groups drifted: ${candidateGroups}`);
assert(currentPlanConfirmedGroups === 2142, "Current-plan match count drifted");
assert(nearYearOnlyGroups === 313, "Near-year-only count drifted");
assert(recentPlanMatchedGroups === 2455, "Recent-plan match count drifted");
assert(currentPlanPendingGroups === 387293, "Current-plan pending count drifted");
assert(noRecentPlanMatchGroups === 386980, "No-recent-plan count drifted");
assert(currentPlanCoverageRate < 0.01, "Readiness gate no longer reflects sparse coverage");

const manifest = {
  version: "v3.346",
  generatedAt: "2026-07-30T10:45:00+08:00",
  audit: "application-plan-current-year-readiness",
  previousVersion: source.version,
  sourceAudit: path.relative(root, sourceFile),
  counts: {
    provinces: sourceCounts.provinces,
    candidateGroups,
    currentPlanConfirmedGroups,
    currentPlanPendingGroups,
    nearYearOnlyGroups,
    recentPlanMatchedGroups,
    noRecentPlanMatchGroups,
    exactCurrentPlanMatchedGroups: sourceCounts.exactCurrentYearMatchedCandidateGroups,
    transitionCurrentPlanMatchedGroups: sourceCounts.transitionCurrentYearMatchedCandidateGroups,
    currentPlanCoverageRate,
  },
  readinessStates: [
    {
      id: "current-plan-confirmed",
      label: "2026计划已佐证",
      formalListEligible: true,
      meaning: "Current official plan matched and no subject or elective conflict was found.",
    },
    {
      id: "current-plan-unmatched",
      label: "2026计划待核",
      formalListEligible: false,
      meaning: "No strict local 2026 plan match; unknown does not mean discontinued.",
    },
    {
      id: "near-year-only",
      label: "仅2025计划佐证",
      formalListEligible: false,
      meaning: "A 2025 plan match cannot prove 2026 recruitment.",
    },
    {
      id: "current-plan-needs-check",
      label: "2026选科待核",
      formalListEligible: false,
      meaning: "The current plan matched but elective or eligibility data cannot be confirmed.",
    },
    {
      id: "current-plan-conflict",
      label: "2026选科冲突待核",
      formalListEligible: false,
      meaning: "A batch-transition plan conflicts with the profile and remains review-only.",
    },
    {
      id: "current-plan-ambiguous",
      label: "2026计划多口径待核",
      formalListEligible: false,
      meaning: "Conflicting current plan requirements remain review-only.",
    },
    {
      id: "plan-only",
      label: "计划层候选",
      formalListEligible: false,
      meaning: "Plan evidence without a comparable admission boundary.",
    },
  ],
  policy: {
    listTitle: "院校专业候选清单",
    executableClaimRemoved: true,
    historicalFitTierKeptSeparateFromCurrentPlanReadiness: true,
    perOptionReadinessRequired: true,
    headerConfirmedCountRequired: true,
    missingCurrentPlanMeansUnknownNotDiscontinued: true,
    unresolvedCurrentPlanNeverPresentedAsFormalListEligible: true,
    currentPlanEvidenceNeverCreatesAdmissionProbability: true,
  },
  boundaries: [
    "Historical reach, steady, and priority tiers remain admission-boundary comparisons only.",
    "Every admission option displays an independent current-plan readiness state.",
    "Only a matched 2026 plan with no detected subject or elective conflict is marked corroborated.",
    "A missing or prior-year-only plan match never means that a major stopped recruiting.",
    "Plan-only, ambiguous, unresolved, and conflict states never claim formal-list eligibility.",
  ],
};

fs.writeFileSync(outputFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({
  outputFile: path.relative(root, outputFile),
  counts: manifest.counts,
  policy: manifest.policy,
}, null, 2));
