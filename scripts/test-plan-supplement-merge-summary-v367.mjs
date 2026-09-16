#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const versions = ["v356", "v358", "v359", "v360", "v361", "v363", "v365", "v366", "v367"];
const manifests = versions.map((version) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, `site/data/release-v3.275/admission-plan-supplement-${version}.json.gz`)), { to: "string" })));
const appFile = path.join(root, "site/assets/app.js");
const app = fs.readFileSync(appFile, "utf8");
const instrumented = `${app.slice(0, app.lastIndexOf("\nboot().catch"))}\nglobalThis.__gaokaoTest = { mergePlanSupplementManifests };`;
const context = vm.createContext({ console, Intl, Date, Set, Map });
vm.runInContext(instrumented, context, { filename: appFile });
const merged = context.__gaokaoTest.mergePlanSupplementManifests(...manifests);

assert.equal(merged.version, "v3.356+v3.358+v3.359+v3.360+v3.361+v3.363+v3.365+v3.366+v3.367");
assert.equal(merged.summary.records, 15429);
assert.equal(merged.summary.ordinaryRecords, 11334);
assert.equal(merged.summary.specialPathRecords, 4095);
assert.equal(merged.summary.planCount, 88931);
assert.equal(merged.summary.provinces, 31);
assert.equal(merged.summary.provinceCategories, 32);
assert.equal(merged.summary.unallocatedRecords, 2);
assert.equal(merged.summary.schools, 17);
assert.equal(merged.sources.length, 17);
assert.equal(merged.records.length, 15429);
assert.equal(merged.records.filter((record) => record.schoolCode === "10406").length, 1092);
assert.equal(merged.records.filter((record) => record.schoolCode === "10406" && record.formalScoreScope === "school-official-only").length, 913);
assert.equal(merged.records.filter((record) => record.schoolCode === "10406" && record.formalScoreScope === "special-path-only").length, 179);

console.log(JSON.stringify({ status: "ok", version: merged.version, records: merged.summary.records, planCount: merged.summary.planCount, schools: merged.summary.schools }, null, 2));
