#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUT = "data/admissions/official-national-school-plan-2026-v359-ncbcjxau-import.json";
const DEFAULT_RAW_DIR = "data/admissions/raw/official-national-school-plan-2026-v359-ncbcjxau";
const BASE_URL = "https://zs.ncbcjxau.edu.cn";
const INDEX_URL = `${BASE_URL}/`;
const PAGE_URL = `${BASE_URL}/news-show-1005.html`;
const SOURCE_ID = "official-ncbcjxau-national-plan-2026";
const SCHOOL_CODE = "13436";
const SCHOOL_NAME = "江西农业大学南昌商学院";
const YEAR = 2026;

export const EXPECTED = {
  rawRows: 443,
  records: 443,
  rawPlanCount: 3400,
  planCount: 3400,
  duplicateRows: 0,
  provinces: 28,
  ordinaryRecords: 432,
  specialPathRecords: 11,
};

const EXPECTED_SHA256 = "2cb3fafcd8ae17ba9b75f301b6204a5bf700e846944b7619a3065f36592b9fed";

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
  if (!condition) throw new Error(`江西农业大学南昌商学院 2026 计划 v3.359 audit failed: ${message}`);
}

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function sha256File(file) { return sha256(fs.readFileSync(file)); }
function hash(value, length = 18) { return sha256(String(value)).slice(0, length); }
function relativeProjectPath(file) { return path.relative(PROJECT_ROOT, file).replaceAll(path.sep, "/"); }

export function clean(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/[\u00a0　]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numeric(value, label) {
  const number = Number(String(value ?? "").replace(/[,，]/g, ""));
  invariant(Number.isInteger(number) && number > 0, `${label} must be a positive integer, got ${value}`);
  return number;
}

export function subjectTypeFrom(raw) {
  const text = clean(raw);
  if (/艺术|美术|音乐|舞蹈|播音/.test(text)) return "艺术类";
  if (/体育/.test(text)) return "体育类";
  if (/历史|文史|文科/.test(text)) return "历史类";
  if (/物理|理工|理科/.test(text)) return "物理类";
  if (/综合/.test(text)) return "综合改革";
  return text || "综合";
}

export function classifyPlan(row) {
  const text = `${clean(row.subjectRaw || row.sourceSubjectRaw)} ${clean(row.batch || row.sourceBatchRaw)} ${clean(row.majorName)}`;
  if (/艺术|美术|音乐|舞蹈|播音/.test(text)) return { admissionType: "艺术类", admissionSubtype: clean(row.batch) || "艺术类", formalScoreScope: "special-path-only" };
  if (/体育/.test(text)) return { admissionType: "体育类", admissionSubtype: clean(row.batch) || "体育类", formalScoreScope: "special-path-only" };
  return { admissionType: "普通录取", admissionSubtype: "普通类", formalScoreScope: "school-official-only" };
}

export function parsePlanTableRows(html) {
  const rows = [];
  for (const match of String(html || "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => clean(cell[1]));
    if (cells.length !== 6 || cells[0] === "招生省份") continue;
    const planCount = Number(cells[5].replace(/[,，]/g, ""));
    if (!cells[0] || !cells[1] || !cells[2] || !Number.isInteger(planCount) || planCount <= 0) continue;
    rows.push({
      province: cells[0],
      majorName: cells[1],
      subjectRaw: cells[2],
      batch: cells[3],
      examRequirement: cells[4],
      planCount,
    });
  }
  return rows;
}

function rowIdentity(row) {
  return [row.province, row.majorName, row.subjectRaw, row.batch, row.examRequirement, row.planCount].join("|");
}

export function dedupePlanRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const identity = rowIdentity(row);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export function recordFromPlanRow(row, meta = {}) {
  const classification = classifyPlan(row);
  const record = {
    id: `2026-ncbcjxau-national-plan-${hash(rowIdentity(row))}`,
    province: row.province,
    year: YEAR,
    sourcePlanYear: YEAR,
    subjectType: subjectTypeFrom(row.subjectRaw),
    batch: row.batch,
    sourceBatchRaw: row.batch,
    schoolName: SCHOOL_NAME,
    schoolCode: SCHOOL_CODE,
    schoolTags: ["江西", "财经", "共青城"],
    dataType: "admission-plan",
    majorName: row.majorName,
    planCount: row.planCount,
    educationLevel: "本科",
    sourceSubjectRaw: row.subjectRaw,
    sourceExamRequirementRaw: row.examRequirement,
    formalScoreScope: classification.formalScoreScope,
    admissionType: classification.admissionType,
    admissionSubtype: classification.admissionSubtype,
    schoolOfficialScope: "single-school-admission-plan",
    planRemark: row.examRequirement ? `考试科目要求：${row.examRequirement}` : undefined,
    sourceQuality: "official-school-ncbcjxau-2026-national-plan-html",
    sourceId: SOURCE_ID,
    sourceUrl: PAGE_URL,
    sourcePageUrl: PAGE_URL,
    sourceIndexUrl: INDEX_URL,
    officialEvidencePath: meta.evidencePath || `${DEFAULT_RAW_DIR}/plan-page.html`,
    cautions: [
      "本记录来自江西农业大学南昌商学院招生网公开的2026年分省分专业招生计划，只作当年专业池、计划数、科类、批次和选科约束，不是投档线、录取最低分或录取概率。",
      "官网原表保留‘不分省’计划类别；该类别不强行拆分到具体省份，具体投放以省级招生主管部门最终公布为准。",
      "艺术类计划保持 special-path-only，不与普通录取路径混用；普通计划仅作学校官方计划约束。",
    ],
  };
  for (const key of Object.keys(record)) {
    if (record[key] === undefined || record[key] === "" || (Array.isArray(record[key]) && record[key].length === 0)) delete record[key];
  }
  return record;
}

function compact(value) {
  if (Array.isArray(value)) return value.map(compact).filter((item) => item !== undefined && item !== null && item !== "");
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, compact(item)]).filter(([, item]) => item !== undefined && item !== null && item !== ""));
  return value;
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 gaokao-ncbcjxau-v359-importer/1.0", accept: "text/html,*/*" }, signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:\n  node scripts/import-official-national-school-plan-2026-v359-ncbcjxau.mjs --out ${DEFAULT_OUT}\n  node scripts/import-official-national-school-plan-2026-v359-ncbcjxau.mjs --use-cache`);
    return;
  }
  const rawDir = path.resolve(PROJECT_ROOT, args.rawDir);
  fs.mkdirSync(rawDir, { recursive: true });
  const pageFile = path.join(rawDir, "plan-page.html");
  if (!args.useCache || !fs.existsSync(pageFile) || fs.statSync(pageFile).size === 0) fs.writeFileSync(pageFile, await fetchText(PAGE_URL), "utf8");
  invariant(sha256File(pageFile) === EXPECTED_SHA256, "official plan page hash changed");
  const html = fs.readFileSync(pageFile, "utf8");
  const rawRows = parsePlanTableRows(html);
  const rows = dedupePlanRows(rawRows);
  const records = rows.map((row) => recordFromPlanRow(row, { evidencePath: relativeProjectPath(pageFile) })).map(compact);
  const rawPlanCount = rawRows.reduce((sum, row) => sum + row.planCount, 0);
  const planCount = rows.reduce((sum, row) => sum + row.planCount, 0);
  const provinces = [...new Set(records.map((record) => record.province))].sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
  const ordinaryRecords = records.filter((record) => record.formalScoreScope === "school-official-only");
  const specialRecords = records.filter((record) => record.formalScoreScope === "special-path-only");
  invariant(rawRows.length === EXPECTED.rawRows, `expected ${EXPECTED.rawRows} raw rows, got ${rawRows.length}`);
  invariant(rows.length === EXPECTED.records, `expected ${EXPECTED.records} records, got ${rows.length}`);
  invariant(rawPlanCount === EXPECTED.rawPlanCount, `expected raw plan count ${EXPECTED.rawPlanCount}, got ${rawPlanCount}`);
  invariant(planCount === EXPECTED.planCount, `expected plan count ${EXPECTED.planCount}, got ${planCount}`);
  invariant(rawRows.length - rows.length === EXPECTED.duplicateRows, `expected ${EXPECTED.duplicateRows} duplicate rows`);
  invariant(provinces.length === EXPECTED.provinces, `expected ${EXPECTED.provinces} provinces/categories, got ${provinces.length}`);
  invariant(ordinaryRecords.length === EXPECTED.ordinaryRecords, `expected ${EXPECTED.ordinaryRecords} ordinary records, got ${ordinaryRecords.length}`);
  invariant(specialRecords.length === EXPECTED.specialPathRecords, `expected ${EXPECTED.specialPathRecords} special records, got ${specialRecords.length}`);
  invariant(new Set(records.map((record) => record.id)).size === records.length, "record IDs must be unique");

  const sourceNote = {
    id: SOURCE_ID,
    title: "江西农业大学南昌商学院 2026 年分省分专业招生计划",
    publisher: "江西农业大学南昌商学院招生网",
    url: PAGE_URL,
    quality: "official-school-ncbcjxau-2026-national-plan-html",
    schoolCode: SCHOOL_CODE,
    schoolName: SCHOOL_NAME,
    records: records.length,
    rawRows: rawRows.length,
    duplicateRows: rawRows.length - rows.length,
    rawPlanCount,
    planCount,
    provinces: provinces.length,
    ordinaryRecords: ordinaryRecords.length,
    specialPathRecords: specialRecords.length,
    evidencePath: relativeProjectPath(pageFile),
    pageSha256: sha256File(pageFile),
    usage: "仅用于当年专业池、计划数、科类和批次约束，不替代省级考试院目录、投档线或录取概率。",
    cautions: [
      "官网原表包含27个具体招生省份及‘不分省’类别；‘不分省’未分摊至具体省份。",
      "艺术类记录按特殊路径隔离；页面未提供学费、专业代码或历年录取分数，本导入不补造这些字段。",
    ],
  };
  const output = {
    version: "v3.359",
    generatedAt: new Date().toISOString(),
    dataset: "official-ncbcjxau-national-plan-2026-v3.359",
    sourceNotes: [sourceNote],
    summary: {
      rawRows: rawRows.length,
      records: records.length,
      rawPlanCount,
      planCount,
      duplicateRows: rawRows.length - rows.length,
      provinces: provinces.length,
      ordinaryRecords: ordinaryRecords.length,
      specialPathRecords: specialRecords.length,
      provinceBreakdown: provinces.map((province) => {
        const provinceRows = records.filter((record) => record.province === province);
        return { province, records: provinceRows.length, planCount: provinceRows.reduce((sum, record) => sum + record.planCount, 0) };
      }),
    },
    records,
  };
  const outputFile = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "ok", version: output.version, rawRows: rawRows.length, records: records.length, rawPlanCount, planCount, duplicateRows: rawRows.length - rows.length, provinces: provinces.length, ordinaryRecords: ordinaryRecords.length, specialPathRecords: specialRecords.length, sha256: sha256File(outputFile) }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
