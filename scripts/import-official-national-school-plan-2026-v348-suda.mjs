#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUT = "data/admissions/official-national-school-plan-2026-v348-suda-import.json";
const RAW_DIR = "data/admissions/raw/official-national-school-plan-2026-v348-suda";
const INDEX_URL = "https://zsb.suda.edu.cn/MorePlan.aspx";
const DETAIL_BASE_URL = "https://zsb.suda.edu.cn/";
const SOURCE = {
  id: "official-suda-national-plan-2026",
  quality: "official-school-suda-2026-national-plan-html",
  schoolCode: "10285",
  schoolName: "苏州大学",
  city: "苏州",
  tags: ["综合", "211", "双一流", "江苏", "苏州"],
};
const PROVINCES = [
  "北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "上海", "江苏",
  "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "广西",
  "海南", "重庆", "四川", "贵州", "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆",
];
const PROVINCE_CODES = new Map([
  ["北京", "ss11"], ["天津", "ss12"], ["河北", "ss13"], ["山西", "ss14"], ["内蒙古", "ss15"],
  ["辽宁", "ss21"], ["吉林", "ss22"], ["黑龙江", "ss23"], ["上海", "ss31"], ["江苏", "ss32"],
  ["浙江", "ss33"], ["安徽", "ss34"], ["福建", "ss35"], ["江西", "ss36"], ["山东", "ss37"],
  ["河南", "ss41"], ["湖北", "ss42"], ["湖南", "ss43"], ["广东", "ss44"], ["广西", "ss45"],
  ["海南", "ss46"], ["重庆", "ss50"], ["四川", "ss51"], ["贵州", "ss52"], ["云南", "ss53"],
  ["西藏", "ss54"], ["陕西", "ss61"], ["甘肃", "ss62"], ["青海", "ss63"], ["宁夏", "ss64"],
  ["新疆", "ss65"],
]);

function usage() {
  return [
    "Usage:",
    `  node scripts/import-official-national-school-plan-2026-v348-suda.mjs --out ${DEFAULT_OUT}`,
    "  node scripts/import-official-national-school-plan-2026-v348-suda.mjs --use-cache",
    "",
    "Imports Suzhou University official 2026 national province/major admission plans.",
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
    .replace(/&nbsp;/gi, " ")
    .replace(/[　]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value) {
  return clean(value)
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number.parseInt(number, 10)));
}

function normalizeProvince(value) {
  const text = clean(value);
  if (text === "内蒙") return "内蒙古";
  return PROVINCES.find((province) => text.includes(province) || province.includes(text)) || text;
}

function stripTags(value) {
  return decodeEntities(String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " "));
}

function attribute(tag, name) {
  const expression = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = expression.exec(tag);
  return decodeEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? "");
}

function parsePlanListingLinks(html) {
  const links = [];
  for (const match of String(html || "").matchAll(/<a\b[^>]*DetailsPlans\.aspx[^>]*>[\s\S]*?<\/a>/gi)) {
    const anchor = match[0];
    const href = attribute(anchor, "href");
    if (!href) continue;
    const url = new URL(href, INDEX_URL);
    const text = stripTags(anchor.replace(/^<a\b[^>]*>/i, "").replace(/<\/a>$/i, ""));
    const title = clean(attribute(anchor, "title") || text);
    const province = normalizeProvince(title || url.searchParams.get("aa") || "");
    if (!PROVINCES.includes(province)) continue;
    const af = url.searchParams.get("af") || "";
    const category = af === "1" ? "ordinary" : af === "2" ? "arts" : af === "3" ? "sports" : "other";
    links.push({
      province,
      category,
      title,
      href: url.toString(),
      url: url.toString(),
      provinceCode: PROVINCE_CODES.get(province) || "",
    });
  }
  const unique = new Map();
  for (const link of links) unique.set(link.href, link);
  return [...unique.values()];
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

function classifyPlan(batch, planType, title = "") {
  const text = clean(`${batch} ${planType} ${title}`);
  const special = /国家专项|地方专项|高校专项|专项计划|少数民族|民族|预科|定向|南疆|援疆|提前|艺术|美术|音乐|播音|体育|中外合作|特殊类型/.test(text);
  let admissionType = "普通录取";
  if (/国家专项/.test(text)) admissionType = "国家专项";
  else if (/地方专项/.test(text)) admissionType = "地方专项";
  else if (/高校专项/.test(text)) admissionType = "高校专项";
  else if (/艺术|美术|音乐|播音/.test(text)) admissionType = "艺术类";
  else if (/体育/.test(text)) admissionType = "体育类";
  else if (/预科|少数民族|民族/.test(text)) admissionType = "民族/预科";
  else if (/定向|南疆|援疆|提前|中外合作|特殊类型/.test(text)) admissionType = "特殊路径";
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
              : "普通本科批";
  return {
    admissionType,
    admissionSubtype: clean(planType) || normalizedBatch,
    batch: normalizedBatch,
    formalScoreScope: special ? "special-path-only" : "school-official-only",
  };
}

function splitMajorName(value) {
  const raw = clean(value);
  const marker = raw.search(/\s+(?=含|不招|限招|只招|说明|备注|外语|色盲|色弱|单色识别|校区|学费|要求)/);
  if (marker < 0) return { majorName: raw, planRemark: "" };
  return { majorName: raw.slice(0, marker).trim(), planRemark: raw.slice(marker).trim() };
}

function parsePlanDetailHtml(html, link = {}) {
  const tableRows = [];
  for (const tr of String(html || "").match(/<tr\b[\s\S]*?<\/tr>/gi) || []) {
    const cells = [...tr.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => stripTags(match[1]));
    if (cells.length) tableRows.push(cells);
  }
  const headerIndex = tableRows.findIndex((cells) => cells.some((cell) => /专业名称/.test(cell)) && cells.some((cell) => /计划数/.test(cell)));
  if (headerIndex < 0) return [];
  const headers = tableRows[headerIndex].map(clean);
  const majorIndex = headers.findIndex((header) => /专业名称/.test(header));
  const planIndex = headers.findIndex((header) => /计划数/.test(header));
  const batchIndex = headers.findIndex((header) => /批次/.test(header));
  const subjectIndex = headers.findIndex((header) => /科类|选考/.test(header));
  const typeIndex = headers.findIndex((header) => /计划性质|计划类别|类别/.test(header));
  const province = normalizeProvince(link.province || link.title || "");
  const rows = [];
  for (const cells of tableRows.slice(headerIndex + 1)) {
    const majorRaw = clean(cells[majorIndex] || "");
    const planCount = parseInteger(cells[planIndex]);
    if (!majorRaw || /合计计划数|专业名称/.test(majorRaw) || !Number.isFinite(planCount)) continue;
    const sourceBatchRaw = clean(cells[batchIndex] || "") || clean(link.title || "");
    const sourceSubjectRaw = clean(cells[subjectIndex] || "");
    const sourcePlanTypeRaw = clean(cells[typeIndex] || "");
    const classification = classifyPlan(sourceBatchRaw, sourcePlanTypeRaw, link.title);
    const { majorName, planRemark } = splitMajorName(majorRaw);
    rows.push({
      province,
      year: Number(new URL(link.url || INDEX_URL).searchParams.get("ae")) || 2026,
      majorName,
      planRemark,
      planCount,
      sourceBatchRaw,
      sourceSubjectRaw,
      sourcePlanTypeRaw,
      subjectType: subjectTypeFrom(sourceSubjectRaw),
      ...classification,
    });
  }
  return rows;
}

function hiddenInputs(html) {
  const fields = {};
  for (const match of String(html || "").matchAll(/<input\b[^>]*type=["']hidden["'][^>]*>/gi)) {
    const tag = match[0];
    const name = attribute(tag, "name");
    if (name) fields[name] = attribute(tag, "value");
  }
  return fields;
}

function pageNumber(html, id) {
  const match = new RegExp(`${id}[^>]*>(\\d+)<`, "i").exec(html);
  return match ? Number(match[1]) : 0;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url, options = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: options.method || "GET",
        body: options.body,
        signal: AbortSignal.timeout(90_000),
        headers: {
          "user-agent": "Mozilla/5.0 gaokao-suda-v348-importer/1.0",
          accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          "accept-language": "zh-CN,zh;q=0.9,en;q=0.6",
          referer: INDEX_URL,
          ...(options.body ? { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" } : {}),
        },
      });
      const text = (await response.text()).replace(/\0/g, "");
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}: ${text.slice(0, 160)}`);
      if (text.length < 100) throw new Error(`Unexpectedly short response for ${url}`);
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

async function listingPages(rawDir, useCache) {
  let html = await cachedText(path.join(rawDir, "listing-page-01.html"), useCache, () => fetchText(INDEX_URL));
  const pages = [];
  for (let index = 1; index <= 20; index += 1) {
    const current = pageNumber(html, "Label3");
    const total = pageNumber(html, "Label2");
    pages.push(html);
    if (!current || !total || current >= total) break;
    const body = hiddenInputs(html);
    body.__EVENTTARGET = "ctl00$ContentPlaceHolder1$LinkButton1";
    body.__EVENTARGUMENT = "";
    html = await cachedText(path.join(rawDir, `listing-page-${String(current + 1).padStart(2, "0")}.html`), useCache, () =>
      fetchText(INDEX_URL, { method: "POST", body: new URLSearchParams(body) })
    );
  }
  return pages;
}

function recordFromPlanRow(row, link) {
  const majorGroup = `${SOURCE.schoolName}${row.province}|${row.batch}|${row.sourceSubjectRaw || "科类未公开"}`;
  const record = {
    id: `2026-suda-national-plan-${hash([row.province, row.batch, row.sourceSubjectRaw, row.sourcePlanTypeRaw, row.majorName, row.planCount].join("|"))}`,
    province: row.province,
    year: row.year,
    subjectType: row.subjectType,
    batch: row.batch,
    sourceBatchRaw: row.sourceBatchRaw,
    schoolName: SOURCE.schoolName,
    schoolCode: SOURCE.schoolCode,
    schoolTags: SOURCE.tags,
    city: SOURCE.city,
    dataType: "admission-plan",
    majorName: row.majorName,
    majorGroup,
    admissionType: row.admissionType,
    admissionSubtype: row.admissionSubtype,
    formalScoreScope: row.formalScoreScope,
    planCount: row.planCount,
    sourceSubjectRaw: row.sourceSubjectRaw,
    sourcePlanTypeRaw: row.sourcePlanTypeRaw,
    planRemark: row.planRemark || undefined,
    sourceQuality: SOURCE.quality,
    sourceId: SOURCE.id,
    schoolOfficialScope: "single-school-admission-plan",
    sourceUrl: link.url,
    sourcePageUrl: link.url,
    sourceIndexUrl: INDEX_URL,
    officialEvidencePath: path.relative(PROJECT_ROOT, link.rawFile || ""),
    cautions: [
      "本记录来自苏州大学本科招生网官方 2026 年分省分专业招生计划查询，只作当年专业池、计划数、科类和路径约束，不是投档线、录取最低分或录取概率。",
      "计划若有变动，以考生所在省招生考试主管部门公布的专业组、院校代码和计划数为准。",
    ],
  };
  if (!record.planRemark) delete record.planRemark;
  if (!record.officialEvidencePath) delete record.officialEvidencePath;
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
  const pages = await listingPages(rawDir, args.useCache);
  const links = pages.flatMap(parsePlanListingLinks).filter((link) => link.category === "ordinary");
  const uniqueLinks = [...new Map(links.map((link) => [link.href, link])).values()];
  if (uniqueLinks.length < 31) throw new Error(`Expected at least 31 ordinary plan links, got ${uniqueLinks.length}`);
  const records = [];
  const sourceFiles = pages.map((_, index) => path.join(rawDir, `listing-page-${String(index + 1).padStart(2, "0")}.html`));
  for (let index = 0; index < uniqueLinks.length; index += 1) {
    const link = uniqueLinks[index];
    const detailFile = path.join(rawDir, `detail-${String(index + 1).padStart(2, "0")}-${hash(link.href, 10)}.html`);
    const detailHtml = await cachedText(detailFile, args.useCache, () => fetchText(link.url));
    sourceFiles.push(detailFile);
    const rows = parsePlanDetailHtml(detailHtml, { ...link, rawFile: detailFile });
    records.push(...rows.map((row) => recordFromPlanRow(row, { ...link, rawFile: detailFile })));
    if (!args.useCache) await sleep(80);
  }
  const uniqueRecords = [...new Map(records.map((record) => [record.id, record])).values()];
  const provinces = [...new Set(uniqueRecords.map((record) => record.province))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const sourceNote = {
    id: SOURCE.id,
    title: "苏州大学本科招生网：2026年分省分专业招生计划",
    publisher: "苏州大学本科招生办公室",
    url: INDEX_URL,
    pageUrl: INDEX_URL,
    quality: SOURCE.quality,
    usage: "抽取苏州大学本科招生网 2026 年各省普通/专项计划详情页；用于当年专业池、计划数、科类和特殊路径约束，不替代省级考试院计划、投档线或专业录取分。",
    parsedRecords: uniqueRecords.length,
    planRecords: uniqueRecords.length,
    provinceCount: provinces.length,
    linkCount: uniqueLinks.length,
    provinces,
    byProvince: countBy(uniqueRecords, (record) => record.province),
    byBatch: countBy(uniqueRecords, (record) => record.batch),
    byFormalScoreScope: countBy(uniqueRecords, (record) => record.formalScoreScope),
    bySubjectType: countBy(uniqueRecords, (record) => record.subjectType),
    rawPaths: sourceFiles.map((file) => path.relative(PROJECT_ROOT, file)),
    sha256: sourceFiles.filter((file) => fs.existsSync(file)).map((file) => ({ path: path.relative(PROJECT_ROOT, file), sha256: sha256File(file) })),
    transcriptionMethod: "official-server-rendered-html-table",
    cautions: [
      "本源是学校官网单校招生计划，不是省级考试院全量计划或投档录取数据。",
      "页面明确说明计划若有变动，以考生所在省招生考试主管部门公布的专业组、院校代码和计划数为准。",
      "国家专项、高校专项、提前批、艺术体育等已按 special-path-only 隔离，不与普通批次自动推荐混用。",
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
    listingPages: pages.length,
    links: uniqueLinks.length,
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
