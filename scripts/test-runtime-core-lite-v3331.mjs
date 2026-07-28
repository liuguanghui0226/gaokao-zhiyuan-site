#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const release = path.join(root, "site/data/release-v3.275");
const readBytes = (name) => zlib.gunzipSync(fs.readFileSync(path.join(release, name)));
const fullBytes = readBytes("knowledge-core.json.gz");
const liteBytes = readBytes("knowledge-core-lite.json.gz");
const full = JSON.parse(fullBytes);
const lite = JSON.parse(liteBytes);
const manifest = JSON.parse(readBytes("manifest.json.gz"));
const audit = JSON.parse(fs.readFileSync(path.join(root, "data/admissions/runtime-core-lite-v3331-manifest.json")));
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
assert.equal(lite.modelVersion, full.modelVersion);
assert.equal(lite.admissionScoreLayer.sourceNotes.length, 5135);
assert.equal(lite.browserRuntime.profile, "core-lite-v1");
assert.ok(lite.browserRuntime.sourceNoteFields.includes("rankUsageRequired"));
assert.ok(1 - liteBytes.length / fullBytes.length >= 0.75);
assert.equal(manifest.coreLite.sha256, hash(liteBytes));
assert.equal(manifest.runtimeProfile.version, "v3.331");
assert.equal(audit.modelVersion, full.modelVersion);
console.log(JSON.stringify({ status: "ok", fullBytes: fullBytes.length, liteBytes: liteBytes.length }, null, 2));
