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
const shard = read("beijing.json.gz");
const runtimeAudit = JSON.parse(fs.readFileSync(path.join(root, "data/admissions/official-beijing-rank-alignment-2025-v3333-runtime-manifest.json")));
const evidence = JSON.parse(fs.readFileSync(path.join(root, "data/admissions/evidence-v3333-beijing-rank-alignment-2025-manifest.json")));
const version = "local-deterministic-v3.334-xizang-official-category-required-no-public-rank-guard-868426records";

assert.equal(core.modelVersion, version);
assert.equal(lite.modelVersion, version);
assert.equal(manifest.modelVersion, version);
assert.equal(manifest.runtimeProfile.version, "v3.334");
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 133640);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5136);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 133640);
assert.equal(manifest.shards["北京"].records, 6623);
assert.equal(manifest.shards["北京"].rankConversions, 688);
assert.equal(shard.records.length, 6623);
assert.equal(shard.rankConversions.length, 688);
assert.equal(shard.rankConversions.filter((row) => row.sourceId === "official-beijing-rank-2025-v3271").length, 347);

const rankNote = core.admissionScoreLayer.sourceNotes.find((row) => row.id === "official-beijing-rank-2025-v3271");
const filingNote = core.admissionScoreLayer.sourceNotes.find((row) => row.id === "official-beijing-undergraduate-filing-2025");
const vocationalNote = core.admissionScoreLayer.sourceNotes.find((row) => row.id === "official-beijing-vocational-filing-2025");
assert.equal(rankNote.scoreBasis, "gaokao-total-including-national-policy-bonus");
assert.equal(rankNote.rankPolicyBonusIncluded, true);
assert.equal(rankNote.policyBonusStatus, "official-national-bonus-explicit-local-bonus-municipal-only");
assert.equal(rankNote.automaticAdmissionScoreAlignmentAllowed, true);
assert.equal(rankNote.scoreDerivedAdmissionRecords, 1271);
assert.equal(rankNote.municipalLocalBonusGuardedRecords, 126);
assert.equal(rankNote.vocationalThreeSubjectGuardedRecords, 580);
assert.equal(rankNote.provenanceRevision.directOfficialRedownloadStatus, "success");
assert.equal(rankNote.provenanceRevision.files["beijing-rank-2025.pdf"].sha256, "338827fa23721b1a0450f7052f35d35b5b8502b8e80e462c724d88ec34b80a6c");
assert.equal(rankNote.provenanceRevision.files["beijing-undergraduate-filing-2025.pdf"].sha256, "4d2fe5bacb8c50f6ff7c4a30a864a7b3a074fb4cfd1a98285ddff27fba61c277");
assert.equal(filingNote.scoreDerivedRankRecords, 1271);
assert.equal(filingNote.rankUnavailableRecords, 126);
assert.equal(filingNote.nativeAdmissionRankUnavailableRecords, 1397);
assert.deepEqual(filingNote.rankSourceIds, ["official-beijing-rank-2025-v3271"]);
assert.equal(vocationalNote.activeRuntimeRecords, 580);
assert.equal(vocationalNote.rankUnavailableRecords, 580);
assert.equal(vocationalNote.automaticAdmissionScoreAlignmentAllowed, false);
assert.equal(vocationalNote.scoreBasis, "three-subject-unified-exam-total");

assert.equal(runtimeAudit.after.linkedAdmissionRecords, 1271);
assert.equal(runtimeAudit.after.municipalLocalBonusGuardedRecords, 126);
assert.equal(runtimeAudit.after.vocationalThreeSubjectGuardedRecords, 580);
assert.equal(runtimeAudit.after.rankConversionsAdded, 0);
assert.equal(evidence.files.length, 7);
assert.equal(evidence.runtimeBoundary.nationalBonusCompatibleRecords, 1271);
assert.deepEqual(
  [core.admissionScoreLayer.rankSourceCoverage.sources, core.admissionScoreLayer.rankSourceCoverage.parsedSources, core.admissionScoreLayer.rankSourceCoverage.parsedRecords],
  [221, 155, 133640],
);
console.log(JSON.stringify({ status: "ok", modelVersion: version, linked: 1271, municipalGuarded: 126, vocationalGuarded: 580 }, null, 2));
