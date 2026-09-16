#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const assetFile = path.join(root, "site/data/release-v3.275/admission-plan-supplement-v354.json.gz");
assert.ok(fs.existsSync(assetFile), "v3.354 runtime asset must exist");
const supplement = JSON.parse(zlib.gunzipSync(fs.readFileSync(assetFile), { to: "string" }));
assert.equal(supplement.version, "v3.354");
assert.equal(supplement.type, "runtime-admission-plan-supplement");
assert.deepEqual(supplement.sources.map((source) => source.id).sort(), [
  "official-dlmu-national-plan-2026",
  "official-jnu-national-plan-2026",
  "official-lnpu-national-plan-2026",
  "official-maotai-national-plan-2026",
  "official-suda-national-plan-2026",
  "official-usst-national-plan-2026",
  "official-xmu-national-plan-2026",
]);
assert.equal(supplement.summary.records, 5817);
assert.equal(supplement.summary.ordinaryRecords, 3984);
assert.equal(supplement.summary.specialPathRecords, 1833);
assert.equal(supplement.summary.provinces, 31);
assert.equal(supplement.summary.schools, 7);
assert.equal(supplement.records.length, 5817);
assert.equal(new Set(supplement.records.map((record) => record.province)).size, 31);
assert.equal(new Set(supplement.records.map((record) => record.schoolCode)).size, 7);

const usstRecords = supplement.records.filter((record) => record.schoolCode === "10252");
assert.equal(usstRecords.length, 318);
assert.equal(new Set(usstRecords.map((record) => record.province)).size, 30);
assert.equal(usstRecords.reduce((sum, record) => sum + Number(record.planCount || 0), 0), 4264);
assert.equal(usstRecords.filter((record) => record.formalScoreScope === "school-official-only").length, 215);
assert.equal(usstRecords.filter((record) => record.formalScoreScope === "special-path-only").length, 103);
assert.equal(usstRecords.filter((record) => record.admissionType === "艺术类").length, 7);
assert.equal(usstRecords.filter((record) => record.admissionType === "艺术类").reduce((sum, record) => sum + record.planCount, 0), 240);
assert.equal(usstRecords.filter((record) => record.admissionType === "国家专项").length, 15);
assert.equal(usstRecords.filter((record) => record.admissionType === "国家专项").reduce((sum, record) => sum + record.planCount, 0), 75);
assert.ok(usstRecords.some((record) => record.admissionType === "中外合作办学" && record.formalScoreScope === "special-path-only"));
assert.ok(usstRecords.some((record) => record.province === "西藏" && record.subjectType === "历史类"));
assert.ok(usstRecords.some((record) => record.sourceMajorGroupRaw === "具体包含专业详见招生章程"));
const usstSource = supplement.sources.find((source) => source.id === "official-usst-national-plan-2026");
assert.equal(usstSource.records, 318);
assert.equal(usstSource.planCount, 4264);
assert.equal(usstSource.provinces, 30);
assert.equal(usstSource.queryCount, 30);
assert.equal(usstSource.pageSha256, "93d0a722dd6ecf56a40f4cd5ca1313de7965a3dfa23893731b80e278b3ad04ce");
assert.ok(usstSource.cautions.some((text) => /山西/.test(text)));
assert.ok(supplement.sources.every((source) => source.url && source.quality));

const app = fs.readFileSync(path.join(root, "site/assets/app.js"), "utf8");
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v356\.json", "官方计划补充"\)/);
assert.match(app, /planSupplementManifest\?\.sources/);
assert.match(app, /state\.planSupplementRecords/);

console.log(JSON.stringify({ status: "ok", version: supplement.version, records: supplement.records.length, provinces: supplement.summary.provinces, schools: supplement.summary.schools, usstRecords: usstRecords.length, usstPlanCount: usstRecords.reduce((sum, record) => sum + Number(record.planCount || 0), 0), ordinaryRecords: supplement.summary.ordinaryRecords, specialPathRecords: supplement.summary.specialPathRecords }, null, 2));
