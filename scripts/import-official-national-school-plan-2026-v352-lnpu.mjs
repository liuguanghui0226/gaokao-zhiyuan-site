#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUT = "data/admissions/official-national-school-plan-2026-v352-lnpu-import.json";
const RAW_DIR = "data/admissions/raw/official-national-school-plan-2026-v352-lnpu";
const PAGE_URL = "https://zhaosheng.lnpu.edu.cn/info/1036/3196.htm";
const INDEX_URL = "https://zhaosheng.lnpu.edu.cn/";
const SOURCE = {
  id: "official-lnpu-national-plan-2026",
  quality: "official-school-lnpu-2026-national-plan-html",
  schoolCode: "10148",
  schoolName: "辽宁石油化工大学",
  city: "抚顺",
  tags: ["辽宁", "抚顺", "石油化工"],
};
const PROVINCES = [
  "北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "上海", "江苏",
  "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "广西",
  "海南", "重庆", "四川", "贵州", "云南", "陕西", "甘肃", "青海", "宁夏", "新疆", "西藏",
];
const COMPREHENSIVE_PROVINCES = new Set(["北京", "天津", "上海", "浙江", "山东", "海南"]);

function usage() {
  return `Usage:\n  node scripts/import-official-national-school-plan-2026-v352-lnpu.mjs --out ${DEFAULT_OUT}\n  node scripts/import-official-national-school-plan-2026-v352-lnpu.mjs --use-cache`;
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
  return String(value ?? "")
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function stripTags(value) {
  return clean(decodeEntities(String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")));
}

function parseInteger(value) {
  const match = clean(value).replace(/[,，]/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function subjectTypeFrom(raw, province = "") {
  const text = clean(raw);
  if (/艺术|美术|音乐|播音|舞蹈|设计/.test(text)) return "艺术类";
  if (/体育/.test(text)) return "体育类";
  if (COMPREHENSIVE_PROVINCES.has(province) && /理工|理科|文史|文科/.test(text)) return "综合改革";
  if (/理工|理科|物理/.test(text)) return "物理类";
  if (/文史|文科|历史/.test(text)) return "历史类";
  if (/综合|不分|不限/.test(text)) return "综合";
  return text || "综合";
}

function classifyPlan(majorName, subjectRaw) {
  const subjectType = subjectTypeFrom(subjectRaw);
  const cooperation = /中外合作办学/.test(clean(majorName));
  const special = cooperation || subjectType === "艺术类" || subjectType === "体育类";
  let admissionType = "普通录取";
  if (cooperation) admissionType = "中外合作办学";
  else if (subjectType === "艺术类") admissionType = "艺术类";
  else if (subjectType === "体育类") admissionType = "体育类";
  return {
    batch: "普通本科",
    admissionType,
    admissionSubtype: cooperation ? "中外合作办学" : subjectType === "普通录取" ? "普通本科" : subjectType,
    formalScoreScope: special ? "special-path-only" : "school-official-only",
  };
}

function parsePlanTable(html, pageUrl = PAGE_URL) {
  const tableMatches = [...String(html).matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)];
  let selected = null;
  for (const tableMatch of tableMatches) {
    const rows = [...tableMatch[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((rowMatch) =>
      [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => stripTags(cell[1]))
    );
    const headerIndex = rows.findIndex((row) => row.includes("专业名称") && row.includes("合计") && PROVINCES.every((province) => row.includes(province)));
    if (headerIndex >= 0) {
      selected = { rows, header: rows[headerIndex], headerIndex };
      break;
    }
  }
  if (!selected) throw new Error(`Could not find LNPU plan table at ${pageUrl}`);
  const { rows, header, headerIndex } = selected;
  const indexOf = (name) => header.findIndex((cell) => cell === name);
  const provinceIndexes = PROVINCES.map((province) => ({ province, index: indexOf(province) }));
  if (provinceIndexes.some(({ index }) => index < 0)) throw new Error("LNPU plan table is missing province headers");
  const totalIndex = indexOf("合计");
  const tuitionIndex = indexOf("学费（元/年）");
  const otherIndex = indexOf("其他");
  const dataRows = [];
  let tableTotal = null;
  let mismatches = 0;
  for (const cells of rows.slice(headerIndex + 1)) {
    const majorName = clean(cells[0]);
    if (!majorName) continue;
    if (/合\s*计|总计/.test(majorName)) {
      tableTotal = parseInteger(cells.find((cell, index) => index > 0 && parseInteger(cell) !== null));
      continue;
    }
    if (cells.length < header.length) continue;
    const subjectRaw = clean(cells[2]);
    const totalPlan = parseInteger(cells[totalIndex]);
    if (!subjectRaw || !Number.isFinite(totalPlan) || totalPlan <= 0) continue;
    const otherPlan = parseInteger(cells[otherIndex]) || 0;
    const provinceCells = provinceIndexes
      .map(({ province, index }) => ({ province, planCount: parseInteger(cells[index]) || 0 }))
      .filter(({ planCount }) => planCount > 0);
    const provinceSum = provinceCells.reduce((sum, cell) => sum + cell.planCount, 0);
    if (provinceSum + otherPlan !== totalPlan) mismatches += 1;
    for (const { province, planCount } of provinceCells) {
      const classification = classifyPlan(majorName, subjectRaw);
      const subjectType = subjectTypeFrom(subjectRaw, province);
      const isSpecial = /中外合作办学/.test(majorName) || subjectType === "艺术类" || subjectType === "体育类";
      const planRemark = COMPREHENSIVE_PROVINCES.has(province) && /理工|理科|文史|文科/.test(subjectRaw)
        ? "官方分省计划表未列具体批次；“普通本科”仅表示本科层次，不代表省级录取批次。官方源以理工/文史简化列呈现，3+3省份运行层按综合改革保留，不推断具体选科。"
        : "官方分省计划表未列具体批次；“普通本科”仅表示本科层次，不代表省级录取批次。表格脚注将理工/文史对应辽宁等3+1+2省份的物理/历史学科类，但不构成具体选科要求。";
      dataRows.push({
        province,
        year: 2026,
        majorName,
        sourceSubjectRaw: subjectRaw,
        subjectType,
        batch: "普通本科",
        sourceBatchRaw: "官方分省计划表未列具体批次",
        admissionType: isSpecial ? classification.admissionType : "普通录取",
        admissionSubtype: isSpecial ? classification.admissionSubtype : "普通本科",
        formalScoreScope: isSpecial ? "special-path-only" : "school-official-only",
        planCount,
        tuition: parseInteger(cells[tuitionIndex]),
        programDuration: clean(cells[1]),
        planRemark,
      });
    }
  }
  const provinces = [...new Set(dataRows.map((row) => row.province))];
  return {
    rows: dataRows,
    dataRows: rows.slice(headerIndex + 1).filter((row) => row[0] && !/合\s*计|总计/.test(clean(row[0])) && Number.isFinite(parseInteger(row[totalIndex]))).length,
    mismatches,
    provinceCount: provinces.length,
    tableTotal,
    provincePlanCount: dataRows.reduce((sum, row) => sum + row.planCount, 0),
    otherPlanCount: Math.max(0, (tableTotal || 0) - dataRows.reduce((sum, row) => sum + row.planCount, 0)),
  };
}

function recordFromPlanRow(row, meta = {}) {
  const record = {
    id: `2026-lnpu-national-plan-${hash([row.province, row.majorName, row.sourceSubjectRaw, row.tuition, row.year].join("|"))}`,
    province: row.province,
    year: row.year,
    subjectType: row.subjectType,
    batch: "普通本科",
    sourceBatchRaw: row.sourceBatchRaw,
    schoolName: SOURCE.schoolName,
    schoolCode: SOURCE.schoolCode,
    schoolTags: SOURCE.tags,
    city: SOURCE.city,
    dataType: "admission-plan",
    majorName: row.majorName,
    programDuration: row.programDuration,
    tuition: row.tuition,
    planCount: row.planCount,
    sourceSubjectRaw: row.sourceSubjectRaw,
    formalScoreScope: row.formalScoreScope,
    admissionType: row.admissionType,
    admissionSubtype: row.admissionSubtype,
    schoolOfficialScope: "single-school-admission-plan",
    planRemark: row.planRemark,
    sourceQuality: SOURCE.quality,
    sourceId: SOURCE.id,
    sourceUrl: PAGE_URL,
    sourcePageUrl: PAGE_URL,
    sourceIndexUrl: INDEX_URL,
    officialEvidencePath: meta.rawPath || `${RAW_DIR}/index.html`,
    cautions: [
      "本记录来自辽宁石油化工大学招生网 2026 年本科分省分专业计划，只作当年专业池、计划数、科类和路径约束，不是投档线、录取最低分或录取概率。",
      "正式填报前必须以考生所在省招生考试主管部门公布的正式计划、批次和选科要求为准。",
    ],
  };
  for (const key of Object.keys(record)) {
    if (record[key] === undefined || record[key] === "" || (Array.isArray(record[key]) && record[key].length === 0)) delete record[key];
  }
  if (!Number.isFinite(record.planCount) || record.planCount <= 0) throw new Error(`Invalid LNPU plan count for ${row.majorName}`);
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

async function sleep(ms) { await new Promise((resolve) => setTimeout(resolve, ms)); }

async function fetchText(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(90_000),
        headers: {
          "user-agent": "Mozilla/5.0 gaokao-lnpu-v352-importer/1.0",
          accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          "accept-language": "zh-CN,zh;q=0.9,en;q=0.6",
          referer: INDEX_URL,
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

async function cachedText(file, useCache) {
  if (useCache && fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  const text = await fetchText(PAGE_URL);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
  return text;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(usage()); return; }
  const rawFile = path.join(PROJECT_ROOT, RAW_DIR, "index.html");
  const html = await cachedText(rawFile, args.useCache);
  const parsed = parsePlanTable(html, PAGE_URL);
  if (parsed.dataRows !== 59) throw new Error(`Expected 59 LNPU data rows, got ${parsed.dataRows}`);
  if (parsed.mismatches !== 0) throw new Error(`LNPU row totals mismatch: ${parsed.mismatches}`);
  if (parsed.provinceCount !== 31) throw new Error(`Expected 31 LNPU provinces, got ${parsed.provinceCount}`);
  if (parsed.tableTotal !== 3481 || parsed.provincePlanCount !== 3210 || parsed.otherPlanCount !== 271) {
    throw new Error(`Unexpected LNPU totals: ${JSON.stringify(parsed)}`);
  }
  const records = parsed.rows.map((row) => recordFromPlanRow(row, { rawPath: path.relative(PROJECT_ROOT, rawFile) }));
  const uniqueRecords = [...new Map(records.map((record) => [record.id, record])).values()];
  if (uniqueRecords.length !== records.length) throw new Error(`LNPU duplicate records: ${records.length} -> ${uniqueRecords.length}`);
  const actualProvinces = [...new Set(uniqueRecords.map((record) => record.province))].sort((a, b) => PROVINCES.indexOf(a) - PROVINCES.indexOf(b));
  const sourceNote = {
    id: SOURCE.id,
    title: "辽宁石油化工大学招生网：辽宁石油化工大学2026年本科分省分专业招生计划",
    publisher: "辽宁石油化工大学招生办公室",
    url: PAGE_URL,
    pageUrl: PAGE_URL,
    quality: SOURCE.quality,
    usage: "抽取学校官网公开的 2026 年本科分省分专业计划；用于当年专业池、计划数、科类和特殊路径约束，不替代省级考试院正式计划、投档线或录取分。",
    parsedRecords: uniqueRecords.length,
    planRecords: uniqueRecords.length,
    provinceCount: actualProvinces.length,
    provinces: actualProvinces,
    byProvince: countBy(uniqueRecords, (record) => record.province),
    byFormalScoreScope: countBy(uniqueRecords, (record) => record.formalScoreScope),
    bySubjectType: countBy(uniqueRecords, (record) => record.subjectType),
    totalPlanCount: uniqueRecords.reduce((sum, record) => sum + record.planCount, 0),
    tableTotal: parsed.tableTotal,
    provincePlanCount: parsed.provincePlanCount,
    otherPlanCountExcluded: parsed.otherPlanCount,
    rawPaths: [path.relative(PROJECT_ROOT, rawFile)],
    sha256: [{ path: path.relative(PROJECT_ROOT, rawFile), sha256: sha256File(rawFile) }],
    transcriptionMethod: "official-public-html-table-with-province-plan-expansion",
    cautions: [
      "官网表格合计为 3481，其中明确列出的 31 省分省计划数为 3210；‘其他’271 不展开为虚构省份记录。",
      "北京、天津、上海、浙江、山东、海南等 3+3 省份的官网表格仍以理工/文史简化列呈现，运行层映射为综合改革，不推断具体选科要求。",
      "普通类、艺术类、体育类和中外合作办学按 formalScoreScope 隔离，不自动与普通录取边界混用。",
      "正式填报前必须回到当年省考试院、院校招生章程和最新计划目录核验。",
    ],
  };
  const outPath = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify({ sourceNotes: [sourceNote], records: uniqueRecords }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "ok", out: path.relative(PROJECT_ROOT, outPath), sourceId: SOURCE.id, provinces: actualProvinces.length, records: uniqueRecords.length, totalPlanCount: sourceNote.totalPlanCount, tableTotal: sourceNote.tableTotal, otherPlanCountExcluded: sourceNote.otherPlanCountExcluded, byFormalScoreScope: sourceNote.byFormalScoreScope, bySubjectType: sourceNote.bySubjectType }, null, 2));
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
