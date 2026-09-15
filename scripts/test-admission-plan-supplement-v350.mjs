#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const assetFile = path.join(root, "site/data/release-v3.275/admission-plan-supplement-v350.json.gz");
assert.ok(fs.existsSync(assetFile), "combined official plan supplement runtime asset must exist");
const supplement = JSON.parse(zlib.gunzipSync(fs.readFileSync(assetFile), { to: "string" }));
assert.equal(supplement.version, "v3.350");
assert.equal(supplement.type, "runtime-admission-plan-supplement");
assert.equal(supplement.sources.length, 3);
assert.deepEqual(supplement.sources.map((source) => source.id).sort(), [
  "official-jnu-national-plan-2026",
  "official-maotai-national-plan-2026",
  "official-suda-national-plan-2026",
]);
assert.equal(supplement.summary.records, 2510);
assert.equal(supplement.summary.ordinaryRecords, 2046);
assert.equal(supplement.summary.specialPathRecords, 464);
assert.equal(supplement.summary.provinces, 31);
assert.equal(supplement.summary.schools, 3);
assert.equal(supplement.records.length, 2510);
assert.equal(new Set(supplement.records.map((record) => record.province)).size, 31);
assert.equal(new Set(supplement.records.map((record) => record.schoolCode)).size, 3);
const maotaiRecords = supplement.records.filter((record) => record.schoolCode === "14625");
assert.equal(maotaiRecords.length, 124);
assert.equal(new Set(maotaiRecords.map((record) => record.province)).size, 18);
assert.equal(maotaiRecords.reduce((sum, record) => sum + Number(record.planCount || 0), 0), 1012);
assert.equal(new Set(maotaiRecords.filter((record) => record.electiveRequirement === "物理，化学").map((record) => record.majorName.replace(/（茅台实验班）$/, ""))).size, 11);
assert.ok(maotaiRecords.some((record) => record.majorName === "物流管理" && record.electiveRequirement === "物理"));
assert.ok(maotaiRecords.some((record) => record.schoolCode === "14625" && record.province === "贵州" && record.electiveRequirement === "不提科目要求"));
assert.ok(maotaiRecords.some((record) => record.schoolCode === "14625" && record.province === "河南" && record.majorName === "电子商务" && record.electiveRequirement === "物理"));
assert.ok(supplement.records.some((record) => record.schoolCode === "10559" && record.electiveRequirement));
assert.ok(supplement.records.some((record) => record.schoolCode === "10285" && record.formalScoreScope === "special-path-only"));
assert.ok(supplement.sources.every((source) => source.url && source.quality));

const app = fs.readFileSync(path.join(root, "site/assets/app.js"), "utf8");
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v351\.json", "官方计划补充"\)/);
assert.match(app, /planSupplementManifest\?\.sources/);
assert.match(app, /state\.planSupplementRecords/);

console.log(JSON.stringify({
  status: "ok",
  version: supplement.version,
  sources: supplement.sources.map((source) => source.id),
  records: supplement.records.length,
  provinces: supplement.summary.provinces,
  schools: supplement.summary.schools,
  ordinaryRecords: supplement.summary.ordinaryRecords,
  specialPathRecords: supplement.summary.specialPathRecords,
}, null, 2));
