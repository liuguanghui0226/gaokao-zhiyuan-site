#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const fullFile = path.join(releaseDir, "knowledge-core.json.gz");
const liteFile = path.join(releaseDir, "knowledge-core-lite.json.gz");
const manifestFile = path.join(releaseDir, "manifest.json.gz");
const auditFile = path.join(projectRoot, "data/admissions/runtime-core-lite-v3313-manifest.json");
const app = fs.readFileSync(path.join(projectRoot, "site/assets/app.js"), "utf8");

function readGzip(file) {
  return zlib.gunzipSync(fs.readFileSync(file));
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

const fullBytes = readGzip(fullFile);
const liteBytes = readGzip(liteFile);
const manifestBytes = readGzip(manifestFile);
const full = JSON.parse(fullBytes.toString("utf8"));
const lite = JSON.parse(liteBytes.toString("utf8"));
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const audit = JSON.parse(fs.readFileSync(auditFile, "utf8"));
const fullNotes = full.admissionScoreLayer.sourceNotes;
const liteNotes = lite.admissionScoreLayer.sourceNotes;

assert.equal(lite.modelVersion, full.modelVersion);
assert.equal(lite.modelPolicy.version, full.modelPolicy.version);
assert.equal(lite.admissionScoreLayer.structuredRecords, full.admissionScoreLayer.structuredRecords);
assert.equal(lite.admissionScoreLayer.rankConversionRecords, full.admissionScoreLayer.rankConversionRecords);
assert.equal(liteNotes.length, fullNotes.length);
assert.equal(liteNotes.length, 5117);
assert.equal(lite.browserRuntime.profile, "core-lite-v1");
assert.equal(lite.browserRuntime.fullCoreFile, "knowledge-core.json.gz");
assert.ok(app.includes('fetchRuntimeJson("knowledge-core-lite.json", "核心知识")'));
assert.ok(!app.includes('fetchRuntimeJson("knowledge-core.json", "核心知识")'));
assert.ok(app.includes("renderView(state.view, { force: true })"));
assert.ok(app.includes("if (state.view === \"sources\") renderView(\"sources\", { force: true })"));

const allowedFields = new Set(lite.browserRuntime.sourceNoteFields);
for (const note of liteNotes) {
  assert.ok(note.id, "Lite source note is missing id");
  assert.ok(note.title, `Lite source note ${note.id} is missing title`);
  assert.ok(note.quality, `Lite source note ${note.id} is missing quality`);
  assert.ok(Object.keys(note).every((key) => allowedFields.has(key)), `Lite source note ${note.id} leaked a full-evidence field`);
}

for (const sourceId of [
  "official-xinjiang-undergraduate2-filing-2025-v3312",
  "official-hdu-national-2014-2025-school-major-admission",
  "official-xizang-admission-schedule-2026-v3272",
]) {
  assert.ok(liteNotes.some((note) => note.id === sourceId), `Lite source index is missing ${sourceId}`);
}

const pendingNotes = liteNotes.filter((note) => note.ordinaryVocationalStatus === "pending-official-release");
assert.equal(pendingNotes.length, 5);
assert.equal(pendingNotes.filter((note) => note.ordinaryVocationalReview?.noHistoricalSubstitution === true).length, 5);
assert.equal(liteNotes.filter((note) => Array.isArray(note.schedule)).length, 1);

assert.equal(manifest.coreLite.profile, "core-lite-v1");
assert.equal(manifest.coreLite.bytes, liteBytes.byteLength);
assert.equal(manifest.coreLite.compressedBytes, fs.statSync(liteFile).size);
assert.equal(manifest.coreLite.sha256, sha256(liteBytes));
assert.equal(manifest.coreLite.sourceNotes, liteNotes.length);
assert.equal(manifest.runtimeProfile.version, "v3.313");
assert.equal(manifest.runtimeProfile.initialCore, "knowledge-core-lite.json.gz");
assert.equal(manifest.runtimeProfile.fullEvidenceCore, "knowledge-core.json.gz");
assert.equal(audit.fullCore.sha256, sha256(fullBytes));
assert.equal(audit.liteCore.sha256, sha256(liteBytes));
assert.equal(audit.runtimeManifest.sha256, sha256(manifestBytes));
assert.equal(audit.liteCore.bytes, liteBytes.byteLength);
assert.equal(audit.liteCore.compressedBytes, fs.statSync(liteFile).size);
assert.ok(liteBytes.byteLength <= fullBytes.byteLength * 0.25, "Core-lite must reduce uncompressed initial payload by at least 75%");
assert.ok(fs.statSync(liteFile).size <= fs.statSync(fullFile).size * 0.35, "Core-lite must reduce compressed initial payload by at least 65%");

console.log(JSON.stringify({
  status: "ok",
  modelVersion: lite.modelVersion,
  sourceNotes: liteNotes.length,
  fullBytes: fullBytes.byteLength,
  liteBytes: liteBytes.byteLength,
  rawReductionRate: Number((1 - liteBytes.byteLength / fullBytes.byteLength).toFixed(6)),
  fullCompressedBytes: fs.statSync(fullFile).size,
  liteCompressedBytes: fs.statSync(liteFile).size,
  compressedReductionRate: Number((1 - fs.statSync(liteFile).size / fs.statSync(fullFile).size).toFixed(6)),
}, null, 2));
