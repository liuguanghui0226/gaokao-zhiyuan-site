#!/usr/bin/env node

import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUT = "data/admissions/official-national-school-plan-2026-v367-nchu-import.json";
const DEFAULT_RAW_DIR = "data/admissions/raw/official-national-school-plan-2026-v367-nchu";
const PLAN_URL = "https://zsw.nchu.edu.cn/index.php?sys=home&module=school_zsjh";
const API_URL = `${PLAN_URL}&dev=ajax`;
const SCRIPT_URL = "https://zsw.nchu.edu.cn/js/school_zsjh_map_ajax.js";
const ARTICLE_URL = "https://zsw.nchu.edu.cn/index.php?sys=home&module=article&param=48&act=view&article_id=e9NxGAyJGZMp";
const INDEX_URL = "https://zsw.nchu.edu.cn/";
const SOURCE_ID = "official-nchu-national-plan-2026-api";
const SCHOOL_CODE = "10406";
const SCHOOL_IDENTIFIER_CODE = "4136010406";
const SCHOOL_NAME = "南昌航空大学";
const YEAR = 2026;

const PROVINCES = [
  ["北京", "beijing", 8, 18, 15348, "b115ebe70f300fae1a6690c942e416235962b19c558049d3927a058ae1830393"],
  ["天津", "tianjin", 23, 50, 36328, "b63d22d1871e64e9eda74ea0712afcefd2ee112d6cf73abfa44dfea65b488b6a"],
  ["河北", "hebei", 59, 232, 86570, "eaa675fcce257e8f14e72e42b8bce08a4264c0812fd3beb5d4d5323bb89e1472"],
  ["山西", "shanxi", 37, 91, 54344, "a600e3371b0ad8cd82e83213a60a20b643a24f289a965b2f034a62214fe09b79"],
  ["内蒙古", "inner-mongolia", 17, 45, 28659, "a5b025f562582b12305ea13f4125fad78294417772bf7ecc648d0737fe4e54c1"],
  ["辽宁", "liaoning", 20, 45, 31534, "88838593224fee2856d0e51e0765e536102c717469562c7aeaa7068bb42d7561"],
  ["吉林", "jilin", 16, 35, 25866, "3adf6111c96c3995347521f8358e5c6ebc21e667dc503d151c8faf4b473331a4"],
  ["黑龙江", "heilongjiang", 37, 110, 58459, "ff5ef8292c603d741de8889e9021c725d1d209638fe5f2c750cd6accc12d8e3b"],
  ["上海", "shanghai", 16, 45, 26394, "dfb77b957931ca34fb0b7f72669c011dfbfc35684c2cf5c95c6ef79ffe4e13fb"],
  ["江苏", "jiangsu", 51, 117, 76624, "4808d28718f52d5eb3314335d10dbf1353a9b3da222f6962d8d9f02364019119"],
  ["浙江", "zhejiang", 31, 81, 49478, "f23da5cfc2604ef37b4a789f674b6ca500a7d59d1386e70fff749ee2a9cfd9b6"],
  ["安徽", "anhui", 57, 263, 85098, "fe584833e24343736a05e02af6179bd1ebf1372bade6dfb09f9c2ef1128a9fca"],
  ["福建", "fujian", 42, 103, 64772, "280be3979c98653b5e53a741409663fc150b77bbcd7bb97571c6d628fd6d4775"],
  ["江西", "jiangxi", 131, 4108, 175171, "be19820a811b83efc8011ed6f05f68c8e9ca98e1069eb001485f7fa869ef202c"],
  ["山东", "shandong", 46, 150, 70414, "ac17630ab0967337de8eb487a3c59caac307e316622ecc6c2e86a44485b2c23a"],
  ["河南", "henan", 57, 228, 85174, "41fcc764fddd4b509547ae80b062fa8196a22ba727d03b6f7afcc9536b3d78b8"],
  ["湖北", "hubei", 57, 165, 83690, "3f5ca1af701dce4d6d361c5b90f0f9ac24a2f879a2af1b3f42dd8e1f57e5b77e"],
  ["湖南", "hunan", 53, 221, 81984, "557dc573b6008c1c8a04592c2c508310b114855168f6f3123e1b7c0a4cfee982"],
  ["广东", "guangdong", 58, 162, 90124, "2798d260d3fe340a7b3307b75f795b51646bf115778498b4bb49943c256adf00"],
  ["广西", "guangxi", 39, 106, 56430, "e0fec9dad98a4efc36ac035ce6863f527ffc70f59d86ea2e260c307047aea05c"],
  ["海南", "hainan", 20, 50, 34492, "a5a8476c4a471be3b1d76e0e51038bb268f3c4c669af31914286093c9a3167cc"],
  ["重庆", "chongqing", 19, 40, 29054, "b0ea112353b4b2cbb5191282c29f8ef25c82028019a1c868b4f515a612ef5386"],
  ["四川", "sichuan", 40, 116, 59502, "600f1aa9a81ce719b18b11d0347ba50d5813fae8a1817fadaa2c2db6ead19021"],
  ["贵州", "guizhou", 37, 113, 55180, "3d4d27aa8845874a247de3707f721fab7cabb2d56e8ddd4c93377b7299d07811"],
  ["云南", "yunnan", 30, 72, 43794, "64ccd33077d247f1c866b5a5d6ce858db3c04166c54f9f8c61ebc7fddd5a2028"],
  ["西藏", "xizang", 0, 0, 4601, "e5310fa5190091b2da992211d0aedfa6e08ecee8bae0a239ad74227773bf8dbd"],
  ["陕西", "shaanxi", 38, 105, 56698, "17b8ad054d2ef750a3ccc52413cfa7e15482bc1f6afc985cdfe4ae24bb559c8b"],
  ["甘肃", "gansu", 25, 56, 37234, "9a0f250801ed5f0dd51c3ce62844e9f87fe8bd81fe6229f04ddcc49e195a9e9d"],
  ["青海", "qinghai", 4, 10, 9778, "1674b00a6465dcd99b0e40ffc9497bbb94c910e926a80c7994f20780c5f3b6bb"],
  ["宁夏", "ningxia", 0, 0, 4601, "2b0c3f3d6d04d14544be8e3dd8110387b1895174b7b4901cd2580b8b07c1b3a2"],
  ["新疆", "xinjiang", 24, 51, 37146, "ed6d2bd66d151d0a38a3951c36f56601c509548c132db5eec2119ca7221e8dfc"],
].map(([province, slug, records, planCount, bytes, responseSha256]) => ({ province, slug, records, planCount, bytes, responseSha256 }));

export const EXPECTED = {
  records: 1092,
  planCount: 6988,
  requestedProvinces: 31,
  provinces: 29,
  ordinaryRecords: 913,
  ordinaryPlanCount: 5780,
  specialPathRecords: 179,
  specialPlanCount: 1208,
  apiResponseBytes: 1_654_541,
  stableEvidenceCorpusBytes: 1_688_983,
  typeBreakdown: {
    "普通类": { records: 913, planCount: 5780 },
    "中外合作办学": { records: 79, planCount: 580 },
    "艺术类": { records: 41, planCount: 347 },
    "体育类": { records: 7, planCount: 40 },
    "地方专项": { records: 21, planCount: 135 },
    "国家专项": { records: 18, planCount: 75 },
    "新疆班": { records: 12, planCount: 21 },
    "提前批": { records: 1, planCount: 10 },
  },
};

const EXPECTED_API_CORPUS_SHA256 = "4bdc52c4dfb1a2a3b54b69a18e5814bf47104c4911f4e5e3f688249b94025c97";
const EXPECTED_PLAN_SCRIPT_SHA256 = "e51b23b189902611295795ff07a8479a6c69d15e05972fc4090331f463ecd702";
const EXPECTED_CANONICAL_PLAN_PAGE_SHA256 = "793736e03b3298374a5beb664facfa0e3c66ab9885f1eb7e00db08ce50f9c815";
const EXPECTED_CANONICAL_ARTICLE_PAGE_SHA256 = "063b9a66d514ec5bce662364572f55eb5e6e7ff834842cabb40a0724c4ceac02";
const EXPECTED_STABLE_EVIDENCE_CORPUS_SHA256 = "59e06548fcf9af9ad86c69138a4fb714bfe46ed4a89111cc698c7e24d3f71006";
const EXPECTED_CANONICAL_PAYLOAD_SHA256 = "46446617f346820661fe9ce11c91504f692e4d16bb3b4e277dcbaacacd29950b";
const TYPE_ORDER = ["普通类", "中外合作办学", "艺术类", "体育类", "地方专项", "国家专项", "新疆班", "提前批"];

function invariant(condition, message) {
  if (!condition) throw new Error(`南昌航空大学 2026 计划 v3.367 audit failed: ${message}`);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function relativeProjectPath(file) {
  return path.relative(PROJECT_ROOT, file).replaceAll(path.sep, "/");
}

export function clean(value) {
  return String(value ?? "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[\u00a0\u3000]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalizeOfficialHtml(value) {
  return String(value ?? "")
    .replace(/点击：\d+次/g, "点击：{dynamic}次")
    .replace(/今日访问量：\d+\s+总访问量：\d+/g, "今日访问量：{dynamic} 总访问量：{dynamic}");
}

export function subjectTypeFrom(raw) {
  const text = clean(raw);
  if (/艺术|美术|音乐|舞蹈|播音/.test(text)) return "艺术类";
  if (/体育/.test(text)) return "体育类";
  if (/历史|文史/.test(text)) return "历史类";
  if (/物理|理工/.test(text)) return "物理类";
  if (/综合/.test(text)) return "综合改革";
  return text || "综合";
}

function normalizedApiRow(row, expectedProvince) {
  const normalized = {
    sourceRowId: clean(row?.ID),
    year: Number(clean(row?.ND)),
    province: clean(row?.SFMC),
    batch: clean(row?.PCMC),
    subject: clean(row?.KLMC),
    major: clean(row?.ZYMC),
    educationLevel: clean(row?.CCMC),
    professionalGroup: clean(row?.ZYZ),
    examType: clean(row?.KSLXMC),
    direction: clean(row?.ZKFX),
    teacherTraining: clean(row?.isSF),
    planNature: clean(row?.JHXZ),
    planCategory: clean(row?.JHLB),
    duration: clean(row?.XZ),
    planCount: Number(clean(row?.JHS).replace(/[,，]/g, "")),
    tuition: clean(row?.XFBZ),
    remark: clean(row?.BZ),
  };
  invariant(/^\d+$/.test(normalized.sourceRowId), `invalid source row ID ${JSON.stringify(normalized.sourceRowId)}`);
  invariant(normalized.year === YEAR, `row ${normalized.sourceRowId} has year ${normalized.year}`);
  invariant(normalized.province === expectedProvince, `row ${normalized.sourceRowId} has province ${normalized.province}, expected ${expectedProvince}`);
  invariant(normalized.batch && normalized.subject && normalized.major && normalized.educationLevel, `row ${normalized.sourceRowId} is missing a required label`);
  invariant(normalized.planCategory && normalized.planNature && normalized.duration, `row ${normalized.sourceRowId} is missing plan metadata`);
  invariant(Number.isSafeInteger(normalized.planCount) && normalized.planCount > 0, `row ${normalized.sourceRowId} has invalid plan count ${row?.JHS}`);
  return normalized;
}

export function parseProvincePayload(payload, expectedProvince) {
  invariant(payload && typeof payload === "object", `${expectedProvince} payload is not an object`);
  invariant(Array.isArray(payload.records_block), `${expectedProvince} payload is missing records_block`);
  const declaredMatch = String(payload.countpage ?? "").match(/共\s*<b>(\d+)<\/b>\s*条/);
  invariant(declaredMatch, `${expectedProvince} payload is missing declared row count`);
  const declared = Number(declaredMatch[1]);
  invariant(declared === payload.records_block.length, `${expectedProvince} declared ${declared} rows but returned ${payload.records_block.length}`);
  if (payload.page_title !== undefined) invariant(clean(payload.page_title) === "招生计划查询", `${expectedProvince} payload title changed`);
  const rows = payload.records_block.map((row) => normalizedApiRow(row, expectedProvince));
  invariant(new Set(rows.map((row) => row.sourceRowId)).size === rows.length, `${expectedProvince} contains duplicate source row IDs`);
  return rows;
}

export function canonicalRowsSha256(rows) {
  return sha256(JSON.stringify(rows.map((row) => ({
    sourceRowId: row.sourceRowId,
    year: row.year,
    province: row.province,
    batch: row.batch,
    subject: row.subject,
    major: row.major,
    educationLevel: row.educationLevel,
    professionalGroup: row.professionalGroup,
    examType: row.examType,
    direction: row.direction,
    teacherTraining: row.teacherTraining,
    planNature: row.planNature,
    planCategory: row.planCategory,
    duration: row.duration,
    planCount: row.planCount,
    tuition: row.tuition,
    remark: row.remark,
  }))));
}

export function classifyPlan(row) {
  const category = clean(row.planCategory);
  const batch = clean(row.batch);
  const subject = clean(row.subject);
  const major = clean(row.major);
  const text = [category, batch, subject, major, clean(row.examType), clean(row.direction), clean(row.remark)].join("|");
  let planType = "普通类";
  let admissionType = "普通录取";
  let admissionSubtype = category || "普通类";
  if (/艺术|艺考|美术|音乐|舞蹈|播音/.test(text)) {
    planType = admissionType = "艺术类";
    admissionSubtype = category || batch || subject;
  } else if (/体育/.test(text)) {
    planType = admissionType = "体育类";
    admissionSubtype = batch || subject;
  } else if (/中外合作|合作办学|中白双学位|中美双学位/.test(text)) {
    planType = admissionType = admissionSubtype = "中外合作办学";
  } else if (/地方专项/.test(category)) {
    planType = admissionType = "地方专项";
    admissionSubtype = category;
  } else if (/国家专项/.test(category)) {
    planType = admissionType = "国家专项";
    admissionSubtype = category;
  } else if (/新疆班/.test(category)) {
    planType = admissionType = "新疆班";
    admissionSubtype = category;
  } else if (/提前/.test(batch) || major === "飞行技术" || /民航招飞/.test(text)) {
    planType = admissionType = "提前批";
    admissionSubtype = batch || "提前批";
  } else if (category && category !== "普通类") {
    planType = admissionType = category;
    admissionSubtype = category;
  }
  return { planType, admissionType, admissionSubtype, formalScoreScope: planType === "普通类" ? "school-official-only" : "special-path-only" };
}

function compactRecord(record) {
  return Object.fromEntries(Object.entries(record).filter(([key, value]) => {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return value !== "" || key === "sourceProfessionalGroupRaw";
  }));
}

function planRemarkFrom(row) {
  const parts = [];
  if (row.planCategory && row.planCategory !== "普通类") parts.push(`计划类别：${row.planCategory}`);
  if (row.examType && row.examType !== "无") parts.push(`考试类型：${row.examType}`);
  if (row.direction && row.direction !== "无") parts.push(`招考方向：${row.direction}`);
  if (row.remark) parts.push(row.remark);
  return parts.join("；");
}

export function recordFromRow(row, evidencePath) {
  const classification = classifyPlan(row);
  return compactRecord({
    id: `2026-nchu-national-plan-${row.sourceRowId}`,
    sourceRowId: row.sourceRowId,
    province: row.province,
    year: YEAR,
    sourcePlanYear: YEAR,
    subjectType: subjectTypeFrom(row.subject),
    batch: row.batch,
    sourceBatchRaw: row.batch,
    schoolName: SCHOOL_NAME,
    schoolCode: SCHOOL_CODE,
    schoolIdentifierCode: SCHOOL_IDENTIFIER_CODE,
    schoolTags: ["江西", "南昌", "公办", "理工", "航空"],
    city: "南昌",
    dataType: "admission-plan",
    majorName: row.major,
    sourceMajorRaw: row.major,
    majorGroup: row.professionalGroup || undefined,
    sourceProfessionalGroupRaw: row.professionalGroup,
    planCount: row.planCount,
    educationLevel: row.educationLevel,
    programDuration: row.duration,
    tuition: row.tuition || undefined,
    sourceTuitionRaw: row.tuition || undefined,
    sourceSubjectRaw: row.subject,
    sourceExamTypeRaw: row.examType || undefined,
    sourceDirectionRaw: row.direction || undefined,
    sourceTeacherTrainingRaw: row.teacherTraining || undefined,
    sourcePlanNatureRaw: row.planNature,
    sourcePlanCategoryRaw: row.planCategory,
    sourceTypeRaw: row.planCategory,
    sourceNoteRaw: row.remark || undefined,
    formalScoreScope: classification.formalScoreScope,
    admissionType: classification.admissionType,
    admissionSubtype: classification.admissionSubtype,
    schoolOfficialScope: "single-school-admission-plan",
    planRemark: planRemarkFrom(row) || undefined,
    sourceQuality: "official-school-nchu-2026-national-plan-api",
    sourceId: SOURCE_ID,
    sourceUrl: API_URL,
    sourcePageUrl: PLAN_URL,
    sourceIndexUrl: INDEX_URL,
    officialEvidencePath: evidencePath,
    cautions: [
      "本记录来自南昌航空大学招生信息网公开的2026年分省分专业招生计划 API，只作当年专业池、计划数、科类、批次、专业组和招生路径约束，不是投档线、录取最低分或录取概率。",
      "艺考、体育、中外合作办学、国家专项、地方专项、新疆班和民航招飞提前批均隔离为special-path-only，不与普通录取边界混用。",
      "官网 API 覆盖31个省级查询入口，其中西藏、宁夏返回0条；不补造零计划记录，专业组代码不推断为选科要求。",
      "学校公告提示计划、批次、专业组等信息以各省、市招办公布为准，学费和住宿费以江西省物价部门最终批准标准为准。",
    ],
  });
}

function breakdown(records) {
  return Object.fromEntries(TYPE_ORDER.map((type) => {
    const selected = records.filter((record) => classifyPlan({
      planCategory: record.sourcePlanCategoryRaw,
      batch: record.sourceBatchRaw,
      subject: record.sourceSubjectRaw,
      major: record.sourceMajorRaw,
      examType: record.sourceExamTypeRaw,
      direction: record.sourceDirectionRaw,
      remark: record.sourceNoteRaw,
    }).planType === type);
    return [type, { records: selected.length, planCount: selected.reduce((sum, record) => sum + record.planCount, 0) }];
  }));
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

function curlBytes(url, accept) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const result = spawnSync("curl", [
      "-fsSL", "--retry", "2", "--connect-timeout", "20", "--max-time", "120",
      "-A", "Mozilla/5.0 gaokao-nchu-v367-importer/1.0",
      "-H", `accept: ${accept}`,
      "-H", `referer: ${PLAN_URL}`,
      url,
    ], { encoding: null, maxBuffer: 8 * 1024 * 1024 });
    if (result.status === 0 && result.stdout?.length) return Buffer.from(result.stdout);
    lastError = new Error(`curl failed for ${url}: ${clean(result.stderr?.toString("utf8")) || `exit ${result.status}`}`);
  }
  throw lastError;
}

function readOrFetch(file, url, accept, useCache) {
  if (useCache && fs.existsSync(file) && fs.statSync(file).size > 0) return fs.readFileSync(file);
  const bytes = curlBytes(url, accept);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  return bytes;
}

function provinceApiUrl(province) {
  const url = new URL(API_URL);
  url.searchParams.set("ND", String(YEAR));
  url.searchParams.set("SFMC", province);
  url.searchParams.set("PCMC", "");
  url.searchParams.set("KLMC", "");
  url.searchParams.set("pagelist", "500");
  url.searchParams.set("limit", "500");
  url.searchParams.set("offset", "0");
  return url.toString();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:\n  node scripts/import-official-national-school-plan-2026-v367-nchu.mjs\n  node scripts/import-official-national-school-plan-2026-v367-nchu.mjs --use-cache\n  node scripts/import-official-national-school-plan-2026-v367-nchu.mjs --out ${DEFAULT_OUT}`);
    return;
  }
  const rawDir = path.resolve(PROJECT_ROOT, args.rawDir);
  const planFile = path.join(rawDir, "plan-page.html");
  const scriptFile = path.join(rawDir, "plan-query.js");
  const articleFile = path.join(rawDir, "announcement-page.html");
  const planBytes = readOrFetch(planFile, PLAN_URL, "text/html,application/xhtml+xml,*/*;q=0.8", args.useCache);
  const scriptBytes = readOrFetch(scriptFile, SCRIPT_URL, "text/javascript,application/javascript,*/*;q=0.8", args.useCache);
  const articleBytes = readOrFetch(articleFile, ARTICLE_URL, "text/html,application/xhtml+xml,*/*;q=0.8", args.useCache);
  const canonicalPlanBytes = Buffer.from(canonicalizeOfficialHtml(planBytes.toString("utf8")));
  const canonicalArticleBytes = Buffer.from(canonicalizeOfficialHtml(articleBytes.toString("utf8")));
  invariant(sha256(canonicalPlanBytes) === EXPECTED_CANONICAL_PLAN_PAGE_SHA256, "canonical plan page hash changed");
  invariant(scriptBytes.length === 4538 && sha256(scriptBytes) === EXPECTED_PLAN_SCRIPT_SHA256, "plan query script bytes or hash changed");
  invariant(sha256(canonicalArticleBytes) === EXPECTED_CANONICAL_ARTICLE_PAGE_SHA256, "canonical announcement page hash changed");
  const planText = planBytes.toString("utf8");
  const scriptText = scriptBytes.toString("utf8");
  const articleText = articleBytes.toString("utf8");
  invariant(planText.includes("招生计划查询") && planText.includes("school_zsjh_map_ajax.js"), "official plan query page identity missing");
  invariant(scriptText.includes("module=school_zsjh") && scriptText.includes("dev=ajax"), "official plan query script endpoint missing");
  invariant(articleText.includes("2026年分省分专业招生计划") && articleText.includes("发布时间：2026-06-18"), "official announcement identity or date missing");
  invariant(articleText.includes("计划、批次、专业组等相关信息请以各省、市招办公布为准"), "official announcement caveat missing");

  const apiBytes = [];
  const rows = [];
  const provinceResponses = [];
  for (const expected of PROVINCES) {
    const apiFile = path.join(rawDir, "api", `${expected.slug}.json`);
    const bytes = readOrFetch(apiFile, provinceApiUrl(expected.province), "application/json, text/javascript, */*; q=0.01", args.useCache);
    const responseHash = sha256(bytes);
    invariant(bytes.length === expected.bytes, `${expected.province} API bytes changed: expected ${expected.bytes}, got ${bytes.length}`);
    invariant(responseHash === expected.responseSha256, `${expected.province} API hash changed`);
    let payload;
    try { payload = JSON.parse(bytes.toString("utf8")); } catch (error) { throw new Error(`${expected.province} API JSON parse failed: ${error.message}`); }
    const provinceRows = parseProvincePayload(payload, expected.province);
    const planCount = provinceRows.reduce((sum, row) => sum + row.planCount, 0);
    invariant(provinceRows.length === expected.records && planCount === expected.planCount, `${expected.province} API totals changed`);
    apiBytes.push(bytes);
    rows.push(...provinceRows);
    provinceResponses.push({ province: expected.province, slug: expected.slug, records: provinceRows.length, planCount, bytes: bytes.length, sha256: responseHash });
  }

  const apiCorpus = Buffer.concat(apiBytes);
  const apiCorpusHash = sha256(apiCorpus);
  const stableEvidenceCorpus = Buffer.concat([canonicalPlanBytes, scriptBytes, canonicalArticleBytes, ...apiBytes]);
  const stableEvidenceCorpusHash = sha256(stableEvidenceCorpus);
  const canonicalPayloadHash = canonicalRowsSha256(rows);
  const rawPlanCount = rows.reduce((sum, row) => sum + row.planCount, 0);
  const duplicateRows = rows.length - new Set(rows.map((row) => row.sourceRowId)).size;
  const populatedProvinces = PROVINCES.filter((item) => item.records > 0).map((item) => item.province);
  const emptyProvinces = PROVINCES.filter((item) => item.records === 0).map((item) => item.province);
  invariant(rows.length === EXPECTED.records && rawPlanCount === EXPECTED.planCount, "national API totals changed");
  invariant(PROVINCES.length === EXPECTED.requestedProvinces && populatedProvinces.length === EXPECTED.provinces, "province coverage changed");
  invariant(duplicateRows === 0, `duplicate source row IDs: ${duplicateRows}`);
  invariant(apiCorpus.length === EXPECTED.apiResponseBytes && apiCorpusHash === EXPECTED_API_CORPUS_SHA256, "API response corpus changed");
  invariant(stableEvidenceCorpus.length === EXPECTED.stableEvidenceCorpusBytes && stableEvidenceCorpusHash === EXPECTED_STABLE_EVIDENCE_CORPUS_SHA256, "stable evidence corpus changed");
  invariant(canonicalPayloadHash === EXPECTED_CANONICAL_PAYLOAD_SHA256, "canonical API payload changed");

  const records = rows.map((row) => recordFromRow(row, relativeProjectPath(path.join(rawDir, "api", `${PROVINCES.find((item) => item.province === row.province).slug}.json`))));
  const ordinary = records.filter((record) => record.formalScoreScope === "school-official-only");
  const special = records.filter((record) => record.formalScoreScope === "special-path-only");
  const typeBreakdown = breakdown(records);
  invariant(new Set(records.map((record) => record.id)).size === records.length, "runtime record IDs must be unique");
  invariant(ordinary.length === EXPECTED.ordinaryRecords && ordinary.reduce((sum, record) => sum + record.planCount, 0) === EXPECTED.ordinaryPlanCount, "ordinary totals changed");
  invariant(special.length === EXPECTED.specialPathRecords && special.reduce((sum, record) => sum + record.planCount, 0) === EXPECTED.specialPlanCount, "special-path totals changed");
  invariant(JSON.stringify(typeBreakdown) === JSON.stringify(EXPECTED.typeBreakdown), "plan type breakdown changed");

  const cautions = records[0].cautions;
  const sourceNote = {
    id: SOURCE_ID,
    title: "南昌航空大学2026年分省分专业招生计划",
    publisher: "南昌航空大学招生信息网",
    url: PLAN_URL,
    apiUrl: API_URL,
    scriptUrl: SCRIPT_URL,
    articleUrl: ARTICLE_URL,
    publishedDate: "2026-06-18",
    quality: "official-school-nchu-2026-national-plan-api",
    schoolCode: SCHOOL_CODE,
    schoolIdentifierCode: SCHOOL_IDENTIFIER_CODE,
    schoolName: SCHOOL_NAME,
    rawRecords: rows.length,
    records: records.length,
    rawPlanCount,
    planCount: rawPlanCount,
    invalidRows: 0,
    duplicateRows,
    apiRequests: PROVINCES.length,
    requestedProvinces: PROVINCES.length,
    provinces: populatedProvinces.length,
    provinceCount: populatedProvinces.length,
    emptyProvinces,
    ordinaryRecords: ordinary.length,
    ordinaryPlanCount: ordinary.reduce((sum, record) => sum + record.planCount, 0),
    specialPathRecords: special.length,
    specialPlanCount: special.reduce((sum, record) => sum + record.planCount, 0),
    typeBreakdown,
    rawCategoryBreakdown: {
      "普通类": { records: 1000, planCount: 6410 },
      "地方专项计划": { records: 21, planCount: 135 },
      "国家专项计划": { records: 18, planCount: 75 },
      "新疆班": { records: 12, planCount: 21 },
      "艺考类(统考)": { records: 41, planCount: 347 },
    },
    provinceResponses,
    planPageBytes: planBytes.length,
    planPageSha256: sha256(planBytes),
    canonicalPlanPageBytes: canonicalPlanBytes.length,
    canonicalPlanPageSha256: sha256(canonicalPlanBytes),
    planScriptBytes: scriptBytes.length,
    planScriptSha256: sha256(scriptBytes),
    articlePageBytes: articleBytes.length,
    articlePageSha256: sha256(articleBytes),
    canonicalArticlePageBytes: canonicalArticleBytes.length,
    canonicalArticlePageSha256: sha256(canonicalArticleBytes),
    apiResponseBytes: apiCorpus.length,
    apiCorpusSha256: apiCorpusHash,
    stableEvidenceCorpusBytes: stableEvidenceCorpus.length,
    stableEvidenceCorpusSha256: stableEvidenceCorpusHash,
    canonicalPayloadSha256: canonicalPayloadHash,
    hashAlgorithm: "SHA-256",
    rawPaths: [
      relativeProjectPath(planFile),
      relativeProjectPath(scriptFile),
      relativeProjectPath(articleFile),
      ...PROVINCES.map((item) => relativeProjectPath(path.join(rawDir, "api", `${item.slug}.json`))),
    ],
    usage: "仅用于当年专业池、计划数、科类、批次、专业组和招生路径约束，不替代省级考试院招生计划、投档线、录取最低分或录取概率。",
    cautions,
  };
  const summary = {
    records: records.length,
    planCount: rawPlanCount,
    rawRecords: rows.length,
    rawPlanCount,
    duplicateRows,
    invalidRows: 0,
    requestedProvinces: PROVINCES.length,
    provinces: populatedProvinces.length,
    emptyProvinces,
    ordinaryRecords: ordinary.length,
    ordinaryPlanCount: sourceNote.ordinaryPlanCount,
    specialPathRecords: special.length,
    specialPlanCount: sourceNote.specialPlanCount,
    typeBreakdown,
  };
  const output = {
    version: "v3.367",
    generatedAt: new Date().toISOString(),
    dataset: "official-nchu-national-plan-2026-v3.367",
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
    requestedProvinces: PROVINCES.length,
    provinces: populatedProvinces.length,
    emptyProvinces,
    planCount: rawPlanCount,
    ordinaryRecords: ordinary.length,
    ordinaryPlanCount: sourceNote.ordinaryPlanCount,
    specialPathRecords: special.length,
    specialPlanCount: sourceNote.specialPlanCount,
    apiResponseBytes: apiCorpus.length,
    apiCorpusSha256: apiCorpusHash,
    stableEvidenceCorpusSha256: stableEvidenceCorpusHash,
    canonicalPayloadSha256: canonicalPayloadHash,
    bytes: fs.statSync(outputFile).size,
    sha256: sha256(fs.readFileSync(outputFile)),
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
}
