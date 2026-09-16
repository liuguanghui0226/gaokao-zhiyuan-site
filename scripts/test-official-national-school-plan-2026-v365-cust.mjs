#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED,
  canonicalRowsSha256,
  classifyPlanRow,
  descendantText,
  parsePlanIndexLinks,
  parsePlanPage,
} from "./import-official-national-school-plan-2026-v365-cust.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importFile = path.join(root, "data/admissions/official-national-school-plan-2026-v365-cust-import.json");
assert.ok(fs.existsSync(importFile), "CUST v3.365 import output must exist");
const imported = JSON.parse(fs.readFileSync(importFile, "utf8"));
const source = imported.sourceNotes?.[0];

assert.equal(imported.version, "v3.365");
assert.equal(imported.dataset, "official-cust-national-plan-2026-v3.365");
assert.equal(source.id, "official-cust-national-plan-2026-html");
assert.equal(source.url, "https://zsb.cust.edu.cn/gszsjhcx/sc_1/2026/index.htm");
assert.equal(source.schoolCode, "10186");
assert.equal(source.schoolIdentifierCode, "4122010186");
assert.equal(source.rawRecords, EXPECTED.records);
assert.equal(source.records, EXPECTED.records);
assert.equal(source.rawPlanCount, EXPECTED.planCount);
assert.equal(source.planCount, EXPECTED.planCount);
assert.equal(source.invalidRows, 0);
assert.equal(source.duplicateRows, 0);
assert.equal(source.provinces, 31);
assert.equal(source.provinceCount, 31);
assert.equal(source.pageCount, 31);
assert.equal(source.fourColumnPageCount, 29);
assert.equal(source.threeColumnPageCount, 2);
assert.equal(source.rawCorpusBytes, 2_871_445);
assert.equal(source.rawCorpusSha256, "b6759cdc4a4feee1970a3f25b7ebf131b0a15a17139e61cd23d78f15a1a6e0ac");
assert.equal(source.canonicalPayloadSha256, "d7062daa30920c4d17101e0cb598dc05cdd5276f4193f516839862c81a35a0fe");
assert.equal(source.rawPaths.length, 33);
assert.ok(source.rawPaths.every((relativePath) => fs.existsSync(path.join(root, relativePath))), "all 31 pages plus index and charter must be cached");
assert.match(source.cautions.join("；"), /西藏和新疆.*三列/);
assert.match(source.cautions.join("；"), /设计学类.*艺术/);
assert.match(source.cautions.join("；"), /各省.*招生办公室公布/);

assert.deepEqual(imported.summary, {
  records: 1283,
  planCount: 5132,
  rawRecords: 1283,
  rawPlanCount: 5132,
  duplicateRows: 0,
  invalidRows: 0,
  provinces: 31,
  ordinaryRecords: 1035,
  ordinaryPlanCount: 4075,
  specialPathRecords: 248,
  specialPlanCount: 1057,
  fourColumnPageCount: 29,
  threeColumnPageCount: 2,
  typeBreakdown: EXPECTED.typeBreakdown,
});

assert.equal(imported.records.length, 1283);
assert.equal(new Set(imported.records.map((record) => record.id)).size, 1283);
assert.equal(new Set(imported.records.map((record) => record.province)).size, 31);
assert.equal(imported.records.reduce((sum, record) => sum + record.planCount, 0), 5132);
assert.ok(imported.records.every((record) => record.schoolCode === "10186" && record.schoolIdentifierCode === "4122010186" && record.year === 2026 && record.dataType === "admission-plan"));
assert.equal(imported.records.filter((record) => record.formalScoreScope === "school-official-only").length, 1035);
assert.equal(imported.records.filter((record) => record.formalScoreScope === "school-official-only").reduce((sum, record) => sum + record.planCount, 0), 4075);
assert.equal(imported.records.filter((record) => record.formalScoreScope === "special-path-only").length, 248);
assert.equal(imported.records.filter((record) => record.formalScoreScope === "special-path-only").reduce((sum, record) => sum + record.planCount, 0), 1057);
assert.ok(imported.records.every((record) => record.sourceId === source.id && record.sourcePageUrl && record.sourceIndexUrl && record.officialEvidencePath && record.officialCharterEvidencePath));

assert.equal(source.typeBreakdown["普通类"].records, 1035);
assert.equal(source.typeBreakdown["普通类"].planCount, 4075);
assert.deepEqual(source.typeBreakdown["中外合作办学"], { records: 101, planCount: 600 });
assert.deepEqual(source.typeBreakdown["国家专项"], { records: 96, planCount: 221 });
assert.deepEqual(source.typeBreakdown["艺术类（设计学类）"], { records: 16, planCount: 110 });
assert.deepEqual(source.typeBreakdown["少数民族预科"], { records: 14, planCount: 58 });
assert.deepEqual(source.typeBreakdown["新疆班"], { records: 11, planCount: 22 });
assert.deepEqual(source.typeBreakdown["高职分类/对口升学"], { records: 5, planCount: 35 });
assert.deepEqual(source.typeBreakdown["对口支援新疆阿勒泰计划"], { records: 3, planCount: 8 });
assert.deepEqual(source.typeBreakdown["南疆计划"], { records: 2, planCount: 3 });

const province = (name) => source.provinceBreakdown.find((entry) => entry.province === name);
assert.deepEqual(province("河南"), { province: "河南", sourceProvinceLabel: "河南省", slug: "hn_1", columns: 4, records: 60, planCount: 195 });
assert.deepEqual(province("西藏"), { province: "西藏", sourceProvinceLabel: "西藏自治区", slug: "xz_1", columns: 3, records: 6, planCount: 20 });
assert.deepEqual(province("新疆"), { province: "新疆", sourceProvinceLabel: "新疆维吾尔自治区", slug: "xj_1", columns: 3, records: 53, planCount: 143 });
assert.equal(imported.records.filter((record) => record.province === "西藏").length, 6);
assert.equal(imported.records.filter((record) => record.province === "新疆").length, 53);
assert.ok(imported.records.filter((record) => ["西藏", "新疆"].includes(record.province)).every((record) => record.sourceElectiveRaw === "" && record.electiveRequirement === undefined));
assert.ok(imported.records.some((record) => record.province === "吉林" && record.sourceMajorRaw === "电子信息工程(对口)" && record.admissionType === "高职分类/对口升学" && record.planCount === 12));
assert.ok(imported.records.some((record) => record.province === "新疆" && record.sourceMajorRaw.includes("对口支援新疆阿勒泰计划") && record.admissionType === "对口支援新疆阿勒泰计划"));
assert.ok(imported.records.some((record) => record.province === "河南" && record.sourceMajorRaw === "设计学类" && record.admissionType === "艺术类" && record.formalScoreScope === "special-path-only"));
assert.ok(imported.records.some((record) => record.sourceElectiveRaw === "不提科目要求不提科目要求" && record.electiveRequirement === "不提科目要求"));

const indexFixture = `
  <a href="../../bj_1/2026/"><span>北京市</span></a>
  <a href="../../hn_1/2026/"><span>河南</span><span>省</span></a>
`;
assert.deepEqual(parsePlanIndexLinks(indexFixture), [
  { province: "北京", sourceProvinceLabel: "北京市", slug: "bj_1", url: "https://zsb.cust.edu.cn/gszsjhcx/bj_1/2026/index.htm" },
  { province: "河南", sourceProvinceLabel: "河南省", slug: "hn_1", url: "https://zsb.cust.edu.cn/gszsjhcx/hn_1/2026/index.htm" },
]);
assert.equal(descendantText("<p><span>科类名</span><span>称</span></p>"), "科类名称");
assert.equal(descendantText("<p><span>招生</span></p><p><span>计划</span></p>"), "招生计划");

const fourColumnFixture = `
  <table><tbody>
    <tr><td><span>专业（类）</span></td><td><span>科类名</span><span>称</span></td><td>选考科目要求</td><td><span>招生</span><span>计划</span></td></tr>
    <tr><td><span>设计学类</span></td><td>历史类</td><td><span>不提科目要求</span><span>不提科目要求</span></td><td>2</td></tr>
  </tbody></table>`;
assert.deepEqual(parsePlanPage(fourColumnFixture, { province: "河南", sourceProvinceLabel: "河南省", slug: "hn_1", url: "https://zsb.cust.edu.cn/gszsjhcx/hn_1/2026/index.htm" }), {
  columns: 4,
  invalidRows: 0,
  rows: [{ province: "河南", sourceProvinceLabel: "河南省", major: "设计学类", subject: "历史类", elective: "不提科目要求不提科目要求", plan: 2, sourceUrl: "https://zsb.cust.edu.cn/gszsjhcx/hn_1/2026/index.htm", planType: "艺术类（设计学类）" }],
});

const threeColumnFixture = `
  <table><tbody>
    <tr><td>专业（类）</td><td>科类名称</td><td><span>招生</span><span>计划</span></td></tr>
    <tr><td>汉语言文学(南疆计划)</td><td>文史</td><td>1</td></tr>
  </tbody></table>`;
const legacy = parsePlanPage(threeColumnFixture, { province: "新疆", sourceProvinceLabel: "新疆维吾尔自治区", slug: "xj_1", url: "https://zsb.cust.edu.cn/gszsjhcx/xj_1/2026/index.htm" });
assert.equal(legacy.columns, 3);
assert.equal(legacy.rows[0].elective, "");
assert.equal(legacy.rows[0].planType, "南疆计划");
assert.deepEqual(classifyPlanRow("国际经济与贸易", "物理类"), { planType: "普通类", admissionType: "普通录取", formalScoreScope: "school-official-only" });
assert.deepEqual(classifyPlanRow("电子信息工程(对口)", "电子与信息类"), { planType: "高职分类/对口升学", admissionType: "高职分类/对口升学", formalScoreScope: "special-path-only" });
assert.equal(canonicalRowsSha256(legacy.rows), "fa789cb9e9c64e4b17c54c47dd1be2f81e8798524fdd8a9375d01e8d90b905a4");

console.log(JSON.stringify({ status: "ok", version: imported.version, records: imported.records.length, provinces: imported.summary.provinces, planCount: imported.summary.planCount, ordinaryRecords: imported.summary.ordinaryRecords, specialPathRecords: imported.summary.specialPathRecords }, null, 2));
