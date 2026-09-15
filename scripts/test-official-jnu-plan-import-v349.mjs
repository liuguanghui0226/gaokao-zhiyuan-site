#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importerFile = path.join(root, "scripts/import-official-national-school-plan-2026-v349-jnu.mjs");
assert.ok(fs.existsSync(importerFile), "Jinan University plan importer must exist");
const source = fs.readFileSync(importerFile, "utf8");
const mainIndex = source.lastIndexOf("\nmain().catch");
assert.ok(mainIndex >= 0, "could not isolate importer main call");
const importerSource = source
  .replace(/^import .*$/gm, "")
  .replace(/const PROJECT_ROOT = .*?;\n/, 'const PROJECT_ROOT = "/tmp";\n');
const instrumented = `${importerSource.slice(0, importerSource.lastIndexOf("\nmain().catch"))}
globalThis.__jnuTest = {
  parsePlanIndexLinks,
  parsePlanTable,
  normalizeProvince,
  classifyPlan,
};`;
const context = vm.createContext({ console, Intl, Date, Set, Map, URL, crypto, fs, path, fileURLToPath });
vm.runInContext(instrumented, context, { filename: importerFile });
const api = context.__jnuTest;

const index = `
  <a href="/_s145/2026/0622/c4288a857495/page.psp"><span>安徽</span></a>
  <a href="/_s145/2026/0622/c4288a857579/page.psp">西藏内地高中班</a>
`;
const links = api.parsePlanIndexLinks(index, "https://zsb.jnu.edu.cn/40329/main.psp");
assert.equal(links.length, 2);
assert.equal(links[0].province, "安徽");
assert.equal(links[1].province, "西藏");
assert.equal(links[1].formalScoreScope, "special-path-only");

const detail = `
<title>暨南大学2026年在安徽招生计划（共9人）</title>
<table>
<tr><td>批次</td><td>科类</td><td>专业组及选科要求</td><td>专业名称</td><td>学院</td><td>办学地点</td><td>学费</td><td>学制</td><td>计划数</td><td>备注</td></tr>
<tr><td rowspan="2">普通本科批</td><td rowspan="2">物理类</td><td rowspan="2">专业组02<br/>选科要求：物理+化学</td><td>物联网工程</td><td>智能科学与工程学院</td><td>珠海校区</td><td>6850</td><td>四年</td><td>4</td><td></td></tr>
<tr><td>临床医学</td><td>医学部</td><td>广州石牌校区</td><td>7660</td><td>五年</td><td>3</td><td>不招收色盲色弱考生</td></tr>
<tr><td>国家专项计划</td><td>历史类</td><td>专业组01<br/>选科要求：历史+不限</td><td>工商管理</td><td>国际商学院</td><td>珠海校区</td><td>6060</td><td>四年</td><td>2</td><td></td></tr>
<tr><td colspan="8">普通本科批-物理类 合计</td><td>7</td><td></td></tr>
</table>`;
const rows = api.parsePlanTable(detail, { province: "安徽", url: "https://zsb.jnu.edu.cn/_s145/2026/0622/c4288a857495/page.psp" });
assert.equal(rows.length, 3);
assert.equal(rows[0].batch, "普通本科批");
assert.equal(rows[0].subjectType, "物理类");
assert.equal(rows[0].electiveRequirement, "物理+化学");
assert.equal(rows[0].majorName, "物联网工程");
assert.equal(rows[0].planCount, 4);
assert.equal(rows[1].batch, "普通本科批", "rowspan batch must carry to the next row");
assert.match(rows[1].planRemark, /色盲色弱/);
assert.equal(rows[2].formalScoreScope, "special-path-only");
assert.equal(api.classifyPlan("普通本科批", "物理类").formalScoreScope, "school-official-only");
assert.equal(api.classifyPlan("国家专项计划", "历史类").admissionType, "国家专项");

console.log(JSON.stringify({
  status: "ok",
  source: "暨南大学本科招生网",
  indexLinks: links.length,
  parsedRows: rows.length,
  specialRows: rows.filter((row) => row.formalScoreScope === "special-path-only").length,
}, null, 2));
