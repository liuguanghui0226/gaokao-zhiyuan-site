#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importerFile = path.join(root, "scripts/import-official-national-school-plan-2026-v350-maotai.mjs");
assert.ok(fs.existsSync(importerFile), "Moutai Institute plan importer must exist");
const source = fs.readFileSync(importerFile, "utf8");
const importerSource = source
  .replace(/^import .*$/gm, "")
  .replace(/const PROJECT_ROOT = .*?;\n/, 'const PROJECT_ROOT = "/tmp";\n');
const mainIndex = importerSource.lastIndexOf("\nmain().catch");
assert.ok(mainIndex >= 0, "could not isolate importer main call");
const instrumented = `${importerSource.slice(0, mainIndex)}
globalThis.__maotaiTest = { parsePlanTable, normalizeProvince, subjectTypeFrom, parseInteger, selectionRequirementFor, classifyPlan };`;
const context = vm.createContext({ console, Intl, Date, Set, Map, URL, crypto, fs, path });
vm.runInContext(instrumented, context, { filename: importerFile });
const api = context.__maotaiTest;

assert.equal(api.normalizeProvince("贵州省"), "贵州");
assert.equal(api.normalizeProvince("广西壮族自治区"), "广西");
assert.equal(api.subjectTypeFrom("物理/历史"), "物理类/历史类");
assert.equal(api.parseInteger("56（理：28，文：28）"), 56);
assert.equal(api.classifyPlan("物理").batch, "普通本科", "the official page does not publish a more specific batch label");
assert.deepEqual(JSON.parse(JSON.stringify(api.selectionRequirementFor({ province: "贵州", majorName: "电子商务" }))), {
  subjectType: "综合",
  electiveRequirement: "不提科目要求",
  planRemark: "官方计划表标注物理/历史兼招；后续官方选科要求页注明贵州不提科目要求，未拆分单科计划数。",
});
assert.equal(api.selectionRequirementFor({ province: "河南", majorName: "电子商务" }).electiveRequirement, "物理");
assert.equal(api.selectionRequirementFor({ province: "山东", majorName: "食品科学与工程" }).electiveRequirement, "物理，化学");

const html = `
<table>
  <tr><td>茅台学院2026年普通本科分省分专业招生计划</td></tr>
  <tr><td>学院</td><td>专业</td><td>科类</td><td>2026年计划数</td><td>贵州</td><td>省外合计</td><td>河南</td><td>山东</td></tr>
  <tr><td rowspan="2">食品工程学院</td><td>食品科学与工程</td><td>物理</td><td>58</td><td>54</td><td>4</td><td>2</td><td>2</td></tr>
  <tr><td>电子商务</td><td>物理/历史</td><td>27</td><td>23（理：12，文：11）</td><td>4</td><td>2</td><td>2</td></tr>
  <tr><td>合计</td><td>/</td><td>/</td><td>85</td><td>77</td><td>8</td><td>4</td><td>4</td></tr>
</table>`;
const result = api.parsePlanTable(html, { pageUrl: "https://www.mtxy.edu.cn/official" });
assert.equal(result.rows.length, 6, "two majors should expand to three populated province rows each");
assert.equal(result.diagnostics.dataRows, 2);
assert.equal(result.diagnostics.totalMismatches, 0);
assert.deepEqual(JSON.parse(JSON.stringify(result.rows.map((row) => [row.province, row.majorName, row.planCount]))), [
  ["贵州", "食品科学与工程", 54],
  ["河南", "食品科学与工程", 2],
  ["山东", "食品科学与工程", 2],
  ["贵州", "电子商务", 23],
  ["河南", "电子商务", 2],
  ["山东", "电子商务", 2],
]);
assert.equal(result.rows[3].subjectType, "物理类/历史类", "mixed subject plans must not be silently assigned to one subject");
assert.equal(result.rows[3].formalScoreScope, "school-official-only");

console.log(JSON.stringify({
  status: "ok",
  source: "茅台学院招生信息网",
  parsedMajors: result.diagnostics.dataRows,
  provinceRows: result.rows.length,
  mixedSubjectRows: result.rows.filter((row) => row.subjectType === "物理类/历史类").length,
}, null, 2));
