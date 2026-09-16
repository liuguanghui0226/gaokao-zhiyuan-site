#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUT = "data/admissions/official-national-school-plan-2026-v360-xzmu-import.json";
const DEFAULT_RAW_DIR = "data/admissions/raw/official-national-school-plan-2026-v360-xzmu";
const BASE_URL = "https://www1.xzmu.edu.cn";
const INDEX_URL = "https://zs.xzmu.edu.cn/";
const PAGE_URL = `${BASE_URL}/getcontent?id=111293&url=show`;
const SOURCE_ID = "official-xzmu-national-plan-2026";
const SCHOOL_CODE = "10695";
const SCHOOL_NAME = "西藏民族大学";
const YEAR = 2026;
const PROVINCES = ["西藏", "陕西", "山西", "河南", "云南", "四川", "甘肃", "广西", "山东", "河北", "湖南", "湖北", "重庆", "江西", "安徽", "江苏", "浙江", "福建", "广东", "辽宁"];
const SINGLE_SUBJECT_PROVINCES = new Set(["山东", "浙江"]);

export const EXPECTED = {
  rawRows: 54,
  records: 259,
  rawPlanCount: 2825,
  planCount: 2825,
  duplicateRows: 0,
  provinces: 20,
  ordinaryRecords: 230,
  specialPathRecords: 29,
};

const EXPECTED_NORMALIZED_SHA256 = "babf19115dd59f7821b58c7dc5d51819593aed598b29f5e4ba3953acf5478091";

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
  if (!condition) throw new Error(`西藏民族大学 2026 计划 v3.360 audit failed: ${message}`);
}

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function sha256File(file) { return sha256(fs.readFileSync(file)); }
function normalizedPageSha256(buffer) {
  const text = new TextDecoder("gb18030").decode(buffer).replace(/浏览次数：\d+/g, "浏览次数：<dynamic>");
  return sha256(text);
}
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

function numeric(value, label, allowZero = false) {
  const number = Number(String(value ?? "").replace(/[,，]/g, ""));
  invariant(Number.isInteger(number) && (allowZero ? number >= 0 : number > 0), `${label} must be an integer, got ${value}`);
  return number;
}

function attributeNumber(attributes, name, fallback = 1) {
  const match = String(attributes).match(new RegExp(`\\b${name}\\s*=\\s*["']?(\\d+)["']?`, "i"));
  return match ? Number(match[1]) : fallback;
}

function decodeHtml(value) { return clean(value); }

function parseTableGrid(html) {
  const table = [...String(html).matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].find((match) => /招生专业|招生分省|专业计划/.test(decodeHtml(match[1])));
  invariant(table, "official plan table not found");
  const pending = new Map();
  const rows = [];
  for (const rowMatch of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = [];
    const newPending = new Map();
    let column = 0;
    for (const cellMatch of rowMatch[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)) {
      while (pending.has(column)) column += 1;
      const colspan = attributeNumber(cellMatch[1], "colspan");
      const rowspan = attributeNumber(cellMatch[1], "rowspan");
      const text = decodeHtml(cellMatch[2]);
      for (let offset = 0; offset < colspan; offset += 1) {
        const index = column + offset;
        row[index] = text;
        if (rowspan > 1) newPending.set(index, { text, remaining: rowspan - 1 });
      }
      column += colspan;
    }
    const maxColumn = Math.max(row.length, ...pending.keys(), ...newPending.keys(), 0);
    const expanded = Array.from({ length: maxColumn }, (_, index) => row[index] || pending.get(index)?.text || "");
    rows.push(expanded);
    const nextPending = new Map();
    for (const [index, cell] of pending.entries()) {
      if (cell.remaining > 1) nextPending.set(index, { text: cell.text, remaining: cell.remaining - 1 });
    }
    for (const [index, cell] of newPending.entries()) nextPending.set(index, cell);
    pending.clear();
    for (const [index, cell] of nextPending.entries()) pending.set(index, cell);
  }
  return rows;
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
  const province = clean(row.province);
  const major = clean(row.majorName);
  const note = clean(row.note);
  if (/播音与主持艺术/.test(major)) return { admissionType: "艺术类", admissionSubtype: note || "艺术类", formalScoreScope: "special-path-only" };
  if (/体育教育|休闲体育|运动训练/.test(major) || /对口/.test(note)) return { admissionType: /对口/.test(note) ? "对口高职" : "体育类", admissionSubtype: note || "体育类", formalScoreScope: "special-path-only" };
  if (province === "西藏" && /专项|部队生源|边境/.test(note)) {
    const types = [];
    if (/国家专项/.test(note)) types.push("国家专项");
    if (/地方专项/.test(note)) types.push("地方专项");
    if (/边境专项/.test(note)) types.push("边境专项");
    if (/部队生源/.test(note)) types.push("部队生源");
    return { admissionType: types.join("/") || "西藏特殊专项", admissionSubtype: note, formalScoreScope: "special-path-only" };
  }
  return { admissionType: "普通录取", admissionSubtype: "普通类", formalScoreScope: "school-official-only" };
}

export function parsePlanTableRows(input) {
  const html = typeof input === "string"
    ? input
    : new TextDecoder("gb18030").decode(Buffer.isBuffer(input) ? input : Buffer.from(input));
  const grid = parseTableGrid(html);
  const headerIndex = grid.findIndex((row) => row.includes("序号") && row.includes("合计"));
  invariant(headerIndex >= 0, "matrix header row missing");
  const headerRow = grid[headerIndex] || [];
  const subjectRow = grid[headerIndex + 1] || [];
  const provinceColumns = {};
  let column = 7;
  for (const province of PROVINCES) {
    const columns = [];
    while (column < headerRow.length && clean(headerRow[column]) === province) {
      columns.push(column);
      column += 1;
    }
    invariant(columns.length > 0, `province header column missing: ${province}`);
    provinceColumns[province] = columns.map((index) => ({ column: index, subjectRaw: clean(subjectRow[index]) || (SINGLE_SUBJECT_PROVINCES.has(province) ? "综合改革" : "") }));
  }
  invariant(clean(headerRow[column]) === "备注", `province header columns do not end before note column (column ${column})`);
  const rows = [];
  for (const row of grid.slice(headerIndex + 2)) {
    if (!/^\d+$/.test(clean(row[0])) || row.length < 47) continue;
        const tuitionText = clean(row[46]);
    const sourceRowTotal = numeric(row[6], "school row total");
    const note = clean(row[45]);
    for (const province of PROVINCES) {
      for (const cell of provinceColumns[province]) {
        const planText = clean(row[cell.column]);
        if (!planText) continue;
        const planCount = numeric(planText, "province plan count");
        rows.push({
          province,
          subjectRaw: cell.subjectRaw || (SINGLE_SUBJECT_PROVINCES.has(province) ? "综合改革" : ""),
          department: clean(row[1]),
          majorName: clean(row[2]),
          campus: clean(row[3]),
          educationLevel: clean(row[4]),
          programDuration: clean(row[5]),
          sourceRowTotal,
          planCount,
          note,
          tuition: /^\d+$/.test(tuitionText) ? numeric(tuitionText, "tuition", true) : undefined,
          tuitionRaw: tuitionText,
        });
      }
    }
  }
  const provinces = [...new Set(rows.map((row) => row.province))].sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
  return { rawRows: grid.slice(headerIndex + 2).filter((row) => /^\d+$/.test(clean(row[0]))).length, rows, records: rows, planCount: rows.reduce((sum, row) => sum + row.planCount, 0), provinces };
}

function rowIdentity(row) { return [row.province, row.subjectRaw, row.majorName, row.campus, row.educationLevel, row.planCount].join("|"); }

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
    id: `2026-xzmu-national-plan-${hash(rowIdentity(row))}`,
    province: row.province,
    year: YEAR,
    sourcePlanYear: YEAR,
    subjectType: subjectTypeFrom(row.subjectRaw),
    schoolName: SCHOOL_NAME,
    schoolCode: SCHOOL_CODE,
    schoolTags: ["西藏", "民族", "咸阳"],
    dataType: "admission-plan",
    majorName: row.majorName,
    planCount: row.planCount,
    tuition: row.tuition,
    sourceTuitionRaw: row.tuitionRaw,
    programDuration: row.programDuration,
    educationLevel: row.educationLevel,
    sourceSubjectRaw: row.subjectRaw,
    sourceDepartmentRaw: row.department,
    sourceCampusRaw: row.campus,
    sourceNoteRaw: row.note,
    sourceSchoolRowTotal: row.sourceRowTotal,
    formalScoreScope: classification.formalScoreScope,
    admissionType: classification.admissionType,
    admissionSubtype: classification.admissionSubtype,
    schoolOfficialScope: "single-school-admission-plan",
    planRemark: [row.campus ? `校区：${row.campus}` : "", row.note].filter(Boolean).join("；") || undefined,
    sourceQuality: "official-school-xzmu-2026-national-plan-html",
    sourceId: SOURCE_ID,
    sourceUrl: PAGE_URL,
    sourcePageUrl: PAGE_URL,
    sourceIndexUrl: INDEX_URL,
    officialEvidencePath: meta.evidencePath || `${DEFAULT_RAW_DIR}/plan-page.html`,
    cautions: [
      "本记录来自西藏民族大学本科招生网公开的2026年分省分专业计划矩阵，只作当年专业池、计划数、科类和路径约束，不是投档线、录取最低分或录取概率。",
      "官网矩阵的‘合计’是学校专业行总计划；运行记录只使用对应省份和科类单元格的计划数，不把合计重复计入省份。",
      "西藏区内专项、部队生源、边境专项、体育/艺术和对口高职等混合备注无法在同一行内拆分时，整行保持 special-path-only，避免与普通录取边界混用；区外同一专业单元格仍按官网省份单元格独立记录。",
      "官网备注明确提示最终招生专业及人数以各省发布数据为准；正式填报仍需复核省级招生主管部门目录。",
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

async function fetchBytes(url) {
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 gaokao-xzmu-v360-importer/1.0", accept: "text/html,*/*" }, signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:\n  node scripts/import-official-national-school-plan-2026-v360-xzmu.mjs --out ${DEFAULT_OUT}\n  node scripts/import-official-national-school-plan-2026-v360-xzmu.mjs --use-cache`);
    return;
  }
  const rawDir = path.resolve(PROJECT_ROOT, args.rawDir);
  fs.mkdirSync(rawDir, { recursive: true });
  const pageFile = path.join(rawDir, "plan-page.html");
  if (!args.useCache || !fs.existsSync(pageFile) || fs.statSync(pageFile).size === 0) fs.writeFileSync(pageFile, await fetchBytes(PAGE_URL));
  const pageBytes = fs.readFileSync(pageFile);
  invariant(normalizedPageSha256(pageBytes) === EXPECTED_NORMALIZED_SHA256, "official plan page normalized hash changed");
  const parsed = parsePlanTableRows(pageBytes);
  const rows = dedupePlanRows(parsed.rows);
  const records = rows.map((row) => recordFromPlanRow(row, { evidencePath: relativeProjectPath(pageFile) })).map(compact);
  const rawPlanCount = parsed.rows.reduce((sum, row) => sum + row.planCount, 0);
  const planCount = rows.reduce((sum, row) => sum + row.planCount, 0);
  const provinces = [...new Set(records.map((record) => record.province))].sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
  const ordinaryRecords = records.filter((record) => record.formalScoreScope === "school-official-only");
  const specialRecords = records.filter((record) => record.formalScoreScope === "special-path-only");
  invariant(parsed.rawRows === EXPECTED.rawRows, `expected ${EXPECTED.rawRows} raw rows, got ${parsed.rawRows}`);
  invariant(rows.length === EXPECTED.records, `expected ${EXPECTED.records} records, got ${rows.length}`);
  invariant(rawPlanCount === EXPECTED.rawPlanCount, `expected raw plan count ${EXPECTED.rawPlanCount}, got ${rawPlanCount}`);
  invariant(planCount === EXPECTED.planCount, `expected plan count ${EXPECTED.planCount}, got ${planCount}`);
  invariant(parsed.rows.length - rows.length === EXPECTED.duplicateRows, `expected ${EXPECTED.duplicateRows} duplicate rows`);
  invariant(provinces.length === EXPECTED.provinces, `expected ${EXPECTED.provinces} provinces, got ${provinces.length}`);
  invariant(ordinaryRecords.length === EXPECTED.ordinaryRecords, `expected ${EXPECTED.ordinaryRecords} ordinary records, got ${ordinaryRecords.length}`);
  invariant(specialRecords.length === EXPECTED.specialPathRecords, `expected ${EXPECTED.specialPathRecords} special records, got ${specialRecords.length}`);
  invariant(new Set(records.map((record) => record.id)).size === records.length, "record IDs must be unique");

  const sourceNote = {
    id: SOURCE_ID,
    title: "西藏民族大学 2026 年普高招生分省分专业计划表",
    publisher: "西藏民族大学本科招生信息网",
    url: PAGE_URL,
    quality: "official-school-xzmu-2026-national-plan-html",
    schoolCode: SCHOOL_CODE,
    schoolName: SCHOOL_NAME,
    records: records.length,
    rawRows: parsed.rawRows,
    duplicateRows: parsed.rows.length - rows.length,
    rawPlanCount,
    planCount,
    provinces: provinces.length,
    ordinaryRecords: ordinaryRecords.length,
    specialPathRecords: specialRecords.length,
    pageSha256: sha256File(pageFile),
    normalizedPageSha256: normalizedPageSha256(pageBytes),
    evidencePath: relativeProjectPath(pageFile),
    tableProvinceColumns: PROVINCES,
    usage: "仅用于当年专业池、计划数、科类和路径约束，不替代省级考试院计划、投档线、录取最低分或最低位次。",
    cautions: [
      "官网矩阵列出西藏、陕西、山西、河南、云南、四川、甘肃、广西、山东、河北、湖南、湖北、重庆、江西、安徽、江苏、浙江、福建、广东、辽宁共20个省级口径；未列省份不补造零计划。",
      "表格备注明确最终招生专业及人数以各省发布数据为准；西藏区内混合专项记录无法拆成普通/专项的行保持 special-path-only。",
    ],
  };
  const output = {
    version: "v3.360",
    generatedAt: new Date().toISOString(),
    dataset: "official-xzmu-national-plan-2026-v3.360",
    sourceNotes: [sourceNote],
    summary: {
      rawRows: parsed.rawRows,
      records: records.length,
      rawPlanCount,
      planCount,
      duplicateRows: parsed.rows.length - rows.length,
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
  console.log(JSON.stringify({ status: "ok", version: output.version, rawRows: parsed.rawRows, records: records.length, rawPlanCount, planCount, duplicateRows: parsed.rows.length - rows.length, provinces: provinces.length, ordinaryRecords: ordinaryRecords.length, specialPathRecords: specialRecords.length, sha256: sha256File(outputFile) }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
