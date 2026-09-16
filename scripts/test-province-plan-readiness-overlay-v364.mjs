#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { buildProvincePlanReadinessV364 } from "./build-province-plan-readiness-v364.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const { audit, payload } = buildProvincePlanReadinessV364({ write: false, log: false });
const expectedCounts = {
  allPlanRecords: 83702,
  ordinaryPlanRecords: 71223,
  eligibleRecentPlanRecords: 63540,
  currentYearPlanRecords: 37287,
  exactRouteMatchedCandidateGroups: 3460,
  routeTransitionMatchedCandidateGroups: 621,
  matchedCandidateGroups: 4081,
  exactCurrentYearMatchedCandidateGroups: 3231,
  transitionCurrentYearMatchedCandidateGroups: 537,
  currentYearMatchedCandidateGroups: 3768,
  ambiguousPlanRequirementGroups: 14,
  provincesWithCurrentYearMatches: 31,
};

assert.equal(audit.version, "v3.364");
for (const [key, expected] of Object.entries(expectedCounts)) {
  assert.equal(audit.counts[key], expected, `${key} drifted`);
}
assert.deepEqual(audit.supplementOverlay.versions, ["v3.356", "v3.358", "v3.359", "v3.360", "v3.361", "v3.363"]);
assert.equal(audit.supplementOverlay.records, 11810);
assert.equal(audit.supplementOverlay.assignedProvinceRecords, 11808);
assert.equal(audit.supplementOverlay.unallocatedRecords, 2);
assert.equal(audit.supplementOverlay.specialPathRecords, 2943);
assert.equal(audit.supplementOverlay.duplicateIds, 0);
assert.equal(audit.provinceRows.length, 31);
assert.ok(audit.provinceRows.every((row) => row.currentYearMatchedCandidateGroups > 0));
assert.ok(!audit.provinceRows.some((row) => row.province === "不分省"));
assert.equal(
  audit.provinceRows.reduce((total, row) => total + row.currentYearMatchedCandidateGroups, 0),
  audit.counts.currentYearMatchedCandidateGroups,
);

assert.equal(payload.version, "v3.364");
assert.equal(payload.applicationPlanReadiness.currentPlanConfirmedGroups, 3768);
assert.equal(payload.applicationPlanReadiness.currentPlanPendingGroups, 385667);
assert.equal(payload.applicationPlanReadiness.currentPlanCoverageRate, 0.009676);
assert.equal(payload.applicationPlanReadiness.recentPlanMatchedGroups, 4081);
assert.equal(payload.applicationPlanReadiness.noRecentPlanMatchGroups, 385354);
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
