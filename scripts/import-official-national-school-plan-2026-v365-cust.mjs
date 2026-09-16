#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUT = "data/admissions/official-national-school-plan-2026-v365-cust-import.json";
const DEFAULT_RAW_DIR = "data/admissions/raw/official-national-school-plan-2026-v365-cust";
const INDEX_URL = "https://zsb.cust.edu.cn/gszsjhcx/sc_1/2026/index.htm";
const CHARTER_URL = "https://zsb.cust.edu.cn/zxgg/aa163ef4df814a21a43e0d19aa5811d1.htm";
const SOURCE_ID = "official-cust-national-plan-2026-html";
const SCHOOL_CODE = "10186";
const SCHOOL_IDENTIFIER_CODE = "4122010186";
const SCHOOL_NAME = "长春理工大学";
const YEAR = 2026;

const PROVINCES = [
  ["北京", "北京市", "bj_1"], ["天津", "天津市", "tj_1"], ["河北", "河北省", "hb_1"], ["山西", "山西省", "sx_1"],
  ["内蒙古", "内蒙古自治区", "nmg_1"], ["辽宁", "辽宁省", "ln_1"], ["吉林", "吉林省", "jl_1"], ["黑龙江", "黑龙江省", "hlj_1"],
  ["上海", "上海市", "sh_1"], ["江苏", "江苏省", "js_1"], ["浙江", "浙江省", "zj_1"], ["安徽", "安徽省", "ah_1"],
  ["福建", "福建省", "fj_1"], ["江西", "江西省", "jx_1"], ["山东", "山东省", "sd_1"], ["河南", "河南省", "hn_1"],
  ["湖北", "湖北省", "hbs_1"], ["湖南", "湖南省", "hns_1"], ["广东", "广东省", "gd_1"], ["广西", "广西壮族自治区", "gx_1"],
  ["海南", "海南省", "hnss_1"], ["重庆", "重庆市", "cq_1"], ["四川", "四川省", "sc_1"], ["贵州", "贵州省", "gz_1"],
  ["云南", "云南省", "yn_1"], ["西藏", "西藏自治区", "xz_1"], ["陕西", "陕西省", "sxs_1"], ["甘肃", "甘肃省", "gs_1"],
  ["青海", "青海省", "qh_1"], ["宁夏", "宁夏回族自治区", "nx_1"], ["新疆", "新疆维吾尔自治区", "xj_1"],
].map(([province, sourceProvinceLabel, slug]) => ({ province, sourceProvinceLabel, slug }));

export const EXPECTED = {
  records: 1283,
  planCount: 5132,
  provinces: 31,
  ordinaryRecords: 1035,
  ordinaryPlanCount: 4075,
  specialPathRecords: 248,
  specialPlanCount: 1057,
  fourColumnPageCount: 29,
  threeColumnPageCount: 2,
  rawCorpusBytes: 2_871_445,
  typeBreakdown: {
    "普通类": { records: 1035, planCount: 4075 },
    "中外合作办学": { records: 101, planCount: 600 },
    "国家专项": { records: 96, planCount: 221 },
    "艺术类（设计学类）": { records: 16, planCount: 110 },
    "少数民族预科": { records: 14, planCount: 58 },
    "新疆班": { records: 11, planCount: 22 },
    "高职分类/对口升学": { records: 5, planCount: 35 },
    "对口支援新疆阿勒泰计划": { records: 3, planCount: 8 },
    "南疆计划": { records: 2, planCount: 3 },
  },
};

const EXPECTED_RAW_CORPUS_SHA256 = "b6759cdc4a4feee1970a3f25b7ebf131b0a15a17139e61cd23d78f15a1a6e0ac";
const EXPECTED_CANONICAL_SHA256 = "d7062daa30920c4d17101e0cb598dc05cdd5276f4193f516839862c81a35a0fe";

function invariant(condition, message) {
  if (!condition) throw new Error(`长春理工大学 2026 计划 v3.365 audit failed: ${message}`);
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
    .replace(/<[^>]*>/g, ""))
    .replace(/^\uFEFF/, "")
    .replace(/[\s\u00a0\u3000]+/g, "")
    .trim();
}

function htmlText(input) {
  if (typeof input === "string") return input;
  return new TextDecoder("utf-8").decode(Buffer.isBuffer(input) ? input : Buffer.from(input));
}

export function parsePlanIndexLinks(input) {
  const html = htmlText(input);
  const byLabel = new Map(PROVINCES.map((entry) => [entry.sourceProvinceLabel, entry]));
  const links = [];
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decodeEntities(match[1] || match[2] || match[3] || "");
    const sourceProvinceLabel = descendantText(match[4]);
    const expected = byLabel.get(sourceProvinceLabel);
    if (!expected || !href) continue;
    const slugMatch = href.match(/\/([a-z]+(?:_\d+)?)\/2026\/?(?:index\.htm)?$/i);
    if (!slugMatch || slugMatch[1] !== expected.slug) continue;
    links.push({
      province: expected.province,
      sourceProvinceLabel,
      slug: expected.slug,
      url: `https://zsb.cust.edu.cn/gszsjhcx/${expected.slug}/2026/index.htm`,
    });
  }
  return [...new Map(links.map((link) => [link.slug, link])).values()];
}

export function classifyPlanRow(major, subject = "") {
  const majorText = String(major ?? "").trim();
  const subjectText = String(subject ?? "").trim();
  let planType = "普通类";
  let admissionType = "普通录取";
  if (majorText.includes("中外合作办学")) planType = admissionType = "中外合作办学";
  else if (majorText.includes("国家专项")) planType = admissionType = "国家专项";
  else if (majorText === "设计学类") { planType = "艺术类（设计学类）"; admissionType = "艺术类"; }
  else if (majorText.includes("少数民族预科")) planType = admissionType = "少数民族预科";
  else if (majorText.includes("新疆班")) planType = admissionType = "新疆班";
  else if (/[（(]对口[)）]/.test(majorText) || /^(电子与信息类|公共管理与服务类)$/.test(subjectText)) planType = admissionType = "高职分类/对口升学";
  else if (majorText.includes("对口支援新疆阿勒泰计划")) planType = admissionType = "对口支援新疆阿勒泰计划";
  else if (majorText.includes("南疆计划")) planType = admissionType = "南疆计划";
  return { planType, admissionType, formalScoreScope: planType === "普通类" ? "school-official-only" : "special-path-only" };
}

function tableCells(rowHtml) {
  return [...String(rowHtml).matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map((match) => descendantText(match[1]));
}

export function parsePlanPage(input, link) {
  const html = htmlText(input);
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  const table = tables.find((candidate) => {
    const text = descendantText(candidate);
    return text.includes("专业（类）") && text.includes("招生计划");
  });
  invariant(table, `${link.sourceProvinceLabel || link.province} plan table missing`);
  let columns = 0;
  let headerSeen = false;
  let invalidRows = 0;
  const rows = [];
  for (const match of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = tableCells(match[1]);
    if (!cells.length) continue;
    if (cells[0] === "专业（类）" && cells.at(-1) === "招生计划") {
      columns = cells.length;
      headerSeen = true;
      continue;
    }
    if (!headerSeen || cells.every((cell) => !cell)) continue;
    if (cells.length !== columns || ![3, 4].includes(columns)) {
      invalidRows += 1;
      continue;
    }
    const [major, subject, elective, planText] = columns === 4 ? cells : [cells[0], cells[1], "", cells[2]];
    const plan = Number(planText);
    if (!major || !subject || !Number.isSafeInteger(plan) || plan <= 0) {
      invalidRows += 1;
      continue;
    }
    const classification = classifyPlanRow(major, subject);
    rows.push({
      province: link.province,
      sourceProvinceLabel: link.sourceProvinceLabel,
      major,
      subject,
      elective,
      plan,
      sourceUrl: link.url,
      planType: classification.planType,
    });
  }
  invariant(headerSeen, `${link.sourceProvinceLabel || link.province} plan header missing`);
  return { columns, invalidRows, rows };
}

export function canonicalRowsSha256(rows) {
  const canonical = rows.map((row) => ({
    province: row.province,
    sourceProvinceLabel: row.sourceProvinceLabel,
    major: row.major,
    subject: row.subject,
    elective: row.elective,
    plan: row.plan,
    sourceUrl: row.sourceUrl,
    planType: row.planType,
  }));
  return sha256(JSON.stringify(canonical));
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
        headers: { "user-agent": "Mozilla/5.0 gaokao-cust-v365-importer/1.0", accept: "text/html,application/xhtml+xml,*/*;q=0.8", referer: INDEX_URL },
        signal: AbortSignal.timeout(90_000),
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      if (bytes.length < 1000) throw new Error(`Unexpectedly short response for ${url}`);
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

function subjectTypeFrom(raw) {
  const text = String(raw ?? "").trim();
  if (/历史|文史/.test(text)) return "历史类";
  if (/物理|理工/.test(text)) return "物理类";
  if (/综合|不分文理/.test(text)) return "综合改革";
  return text || "综合";
}

function electiveRequirementFrom(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return undefined;
  return text.replace(/(?:不提科目要求){2,}/g, "不提科目要求");
}

function majorNameFrom(raw, planType) {
  let name = String(raw ?? "").trim();
  if (planType === "中外合作办学") name = name.replace(/[（(]中外合作办学[)）]\s*$/u, "");
  else if (planType === "国家专项") name = name.replace(/[（(]?国家专项[)）]?\s*$/u, "");
  else if (planType === "高职分类/对口升学") name = name.replace(/[（(]对口[)）]\s*$/u, "");
  else if (planType === "对口支援新疆阿勒泰计划") name = name.replace(/[（(]对口支援新疆阿勒泰计划[)）]\s*$/u, "");
  else if (planType === "南疆计划") name = name.replace(/[（(]南疆计划[)）]\s*$/u, "");
  else if (planType === "新疆班") name = name.replace(/[（(]新疆班[)）](?:普通类|单列类)?/u, "");
  return name.trim();
}

function compactRecord(record) {
  return Object.fromEntries(Object.entries(record).filter(([key, value]) => {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return value !== "" || ["sourceElectiveRaw", "sourceSubjectRaw"].includes(key);
  }));
}

function recordFromRow(row, link, evidence) {
  const classification = classifyPlanRow(row.major, row.subject);
  const key = [row.province, row.major, row.subject, row.elective, row.plan, row.planType].join("|");
  return compactRecord({
    id: `2026-cust-national-plan-${hash(key)}`,
    province: row.province,
    year: YEAR,
    sourcePlanYear: YEAR,
    subjectType: subjectTypeFrom(row.subject),
    schoolName: SCHOOL_NAME,
    schoolCode: SCHOOL_CODE,
    schoolIdentifierCode: SCHOOL_IDENTIFIER_CODE,
    schoolTags: ["吉林", "长春", "公办"],
    dataType: "admission-plan",
    majorName: majorNameFrom(row.major, row.planType),
    sourceMajorRaw: row.major,
    planCount: row.plan,
    electiveRequirement: electiveRequirementFrom(row.elective),
    sourceElectiveRaw: row.elective,
    sourceTypeRaw: row.planType,
    sourceSubjectRaw: row.subject,
    sourceProvinceLabel: row.sourceProvinceLabel,
    sourcePlanSchemaColumns: evidence.columns,
    formalScoreScope: classification.formalScoreScope,
    admissionType: classification.admissionType,
    admissionSubtype: row.planType,
    schoolOfficialScope: "single-school-admission-plan",
    planRemark: row.planType === "普通类" ? undefined : `招生类型：${row.planType}`,
    sourceQuality: "official-school-cust-2026-national-plan-html",
    sourceId: SOURCE_ID,
    sourceUrl: row.sourceUrl,
    sourcePageUrl: row.sourceUrl,
    sourceIndexUrl: INDEX_URL,
    officialEvidencePath: evidence.pagePath,
    officialCharterEvidencePath: evidence.charterPath,
    cautions: [
      "本记录来自长春理工大学本科招生网公开的2026年分省分专业招生计划，只作当年专业池、计划数、科类、选科和招生路径约束，不是投档线、录取最低分或录取概率。",
      "西藏、新疆官网表格没有选考科目列，sourceElectiveRaw保留为空，不补造‘不限选考’；其他省份保留官网原始选科文本。",
      "设计学类按学校章程隔离为艺术类；中外合作办学、国家专项、预科、新疆班、南疆计划、对口支援及吉林对口升学均隔离为special-path-only。",
      "具体招生计划以各省（自治区、直辖市）招生办公室公布的招生计划为准，正式填报前必须复核省级招生主管部门目录。",
    ],
  });
}

function typeBreakdown(rows) {
  return Object.fromEntries(Object.keys(EXPECTED.typeBreakdown).map((planType) => {
    const typed = rows.filter((row) => row.planType === planType);
    return [planType, { records: typed.length, planCount: typed.reduce((sum, row) => sum + row.plan, 0) }];
  }));
}

function assertExpectedBreakdown(actual) {
  invariant(Object.entries(EXPECTED.typeBreakdown).every(([type, expected]) => actual[type]?.records === expected.records && actual[type]?.planCount === expected.planCount), "plan type breakdown changed");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:\n  node scripts/import-official-national-school-plan-2026-v365-cust.mjs --use-cache\n  node scripts/import-official-national-school-plan-2026-v365-cust.mjs --out ${DEFAULT_OUT}`);
    return;
  }
  const rawDir = path.resolve(PROJECT_ROOT, args.rawDir);
  fs.mkdirSync(rawDir, { recursive: true });
  const indexFile = path.join(rawDir, "index.html");
  const indexBytes = await readOrFetch(indexFile, INDEX_URL, args.useCache);
  const links = parsePlanIndexLinks(indexBytes);
  invariant(links.length === EXPECTED.provinces, `expected ${EXPECTED.provinces} province links, got ${links.length}`);
  invariant(links.every((link, index) => link.slug === PROVINCES[index].slug), "province link order or slugs changed");

  const rows = [];
  const pageBytes = [];
  const provinceBreakdown = [];
  let invalidRows = 0;
  for (const link of links) {
    const pageFile = path.join(rawDir, `${link.slug}.html`);
    const bytes = await readOrFetch(pageFile, link.url, args.useCache);
    pageBytes.push(bytes);
    const parsed = parsePlanPage(bytes, link);
    invalidRows += parsed.invalidRows;
    rows.push(...parsed.rows);
    provinceBreakdown.push({
      province: link.province,
      sourceProvinceLabel: link.sourceProvinceLabel,
      slug: link.slug,
      columns: parsed.columns,
      records: parsed.rows.length,
      planCount: parsed.rows.reduce((sum, row) => sum + row.plan, 0),
    });
  }

  const charterFile = path.join(rawDir, "charter-page.html");
  const charterBytes = await readOrFetch(charterFile, CHARTER_URL, args.useCache);
  const charterText = descendantText(htmlText(charterBytes));
  invariant(charterText.includes(SCHOOL_NAME) && charterText.includes("设计学类") && charterText.includes("中外合作办学"), "official charter route evidence missing");

  const rawCorpus = Buffer.concat([indexBytes, ...pageBytes]);
  const rawCorpusHash = sha256(rawCorpus);
  const canonicalHash = canonicalRowsSha256(rows);
  const duplicateRows = rows.length - new Set(rows.map((row) => JSON.stringify(row))).size;
  const planCount = rows.reduce((sum, row) => sum + row.plan, 0);
  const fourColumnPageCount = provinceBreakdown.filter((entry) => entry.columns === 4).length;
  const threeColumnPageCount = provinceBreakdown.filter((entry) => entry.columns === 3).length;
  const actualTypeBreakdown = typeBreakdown(rows);
  const ordinaryRows = rows.filter((row) => row.planType === "普通类");
  const specialRows = rows.filter((row) => row.planType !== "普通类");

  invariant(rows.length === EXPECTED.records, `expected ${EXPECTED.records} records, got ${rows.length}`);
  invariant(planCount === EXPECTED.planCount, `expected ${EXPECTED.planCount} plans, got ${planCount}`);
  invariant(invalidRows === 0 && duplicateRows === 0, `expected zero invalid/duplicate rows, got ${invalidRows}/${duplicateRows}`);
  invariant(rawCorpus.length === EXPECTED.rawCorpusBytes, `expected ${EXPECTED.rawCorpusBytes} raw corpus bytes, got ${rawCorpus.length}`);
  invariant(rawCorpusHash === EXPECTED_RAW_CORPUS_SHA256, "raw HTML corpus hash changed");
  invariant(canonicalHash === EXPECTED_CANONICAL_SHA256, "canonical plan payload hash changed");
  invariant(fourColumnPageCount === EXPECTED.fourColumnPageCount && threeColumnPageCount === EXPECTED.threeColumnPageCount, "page schema counts changed");
  invariant(ordinaryRows.length === EXPECTED.ordinaryRecords && ordinaryRows.reduce((sum, row) => sum + row.plan, 0) === EXPECTED.ordinaryPlanCount, "ordinary totals changed");
  invariant(specialRows.length === EXPECTED.specialPathRecords && specialRows.reduce((sum, row) => sum + row.plan, 0) === EXPECTED.specialPlanCount, "special totals changed");
  assertExpectedBreakdown(actualTypeBreakdown);

  const charterPath = relativeProjectPath(charterFile);
  const rawPaths = [
    relativeProjectPath(indexFile),
    ...links.map((link) => relativeProjectPath(path.join(rawDir, `${link.slug}.html`))),
    charterPath,
  ];
  const records = rows.map((row) => {
    const province = provinceBreakdown.find((entry) => entry.province === row.province);
    return recordFromRow(row, links.find((link) => link.province === row.province), {
      columns: province.columns,
      pagePath: relativeProjectPath(path.join(rawDir, `${province.slug}.html`)),
      charterPath,
    });
  });
  invariant(new Set(records.map((record) => record.id)).size === records.length, "record IDs must be unique");

  const sourceNote = {
    id: SOURCE_ID,
    title: "长春理工大学2026年分省分专业招生计划",
    publisher: "长春理工大学本科招生网",
    url: INDEX_URL,
    indexUrl: INDEX_URL,
    charterUrl: CHARTER_URL,
    quality: "official-school-cust-2026-national-plan-html",
    schoolCode: SCHOOL_CODE,
    schoolIdentifierCode: SCHOOL_IDENTIFIER_CODE,
    schoolName: SCHOOL_NAME,
    rawRecords: rows.length,
    records: records.length,
    rawPlanCount: planCount,
    planCount,
    invalidRows,
    duplicateRows,
    provinces: links.length,
    provinceCount: links.length,
    pageCount: links.length,
    fourColumnPageCount,
    threeColumnPageCount,
    ordinaryRecords: ordinaryRows.length,
    ordinaryPlanCount: ordinaryRows.reduce((sum, row) => sum + row.plan, 0),
    specialPathRecords: specialRows.length,
    specialPlanCount: specialRows.reduce((sum, row) => sum + row.plan, 0),
    typeBreakdown: actualTypeBreakdown,
    provinceBreakdown,
    rawCorpusBytes: rawCorpus.length,
    rawCorpusSha256: rawCorpusHash,
    canonicalPayloadSha256: canonicalHash,
    evidencePath: relativeProjectPath(indexFile),
    charterEvidencePath: charterPath,
    rawPaths: [indexFile, ...links.map((link) => path.join(rawDir, `${link.slug}.html`)), charterFile].map(relativeProjectPath),
    finalPlanCaveat: true,
    transcriptionMethod: "official-server-rendered-html-table-descendant-text-concatenation",
    usage: "仅用于当年专业池、计划数、科类、选科和招生路径约束，不替代省级考试院计划、投档线、录取最低分或录取概率。",
    cautions: [
      "31个省级页面中29个为专业、科类、选科、计划四列表格；西藏和新疆为没有选科列的三列表格，空选科不补造为‘不限选考’。",
      "河南表头由多个span拆分，解析时连接单元格全部后代文本；官网重复的‘不提科目要求’保留在sourceElectiveRaw，并只在运行字段中去重。",
      "设计学类依据学校2026年招生章程按艺术类隔离；吉林对口升学以及中外合作办学、专项、预科、新疆班、南疆和对口支援计划均按特殊路径隔离。",
      "官网逐省页面声明：具体招生计划以各省（自治区、直辖市）招生办公室公布的招生计划为准。",
    ],
  };
  const output = {
    version: "v3.365",
    generatedAt: new Date().toISOString(),
    dataset: "official-cust-national-plan-2026-v3.365",
    sourceNotes: [sourceNote],
    summary: {
      records: records.length,
      planCount,
      rawRecords: rows.length,
      rawPlanCount: planCount,
      duplicateRows,
      invalidRows,
      provinces: links.length,
      ordinaryRecords: ordinaryRows.length,
      ordinaryPlanCount: sourceNote.ordinaryPlanCount,
      specialPathRecords: specialRows.length,
      specialPlanCount: sourceNote.specialPlanCount,
      fourColumnPageCount,
      threeColumnPageCount,
      typeBreakdown: actualTypeBreakdown,
    },
    records,
  };
  const outputFile = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "ok", version: output.version, out: relativeProjectPath(outputFile), records: records.length, provinces: links.length, planCount, ordinaryRecords: ordinaryRows.length, specialPathRecords: specialRows.length, rawCorpusSha256: rawCorpusHash, canonicalPayloadSha256: canonicalHash, sha256: sha256(fs.readFileSync(outputFile)) }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
