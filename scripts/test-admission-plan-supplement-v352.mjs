#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const assetFile = path.join(root, "site/data/release-v3.275/admission-plan-supplement-v352.json.gz");
assert.ok(fs.existsSync(assetFile), "v3.352 runtime asset must exist");
const supplement = JSON.parse(zlib.gunzipSync(fs.readFileSync(assetFile), { to: "string" }));
assert.equal(supplement.version, "v3.352");
assert.equal(supplement.type, "runtime-admission-plan-supplement");
assert.deepEqual(supplement.sources.map((source) => source.id).sort(), [
  "official-jnu-national-plan-2026",
  "official-lnpu-national-plan-2026",
  "official-maotai-national-plan-2026",
  "official-suda-national-plan-2026",
  "official-xmu-national-plan-2026",
]);
assert.equal(supplement.summary.records, 4663);
assert.equal(supplement.summary.ordinaryRecords, 3280);
assert.equal(supplement.summary.specialPathRecords, 1383);
assert.equal(supplement.summary.provinces, 31);
assert.equal(supplement.summary.schools, 5);
assert.equal(supplement.records.length, 4663);
assert.equal(new Set(supplement.records.map((record) => record.province)).size, 31);
assert.equal(new Set(supplement.records.map((record) => record.schoolCode)).size, 5);

const lnpuRecords = supplement.records.filter((record) => record.schoolCode === "10148");
assert.equal(lnpuRecords.length, 638);
assert.equal(new Set(lnpuRecords.map((record) => record.province)).size, 31);
assert.equal(lnpuRecords.reduce((sum, record) => sum + Number(record.planCount || 0), 0), 3210);
assert.equal(lnpuRecords.filter((record) => record.formalScoreScope === "school-official-only").length, 609);
assert.equal(lnpuRecords.filter((record) => record.formalScoreScope === "special-path-only").length, 29);
assert.equal(lnpuRecords.filter((record) => record.province === "北京" && record.subjectType === "综合改革").length, 2);
assert.ok(lnpuRecords.some((record) => record.province === "河北" && record.subjectType === "物理类"));
assert.ok(lnpuRecords.some((record) => record.province === "辽宁" && record.subjectType === "体育类" && record.formalScoreScope === "special-path-only"));
assert.ok(lnpuRecords.some((record) => /中外合作办学/.test(record.majorName) && record.formalScoreScope === "special-path-only"));
assert.ok(lnpuRecords.every((record) => record.batch === "普通本科" && /未列具体批次/.test(record.planRemark)));
const lnpuSource = supplement.sources.find((source) => source.id === "official-lnpu-national-plan-2026");
assert.equal(lnpuSource.otherPlanCountExcluded, 271);
assert.ok(supplement.sources.every((source) => source.url && source.quality));

const app = fs.readFileSync(path.join(root, "site/assets/app.js"), "utf8");
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v354\.json", "官方计划补充"\)/);
assert.match(app, /planSupplementManifest\?\.sources/);
assert.match(app, /state\.planSupplementRecords/);

console.log(JSON.stringify({ status: "ok", version: supplement.version, records: supplement.records.length, provinces: supplement.summary.provinces, schools: supplement.summary.schools, ordinaryRecords: supplement.summary.ordinaryRecords, specialPathRecords: supplement.summary.specialPathRecords }, null, 2));
