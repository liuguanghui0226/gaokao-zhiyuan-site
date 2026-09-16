#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const assetFile = path.join(root, "site/data/release-v3.275/admission-plan-supplement-v360.json.gz");
assert.ok(fs.existsSync(assetFile), "v3.360 runtime asset must exist");
const supplement = JSON.parse(zlib.gunzipSync(fs.readFileSync(assetFile), { to: "string" }));
assert.equal(supplement.version, "v3.360");
assert.equal(supplement.type, "runtime-admission-plan-supplement");
assert.equal(supplement.source.id, "official-xzmu-national-plan-2026");
assert.deepEqual(supplement.sources.map((source) => source.id), ["official-xzmu-national-plan-2026"]);
assert.equal(supplement.summary.records, 259);
assert.equal(supplement.summary.ordinaryRecords, 230);
assert.equal(supplement.summary.specialPathRecords, 29);
assert.equal(supplement.summary.planCount, 2825);
assert.equal(supplement.summary.rawPlanCount, 2825);
assert.equal(supplement.summary.duplicateRows, 0);
assert.equal(supplement.summary.provinces, 20);
assert.equal(supplement.summary.schools, 1);
assert.equal(supplement.records.length, 259);
assert.equal(new Set(supplement.records.map((record) => record.id)).size, supplement.records.length);
assert.ok(supplement.records.every((record) => record.schoolCode === "10695" && record.year === 2026 && record.dataType === "admission-plan" && Number.isInteger(record.planCount) && record.planCount > 0));
assert.equal(supplement.records.filter((record) => record.province === "西藏").reduce((sum, record) => sum + record.planCount, 0), 1889);
assert.ok(supplement.records.some((record) => record.province === "西藏" && record.admissionType === "地方专项/部队生源" && record.formalScoreScope === "special-path-only"));
assert.ok(supplement.records.some((record) => record.province === "广西" && record.subjectType === "历史类"));
assert.ok(supplement.records.some((record) => record.province === "山东" && record.subjectType === "综合改革"));
assert.ok(supplement.records.some((record) => record.majorName === "播音与主持艺术" && record.formalScoreScope === "special-path-only"));
assert.ok(supplement.records.every((record) => record.sourceId === "official-xzmu-national-plan-2026" && record.sourcePageUrl && record.officialEvidencePath));

const app = fs.readFileSync(path.join(root, "site/assets/app.js"), "utf8");
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v356\.json", "官方计划补充"\)/);
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v358\.json", "官方计划补充"\)/);
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v359\.json", "官方计划补充"\)/);
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v360\.json", "官方计划补充"\)/);
assert.match(app, /state\.planSupplementV360/);
const bootIndex = app.lastIndexOf("\nboot().catch");
const instrumented = `${app.slice(0, bootIndex)}\nglobalThis.__gaokaoTest = { mergePlanSupplementManifests };`;
const context = vm.createContext({ console, Intl, Date, Set, Map });
vm.runInContext(instrumented, context, { filename: path.join(root, "site/assets/app.js") });
const merged = context.__gaokaoTest.mergePlanSupplementManifests(
  { version: "v3.356", sources: [{ id: "sdnu" }], summary: { records: 7308, ordinaryRecords: 5098, specialPathRecords: 2210, planCount: 6119 }, records: [{ id: "sdnu-x", province: "青海", schoolCode: "10445" }] },
  { version: "v3.358", sources: [{ id: "hnust" }], summary: { records: 1961, ordinaryRecords: 1687, specialPathRecords: 274, planCount: 10579 }, records: [{ id: "hnust-x", province: "新疆", schoolCode: "10534" }] },
  { version: "v3.359", sources: [{ id: "ncbcjxau" }], summary: { records: 443, ordinaryRecords: 432, specialPathRecords: 11, planCount: 3400 }, records: [{ id: "ncbcjxau-x", province: "江西", schoolCode: "13436" }] },
  { version: "v3.360", sources: [{ id: "xzmu" }], summary: { records: 259, ordinaryRecords: 230, specialPathRecords: 29, planCount: 2825 }, records: [{ id: "xzmu-x", province: "西藏", schoolCode: "10695" }] },
);
assert.equal(merged.version, "v3.356+v3.358+v3.359+v3.360");
assert.equal(merged.summary.records, 9971);
assert.equal(merged.summary.ordinaryRecords, 7447);
assert.equal(merged.summary.specialPathRecords, 2524);
assert.equal(merged.summary.planCount, 22923);
assert.equal(merged.summary.provinces, 4);
assert.equal(merged.summary.schools, 4);
assert.equal(Array.from(merged.sources, (source) => source.id).join(","), "sdnu,hnust,ncbcjxau,xzmu");
assert.equal(merged.records.length, 4);

console.log(JSON.stringify({ status: "ok", version: supplement.version, records: supplement.records.length, provinces: supplement.summary.provinces, planCount: supplement.summary.planCount, ordinaryRecords: supplement.summary.ordinaryRecords, specialPathRecords: supplement.summary.specialPathRecords }, null, 2));
