#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const versions = ["v356", "v358", "v359", "v360", "v361", "v363"];
const manifests = versions.map((version) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, `site/data/release-v3.275/admission-plan-supplement-${version}.json.gz`), { to: "string" }))));
const app = fs.readFileSync(path.join(root, "site/assets/app.js"), "utf8");
const instrumented = `${app.slice(0, app.lastIndexOf("\nboot().catch"))}\nglobalThis.__gaokaoTest = { mergePlanSupplementManifests };`;
const context = vm.createContext({ console, Intl, Date, Set, Map });
vm.runInContext(instrumented, context, { filename: path.join(root, "site/assets/app.js") });
const merged = context.__gaokaoTest.mergePlanSupplementManifests(...manifests);
assert.equal(merged.version, "v3.356+v3.358+v3.359+v3.360+v3.361+v3.363");
assert.equal(merged.summary.records, 11810);
assert.equal(merged.summary.ordinaryRecords, 8867);
assert.equal(merged.summary.specialPathRecords, 2943);
assert.equal(merged.summary.planCount, 73150);
assert.equal(merged.summary.provinces, 31);
assert.equal(merged.summary.provinceCategories, 32);
assert.equal(merged.summary.unallocatedRecords, 2);
assert.equal(merged.summary.schools, 14);
assert.equal(merged.sources.length, 14);
assert.equal(merged.records.length, 11810);
assert.equal(merged.records.filter((record) => record.schoolCode === "10694").length, 659);
assert.equal(merged.records.filter((record) => record.schoolCode === "10694" && record.province === "西藏" && record.formalScoreScope === "special-path-only").length, 38);
console.log(JSON.stringify({ status: "ok", version: merged.version, records: merged.summary.records, planCount: merged.summary.planCount, provinces: merged.summary.provinces, provinceCategories: merged.summary.provinceCategories, unallocatedRecords: merged.summary.unallocatedRecords, schools: merged.summary.schools }, null, 2));
