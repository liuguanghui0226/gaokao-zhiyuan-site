#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const versions = ["v356", "v358", "v359", "v360", "v361", "v363", "v365"];
const manifests = versions.map((version) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, `site/data/release-v3.275/admission-plan-supplement-${version}.json.gz`), { to: "string" }))));
const app = fs.readFileSync(path.join(root, "site/assets/app.js"), "utf8");
const instrumented = `${app.slice(0, app.lastIndexOf("\nboot().catch"))}\nglobalThis.__gaokaoTest = { mergePlanSupplementManifests };`;
const context = vm.createContext({ console, Intl, Date, Set, Map });
vm.runInContext(instrumented, context, { filename: path.join(root, "site/assets/app.js") });
const merged = context.__gaokaoTest.mergePlanSupplementManifests(...manifests);
assert.equal(merged.version, "v3.356+v3.358+v3.359+v3.360+v3.361+v3.363+v3.365");
assert.equal(merged.summary.records, 13093);
assert.equal(merged.summary.ordinaryRecords, 9902);
assert.equal(merged.summary.specialPathRecords, 3191);
assert.equal(merged.summary.planCount, 78282);
assert.equal(merged.summary.provinces, 31);
assert.equal(merged.summary.provinceCategories, 32);
assert.equal(merged.summary.unallocatedRecords, 2);
assert.equal(merged.summary.schools, 15);
assert.equal(merged.sources.length, 15);
assert.equal(merged.records.length, 13093);
assert.equal(merged.records.filter((record) => record.schoolCode === "10694").length, 659);
assert.equal(merged.records.filter((record) => record.schoolCode === "10694" && record.province === "西藏" && record.formalScoreScope === "special-path-only").length, 38);
assert.equal(merged.records.filter((record) => record.schoolCode === "10186").length, 1283);
assert.equal(merged.records.filter((record) => record.schoolCode === "10186" && record.formalScoreScope === "school-official-only").length, 1035);
assert.equal(merged.records.filter((record) => record.schoolCode === "10186" && record.formalScoreScope === "special-path-only").length, 248);
console.log(JSON.stringify({ status: "ok", version: merged.version, records: merged.summary.records, planCount: merged.summary.planCount, provinces: merged.summary.provinces, provinceCategories: merged.summary.provinceCategories, unallocatedRecords: merged.summary.unallocatedRecords, schools: merged.summary.schools }, null, 2));
