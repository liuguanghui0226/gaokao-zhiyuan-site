#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(root, "site/data/release-v3.275");
const versions = ["v356", "v358", "v359", "v360", "v361"];
const manifests = versions.map((version) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(releaseDir, `admission-plan-supplement-${version}.json.gz`)), { to: "string" })));
const app = fs.readFileSync(path.join(root, "site/assets/app.js"), "utf8");
assert.match(app, /provinceCategories/);
assert.match(app, /unallocatedRecords/);
assert.match(app, /未分省/);
const instrumented = `${app.slice(0, app.lastIndexOf("\nboot().catch"))}\nglobalThis.__gaokaoTest = { mergePlanSupplementManifests };`;
const context = vm.createContext({ console, Intl, Date, Set, Map });
vm.runInContext(instrumented, context, { filename: path.join(root, "site/assets/app.js") });
const merged = context.__gaokaoTest.mergePlanSupplementManifests(...manifests);

assert.equal(merged.records.length, 11151);
assert.equal(merged.summary.records, 11151);
assert.equal(merged.summary.ordinaryRecords, 8246);
assert.equal(merged.summary.specialPathRecords, 2905);
assert.equal(merged.summary.planCount, 70444);
assert.equal(merged.summary.provinces, 31);
assert.equal(merged.summary.provinceCategories, 32);
assert.equal(merged.summary.unallocatedRecords, 2);
assert.equal(merged.summary.schools, 13);
assert.equal(merged.sources.length, 13);
assert.equal(merged.records.filter((record) => record.province === "不分省").length, 2);
assert.ok(merged.records.every((record) => record.year === 2026 && record.dataType === "admission-plan"));

console.log(JSON.stringify({ status: "ok", records: merged.summary.records, planCount: merged.summary.planCount, provinces: merged.summary.provinces, provinceCategories: merged.summary.provinceCategories, unallocatedRecords: merged.summary.unallocatedRecords, schools: merged.summary.schools }, null, 2));
