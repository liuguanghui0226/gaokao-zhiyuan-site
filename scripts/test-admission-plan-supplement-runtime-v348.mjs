#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const assetFile = path.join(root, "site/data/release-v3.275/admission-plan-supplement-v348.json.gz");
assert.ok(fs.existsSync(assetFile), "official plan supplement runtime asset must exist");
const supplement = JSON.parse(zlib.gunzipSync(fs.readFileSync(assetFile), { to: "string" }));
assert.equal(supplement.version, "v3.348");
assert.equal(supplement.source.id, "official-suda-national-plan-2026");
assert.equal(supplement.summary.records, 1193);
assert.equal(supplement.summary.ordinaryRecords, 933);
assert.equal(supplement.summary.specialPathRecords, 260);
assert.equal(supplement.summary.provinces, 31);
assert.equal(supplement.records.length, 1193);
assert.equal(new Set(supplement.records.map((record) => record.province)).size, 31);
assert.ok(supplement.records.every((record) => record.dataType === "admission-plan"));
assert.ok(supplement.records.every((record) => record.sourceId === "official-suda-national-plan-2026"));
assert.ok(supplement.records.some((record) => record.province === "贵州" && record.formalScoreScope === "special-path-only"));
assert.ok(supplement.records.some((record) => record.province === "江苏" && record.formalScoreScope === "school-official-only"));

const appFile = path.join(root, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
assert.match(source, /fetchRuntimeJson\("admission-plan-supplement-v351\.json", "官方计划补充"\)/);
assert.match(source, /运行时官方计划补充/);
assert.match(source, /state\.planSupplementRecords/);
const bootIndex = source.lastIndexOf("\nboot().catch");
assert.ok(bootIndex >= 0, "could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = {
  provinceRecordsWithPlanSupplement,
};`;
const context = vm.createContext({ console, Intl, Date, Set, Map });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;

const shardRecords = [
  { id: "existing-jx", province: "江西", dataType: "major-admission" },
  { id: "duplicate", province: "江西", dataType: "admission-plan" },
];
const supplementRecords = [
  { id: "duplicate", province: "江西", dataType: "admission-plan" },
  { id: "suda-jx", province: "江西", dataType: "admission-plan" },
  { id: "suda-js", province: "江苏", dataType: "admission-plan" },
];
const jiangxiMerged = api.provinceRecordsWithPlanSupplement("江西", shardRecords, supplementRecords);
assert.equal(
  jiangxiMerged.map((record) => record.id).join(","),
  "existing-jx,duplicate,suda-jx",
  "province loading must append only matching, non-duplicate supplement records",
);
assert.equal(api.provinceRecordsWithPlanSupplement("江苏", [], supplementRecords).map((record) => record.id).join(","), "suda-js");

console.log(JSON.stringify({
  status: "ok",
  version: supplement.version,
  sourceId: supplement.source.id,
  records: supplement.records.length,
  provinces: supplement.summary.provinces,
  ordinaryRecords: supplement.summary.ordinaryRecords,
  specialPathRecords: supplement.summary.specialPathRecords,
}, null, 2));
