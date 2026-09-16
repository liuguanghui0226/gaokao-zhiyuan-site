#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUT = "data/admissions/official-national-school-plan-2026-v354-usst-import.json";
const RAW_DIR = "data/admissions/raw/official-national-school-plan-2026-v354-usst";
const PAGE_URL = "https://chaxun.usst.edu.cn/zsfx/webrecruit/newWebsitePlanQueryusst.do";
const INDEX_URL = "https://zhaoban.usst.edu.cn/";
const BASE_URL = "https://chaxun.usst.edu.cn/zsfx/";
const SOURCE = {
  id: "official-usst-national-plan-2026",
  quality: "official-school-usst-2026-national-plan-query",
  schoolCode: "10252",
  schoolName: "上海理工大学",
  city: "上海",
  tags: ["上海", "理工", "工科"],
};

function usage() {
  return `Usage:\n  node scripts/import-official-national-school-plan-2026-v354-usst.mjs --out ${DEFAULT_OUT}\n  node scripts/import-official-national-school-plan-2026-v354-usst.mjs --use-cache`;
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

function hash(value, length = 18) { return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, length); }
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function clean(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/[\u00a0　]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function subjectTypeFrom(raw) {
  const text = clean(raw);
  if (/艺术|美术|音乐|舞蹈|播音/.test(text)) return "艺术类";
  if (/体育/.test(text)) return "体育类";
  if (/文史|文科|历史/.test(text)) return "历史类";
  if (/理工|理科|物理/.test(text)) return "物理类";
  if (/综合/.test(text)) return "综合改革";
  return text || "综合";
}

function classifyPlan(row) {
  const major = clean(row.major);
  const cooperation = /中外合作|中英合作|中德合作|合作办学/.test(major);
  const art = subjectTypeFrom(row.subjectRaw) === "艺术类";
  const national = /国家专项/.test(clean(row.remark));
  if (art) return { admissionType: "艺术类", admissionSubtype: clean(row.remark) || "艺术类", formalScoreScope: "special-path-only" };
  if (national) return { admissionType: "国家专项", admissionSubtype: "国家专项", formalScoreScope: "special-path-only" };
  if (cooperation) return { admissionType: "中外合作办学", admissionSubtype: "中外合作办学", formalScoreScope: "special-path-only" };
  return { admissionType: "普通录取", admissionSubtype: "普通录取", formalScoreScope: "school-official-only" };
}

function parsePlanTableRows(html) {
  const tableMatch = String(html).match(/<table\b[^>]*class=["'][^"']*\bzstable\b[^"']*["'][^>]*>([\s\S]*?)<\/table>/i);
  const table = tableMatch ? tableMatch[1] : String(html);
  const bodyMatch = table.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i);
  const body = bodyMatch ? bodyMatch[1] : table;
  const rows = [];
  for (const match of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => clean(cell[1]));
    if (cells.length < 7) continue;
    const planCount = Number(cells[5].replace(/[,，]/g, ""));
    if (!Number.isInteger(planCount) || planCount <= 0) continue;
    rows.push({
      year: Number(cells[0]),
      province: cells[1],
      subjectRaw: cells[2],
      major: cells[3],
      includedMajors: cells[4],
      planCount,
      remark: cells[6],
    });
  }
  return rows;
}

function parseProvinceOptions(payload) {
  const rows = typeof payload === "string" ? JSON.parse(payload) : payload;
  if (!Array.isArray(rows)) throw new Error("USST province options must be an array");
  return rows.map((row) => clean(row.sf)).filter(Boolean);
}

function parseClassOptions(payload) {
  const rows = typeof payload === "string" ? JSON.parse(payload) : payload;
  if (!Array.isArray(rows)) throw new Error("USST class options must be an array");
  return rows.map((row) => clean(row.kl)).filter(Boolean);
}

function composeRemark(row) {
  return [clean(row.includedMajors), clean(row.remark)].filter(Boolean).join("；");
}

function recordFromPlanRow(row, meta = {}) {
  const classification = classifyPlan(row);
  const record = {
    id: `2026-usst-national-plan-${hash([row.province, row.subjectRaw, row.major, row.includedMajors, row.remark, row.planCount].join("|"))}`,
    province: row.province,
    year: row.year || 2026,
    sourcePlanYear: row.year || 2026,
    subjectType: subjectTypeFrom(row.subjectRaw),
    schoolName: SOURCE.schoolName,
    schoolCode: SOURCE.schoolCode,
    schoolTags: SOURCE.tags,
    city: SOURCE.city,
    dataType: "admission-plan",
    majorName: row.major,
    sourceMajorGroupRaw: row.includedMajors,
    planCount: row.planCount,
    sourceSubjectRaw: row.subjectRaw,
    formalScoreScope: classification.formalScoreScope,
    admissionType: classification.admissionType,
    admissionSubtype: classification.admissionSubtype,
    schoolOfficialScope: "single-school-admission-plan",
    planRemark: composeRemark(row),
    sourceQuality: SOURCE.quality,
    sourceId: SOURCE.id,
    sourceUrl: PAGE_URL,
    sourcePageUrl: PAGE_URL,
    sourceIndexUrl: INDEX_URL,
    officialEvidencePath: meta.rawPath || `${RAW_DIR}/plan-results.json`,
    cautions: [
      "本记录来自上海理工大学招生信息查询页公开的 2026 年分省分专业计划，只作当年专业池、计划数和科类约束，不是投档线、录取最低分或录取概率。",
      "官网提示具体以各省（市、自治区）招生主管部门公布信息为准；原查询不包含高水平运动队、外语类保送生、预科生、南疆单列、喀什定向、内高班、民族班等路径。",
      "原查询未提供批次、专业代码、选科要求和学费，运行层不对这些字段作推断；中外合作专业按特殊路径隔离。",
    ],
  };
  for (const key of Object.keys(record)) {
    if (record[key] === undefined || record[key] === "" || (Array.isArray(record[key]) && record[key].length === 0)) delete record[key];
  }
  return record;
}

function updateCookie(session, response) {
  const cookie = response.headers.get("set-cookie");
  if (cookie) session.cookie = cookie.split(";")[0];
}

async function sleep(ms) { await new Promise((resolve) => setTimeout(resolve, ms)); }

async function requestText(session, relativePath, body) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const headers = { accept: "*/*", "user-agent": "Mozilla/5.0 gaokao-usst-v354-importer/1.0" };
      if (session.cookie) headers.cookie = session.cookie;
      const options = { method: body ? "POST" : "GET", headers, signal: AbortSignal.timeout(90_000) };
      if (body) {
        headers["content-type"] = "application/x-www-form-urlencoded; charset=UTF-8";
        options.body = new URLSearchParams(body);
      }
      const response = await fetch(`${BASE_URL}${relativePath}`, options);
      updateCookie(session, response);
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${relativePath}`);
      if (!text.trim()) throw new Error(`Empty response for ${relativePath}`);
      return text;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(attempt * 750);
    }
  }
  throw lastError;
}

async function fetchOfficialPayload() {
  const session = { cookie: "" };
  const pageText = await requestText(session, "webrecruit/newWebsitePlanQueryusst.do");
  const provinceOptions = parseProvinceOptions(await requestText(session, "websitesearch/plan/getsf.do", { year: "2026" }));
  const classOptions = [];
  const queries = [];
  for (const province of provinceOptions) {
    const classes = parseClassOptions(await requestText(session, "websitesearch/plan/getkl.do", { year: "2026", sf: province }));
    classOptions.push({ province, classes });
    // Leaving KLID empty is the official page's all-category query. It is
    // required for the seven art rows, which are listed by the selector but
    // return an empty result when queried independently.
    const html = await requestText(session, "webrecruit/newWebsitePlanQueryusst.do", {
      id: "2", YEAR: "2026", SSID: province, KLID: "", zy: "",
    });
    queries.push({ year: 2026, province, classes, html });
  }
  return {
    pageText,
    provinceOptions,
    classOptions,
    queries,
    request: { baseUrl: BASE_URL, page: "webrecruit/newWebsitePlanQueryusst.do", options: "websitesearch/plan/getsf.do", classes: "websitesearch/plan/getkl.do" },
  };
}

function rowsFromPayload(payload) {
  if (!Array.isArray(payload?.queries)) throw new Error("USST cached payload is missing queries");
  return payload.queries.flatMap((query) => parsePlanTableRows(query.html).map((row) => ({ ...row, province: query.province, subjectRaw: row.subjectRaw || query.subjectRaw })));
}

function countBy(records, predicate) { return records.filter(predicate).length; }

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(usage()); return; }
  const rawDir = path.resolve(PROJECT_ROOT, RAW_DIR);
  fs.mkdirSync(rawDir, { recursive: true });
  const pageFile = path.join(rawDir, "index.html");
  const provinceFile = path.join(rawDir, "province-options.json");
  const classFile = path.join(rawDir, "class-options.json");
  const queriesFile = path.join(rawDir, "plan-results.json");
  const requestFile = path.join(rawDir, "request.json");
  let fetched;
  if (args.useCache && fs.existsSync(pageFile) && fs.existsSync(provinceFile) && fs.existsSync(classFile) && fs.existsSync(queriesFile)) {
    const cachedQueries = JSON.parse(fs.readFileSync(queriesFile, "utf8"));
    fetched = {
      pageText: fs.readFileSync(pageFile, "utf8"),
      provinceOptions: JSON.parse(fs.readFileSync(provinceFile, "utf8")),
      classOptions: JSON.parse(fs.readFileSync(classFile, "utf8")),
      queries: Array.isArray(cachedQueries) ? cachedQueries : cachedQueries.queries,
      request: fs.existsSync(requestFile) ? JSON.parse(fs.readFileSync(requestFile, "utf8")) : {},
    };
    if (Array.isArray(cachedQueries)) fs.writeFileSync(queriesFile, `${JSON.stringify({ year: 2026, queries: fetched.queries })}\n`);
  } else {
    fetched = await fetchOfficialPayload();
    fs.writeFileSync(pageFile, fetched.pageText);
    fs.writeFileSync(provinceFile, `${JSON.stringify(fetched.provinceOptions, null, 2)}\n`);
    fs.writeFileSync(classFile, `${JSON.stringify(fetched.classOptions, null, 2)}\n`);
    fs.writeFileSync(queriesFile, `${JSON.stringify({ year: 2026, queries: fetched.queries })}\n`);
    fs.writeFileSync(requestFile, `${JSON.stringify(fetched.request, null, 2)}\n`);
  }
  const rawRows = rowsFromPayload(fetched);
  const records = rawRows.map((row) => recordFromPlanRow(row));
  const provinces = [...new Set(records.map((record) => record.province))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const duplicateIds = records.length - new Set(records.map((record) => record.id)).size;
  const planCount = records.reduce((sum, record) => sum + Number(record.planCount || 0), 0);
  if (fetched.provinceOptions.length !== 30) throw new Error(`Unexpected USST province count: ${fetched.provinceOptions.length}`);
  if (provinces.length !== 30) throw new Error(`Unexpected parsed USST province count: ${provinces.length}`);
  if (records.length !== 318) throw new Error(`Unexpected USST record count: ${records.length}`);
  if (planCount !== 4264) throw new Error(`Unexpected USST plan count: ${planCount}`);
  if (duplicateIds !== 0) throw new Error(`Duplicate USST record ids: ${duplicateIds}`);
  const sourceNote = {
    id: SOURCE.id,
    title: "上海理工大学 2026 年分省分专业招生计划查询",
    publisher: "上海理工大学本科招生网",
    url: PAGE_URL,
    quality: SOURCE.quality,
    schoolCode: SOURCE.schoolCode,
    schoolName: SOURCE.schoolName,
    records: records.length,
    planCount,
    provinces: provinces.length,
    queryCount: fetched.queries.length,
    excludedCategories: ["高水平运动队", "外语类保送生", "预科生", "南疆单列", "喀什定向", "内高班", "民族班"],
    cautions: [
      "接口原始计划中山西有 1 条国家专项记录；其他官方录取进展展示未必逐项呈现，保留原始计划但不替省级目录作最终确认。",
      "本次按每省 KLID 为空的官方全量查询保存 7 条艺术类记录；逐科类筛选器对艺术类可能返回空，因此该接口仍只代表公开查询子集，不宣称覆盖学校全部本科计划。",
    ],
    usage: "仅用于当年专业池、计划数和科类约束，不替代省级考试院目录、投档线或录取概率。",
    evidencePath: `${RAW_DIR}/plan-results.json`,
    pageSha256: sha256File(pageFile),
  };
  const output = {
    version: "v3.354",
    generatedAt: new Date().toISOString(),
    type: "official-national-school-plan-import",
    sourceNotes: [sourceNote],
    records,
  };
  const outputPath = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ status: "ok", version: output.version, out: path.relative(PROJECT_ROOT, outputPath), records: records.length, provinces: provinces.length, planCount, ordinaryRecords: countBy(records, (record) => record.formalScoreScope === "school-official-only"), specialPathRecords: countBy(records, (record) => record.formalScoreScope === "special-path-only"), pageSha256: sourceNote.pageSha256 }, null, 2));
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
