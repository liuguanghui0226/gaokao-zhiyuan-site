#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importerFile = path.join(root, "scripts/import-official-national-school-plan-2026-v356-sdnu.mjs");
assert.ok(fs.existsSync(importerFile), "SDNU importer must exist before contract tests run");

const importer = await import(importerFile);
const {
  subjectTypeFrom,
  electiveRequirementFrom,
  classifyPlan,
  parseParamOptions,
  parsePlanRows,
  recordFromPlanRow,
} = importer;

assert.equal(subjectTypeFrom("综合改革"), "综合改革");
assert.equal(subjectTypeFrom("物理类"), "物理类");
assert.equal(subjectTypeFrom("历史类"), "历史类");
assert.equal(subjectTypeFrom("艺术(不分科目类)"), "艺术类");
assert.equal(subjectTypeFrom("体育类"), "体育类");

assert.equal(electiveRequirementFrom("不提科目要求"), "不提科目要求");
assert.equal(electiveRequirementFrom("物理,化学(2门科目考生均须选考方可报考)"), "物理，化学");
assert.equal(electiveRequirementFrom("物理,化学,生物"), "物理，化学，生物");
assert.equal(electiveRequirementFrom(""), undefined);

assert.equal(classifyPlan({ typeName: "普通类", categoryName: "物理类" }).formalScoreScope, "school-official-only");
assert.equal(classifyPlan({ typeName: "中外合作办学", categoryName: "物理类" }).formalScoreScope, "special-path-only");
assert.equal(classifyPlan({ typeName: "国家专项计划", categoryName: "物理类" }).admissionType, "国家专项");
assert.equal(classifyPlan({ typeName: "地方专项计划", categoryName: "历史类" }).admissionType, "地方专项");
assert.equal(classifyPlan({ typeName: "山东省属地方公费师范生", categoryName: "历史类" }).admissionType, "公费师范生");
assert.equal(classifyPlan({ typeName: "非西藏生源定向西藏就业", categoryName: "物理类" }).admissionType, "定向西藏");
assert.equal(classifyPlan({ typeName: "普通类提前批", categoryName: "物理类" }).formalScoreScope, "special-path-only");
assert.equal(classifyPlan({ typeName: "艺考类专业", categoryName: "艺术(不分科目类)" }).admissionType, "艺术类");
assert.equal(classifyPlan({ typeName: "体育类", categoryName: "体育类" }).admissionType, "体育类");

const sampleParamHtml = JSON.stringify({
  state: 1,
  data: {
    ssmc_nf_klmc_sex_campus_zslx_list: [
      { "北京_2026_综合改革_sex_campus": ["普通类", "中外合作办学"] },
      { "西藏_2026_物理类_sex_campus": ["普通类"] },
      { "不分省_2023_理工_sex_campus": ["西藏班"] },
    ],
  },
});
assert.deepEqual(parseParamOptions(sampleParamHtml).filter((item) => item.year === "2026"), [
  { province: "北京", year: "2026", category: "综合改革", types: ["普通类", "中外合作办学"] },
  { province: "西藏", year: "2026", category: "物理类", types: ["普通类"] },
]);

const sample = parsePlanRows({
  data: {
    withZyz: false,
    zsjhList: [{
      ssmc: "北京", nf: "2026", klmc: "综合改革", zslx: "普通类", zylx: "普通类",
      zymc: "化学（师范类）", zydm: "070301", zydh: "R1", zydhmc: "化学类",
      zsjhs: 1, xkkm: "物理,化学(2门科目考生均须选考方可报考)", zyxf: "6600",
      zycc: "本科普通批", zyxz: "四年", remarks: "", jdxq: "济南市", bhzy: "化学",
    }],
  },
  query: { province: "北京", year: "2026", category: "综合改革", type: "普通类" },
});
assert.equal(sample.length, 1);
assert.equal(sample[0].planCount, 1);
assert.equal(sample[0].majorCode, "070301");
assert.equal(sample[0].majorGroupCode, "R1");
assert.equal(sample[0].electiveRaw, "物理,化学(2门科目考生均须选考方可报考)");

const record = recordFromPlanRow(sample[0], { evidencePath: "raw/api-snapshot.json" });
assert.equal(record.schoolCode, "10445");
assert.equal(record.province, "北京");
assert.equal(record.majorName, "化学（师范类）");
assert.equal(record.majorCode, "070301");
assert.equal(record.majorGroup, "R1");
assert.equal(record.electiveRequirement, "物理，化学");
assert.equal(record.tuition, 6600);
assert.equal(record.formalScoreScope, "school-official-only");
assert.equal(record.officialEvidencePath, "raw/api-snapshot.json");

console.log(JSON.stringify({ status: "ok", parsedOptions: parseParamOptions(sampleParamHtml).length, parsedRows: sample.length, ordinary: record.formalScoreScope, elective: record.electiveRequirement }, null, 2));
