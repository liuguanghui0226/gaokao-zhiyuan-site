#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importerFile = path.join(root, "scripts/import-official-national-school-plan-2026-v358-hnust.mjs");
assert.ok(fs.existsSync(importerFile), "HNUST v3.358 importer must exist before contract tests run");

const importer = await import(importerFile);
const {
  EXPECTED,
  subjectTypeFrom,
  classifyPlan,
  parsePlanRows,
  dedupePlanRows,
  recordFromPlanRow,
} = importer;

assert.deepEqual(EXPECTED, {
  rawRows: 1963,
  records: 1961,
  rawPlanCount: 10582,
  planCount: 10579,
  duplicateRows: 2,
  provinces: 31,
  ordinaryRecords: 1687,
  specialPathRecords: 274,
});

assert.equal(subjectTypeFrom("综合改革"), "综合改革");
assert.equal(subjectTypeFrom("物理类"), "物理类");
assert.equal(subjectTypeFrom("理工"), "物理类");
assert.equal(subjectTypeFrom("文史"), "历史类");
assert.equal(subjectTypeFrom("艺术(不分文理)"), "艺术类");
assert.equal(subjectTypeFrom("体育(历史类)"), "体育类");

assert.equal(classifyPlan({ kelei: "物理类", lqpc: "普通本科批", zymc: "计算机科学与技术" }).formalScoreScope, "school-official-only");
assert.equal(classifyPlan({ kelei: "物理类", lqpc: "本科批(普通)(国家专项计划)", zymc: "机械设计制造及其自动化" }).admissionType, "国家专项");
assert.equal(classifyPlan({ kelei: "物理类", lqpc: "本科提前批(优师专项)", zymc: "化学" }).admissionType, "优师专项");
assert.equal(classifyPlan({ kelei: "艺术(不分科目类)", lqpc: "本科提前批", zymc: "美术学" }).formalScoreScope, "special-path-only");
assert.equal(classifyPlan({ kelei: "理工", lqpc: "专项南单援疆计划本科一批次", zymc: "电气工程及其自动化" }).admissionType, "南疆单列");

const fixture = [
  {
    year: 2026,
    data: [{
      provice: "新疆",
      data: [
        { xz: 4, zsrs: 1, kelei: "理工", lqpc: "本科一批次", zymc: "电气工程及其自动化", xfbz: 5900, xymc: "信息与电气工程学院" },
        { xz: 4, zsrs: 1, kelei: "理工", lqpc: "本科一批次", zymc: "电气工程及其自动化", xfbz: 5900, xymc: "信息与电气工程学院" },
        { xz: 4, zsrs: 2, kelei: "艺术(不分文理)", lqpc: "本科提前批(艺术统考美术与设计类)", zymc: "美术学", xfbz: 8000, xymc: "齐白石艺术学院" },
      ],
    }],
  },
];
const rows = parsePlanRows(fixture);
assert.equal(rows.length, 3);
assert.equal(rows[0].province, "新疆");
assert.equal(rows[0].majorName, "电气工程及其自动化");
assert.equal(rows[0].planCount, 1);
assert.equal(rows[0].batch, "本科一批次");
assert.equal(rows[2].subjectType, "艺术类");
const uniqueRows = dedupePlanRows(rows);
assert.equal(uniqueRows.length, 2);
assert.equal(uniqueRows.duplicateRows, undefined);

const record = recordFromPlanRow(uniqueRows[0], { evidencePath: "raw/zsjh.json" });
assert.equal(record.schoolCode, "10534");
assert.equal(record.schoolName, "湖南科技大学");
assert.equal(record.province, "新疆");
assert.equal(record.subjectType, "物理类");
assert.equal(record.batch, "本科一批次");
assert.equal(record.majorName, "电气工程及其自动化");
assert.equal(record.planCount, 1);
assert.equal(record.tuition, 5900);
assert.equal(record.programDuration, "4年");
assert.equal(record.formalScoreScope, "school-official-only");
assert.equal(record.officialEvidencePath, "raw/zsjh.json");
assert.equal(record.sourceId, "official-hnust-national-plan-2026");

const specialRecord = recordFromPlanRow(uniqueRows[1], { evidencePath: "raw/zsjh.json" });
assert.equal(specialRecord.formalScoreScope, "special-path-only");
assert.equal(specialRecord.admissionType, "艺术类");

console.log(JSON.stringify({
  status: "ok",
  version: "v3.358",
  parsedRows: rows.length,
  deduplicatedRows: uniqueRows.length,
  ordinaryScope: record.formalScoreScope,
  specialScope: specialRecord.formalScoreScope,
}, null, 2));
