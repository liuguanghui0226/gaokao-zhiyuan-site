#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
if (root.startsWith("/Volumes/")) throw new Error("Refusing external-volume test execution.");
const releaseDir = path.join(root, "site/data/release-v3.275");
const readGzip = (name) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, name))).toString("utf8"));
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(root, "data/admissions", name), "utf8"));
const expectedVersion = "local-deterministic-v3.340-typography-safe-trends-868426records";
const historicalVersion = "local-deterministic-v3.338-route-safe-dedup-official-preference-868426records";

const core = readGzip("knowledge-core.json.gz");
const lite = readGzip("knowledge-core-lite.json.gz");
const manifest = readGzip("manifest.json.gz");
const runtime = readJson("admission-route-safety-v3338-runtime-manifest.json");
const evidence = readJson("evidence-v3338-admission-route-collision-manifest.json");
const liteAudit = readJson("runtime-core-lite-v3338-manifest.json");
const policy = core.modelPolicy.admissionEvidencePolicy;

assert.equal(core.modelVersion, expectedVersion);
assert.equal(lite.modelVersion, expectedVersion);
assert.equal(manifest.modelVersion, expectedVersion);
assert.equal(runtime.after.modelVersion, historicalVersion);
assert.equal(manifest.runtimeProfile.version, "v3.340");
assert.equal(liteAudit.modelVersion, historicalVersion);
assert.equal(policy.routeSafeDedupe, true);
assert.equal(policy.candidateBestEvidenceDedupeBeforeScoring, true);
assert.deepEqual(policy.sameYearEvidencePreference, [
  "official-exam-authority",
  "school-official",
  "other",
  "third-party",
]);
assert.ok(policy.preservedRouteFields.includes("majorGroup"));
assert.ok(policy.preservedRouteFields.includes("campus"));
assert.ok(policy.preservedRouteFields.includes("tuition"));
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 133640);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5136);
assert.equal(evidence.provinces, 31);
assert.equal(evidence.admissionRecords, 794934);
assert.deepEqual(evidence.provenanceCounts, {
  "official-exam-authority": 528948,
  "school-official": 163808,
  "third-party": 102178,
});
assert.equal(evidence.examples.beijingSportUniversity.length, 8);
assert.equal(evidence.examples.centralAcademyOfFineArts.length, 4);
assert.equal(evidence.examples.shenyangAgriculturalUniversity.length, 2);
assert.ok(evidence.collisions.routeSafeDistinctGroups > 30000);
assert.ok(evidence.collisions.clearDuplicatesCollapsed > 13000);
assert.equal(runtime.after.records, 868426);
assert.equal(runtime.after.ranks, 133640);
assert.equal(runtime.after.notes, 5136);

console.log(JSON.stringify({
  status: "ok",
  modelVersion: expectedVersion,
  runtimeProfile: manifest.runtimeProfile.version,
  counts: {
    records: runtime.after.records,
    ranks: runtime.after.ranks,
    notes: runtime.after.notes,
    admissionRecordsAudited: evidence.admissionRecords,
  },
  collisionControls: {
    routeSafeDistinctGroups: evidence.collisions.routeSafeDistinctGroups,
    clearDuplicatesCollapsed: evidence.collisions.clearDuplicatesCollapsed,
    officialReplacementsSelected: evidence.collisions.officialReplacementsSelected,
  },
}, null, 2));
