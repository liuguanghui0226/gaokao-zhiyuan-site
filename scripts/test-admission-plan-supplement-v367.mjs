#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importFile = path.join(root, "data/admissions/official-national-school-plan-2026-v367-nchu-import.json");
const assetFile = path.join(root, "site/data/release-v3.275/admission-plan-supplement-v367.json.gz");
assert.ok(fs.existsSync(importFile), "NCHU v3.367 tracked import must exist");
assert.ok(fs.existsSync(assetFile), "NCHU v3.367 runtime asset must exist");
const importBytes = fs.readFileSync(importFile);
const imported = JSON.parse(importBytes);
const assetBytes = fs.readFileSync(assetFile);
const supplement = JSON.parse(zlib.gunzipSync(assetBytes, { to: "string" }));
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

assert.equal(assetBytes.length, 59_395);
assert.equal(sha256(assetBytes), "a4d7949a997178f72aedabcd10e3baf79078291603631a24c2ca31ca6d3ab16b");
assert.equal(supplement.version, "v3.367");
assert.equal(supplement.type, "runtime-admission-plan-supplement");
assert.equal(supplement.generatedAt, imported.generatedAt);
assert.equal(supplement.source.id, "official-nchu-national-plan-2026-api");
assert.equal(supplement.source.schoolCode, "10406");
assert.equal(supplement.source.schoolIdentifierCode, "4136010406");
assert.deepEqual(supplement.sources.map((source) => source.id), ["official-nchu-national-plan-2026-api"]);
assert.equal(supplement.sources[0].apiCorpusSha256, "4bdc52c4dfb1a2a3b54b69a18e5814bf47104c4911f4e5e3f688249b94025c97");
assert.equal(supplement.sources[0].canonicalPayloadSha256, "46446617f346820661fe9ce11c91504f692e4d16bb3b4e277dcbaacacd29950b");
assert.equal(supplement.sources[0].stableEvidenceCorpusSha256, "59e06548fcf9af9ad86c69138a4fb714bfe46ed4a89111cc698c7e24d3f71006");
assert.deepEqual(supplement.sources[0].emptyProvinces, ["西藏", "宁夏"]);
assert.deepEqual(supplement.summary, {
  records: 1092,
  planCount: 6988,
  rawRecords: 1092,
  rawPlanCount: 6988,
  duplicateRows: 0,
  invalidRows: 0,
  requestedProvinces: 31,
  provinces: 29,
  schools: 1,
  emptyProvinces: ["西藏", "宁夏"],
  ordinaryRecords: 913,
  ordinaryPlanCount: 5780,
  specialPathRecords: 179,
  specialPlanCount: 1208,
  typeBreakdown: {
    "普通类": { records: 913, planCount: 5780 },
    "中外合作办学": { records: 79, planCount: 580 },
    "艺术类": { records: 41, planCount: 347 },
    "体育类": { records: 7, planCount: 40 },
    "地方专项": { records: 21, planCount: 135 },
    "国家专项": { records: 18, planCount: 75 },
    "新疆班": { records: 12, planCount: 21 },
    "提前批": { records: 1, planCount: 10 },
  },
});
assert.equal(supplement.inputs.length, 1);
assert.equal(supplement.inputs[0].path, "data/admissions/official-national-school-plan-2026-v367-nchu-import.json");
assert.equal(supplement.inputs[0].sha256, sha256(importBytes));
assert.equal(supplement.inputs[0].records, 1092);
assert.equal(supplement.records.length, 1092);
assert.equal(new Set(supplement.records.map((record) => record.id)).size, 1092);
assert.ok(supplement.records.every((record) => record.schoolName === "南昌航空大学" && record.schoolCode === "10406" && record.schoolIdentifierCode === "4136010406"));
assert.ok(supplement.records.every((record) => record.year === 2026 && record.dataType === "admission-plan" && Number.isInteger(record.planCount) && record.planCount > 0));
assert.equal(supplement.records.filter((record) => record.formalScoreScope === "school-official-only").length, 913);
assert.equal(supplement.records.filter((record) => record.formalScoreScope === "special-path-only").length, 179);
assert.equal(supplement.records.reduce((sum, record) => sum + record.planCount, 0), 6988);
assert.equal(supplement.records.filter((record) => record.province === "江西").length, 131);
assert.equal(supplement.records.filter((record) => record.province === "江西").reduce((sum, record) => sum + record.planCount, 0), 4108);
assert.ok(!supplement.records.some((record) => ["西藏", "宁夏"].includes(record.province)));
assert.ok(supplement.records.some((record) => record.sourceRowId === "29377" && record.majorName === "英语" && record.majorGroup === "101" && record.formalScoreScope === "school-official-only"));
assert.ok(supplement.records.some((record) => record.sourceRowId === "29370" && record.admissionType === "中外合作办学" && record.formalScoreScope === "special-path-only"));
assert.ok(supplement.records.some((record) => record.sourceRowId === "29365" && record.admissionType === "提前批" && record.formalScoreScope === "special-path-only"));
assert.ok(supplement.records.some((record) => record.sourceRowId === "29453" && record.admissionType === "体育类" && record.formalScoreScope === "special-path-only"));
assert.ok(supplement.records.some((record) => record.sourceRowId === "29426" && record.admissionType === "国家专项" && record.sourceDirectionRaw === "航空维修工程与技术"));
assert.ok(supplement.records.every((record) => record.sourceId === supplement.source.id && record.sourceUrl && record.sourcePageUrl && record.officialEvidencePath));
assert.ok(supplement.records.filter((record) => record.sourceProfessionalGroupRaw === "").every((record) => record.majorGroup === undefined));
assert.match(supplement.cautions.join("；"), /西藏、宁夏/);
assert.match(supplement.cautions.join("；"), /各省、市招办/);

console.log(JSON.stringify({ status: "ok", version: supplement.version, records: supplement.records.length, provinces: supplement.summary.provinces, schools: supplement.summary.schools, planCount: supplement.summary.planCount, ordinaryRecords: supplement.summary.ordinaryRecords, specialPathRecords: supplement.summary.specialPathRecords, bytes: assetBytes.length, sha256: sha256(assetBytes) }, null, 2));
