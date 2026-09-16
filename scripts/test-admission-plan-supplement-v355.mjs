#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const assetFile = path.join(root, "site/data/release-v3.275/admission-plan-supplement-v355.json.gz");
assert.ok(fs.existsSync(assetFile), "v3.355 runtime asset must exist");
const supplement = JSON.parse(zlib.gunzipSync(fs.readFileSync(assetFile), { to: "string" }));
assert.equal(supplement.version, "v3.355");
assert.equal(supplement.type, "runtime-admission-plan-supplement");
assert.deepEqual(supplement.sources.map((source) => source.id).sort(), [
  "official-dlmu-national-plan-2026",
  "official-jnu-national-plan-2026",
  "official-lnpu-national-plan-2026",
  "official-maotai-national-plan-2026",
  "official-qlu-national-plan-2026",
  "official-suda-national-plan-2026",
  "official-usst-national-plan-2026",
  "official-xmu-national-plan-2026",
]);
assert.equal(supplement.summary.records, 6276);
assert.equal(supplement.summary.ordinaryRecords, 4379);
assert.equal(supplement.summary.specialPathRecords, 1897);
assert.equal(supplement.summary.provinces, 31);
assert.equal(supplement.summary.schools, 8);
assert.equal(supplement.records.length, 6276);
assert.equal(new Set(supplement.records.map((record) => record.province)).size, 31);
assert.equal(new Set(supplement.records.map((record) => record.schoolCode)).size, 8);
assert.equal(new Set(supplement.records.map((record) => record.id)).size, supplement.records.length);
assert.ok(supplement.records.every((record) => record.dataType === "admission-plan" && record.year === 2026 && Number.isInteger(record.planCount) && record.planCount > 0));

const qluRecords = supplement.records.filter((record) => record.schoolCode === "10431");
assert.equal(qluRecords.length, 459);
assert.equal(new Set(qluRecords.map((record) => record.province)).size, 28);
assert.equal(qluRecords.reduce((sum, record) => sum + Number(record.planCount || 0), 0), 8460);
assert.equal(qluRecords.filter((record) => record.formalScoreScope === "school-official-only").length, 395);
assert.equal(qluRecords.filter((record) => record.formalScoreScope === "special-path-only").length, 64);
assert.equal(qluRecords.filter((record) => record.admissionType === "艺术类").length, 18);
assert.equal(qluRecords.filter((record) => record.admissionType === "艺术类").reduce((sum, record) => sum + record.planCount, 0), 555);
assert.ok(qluRecords.some((record) => record.admissionType === "体育类" && record.formalScoreScope === "special-path-only"));
assert.ok(qluRecords.some((record) => record.admissionSubtype === "地方专项" && record.formalScoreScope === "special-path-only"));
assert.ok(qluRecords.some((record) => record.campus === "菏泽校区" && record.formalScoreScope === "special-path-only"));
assert.ok(qluRecords.some((record) => record.campus === "菏泽校区" && record.city === "菏泽"));
assert.ok(qluRecords.some((record) => record.admissionType === "中外合作办学" && record.formalScoreScope === "special-path-only"));
assert.ok(qluRecords.some((record) => record.admissionSubtype === "民族班" && record.formalScoreScope === "special-path-only"));
assert.ok(qluRecords.some((record) => record.electiveRequirement === "物理，化学" && record.sourceTypeId));
assert.ok(qluRecords.some((record) => record.batch && record.sourceBatchRaw === record.batch));
assert.ok(qluRecords.every((record) => record.sourceId === "official-qlu-national-plan-2026"));
assert.ok(qluRecords.every((record) => record.schoolCode === "10431"));
assert.ok(qluRecords.every((record) => record.sourcePlanYear === 2026));
assert.ok(qluRecords.every((record) => record.sourceProvinceId && record.sourceYearId && record.sourceCategoryId && record.sourceTypeId && record.officialEvidencePath));
assert.ok(!qluRecords.some((record) => record.province === "西藏" || record.province === "青海" || record.province === "宁夏"));
const qluSource = supplement.sources.find((source) => source.id === "official-qlu-national-plan-2026");
assert.equal(qluSource.records, 459);
assert.equal(qluSource.planCount, 8460);
assert.equal(qluSource.provinces, 28);
assert.equal(qluSource.pathCount, 62);
assert.deepEqual(qluSource.emptyProvinces, ["西藏", "青海", "宁夏"]);
assert.equal(qluSource.headlinePlanCount, 8460);
assert.equal(qluSource.apiPlanCount, 8460);
assert.equal(qluSource.unattributedDelta, 0);
assert.deepEqual(qluSource.byTypePlanCount, { "普通类": 5824, "艺考类": 555, "地方专项": 280, "菏泽校区": 1510, "中外合作": 270, "民族班": 21 });
assert.equal(qluSource.pageSha256, "5f53d0b2b04e2341ca2d08d82b32be2c1577ee02bf6210df2ebc3018dec8349b");
assert.ok(qluSource.cautions.some((text) => /西藏、青海、宁夏/.test(text)));
assert.ok(supplement.sources.every((source) => source.url && source.quality));

const app = fs.readFileSync(path.join(root, "site/assets/app.js"), "utf8");
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v356\.json", "官方计划补充"\)/);
assert.match(app, /planSupplementManifest\?\.sources/);
assert.match(app, /state\.planSupplementRecords/);

console.log(JSON.stringify({ status: "ok", version: supplement.version, records: supplement.records.length, provinces: supplement.summary.provinces, schools: supplement.summary.schools, qluRecords: qluRecords.length, qluPlanCount: qluRecords.reduce((sum, record) => sum + Number(record.planCount || 0), 0), ordinaryRecords: supplement.summary.ordinaryRecords, specialPathRecords: supplement.summary.specialPathRecords }, null, 2));
