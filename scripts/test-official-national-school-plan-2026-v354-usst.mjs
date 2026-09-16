#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importerFile = path.join(root, "scripts/import-official-national-school-plan-2026-v354-usst.mjs");
assert.ok(fs.existsSync(importerFile), "USST plan importer must exist");
const source = fs.readFileSync(importerFile, "utf8");
const instrumented = source
  .replace(/^import .*$/gm, "")
  .replace(/const PROJECT_ROOT = .*?;\n/, 'const PROJECT_ROOT = "/tmp";\n')
  .replace(/\nmain\(\)\.catch[\s\S]*$/m, "");
const context = vm.createContext({ console, Intl, Date, Set, Map, URL, crypto, fs, path });
vm.runInContext(`${instrumented}\nglobalThis.__usstTest = { subjectTypeFrom, classifyPlan, parsePlanTableRows, recordFromPlanRow, parseProvinceOptions, parseClassOptions };`, context, { filename: importerFile });
const api = context.__usstTest;

assert.equal(api.subjectTypeFrom("历史类"), "历史类");
assert.equal(api.subjectTypeFrom("物理类"), "物理类");
assert.equal(api.subjectTypeFrom("理工"), "物理类");
assert.equal(api.subjectTypeFrom("文史"), "历史类");
assert.equal(api.subjectTypeFrom("综合改革"), "综合改革");
assert.equal(api.subjectTypeFrom("艺术(不分科目类)"), "艺术类");

const ordinary = api.classifyPlan({ major: "工科试验班(智能化制造类)" });
assert.equal(ordinary.admissionType, "普通录取");
assert.equal(ordinary.formalScoreScope, "school-official-only");
const cooperation = api.classifyPlan({ major: "机械设计制造及其自动化(中英合作)" });
assert.equal(cooperation.admissionType, "中外合作办学");
assert.equal(cooperation.formalScoreScope, "special-path-only");
const national = api.classifyPlan({ major: "工科试验班(智能化制造类)", subjectRaw: "物理类", remark: "国家专项" });
assert.equal(national.admissionType, "国家专项");
assert.equal(national.formalScoreScope, "special-path-only");
const art = api.classifyPlan({ major: "设计学类", subjectRaw: "艺术(不分科目类)", remark: "艺考类(统考)" });
assert.equal(art.admissionType, "艺术类");
assert.equal(art.formalScoreScope, "special-path-only");

const sample = `
<table class="zstable"><tbody>
<tr><td>2026</td><td>江苏</td><td>物理类</td><td>工科试验班(智能化制造类)</td><td>具体包含专业详见招生章程</td><td>29</td><td></td></tr>
<tr><td>2026</td><td>江苏</td><td>物理类</td><td>机械设计制造及其自动化(中英合作)</td><td></td><td>2</td><td>学费另见章程&nbsp;</td></tr>
</tbody></table>`;
const rows = api.parsePlanTableRows(sample);
assert.equal(rows.length, 2);
assert.equal(rows[0].year, 2026);
assert.equal(rows[0].province, "江苏");
assert.equal(rows[0].subjectRaw, "物理类");
assert.equal(rows[0].major, "工科试验班(智能化制造类)");
assert.equal(rows[0].includedMajors, "具体包含专业详见招生章程");
assert.equal(rows[0].planCount, 29);
assert.equal(rows[0].remark, "");
assert.equal(rows[1].planCount, 2);
assert.equal(rows[1].remark, "学费另见章程");

const record = api.recordFromPlanRow(rows[1], { rawPath: "raw/plans.json" });
assert.equal(record.schoolCode, "10252");
assert.equal(record.schoolName, "上海理工大学");
assert.equal(record.province, "江苏");
assert.equal(record.subjectType, "物理类");
assert.equal(record.planCount, 2);
assert.equal(record.admissionType, "中外合作办学");
assert.equal(record.formalScoreScope, "special-path-only");
assert.match(record.planRemark, /学费另见章程/);
assert.equal(record.sourcePlanYear, 2026);
assert.equal(record.sourceMajorGroupRaw, undefined);

const nationalRecord = api.recordFromPlanRow({ ...rows[0], remark: "国家专项" }, { rawPath: "raw/plans.json" });
assert.equal(nationalRecord.admissionType, "国家专项");
assert.equal(nationalRecord.formalScoreScope, "special-path-only");

const provinceOptions = api.parseProvinceOptions(JSON.stringify([{ sf: "江苏" }, { sf: "西藏" }]));
assert.equal(JSON.stringify(provinceOptions), JSON.stringify(["江苏", "西藏"]));
const classOptions = api.parseClassOptions(JSON.stringify([{ kl: "物理类" }, { kl: "历史类" }]));
assert.equal(JSON.stringify(classOptions), JSON.stringify(["物理类", "历史类"]));

console.log(JSON.stringify({ status: "ok", rows: rows.length, ordinary: ordinary.formalScoreScope, cooperation: cooperation.formalScoreScope }, null, 2));
