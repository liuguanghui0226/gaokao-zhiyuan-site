#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const release = path.join(root, "site/data/release-v3.275");
const read = (name) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(release, name))));
const core = read("knowledge-core.json.gz");
const lite = read("knowledge-core-lite.json.gz");
const manifest = read("manifest.json.gz");
const shard = read("xizang.json.gz");
const audit = JSON.parse(fs.readFileSync(path.join(root, "data/admissions/xizang-rank-attestation-binding-v3336-runtime-manifest.json")));
const version = "local-deterministic-v3.346-current-plan-readiness-gate-868426records";

assert.equal(core.modelVersion, version);
assert.equal(lite.modelVersion, version);
assert.equal(manifest.modelVersion, version);
assert.equal(manifest.runtimeProfile.version, "v3.346");
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 133640);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5136);
assert.equal(shard.rankConversions.length, 0);
assert.equal(manifest.shards["西藏"].rankConversions, 0);

const fullNote = core.admissionScoreLayer.sourceNotes.find((item) => item.id === "official-xizang-control-lines-2025");
const liteNote = lite.admissionScoreLayer.sourceNotes.find((item) => item.id === "official-xizang-control-lines-2025");
for (const note of [fullNote, liteNote]) {
  assert.equal(note.publicRankConversionAvailable, false);
  assert.equal(note.manualRankSourceConfirmationRequired, true);
  assert.deepEqual(note.acceptedManualRankSources, ["official-personal-query"]);
  assert.equal(note.manualRankSourceLabel, "西藏官方个人查询");
  assert.deepEqual(note.manualRankAttestationBoundFields, [
    "score",
    "rank",
    "province",
    "subject",
    "candidateCategory",
    "rankUsage",
  ]);
  assert.equal(note.staleRecommendationInvalidationRequired, true);
  assert.equal(note.officialPublicDisclosureAudit.notices2025, 42);
  assert.equal(note.officialPublicDisclosureAudit.provinceWideFormalAdmissionTablesFound, 0);
  assert.equal(note.officialPublicDisclosureAudit.publicRankConversionTablesFound, 0);
}

const readiness = core.admissionScoreLayer.provinceReadiness.rows.find((item) => item.province === "西藏");
assert.equal(readiness.rankConversionRecords, 0);
assert.ok(readiness.missing.some((item) => /手填位次须确认来自考生本人官方查询/.test(item)));
assert.equal(audit.after.manualRankSourceConfirmationRequired, true);
assert.deepEqual(audit.after.acceptedManualRankSources, ["official-personal-query"]);
assert.equal(audit.after.staleRecommendationInvalidationRequired, true);
assert.equal(audit.after.officialPublicDisclosureAudit.reviewedListPages, 12);
assert.equal(audit.after.records, 868426);
assert.equal(audit.after.ranks, 133640);
assert.equal(audit.after.notes, 5136);

console.log(JSON.stringify({
  status: "ok",
  modelVersion: version,
  xizangRankConversions: shard.rankConversions.length,
  sourceConfirmationRequired: fullNote.manualRankSourceConfirmationRequired,
  attestationBoundFields: fullNote.manualRankAttestationBoundFields,
}, null, 2));
