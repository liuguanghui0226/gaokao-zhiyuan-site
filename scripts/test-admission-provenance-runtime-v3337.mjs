#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const release = path.join(root, "site/data/release-v3.275");
const raw = (name) => zlib.gunzipSync(fs.readFileSync(path.join(release, name)));
const read = (name) => JSON.parse(raw(name).toString("utf8"));
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const version = "local-deterministic-v3.337-admission-provenance-relative-rank-dedup-868426records";
const core = read("knowledge-core.json.gz");
const lite = read("knowledge-core-lite.json.gz");
const manifest = read("manifest.json.gz");
const jiangxi = read("jiangxi.json.gz");
const audit = JSON.parse(fs.readFileSync(path.join(root, "data/admissions/admission-provenance-relative-rank-v3337-runtime-manifest.json")));
const evidence = JSON.parse(fs.readFileSync(path.join(root, "data/admissions/evidence-v3337-admission-provenance-and-rank-fit-manifest.json")));

assert.equal(core.modelVersion, version);
assert.equal(lite.modelVersion, version);
assert.equal(manifest.modelVersion, version);
assert.equal(manifest.runtimeProfile.version, "v3.337");
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 133640);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5136);
assert.deepEqual(core.modelPolicy.admissionEvidencePolicy, {
  thirdPartyMaximumConfidence: "B",
  thirdPartyExecutable: false,
  thirdPartyTier: "待复核数据候选",
  logicalDedupeFields: ["province", "subjectType", "school", "major", "majorGroup", "dataType"],
  relativeRankThresholds: { safe: 0.82, steady: 0.94, borderline: 1.03, reach: 1.18 },
});
assert.ok(core.modelPolicy.confidenceRules.some((rule) => rule.includes("第三方录取摘要最高为B")));

const falseElite = jiangxi.records.filter((record) => (
  record.schoolName === "南昌大学共青学院" &&
  (record.schoolTags || []).includes("民办/独立学院") &&
  (record.schoolTags || []).some((tag) => ["985", "211", "双一流", "C9"].includes(tag))
));
assert.equal(falseElite.length, 0);
assert.equal(
  jiangxi.records.filter((record) => record.schoolName === "南昌大学共青学院" && (record.schoolTags || []).includes("民办/独立学院")).length,
  22,
);
assert.equal(audit.before.falseEliteRecords, 22);
assert.equal(audit.after.correctedRecords, 22);
assert.equal(evidence.dataCorrection.records, 22);
assert.equal(sha256(raw("knowledge-core.json.gz")), manifest.core.sha256);
assert.equal(sha256(raw("knowledge-core-lite.json.gz")), manifest.coreLite.sha256);
assert.equal(sha256(raw("jiangxi.json.gz")), manifest.shards["江西"].sha256);

console.log(JSON.stringify({
  status: "ok",
  modelVersion: version,
  counts: { records: 868426, ranks: 133640, notes: 5136 },
  correctedFalseEliteRecords: audit.after.correctedRecords,
  thirdPartyMaximumConfidence: core.modelPolicy.admissionEvidencePolicy.thirdPartyMaximumConfidence,
}, null, 2));
