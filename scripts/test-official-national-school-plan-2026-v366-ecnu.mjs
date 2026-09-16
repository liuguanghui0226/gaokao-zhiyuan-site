#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED,
  canonicalRowsSha256,
  classifyPlanType,
  descendantText,
  parsePlanTable,
} from "./import-official-national-school-plan-2026-v366-ecnu.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importFile = path.join(root, "data/admissions/official-national-school-plan-2026-v366-ecnu-import.json");
assert.ok(fs.existsSync(importFile), "ECNU v3.366 import output must exist");
const imported = JSON.parse(fs.readFileSync(importFile, "utf8"));
const source = imported.sourceNotes?.[0];

assert.equal(imported.version, "v3.366");
assert.equal(imported.dataset, "official-ecnu-national-plan-2026-v3.366");
assert.equal(source.id, "official-ecnu-national-plan-2026-html");
assert.equal(source.url, "https://xxgk.ecnu.edu.cn/b2/82/c29049a766594/page.htm");
assert.equal(source.charterUrl, "https://xxgk.ecnu.edu.cn/a3/52/c11816a762706/page.htm");
assert.equal(source.schoolCode, "10269");
assert.equal(source.schoolIdentifierCode, "4131010269");
assert.equal(source.rawRecords, EXPECTED.records);
assert.equal(source.records, EXPECTED.records);
assert.equal(source.rawPlanCount, EXPECTED.planCount);
assert.equal(source.planCount, EXPECTED.planCount);
assert.equal(source.invalidRows, 0);
assert.equal(source.duplicateRows, 0);
assert.equal(source.provinces, 31);
assert.equal(source.provinceCount, 31);
assert.equal(source.rawCorpusBytes, 1_298_540);
assert.equal(source.planPageBytes, 1_244_214);
assert.equal(source.charterPageBytes, 54_326);
assert.equal(source.planPageSha256, "fa465bdee163c1b25d8f6cb3277e39eed263c54045ed2c57e509b80c3f6c6f06");
assert.equal(source.charterPageSha256, "3728b33e05d282440bb05c272c35a7cfff02537663ba05c282e8ddc75b569cb3");
assert.equal(source.rawCorpusSha256, "7768cfe9e6e958e753ed31b63e1cac56f1ca35ffba8925db367aca82429dc81b");
assert.equal(source.canonicalPayloadSha256, "9946a7a9ed1a896b40847d617e9b814bdcb8796976a13641b0835f0c3f99c8af");
assert.deepEqual(source.rawPaths, [
  "data/admissions/raw/official-national-school-plan-2026-v366-ecnu/plan-page.html",
  "data/admissions/raw/official-national-school-plan-2026-v366-ecnu/charter-page.html",
]);
assert.match(source.cautions.join("；"), /普通类\(本科批\).*school-official-only/);
assert.match(source.cautions.join("；"), /普通类\(提前批\).*special-path-only/);
assert.match(source.cautions.join("；"), /强基计划.*不包含/);
assert.match(source.cautions.join("；"), /省级招生考试机构/);

assert.deepEqual(imported.summary, {
  records: 1244,
  planCount: 3661,
  rawRecords: 1244,
  rawPlanCount: 3661,
  duplicateRows: 0,
  invalidRows: 0,
  provinces: 31,
  ordinaryRecords: 519,
  ordinaryPlanCount: 1791,
  specialPathRecords: 725,
  specialPlanCount: 1870,
  typeBreakdown: EXPECTED.typeBreakdown,
});

assert.equal(imported.records.length, 1244);
assert.equal(new Set(imported.records.map((record) => record.id)).size, 1244);
assert.equal(new Set(imported.records.map((record) => record.province)).size, 31);
assert.equal(imported.records.reduce((sum, record) => sum + record.planCount, 0), 3661);
assert.ok(imported.records.every((record) => record.schoolName === "华东师范大学" && record.schoolCode === "10269" && record.schoolIdentifierCode === "4131010269" && record.year === 2026 && record.dataType === "admission-plan"));
assert.equal(imported.records.filter((record) => record.formalScoreScope === "school-official-only").length, 519);
assert.equal(imported.records.filter((record) => record.formalScoreScope === "school-official-only").reduce((sum, record) => sum + record.planCount, 0), 1791);
assert.equal(imported.records.filter((record) => record.formalScoreScope === "special-path-only").length, 725);
assert.equal(imported.records.filter((record) => record.formalScoreScope === "special-path-only").reduce((sum, record) => sum + record.planCount, 0), 1870);
assert.ok(imported.records.every((record) => record.sourceId === source.id && record.sourcePageUrl === source.url && record.officialEvidencePath && record.officialCharterEvidencePath));

assert.deepEqual(source.typeBreakdown["普通类(本科批)"], { records: 519, planCount: 1791 });
assert.deepEqual(source.typeBreakdown["普通类(提前批)"], { records: 208, planCount: 754 });
assert.deepEqual(source.typeBreakdown["高校专项"], { records: 141, planCount: 193 });
assert.deepEqual(source.typeBreakdown["国家专项"], { records: 107, planCount: 240 });
assert.deepEqual(source.typeBreakdown["国家优师专项"], { records: 77, planCount: 150 });
assert.deepEqual(source.typeBreakdown["艺考类"], { records: 57, planCount: 194 });
assert.deepEqual(source.typeBreakdown["民族班"], { records: 37, planCount: 46 });
assert.deepEqual(source.typeBreakdown["综合评价"], { records: 33, planCount: 141 });
assert.deepEqual(source.typeBreakdown["体育类"], { records: 32, planCount: 92 });
assert.deepEqual(source.typeBreakdown["内地西藏班"], { records: 16, planCount: 31 });
assert.deepEqual(source.typeBreakdown["内地新疆班"], { records: 15, planCount: 27 });
assert.deepEqual(source.typeBreakdown["南疆计划"], { records: 2, planCount: 2 });

const province = (name) => source.provinceBreakdown.find((entry) => entry.province === name);
assert.deepEqual(province("北京"), { province: "北京", records: 13, planCount: 31, ordinaryRecords: 12, specialPathRecords: 1 });
assert.deepEqual(province("上海"), { province: "上海", records: 95, planCount: 627, ordinaryRecords: 41, specialPathRecords: 54 });
assert.deepEqual(province("西藏"), { province: "西藏", records: 39, planCount: 62, ordinaryRecords: 0, specialPathRecords: 39 });
assert.deepEqual(province("新疆"), { province: "新疆", records: 63, planCount: 111, ordinaryRecords: 7, specialPathRecords: 56 });

assert.ok(imported.records.some((record) => record.province === "北京" && record.sourcePlanCategoryRaw === "普通类(本科批)" && record.majorName === "汉语言文学" && record.sourceProfessionalGroupRaw === "不限" && record.planCount === 2 && record.formalScoreScope === "school-official-only"));
assert.ok(imported.records.some((record) => record.province === "北京" && record.sourcePlanCategoryRaw === "艺考类" && record.majorName === "设计学类" && record.sourceProfessionalGroupRaw === "" && record.electiveRequirement === undefined && record.planCount === 3 && record.formalScoreScope === "special-path-only"));
assert.ok(imported.records.some((record) => record.province === "河北" && record.sourcePlanCategoryRaw === "普通类(提前批)" && record.sourceMajorRaw === "数学与应用数学（公费师范）" && record.admissionType === "提前批" && record.formalScoreScope === "special-path-only"));
assert.ok(imported.records.some((record) => record.province === "新疆" && record.sourcePlanCategoryRaw === "南疆计划" && record.majorName === "社会学类" && record.planCount === 1 && record.formalScoreScope === "special-path-only"));
assert.ok(imported.records.filter((record) => record.province === "西藏").every((record) => record.formalScoreScope === "special-path-only"));

const fixture = `
  <table><tbody>
    <tr><td><strong>省份</strong></td><td>计划类别</td><td>招生专业</td><td>科类</td><td>专业组</td><td>招生计划</td></tr>
    <tr><td>北京</td><td><span>普通类</span><span>(</span><span>本科批</span><span>)</span></td><td>汉语言文学</td><td>综合改革</td><td>不限</td><td>2</td></tr>
    <tr><td>北京</td><td>艺考类</td><td>设计学类</td><td>综合改革</td><td><br /></td><td>3</td></tr>
  </tbody></table>`;
assert.equal(descendantText("<span>普通类</span><span>(</span><span>本科批</span><span>)</span>"), "普通类(本科批)");
const parsedFixture = parsePlanTable(fixture);
assert.equal(parsedFixture.invalidRows, 0);
assert.deepEqual(parsedFixture.rows, [
  { province: "北京", planType: "普通类(本科批)", major: "汉语言文学", subject: "综合改革", elective: "不限", plan: 2 },
  { province: "北京", planType: "艺考类", major: "设计学类", subject: "综合改革", elective: "", plan: 3 },
]);
assert.deepEqual(classifyPlanType("普通类(本科批)"), { admissionType: "普通录取", admissionSubtype: "普通类(本科批)", formalScoreScope: "school-official-only" });
assert.deepEqual(classifyPlanType("普通类(提前批)"), { admissionType: "提前批", admissionSubtype: "普通类(提前批)", formalScoreScope: "special-path-only" });
assert.deepEqual(classifyPlanType("艺考类"), { admissionType: "艺术类", admissionSubtype: "艺考类", formalScoreScope: "special-path-only" });
assert.equal(canonicalRowsSha256(parsedFixture.rows), "30440240626893940d90390bdbc6a465912d7b239000e2a3076ab52ae1abd25a");

console.log(JSON.stringify({ status: "ok", version: imported.version, records: imported.records.length, provinces: imported.summary.provinces, planCount: imported.summary.planCount, ordinaryRecords: imported.summary.ordinaryRecords, specialPathRecords: imported.summary.specialPathRecords }, null, 2));
