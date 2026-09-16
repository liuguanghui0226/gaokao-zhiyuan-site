#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUT = "data/admissions/official-national-school-plan-2026-v356-sdnu-import.json";
const RAW_DIR = "data/admissions/raw/official-national-school-plan-2026-v356-sdnu";
const PAGE_URL = "https://bkzs.sdnu.edu.cn/zsw/zsjh.html";
const INDEX_URL = "https://bkzs.sdnu.edu.cn/";
const PARAM_ENDPOINT = "/f/ajax_zsjh_param";
const PLAN_ENDPOINT = "/f/ajax_zsjh";
const CHARTER_URL = "https://www.zsb.sdnu.edu.cn/info/1022/4692.htm";
const GUIDE_URL = "https://book.yunzhan365.com/itvkg/fase/mobile/index.html#p=1";
const BASE_URL = "https://bkzs.sdnu.edu.cn";
const SOURCE = {
  id: "official-sdnu-national-plan-2026",
  quality: "official-school-sdnu-2026-national-plan-api",
  schoolCode: "10445",
  schoolName: "山东师范大学",
  city: "济南",
  tags: ["山东", "济南", "师范", "综合"] ,
};
const EXPECTED = { records: 1032, planCount: 6119, provinces: 29, pathCount: 103 };
const MAINLAND_PROVINCES = [
  "北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "上海", "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "广西", "海南", "重庆", "四川", "贵州", "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆",
];

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT, useCache: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") args.out = argv[++index];
    else if (value === "--use-cache") args.useCache = true;
    else if (value === "--help" || value === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function clean(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[\u00a0　]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hash(value, length = 18) { return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, length); }
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }

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
    .replace(/（[^）]*）|\([^)]*\)/g, "")
    .replace(/[、和+]+/g, "，")
    .replace(/[，,]+/g, "，")
    .replace(/\s+/g, "") || undefined;
}

function classifyPlan(row) {
  const category = clean(row.categoryName);
  const type = clean(row.typeName);
  if (/艺术|艺考/.test(category) || /艺考|艺术/.test(type)) return { admissionType: "艺术类", admissionSubtype: type || category, formalScoreScope: "special-path-only" };
  if (/体育/.test(category) || /体育/.test(type)) return { admissionType: "体育类", admissionSubtype: type || category, formalScoreScope: "special-path-only" };
  if (/中外合作/.test(type)) return { admissionType: "中外合作办学", admissionSubtype: type, formalScoreScope: "special-path-only" };
  if (/国家专项/.test(type)) return { admissionType: "国家专项", admissionSubtype: type, formalScoreScope: "special-path-only" };
  if (/地方专项/.test(type)) return { admissionType: "地方专项", admissionSubtype: type, formalScoreScope: "special-path-only" };
  if (/公费师范/.test(type)) return { admissionType: "公费师范生", admissionSubtype: type, formalScoreScope: "special-path-only" };
  if (/定向西藏/.test(type)) return { admissionType: "定向西藏", admissionSubtype: type, formalScoreScope: "special-path-only" };
  if (/综合评价/.test(type)) return { admissionType: "综合评价", admissionSubtype: type, formalScoreScope: "special-path-only" };
  if (/提前/.test(type)) return { admissionType: "提前批", admissionSubtype: type, formalScoreScope: "special-path-only" };
  return { admissionType: "普通录取", admissionSubtype: type || "普通类", formalScoreScope: "school-official-only" };
}

function parseParamOptions(payload) {
  const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
  const list = parsed?.data?.ssmc_nf_klmc_sex_campus_zslx_list;
  if (!Array.isArray(list)) throw new Error("SDNU parameter payload is missing option list");
  const options = [];
  for (const item of list) {
    for (const [rawKey, rawTypes] of Object.entries(item || {})) {
      const key = clean(rawKey).replace(/_sex_campus$/, "");
      const first = key.indexOf("_");
      const second = key.indexOf("_", first + 1);
      if (first < 1 || second < 0) continue;
      const province = clean(key.slice(0, first));
      const year = clean(key.slice(first + 1, second));
      const category = clean(key.slice(second + 1));
      const types = [...new Set((Array.isArray(rawTypes) ? rawTypes : []).map(clean).filter(Boolean))];
      if (province && year && category && types.length) options.push({ province, year, category, types });
    }
  }
  return [...new Map(options.map((option) => [`${option.province}|${option.year}|${option.category}`, option])).values()];
}

function numericOrUndefined(value) {
  const text = clean(value).replace(/[,，]/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(text)) return undefined;
  return Number(text);
}

function parsePlanRows(payload, query) {
  const rows = payload?.data?.zsjhList || payload?.zsjhList;
  if (!Array.isArray(rows)) throw new Error("SDNU plan payload is missing zsjhList");
  return rows.map((row) => {
    const province = clean(row.ssmc);
    const year = clean(row.nf);
    const categoryName = clean(row.klmc);
    const typeName = clean(row.zslx || row.zylx);
    const majorName = clean(row.zymc || row.zydhmc);
    const planCount = Number(String(row.zsjhs ?? "").replace(/[,，]/g, ""));
    if (!province || !year || !categoryName || !typeName || !majorName || year !== "2026" || !Number.isInteger(planCount) || planCount <= 0) throw new Error(`Invalid SDNU plan row: ${JSON.stringify(row).slice(0, 500)}`);
    if (query?.province && province !== query.province) throw new Error(`SDNU province mismatch: expected ${query.province}, got ${province}`);
    if (query?.year && year !== query.year) throw new Error(`SDNU year mismatch: expected ${query.year}, got ${year}`);
    if (query?.category && categoryName !== query.category) throw new Error(`SDNU category mismatch: expected ${query.category}, got ${categoryName}`);
    if (query?.type && typeName !== query.type) throw new Error(`SDNU type mismatch: expected ${query.type}, got ${typeName}`);
    return {
      province, year: Number(year), categoryName, typeName, majorName,
      majorCode: clean(row.zydm) || undefined,
      majorGroupCode: clean(row.zydh) || undefined,
      majorGroupName: clean(row.zydhmc) || undefined,
      planCount,
      electiveRaw: clean(row.xkkm),
      tuition: numericOrUndefined(row.zyxf),
      batch: clean(row.zycc),
      duration: clean(row.zyxz || row.xz),
      remarks: clean(row.remarks),
      includedMajors: clean(row.bhzy),
      direction: clean(row.zkfx),
      targetedMajor: clean(row.tdzy),
      faculty: clean(row.xy),
      campus: clean(row.campus),
      cityRaw: clean(row.jdxq),
      sourceMajorGroupRaw: clean(row.zydhmc),
      sourceSubjectRaw: categoryName,
      sourcePlanTypeRaw: typeName,
      queryProvince: province,
      queryYear: year,
      queryCategory: categoryName,
      queryType: typeName,
    };
  });
}

function normalizeCity(raw) {
  const text = clean(raw).replace(/市$/, "");
  return text || SOURCE.city;
}

function composeRemark(row) {
  const parts = [];
  if (row.remarks) parts.push(row.remarks);
  if (row.includedMajors) parts.push(`包含专业：${row.includedMajors}`);
  if (row.direction) parts.push(`招考方向：${row.direction}`);
  if (row.targetedMajor) parts.push(`定向专业：${row.targetedMajor}`);
  if (row.faculty) parts.push(`院系：${row.faculty}`);
  return parts.join("；");
}

function recordFromPlanRow(row, meta = {}) {
  const classification = classifyPlan(row);
  const record = {
    id: `2026-sdnu-national-plan-${hash([row.province, row.categoryName, row.typeName, row.batch, row.majorName, row.majorCode, row.majorGroupCode, row.planCount].join("|"))}`,
    province: row.province,
    year: 2026,
    sourcePlanYear: 2026,
    subjectType: subjectTypeFrom(row.categoryName),
    batch: row.batch,
    sourceBatchRaw: row.batch,
    schoolName: SOURCE.schoolName,
    schoolCode: SOURCE.schoolCode,
    schoolTags: SOURCE.tags,
    city: normalizeCity(row.cityRaw),
    campus: row.campus || undefined,
    dataType: "admission-plan",
    majorName: row.majorName,
    majorCode: row.majorCode,
    majorGroup: row.majorGroupCode,
    sourceMajorGroupRaw: row.majorGroupName,
    electiveRequirement: electiveRequirementFrom(row.electiveRaw),
    planCount: row.planCount,
    tuition: row.tuition,
    programDuration: row.duration,
    educationLevel: /专科/.test(row.batch) ? "专科" : "本科",
    sourceSubjectRaw: row.sourceSubjectRaw,
    sourcePlanTypeRaw: row.sourcePlanTypeRaw,
    sourceProvinceQuery: row.queryProvince,
    sourceYearQuery: row.queryYear,
    sourceCategoryQuery: row.queryCategory,
    sourceTypeQuery: row.queryType,
    formalScoreScope: classification.formalScoreScope,
    admissionType: classification.admissionType,
    admissionSubtype: classification.admissionSubtype,
    schoolOfficialScope: "single-school-admission-plan",
    planRemark: composeRemark(row),
    sourceQuality: SOURCE.quality,
    sourceId: SOURCE.id,
    sourceUrl: `${BASE_URL}${PLAN_ENDPOINT}`,
    sourcePageUrl: PAGE_URL,
    sourceIndexUrl: INDEX_URL,
    officialEvidencePath: meta.evidencePath || `${RAW_DIR}/api-snapshot.json`,
    cautions: [
      "本记录来自山东师范大学本科招生网公开 2026 年分省分专业招生计划 API，只作当年专业池、计划数、科类、批次、选科、学费和路径约束，不是投档线、录取最低分或录取概率。",
      "学校招生章程明确招生专业和计划以各省教育主管部门最终核定公布为准；中外合作、专项、公费师范、定向西藏、综合评价、艺体和提前批已按原始类型隔离。",
      "2026 API 查询有计划省份为 29 个；新疆、西藏未返回 2026 查询项，不补造零计划记录；未提供的专业字段不作推断。",
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

async function requestJson(session, endpoint, body) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const headers = { accept: "application/json, text/plain, */*", "content-type": "application/x-www-form-urlencoded; charset=UTF-8", "user-agent": "Mozilla/5.0 gaokao-sdnu-v356-importer/1.0", referer: PAGE_URL, "x-requested-with": "XMLHttpRequest" };
      if (session.cookie) headers.cookie = session.cookie;
      const response = await fetch(`${BASE_URL}${endpoint}`, { method: "POST", headers, body: new URLSearchParams(body), signal: AbortSignal.timeout(90_000) });
      updateCookie(session, response);
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${endpoint}`);
      const payload = JSON.parse(text);
      if (payload?.state !== 1) throw new Error(`SDNU API error for ${endpoint}: ${JSON.stringify(payload).slice(0, 500)}`);
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
  const pageResponse = await fetch(PAGE_URL, { headers: { "user-agent": "Mozilla/5.0 gaokao-sdnu-v356-importer/1.0" }, signal: AbortSignal.timeout(90_000) });
  updateCookie(session, pageResponse);
  const pageText = await pageResponse.text();
  if (!pageResponse.ok || pageText.length < 1000) throw new Error(`Unexpected SDNU plan page response: ${pageResponse.status}`);
  const paramPayload = await requestJson(session, PARAM_ENDPOINT, {});
  const options = parseParamOptions(paramPayload).filter((option) => option.year === "2026");
  const queries = [...new Map(options.flatMap((option) => option.types.map((type) => ({ province: option.province, year: option.year, category: option.category, type }))).map((query) => [`${query.province}|${query.year}|${query.category}|${query.type}`, query])).values()];
  const paths = [];
  for (let index = 0; index < queries.length; index += 8) {
    const batch = queries.slice(index, index + 8);
    const fetched = await Promise.all(batch.map(async (query) => {
      const payload = await requestJson(session, PLAN_ENDPOINT, { ssmc: query.province, zsnf: query.year, klmc: query.category, zslx: query.type });
      const rows = parsePlanRows(payload, query);
      return rows.length ? { query, rows, total: payload.data?.zsjhTotal || [] } : null;
    }));
    paths.push(...fetched.filter(Boolean));
  }
  return { pageText, paramPayload, queries, paths, rows: paths.flatMap((pathItem) => pathItem.rows), request: { pageUrl: PAGE_URL, paramEndpoint: PARAM_ENDPOINT, planEndpoint: PLAN_ENDPOINT, year: 2026, queryCount: queries.length } };
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
  if (args.help) { console.log(`Usage:\n  node scripts/import-official-national-school-plan-2026-v356-sdnu.mjs --out ${DEFAULT_OUT}\n  node scripts/import-official-national-school-plan-2026-v356-sdnu.mjs --use-cache`); return; }
  const rawDir = path.resolve(PROJECT_ROOT, RAW_DIR);
  fs.mkdirSync(rawDir, { recursive: true });
  const pageFile = path.join(rawDir, "plan.html");
  const snapshotFile = path.join(rawDir, "api-snapshot.json");
  const paramFile = path.join(rawDir, "param.json");
  const requestFile = path.join(rawDir, "request.json");
  let fetched;
  if (args.useCache && fs.existsSync(pageFile) && fs.existsSync(snapshotFile) && fs.existsSync(paramFile)) {
    const snapshot = JSON.parse(fs.readFileSync(snapshotFile, "utf8"));
    fetched = { pageText: fs.readFileSync(pageFile, "utf8"), ...snapshot, paramPayload: JSON.parse(fs.readFileSync(paramFile, "utf8")), request: fs.existsSync(requestFile) ? JSON.parse(fs.readFileSync(requestFile, "utf8")) : {} };
  } else {
    fetched = await fetchOfficialPayload();
    fs.writeFileSync(pageFile, fetched.pageText);
    fs.writeFileSync(paramFile, `${JSON.stringify(fetched.paramPayload, null, 2)}\n`);
    fs.writeFileSync(snapshotFile, `${JSON.stringify({ year: 2026, queries: fetched.queries, paths: fetched.paths, rows: fetched.rows }, null, 2)}\n`);
    fs.writeFileSync(requestFile, `${JSON.stringify(fetched.request, null, 2)}\n`);
  }
  const rows = fetched.rows || fetched.paths.flatMap((pathItem) => pathItem.rows);
  const records = rows.map((row) => recordFromPlanRow(row));
  const provinces = [...new Set(records.map((record) => record.province))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const planCount = records.reduce((sum, record) => sum + Number(record.planCount || 0), 0);
  const duplicateIds = records.length - new Set(records.map((record) => record.id)).size;
  const byType = countBy(rows, (row) => row.typeName);
  const byTypePlanCount = sumBy(rows, (row) => row.typeName, (row) => row.planCount);
  const provinceOptions = [...new Set(parseParamOptions(fetched.paramPayload).map((option) => option.province).filter((province) => province !== "不分省"))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const emptyProvinces = MAINLAND_PROVINCES.filter((province) => !provinces.includes(province));
  if (records.length !== EXPECTED.records) throw new Error(`Unexpected SDNU record count: ${records.length}`);
  if (planCount !== EXPECTED.planCount) throw new Error(`Unexpected SDNU plan count: ${planCount}`);
  if (provinces.length !== EXPECTED.provinces) throw new Error(`Unexpected SDNU province count: ${provinces.length}`);
  if (fetched.paths.length !== EXPECTED.pathCount) throw new Error(`Unexpected SDNU path count: ${fetched.paths.length}`);
  if (duplicateIds !== 0) throw new Error(`Duplicate SDNU record ids: ${duplicateIds}`);
  if (emptyProvinces.join(",") !== "西藏,新疆") throw new Error(`Unexpected SDNU empty provinces: ${emptyProvinces.join(",")}`);
  const sourceNote = {
    id: SOURCE.id,
    title: "山东师范大学 2026 年分省分专业招生计划",
    publisher: "山东师范大学本科招生网",
    url: PAGE_URL,
    quality: SOURCE.quality,
    schoolCode: SOURCE.schoolCode,
    schoolName: SOURCE.schoolName,
    records: records.length,
    planCount,
    provinces: provinces.length,
    pathCount: fetched.paths.length,
    queryCount: fetched.queries?.length || fetched.paths.length,
    provinceOptions: provinceOptions.length,
    emptyProvinces,
    byType,
    byTypePlanCount,
    headlinePlanCount: null,
    apiPlanCount: planCount,
    unattributedDelta: null,
    charterUrl: CHARTER_URL,
    guideUrl: GUIDE_URL,
    evidencePath: `${RAW_DIR}/api-snapshot.json`,
    pageSha256: sha256File(pageFile),
    usage: "仅用于当年专业池、计划数、科类、批次、选科、学费和特殊路径约束，不替代省级考试院目录、投档线或录取概率。",
    cautions: [
      "山东师范大学本科招生网 2026 API 明细返回 29 个省份、103 条非空查询路径和 6119 个计划；API 未返回新疆、西藏 2026 查询项，不补造零计划记录。",
      "学校招生章程明确招生专业（类）和招生计划以各省教育主管部门最终核定公布为准；专项、合作、公费师范、定向西藏、综合评价、艺体和提前批保留原始路径。",
      "计划 API 提供专业代码、专业组代码、选科、批次、学费和备注的原始字段；缺失字段不作推断，计划记录不是投档线、录取最低分或录取概率。",
    ],
  };
  const output = { version: "v3.356", generatedAt: new Date().toISOString(), type: "official-national-school-plan-import", sourceNotes: [sourceNote], records };
  const outputPath = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ status: "ok", version: output.version, out: path.relative(PROJECT_ROOT, outputPath), records: records.length, provinces: provinces.length, planCount, ordinaryRecords: records.filter((record) => record.formalScoreScope === "school-official-only").length, specialPathRecords: records.filter((record) => record.formalScoreScope === "special-path-only").length, pathCount: fetched.paths.length, pageSha256: sourceNote.pageSha256 }, null, 2));
}

export { subjectTypeFrom, electiveRequirementFrom, classifyPlan, parseParamOptions, parsePlanRows, recordFromPlanRow };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
}
