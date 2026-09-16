#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUT = "data/admissions/official-national-school-plan-2026-v355-qlu-import.json";
const RAW_DIR = "data/admissions/raw/official-national-school-plan-2026-v355-qlu";
const PAGE_URL = "https://zsb.qlu.edu.cn/plan";
const CHARTER_URL = "https://zsb.qlu.edu.cn/article/1193";
const CLOSURE_URL = "https://www.qlu.edu.cn/2026/0626/c11618a280305/page.htm";
const INDEX_URL = "https://zsb.qlu.edu.cn/";
const BASE_URL = "https://zsb.qlu.edu.cn";
const SOURCE = {
  id: "official-qlu-national-plan-2026",
  quality: "official-school-qlu-2026-national-plan-api",
  schoolCode: "10431",
  schoolName: "齐鲁工业大学",
  city: "济南",
  tags: ["山东", "济南", "理工", "轻工"],
};
const EXCLUDED_REGIONS = new Set(["台湾", "香港", "澳门"]);

function usage() {
  return `Usage:\n  node scripts/import-official-national-school-plan-2026-v355-qlu.mjs --out ${DEFAULT_OUT}\n  node scripts/import-official-national-school-plan-2026-v355-qlu.mjs --use-cache`;
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

function electiveRequirementFrom(raw) {
  const text = clean(raw);
  if (!text || text === "——" || text === "-") return undefined;
  if (/不提科目要求/.test(text)) return "不提科目要求";
  return text
    .replace(/[、和+]+/g, "，")
    .replace(/[，,]+/g, "，")
    .replace(/\s+/g, "")
    .replace(/（[^）]*）|\([^)]*\)/g, "") || undefined;
}

function classifyPlan(row) {
  const category = clean(row.categoryName);
  const type = clean(row.typeName);
  if (/艺术/.test(category) || /艺考/.test(type)) return { admissionType: "艺术类", admissionSubtype: type || category, formalScoreScope: "special-path-only" };
  if (/体育/.test(category)) return { admissionType: "体育类", admissionSubtype: type || category, formalScoreScope: "special-path-only" };
  if (/地方专项/.test(type)) return { admissionType: "地方专项", admissionSubtype: type, formalScoreScope: "special-path-only" };
  if (/民族班/.test(type)) return { admissionType: "民族班", admissionSubtype: type, formalScoreScope: "special-path-only" };
  if (/菏泽校区/.test(type)) return { admissionType: "菏泽校区", admissionSubtype: type, formalScoreScope: "special-path-only" };
  if (/中外合作/.test(type) || /中外合作/.test(clean(row.major))) return { admissionType: "中外合作办学", admissionSubtype: type || "中外合作", formalScoreScope: "special-path-only" };
  return { admissionType: "普通录取", admissionSubtype: type || "普通类", formalScoreScope: "school-official-only" };
}

function parseProvinceOptions(html) {
  const scoped = String(html).match(/<ul\b[^>]*class=["'][^"']*province-box-ul[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1] || "";
  return [...scoped.matchAll(/<li\b[^>]*data-id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => ({ id: clean(match[1]), name: clean(match[2]) }))
    .filter((province) => province.id && province.name && !EXCLUDED_REGIONS.has(province.name));
}

function parsePlanRows(payload, expected = {}) {
  const rows = payload?.data;
  if (!Array.isArray(rows)) throw new Error("QLU plan payload is missing data array");
  return rows.map((row) => {
    const planCount = Number(String(row.scheduled_count ?? "").replace(/[,，]/g, ""));
    const province = clean(row.province_name);
    const major = clean(row.major_name);
    const categoryName = clean(row.category_name);
    const typeName = clean(row.type_name);
    if (!province || !major || !Number.isInteger(planCount) || planCount <= 0) throw new Error(`Invalid QLU plan row: ${JSON.stringify(row).slice(0, 500)}`);
    if (expected.provinceName && province !== expected.provinceName) throw new Error(`QLU plan province mismatch: expected ${expected.provinceName}, got ${province}`);
    if (expected.categoryName && categoryName !== expected.categoryName) throw new Error(`QLU plan category mismatch: expected ${expected.categoryName}, got ${categoryName}`);
    if (expected.typeName && typeName !== expected.typeName) throw new Error(`QLU plan type mismatch: expected ${expected.typeName}, got ${typeName}`);
    return {
      province,
      major,
      includedMajors: clean(row.majors_included),
      categoryName,
      typeName,
      batch: clean(row.batch),
      planCount,
      electiveRaw: clean(row.elective_subjects),
      sourceProvinceId: clean(payload.sourceProvinceId),
      sourceYearId: clean(payload.sourceYearId),
      sourceCategoryId: clean(payload.sourceCategoryId),
      sourceTypeId: clean(payload.sourceTypeId),
    };
  });
}

function composeRemark(row) {
  const parts = [];
  if (row.typeName && row.typeName !== "普通类") parts.push(`原始类型：${row.typeName}`);
  if (row.includedMajors && row.includedMajors !== "——") parts.push(`涵盖专业：${row.includedMajors}`);
  return parts.join("；");
}

function recordFromPlanRow(row, meta = {}) {
  const classification = classifyPlan(row);
  const record = {
    id: `2026-qlu-national-plan-${hash([row.province, row.categoryName, row.typeName, row.batch, row.major, row.includedMajors, row.planCount, row.sourceTypeId].join("|"))}`,
    province: row.province,
    year: 2026,
    sourcePlanYear: 2026,
    subjectType: subjectTypeFrom(row.categoryName),
    batch: row.batch,
    sourceBatchRaw: row.batch,
    schoolName: SOURCE.schoolName,
    schoolCode: SOURCE.schoolCode,
    schoolTags: SOURCE.tags,
    city: row.typeName === "菏泽校区" ? "菏泽" : SOURCE.city,
    campus: row.typeName === "菏泽校区" ? "菏泽校区" : undefined,
    dataType: "admission-plan",
    majorName: row.major,
    sourceMajorGroupRaw: row.includedMajors,
    electiveRequirement: electiveRequirementFrom(row.electiveRaw),
    planCount: row.planCount,
    sourceSubjectRaw: row.categoryName,
    sourcePlanTypeRaw: row.typeName,
    sourceProvinceId: row.sourceProvinceId,
    sourceYearId: row.sourceYearId,
    sourceCategoryId: row.sourceCategoryId,
    sourceTypeId: row.sourceTypeId,
    formalScoreScope: classification.formalScoreScope,
    admissionType: classification.admissionType,
    admissionSubtype: classification.admissionSubtype,
    schoolOfficialScope: "single-school-admission-plan",
    planRemark: composeRemark(row),
    sourceQuality: SOURCE.quality,
    sourceId: SOURCE.id,
    sourceUrl: `${BASE_URL}/home/api/plan`,
    sourcePageUrl: PAGE_URL,
    sourceIndexUrl: INDEX_URL,
    officialEvidencePath: meta.rawPath || `${RAW_DIR}/api-snapshot.json`,
    cautions: [
      "本记录来自齐鲁工业大学本科招生网公开 2026 年分省分专业计划 API，只作当年专业池、计划数、科类、批次、选科和路径约束，不是投档线、录取最低分或录取概率。",
      "学校章程明确最终计划以各省教育主管部门公布为准；地方专项、民族班、艺术、体育、菏泽校区和中外合作办学已按原始类型隔离。",
      "API 2026 年有计划的省份为 28 个；西藏、青海、宁夏没有返回计划，不补造零计划记录；原数据未提供专业代码、专业组代码和学费，不作推断。",
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

async function requestJson(session, relativePath, body) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const headers = { accept: "application/json, text/plain, */*", "content-type": "application/x-www-form-urlencoded; charset=UTF-8", "user-agent": "Mozilla/5.0 gaokao-qlu-v355-importer/1.0" };
      if (session.cookie) headers.cookie = session.cookie;
      const response = await fetch(`${BASE_URL}${relativePath}`, { method: "POST", headers, body: new URLSearchParams(body), signal: AbortSignal.timeout(90_000) });
      updateCookie(session, response);
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${relativePath}`);
      const payload = JSON.parse(text);
      if (payload?.code !== 200) throw new Error(`QLU API error for ${relativePath}: ${JSON.stringify(payload).slice(0, 400)}`);
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(attempt * 750);
    }
  }
  throw lastError;
}

async function fetchOfficialPayload() {
  const session = { cookie: "" };
  const pageResponse = await fetch(PAGE_URL, { headers: { "user-agent": "Mozilla/5.0 gaokao-qlu-v355-importer/1.0" }, signal: AbortSignal.timeout(90_000) });
  updateCookie(session, pageResponse);
  const pageText = await pageResponse.text();
  if (!pageResponse.ok || pageText.length < 1000) throw new Error(`Unexpected QLU plan page response: ${pageResponse.status}`);
  const provinceOptions = parseProvinceOptions(pageText);
  const paths = [];
  const emptyProvinces = [];
  for (const province of provinceOptions) {
    const years = await requestJson(session, "/home/api/biz_dict", { biz_category_id: 2, biz_type: province.id, biz_code: 1 });
    const year = years.data.find((item) => clean(item.biz_name) === "2026");
    if (!year) { emptyProvinces.push(province.name); continue; }
    const categories = await requestJson(session, "/home/api/biz_dict", { biz_category_id: 3, biz_type: year.id, biz_code: 1 });
    for (const category of categories.data) {
      const types = await requestJson(session, "/home/api/biz_dict", { biz_category_id: 4, biz_type: category.id, biz_code: 1 });
      for (const type of types.data) {
        const payload = await requestJson(session, "/home/api/plan", { type_id: type.id });
        const rows = parsePlanRows({ data: payload.data, sourceProvinceId: province.id, sourceYearId: year.id, sourceCategoryId: category.id, sourceTypeId: type.id }, { provinceName: province.name, categoryName: clean(category.biz_name), typeName: clean(type.biz_name) });
        if (rows.length) paths.push({ province, year: { id: clean(year.id), name: clean(year.biz_name) }, category: { id: clean(category.id), name: clean(category.biz_name) }, type: { id: clean(type.id), name: clean(type.biz_name) }, rows });
      }
    }
  }
  const rows = paths.flatMap((pathItem) => pathItem.rows);
  return { pageText, provinceOptions, paths, rows, emptyProvinces, request: { pageUrl: PAGE_URL, dictionaryEndpoint: "/home/api/biz_dict", planEndpoint: "/home/api/plan", year: 2026 } };
}

function countBy(records, keyFn) {
  const counts = {};
  for (const record of records) { const key = keyFn(record); counts[key] = (counts[key] || 0) + 1; }
  return counts;
}

function sumBy(records, keyFn, valueFn) {
  const sums = {};
  for (const record of records) { const key = keyFn(record); sums[key] = (sums[key] || 0) + valueFn(record); }
  return sums;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(usage()); return; }
  const rawDir = path.resolve(PROJECT_ROOT, RAW_DIR);
  fs.mkdirSync(rawDir, { recursive: true });
  const pageFile = path.join(rawDir, "plan.html");
  const snapshotFile = path.join(rawDir, "api-snapshot.json");
  const requestFile = path.join(rawDir, "request.json");
  let fetched;
  if (args.useCache && fs.existsSync(pageFile) && fs.existsSync(snapshotFile)) {
    const snapshot = JSON.parse(fs.readFileSync(snapshotFile, "utf8"));
    fetched = { pageText: fs.readFileSync(pageFile, "utf8"), ...snapshot, request: fs.existsSync(requestFile) ? JSON.parse(fs.readFileSync(requestFile, "utf8")) : {} };
  } else {
    fetched = await fetchOfficialPayload();
    fs.writeFileSync(pageFile, fetched.pageText);
    fs.writeFileSync(snapshotFile, `${JSON.stringify({ year: 2026, provinceOptions: fetched.provinceOptions, paths: fetched.paths, rows: fetched.rows, emptyProvinces: fetched.emptyProvinces }, null, 2)}\n`);
    fs.writeFileSync(requestFile, `${JSON.stringify(fetched.request, null, 2)}\n`);
  }
  const rows = fetched.rows || fetched.paths.flatMap((pathItem) => pathItem.rows);
  const records = rows.map((row) => recordFromPlanRow(row));
  const provinces = [...new Set(records.map((record) => record.province))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const planCount = records.reduce((sum, record) => sum + Number(record.planCount || 0), 0);
  const duplicateIds = records.length - new Set(records.map((record) => record.id)).size;
  const byType = countBy(rows, (row) => row.typeName);
  const byTypePlanCount = sumBy(rows, (row) => row.typeName, (row) => row.planCount);
  if (records.length !== 459) throw new Error(`Unexpected QLU record count: ${records.length}`);
  if (planCount !== 8460) throw new Error(`Unexpected QLU plan count: ${planCount}`);
  if (provinces.length !== 28) throw new Error(`Unexpected QLU province count: ${provinces.length}`);
  if (fetched.paths.length !== 62) throw new Error(`Unexpected QLU path count: ${fetched.paths.length}`);
  if (duplicateIds !== 0) throw new Error(`Duplicate QLU record ids: ${duplicateIds}`);
  const sourceNote = {
    id: SOURCE.id,
    title: "齐鲁工业大学 2026 年分省分专业招生计划",
    publisher: "齐鲁工业大学本科招生网",
    url: PAGE_URL,
    quality: SOURCE.quality,
    schoolCode: SOURCE.schoolCode,
    schoolName: SOURCE.schoolName,
    records: records.length,
    planCount,
    provinces: provinces.length,
    pathCount: fetched.paths.length,
    provinceOptions: fetched.provinceOptions.length,
    emptyProvinces: fetched.emptyProvinces,
    byType,
    byTypePlanCount,
    headlinePlanCount: 8460,
    apiPlanCount: planCount,
    unattributedDelta: 0,
    charterUrl: CHARTER_URL,
    closureUrl: CLOSURE_URL,
    evidencePath: `${RAW_DIR}/api-snapshot.json`,
    pageSha256: sha256File(pageFile),
    usage: "仅用于当年专业池、计划数、科类、批次、选科和特殊路径约束，不替代省级考试院目录、投档线或录取概率。",
    cautions: [
      "官方大学公告确认 2026 年面向 28 省、本科招生总计划 8460 人；API 明细与该总量闭合。",
      "西藏、青海、宁夏在省份选项中存在，但 2026 年没有返回计划；不补造零计划记录。",
      "API 未提供专业代码、专业组代码和学费；菏泽校区、中外合作、地方专项、民族班、艺术和体育保留原始路径，不与普通录取边界混用。",
    ],
  };
  const output = { version: "v3.355", generatedAt: new Date().toISOString(), type: "official-national-school-plan-import", sourceNotes: [sourceNote], records };
  const outputPath = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ status: "ok", version: output.version, out: path.relative(PROJECT_ROOT, outputPath), records: records.length, provinces: provinces.length, planCount, ordinaryRecords: records.filter((record) => record.formalScoreScope === "school-official-only").length, specialPathRecords: records.filter((record) => record.formalScoreScope === "special-path-only").length, pathCount: fetched.paths.length, pageSha256: sourceNote.pageSha256 }, null, 2));
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
