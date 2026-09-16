#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importerFile = path.join(root, "scripts/import-official-national-school-plan-2026-v355-qlu.mjs");
assert.ok(fs.existsSync(importerFile), "QLU plan importer must exist");
const source = fs.readFileSync(importerFile, "utf8");
const instrumented = source
  .replace(/^import .*$/gm, "")
  .replace(/const PROJECT_ROOT = .*?;\n/, 'const PROJECT_ROOT = "/tmp";\n')
  .replace(/\nmain\(\)\.catch[\s\S]*$/m, "");
const context = vm.createContext({ console, Intl, Date, Set, Map, URL, crypto, fs, path });
vm.runInContext(`${instrumented}\nglobalThis.__qluTest = { subjectTypeFrom, electiveRequirementFrom, classifyPlan, parseProvinceOptions, parsePlanRows, recordFromPlanRow };`, context, { filename: importerFile });
const api = context.__qluTest;

assert.equal(api.subjectTypeFrom("物理类"), "物理类");
assert.equal(api.subjectTypeFrom("理工类"), "物理类");
assert.equal(api.subjectTypeFrom("文史类"), "历史类");
assert.equal(api.subjectTypeFrom("综合改革"), "综合改革");
assert.equal(api.subjectTypeFrom("艺术(不分科目类)"), "艺术类");
assert.equal(api.subjectTypeFrom("体育(不分文理)"), "体育类");
assert.equal(api.electiveRequirementFrom("物理和化学"), "物理，化学");
assert.equal(api.electiveRequirementFrom("物理和化学和生物"), "物理，化学，生物");
assert.equal(api.electiveRequirementFrom("不提科目要求"), "不提科目要求");
assert.equal(api.electiveRequirementFrom("——"), undefined);

const ordinary = api.classifyPlan({ categoryName: "物理类", typeName: "普通类", batch: "普通本科批", major: "人工智能" });
assert.equal(ordinary.admissionType, "普通录取");
assert.equal(ordinary.formalScoreScope, "school-official-only");
const localSpecial = api.classifyPlan({ categoryName: "综合改革", typeName: "地方专项", batch: "地方专项计划", major: "人工智能(地方专项计划)" });
assert.equal(localSpecial.admissionType, "地方专项");
assert.equal(localSpecial.formalScoreScope, "special-path-only");
const art = api.classifyPlan({ categoryName: "艺术(不分科目类)", typeName: "艺考类", batch: "艺术类本科批", major: "视觉传达设计" });
assert.equal(art.admissionType, "艺术类");
assert.equal(art.formalScoreScope, "special-path-only");
const sports = api.classifyPlan({ categoryName: "体育(不分文理)", typeName: "普通类", batch: "体育(不分文理)", major: "电子竞技运动与管理" });
assert.equal(sports.admissionType, "体育类");
assert.equal(sports.formalScoreScope, "special-path-only");
const heze = api.classifyPlan({ categoryName: "物理类", typeName: "菏泽校区", batch: "普通类本科批", major: "人工智能(菏泽校区)" });
assert.equal(heze.admissionType, "菏泽校区");
assert.equal(heze.formalScoreScope, "special-path-only");

const samplePage = '<ul class="province-box-ul"><li data-id="11">北京</li><li data-id="63">青海</li><li data-id="710000">台湾</li></ul><ul><li data-id="3651">2026</li></ul>';
const provinces = api.parseProvinceOptions(samplePage);
assert.equal(JSON.stringify(provinces), JSON.stringify([{ id: "11", name: "北京" }, { id: "63", name: "青海" }]));

const rows = api.parsePlanRows({ data: [{
  province_name: "山东",
  major_name: "材料类(地方专项计划)",
  majors_included: "无机非金属材料工程、高分子材料与工程",
  category_name: "综合改革",
  type_name: "地方专项",
  batch: "地方专项计划",
  scheduled_count: "30",
  elective_subjects: "物理和化学",
}], sourceProvinceId: "37", sourceYearId: "3651", sourceCategoryId: "3654", sourceTypeId: "3656" });
assert.equal(rows.length, 1);
assert.equal(rows[0].planCount, 30);
assert.equal(rows[0].province, "山东");
assert.equal(rows[0].sourceTypeId, "3656");

const record = api.recordFromPlanRow(rows[0], { rawPath: "raw/api-snapshot.json" });
assert.equal(record.schoolCode, "10431");
assert.equal(record.schoolName, "齐鲁工业大学");
assert.equal(record.admissionType, "地方专项");
assert.equal(record.formalScoreScope, "special-path-only");
assert.equal(record.batch, "地方专项计划");
assert.equal(record.electiveRequirement, "物理，化学");
assert.equal(record.planCount, 30);
assert.match(record.sourceMajorGroupRaw, /无机非金属/);
assert.match(record.planRemark, /地方专项/);

console.log(JSON.stringify({ status: "ok", parsedRows: rows.length, ordinary: ordinary.formalScoreScope, localSpecial: localSpecial.formalScoreScope, art: art.formalScoreScope }, null, 2));
