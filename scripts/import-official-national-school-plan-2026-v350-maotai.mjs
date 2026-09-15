#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUT = "data/admissions/official-national-school-plan-2026-v350-maotai-import.json";
const RAW_DIR = "data/admissions/raw/official-national-school-plan-2026-v350-maotai";
const PAGE_URL = "https://www.mtxy.edu.cn/xzbm/zsjyc/zsxxw/zsjh/20260611/20260611_891712.shtml";
const SELECTION_PAGE_URL = "https://www.mtxy.edu.cn/xzbm/zsjyc/zsxxw/zsjh/20260623/20260623_284288.shtml";
const SOURCE = {
  id: "official-maotai-national-plan-2026",
  quality: "official-school-maotai-2026-national-plan-html",
  schoolCode: "14625",
  schoolName: "茅台学院",
  city: "遵义",
  tags: ["贵州", "遵义", "应用型", "民办"],
};
const PROVINCES = [
  "贵州", "河南", "山东", "河北", "陕西", "重庆", "四川", "湖北", "湖南", "广西",
  "云南", "江苏", "江西", "福建", "广东", "安徽", "辽宁", "甘肃",
];
const PHYSICS_CHEMISTRY_MAJORS = new Set([
  "包装工程", "自动化", "种子科学与工程", "环境科学与工程", "资源循环科学与工程",
  "食品营养与健康", "食品科学与工程", "食品质量与安全", "葡萄与葡萄酒工程",
  "酿酒工程", "白酒酿造工程",
]);
const GUIZHOU_UNLIMITED_MAJORS = new Set(["旅游管理", "酒店管理", "电子商务", "市场营销"]);

function usage() {
  return [
    "Usage:",
    `  node scripts/import-official-national-school-plan-2026-v350-maotai.mjs --out ${DEFAULT_OUT}`,
    "  node scripts/import-official-national-school-plan-2026-v350-maotai.mjs --use-cache",
    "",
    "Imports Moutai Institute official 2026 province-major admission plans.",
  ].join("\n");
}

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT, useCache: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") args.out = argv[++index];
    else if (value === "--use-cache") args.useCache = true;
    else if (value === "--help" || value === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${value}\n${usage()}`);
  }
  return args;
}

function hash(value, length = 18) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function clean(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[　]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value) {
  return clean(String(value ?? "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number.parseInt(number, 10))));
}

function normalizeProvince(value) {
  const text = clean(value).replace(/省$|市$|自治区$/g, "");
  if (/广西/.test(text)) return "广西";
  return PROVINCES.find((province) => text.includes(province) || province.includes(text)) || text;
}

function stripTags(value) {
  return decodeEntities(String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " "));
}

function attribute(tag, name) {
  const expression = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = expression.exec(tag);
  return decodeEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? "");
}

function parseInteger(value) {
  const text = clean(value).replace(/[,，]/g, "");
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function subjectTypeFrom(raw) {
  const text = clean(raw).replace(/类$/, "");
  if (/物理[／/]历史|历史[／/]物理/.test(text)) return "物理类/历史类";
  if (/历史|文史|文科/.test(text)) return "历史类";
  if (/物理|理工|理科/.test(text)) return "物理类";
  if (/艺术|美术|音乐|播音|设计/.test(text)) return "艺术类";
  if (/体育/.test(text)) return "体育类";
  return /综合|不分|不限/.test(text) ? "综合" : text || "综合";
}

function classifyPlan(subjectRaw) {
  const subjectType = subjectTypeFrom(subjectRaw);
  return {
    subjectType,
    batch: "普通本科",
    admissionType: "普通录取",
    admissionSubtype: "普通本科",
    formalScoreScope: "school-official-only",
  };
}

function canonicalMajorName(value) {
  return clean(value).replace(/（茅台实验班）$/, "");
}

function selectionRequirementFor(row) {
  const majorName = canonicalMajorName(row.majorName);
  if (GUIZHOU_UNLIMITED_MAJORS.has(majorName)) {
    const guizhou = row.province === "贵州";
    return {
      subjectType: guizhou ? "综合" : "物理类",
      electiveRequirement: guizhou ? "不提科目要求" : "物理",
      planRemark: guizhou
        ? "官方计划表标注物理/历史兼招；后续官方选科要求页注明贵州不提科目要求，未拆分单科计划数。"
        : "官方计划表标注物理/历史兼招；后续官方选科要求页注明其他省份要求物理，未拆分单科计划数。",
    };
  }
  if (majorName === "物流管理") {
    return { subjectType: "物理类", electiveRequirement: "物理" };
  }
  if (PHYSICS_CHEMISTRY_MAJORS.has(majorName)) {
    return { subjectType: "物理类", electiveRequirement: "物理，化学" };
  }
  return null;
}

function parseCell(tag, content) {
  return {
    value: stripTags(content),
    rowspan: Math.max(1, Number(attribute(tag, "rowspan")) || 1),
    colspan: Math.max(1, Number(attribute(tag, "colspan")) || 1),
  };
}

function tableGrid(html) {
  const table = [...String(html || "").matchAll(/<table\b[\s\S]*?<\/table>/gi)]
    .map((match) => match[0])
    .find((candidate) => /2026年计划数[\s\S]*贵州[\s\S]*省外合计/.test(stripTags(candidate)));
  if (!table) return [];
  const rows = [...table.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((match) =>
    [...match[0].matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/(?:td|th)>/gi)]
      .map((cell) => parseCell(cell[0], cell[3]))
  );
  const active = new Map();
  const grid = [];
  for (const row of rows) {
    const values = [];
    let column = 0;
    const fillActive = () => {
      while (active.has(column)) {
        const pending = active.get(column);
        values[column] = pending.value;
        pending.remaining -= 1;
        if (pending.remaining <= 0) active.delete(column);
        column += 1;
      }
    };
    for (const cell of row) {
      fillActive();
      for (let offset = 0; offset < cell.colspan; offset += 1) values[column + offset] = cell.value;
      if (cell.rowspan > 1) {
        for (let offset = 0; offset < cell.colspan; offset += 1) active.set(column + offset, { value: cell.value, remaining: cell.rowspan - 1 });
      }
      column += cell.colspan;
    }
    fillActive();
    grid.push(values);
  }
  return grid;
}

function parsePlanTable(html, link = {}) {
  const grid = tableGrid(html);
  const headerIndex = grid.findIndex((row) => row.some((cell) => /学院/.test(cell)) && row.some((cell) => /专业/.test(cell)) && row.some((cell) => /科类/.test(cell)) && row.some((cell) => /计划数/.test(cell)));
  if (headerIndex < 0) return { rows: [], diagnostics: { dataRows: 0, totalMismatches: 0, provinceCount: 0 } };
  const headers = grid[headerIndex].map(clean);
  const indexOf = (pattern) => headers.findIndex((header) => pattern.test(header));
  const majorIndex = indexOf(/^专业$/);
  const facultyIndex = indexOf(/^学院$/);
  const subjectIndex = indexOf(/科类/);
  const totalIndex = indexOf(/2026年计划数/);
  const provinceColumns = headers
    .map((header, index) => ({ header, index, province: normalizeProvince(header) }))
    .filter(({ header, province }) => header && header !== "省外合计" && PROVINCES.includes(province));
  const rows = [];
  const mismatches = [];
  let dataRows = 0;
  for (const cells of grid.slice(headerIndex + 1)) {
    const majorName = clean(cells[majorIndex] || "");
    const faculty = clean(cells[facultyIndex] || "");
    const totalPlan = parseInteger(cells[totalIndex]);
    if (!majorName || /合计|汇总|总计/.test(`${faculty} ${majorName}`) || /专业$/.test(majorName) || !Number.isFinite(totalPlan)) continue;
    dataRows += 1;
    const subjectRaw = clean(cells[subjectIndex] || "");
    const classification = classifyPlan(subjectRaw);
    const provinceRows = provinceColumns
      .map(({ province, index }) => ({ province, planCount: parseInteger(cells[index]) }))
      .filter((row) => Number.isFinite(row.planCount) && row.planCount > 0);
    const provinceSum = provinceRows.reduce((sum, row) => sum + row.planCount, 0);
    if (provinceSum !== totalPlan) mismatches.push({ majorName, totalPlan, provinceSum, provinceRows });
    for (const provinceRow of provinceRows) {
      rows.push({
        province: provinceRow.province,
        year: 2026,
        majorName,
        majorGroup: faculty ? `${faculty} · ${majorName}` : majorName,
        subjectType: classification.subjectType,
        sourceSubjectRaw: subjectRaw,
        batch: classification.batch,
        admissionType: classification.admissionType,
        admissionSubtype: classification.admissionSubtype,
        formalScoreScope: classification.formalScoreScope,
        planCount: provinceRow.planCount,
        planRemark: classification.subjectType === "物理类/历史类" ? "官方计划表标注物理/历史兼招，未拆分单科计划数。" : "",
      });
    }
  }
  return {
    rows,
    diagnostics: {
      dataRows,
      totalMismatches: mismatches.length,
      mismatches,
      provinceCount: new Set(rows.map((row) => row.province)).size,
    },
  };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(90_000),
        headers: {
          "user-agent": "Mozilla/5.0 gaokao-maotai-v350-importer/1.0",
          accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          "accept-language": "zh-CN,zh;q=0.9,en;q=0.6",
        },
      });
      const text = (await response.text()).replace(/\0/g, "");
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      if (text.length < 1000) throw new Error(`Unexpectedly short response for ${url}`);
      return text;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(attempt * 800);
    }
  }
  throw lastError;
}

async function cachedText(file, useCache, url = PAGE_URL) {
  if (useCache && fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  const text = await fetchText(url);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
  return text;
}

function recordFromPlanRow(row, rawFile, selectionRawFile) {
  const selection = selectionRequirementFor(row);
  const record = {
    id: `2026-maotai-national-plan-${hash([row.province, row.majorName, row.subjectType, row.planCount].join("|"))}`,
    province: row.province,
    year: row.year,
    subjectType: selection?.subjectType || row.subjectType,
    batch: row.batch,
    schoolName: SOURCE.schoolName,
    schoolCode: SOURCE.schoolCode,
    schoolTags: SOURCE.tags,
    city: SOURCE.city,
    dataType: "admission-plan",
    majorName: row.majorName,
    majorGroup: row.majorGroup,
    planCount: row.planCount,
    sourceSubjectRaw: row.sourceSubjectRaw,
    electiveRequirement: selection?.electiveRequirement,
    formalScoreScope: row.formalScoreScope,
    admissionType: row.admissionType,
    admissionSubtype: row.admissionSubtype,
    planRemark: selection?.planRemark || row.planRemark || undefined,
    sourceQuality: SOURCE.quality,
    sourceId: SOURCE.id,
    schoolOfficialScope: "single-school-admission-plan",
    sourceUrl: PAGE_URL,
    sourcePageUrl: PAGE_URL,
    officialEvidencePath: path.relative(PROJECT_ROOT, rawFile),
    selectionRequirementSourceUrl: SELECTION_PAGE_URL,
    selectionRequirementEvidencePath: path.relative(PROJECT_ROOT, selectionRawFile),
    cautions: [
      "本记录来自茅台学院招生信息网官方 2026 年普通本科分省分专业招生计划表，只作当年专业池、计划数、科类和路径约束，不是投档线、录取最低分或录取概率。",
      "计划表页面说明具体计划以各省级招生考试部门公布为准；物理/历史兼招专业未拆分单科计划数。",
      "选考科目要求来自茅台学院后续官方页面；最终以各省招生考试部门公布的专业目录和选科要求为准。",
    ],
  };
  for (const key of Object.keys(record)) if (record[key] === undefined || record[key] === "") delete record[key];
  return record;
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) || "";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const rawDir = path.join(PROJECT_ROOT, RAW_DIR);
  const rawFile = path.join(rawDir, "page.html");
  const selectionRawFile = path.join(rawDir, "selection-requirements.html");
  const html = await cachedText(rawFile, args.useCache);
  const selectionHtml = await cachedText(selectionRawFile, args.useCache, SELECTION_PAGE_URL);
  if (!/考试科目要求/.test(stripTags(selectionHtml)) || !/市场营销/.test(stripTags(selectionHtml)) || !/物理[，, ]*化学/.test(stripTags(selectionHtml))) {
    throw new Error("Official selection-requirement page is missing expected subject requirement markers");
  }
  const parsed = parsePlanTable(html, { pageUrl: PAGE_URL });
  if (!parsed.rows.length) throw new Error("No plan rows parsed from the official Moutai page");
  if (parsed.diagnostics.totalMismatches) throw new Error(`Plan total mismatches: ${JSON.stringify(parsed.diagnostics.mismatches.slice(0, 3))}`);
  const records = [...new Map(parsed.rows.map((row) => [row.id || [row.province, row.majorName, row.subjectType, row.planCount].join("|"), row])).values()]
    .map((row) => recordFromPlanRow(row, rawFile, selectionRawFile));
  const provinces = [...new Set(records.map((record) => record.province))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const sourceNote = {
    id: SOURCE.id,
    title: "茅台学院招生信息网：2026年普通本科分省分专业招生计划",
    publisher: "茅台学院招生就业部",
    url: PAGE_URL,
    pageUrl: PAGE_URL,
    quality: SOURCE.quality,
    usage: "抽取学校官网 HTML 计划表中的分省分专业行；用于当年专业池、计划数和科类约束，不替代省级考试院计划、投档线或专业录取分。",
    parsedRecords: records.length,
    planRecords: records.length,
    majorRows: parsed.diagnostics.dataRows,
    provinceCount: provinces.length,
    provinces,
    byProvince: countBy(records, (record) => record.province),
    bySubjectType: countBy(records, (record) => record.subjectType),
    byFormalScoreScope: countBy(records, (record) => record.formalScoreScope),
    rawPaths: [path.relative(PROJECT_ROOT, rawFile), path.relative(PROJECT_ROOT, selectionRawFile)],
    sha256: [
      { path: path.relative(PROJECT_ROOT, rawFile), sha256: sha256File(rawFile) },
      { path: path.relative(PROJECT_ROOT, selectionRawFile), sha256: sha256File(selectionRawFile) },
    ],
    transcriptionMethod: "official-server-rendered-html-table-with-rowspan-and-province-column-expansion",
    diagnostics: parsed.diagnostics,
    cautions: [
      "本源是学校官网单校招生计划，不是省级考试院全量计划或投档录取数据。",
      "页面说明具体分省分专业计划以各省级招生考试部门公布为准；空白省份不补造计划。",
      "物理/历史兼招行保留联合科类，不把合计计划数拆成两个科类。",
      "选考科目要求使用同校 2026-06-23 官方补充页：11 个专业要求物理、化学；物流管理要求物理；4 个管理专业贵州不提科目要求、其他省份要求物理。",
    ],
  };
  const selectionSourceNote = {
    id: `${SOURCE.id}-selection-requirements`,
    title: "茅台学院招生信息网：各专业选考科目要求",
    publisher: "茅台学院招生就业部",
    url: SELECTION_PAGE_URL,
    pageUrl: SELECTION_PAGE_URL,
    quality: "official-school-maotai-2026-selection-requirements-html",
    usage: "为同校分省计划补充专业选考要求；贵州管理专业与其他省份要求存在差异时按省份保留，不推断未公开的专业组信息。",
    parsedRecords: records.filter((record) => record.electiveRequirement).length,
    rawPaths: [path.relative(PROJECT_ROOT, selectionRawFile)],
    sha256: [{ path: path.relative(PROJECT_ROOT, selectionRawFile), sha256: sha256File(selectionRawFile) }],
    transcriptionMethod: "official-server-rendered-html-table-with-rowspan-requirement-inheritance",
    cautions: [
      "选考科目要求页不是分省计划表；只补充专业选科约束，计划数仍以 2026-06-11 分省分专业计划表为准。",
      "最终填报必须复核考生所在省份教育考试部门公布的专业目录、专业组和选科要求。",
    ],
  };
  const outPath = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify({ sourceNotes: [sourceNote, selectionSourceNote], records }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "ok",
    out: path.relative(PROJECT_ROOT, outPath),
    sourceId: SOURCE.id,
    majorRows: parsed.diagnostics.dataRows,
    records: records.length,
    provinces: provinces.length,
    bySubjectType: sourceNote.bySubjectType,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
