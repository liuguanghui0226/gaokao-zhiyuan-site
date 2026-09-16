#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUT = "data/admissions/official-national-school-plan-2026-v353-dlmu-import.json";
const RAW_DIR = "data/admissions/raw/official-national-school-plan-2026-v353-dlmu";
const PAGE_URL = "https://sjcx.dlmu.edu.cn/static/front/dlmu/basic/html_web/zsjh.html";
const SOURCE_PAGE_URL = "https://bkzs.dlmu.edu.cn/info/1017/3029.htm";
const INDEX_URL = "https://bkzs.dlmu.edu.cn/";
const API_BASE_URL = "https://sjcx.dlmu.edu.cn/";
const SOURCE = {
  id: "official-dlmu-national-plan-2026",
  quality: "official-school-dlmu-2026-national-plan-api",
  schoolCode: "10151",
  schoolName: "大连海事大学",
  city: "大连",
  tags: ["辽宁", "大连", "航运", "交通运输"],
};

function usage() {
  return `Usage:\n  node scripts/import-official-national-school-plan-2026-v353-dlmu.mjs --out ${DEFAULT_OUT}\n  node scripts/import-official-national-school-plan-2026-v353-dlmu.mjs --use-cache`;
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
function clean(value) { return String(value ?? "").replace(/[\u00a0　]/g, " ").replace(/\s+/g, " ").trim(); }
function parseInteger(value) {
  const match = clean(value).replace(/[,，]/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
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
  if (!text) return undefined;
  const normalized = text.replace(/[，、]/g, ",").replace(/\([^)]*\)|（[^）]*）/g, "").trim();
  return normalized.replace(/,/g, "，") || text;
}

function classifyPlan(row) {
  const rawType = clean(row.zslx || row.zylx);
  const specialTypes = new Map([
    ["提前批", "提前批"],
    ["国家专项计划", "国家专项"],
    ["高校专项计划", "高校专项"],
    ["南疆单列计划", "南疆单列计划"],
    ["中外合作办学", "中外合作办学"],
  ]);
  const admissionType = specialTypes.get(rawType) || "普通录取";
  return {
    admissionType,
    admissionSubtype: rawType || clean(row.zycc) || "普通本科",
    formalScoreScope: admissionType === "普通录取" ? "school-official-only" : "special-path-only",
  };
}

function composeRemark(row) {
  const parts = [clean(row.remarks), clean(row.zkfx) && `培养方向：${clean(row.zkfx)}`, clean(row.sxkmyqzw) && `首选科目：${clean(row.sxkmyqzw)}`].filter(Boolean);
  return parts.join("；");
}

function parseApiRows(payload) {
  const rows = payload?.data?.zsjhList;
  if (!Array.isArray(rows)) throw new Error("DLMU API payload is missing data.zsjhList");
  return rows.map((row) => {
    const classification = classifyPlan(row);
    const province = clean(row.ssmc);
    const majorName = clean(row.zymc || row.zydhmc);
    const sourceSubjectRaw = clean(row.klmc);
    const planCount = Number(row.zsjhs);
    if (!province || !majorName || !Number.isFinite(planCount) || planCount <= 0) throw new Error(`Invalid DLMU plan row: ${JSON.stringify(row).slice(0, 400)}`);
    return {
      province,
      year: Number(row.nf) || 2026,
      subjectType: subjectTypeFrom(sourceSubjectRaw),
      electiveRequirement: electiveRequirementFrom(row.xkkm),
      batch: clean(row.zycc) || "普通本科",
      sourceBatchRaw: clean(row.zycc),
      sourcePlanTypeRaw: clean(row.zslx || row.zylx),
      sourceSubjectRaw,
      majorName,
      majorCode: clean(row.zydm),
      majorGroup: clean(row.zydh),
      sourceMajorGroupRaw: clean(row.bhzy),
      programDuration: clean(row.zyxz || row.xz),
      tuition: parseInteger(row.zyxf || row.xf),
      planCount,
      campus: clean(row.jdxq),
      college: clean(row.xy),
      admissionType: classification.admissionType,
      admissionSubtype: classification.admissionSubtype,
      formalScoreScope: classification.formalScoreScope,
      planRemark: composeRemark(row),
      raw: row,
    };
  });
}

function groupKey(row) { return [clean(row.ssmc), clean(row.zslx || row.zylx), clean(row.klmc)].join("|"); }

function closureAudit(rows, totalRows) {
  const detailed = new Map();
  for (const row of rows) detailed.set(groupKey(row), (detailed.get(groupKey(row)) || 0) + Number(row.zsjhs || 0));
  const summary = new Map(totalRows.map((row) => [groupKey(row), Number(row.zsjhs || 0)]));
  const keys = new Set([...detailed.keys(), ...summary.keys()]);
  const mismatches = [...keys].filter((key) => detailed.get(key) !== summary.get(key));
  return { detailGroups: detailed.size, summaryGroups: summary.size, comparedGroups: keys.size, mismatches };
}

function recordFromPlanRow(row, meta = {}) {
  const record = {
    id: `2026-dlmu-national-plan-${hash([row.province, row.year, row.sourcePlanTypeRaw, row.sourceSubjectRaw, row.majorGroup, row.majorCode, row.majorName].join("|"))}`,
    province: row.province,
    year: row.year,
    subjectType: row.subjectType,
    batch: row.batch,
    sourceBatchRaw: row.sourceBatchRaw,
    schoolName: SOURCE.schoolName,
    schoolCode: SOURCE.schoolCode,
    schoolTags: SOURCE.tags,
    city: SOURCE.city,
    campus: row.campus,
    dataType: "admission-plan",
    majorName: row.majorName,
    majorCode: row.majorCode,
    majorGroup: row.majorGroup,
    sourceMajorGroupRaw: row.sourceMajorGroupRaw,
    electiveRequirement: row.electiveRequirement,
    programDuration: row.programDuration,
    tuition: row.tuition,
    planCount: row.planCount,
    sourceSubjectRaw: row.sourceSubjectRaw,
    sourcePlanTypeRaw: row.sourcePlanTypeRaw,
    formalScoreScope: row.formalScoreScope,
    admissionType: row.admissionType,
    admissionSubtype: row.admissionSubtype,
    schoolOfficialScope: "single-school-admission-plan",
    planRemark: row.planRemark,
    sourceQuality: SOURCE.quality,
    sourceId: SOURCE.id,
    sourceUrl: `${API_BASE_URL}f/ajax_zsjh`,
    sourcePageUrl: SOURCE_PAGE_URL,
    sourceIndexUrl: INDEX_URL,
    selectionRequirementSourceUrl: PAGE_URL,
    officialEvidencePath: meta.rawPath || `${RAW_DIR}/plans.json`,
    cautions: [
      "本记录来自大连海事大学招生信息网公开 2026 年招生计划 API，只作当年专业池、计划数、科类、选科和路径约束，不是投档线、录取最低分或录取概率。",
      "航海、轮机、船舶电子电气等提前批专业包含视力、色觉、身高、性别或工作性质限制；中外合作办学及专项路径已隔离。",
    ],
  };
  for (const key of Object.keys(record)) {
    if (record[key] === undefined || record[key] === "" || (Array.isArray(record[key]) && record[key].length === 0)) delete record[key];
  }
  return record;
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) || "";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

async function sleep(ms) { await new Promise((resolve) => setTimeout(resolve, ms)); }

function updateCookie(session, response) {
  const cookie = response.headers.get("set-cookie");
  if (cookie) session.cookie = cookie.split(";")[0];
  const responseToken = response.headers.get("csrf-token");
  if (responseToken) session.token = responseToken;
}

async function requestJson(session, endpoint, body = undefined, includeToken = true) {
  const headers = {
    accept: "application/json, text/plain, */*",
    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    "user-agent": "Mozilla/5.0 gaokao-dlmu-v353-importer/1.0",
    referer: PAGE_URL,
    origin: "https://sjcx.dlmu.edu.cn",
    "x-requested-time": String(Date.now()),
  };
  if (session.cookie) headers.cookie = session.cookie;
  if (includeToken && session.token) headers["Csrf-Token"] = session.token;
  const response = await fetch(`${API_BASE_URL}${endpoint}?ts=${Date.now()}`, {
    method: "POST",
    headers,
    body: new URLSearchParams(body || {}),
    signal: AbortSignal.timeout(90_000),
  });
  updateCookie(session, response);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${endpoint}`);
  const payload = await response.json();
  if (payload?.state !== 1) throw new Error(`DLMU API error for ${endpoint}: ${JSON.stringify(payload).slice(0, 400)}`);
  return payload;
}

async function fetchOfficialPayload() {
  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const session = { cookie: "", token: "" };
      const pageResponse = await fetch(PAGE_URL, { headers: { "user-agent": "Mozilla/5.0 gaokao-dlmu-v353-importer/1.0" }, signal: AbortSignal.timeout(90_000) });
      updateCookie(session, pageResponse);
      const pageText = await pageResponse.text();
      if (!pageResponse.ok || pageText.length < 1000) throw new Error(`Unexpected DLMU page response: ${pageResponse.status}`);
      const csrf = await requestJson(session, "f/ajax_get_csrfToken", { n: 3 }, false);
      session.token = String(csrf.data || "").split(",")[0];
      const params = await requestJson(session, "f/ajax_zsjh_param", {});
      const plans = await requestJson(session, "f/ajax_zsjh", { ssmc: "", zsnf: "2026", klmc: "", zslx: "" });
      return { pageText, csrf, params, plans, request: { endpoint: `${API_BASE_URL}f/ajax_zsjh`, body: { ssmc: "", zsnf: "2026", klmc: "", zslx: "" } } };
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(attempt * 800);
    }
  }
  throw lastError;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(usage()); return; }
  const rawDir = path.join(PROJECT_ROOT, RAW_DIR);
  fs.mkdirSync(rawDir, { recursive: true });
  const pageFile = path.join(rawDir, "zsjh.html");
  const csrfFile = path.join(rawDir, "csrf.json");
  const paramsFile = path.join(rawDir, "params.json");
  const plansFile = path.join(rawDir, "plans.json");
  const requestFile = path.join(rawDir, "request.json");
  let fetched;
  if (args.useCache && fs.existsSync(plansFile) && fs.existsSync(paramsFile) && fs.existsSync(pageFile)) {
    fetched = {
      pageText: fs.readFileSync(pageFile, "utf8"),
      csrf: fs.existsSync(csrfFile) ? JSON.parse(fs.readFileSync(csrfFile, "utf8")) : {},
      params: JSON.parse(fs.readFileSync(paramsFile, "utf8")),
      plans: JSON.parse(fs.readFileSync(plansFile, "utf8")),
      request: fs.existsSync(requestFile) ? JSON.parse(fs.readFileSync(requestFile, "utf8")) : {},
    };
  } else {
    fetched = await fetchOfficialPayload();
    fs.writeFileSync(pageFile, fetched.pageText.endsWith("\n") ? fetched.pageText : `${fetched.pageText}\n`, "utf8");
    fs.writeFileSync(csrfFile, `${JSON.stringify(fetched.csrf, null, 2)}\n`, "utf8");
    fs.writeFileSync(paramsFile, `${JSON.stringify(fetched.params, null, 2)}\n`, "utf8");
    fs.writeFileSync(plansFile, `${JSON.stringify(fetched.plans, null, 2)}\n`, "utf8");
    fs.writeFileSync(requestFile, `${JSON.stringify(fetched.request, null, 2)}\n`, "utf8");
  }
  const rows = parseApiRows(fetched.plans);
  const totalRows = fetched.plans?.data?.zsjhTotal;
  if (!Array.isArray(totalRows)) throw new Error("DLMU API payload is missing data.zsjhTotal");
  const closure = closureAudit(fetched.plans.data.zsjhList, totalRows);
  if (rows.length !== 836) throw new Error(`Expected 836 DLMU rows, got ${rows.length}`);
  if (new Set(rows.map((row) => row.province)).size !== 31) throw new Error("Expected DLMU plans in 31 provinces");
  if (rows.reduce((sum, row) => sum + row.planCount, 0) !== 4718) throw new Error("Unexpected DLMU API plan total");
  if (closure.mismatches.length !== 0 || closure.comparedGroups !== 168) throw new Error(`DLMU API closure drift: ${JSON.stringify(closure)}`);
  const records = rows.map((row) => recordFromPlanRow(row, { rawPath: path.relative(PROJECT_ROOT, plansFile) }));
  const uniqueRecords = [...new Map(records.map((record) => [record.id, record])).values()];
  if (uniqueRecords.length !== records.length) throw new Error(`DLMU duplicate records: ${records.length} -> ${uniqueRecords.length}`);
  const sourceNote = {
    id: SOURCE.id,
    title: "大连海事大学招生信息网：2026 年招生计划",
    publisher: "大连海事大学招生办公室",
    url: SOURCE_PAGE_URL,
    pageUrl: SOURCE_PAGE_URL,
    apiUrl: `${API_BASE_URL}f/ajax_zsjh`,
    quality: SOURCE.quality,
    usage: "抽取大连海事大学招生信息网公开 2026 年 31 省分专业招生计划 API；用于当年专业池、计划数、科类、选科和特殊路径约束，不替代省级考试院正式计划、投档线或录取分。",
    parsedRecords: uniqueRecords.length,
    planRecords: uniqueRecords.length,
    provinceCount: new Set(uniqueRecords.map((record) => record.province)).size,
    provinces: [...new Set(uniqueRecords.map((record) => record.province))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
    byProvince: countBy(uniqueRecords, (record) => record.province),
    byAdmissionType: countBy(uniqueRecords, (record) => record.admissionType),
    byFormalScoreScope: countBy(uniqueRecords, (record) => record.formalScoreScope),
    bySubjectType: countBy(uniqueRecords, (record) => record.subjectType),
    byElectiveRequirement: countBy(uniqueRecords, (record) => record.electiveRequirement),
    byBatch: countBy(uniqueRecords, (record) => record.batch),
    totalPlanCount: uniqueRecords.reduce((sum, record) => sum + record.planCount, 0),
    summaryGroups: closure.comparedGroups,
    summaryClosureMismatches: closure.mismatches,
    headlinePlanCount: 4780,
    apiProvincePlanCount: 4718,
    unattributedDelta: 62,
    rawPaths: [pageFile, csrfFile, paramsFile, plansFile, requestFile].map((file) => path.relative(PROJECT_ROOT, file)),
    sha256: [pageFile, csrfFile, paramsFile, plansFile, requestFile].map((file) => ({ path: path.relative(PROJECT_ROOT, file), sha256: sha256File(file) })),
    transcriptionMethod: "official-public-json-api-with-csrf-session-and-full-response-snapshot",
    cautions: [
      "学校公告宣称面向境内招生计划 4780 个，API 可分省分专业明细合计 4718；差额 62 未归属到任何省份或专业，待省级正式目录核实，不将其伪造为预留或省份计划。",
      "API schcode 为空；记录中的 10151 仅作学校国标码，不推断省编院校代码。",
      "航海、轮机、船舶电子电气等专业的视力、色觉、身高、性别和工作性质限制保留在官方备注中；中外合作办学、提前批、专项和南疆单列已按 formalScoreScope 隔离。",
      "正式填报前必须回到当年省考试院、院校招生章程和最新计划目录核验。",
    ],
  };
  const outPath = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify({ sourceNotes: [sourceNote], records: uniqueRecords }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "ok", out: path.relative(PROJECT_ROOT, outPath), sourceId: SOURCE.id, provinces: sourceNote.provinceCount, records: uniqueRecords.length, totalPlanCount: sourceNote.totalPlanCount, headlinePlanCount: sourceNote.headlinePlanCount, unattributedDelta: sourceNote.unattributedDelta, summaryGroups: sourceNote.summaryGroups, byFormalScoreScope: sourceNote.byFormalScoreScope, byAdmissionType: sourceNote.byAdmissionType }, null, 2));
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
