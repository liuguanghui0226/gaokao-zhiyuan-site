#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importerFile = path.join(root, "scripts/import-official-national-school-plan-2026-v353-dlmu.mjs");
assert.ok(fs.existsSync(importerFile), "DLMU plan importer must exist");
const source = fs.readFileSync(importerFile, "utf8");
const instrumented = source
  .replace(/^import .*$/gm, "")
  .replace(/const PROJECT_ROOT = .*?;\n/, 'const PROJECT_ROOT = "/tmp";\n')
  .replace(/\nmain\(\)\.catch[\s\S]*$/m, "");
const context = vm.createContext({ console, Intl, Date, Set, Map, URL, crypto, fs, path });
vm.runInContext(`${instrumented}\nglobalThis.__dlmuTest = { subjectTypeFrom, electiveRequirementFrom, classifyPlan, parseApiRows, recordFromPlanRow };`, context, { filename: importerFile });
const api = context.__dlmuTest;

assert.equal(api.subjectTypeFrom("综合改革"), "综合改革");
assert.equal(api.subjectTypeFrom("理工"), "物理类");
assert.equal(api.subjectTypeFrom("文史"), "历史类");
assert.equal(api.electiveRequirementFrom("物理,化学(2门科目考生均须选考方可报考)"), "物理，化学");
assert.equal(api.electiveRequirementFrom("不提科目要求"), "不提科目要求");

const ordinary = api.classifyPlan({ zslx: "普通批", zycc: "本科批", klmc: "综合改革", zymc: "交通运输" });
assert.equal(ordinary.admissionType, "普通录取");
assert.equal(ordinary.formalScoreScope, "school-official-only");
const special = api.classifyPlan({ zslx: "国家专项计划", zycc: "国家专项本科", klmc: "物理类", zymc: "交通运输" });
assert.equal(special.admissionType, "国家专项");
assert.equal(special.formalScoreScope, "special-path-only");

const rows = api.parseApiRows({ data: { zsjhList: [
  {
    nf: "2026", ssmc: "北京", zslx: "提前批", zylx: "提前批", klmc: "综合改革", zydh: "A1", zydm: "081803",
    zydhmc: "航海技术", zymc: "航海技术", zsjhs: 8, xkkm: "物理,化学(2门科目考生均须选考方可报考)",
    zycc: "本科提前批普通类（A段）", zyxf: "5200", zyxz: "四年", remarks: "不宜女生报考", xy: "航海学院", jdxq: "校本部", bhzy: "",
  },
] } });
assert.equal(rows.length, 1);
assert.equal(rows[0].province, "北京");
assert.equal(rows[0].subjectType, "综合改革");
assert.equal(rows[0].planCount, 8);
assert.equal(rows[0].electiveRequirement, "物理，化学");

const record = api.recordFromPlanRow(rows[0], { rawPath: "raw/plans.json" });
assert.equal(record.schoolCode, "10151");
assert.equal(record.schoolName, "大连海事大学");
assert.equal(record.majorCode, "081803");
assert.equal(record.batch, "本科提前批普通类（A段）");
assert.equal(record.formalScoreScope, "special-path-only");
assert.match(record.planRemark, /不宜女生报考/);
assert.equal(record.planCount, 8);
assert.equal(record.tuition, 5200);

console.log(JSON.stringify({ status: "ok", rows: rows.length, subjectType: record.subjectType, formalScoreScope: record.formalScoreScope }, null, 2));
