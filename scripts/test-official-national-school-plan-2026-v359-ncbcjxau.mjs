#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED,
  classifyPlan,
  parsePlanTableRows,
  recordFromPlanRow,
  subjectTypeFrom,
} from "./import-official-national-school-plan-2026-v359-ncbcjxau.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importFile = path.join(root, "data/admissions/official-national-school-plan-2026-v359-ncbcjxau-import.json");
assert.ok(fs.existsSync(importFile), "v3.359 import output must exist");
const imported = JSON.parse(fs.readFileSync(importFile, "utf8"));

assert.equal(imported.dataset, "official-ncbcjxau-national-plan-2026-v3.359");
assert.equal(imported.records.length, EXPECTED.records);
assert.equal(imported.summary.rawRows, EXPECTED.rawRows);
assert.equal(imported.summary.planCount, EXPECTED.planCount);
assert.equal(imported.summary.provinces, EXPECTED.provinces);
assert.equal(imported.summary.ordinaryRecords, EXPECTED.ordinaryRecords);
assert.equal(imported.summary.specialPathRecords, EXPECTED.specialPathRecords);
assert.equal(new Set(imported.records.map((record) => record.id)).size, imported.records.length);
assert.equal(new Set(imported.records.map((record) => record.province)).size, EXPECTED.provinces);
assert.equal(imported.records.filter((record) => record.formalScoreScope === "school-official-only").length, EXPECTED.ordinaryRecords);
assert.equal(imported.records.filter((record) => record.formalScoreScope === "special-path-only").length, EXPECTED.specialPathRecords);
assert.ok(imported.records.every((record) => record.schoolCode === "13436" && record.year === 2026 && record.dataType === "admission-plan" && Number.isInteger(record.planCount) && record.planCount > 0));
assert.ok(imported.records.some((record) => record.province === "不分省" && record.formalScoreScope === "school-official-only"));
assert.ok(imported.records.some((record) => record.province === "江西" && record.majorName === "国际经济与贸易"));
assert.ok(imported.records.some((record) => record.subjectType === "艺术类" && record.formalScoreScope === "special-path-only"));
assert.ok(imported.records.every((record) => record.sourceId === "official-ncbcjxau-national-plan-2026" && record.sourcePageUrl && record.officialEvidencePath));

assert.equal(subjectTypeFrom("理工/物理类"), "物理类");
assert.equal(subjectTypeFrom("艺术(不分文理)"), "艺术类");
assert.deepEqual(classifyPlan({ subjectRaw: "艺术(历史类)", batch: "艺术类本科省考批" }), {
  admissionType: "艺术类",
  admissionSubtype: "艺术类本科省考批",
  formalScoreScope: "special-path-only",
});
assert.deepEqual(classifyPlan({ subjectRaw: "物理类", batch: "普通本科批" }), {
  admissionType: "普通录取",
  admissionSubtype: "普通类",
  formalScoreScope: "school-official-only",
});

const fixture = `<table><tr><td>招生省份</td><td>招生专业</td><td>科类</td><td>批次</td><td>考试科目要求</td><td>招生计划</td></tr><tr><td>江西</td><td>计算机科学与技术</td><td>物理类</td><td>本科批</td><td>物理,化学</td><td>12&nbsp;</td></tr></table>`;
assert.deepEqual(parsePlanTableRows(fixture), [{
  province: "江西",
  majorName: "计算机科学与技术",
  subjectRaw: "物理类",
  batch: "本科批",
  examRequirement: "物理,化学",
  planCount: 12,
}]);
const record = recordFromPlanRow(parsePlanTableRows(fixture)[0], { evidencePath: "fixture.html" });
assert.equal(record.province, "江西");
assert.equal(record.planCount, 12);
assert.equal(record.subjectType, "物理类");
assert.equal(record.formalScoreScope, "school-official-only");
assert.equal(record.officialEvidencePath, "fixture.html");

console.log(JSON.stringify({
  status: "ok",
  version: imported.version,
  records: imported.records.length,
  provinces: imported.summary.provinces,
  planCount: imported.summary.planCount,
  ordinaryRecords: imported.summary.ordinaryRecords,
  specialPathRecords: imported.summary.specialPathRecords,
}, null, 2));
