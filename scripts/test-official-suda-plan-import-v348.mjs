#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importerFile = path.join(root, "scripts/import-official-national-school-plan-2026-v348-suda.mjs");
assert.ok(fs.existsSync(importerFile), "Suzhou University plan importer must exist");
const source = fs.readFileSync(importerFile, "utf8");
const mainIndex = source.lastIndexOf("\nmain().catch");
assert.ok(mainIndex >= 0, "could not isolate importer main call");
const importerSource = source
  .replace(/^import .*$/gm, "")
  .replace(/const PROJECT_ROOT = .*?;\n/, 'const PROJECT_ROOT = "/tmp";\n');
const instrumented = `${importerSource.slice(0, importerSource.lastIndexOf("\nmain().catch"))}
globalThis.__sudaTest = {
  parsePlanListingLinks,
  parsePlanDetailHtml,
  classifyPlan,
  normalizeProvince,
};`;
const context = vm.createContext({ console, Intl, Date, Set, Map, URL, crypto, fs, path, fileURLToPath });
vm.runInContext(instrumented, context, { filename: importerFile });
const api = context.__sudaTest;

const listing = `
  <a href='DetailsPlans.aspx?ab=ss52&ac=313&ae=2026&af=1&aa=2026年贵州普通类本科专业招生计划' title=2026年贵州普通类本科专业招生计划>2026年贵州普通类本科专业招生计划</a>
  <a href='DetailsPlans.aspx?ab=ss52&ac=301&ae=2026&af=2&aa=2026年贵州艺术类专业招生计划' title=2026年贵州艺术类专业招生计划>2026年贵州艺术类专业招生计划</a>
`;
const links = api.parsePlanListingLinks(listing);
assert.equal(links.length, 2);
assert.equal(links[0].province, "贵州");
assert.equal(links[0].category, "ordinary");
assert.equal(links[1].category, "arts");
assert.equal(api.normalizeProvince("内蒙"), "内蒙古");

const detail = `
<title>2026年贵州普通类本科专业招生计划</title>
<table><tr><th>专业名称</th><th>学制</th><th>计划数</th><th>批次</th><th>科类</th><th>计划性质(类别)</th></tr>
<tr><td>计算机科学与技术</td><td>4</td><td>2</td><td>本科</td><td>物理类</td><td>普通类</td></tr>
<tr><td>材料类 含材料科学与工程、高分子材料与工程。不招色盲。</td><td>4</td><td>2</td><td>本科</td><td>物理类</td><td>普通类</td></tr>
<tr><td>社会工作</td><td>4</td><td>1</td><td>本科</td><td>历史类</td><td>国家专项计划</td></tr>
<tr><td>合计计划数</td><td>170</td></tr></table>`;
const rows = api.parsePlanDetailHtml(detail, {
  province: "贵州",
  title: "2026年贵州普通类本科专业招生计划",
  url: "https://zsb.suda.edu.cn/DetailsPlans.aspx?ab=ss52&ac=313&ae=2026&af=1",
});
assert.equal(rows.length, 3);
assert.equal(rows[0].majorName, "计算机科学与技术");
assert.equal(rows[0].planCount, 2);
assert.equal(rows[0].subjectType, "物理类");
assert.equal(rows[0].batch, "普通本科批");
assert.equal(rows[0].formalScoreScope, "school-official-only");
assert.equal(rows[1].majorName, "材料类");
assert.match(rows[1].planRemark, /含材料科学与工程/);
assert.equal(rows[2].formalScoreScope, "special-path-only");
assert.equal(rows[2].batch, "国家专项");
assert.equal(api.classifyPlan("普通本科批", "普通类").formalScoreScope, "school-official-only");
assert.equal(api.classifyPlan("本科", "国家专项计划").formalScoreScope, "special-path-only");

console.log(JSON.stringify({
  status: "ok",
  source: "苏州大学本科招生网",
  listingLinks: links.length,
  parsedRows: rows.length,
  specialRows: rows.filter((row) => row.formalScoreScope === "special-path-only").length,
}, null, 2));
