#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const assetFile = path.join(root, "site/data/release-v3.275/admission-plan-supplement-v359.json.gz");
assert.ok(fs.existsSync(assetFile), "v3.359 runtime asset must exist");
const supplement = JSON.parse(zlib.gunzipSync(fs.readFileSync(assetFile), { to: "string" }));
assert.equal(supplement.version, "v3.359");
assert.equal(supplement.type, "runtime-admission-plan-supplement");
assert.equal(supplement.source.id, "official-ncbcjxau-national-plan-2026");
assert.deepEqual(supplement.sources.map((source) => source.id), ["official-ncbcjxau-national-plan-2026"]);
assert.equal(supplement.summary.records, 443);
assert.equal(supplement.summary.ordinaryRecords, 432);
assert.equal(supplement.summary.specialPathRecords, 11);
assert.equal(supplement.summary.planCount, 3400);
assert.equal(supplement.summary.rawPlanCount, 3400);
assert.equal(supplement.summary.duplicateRows, 0);
assert.equal(supplement.summary.provinces, 28);
assert.equal(supplement.summary.schools, 1);
assert.equal(supplement.records.length, 443);
assert.equal(new Set(supplement.records.map((record) => record.id)).size, supplement.records.length);
assert.ok(supplement.records.every((record) => record.schoolCode === "13436" && record.year === 2026 && record.dataType === "admission-plan" && Number.isInteger(record.planCount) && record.planCount > 0));
assert.ok(supplement.records.some((record) => record.province === "不分省" && record.formalScoreScope === "school-official-only"));
assert.ok(supplement.records.some((record) => record.province === "江西" && record.planCount > 0));
assert.ok(supplement.records.some((record) => record.subjectType === "艺术类" && record.formalScoreScope === "special-path-only"));
assert.ok(supplement.records.every((record) => record.sourceId === "official-ncbcjxau-national-plan-2026" && record.sourcePageUrl && record.officialEvidencePath));

const app = fs.readFileSync(path.join(root, "site/assets/app.js"), "utf8");
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v356\.json", "官方计划补充"\)/);
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v358\.json", "官方计划补充"\)/);
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v359\.json", "官方计划补充"\)/);
assert.match(app, /state\.planSupplementV359/);
const bootIndex = app.lastIndexOf("\nboot().catch");
const instrumented = `${app.slice(0, bootIndex)}\nglobalThis.__gaokaoTest = { mergePlanSupplementManifests };`;
const context = vm.createContext({ console, Intl, Date, Set, Map });
vm.runInContext(instrumented, context, { filename: path.join(root, "site/assets/app.js") });
const merged = context.__gaokaoTest.mergePlanSupplementManifests(
  { version: "v3.356", sources: [{ id: "sdnu" }], summary: { records: 7308, ordinaryRecords: 5098, specialPathRecords: 2210, planCount: 6119 }, records: [{ id: "sdnu-x", province: "青海", schoolCode: "10445" }] },
  { version: "v3.358", sources: [{ id: "hnust" }], summary: { records: 1961, ordinaryRecords: 1687, specialPathRecords: 274, planCount: 10579 }, records: [{ id: "hnust-x", province: "新疆", schoolCode: "10534" }] },
  { version: "v3.359", sources: [{ id: "ncbcjxau" }], summary: { records: 443, ordinaryRecords: 432, specialPathRecords: 11, planCount: 3400 }, records: [{ id: "ncbcjxau-x", province: "江西", schoolCode: "13436" }] },
);
assert.equal(merged.version, "v3.356+v3.358+v3.359");
assert.equal(merged.summary.records, 9712);
assert.equal(merged.summary.ordinaryRecords, 7217);
assert.equal(merged.summary.specialPathRecords, 2495);
assert.equal(merged.summary.planCount, 20098);
assert.equal(merged.summary.provinces, 3);
assert.equal(merged.summary.schools, 3);
assert.equal(Array.from(merged.sources, (source) => source.id).join(","), "sdnu,hnust,ncbcjxau");
assert.equal(merged.records.length, 3);

console.log(JSON.stringify({ status: "ok", version: supplement.version, records: supplement.records.length, provinces: supplement.summary.provinces, planCount: supplement.summary.planCount, ordinaryRecords: supplement.summary.ordinaryRecords, specialPathRecords: supplement.summary.specialPathRecords }, null, 2));
