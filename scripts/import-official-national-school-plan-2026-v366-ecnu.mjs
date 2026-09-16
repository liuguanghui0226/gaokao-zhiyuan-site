#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUT = "data/admissions/official-national-school-plan-2026-v366-ecnu-import.json";
const DEFAULT_RAW_DIR = "data/admissions/raw/official-national-school-plan-2026-v366-ecnu";
const PLAN_URL = "https://xxgk.ecnu.edu.cn/b2/82/c29049a766594/page.htm";
const CHARTER_URL = "https://xxgk.ecnu.edu.cn/a3/52/c11816a762706/page.htm";
const SOURCE_ID = "official-ecnu-national-plan-2026-html";
const SCHOOL_CODE = "10269";
const SCHOOL_IDENTIFIER_CODE = "4131010269";
const SCHOOL_NAME = "华东师范大学";
const YEAR = 2026;
const PROVINCES = [
  "北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "上海", "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南",
  "湖北", "湖南", "广东", "广西", "海南", "重庆", "四川", "贵州", "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆",
];

export const EXPECTED = {
  records: 1244,
  planCount: 3661,
  provinces: 31,
  ordinaryRecords: 519,
  ordinaryPlanCount: 1791,
  specialPathRecords: 725,
  specialPlanCount: 1870,
  planPageBytes: 1_244_214,
  charterPageBytes: 54_326,
  rawCorpusBytes: 1_298_540,
  typeBreakdown: {
    "普通类(本科批)": { records: 519, planCount: 1791 },
    "普通类(提前批)": { records: 208, planCount: 754 },
    "高校专项": { records: 141, planCount: 193 },
    "国家专项": { records: 107, planCount: 240 },
    "国家优师专项": { records: 77, planCount: 150 },
    "艺考类": { records: 57, planCount: 194 },
    "民族班": { records: 37, planCount: 46 },
    "综合评价": { records: 33, planCount: 141 },
    "体育类": { records: 32, planCount: 92 },
    "内地西藏班": { records: 16, planCount: 31 },
    "内地新疆班": { records: 15, planCount: 27 },
    "南疆计划": { records: 2, planCount: 2 },
  },
};

const EXPECTED_PLAN_PAGE_SHA256 = "fa465bdee163c1b25d8f6cb3277e39eed263c54045ed2c57e509b80c3f6c6f06";
const EXPECTED_CHARTER_PAGE_SHA256 = "3728b33e05d282440bb05c272c35a7cfff02537663ba05c282e8ddc75b569cb3";
const EXPECTED_RAW_CORPUS_SHA256 = "7768cfe9e6e958e753ed31b63e1cac56f1ca35ffba8925db367aca82429dc81b";
const EXPECTED_CANONICAL_SHA256 = "9946a7a9ed1a896b40847d617e9b814bdcb8796976a13641b0835f0c3f99c8af";

function invariant(condition, message) {
  if (!condition) throw new Error(`华东师范大学 2026 计划 v3.366 audit failed: ${message}`);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hash(value, length = 18) {
  return sha256(String(value)).slice(0, length);
}

function relativeProjectPath(file) {
  return path.relative(PROJECT_ROOT, file).replaceAll(path.sep, "/");
}

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

export function descendantText(value) {
  return decodeEntities(String(value ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, ""))
    .replace(/^\uFEFF/, "")
    .replace(/[\s\u00a0\u3000]+/g, " ")
    .trim();
}

function htmlText(input) {
  if (typeof input === "string") return input;
  return new TextDecoder("utf-8").decode(Buffer.isBuffer(input) ? input : Buffer.from(input));
}

function tableCells(rowHtml) {
  return [...String(rowHtml).matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map((match) => descendantText(match[1]));
}

export function parsePlanTable(input) {
  const html = htmlText(input);
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  const table = tables.find((candidate) => {
    const text = descendantText(candidate);
    return text.includes("省份") && text.includes("计划类别") && text.includes("招生专业") && text.includes("专业组") && text.includes("招生计划");
  });
  invariant(table, "official six-column plan table missing");
  const expectedHeader = ["省份", "计划类别", "招生专业", "科类", "专业组", "招生计划"];
  let headerSeen = false;
  let invalidRows = 0;
  const rows = [];
  for (const match of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = tableCells(match[1]);
    if (!cells.length) continue;
    if (JSON.stringify(cells) === JSON.stringify(expectedHeader)) {
      headerSeen = true;
      continue;
    }
    if (!headerSeen || cells.every((cell) => !cell)) continue;
    if (cells.length !== 6) {
      invalidRows += 1;
      continue;
    }
    const [province, planType, major, subject, elective, planText] = cells;
    const plan = Number(planText);
    if (!province || !planType || !major || !subject || !Number.isSafeInteger(plan) || plan <= 0) {
      invalidRows += 1;
      continue;
    }
    rows.push({ province, planType, major, subject, elective, plan });
  }
  invariant(headerSeen, "official plan table header missing");
  return { rows, invalidRows };
}

export function canonicalRowsSha256(rows) {
  return sha256(JSON.stringify(rows.map((row) => ({
    province: row.province,
    planType: row.planType,
    major: row.major,
    subject: row.subject,
    elective: row.elective,
    plan: row.plan,
  }))));
}

export function classifyPlanType(raw) {
  const planType = String(raw ?? "").trim();
  if (planType === "普通类(本科批)") return { admissionType: "普通录取", admissionSubtype: planType, formalScoreScope: "school-official-only" };
  if (planType === "普通类(提前批)") return { admissionType: "提前批", admissionSubtype: planType, formalScoreScope: "special-path-only" };
  if (planType === "艺考类") return { admissionType: "艺术类", admissionSubtype: planType, formalScoreScope: "special-path-only" };
  return { admissionType: planType || "特殊路径", admissionSubtype: planType || "特殊路径", formalScoreScope: "special-path-only" };
}

function subjectTypeFrom(raw) {
  const text = String(raw ?? "").trim();
  if (/历史|文史/.test(text)) return "历史类";
  if (/物理|理工/.test(text)) return "物理类";
  if (/综合|不分文理|不分科目/.test(text)) return "综合改革";
  if (/艺术/.test(text)) return "艺术类";
  if (/体育/.test(text)) return "体育类";
  return text || "综合";
}

function batchFrom(planType) {
  if (planType === "普通类(本科批)") return "本科批";
  if (planType === "普通类(提前批)") return "提前批";
  return undefined;
}

function compactRecord(record) {
  return Object.fromEntries(Object.entries(record).filter(([key, value]) => {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return value !== "" || ["sourceProfessionalGroupRaw", "sourceElectiveRaw"].includes(key);
  }));
}

function recordFromRow(row, evidence) {
  const classification = classifyPlanType(row.planType);
  const key = [row.province, row.planType, row.major, row.subject, row.elective, row.plan].join("|");
  return compactRecord({
    id: `2026-ecnu-national-plan-${hash(key)}`,
    province: row.province,
    year: YEAR,
    sourcePlanYear: YEAR,
    subjectType: subjectTypeFrom(row.subject),
    batch: batchFrom(row.planType),
    sourceBatchRaw: row.planType,
    schoolName: SCHOOL_NAME,
    schoolCode: SCHOOL_CODE,
    schoolIdentifierCode: SCHOOL_IDENTIFIER_CODE,
    schoolTags: ["上海", "公办", "985", "211", "双一流", "教育部直属"],
    dataType: "admission-plan",
    majorName: row.major,
    sourceMajorRaw: row.major,
    planCount: row.plan,
    electiveRequirement: row.elective || undefined,
    sourceElectiveRaw: row.elective,
    sourceProfessionalGroupRaw: row.elective,
    sourceSubjectRaw: row.subject,
    sourceTypeRaw: row.planType,
    sourcePlanCategoryRaw: row.planType,
    formalScoreScope: classification.formalScoreScope,
    admissionType: classification.admissionType,
    admissionSubtype: classification.admissionSubtype,
    schoolOfficialScope: "single-school-admission-plan",
    planRemark: classification.formalScoreScope === "special-path-only" ? `招生类型：${row.planType}` : undefined,
    sourceQuality: "official-school-ecnu-2026-national-plan-html",
    sourceId: SOURCE_ID,
    sourceUrl: PLAN_URL,
    sourcePageUrl: PLAN_URL,
    sourceIndexUrl: PLAN_URL,
    officialEvidencePath: evidence.planPath,
    officialCharterEvidencePath: evidence.charterPath,
    cautions: [
      "本记录来自华东师范大学信息公开网公开的2026年分省分专业招生计划，只作当年专业池、计划数、科类、专业组和招生路径约束，不是投档线、录取最低分或录取概率。",
      "仅官网明确标注的普通类(本科批)保持school-official-only；普通类(提前批)、专项、优师、综合评价、民族班、艺体、内地班和南疆计划均隔离为special-path-only。",
      "官网‘专业组’空白保持为空，不补造‘不限选考’；页面专业组标签不替代省级招生计划中的院校专业组代码和最终选科要求。",
      "学校章程明确批次、专业、人数及报考要求由各省级招生考试机构公布；强基计划、保送生、运动训练及高水平运动队等特殊类型不包含在省级公布计划中。",
    ],
  });
}

function typeBreakdown(rows) {
  return Object.fromEntries(Object.keys(EXPECTED.typeBreakdown).map((planType) => {
    const typed = rows.filter((row) => row.planType === planType);
    return [planType, { records: typed.length, planCount: typed.reduce((sum, row) => sum + row.plan, 0) }];
  }));
}

function provinceBreakdown(records) {
  return PROVINCES.map((province) => {
    const rows = records.filter((record) => record.province === province);
    return {
      province,
      records: rows.length,
      planCount: rows.reduce((sum, record) => sum + record.planCount, 0),
      ordinaryRecords: rows.filter((record) => record.formalScoreScope === "school-official-only").length,
      specialPathRecords: rows.filter((record) => record.formalScoreScope === "special-path-only").length,
    };
  });
}

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

async function fetchBytes(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 gaokao-ecnu-v366-importer/1.0", accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
        signal: AbortSignal.timeout(90_000),
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      if (bytes.length < 10_000) throw new Error(`Unexpectedly short response for ${url}`);
      return bytes;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

async function readOrFetch(file, url, useCache) {
  if (useCache && fs.existsSync(file) && fs.statSync(file).size > 0) return fs.readFileSync(file);
  const bytes = await fetchBytes(url);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  return bytes;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:\n  node scripts/import-official-national-school-plan-2026-v366-ecnu.mjs --use-cache\n  node scripts/import-official-national-school-plan-2026-v366-ecnu.mjs --out ${DEFAULT_OUT}`);
    return;
  }
  const rawDir = path.resolve(PROJECT_ROOT, args.rawDir);
  const planFile = path.join(rawDir, "plan-page.html");
  const charterFile = path.join(rawDir, "charter-page.html");
  const planBytes = await readOrFetch(planFile, PLAN_URL, args.useCache);
  const charterBytes = await readOrFetch(charterFile, CHARTER_URL, args.useCache);
  const planHash = sha256(planBytes);
  const charterHash = sha256(charterBytes);
  const rawCorpusHash = sha256(Buffer.concat([planBytes, charterBytes]));
  invariant(planBytes.length === EXPECTED.planPageBytes && planHash === EXPECTED_PLAN_PAGE_SHA256, "official plan page bytes or hash changed");
  invariant(charterBytes.length === EXPECTED.charterPageBytes && charterHash === EXPECTED_CHARTER_PAGE_SHA256, "official charter page bytes or hash changed");
  invariant(planBytes.length + charterBytes.length === EXPECTED.rawCorpusBytes && rawCorpusHash === EXPECTED_RAW_CORPUS_SHA256, "raw evidence corpus changed");

  const planText = descendantText(htmlText(planBytes));
  const charterText = descendantText(htmlText(charterBytes));
  invariant(planText.includes("华东师范大学2026年招生计划") && planText.includes("发布时间：2026-06-15"), "official plan page identity or publication date missing");
  invariant(charterText.includes("华东师范大学2026年本科招生章程") && charterText.includes("分省份分专业招生计划"), "official charter identity or plan clause missing");
  invariant(charterText.includes("各省级招生考试机构公布计划中不包含强基计划"), "official charter exclusion caveat missing");

  const parsed = parsePlanTable(planBytes);
  const rows = parsed.rows;
  const duplicateRows = rows.length - new Set(rows.map((row) => JSON.stringify(row))).size;
  const planCount = rows.reduce((sum, row) => sum + row.plan, 0);
  const provinces = [...new Set(rows.map((row) => row.province))];
  const canonicalHash = canonicalRowsSha256(rows);
  const breakdown = typeBreakdown(rows);
  invariant(rows.length === EXPECTED.records, `expected ${EXPECTED.records} records, got ${rows.length}`);
  invariant(planCount === EXPECTED.planCount, `expected ${EXPECTED.planCount} plans, got ${planCount}`);
  invariant(parsed.invalidRows === 0 && duplicateRows === 0, `expected zero invalid/duplicate rows, got ${parsed.invalidRows}/${duplicateRows}`);
  invariant(JSON.stringify(provinces) === JSON.stringify(PROVINCES), "province coverage or source order changed");
  invariant(canonicalHash === EXPECTED_CANONICAL_SHA256, "canonical plan payload hash changed");
  invariant(Object.entries(EXPECTED.typeBreakdown).every(([type, expected]) => breakdown[type]?.records === expected.records && breakdown[type]?.planCount === expected.planCount), "plan type breakdown changed");

  const evidence = { planPath: relativeProjectPath(planFile), charterPath: relativeProjectPath(charterFile) };
  const records = rows.map((row) => recordFromRow(row, evidence));
  const ordinary = records.filter((record) => record.formalScoreScope === "school-official-only");
  const special = records.filter((record) => record.formalScoreScope === "special-path-only");
  invariant(new Set(records.map((record) => record.id)).size === records.length, "record IDs must be unique");
  invariant(ordinary.length === EXPECTED.ordinaryRecords && ordinary.reduce((sum, record) => sum + record.planCount, 0) === EXPECTED.ordinaryPlanCount, "ordinary totals changed");
  invariant(special.length === EXPECTED.specialPathRecords && special.reduce((sum, record) => sum + record.planCount, 0) === EXPECTED.specialPlanCount, "special-path totals changed");

  const rawPaths = [evidence.planPath, evidence.charterPath];
  const cautions = records[0].cautions;
  const sourceNote = {
    id: SOURCE_ID,
    title: "华东师范大学2026年招生计划",
    publisher: "华东师范大学信息公开网",
    url: PLAN_URL,
    charterUrl: CHARTER_URL,
    publishedDate: "2026-06-15",
    quality: "official-school-ecnu-2026-national-plan-html",
    schoolCode: SCHOOL_CODE,
    schoolIdentifierCode: SCHOOL_IDENTIFIER_CODE,
    schoolName: SCHOOL_NAME,
    rawRecords: rows.length,
    records: records.length,
    rawPlanCount: planCount,
    planCount,
    invalidRows: parsed.invalidRows,
    duplicateRows,
    provinces: provinces.length,
    provinceCount: provinces.length,
    ordinaryRecords: ordinary.length,
    ordinaryPlanCount: ordinary.reduce((sum, record) => sum + record.planCount, 0),
    specialPathRecords: special.length,
    specialPlanCount: special.reduce((sum, record) => sum + record.planCount, 0),
    typeBreakdown: breakdown,
    provinceBreakdown: provinceBreakdown(records),
    planPageBytes: planBytes.length,
    charterPageBytes: charterBytes.length,
    rawCorpusBytes: planBytes.length + charterBytes.length,
    planPageSha256: planHash,
    charterPageSha256: charterHash,
    rawCorpusSha256: rawCorpusHash,
    canonicalPayloadSha256: canonicalHash,
    hashAlgorithm: "SHA-256",
    rawPaths,
    rawEvidence: [
      { path: evidence.planPath, url: PLAN_URL, bytes: planBytes.length, sha256: planHash },
      { path: evidence.charterPath, url: CHARTER_URL, bytes: charterBytes.length, sha256: charterHash },
    ],
    usage: "仅用于当年专业池、计划数、科类、专业组和招生路径约束，不替代省级考试院招生计划、投档线、录取最低分或录取概率。",
    cautions,
  };
  const summary = {
    records: records.length,
    planCount,
    rawRecords: rows.length,
    rawPlanCount: planCount,
    duplicateRows,
    invalidRows: parsed.invalidRows,
    provinces: provinces.length,
    ordinaryRecords: ordinary.length,
    ordinaryPlanCount: sourceNote.ordinaryPlanCount,
    specialPathRecords: special.length,
    specialPlanCount: sourceNote.specialPlanCount,
    typeBreakdown: breakdown,
  };
  const output = {
    version: "v3.366",
    generatedAt: new Date().toISOString(),
    dataset: "official-ecnu-national-plan-2026-v3.366",
    sourceNotes: [sourceNote],
    summary,
    records,
  };
  const outputFile = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "ok",
    version: output.version,
    out: relativeProjectPath(outputFile),
    records: records.length,
    provinces: provinces.length,
    planCount,
    ordinaryRecords: ordinary.length,
    specialPathRecords: special.length,
    rawCorpusSha256: rawCorpusHash,
    canonicalPayloadSha256: canonicalHash,
    sha256: sha256(fs.readFileSync(outputFile)),
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
