#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUT = "data/admissions/official-national-school-plan-2026-v358-hnust-import.json";
const DEFAULT_RAW_DIR = "data/admissions/raw/official-national-school-plan-2026-v358-hnust";
const BASE_URL = "https://zs.hnust.edu.cn";
const INDEX_URL = `${BASE_URL}/`;
const PLAN_PAGE_URL = `${BASE_URL}/zsxx/zsjh/index.htm`;
const QANDA_URL = `${BASE_URL}/zsfw/cjwt/26d48672190d4ab4ab35042048d98a82.htm`;
const JSON_URL = `${BASE_URL}/puslishedbkzsjson/zsjh.json`;
const SOURCE_ID = "official-hnust-national-plan-2026";
const SCHOOL_CODE = "10534";
const SCHOOL_NAME = "湖南科技大学";
const YEAR = 2026;

export const EXPECTED = {
  rawRows: 1963,
  records: 1961,
  rawPlanCount: 10582,
  planCount: 10579,
  duplicateRows: 2,
  provinces: 31,
  ordinaryRecords: 1687,
  specialPathRecords: 274,
};

const EXPECTED_SHA256 = {
  json: "dfe8cf527e1cfd1b13ba8ef7eba3e8d097646b007740adbd750abe9d20cfd7f3",
  planPage: "1fec67e35a09e61e459075a94916ffbfd743548a62ac7cdddc66db9b46714723",
  qanda: "d5669f9809203f541e75879d1c14efe7b4f5fa3c5361e5899eb5700f600b6c1b",
};

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
  if (!condition) throw new Error(`HNUST 2026 plan v3.358 audit failed: ${message}`);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function hash(value, length = 18) {
  return sha256(String(value)).slice(0, length);
}

function relativeProjectPath(file) {
  return path.relative(PROJECT_ROOT, file).replaceAll(path.sep, "/");
}

function clean(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\u00a0　]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numeric(value, label) {
  const number = Number(String(value ?? "").replace(/[,，]/g, ""));
  invariant(Number.isInteger(number) && number >= 0, `${label} must be a non-negative integer, got ${value}`);
  return number;
}

export function subjectTypeFrom(raw) {
  const text = clean(raw);
  if (/艺术/.test(text)) return "艺术类";
  if (/体育/.test(text)) return "体育类";
  if (/历史|文史|文科/.test(text)) return "历史类";
  if (/物理|理工|理科/.test(text)) return "物理类";
  if (/综合/.test(text)) return "综合改革";
  return text || "综合";
}

export function classifyPlan(row) {
  const text = `${clean(row.kelei || row.sourceSubjectRaw)} ${clean(row.lqpc || row.batch)} ${clean(row.zymc || row.majorName)}`;
  if (/艺术/.test(text)) return { admissionType: "艺术类", admissionSubtype: clean(row.kelei), formalScoreScope: "special-path-only" };
  if (/体育/.test(text)) return { admissionType: "体育类", admissionSubtype: clean(row.kelei), formalScoreScope: "special-path-only" };
  if (/国家专项/.test(text)) return { admissionType: "国家专项", admissionSubtype: clean(row.lqpc), formalScoreScope: "special-path-only" };
  if (/地方专项/.test(text)) return { admissionType: "地方专项", admissionSubtype: clean(row.lqpc), formalScoreScope: "special-path-only" };
  if (/优师专项/.test(text)) return { admissionType: "优师专项", admissionSubtype: clean(row.lqpc), formalScoreScope: "special-path-only" };
  if (/公费师范|定向师范/.test(text)) return { admissionType: "公费师范生", admissionSubtype: clean(row.lqpc), formalScoreScope: "special-path-only" };
  if (/南单|援疆/.test(text)) return { admissionType: "南疆单列", admissionSubtype: clean(row.lqpc), formalScoreScope: "special-path-only" };
  if (/预科/.test(text)) return { admissionType: "预科", admissionSubtype: clean(row.lqpc), formalScoreScope: "special-path-only" };
  if (/提前/.test(text)) return { admissionType: "提前批", admissionSubtype: clean(row.lqpc), formalScoreScope: "special-path-only" };
  return { admissionType: "普通录取", admissionSubtype: "普通类", formalScoreScope: "school-official-only" };
}

function normalizeRawRow(raw, province) {
  const row = {
    province: clean(province),
    xz: numeric(raw?.xz, "program duration"),
    planCount: numeric(raw?.zsrs, "plan count"),
    kelei: clean(raw?.kelei),
    subjectType: subjectTypeFrom(raw?.kelei),
    batch: clean(raw?.lqpc),
    majorName: clean(raw?.zymc),
    tuition: numeric(raw?.xfbz, "tuition"),
    department: clean(raw?.xymc),
  };
  invariant(row.province && row.kelei && row.batch && row.majorName && row.department, `incomplete source row: ${JSON.stringify(raw)}`);
  invariant(row.planCount > 0, `plan count must be positive: ${JSON.stringify(raw)}`);
  return row;
}

export function parsePlanRows(payload, year = YEAR) {
  invariant(Array.isArray(payload), "source JSON must be an array");
  const yearBlock = payload.find((item) => Number(item?.year) === year);
  invariant(yearBlock && Array.isArray(yearBlock.data), `year ${year} block missing`);
  const rows = [];
  for (const provinceBlock of yearBlock.data) {
    invariant(provinceBlock?.provice && Array.isArray(provinceBlock.data), "province block malformed");
    for (const raw of provinceBlock.data) rows.push(normalizeRawRow(raw, provinceBlock.provice));
  }
  return rows;
}

function rowIdentity(row) {
  return [row.province, row.kelei, row.batch, row.majorName, row.department, row.xz, row.tuition, row.planCount].join("|");
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

function planRemark(row) {
  return row.department ? `院系：${row.department}` : undefined;
}

export function recordFromPlanRow(row, meta = {}) {
  const classification = classifyPlan(row);
  const record = {
    id: `2026-hnust-national-plan-${hash(rowIdentity(row))}`,
    province: row.province,
    year: YEAR,
    sourcePlanYear: YEAR,
    subjectType: subjectTypeFrom(row.kelei),
    batch: row.batch,
    sourceBatchRaw: row.batch,
    schoolName: SCHOOL_NAME,
    schoolCode: SCHOOL_CODE,
    schoolTags: ["湖南", "湘潭", "师范", "综合"],
    dataType: "admission-plan",
    majorName: row.majorName,
    planCount: row.planCount,
    tuition: row.tuition,
    programDuration: `${row.xz}年`,
    educationLevel: "本科",
    sourceSubjectRaw: row.kelei,
    sourceDepartmentRaw: row.department,
    formalScoreScope: classification.formalScoreScope,
    admissionType: classification.admissionType,
    admissionSubtype: classification.admissionSubtype,
    schoolOfficialScope: "single-school-admission-plan",
    planRemark: planRemark(row),
    sourceQuality: "official-school-hnust-2026-national-plan-json",
    sourceId: SOURCE_ID,
    sourceUrl: JSON_URL,
    sourcePageUrl: PLAN_PAGE_URL,
    sourceIndexUrl: INDEX_URL,
    officialEvidencePath: meta.evidencePath || `${DEFAULT_RAW_DIR}/zsjh-2026.json`,
    cautions: [
      "本记录来自湖南科技大学本科招生网公开的2026年分省分专业计划 JSON，只作当年专业池、计划数、科类、批次和路径约束，不是投档线、录取最低分或录取概率。",
      "学校问答页公布的2026年整体招生计划为10860，JSON 明细原始合计为10582；差额不归属到任何省份或专业，不补造记录。",
      "艺术、体育、国家专项、地方专项、优师专项、公费师范生、南疆单列和提前批均保持 special-path-only，不与普通录取路径混用。",
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
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 gaokao-hnust-v358-importer/1.0", accept: "application/json,text/html,*/*" }, signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:\n  node scripts/import-official-national-school-plan-2026-v358-hnust.mjs --out ${DEFAULT_OUT}\n  node scripts/import-official-national-school-plan-2026-v358-hnust.mjs --use-cache`);
    return;
  }
  const rawDir = path.resolve(PROJECT_ROOT, args.rawDir);
  fs.mkdirSync(rawDir, { recursive: true });
  const jsonFile = path.join(rawDir, "zsjh-2026.json");
  const planPageFile = path.join(rawDir, "plan-page.html");
  const qandaFile = path.join(rawDir, "qanda.html");
  if (!args.useCache || !fs.existsSync(jsonFile) || fs.statSync(jsonFile).size === 0) fs.writeFileSync(jsonFile, await fetchText(JSON_URL), "utf8");
  if (!args.useCache || !fs.existsSync(planPageFile) || fs.statSync(planPageFile).size === 0) fs.writeFileSync(planPageFile, await fetchText(PLAN_PAGE_URL), "utf8");
  if (!args.useCache || !fs.existsSync(qandaFile) || fs.statSync(qandaFile).size === 0) fs.writeFileSync(qandaFile, await fetchText(QANDA_URL), "utf8");
  invariant(sha256File(jsonFile) === EXPECTED_SHA256.json, "source JSON hash changed");
  invariant(sha256File(planPageFile) === EXPECTED_SHA256.planPage, "plan page hash changed");
  invariant(sha256File(qandaFile) === EXPECTED_SHA256.qanda, "Q&A page hash changed");
  invariant(fs.readFileSync(qandaFile, "utf8").includes("10860"), "Q&A headline plan count missing");

  const payload = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
  const rawRows = parsePlanRows(payload);
  const rows = dedupePlanRows(rawRows);
  const records = rows.map((row) => recordFromPlanRow(row, { evidencePath: relativeProjectPath(jsonFile) })).map(compact);
  const uniqueIds = new Set(records.map((record) => record.id));
  const rawPlanCount = rawRows.reduce((sum, row) => sum + row.planCount, 0);
  const planCount = rows.reduce((sum, row) => sum + row.planCount, 0);
  const ordinaryRecords = records.filter((record) => record.formalScoreScope === "school-official-only");
  const specialRecords = records.filter((record) => record.formalScoreScope === "special-path-only");
  invariant(rawRows.length === EXPECTED.rawRows, `expected ${EXPECTED.rawRows} raw rows, got ${rawRows.length}`);
  invariant(records.length === EXPECTED.records, `expected ${EXPECTED.records} records, got ${records.length}`);
  invariant(rawPlanCount === EXPECTED.rawPlanCount, `expected ${EXPECTED.rawPlanCount} raw plan count, got ${rawPlanCount}`);
  invariant(planCount === EXPECTED.planCount, `expected ${EXPECTED.planCount} deduplicated plan count, got ${planCount}`);
  invariant(rawRows.length - rows.length === EXPECTED.duplicateRows, "duplicate row count changed");
  invariant(uniqueIds.size === records.length, "duplicate record IDs detected");
  invariant(new Set(records.map((record) => record.province)).size === EXPECTED.provinces, "province coverage changed");
  invariant(ordinaryRecords.length === EXPECTED.ordinaryRecords && specialRecords.length === EXPECTED.specialPathRecords, "ordinary/special partition changed");
  invariant(records.every((record) => record.year === YEAR && record.dataType === "admission-plan" && Number.isInteger(record.planCount) && record.planCount > 0), "record contract violated");

  const byProvince = Object.fromEntries([...new Set(records.map((record) => record.province))].sort((left, right) => left.localeCompare(right, "zh-Hans-CN")).map((province) => {
    const provinceRecords = records.filter((record) => record.province === province);
    return [province, {
      records: provinceRecords.length,
      planCount: provinceRecords.reduce((sum, record) => sum + record.planCount, 0),
      ordinaryRecords: provinceRecords.filter((record) => record.formalScoreScope === "school-official-only").length,
      specialPathRecords: provinceRecords.filter((record) => record.formalScoreScope === "special-path-only").length,
    }];
  }));
  const bySubjectType = Object.fromEntries([...new Set(records.map((record) => record.subjectType))].sort().map((subjectType) => [subjectType, records.filter((record) => record.subjectType === subjectType).length]));
  const byAdmissionType = Object.fromEntries([...new Set(records.map((record) => record.admissionType))].sort().map((admissionType) => [admissionType, records.filter((record) => record.admissionType === admissionType).length]));
  const evidenceFiles = [jsonFile, planPageFile, qandaFile].map((file) => ({ path: relativeProjectPath(file), bytes: fs.statSync(file).size, sha256: sha256File(file) }));
  const rawManifestPath = path.join(rawDir, "raw-manifest.json");
  const rawManifest = {
    dataset: "official-hnust-national-plan-2026-v358-raw",
    generatedAt: new Date().toISOString(),
    urls: { json: JSON_URL, planPage: PLAN_PAGE_URL, qanda: QANDA_URL },
    evidenceFiles,
    rawRows: rawRows.length,
    parsedRecords: records.length,
    duplicateRows: rawRows.length - rows.length,
    rawPlanCount,
    deduplicatedPlanCount: planCount,
  };
  fs.writeFileSync(rawManifestPath, `${JSON.stringify(rawManifest, null, 2)}\n`, "utf8");
  const sourceNote = {
    id: SOURCE_ID,
    title: "湖南科技大学2026年分省分专业招生计划",
    publisher: "湖南科技大学本科招生网",
    url: PLAN_PAGE_URL,
    qandaUrl: QANDA_URL,
    jsonUrl: JSON_URL,
    year: YEAR,
    province: "全国",
    schoolCode: SCHOOL_CODE,
    schoolName: SCHOOL_NAME,
    quality: "official-school-hnust-2026-national-plan-json",
    usage: "官方学校计划明细，只用于当年专业池、计划数、科类、批次和路径约束，不替代省级考试院计划、投档线或录取概率。",
    rawRows: rawRows.length,
    records: records.length,
    parsedRecords: records.length,
    duplicateRows: rawRows.length - rows.length,
    rawPlanCount,
    planCount,
    headlinePlanCount: 10860,
    apiPlanCount: rawPlanCount,
    unattributedDelta: 10860 - rawPlanCount,
    provinces: Object.keys(byProvince).length,
    provinceOptions: Object.keys(byProvince),
    emptyProvinces: [],
    ordinaryRecords: ordinaryRecords.length,
    specialPathRecords: specialRecords.length,
    ordinaryPlanCount: ordinaryRecords.reduce((sum, record) => sum + record.planCount, 0),
    specialPlanCount: specialRecords.reduce((sum, record) => sum + record.planCount, 0),
    byProvince,
    bySubjectType,
    byAdmissionType,
    evidenceFiles,
    rawDir: relativeProjectPath(rawDir),
    evidencePath: relativeProjectPath(jsonFile),
    pageSha256: sha256File(planPageFile),
    qandaSha256: sha256File(qandaFile),
    jsonSha256: sha256File(jsonFile),
    cautions: [
      "学校问答页公布2026年整体招生计划10860个，JSON明细原始合计10582个；差额278不归属到任何省份或专业，不补造为计划记录。",
      "JSON中有2条完全重复的新疆行，运行时去重为1961条，并保留rawRows、duplicateRows和原始文件哈希供复核。",
      "艺术、体育、国家专项、地方专项、优师专项、公费师范生、南疆单列和提前批均保持特殊路径隔离；学校计划不等同于专业录取结果或录取概率。",
    ],
  };
  const output = {
    dataset: "official-hnust-national-plan-2026-v358-import",
    generatedAt: new Date().toISOString(),
    scope: "湖南科技大学2026年全国分省分专业本科招生计划",
    notes: [
      "Official HNUST JSON is preserved with source-page and Q&A evidence hashes.",
      "The two exact duplicate Xinjiang rows are excluded from recommendation records but counted in the raw audit.",
      "The official Q&A headline total and JSON detail total are reported separately; the unattributed difference is not fabricated into any province or major.",
    ],
    sourceNotes: [sourceNote],
    records,
    audit: {
      rawRows: rawRows.length,
      parsedRecords: records.length,
      duplicateRows: rawRows.length - rows.length,
      rawPlanCount,
      planCount,
      ordinaryRecords: ordinaryRecords.length,
      specialPathRecords: specialRecords.length,
      ordinaryPlanCount: ordinaryRecords.reduce((sum, record) => sum + record.planCount, 0),
      specialPlanCount: specialRecords.reduce((sum, record) => sum + record.planCount, 0),
      provinces: Object.keys(byProvince).length,
      byProvince,
      bySubjectType,
      byAdmissionType,
    },
  };
  const outPath = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "ok", version: "v3.358", out: relativeProjectPath(outPath), rawRows: rawRows.length, records: records.length, rawPlanCount, planCount, duplicateRows: rawRows.length - rows.length, provinces: Object.keys(byProvince).length, ordinaryRecords: ordinaryRecords.length, specialPathRecords: specialRecords.length, sha256: sha256File(outPath) }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
