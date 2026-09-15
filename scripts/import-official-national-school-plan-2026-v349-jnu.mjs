#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUT = "data/admissions/official-national-school-plan-2026-v349-jnu-import.json";
const RAW_DIR = "data/admissions/raw/official-national-school-plan-2026-v349-jnu";
const INDEX_URL = "https://zsb.jnu.edu.cn/40329/main.psp";
const SOURCE = {
  id: "official-jnu-national-plan-2026",
  quality: "official-school-jnu-2026-national-plan-html",
  schoolCode: "10559",
  schoolName: "暨南大学",
  city: "广州",
  tags: ["综合", "211", "双一流", "广东", "广州"],
};
const PROVINCES = [
  "北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "上海", "江苏",
  "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "广西",
  "海南", "重庆", "四川", "贵州", "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆",
];

function usage() {
  return [
    "Usage:",
    `  node scripts/import-official-national-school-plan-2026-v349-jnu.mjs --out ${DEFAULT_OUT}`,
    "  node scripts/import-official-national-school-plan-2026-v349-jnu.mjs --use-cache",
    "",
    "Imports Jinan University official 2026 national province/major admission plans.",
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
  const text = clean(value);
  if (/西藏内地高中班|西藏内地班/.test(text)) return "西藏";
  if (text === "内蒙") return "内蒙古";
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

function parsePlanIndexLinks(html, baseUrl = INDEX_URL) {
  const links = [];
  for (const match of String(html || "").matchAll(/<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>[\s\S]*?<\/a>/gi)) {
    const anchor = match[0];
    const href = decodeEntities(match[1] || match[2] || match[3] || "");
    const text = stripTags(anchor.replace(/^<a\b[^>]*>/i, "").replace(/<\/a>$/i, ""));
    if (!href || !/\/2026\/0622\/c4288/i.test(href)) continue;
    const province = normalizeProvince(text);
    if (!PROVINCES.includes(province)) continue;
    const url = new URL(href, baseUrl).toString();
    links.push({
      province,
      title: text,
      href: url,
      url,
      formalScoreScope: /西藏/.test(text) ? "special-path-only" : "school-official-only",
    });
  }
  return [...new Map(links.map((link) => [link.url, link])).values()];
}

function parseInteger(value) {
  const text = clean(value).replace(/[,，]/g, "");
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function subjectTypeFrom(raw) {
  const text = clean(raw);
  if (/历史|文史|文科/.test(text)) return "历史类";
  if (/物理|理工|理科/.test(text)) return "物理类";
  if (/艺术|美术|音乐|播音|设计/.test(text)) return "艺术类";
  if (/体育/.test(text)) return "体育类";
  return /综合|不分|不限/.test(text) ? "综合" : text || "综合";
}

function electiveRequirementFrom(group) {
  const text = clean(group).replace(/\s+/g, "");
  const match = text.match(/选科要求[:：]?([^，,；;]+)/);
  return clean(match?.[1] || "").replace(/科目类$/, "") || "";
}

function classifyPlan(batch, subject, title = "") {
  const text = clean(`${batch} ${subject} ${title}`);
  const special = /国家专项|地方专项|高校专项|专项计划|预科|民族|定向|南疆|援疆|提前|艺术|美术|音乐|播音|体育|中外合作|特殊类型|内地高中班/.test(text);
  let admissionType = "普通录取";
  if (/国家专项/.test(text)) admissionType = "国家专项";
  else if (/地方专项/.test(text)) admissionType = "地方专项";
  else if (/高校专项/.test(text)) admissionType = "高校专项";
  else if (/艺术|美术|音乐|播音/.test(text)) admissionType = "艺术类";
  else if (/体育/.test(text)) admissionType = "体育类";
  else if (/预科|民族/.test(text)) admissionType = "民族/预科";
  else if (/定向|南疆|援疆|提前|中外合作|特殊类型|内地高中班/.test(text)) admissionType = "特殊路径";
  const batchText = clean(batch);
  const normalizedBatch = /国家专项/.test(text)
    ? "国家专项"
    : /地方专项/.test(text)
      ? "地方专项"
      : /高校专项/.test(text)
        ? "高校专项"
        : /艺术|美术|音乐|播音/.test(text)
          ? "艺术类"
          : /体育/.test(text)
            ? "体育类"
            : /提前/.test(text)
              ? "本科提前批"
              : /专科/.test(batchText)
                ? "专科批"
                : "普通本科批";
  return {
    admissionType,
    admissionSubtype: batchText || normalizedBatch,
    batch: normalizedBatch,
    formalScoreScope: special ? "special-path-only" : "school-official-only",
  };
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
    .find((candidate) => /专业名称[\s\S]*计划数/.test(stripTags(candidate)));
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
  const headerIndex = grid.findIndex((row) => row.some((cell) => /专业名称/.test(cell)) && row.some((cell) => /计划数/.test(cell)));
  if (headerIndex < 0) return [];
  const headers = grid[headerIndex].map(clean);
  const indexOf = (pattern) => headers.findIndex((header) => pattern.test(header));
  const batchIndex = indexOf(/批次/);
  const subjectIndex = indexOf(/科类/);
  const groupIndex = indexOf(/专业组/);
  const majorIndex = indexOf(/专业名称/);
  const campusIndex = indexOf(/办学地点/);
  const tuitionIndex = indexOf(/学费/);
  const durationIndex = indexOf(/学制/);
  const planIndex = indexOf(/计划数/);
  const remarkIndex = indexOf(/备注/);
  const province = normalizeProvince(link.province || link.title || "");
  const contextText = clean(grid.slice(0, headerIndex).flat().join(" "));
  const inferBatch = (text) => /国家专项/.test(text) ? "国家专项计划" : /地方专项/.test(text) ? "地方专项计划" : /高校专项/.test(text) ? "高校专项计划" : /提前/.test(text) ? "本科提前批" : /专科/.test(text) ? "专科批" : "普通本科批";
  const inferSubject = (text) => /历史|文史|文科/.test(text) ? "历史类" : /物理|理工|理科/.test(text) ? "物理类" : /艺术|美术|音乐|播音/.test(text) ? "艺术类" : "综合";
  let activeBatchRaw = batchIndex >= 0 ? "" : inferBatch(contextText);
  let activeSubjectRaw = subjectIndex >= 0 ? "" : inferSubject(contextText);
  const rows = [];
  for (const cells of grid.slice(headerIndex + 1)) {
    const rowText = clean(cells.join(" "));
    const sectionTitle = batchIndex < 0 && /(?:本科批|专项计划|提前批|艺术类|体育类)/.test(rowText) && !Number.isFinite(parseInteger(cells[planIndex]));
    if (sectionTitle) {
      activeBatchRaw = inferBatch(rowText);
      activeSubjectRaw = inferSubject(rowText);
      continue;
    }
    const batchRaw = clean((batchIndex >= 0 ? cells[batchIndex] : activeBatchRaw) || "");
    const subjectRaw = clean((subjectIndex >= 0 ? cells[subjectIndex] : activeSubjectRaw) || "");
    const groupRaw = clean(cells[groupIndex] || "");
    const majorName = clean(cells[majorIndex] || "");
    const planCount = parseInteger(cells[planIndex]);
    if (!majorName || /合计|汇总|总计|专业名称/.test(majorName) || !Number.isFinite(planCount)) continue;
    const classification = classifyPlan(batchRaw, subjectRaw, link.title);
    rows.push({
      province,
      year: 2026,
      majorName,
      majorGroup: groupRaw,
      electiveRequirement: electiveRequirementFrom(groupRaw),
      subjectType: subjectTypeFrom(subjectRaw),
      batch: classification.batch,
      admissionType: classification.admissionType,
      admissionSubtype: classification.admissionSubtype,
      formalScoreScope: link.formalScoreScope === "special-path-only" ? "special-path-only" : classification.formalScoreScope,
      sourceBatchRaw: batchRaw,
      sourceSubjectRaw: subjectRaw,
      sourceMajorGroupRaw: groupRaw,
      planCount,
      campus: clean(cells[campusIndex] || ""),
      tuition: parseInteger(cells[tuitionIndex]),
      programDuration: clean(cells[durationIndex] || ""),
      planRemark: clean(cells[remarkIndex] || ""),
    });
  }
  return rows;
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
          "user-agent": "Mozilla/5.0 gaokao-jnu-v349-importer/1.0",
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

async function cachedText(file, useCache, fetcher) {
  if (useCache && fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  const text = await fetcher();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
  return text;
}

function recordFromPlanRow(row, link, rawFile) {
  const record = {
    id: `2026-jnu-national-plan-${hash([row.province, row.batch, row.subjectType, row.majorGroup, row.majorName, row.planCount].join("|"))}`,
    province: row.province,
    year: row.year,
    subjectType: row.subjectType,
    batch: row.batch,
    sourceBatchRaw: row.sourceBatchRaw,
    schoolName: SOURCE.schoolName,
    schoolCode: SOURCE.schoolCode,
    schoolTags: SOURCE.tags,
    city: SOURCE.city,
    campus: row.campus || undefined,
    dataType: "admission-plan",
    majorName: row.majorName,
    majorGroup: row.majorGroup || undefined,
    electiveRequirement: row.electiveRequirement || undefined,
    programDuration: row.programDuration || undefined,
    tuition: row.tuition || undefined,
    planCount: row.planCount,
    sourceSubjectRaw: row.sourceSubjectRaw,
    sourceMajorGroupRaw: row.sourceMajorGroupRaw,
    sourcePlanTypeRaw: row.sourceBatchRaw,
    formalScoreScope: row.formalScoreScope,
    admissionType: row.admissionType,
    admissionSubtype: row.admissionSubtype,
    planRemark: row.planRemark || undefined,
    sourceQuality: SOURCE.quality,
    sourceId: SOURCE.id,
    schoolOfficialScope: "single-school-admission-plan",
    sourceUrl: link.url,
    sourcePageUrl: link.url,
    sourceIndexUrl: INDEX_URL,
    officialEvidencePath: path.relative(PROJECT_ROOT, rawFile),
    cautions: [
      "本记录来自暨南大学本科招生网官方 2026 年分省分专业招生计划查询，只作当年专业池、计划数、科类、选科和路径约束，不是投档线、录取最低分或录取概率。",
      "计划若有变动，以考生所在省招生考试主管部门公布的专业组、院校代码和计划数为准。",
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
  fs.mkdirSync(rawDir, { recursive: true });
  const indexFile = path.join(rawDir, "index.html");
  const indexHtml = await cachedText(indexFile, args.useCache, () => fetchText(INDEX_URL));
  const links = parsePlanIndexLinks(indexHtml);
  if (links.length !== 31) throw new Error(`Expected 31 province links, got ${links.length}`);
  const records = [];
  const sourceFiles = [indexFile];
  for (const link of links) {
    const rawFile = path.join(rawDir, `${link.province}.html`);
    const detailHtml = await cachedText(rawFile, args.useCache, () => fetchText(link.url));
    sourceFiles.push(rawFile);
    const rows = parsePlanTable(detailHtml, link);
    if (!rows.length) throw new Error(`No plan rows parsed for ${link.province}`);
    records.push(...rows.map((row) => recordFromPlanRow(row, link, rawFile)));
    if (!args.useCache) await sleep(120);
  }
  const uniqueRecords = [...new Map(records.map((record) => [record.id, record])).values()];
  const provinces = [...new Set(uniqueRecords.map((record) => record.province))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const sourceNote = {
    id: SOURCE.id,
    title: "暨南大学本科招生网：2026年分省分专业招生计划",
    publisher: "暨南大学本科招生办公室",
    url: INDEX_URL,
    pageUrl: INDEX_URL,
    quality: SOURCE.quality,
    usage: "抽取暨南大学本科招生网 2026 年各省分省分专业计划详情页；用于当年专业池、计划数、科类、选科和特殊路径约束，不替代省级考试院计划、投档线或专业录取分。",
    parsedRecords: uniqueRecords.length,
    planRecords: uniqueRecords.length,
    provinceCount: provinces.length,
    linkCount: links.length,
    provinces,
    byProvince: countBy(uniqueRecords, (record) => record.province),
    byBatch: countBy(uniqueRecords, (record) => record.batch),
    byFormalScoreScope: countBy(uniqueRecords, (record) => record.formalScoreScope),
    bySubjectType: countBy(uniqueRecords, (record) => record.subjectType),
    rawPaths: sourceFiles.map((file) => path.relative(PROJECT_ROOT, file)),
    sha256: sourceFiles.map((file) => ({ path: path.relative(PROJECT_ROOT, file), sha256: sha256File(file) })),
    transcriptionMethod: "official-server-rendered-html-table-with-rowspan-carry-forward",
    cautions: [
      "本源是学校官网单校招生计划，不是省级考试院全量计划或投档录取数据。",
      "页面明确说明计划以各省考试院公布为准；西藏内地高中班已隔离为 special-path-only。",
      "国家专项、地方专项、提前批、艺术体育及中外合作等路径不会自动与普通录取边界混用。",
      "正式填报前必须回到当年省考试院、院校招生章程和最新计划目录核验。",
    ],
  };
  const outPath = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify({ sourceNotes: [sourceNote], records: uniqueRecords }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "ok",
    out: path.relative(PROJECT_ROOT, outPath),
    sourceId: SOURCE.id,
    links: links.length,
    records: uniqueRecords.length,
    provinces: provinces.length,
    byFormalScoreScope: sourceNote.byFormalScoreScope,
    byProvince: sourceNote.byProvince,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
