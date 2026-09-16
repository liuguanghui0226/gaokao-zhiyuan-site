#!/usr/bin/env node

import assert from "node:assert/strict";
import { buildProvincePlanReadinessV366 } from "./build-province-plan-readiness-v366.mjs";

const { audit, payload } = buildProvincePlanReadinessV366({ write: false, log: false });
assert.equal(payload.version, "v3.366");
assert.equal(payload.applicationPlanReadiness.candidateGroups, 389435);
assert.equal(payload.applicationPlanReadiness.currentPlanConfirmedGroups, 4223);
assert.equal(payload.applicationPlanReadiness.currentPlanPendingGroups, 385212);
assert.equal(payload.applicationPlanReadiness.currentPlanCoverageRate, 0.010844);
assert.equal(payload.applicationPlanReadiness.recentPlanMatchedGroups, 4536);
assert.equal(payload.supplementOverlay.records, 14337);
assert.equal(payload.supplementOverlay.ordinaryRecords, 10421);
assert.equal(payload.supplementOverlay.specialPathRecords, 3916);
assert.deepEqual(payload.supplementOverlay.versions, ["v3.356", "v3.358", "v3.359", "v3.360", "v3.361", "v3.363", "v3.365", "v3.366"]);
assert.equal(payload.provinceRows.length, 31);
assert.ok(payload.provinceRows.every((row) => row.currentYearMatchedCandidateGroups > 0));
assert.equal(audit.counts.exactCurrentYearMatchedCandidateGroups, 3686);
assert.equal(audit.counts.transitionCurrentYearMatchedCandidateGroups, 537);

console.log(JSON.stringify({ status: "ok", version: payload.version, currentPlanConfirmedGroups: payload.applicationPlanReadiness.currentPlanConfirmedGroups, currentPlanCoverageRate: payload.applicationPlanReadiness.currentPlanCoverageRate, provincesWithCurrentYearMatches: payload.applicationPlanReadiness.provincesWithCurrentYearMatches }, null, 2));
