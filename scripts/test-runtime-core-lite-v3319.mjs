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
const auditFile = path.join(projectRoot, "data/admissions/runtime-core-lite-v3319-manifest.json");
const app = fs.readFileSync(path.join(projectRoot, "site/assets/app.js"), "utf8");
const readGzip = (file) => zlib.gunzipSync(fs.readFileSync(file));
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const fullBytes = readGzip(fullFile);
const liteBytes = readGzip(liteFile);
const manifestBytes = readGzip(manifestFile);
const full = JSON.parse(fullBytes);
const lite = JSON.parse(liteBytes);
const manifest = JSON.parse(manifestBytes);
const audit = JSON.parse(fs.readFileSync(auditFile, "utf8"));
const fullNotes = full.admissionScoreLayer.sourceNotes;
const liteNotes = lite.admissionScoreLayer.sourceNotes;

assert.equal(lite.modelVersion, "local-deterministic-v3.319-jiangsu-jseea-first-stage-rank2025-aligned-868426records");
assert.equal(lite.modelVersion, full.modelVersion);
assert.equal(lite.modelPolicy.version, full.modelPolicy.version);
assert.equal(lite.admissionScoreLayer.structuredRecords, 868426);
assert.equal(lite.admissionScoreLayer.rankConversionRecords, 122287);
assert.equal(liteNotes.length, fullNotes.length);
assert.equal(liteNotes.length, 5123);
assert.equal(lite.browserRuntime.profile, "core-lite-v1");
assert.equal(lite.browserRuntime.fullCoreFile, "knowledge-core.json.gz");
assert.ok(app.includes('fetchRuntimeJson("knowledge-core-lite.json", "核心知识")'));
assert.ok(!app.includes('fetchRuntimeJson("knowledge-core.json", "核心知识")'));

const allowedFields = new Set(lite.browserRuntime.sourceNoteFields);
for (const note of liteNotes) {
  assert.ok(note.id && note.title && note.quality);
  assert.ok(Object.keys(note).every((key) => allowedFields.has(key)), `Lite source note ${note.id} leaked a full-evidence field`);
}
const rankSource = liteNotes.find((note) => note.id === "official-jiangsu-rank-2025-v3319");
assert.equal(rankSource.province, "江苏");
assert.equal(rankSource.year, 2025);
assert.equal(rankSource.quality, "official-jiangsu-education-examination-authority-image-chsi-byte-identical-dxsbb-pixel-equivalent-cross-verified");
assert.equal(rankSource.url, "https://www.jseea.cn/webfile/index/index_zkxx/2025-06-24/7343234265133355008.html");

assert.equal(manifest.coreLite.profile, "core-lite-v1");
assert.equal(manifest.coreLite.bytes, liteBytes.byteLength);
assert.equal(manifest.coreLite.compressedBytes, fs.statSync(liteFile).size);
assert.equal(manifest.coreLite.sha256, sha256(liteBytes));
assert.equal(manifest.coreLite.sourceNotes, 5123);
assert.equal(manifest.runtimeProfile.version, "v3.319");
assert.equal(audit.dataset, "runtime-core-lite-v3319");
assert.equal(audit.fullCore.sha256, sha256(fullBytes));
assert.equal(audit.liteCore.sha256, sha256(liteBytes));
assert.equal(audit.runtimeManifest.sha256, sha256(manifestBytes));
assert.ok(liteBytes.byteLength <= fullBytes.byteLength * 0.25);
assert.ok(fs.statSync(liteFile).size <= fs.statSync(fullFile).size * 0.35);

console.log(JSON.stringify({ status: "ok", modelVersion: lite.modelVersion, sourceNotes: liteNotes.length, fullBytes: fullBytes.byteLength, liteBytes: liteBytes.byteLength, compressedReductionRate: Number((1 - fs.statSync(liteFile).size / fs.statSync(fullFile).size).toFixed(6)) }, null, 2));
