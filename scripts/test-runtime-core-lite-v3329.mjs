#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const readBytes = (file) => zlib.gunzipSync(fs.readFileSync(file));
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const fullFile = path.join(releaseDir, "knowledge-core.json.gz");
const liteFile = path.join(releaseDir, "knowledge-core-lite.json.gz");
const manifestFile = path.join(releaseDir, "manifest.json.gz");
const fullBytes = readBytes(fullFile);
const liteBytes = readBytes(liteFile);
const manifestBytes = readBytes(manifestFile);
const full = JSON.parse(fullBytes);
const lite = JSON.parse(liteBytes);
const manifest = JSON.parse(manifestBytes);
const audit = JSON.parse(fs.readFileSync(
  path.join(projectRoot, "data/admissions/runtime-core-lite-v3329-manifest.json"),
  "utf8",
));

assert.equal(lite.modelVersion, "local-deterministic-v3.329-anhui-official-rank2025-policy-bonus-inclusive-full-table-aligned-868426records");
assert.equal(lite.modelVersion, full.modelVersion);
assert.equal(lite.admissionScoreLayer.rankConversionRecords, 130155);
assert.equal(lite.admissionScoreLayer.sourceNotes.length, 5133);
assert.equal(lite.browserRuntime.profile, "core-lite-v1");
const allowedFields = new Set(lite.browserRuntime.sourceNoteFields);
assert.ok(lite.admissionScoreLayer.sourceNotes.every((note) => Object.keys(note).every((key) => allowedFields.has(key))));
const anhui = lite.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-anhui-rank-2025-v3329");
assert.equal(anhui.scoreBasis, "gaokao-total-including-policy-bonus");
assert.equal(anhui.rankPolicyBonusIncluded, true);
const xinjiang = lite.admissionScoreLayer.sourceNotes.find((note) => note.id === "sohu-xinjiang-rank-2025-cb85600e32");
assert.equal(xinjiang.automaticAdmissionScoreAlignmentAllowed, false);
assert.equal(manifest.coreLite.bytes, liteBytes.byteLength);
assert.equal(manifest.coreLite.sha256, sha256(liteBytes));
assert.equal(manifest.coreLite.sourceNotes, 5133);
assert.equal(manifest.runtimeProfile.version, "v3.329");
assert.equal(audit.dataset, "runtime-core-lite-v3329");
assert.equal(audit.fullCore.sha256, sha256(fullBytes));
assert.equal(audit.liteCore.sha256, sha256(liteBytes));
assert.equal(audit.runtimeManifest.sha256, sha256(manifestBytes));
assert.ok(liteBytes.byteLength <= fullBytes.byteLength * 0.25);
assert.ok(fs.statSync(liteFile).size <= fs.statSync(fullFile).size * 0.35);

console.log("Runtime core-lite v3.329 tests passed");
