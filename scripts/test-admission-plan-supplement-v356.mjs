#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const assetFile = path.join(root, "site/data/release-v3.275/admission-plan-supplement-v356.json.gz");
assert.ok(fs.existsSync(assetFile), "v3.356 runtime asset must exist");
const supplement = JSON.parse(zlib.gunzipSync(fs.readFileSync(assetFile), { to: "string" }));
assert.equal(supplement.version, "v3.356");
assert.equal(supplement.type, "runtime-admission-plan-supplement");
assert.deepEqual(supplement.sources.map((source) => source.id).sort(), [
  "official-dlmu-national-plan-2026",
  "official-jnu-national-plan-2026",
  "official-lnpu-national-plan-2026",
  "official-maotai-national-plan-2026",
  "official-qlu-national-plan-2026",
  "official-sdnu-national-plan-2026",
  "official-suda-national-plan-2026",
  "official-usst-national-plan-2026",
  "official-xmu-national-plan-2026",
]);
assert.equal(supplement.summary.records, 7308);
assert.equal(supplement.summary.ordinaryRecords, 5098);
assert.equal(supplement.summary.specialPathRecords, 2210);
assert.equal(supplement.summary.provinces, 31);
assert.equal(supplement.summary.schools, 9);
assert.equal(supplement.records.length, 7308);
assert.equal(new Set(supplement.records.map((record) => record.id)).size, supplement.records.length);
assert.equal(new Set(supplement.records.map((record) => record.schoolCode)).size, 9);
assert.ok(supplement.records.every((record) => record.dataType === "admission-plan" && record.year === 2026 && Number.isInteger(record.planCount) && record.planCount > 0));

const sdnuRecords = supplement.records.filter((record) => record.schoolCode === "10445");
assert.equal(sdnuRecords.length, 1032);
assert.equal(new Set(sdnuRecords.map((record) => record.province)).size, 29);
assert.equal(sdnuRecords.reduce((sum, record) => sum + Number(record.planCount || 0), 0), 6119);
assert.equal(sdnuRecords.filter((record) => record.formalScoreScope === "school-official-only").length, 719);
assert.equal(sdnuRecords.filter((record) => record.formalScoreScope === "special-path-only").length, 313);
assert.ok(sdnuRecords.some((record) => record.province === "青海" && record.majorCode && record.tuition));
assert.ok(sdnuRecords.some((record) => record.province === "宁夏" && record.subjectType === "物理类"));
assert.ok(sdnuRecords.some((record) => record.admissionType === "国家专项" && record.formalScoreScope === "special-path-only"));
assert.ok(sdnuRecords.some((record) => record.admissionType === "地方专项" && record.formalScoreScope === "special-path-only"));
assert.ok(sdnuRecords.some((record) => record.admissionType === "公费师范生" && record.formalScoreScope === "special-path-only"));
assert.ok(sdnuRecords.some((record) => record.admissionType === "定向西藏" && record.formalScoreScope === "special-path-only"));
assert.ok(sdnuRecords.some((record) => record.admissionType === "综合评价" && record.formalScoreScope === "special-path-only"));
assert.ok(sdnuRecords.some((record) => record.admissionType === "中外合作办学" && record.tuition === 26000));
assert.ok(sdnuRecords.some((record) => record.electiveRequirement === "物理，化学" && record.majorCode && record.majorGroup));
assert.ok(sdnuRecords.every((record) => record.sourceId === "official-sdnu-national-plan-2026" && record.sourceProvinceQuery && record.sourceYearQuery === "2026" && record.sourceCategoryQuery && record.sourceTypeQuery && record.officialEvidencePath));
assert.ok(!sdnuRecords.some((record) => record.province === "西藏" || record.province === "新疆"));
const sdnuSource = supplement.sources.find((source) => source.id === "official-sdnu-national-plan-2026");
assert.equal(sdnuSource.records, 1032);
assert.equal(sdnuSource.planCount, 6119);
assert.equal(sdnuSource.provinces, 29);
assert.equal(sdnuSource.pathCount, 103);
assert.equal(sdnuSource.queryCount, 103);
assert.deepEqual(sdnuSource.emptyProvinces, ["西藏", "新疆"]);
assert.equal(sdnuSource.headlinePlanCount, null);
assert.equal(sdnuSource.apiPlanCount, 6119);
assert.equal(sdnuSource.unattributedDelta, null);
assert.deepEqual(sdnuSource.byTypePlanCount, { "普通类": 3833, "中外合作办学": 200, "艺考类专业": 510, "国家专项计划": 159, "艺考类专业（中外合作办学）": 240, "体育类": 231, "普通类提前批": 30, "山东省属地方公费师范生": 309, "综合评价招生": 380, "非西藏生源定向西藏就业": 7, "地方专项计划": 220 });
assert.equal(sdnuSource.pageSha256, "7704c5882e1b8158723bd4fb4758a5618d6a35e7de5d2b49857bb4095697e5cf");
assert.ok(sdnuSource.cautions.some((text) => /新疆、西藏/.test(text)));
assert.ok(supplement.sources.every((source) => source.url && source.quality));

const app = fs.readFileSync(path.join(root, "site/assets/app.js"), "utf8");
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v356\.json", "官方计划补充"\)/);
assert.match(app, /planSupplementManifest\?\.sources/);
assert.match(app, /state\.planSupplementRecords/);

console.log(JSON.stringify({ status: "ok", version: supplement.version, records: supplement.records.length, provinces: supplement.summary.provinces, schools: supplement.summary.schools, sdnuRecords: sdnuRecords.length, sdnuPlanCount: sdnuRecords.reduce((sum, record) => sum + Number(record.planCount || 0), 0), ordinaryRecords: supplement.summary.ordinaryRecords, specialPathRecords: supplement.summary.specialPathRecords }, null, 2));
