#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const assetFile = path.join(root, "site/data/release-v3.275/admission-plan-supplement-v351.json.gz");
assert.ok(fs.existsSync(assetFile), "combined official plan supplement runtime asset must exist");
const supplement = JSON.parse(zlib.gunzipSync(fs.readFileSync(assetFile), { to: "string" }));
assert.equal(supplement.version, "v3.351");
assert.equal(supplement.type, "runtime-admission-plan-supplement");
assert.equal(supplement.sources.length, 4);
assert.deepEqual(supplement.sources.map((source) => source.id).sort(), [
  "official-jnu-national-plan-2026",
  "official-maotai-national-plan-2026",
  "official-suda-national-plan-2026",
  "official-xmu-national-plan-2026",
]);
assert.equal(supplement.summary.records, 4025);
assert.equal(supplement.summary.ordinaryRecords, 2671);
assert.equal(supplement.summary.specialPathRecords, 1354);
assert.equal(supplement.summary.provinces, 31);
assert.equal(supplement.summary.schools, 4);
assert.equal(supplement.records.length, 4025);
assert.equal(new Set(supplement.records.map((record) => record.province)).size, 31);
assert.equal(new Set(supplement.records.map((record) => record.schoolCode)).size, 4);

const xmuRecords = supplement.records.filter((record) => record.schoolCode === "10384");
assert.equal(xmuRecords.length, 1515);
assert.equal(new Set(xmuRecords.map((record) => record.province)).size, 31);
assert.equal(xmuRecords.reduce((sum, record) => sum + Number(record.planCount || 0), 0), 5810);
assert.equal(xmuRecords.filter((record) => record.formalScoreScope === "school-official-only").length, 625);
assert.equal(xmuRecords.filter((record) => record.formalScoreScope === "special-path-only").length, 890);
assert.ok(xmuRecords.some((record) => record.province === "西藏" && record.formalScoreScope === "school-official-only"));
assert.ok(xmuRecords.some((record) => record.admissionType === "马来西亚分校" && record.formalScoreScope === "special-path-only"));
assert.ok(xmuRecords.some((record) => record.admissionType === "国家专项" && record.formalScoreScope === "special-path-only"));
assert.ok(xmuRecords.some((record) => record.electiveRequirement === "物理+化学"));
assert.ok(supplement.sources.every((source) => source.url && source.quality));

const app = fs.readFileSync(path.join(root, "site/assets/app.js"), "utf8");
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v355\.json", "官方计划补充"\)/);
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
