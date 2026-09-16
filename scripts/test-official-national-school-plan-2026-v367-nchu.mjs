#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED,
  canonicalRowsSha256,
  classifyPlan,
  parseProvincePayload,
  subjectTypeFrom,
} from "./import-official-national-school-plan-2026-v367-nchu.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importFile = path.join(root, "data/admissions/official-national-school-plan-2026-v367-nchu-import.json");
assert.ok(fs.existsSync(importFile), "NCHU v3.367 tracked import must exist");
const imported = JSON.parse(fs.readFileSync(importFile, "utf8"));
const source = imported.sourceNotes?.[0];

assert.equal(imported.version, "v3.367");
assert.equal(imported.dataset, "official-nchu-national-plan-2026-v3.367");
assert.equal(source.id, "official-nchu-national-plan-2026-api");
assert.equal(source.url, "https://zsw.nchu.edu.cn/index.php?sys=home&module=school_zsjh");
assert.equal(source.articleUrl, "https://zsw.nchu.edu.cn/index.php?sys=home&module=article&param=48&act=view&article_id=e9NxGAyJGZMp");
assert.equal(source.publishedDate, "2026-06-18");
assert.equal(source.schoolCode, "10406");
assert.equal(source.schoolIdentifierCode, "4136010406");
assert.equal(source.schoolName, "南昌航空大学");
assert.equal(source.apiRequests, 31);
assert.equal(source.apiResponseBytes, 1_654_541);
assert.equal(source.apiCorpusSha256, "4bdc52c4dfb1a2a3b54b69a18e5814bf47104c4911f4e5e3f688249b94025c97");
assert.equal(source.planScriptSha256, "e51b23b189902611295795ff07a8479a6c69d15e05972fc4090331f463ecd702");
assert.equal(source.canonicalPlanPageSha256, "793736e03b3298374a5beb664facfa0e3c66ab9885f1eb7e00db08ce50f9c815");
assert.equal(source.canonicalArticlePageSha256, "063b9a66d514ec5bce662364572f55eb5e6e7ff834842cabb40a0724c4ceac02");
assert.equal(source.stableEvidenceCorpusSha256, "59e06548fcf9af9ad86c69138a4fb714bfe46ed4a89111cc698c7e24d3f71006");
assert.equal(source.canonicalPayloadSha256, "46446617f346820661fe9ce11c91504f692e4d16bb3b4e277dcbaacacd29950b");
assert.deepEqual(source.emptyProvinces, ["西藏", "宁夏"]);
assert.equal(source.provinceResponses.length, 31);
assert.deepEqual(source.provinceResponses.find((item) => item.province === "江西"), {
  province: "江西",
  slug: "jiangxi",
  records: 131,
  planCount: 4108,
  bytes: 175171,
  sha256: "be19820a811b83efc8011ed6f05f68c8e9ca98e1069eb001485f7fa869ef202c",
});
assert.deepEqual(source.provinceResponses.find((item) => item.province === "西藏"), {
  province: "西藏",
  slug: "xizang",
  records: 0,
  planCount: 0,
  bytes: 4601,
  sha256: "e5310fa5190091b2da992211d0aedfa6e08ecee8bae0a239ad74227773bf8dbd",
});

assert.deepEqual(imported.summary, {
  records: 1092,
  planCount: 6988,
  rawRecords: 1092,
  rawPlanCount: 6988,
  duplicateRows: 0,
  invalidRows: 0,
  requestedProvinces: 31,
  provinces: 29,
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
assert.equal(imported.records.length, EXPECTED.records);
assert.equal(new Set(imported.records.map((record) => record.id)).size, EXPECTED.records);
assert.equal(new Set(imported.records.map((record) => record.sourceRowId)).size, EXPECTED.records);
assert.equal(imported.records.reduce((sum, record) => sum + record.planCount, 0), EXPECTED.planCount);
assert.equal(new Set(imported.records.map((record) => record.province)).size, EXPECTED.provinces);
assert.ok(imported.records.every((record) => record.schoolName === "南昌航空大学" && record.schoolCode === "10406" && record.schoolIdentifierCode === "4136010406"));
assert.ok(imported.records.every((record) => record.year === 2026 && record.sourcePlanYear === 2026 && record.dataType === "admission-plan" && Number.isInteger(record.planCount) && record.planCount > 0));
assert.equal(imported.records.filter((record) => record.formalScoreScope === "school-official-only").length, 913);
assert.equal(imported.records.filter((record) => record.formalScoreScope === "special-path-only").length, 179);
assert.equal(imported.records.filter((record) => record.province === "江西").reduce((sum, record) => sum + record.planCount, 0), 4108);
assert.ok(!imported.records.some((record) => ["西藏", "宁夏"].includes(record.province)));

const ordinary = imported.records.find((record) => record.sourceRowId === "29377");
assert.deepEqual({ province: ordinary.province, majorName: ordinary.majorName, majorGroup: ordinary.majorGroup, subjectType: ordinary.subjectType, planCount: ordinary.planCount, scope: ordinary.formalScoreScope }, {
  province: "江西", majorName: "英语", majorGroup: "101", subjectType: "历史类", planCount: 60, scope: "school-official-only",
});
assert.equal(ordinary.sourceProfessionalGroupRaw, "101");
assert.equal(ordinary.electiveRequirement, undefined);
const cooperation = imported.records.find((record) => record.sourceRowId === "29370");
assert.equal(cooperation.admissionType, "中外合作办学");
assert.equal(cooperation.planCount, 56);
assert.equal(cooperation.formalScoreScope, "special-path-only");
const flight = imported.records.find((record) => record.sourceRowId === "29365");
assert.equal(flight.admissionType, "提前批");
assert.equal(flight.formalScoreScope, "special-path-only");
const sports = imported.records.find((record) => record.sourceRowId === "29453");
assert.equal(sports.admissionType, "体育类");
assert.equal(sports.subjectType, "体育类");
const national = imported.records.find((record) => record.sourceRowId === "29426");
assert.equal(national.admissionType, "国家专项");
assert.equal(national.sourceDirectionRaw, "航空维修工程与技术");

assert.equal(subjectTypeFrom("艺术(历史类)"), "艺术类");
assert.equal(subjectTypeFrom("体育(物理类)"), "体育类");
assert.equal(subjectTypeFrom("理工/物理类"), "物理类");
assert.equal(subjectTypeFrom("文史/历史类"), "历史类");
assert.equal(subjectTypeFrom("综合改革"), "综合改革");
assert.deepEqual(classifyPlan({ planCategory: "普通类", batch: "本科普通批", subject: "综合改革", major: "经济学", remark: "" }), {
  planType: "普通类", admissionType: "普通录取", admissionSubtype: "普通类", formalScoreScope: "school-official-only",
});
assert.equal(classifyPlan({ planCategory: "普通类", batch: "本科", subject: "物理类", major: "人工智能(中外合作办学)", remark: "" }).admissionType, "中外合作办学");
assert.equal(classifyPlan({ planCategory: "普通类", batch: "本科", subject: "体育(不分科目类", major: "社会体育指导与管理", remark: "" }).admissionType, "体育类");
assert.equal(classifyPlan({ planCategory: "普通类", batch: "提前本科", subject: "物理类", major: "飞行技术", remark: "民航招飞" }).admissionType, "提前批");

const fixturePayload = {
  countpage: " 共 <b>1</b> 条信息，每页显示 <b>500</b> 条，共 <b>1</b> 页",
  records_block: [{
    ID: "29377", ND: "2026", SFMC: "江西", PCMC: "本科", KLMC: "历史类", ZYMC: "英语", CCMC: "本科", ZYZ: "101",
    KSLXMC: "", ZKFX: "", isSF: "否", JHXZ: "非定向", JHLB: "普通类", XZ: "四年", JHS: "60", XFBZ: "", BZ: "前湖校区",
  }],
};
const fixtureRows = parseProvincePayload(fixturePayload, "江西");
assert.equal(fixtureRows.length, 1);
assert.deepEqual(fixtureRows[0], {
  sourceRowId: "29377", year: 2026, province: "江西", batch: "本科", subject: "历史类", major: "英语", educationLevel: "本科",
  professionalGroup: "101", examType: "", direction: "", teacherTraining: "否", planNature: "非定向", planCategory: "普通类",
  duration: "四年", planCount: 60, tuition: "", remark: "前湖校区",
});
assert.match(canonicalRowsSha256(fixtureRows), /^[0-9a-f]{64}$/);
assert.throws(() => parseProvincePayload({ ...fixturePayload, countpage: " 共 <b>2</b> 条信息" }, "江西"), /declared 2 rows but returned 1/);

console.log(JSON.stringify({ status: "ok", version: imported.version, records: imported.records.length, provinces: imported.summary.provinces, planCount: imported.summary.planCount, ordinaryRecords: imported.summary.ordinaryRecords, specialPathRecords: imported.summary.specialPathRecords }, null, 2));
