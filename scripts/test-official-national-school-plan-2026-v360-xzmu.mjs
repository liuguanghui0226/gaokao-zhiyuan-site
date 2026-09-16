#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED,
  classifyPlan,
  parsePlanTableRows,
  subjectTypeFrom,
} from "./import-official-national-school-plan-2026-v360-xzmu.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importFile = path.join(root, "data/admissions/official-national-school-plan-2026-v360-xzmu-import.json");
assert.ok(fs.existsSync(importFile), "v3.360 import output must exist");
const imported = JSON.parse(fs.readFileSync(importFile, "utf8"));

assert.equal(imported.dataset, "official-xzmu-national-plan-2026-v3.360");
assert.equal(imported.records.length, EXPECTED.records);
const summary = { ...imported.summary };
delete summary.provinceBreakdown;
assert.deepEqual(summary, {
  rawRows: EXPECTED.rawRows,
  records: EXPECTED.records,
  rawPlanCount: EXPECTED.rawPlanCount,
  planCount: EXPECTED.planCount,
  duplicateRows: EXPECTED.duplicateRows,
  provinces: EXPECTED.provinces,
  ordinaryRecords: EXPECTED.ordinaryRecords,
  specialPathRecords: EXPECTED.specialPathRecords,
});
assert.equal(new Set(imported.records.map((record) => record.id)).size, imported.records.length);
assert.equal(new Set(imported.records.map((record) => record.province)).size, EXPECTED.provinces);
assert.ok(imported.records.every((record) => record.schoolCode === "10695" && record.year === 2026 && record.dataType === "admission-plan" && Number.isInteger(record.planCount) && record.planCount > 0));
assert.equal(imported.records.filter((record) => record.formalScoreScope === "school-official-only").length, EXPECTED.ordinaryRecords);
assert.equal(imported.records.filter((record) => record.formalScoreScope === "special-path-only").length, EXPECTED.specialPathRecords);
assert.ok(imported.records.some((record) => record.province === "西藏" && record.subjectType === "历史类"));
assert.ok(imported.records.some((record) => record.province === "西藏" && record.subjectType === "物理类"));
assert.ok(imported.records.some((record) => record.province === "广西" && record.subjectType === "历史类"));
assert.ok(imported.records.some((record) => record.province === "广西" && record.subjectType === "物理类"));
assert.ok(imported.records.some((record) => record.province === "山东" && record.subjectType === "综合改革"));
assert.ok(imported.records.some((record) => record.province === "西藏" && record.admissionType === "地方专项" && record.formalScoreScope === "special-path-only"));
assert.ok(imported.records.some((record) => record.province === "陕西" && record.majorName === "临床医学" && record.formalScoreScope === "school-official-only"));
assert.ok(imported.records.some((record) => record.majorName === "艺术教育(师范)" && record.formalScoreScope === "school-official-only"));
assert.ok(imported.records.some((record) => record.majorName === "播音与主持艺术" && record.admissionType === "艺术类" && record.formalScoreScope === "special-path-only"));
assert.ok(imported.records.some((record) => record.admissionType === "对口高职" && record.formalScoreScope === "special-path-only"));
assert.ok(imported.records.every((record) => record.sourceId === "official-xzmu-national-plan-2026" && record.sourcePageUrl && record.officialEvidencePath));

const provinceHeaders = ["西藏", "西藏", "陕西", "陕西", "山西", "山西", "河南", "河南", "云南", "云南", "四川", "四川", "甘肃", "甘肃", "广西", "广西", "山东", "河北", "河北", "湖南", "湖南", "湖北", "湖北", "重庆", "重庆", "江西", "江西", "安徽", "安徽", "江苏", "江苏", "浙江", "福建", "福建", "广东", "广东", "辽宁", "辽宁"];
const subjectHeaders = ["文科", "理科", "历史", "物理", "历史", "物理", "历史", "物理", "历史", "物理", "历史", "物理", "历史", "物理", "历史", "物理", "综合改革", "历史", "物理", "历史", "物理", "历史", "物理", "历史", "物理", "历史", "物理", "历史", "物理", "历史", "物理", "综合改革", "历史", "物理", "历史", "物理", "历史", "物理"];
const baseHeaders = ["序号", "学院", "招生专业(方向)", "校区", "层次", "学制", "合计"];
const fixtureRow = (cells) => `<tr>${cells.map((cell) => `<td>${cell ?? ""}</td>`).join("")}</tr>`;
const fixtureData = Array(47).fill("");
fixtureData[0] = "1";
fixtureData[1] = "学院";
fixtureData[2] = "测试专业";
fixtureData[3] = "秦汉";
fixtureData[4] = "本科";
fixtureData[5] = "四年";
fixtureData[6] = "81";
fixtureData[7] = "30";
fixtureData[8] = "40";
fixtureData[23] = "5";
fixtureData[38] = "6";
fixtureData[45] = "西藏一本招生";
fixtureData[46] = "免补";
const fixtureHtml = `<table>${fixtureRow([...baseHeaders, ...provinceHeaders, "备注", "学费（元/年）"])}${fixtureRow([...baseHeaders, ...subjectHeaders, "备注"])}${fixtureRow(fixtureData)}</table>`;
const parsed = parsePlanTableRows(fixtureHtml);
assert.equal(parsed.rawRows, 1);
assert.equal(parsed.records.length, 4);
assert.equal(parsed.planCount, 81);
assert.equal(parsed.provinces.length, 3);
assert.equal(imported.records[0].schoolName, "西藏民族大学");
assert.equal(parsed.rows[0].province, "西藏");
assert.equal(parsed.rows[0].subjectRaw, "文科");
assert.equal(parsed.rows[0].planCount, 30);

assert.equal(subjectTypeFrom("文科"), "历史类");
assert.equal(subjectTypeFrom("理科"), "物理类");
assert.equal(subjectTypeFrom("综合改革"), "综合改革");
assert.deepEqual(classifyPlan({ province: "西藏", majorName: "社会工作", subjectRaw: "文科", note: "西藏一本招生；部队生源计划35人（文）；地方专项计划20人（文）" }), {
  admissionType: "地方专项/部队生源",
  admissionSubtype: "西藏一本招生；部队生源计划35人（文）；地方专项计划20人（文）",
  formalScoreScope: "special-path-only",
});
assert.deepEqual(classifyPlan({ province: "陕西", majorName: "临床医学", subjectRaw: "物理", note: "西藏一本招生；地方专项计划20人（理）" }), {
  admissionType: "普通录取",
  admissionSubtype: "普通类",
  formalScoreScope: "school-official-only",
});

console.log(JSON.stringify({ status: "ok", version: imported.version, records: imported.records.length, provinces: imported.summary.provinces, planCount: imported.summary.planCount, ordinaryRecords: imported.summary.ordinaryRecords, specialPathRecords: imported.summary.specialPathRecords }, null, 2));
