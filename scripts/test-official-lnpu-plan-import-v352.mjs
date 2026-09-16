#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importerFile = path.join(root, "scripts/import-official-national-school-plan-2026-v352-lnpu.mjs");
assert.ok(fs.existsSync(importerFile), "LNPU plan importer must exist");
const source = fs.readFileSync(importerFile, "utf8");
const instrumented = source
  .replace(/^import .*$/gm, "")
  .replace(/const PROJECT_ROOT = .*?;\n/, 'const PROJECT_ROOT = "/tmp";\n')
  .replace(/\nmain\(\)\.catch[\s\S]*$/m, "");
const context = vm.createContext({ console, Intl, Date, Set, Map, URL, crypto, fs, path });
vm.runInContext(`${instrumented}\nglobalThis.__lnpuTest = { subjectTypeFrom, classifyPlan, parsePlanTable, recordFromPlanRow };`, context, { filename: importerFile });
const api = context.__lnpuTest;

assert.equal(api.subjectTypeFrom("理工类", "河北"), "物理类");
assert.equal(api.subjectTypeFrom("文史类", "辽宁"), "历史类");
assert.equal(api.subjectTypeFrom("理工类", "北京"), "综合改革");

const provinces = ["北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "上海", "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "广西", "海南", "重庆", "四川", "贵州", "云南", "陕西", "甘肃", "青海", "宁夏", "新疆", "西藏"];
const header = ["专业名称", "学制", "科类", "合计", ...provinces, "其他", "学费（元/年）"];
const row = (name, subject, total, province, amount, other, tuition) => {
  const values = [name, "四年", subject, String(total)];
  for (const current of provinces) values.push(current === province ? String(amount) : "");
  values.push(String(other), String(tuition));
  return values;
};
const html = `<table><tbody>${[header, row("测试专业", "理工类", 3, "河北", 2, 1, 5200), row("艺术设计", "艺术文", 2, "辽宁", 2, 0, 10000)].map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
const parsed = api.parsePlanTable(html, "https://zhaosheng.lnpu.edu.cn/info/1036/3196.htm");
assert.equal(parsed.dataRows, 2);
assert.equal(parsed.mismatches, 0);
assert.equal(parsed.provinceCount, 2);
assert.equal(parsed.rows.length, 2);
assert.equal(parsed.rows[0].province, "河北");
assert.equal(parsed.rows[0].subjectType, "物理类");
assert.equal(parsed.rows[0].formalScoreScope, "school-official-only");
assert.equal(parsed.rows[1].subjectType, "艺术类");
assert.equal(parsed.rows[1].formalScoreScope, "special-path-only");

const record = api.recordFromPlanRow(parsed.rows[0], { rawPath: "raw/index.html" });
assert.equal(record.schoolCode, "10148");
assert.equal(record.schoolName, "辽宁石油化工大学");
assert.equal(record.batch, "普通本科");
assert.equal(record.planCount, 2);
assert.equal(record.tuition, 5200);
assert.match(record.planRemark, /未列具体批次/);

console.log(JSON.stringify({ status: "ok", rows: parsed.rows.length, provinces: parsed.provinceCount }, null, 2));
