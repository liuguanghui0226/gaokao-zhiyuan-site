#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const assetFile = path.join(root, "site/data/release-v3.275/admission-plan-supplement-v353.json.gz");
assert.ok(fs.existsSync(assetFile), "v3.353 runtime asset must exist");
const supplement = JSON.parse(zlib.gunzipSync(fs.readFileSync(assetFile), { to: "string" }));
assert.equal(supplement.version, "v3.353");
assert.equal(supplement.type, "runtime-admission-plan-supplement");
assert.deepEqual(supplement.sources.map((source) => source.id).sort(), [
  "official-dlmu-national-plan-2026",
  "official-jnu-national-plan-2026",
  "official-lnpu-national-plan-2026",
  "official-maotai-national-plan-2026",
  "official-suda-national-plan-2026",
  "official-xmu-national-plan-2026",
]);
assert.equal(supplement.summary.records, 5499);
assert.equal(supplement.summary.ordinaryRecords, 3769);
assert.equal(supplement.summary.specialPathRecords, 1730);
assert.equal(supplement.summary.provinces, 31);
assert.equal(supplement.summary.schools, 6);
assert.equal(supplement.records.length, 5499);
assert.equal(new Set(supplement.records.map((record) => record.province)).size, 31);
assert.equal(new Set(supplement.records.map((record) => record.schoolCode)).size, 6);

const dlmuRecords = supplement.records.filter((record) => record.schoolCode === "10151");
assert.equal(dlmuRecords.length, 836);
assert.equal(new Set(dlmuRecords.map((record) => record.province)).size, 31);
assert.equal(dlmuRecords.reduce((sum, record) => sum + Number(record.planCount || 0), 0), 4718);
assert.equal(dlmuRecords.filter((record) => record.formalScoreScope === "school-official-only").length, 489);
assert.equal(dlmuRecords.filter((record) => record.formalScoreScope === "special-path-only").length, 347);
assert.ok(dlmuRecords.some((record) => record.province === "西藏" && record.subjectType === "历史类"));
assert.ok(dlmuRecords.some((record) => record.admissionType === "提前批" && /视力|色盲|身高|不宜女生/.test(record.planRemark)));
assert.ok(dlmuRecords.some((record) => record.admissionType === "中外合作办学" && record.tuition === 80000 && record.formalScoreScope === "special-path-only"));
assert.ok(dlmuRecords.some((record) => record.sourceMajorGroupRaw && /公共事业管理/.test(record.sourceMajorGroupRaw)));
assert.ok(dlmuRecords.some((record) => record.electiveRequirement === "物理，化学"));
const dlmuSource = supplement.sources.find((source) => source.id === "official-dlmu-national-plan-2026");
assert.equal(dlmuSource.headlinePlanCount, 4780);
assert.equal(dlmuSource.unattributedDelta, 62);
assert.equal(dlmuSource.summaryGroups, 168);
assert.ok(supplement.sources.every((source) => source.url && source.quality));

const app = fs.readFileSync(path.join(root, "site/assets/app.js"), "utf8");
assert.match(app, /fetchRuntimeJson\("admission-plan-supplement-v355\.json", "官方计划补充"\)/);
assert.match(app, /planSupplementManifest\?\.sources/);
assert.match(app, /state\.planSupplementRecords/);

console.log(JSON.stringify({ status: "ok", version: supplement.version, records: supplement.records.length, provinces: supplement.summary.provinces, schools: supplement.summary.schools, ordinaryRecords: supplement.summary.ordinaryRecords, specialPathRecords: supplement.summary.specialPathRecords, dlmuRecords: dlmuRecords.length, dlmuPlanCount: dlmuRecords.reduce((sum, record) => sum + Number(record.planCount || 0), 0) }, null, 2));
