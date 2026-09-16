#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUT = "data/admissions/official-national-school-plan-2026-v361-gzu-import.json";
const DEFAULT_RAW_DIR = "data/admissions/raw/official-national-school-plan-2026-v361-gzu";
const PAGE_URL = "https://rso.gzu.edu.cn/2026/0705/c23579a276660/page.htm";
const CHARTER_URL = "https://rso.gzu.edu.cn/2026/0521/c23586a277610/page.htm";
const INDEX_URL = "https://rso.gzu.edu.cn/";
const SOURCE_ID = "official-gzu-national-plan-2026";
const SCHOOL_CODE = "10657";
const SCHOOL_IDENTIFIER_CODE = "4152010657";
const SCHOOL_NAME = "贵州大学";
const YEAR = 2026;

export const EXPECTED = {
  rawRecords: 1180,
  records: 1180,
  rawPlanCount: 8840,
  planCount: 8840,
  duplicateRows: 0,
  invalidRows: 0,
  provinces: 31,
  ordinaryRecords: 799,
  specialPathRecords: 381,
  typeBreakdown: {
    "普通类": { records: 799, planCount: 5961 },
    "国家专项": { records: 65, planCount: 1050 },
    "地方专项": { records: 38, planCount: 346 },
    "高校专项": { records: 93, planCount: 180 },
    "少数民族预科": { records: 29, planCount: 310 },
    "体育": { records: 8, planCount: 63 },
    "艺术类": { records: 37, planCount: 400 },
    "中外合作办学": { records: 106, planCount: 519 },
    "西藏班": { records: 2, planCount: 6 },
    "新疆班": { records: 3, planCount: 5 },
  },
};

const EXPECTED_CANONICAL_SHA256 = "fa912c7318ec57c59bf3013078729451e85d3701acdb8f1ba061fd8eaf780dbf";

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT, rawDir: DEFAULT_RAW_DIR, useCache: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") args.out = argv[++index];
    else if (value === "--raw-dir") args.rawDir = argv[++index];
    else if (value === "--use-cache") args.useCache = true;
    else if (value === "--help" || value === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function invariant(condition, message) {
  if (!condition) throw new Error(`贵州大学 2026 计划 v3.361 audit failed: ${message}`);
}

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function sha256File(file) { return sha256(fs.readFileSync(file)); }
function hash(value, length = 18) { return sha256(String(value)).slice(0, length); }
function relativeProjectPath(file) { return path.relative(PROJECT_ROOT, file).replaceAll(path.sep, "/"); }

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function parseHtml(input) {
  return typeof input === "string" ? input : new TextDecoder("utf-8").decode(Buffer.isBuffer(input) ? input : Buffer.from(input));
}

function extractPayloadText(input) {
  const html = parseHtml(input);
  const match = html.match(/<div\b[^>]*\bid=["']major-list["'][^>]*>([\s\S]*?)<\/div>/i);
  invariant(match, "#major-list payload not found");
  return decodeHtmlEntities(match[1]).replace(/^\uFEFF/, "").trim();
}

export function parseMajorListPayload(input) {
  const payloadText = extractPayloadText(input);
  let value;
  try {
    value = JSON.parse(payloadText);
  } catch (error) {
    throw new Error(`#major-list JSON parse failed: ${error.message}`);
  }
  invariant(Array.isArray(value), "#major-list JSON must be an array");
  return value;
}

export function canonicalPayloadSha256(value) {
  return sha256(JSON.stringify(value));
}

export function subjectTypeFrom(raw) {
  const text = String(raw ?? "").trim();
  if (/历史|文史/.test(text)) return "历史类";
  if (/物理|理工/.test(text)) return "物理类";
  if (/综合|不分/.test(text)) return "综合改革";
  return text || "综合";
}

export function classifyPlanType(type) {
  const text = String(type ?? "").trim();
  if (text === "普通类") return { admissionType: "普通录取", formalScoreScope: "school-official-only" };
  return { admissionType: text || "特殊路径", formalScoreScope: "special-path-only" };
}

function rowKey(row) {
  return [row.year, row.type, row.province, row.major, row.subject, row.plan].join("|");
}

function validateRows(rawRows) {
  const valid = [];
  let invalidRows = 0;
  for (const row of rawRows) {
    const validRow = row && typeof row === "object" && !Array.isArray(row)
      && Number.isInteger(row.year) && row.year === YEAR
      && typeof row.type === "string" && row.type.trim()
      && typeof row.province === "string" && row.province.trim()
      && typeof row.major === "string" && row.major.trim()
      && typeof row.subject === "string" && row.subject.trim()
      && Number.isInteger(row.plan) && row.plan > 0;
    if (!validRow) { invalidRows += 1; continue; }
    valid.push({ year: row.year, type: row.type.trim(), province: row.province.trim(), major: row.major.trim(), subject: row.subject.trim(), plan: row.plan });
  }
  return { valid, invalidRows };
}

export function recordFromPlanRow(row, meta = {}) {
  const classification = classifyPlanType(row.type);
  const record = {
    id: `2026-gzu-national-plan-${hash(rowKey(row))}`,
    province: row.province,
    year: YEAR,
    sourcePlanYear: YEAR,
    subjectType: subjectTypeFrom(row.subject),
    schoolName: SCHOOL_NAME,
    schoolCode: SCHOOL_CODE,
    schoolIdentifierCode: SCHOOL_IDENTIFIER_CODE,
    schoolTags: ["贵州", "公办", "双一流"],
    dataType: "admission-plan",
    majorName: row.major,
    sourceMajorRaw: row.major,
    planCount: row.plan,
    sourceTypeRaw: row.type,
    sourceSubjectRaw: row.subject,
    formalScoreScope: classification.formalScoreScope,
    admissionType: classification.admissionType,
    admissionSubtype: row.type,
    schoolOfficialScope: "single-school-admission-plan",
    planRemark: row.type === "普通类" ? undefined : `招生类型：${row.type}`,
    sourceQuality: "official-school-gzu-2026-national-plan-html-embedded-json",
    sourceId: SOURCE_ID,
    sourceUrl: PAGE_URL,
    sourcePageUrl: PAGE_URL,
    sourceIndexUrl: INDEX_URL,
    officialEvidencePath: meta.evidencePath || `${DEFAULT_RAW_DIR}/plan-page.html`,
    officialCharterEvidencePath: meta.charterEvidencePath || `${DEFAULT_RAW_DIR}/charter-page.html`,
    cautions: [
      "本记录来自贵州大学本科招生网公开的2026年分省分专业招生计划嵌入数据，只作当年专业池、计划数、科类和招生路径约束，不是投档线、录取最低分或录取概率。",
      "官网页面未提供专业代码、批次、专业组、选考科目、学费或学制，运行层不对这些字段作推断；官方原文‘资源勘查工作’保持不改写。",
      "西藏仅列西藏班2条、6个计划，属于 special-path-only，不代表西藏普通类覆盖；新疆班同理按特殊路径隔离。",
      "学校章程提示最终招生专业及人数以各省发布的招生专业目录为准，并允许不超过1%的预留计划；正式填报仍需复核省级招生主管部门目录。",
    ],
  };
  for (const key of Object.keys(record)) {
    if (record[key] === undefined || record[key] === "" || (Array.isArray(record[key]) && record[key].length === 0)) delete record[key];
  }
  return record;
}

async function fetchBytes(url) {
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 gaokao-gzu-v361-importer/1.0", accept: "text/html,*/*" }, signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function compact(value) {
  if (Array.isArray(value)) return value.map(compact).filter((item) => item !== undefined && item !== null && item !== "");
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, compact(item)]).filter(([, item]) => item !== undefined && item !== null && item !== ""));
  return value;
}

function typeBreakdown(rows) {
  return Object.fromEntries([...new Set(rows.map((row) => row.type))].sort((left, right) => left.localeCompare(right, "zh-Hans-CN")).map((type) => {
    const typed = rows.filter((row) => row.type === type);
    return [type, { records: typed.length, planCount: typed.reduce((sum, row) => sum + row.plan, 0) }];
  }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:\n  node scripts/import-official-national-school-plan-2026-v361-gzu.mjs --out ${DEFAULT_OUT}\n  node scripts/import-official-national-school-plan-2026-v361-gzu.mjs --use-cache`);
    return;
  }
  const rawDir = path.resolve(PROJECT_ROOT, args.rawDir);
  fs.mkdirSync(rawDir, { recursive: true });
  const pageFile = path.join(rawDir, "plan-page.html");
  const charterFile = path.join(rawDir, "charter-page.html");
  if (!args.useCache || !fs.existsSync(pageFile) || fs.statSync(pageFile).size === 0) fs.writeFileSync(pageFile, await fetchBytes(PAGE_URL));
  if (!args.useCache || !fs.existsSync(charterFile) || fs.statSync(charterFile).size === 0) fs.writeFileSync(charterFile, await fetchBytes(CHARTER_URL));
  const charterText = parseHtml(fs.readFileSync(charterFile));
  invariant(/贵州大学/.test(charterText) && /4152010657/.test(charterText), "official charter code evidence missing");
  const rawRows = parseMajorListPayload(fs.readFileSync(pageFile));
  const { valid, invalidRows } = validateRows(rawRows);
  const seen = new Set();
  const rows = valid.filter((row) => {
    const key = rowKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const records = rows.map((row) => recordFromPlanRow(row, { evidencePath: relativeProjectPath(pageFile), charterEvidencePath: relativeProjectPath(charterFile) })).map(compact);
  const provinces = [...new Set(records.map((record) => record.province))].sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
  const ordinaryRecords = records.filter((record) => record.formalScoreScope === "school-official-only");
  const specialRecords = records.filter((record) => record.formalScoreScope === "special-path-only");
  const rawPlanCount = valid.reduce((sum, row) => sum + row.plan, 0);
  const planCount = rows.reduce((sum, row) => sum + row.plan, 0);
  invariant(canonicalPayloadSha256(rawRows) === EXPECTED_CANONICAL_SHA256, "canonical #major-list payload hash changed");
  invariant(rawRows.length === EXPECTED.rawRecords, `expected ${EXPECTED.rawRecords} raw rows, got ${rawRows.length}`);
  invariant(rows.length === EXPECTED.records, `expected ${EXPECTED.records} records, got ${rows.length}`);
  invariant(invalidRows === EXPECTED.invalidRows, `expected ${EXPECTED.invalidRows} invalid rows, got ${invalidRows}`);
  invariant(valid.length - rows.length === EXPECTED.duplicateRows, `expected ${EXPECTED.duplicateRows} duplicate rows, got ${valid.length - rows.length}`);
  invariant(rawPlanCount === EXPECTED.rawPlanCount, `expected raw plan count ${EXPECTED.rawPlanCount}, got ${rawPlanCount}`);
  invariant(planCount === EXPECTED.planCount, `expected plan count ${EXPECTED.planCount}, got ${planCount}`);
  invariant(provinces.length === EXPECTED.provinces, `expected ${EXPECTED.provinces} provinces, got ${provinces.length}`);
  invariant(ordinaryRecords.length === EXPECTED.ordinaryRecords, `expected ${EXPECTED.ordinaryRecords} ordinary records, got ${ordinaryRecords.length}`);
  invariant(specialRecords.length === EXPECTED.specialPathRecords, `expected ${EXPECTED.specialPathRecords} special records, got ${specialRecords.length}`);
  const actualTypeBreakdown = typeBreakdown(rows);
  invariant(Object.keys(actualTypeBreakdown).length === Object.keys(EXPECTED.typeBreakdown).length
    && Object.entries(EXPECTED.typeBreakdown).every(([type, expected]) => actualTypeBreakdown[type]?.records === expected.records && actualTypeBreakdown[type]?.planCount === expected.planCount), "type breakdown changed");
  invariant(new Set(records.map((record) => record.id)).size === records.length, "record IDs must be unique");

  const sourceNote = {
    id: SOURCE_ID,
    title: "贵州大学2026年招生计划",
    publisher: "贵州大学本科招生网",
    url: PAGE_URL,
    charterUrl: CHARTER_URL,
    quality: "official-school-gzu-2026-national-plan-html-embedded-json",
    schoolCode: SCHOOL_CODE,
    schoolIdentifierCode: SCHOOL_IDENTIFIER_CODE,
    schoolName: SCHOOL_NAME,
    records: records.length,
    rawRecords: rawRows.length,
    duplicateRows: valid.length - rows.length,
    invalidRows,
    rawPlanCount,
    planCount,
    provinces: provinces.length,
    ordinaryRecords: ordinaryRecords.length,
    specialPathRecords: specialRecords.length,
    typeBreakdown: typeBreakdown(rows),
    canonicalPayloadSha256: canonicalPayloadSha256(rawRows),
    evidencePath: relativeProjectPath(pageFile),
    charterEvidencePath: relativeProjectPath(charterFile),
    finalPlanCaveat: true,
    usage: "仅用于当年专业池、计划数、科类和招生路径约束，不替代省级考试院计划、投档线、录取最低分或录取概率。",
    cautions: [
      "页面的#major-list是贵州大学2026年分省分专业计划的嵌入 JSON；整页可能注入变化的反爬脚本，因此证据哈希只针对解码后的规范 JSON。",
      "官网提供贵州、北京、上海、天津、河北、山西、内蒙古、辽宁、吉林、黑龙江、江苏、浙江、安徽、福建、江西、山东、河南、湖北、湖南、广东、广西、海南、重庆、四川、贵州、云南、西藏、陕西、甘肃、青海、宁夏、新疆共31个省级口径；未列其他口径不补造零计划。",
      "最终招生专业及人数以各省发布数据为准；学校章程允许不超过1%的预留计划，发布详情合计不等同于年度 headline 总量。",
    ],
  };
  const output = {
    version: "v3.361",
    generatedAt: new Date().toISOString(),
    dataset: "official-gzu-national-plan-2026-v3.361",
    sourceNotes: [sourceNote],
    summary: {
      records: records.length,
      planCount,
      rawRecords: rawRows.length,
      rawPlanCount,
      duplicateRows: valid.length - rows.length,
      invalidRows,
      provinces: provinces.length,
      ordinaryRecords: ordinaryRecords.length,
      specialPathRecords: specialRecords.length,
      typeBreakdown: typeBreakdown(rows),
    },
    records,
  };
  const outputFile = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "ok", version: output.version, rawRecords: rawRows.length, records: records.length, rawPlanCount, planCount, duplicateRows: valid.length - rows.length, invalidRows, provinces: provinces.length, ordinaryRecords: ordinaryRecords.length, specialPathRecords: specialRecords.length, canonicalPayloadSha256: canonicalPayloadSha256(rawRows), sha256: sha256File(outputFile) }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
