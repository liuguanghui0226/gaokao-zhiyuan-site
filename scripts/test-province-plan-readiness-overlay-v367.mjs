#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { buildProvincePlanReadinessV367 } from "./build-province-plan-readiness-v367.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const { audit, payload } = buildProvincePlanReadinessV367({ write: false, log: false });
const expectedCounts = {
  allPlanRecords: 87321,
  ordinaryPlanRecords: 73690,
  eligibleRecentPlanRecords: 66007,
  currentYearPlanRecords: 39754,
  exactRouteMatchedCandidateGroups: 4215,
  routeTransitionMatchedCandidateGroups: 621,
  matchedCandidateGroups: 4836,
  exactCurrentYearMatchedCandidateGroups: 3986,
  transitionCurrentYearMatchedCandidateGroups: 537,
  currentYearMatchedCandidateGroups: 4523,
  ambiguousPlanRequirementGroups: 14,
  provincesWithCurrentYearMatches: 31,
};

assert.equal(audit.version, "v3.367");
for (const [key, expected] of Object.entries(expectedCounts)) assert.equal(audit.counts[key], expected, `${key} drifted`);
assert.deepEqual(audit.supplementOverlay.versions, ["v3.356", "v3.358", "v3.359", "v3.360", "v3.361", "v3.363", "v3.365", "v3.366", "v3.367"]);
assert.equal(audit.supplementOverlay.records, 15429);
assert.equal(audit.supplementOverlay.assignedProvinceRecords, 15427);
assert.equal(audit.supplementOverlay.unallocatedRecords, 2);
assert.equal(audit.supplementOverlay.ordinaryRecords, 11334);
assert.equal(audit.supplementOverlay.specialPathRecords, 4095);
assert.equal(audit.supplementOverlay.duplicateIds, 0);
assert.equal(audit.provinceRows.length, 31);
assert.ok(audit.provinceRows.every((row) => row.currentYearMatchedCandidateGroups > 0));
assert.equal(payload.version, "v3.367");
assert.equal(payload.applicationPlanReadiness.currentPlanConfirmedGroups, 4523);
assert.equal(payload.applicationPlanReadiness.currentPlanPendingGroups, 384912);
assert.equal(payload.applicationPlanReadiness.currentPlanCoverageRate, 0.011614);
assert.equal(payload.applicationPlanReadiness.recentPlanMatchedGroups, 4836);
assert.equal(payload.applicationPlanReadiness.noRecentPlanMatchGroups, 384599);
assert.equal(payload.applicationPlanReadiness.exactCurrentPlanMatchedGroups, 3986);
assert.equal(payload.applicationPlanReadiness.transitionCurrentPlanMatchedGroups, 537);
assert.equal(payload.applicationPlanReadiness.provincesWithCurrentYearMatches, 31);
assert.equal(payload.provinceRows.length, 31);
assert.ok(payload.provinceRows.every((row) => row.currentYearMatchedCandidateGroups > 0));

const assetFile = path.join(root, "site/data/release-v3.275/province-plan-readiness.json.gz");
assert.ok(fs.existsSync(assetFile), "province readiness runtime asset must exist");
const published = JSON.parse(zlib.gunzipSync(fs.readFileSync(assetFile), { to: "string" }));
assert.deepEqual(published, payload);

console.log(JSON.stringify({
  status: "ok",
  version: payload.version,
  currentPlanConfirmedGroups: payload.applicationPlanReadiness.currentPlanConfirmedGroups,
  currentPlanCoverageRate: payload.applicationPlanReadiness.currentPlanCoverageRate,
  overlayRecords: audit.supplementOverlay.records,
}, null, 2));
