#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importerFile = path.join(root, "scripts/import-official-national-school-plan-2026-v351-xmu.mjs");
assert.ok(fs.existsSync(importerFile), "Xiamen University plan importer must exist");
const source = fs.readFileSync(importerFile, "utf8");
const mainIndex = source.lastIndexOf("\nmain().catch");
assert.ok(mainIndex >= 0, "could not isolate importer main call");
const importerSource = source
  .replace(/^import .*$/gm, "")
  .replace(/const PROJECT_ROOT = .*?;\n/, 'const PROJECT_ROOT = "/tmp";\n');
const instrumented = `${importerSource.slice(0, importerSource.lastIndexOf("\nmain().catch"))}
globalThis.__xmuTest = {
  normalizeProvince,
  subjectTypeFrom,
  classifyPlan,
  recordFromPlanRow,
};`;
const context = vm.createContext({ console, Intl, Date, Set, Map, URL, crypto, fs, path });
vm.runInContext(instrumented, context, { filename: importerFile });
const api = context.__xmuTest;

assert.equal(api.normalizeProvince("内蒙古自治区"), "内蒙古");
assert.equal(api.normalizeProvince("广西壮族自治区"), "广西");
assert.equal(api.subjectTypeFrom("物理类"), "物理类");
assert.equal(api.subjectTypeFrom("艺术(不分文理)"), "艺术类");
assert.equal(api.subjectTypeFrom("文史"), "历史类");

const ordinary = api.classifyPlan({
  zslb: "普通类",
  pcmc: "本科普通批",
  klmc: "物理类",
});
assert.equal(ordinary.batch, "本科普通批");
assert.equal(ordinary.admissionType, "普通录取");
assert.equal(ordinary.formalScoreScope, "school-official-only");

const special = api.classifyPlan({
  zslb: "国家专项计划",
  pcmc: "国家专项计划",
  klmc: "物理类",
});
assert.equal(special.admissionType, "国家专项");
assert.equal(special.formalScoreScope, "special-path-only");

const malaysia = api.recordFromPlanRow({
  sf: "北京",
  nf: "2026",
  zslb: "厦门大学马来西亚分校",
  pcmc: "本科普通批",
  klmc: "综合改革",
  zymc: "计算机科学与技术（厦门大学马来西亚分校招生专业）",
  jhrs: 2,
  xkkm: "物理+化学",
  xkyq: "",
  sxkm: "无首选科目要求",
  zybz: "全英文授课，非英语语种考生慎报。",
  xzmc: "四年",
  zyxf: "3.1万林吉特/学年",
}, { rawPath: "data/admissions/raw/official-national-school-plan-2026-v351-xmu/北京.json" });
assert.equal(malaysia.schoolCode, "10384");
assert.equal(malaysia.province, "北京");
assert.equal(malaysia.planCount, 2);
assert.equal(malaysia.electiveRequirement, "物理+化学");
assert.equal(malaysia.formalScoreScope, "special-path-only");
assert.equal(malaysia.admissionType, "马来西亚分校");
assert.match(malaysia.planRemark, /全英文授课/);
assert.equal(malaysia.dataType, "admission-plan");
assert.equal(malaysia.schoolOfficialScope, "single-school-admission-plan");

console.log(JSON.stringify({
  status: "ok",
  source: "厦门大学招生数据平台",
  ordinaryScope: ordinary.formalScoreScope,
  malaysiaScope: malaysia.formalScoreScope,
}, null, 2));
