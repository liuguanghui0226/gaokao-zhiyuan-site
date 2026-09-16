#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const assetFile = path.join(root, "site/data/release-v3.275/admission-plan-supplement-v358.json.gz");
assert.ok(fs.existsSync(assetFile), "v3.358 runtime asset must exist");
const supplement = JSON.parse(zlib.gunzipSync(fs.readFileSync(assetFile), { to: "string" }));
assert.equal(supplement.version, "v3.358");
assert.equal(supplement.type, "runtime-admission-plan-supplement");
assert.equal(supplement.source.id, "official-hnust-national-plan-2026");
assert.deepEqual(supplement.sources.map((source) => source.id), ["official-hnust-national-plan-2026"]);
assert.equal(supplement.summary.records, 1961);
assert.equal(supplement.summary.ordinaryRecords, 1687);
assert.equal(supplement.summary.specialPathRecords, 274);
assert.equal(supplement.summary.planCount, 10579);
assert.equal(supplement.summary.rawPlanCount, 10582);
assert.equal(supplement.summary.duplicateRows, 2);
assert.equal(supplement.summary.provinces, 31);
assert.equal(supplement.summary.schools, 1);
assert.equal(supplement.records.length, 1961);
assert.equal(new Set(supplement.records.map((record) => record.id)).size, supplement.records.length);
assert.ok(supplement.records.every((record) => record.schoolCode === "10534" && record.year === 2026 && record.dataType === "admission-plan" && Number.isInteger(record.planCount) && record.planCount > 0));
assert.equal(new Set(supplement.records.map((record) => record.province)).size, 31);
assert.equal(supplement.records.filter((record) => record.formalScoreScope === "school-official-only").length, 1687);
assert.equal(supplement.records.filter((record) => record.formalScoreScope === "special-path-only").length, 274);
assert.ok(supplement.records.some((record) => record.province === "新疆" && record.admissionType === "南疆单列" && record.formalScoreScope === "special-path-only"));
assert.ok(supplement.records.some((record) => record.province === "西藏" && record.formalScoreScope === "school-official-only"));
assert.ok(supplement.records.some((record) => record.province === "湖南" && record.admissionType === "国家专项" && record.formalScoreScope === "special-path-only"));
assert.ok(supplement.records.some((record) => record.province === "湖南" && record.admissionType === "公费师范生" && record.tuition === 0));
assert.ok(supplement.records.every((record) => record.sourceId === "official-hnust-national-plan-2026" && record.sourcePageUrl && record.officialEvidencePath));
assert.equal(supplement.sources[0].headlinePlanCount, 10860);
assert.equal(supplement.sources[0].apiPlanCount, 10582);
assert.equal(supplement.sources[0].unattributedDelta, 278);
assert.equal(supplement.sources[0].duplicateRows, 2);

const app = fs.readFileSync(path.join(root, "site/assets/app.js"), "utf8");
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v356\.json", "官方计划补充"\)/);
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v358\.json", "官方计划补充"\)/);
assert.match(app, /state\.planSupplementRecords/);
assert.match(app, /planSupplementV358/);
const bootIndex = app.lastIndexOf("\nboot().catch");
const instrumented = `${app.slice(0, bootIndex)}
globalThis.__gaokaoTest = { mergePlanSupplementManifests };`;
const context = vm.createContext({ console, Intl, Date, Set, Map });
vm.runInContext(instrumented, context, { filename: path.join(root, "site/assets/app.js") });
const merged = context.__gaokaoTest.mergePlanSupplementManifests(
  { version: "v3.356", sources: [{ id: "sdnu" }], summary: { records: 7308, ordinaryRecords: 5098, specialPathRecords: 2210, planCount: 6119 }, records: [{ id: "sdnu-x", province: "青海", schoolCode: "10445" }] },
  { version: "v3.358", sources: [{ id: "hnust" }], summary: { records: 1961, ordinaryRecords: 1687, specialPathRecords: 274, planCount: 10579 }, records: [{ id: "hnust-x", province: "新疆", schoolCode: "10534" }] },
);
assert.equal(merged.version, "v3.356+v3.358");
assert.equal(merged.summary.records, 9269);
assert.equal(merged.summary.ordinaryRecords, 6785);
assert.equal(merged.summary.specialPathRecords, 2484);
assert.equal(merged.summary.provinces, 2);
assert.equal(merged.summary.schools, 2);
assert.equal(Array.from(merged.sources, (source) => source.id).join(","), "sdnu,hnust");
assert.equal(merged.records.length, 2);

console.log(JSON.stringify({ status: "ok", version: supplement.version, records: supplement.records.length, provinces: supplement.summary.provinces, planCount: supplement.summary.planCount, ordinaryRecords: supplement.summary.ordinaryRecords, specialPathRecords: supplement.summary.specialPathRecords }, null, 2));
