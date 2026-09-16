#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { buildProvincePlanReadinessV366 } from "./build-province-plan-readiness-v366.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const { audit, payload } = buildProvincePlanReadinessV366({ write: false, log: false });
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
  ambiguousPlanRequirementGroups: 14,
  provincesWithCurrentYearMatches: 31,
};

assert.equal(audit.version, "v3.366");
for (const [key, expected] of Object.entries(expectedCounts)) {
  assert.equal(audit.counts[key], expected, `${key} drifted`);
}
assert.deepEqual(audit.supplementOverlay.versions, ["v3.356", "v3.358", "v3.359", "v3.360", "v3.361", "v3.363", "v3.365", "v3.366"]);
assert.equal(audit.supplementOverlay.records, 14337);
assert.equal(audit.supplementOverlay.assignedProvinceRecords, 14335);
assert.equal(audit.supplementOverlay.unallocatedRecords, 2);
assert.equal(audit.supplementOverlay.specialPathRecords, 3916);
assert.equal(audit.supplementOverlay.duplicateIds, 0);
assert.equal(audit.provinceRows.length, 31);
assert.ok(audit.provinceRows.every((row) => row.currentYearMatchedCandidateGroups > 0));
assert.ok(!audit.provinceRows.some((row) => row.province === "不分省"));
assert.equal(
  audit.provinceRows.reduce((total, row) => total + row.currentYearMatchedCandidateGroups, 0),
  audit.counts.currentYearMatchedCandidateGroups,
);

assert.equal(payload.version, "v3.366");
assert.equal(payload.applicationPlanReadiness.currentPlanConfirmedGroups, 4223);
assert.equal(payload.applicationPlanReadiness.currentPlanPendingGroups, 385212);
assert.equal(payload.applicationPlanReadiness.currentPlanCoverageRate, 0.010844);
assert.equal(payload.applicationPlanReadiness.recentPlanMatchedGroups, 4536);
assert.equal(payload.applicationPlanReadiness.noRecentPlanMatchGroups, 384899);
assert.equal(payload.applicationPlanReadiness.provincesWithCurrentYearMatches, 31);
assert.equal(payload.applicationPlanReadiness.ambiguousPlanRequirementGroups, 14);
assert.equal(payload.provinceRows.length, 31);
assert.ok(payload.provinceRows.every((row) => row.currentYearMatchedCandidateGroups > 0));
assert.equal(payload.coverageScope.perProvinceCurrentYearMetric, "currentYearMatchedCandidateGroups");

const assetFile = path.join(root, "site/data/release-v3.275/province-plan-readiness.json.gz");
assert.ok(fs.existsSync(assetFile), "province readiness runtime asset must exist");
const published = JSON.parse(zlib.gunzipSync(fs.readFileSync(assetFile), { to: "string" }));
assert.deepEqual(published, payload);

console.log(JSON.stringify({
  status: "ok",
  version: payload.version,
  currentPlanConfirmedGroups: payload.applicationPlanReadiness.currentPlanConfirmedGroups,
  currentPlanCoverageRate: payload.applicationPlanReadiness.currentPlanCoverageRate,
  provincesWithCurrentYearMatches: payload.applicationPlanReadiness.provincesWithCurrentYearMatches,
  overlayRecords: audit.supplementOverlay.records,
  unallocatedRecords: audit.supplementOverlay.unallocatedRecords,
}, null, 2));
