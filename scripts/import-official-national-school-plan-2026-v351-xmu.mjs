#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUT = "data/admissions/official-national-school-plan-2026-v351-xmu-import.json";
const RAW_DIR = "data/admissions/raw/official-national-school-plan-2026-v351-xmu";
const OFFICIAL_PAGE_URL = "https://zs.xmu.edu.cn/info/1044/36612.htm";
const API_BASE_URL = "https://zsdata.xmu.edu.cn/lqxx/s/api/front/lqxx2";
const SOURCE = {
  id: "official-xmu-national-plan-2026",
  quality: "official-school-xmu-2026-national-plan-api",
  schoolCode: "10384",
  schoolName: "厦门大学",
  city: "厦门",
  tags: ["综合", "985", "211", "双一流", "福建", "厦门"],
};
const PROVINCES = [
  "北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "上海", "江苏",
  "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "广西",
  "海南", "重庆", "四川", "贵州", "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆",
];

function usage() {
  return [
    "Usage:",
    `  node scripts/import-official-national-school-plan-2026-v351-xmu.mjs --out ${DEFAULT_OUT}`,
    "  node scripts/import-official-national-school-plan-2026-v351-xmu.mjs --use-cache",
    "",
    "Imports Xiamen University official 2026 province/major admission plans from its public admissions API.",
  ].join("\n");
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

function hash(value, length = 18) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function clean(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[　]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeProvince(value) {
  const text = clean(value).replace(/省$|市$|自治区$|壮族自治区$|回族自治区$|维吾尔自治区$/g, "");
  if (text === "内蒙") return "内蒙古";
  if (text.includes("广西")) return "广西";
  if (text.includes("宁夏")) return "宁夏";
  if (text.includes("新疆")) return "新疆";
  if (text.includes("西藏")) return "西藏";
  return PROVINCES.find((province) => text.includes(province) || province.includes(text)) || text;
}

function subjectTypeFrom(raw) {
  const text = clean(raw);
  if (/艺术|美术|音乐|播音|舞蹈|设计/.test(text)) return "艺术类";
  if (/体育/.test(text)) return "体育类";
  if (/历史|文史|文科/.test(text)) return "历史类";
  if (/物理|理工|理科/.test(text)) return "物理类";
  if (/综合|不分|不限/.test(text)) return "综合";
  return text || "综合";
}

function classifyPlan(row) {
  const planType = clean(row.zslb);
  const batch = clean(row.pcmc) || "普通本科批";
  const text = `${planType} ${batch} ${clean(row.klmc)}`;
  let admissionType = "普通录取";
  if (/国家专项/.test(text)) admissionType = "国家专项";
  else if (/高校专项/.test(text)) admissionType = "高校专项";
  else if (/艺术类/.test(planType) && /中外合作/.test(planType)) admissionType = "艺术类(中外合作办学)";
  else if (/艺术类/.test(text)) admissionType = "艺术类";
  else if (/马来西亚分校/.test(planType)) admissionType = "马来西亚分校";
  else if (/民族班/.test(text)) admissionType = "民族班";
  else if (/定向西藏/.test(text)) admissionType = "定向西藏就业";
  else if (/南疆/.test(text)) admissionType = "南疆单列计划";
  else if (/面向厦门/.test(planType)) admissionType = "面向厦门";
  else if (/面向漳州/.test(planType)) admissionType = "面向漳州";
  const special = planType !== "普通类" || /专项|艺术|马来西亚|民族班|定向|南疆|面向厦门|面向漳州|中外合作/.test(text);
  return {
    batch,
    admissionType,
    admissionSubtype: planType || batch,
    formalScoreScope: special ? "special-path-only" : "school-official-only",
  };
}

function recordFromPlanRow(row, meta = {}) {
  const classification = classifyPlan(row);
  const province = normalizeProvince(row.sf);
  const majorName = clean(row.zymc);
  const remark = clean(row.zybz);
  const sourcePath = meta.rawPath || "data/admissions/raw/official-national-school-plan-2026-v351-xmu/lists.json";
  const record = {
    id: `2026-xmu-national-plan-${hash([
      row.nf || 2026, province, row.klmc, row.pcmc, row.zslb, majorName, row.jhrs, row.xkkm, row.xkyq,
    ].map(clean).join("|"))}`,
    province,
    year: Number(row.nf) || 2026,
    subjectType: subjectTypeFrom(row.klmc),
    batch: classification.batch,
    sourceBatchRaw: clean(row.pcmc),
    schoolName: SOURCE.schoolName,
    schoolCode: SOURCE.schoolCode,
    schoolTags: SOURCE.tags,
    city: SOURCE.city,
    dataType: "admission-plan",
    majorName,
    majorCode: clean(row.zydm || row.zydh),
    majorGroup: clean(row.zygroup),
    electiveRequirement: clean(row.xkkm) && clean(row.xkkm) !== "-" ? clean(row.xkkm) : undefined,
    programDuration: clean(row.xzmc),
    tuition: clean(row.zyxf),
    planCount: Number(row.jhrs),
    sourceSubjectRaw: clean(row.klmc),
    sourcePlanTypeRaw: clean(row.zslb),
    formalScoreScope: classification.formalScoreScope,
    admissionType: classification.admissionType,
    admissionSubtype: classification.admissionSubtype,
    schoolOfficialScope: "single-school-admission-plan",
    planRemark: remark,
    sourceQuality: SOURCE.quality,
    sourceId: SOURCE.id,
    sourceUrl: `${API_BASE_URL}/getList?type=zsjh`,
    sourcePageUrl: OFFICIAL_PAGE_URL,
    sourceIndexUrl: "https://zsdata.xmu.edu.cn/public/zsdata/lqxx/",
    officialEvidencePath: sourcePath,
    cautions: [
      "本记录来自厦门大学招生网 2026 年公开招生计划接口，只作当年专业池、计划数、科类、选科和路径约束，不是投档线、录取最低分或录取概率。",
      "计划、院校专业组、代码和批次若有变动，以考生所在省招生考试主管部门公布的正式计划为准。",
    ],
  };
  for (const key of Object.keys(record)) {
    if (record[key] === undefined || record[key] === "" || (Array.isArray(record[key]) && record[key].length === 0)) delete record[key];
  }
  if (!Number.isFinite(record.planCount) || record.planCount <= 0) throw new Error(`Invalid XMU plan count for ${majorName}`);
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

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, body) {
  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(90_000),
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/plain, */*",
          "user-agent": "Mozilla/5.0 gaokao-xmu-v351-importer/1.0",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      const payload = await response.json();
      if (payload?.success === false || payload?.code !== 200) throw new Error(`API error for ${url}: ${JSON.stringify(payload).slice(0, 300)}`);
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(attempt * 800);
    }
  }
  throw lastError;
}

async function cachedJson(file, useCache, fetcher) {
  if (useCache && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const payload = await fetcher();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const rawDir = path.join(PROJECT_ROOT, RAW_DIR);
  fs.mkdirSync(rawDir, { recursive: true });
  const typeFile = path.join(rawDir, "type.json");
  const typePayload = await cachedJson(typeFile, args.useCache, () => fetchJson(`${API_BASE_URL}/getType`, { type: "zsjh" }));
  const provinces = [...new Set(Object.keys(typePayload.typeMap || {})
    .filter((key) => key.startsWith("2026_"))
    .map((key) => normalizeProvince(key.split("_")[1])))]
    .filter((province) => PROVINCES.includes(province))
    .sort((a, b) => PROVINCES.indexOf(a) - PROVINCES.indexOf(b));
  if (provinces.length !== 31) throw new Error(`Expected 31 XMU provinces, got ${provinces.length}`);
  const requests = [];
  const outputs = [];
  for (const province of provinces) {
    const body = [
      { field: "nf", value: "2026" },
      { field: "sf", value: province },
      { field: "klmc", value: "全部" },
      { field: "zslb", value: "全部" },
    ];
    const file = path.join(rawDir, `${province}.json`);
    const payload = await cachedJson(file, args.useCache, () => fetchJson(`${API_BASE_URL}/getList?type=zsjh`, body));
    if (!Array.isArray(payload.list) || !payload.list.length) throw new Error(`No XMU plan rows for ${province}`);
    outputs.push({ province, payload, file, body });
    requests.push({ province, url: `${API_BASE_URL}/getList?type=zsjh`, body, responsePath: path.relative(PROJECT_ROOT, file) });
    if (!args.useCache) await sleep(100);
  }
  const requestFile = path.join(rawDir, "requests.json");
  fs.writeFileSync(requestFile, `${JSON.stringify({ typeUrl: `${API_BASE_URL}/getType`, typeBody: { type: "zsjh" }, requests }, null, 2)}\n`, "utf8");
  const records = outputs.flatMap(({ payload, file }) => payload.list.map((row) => recordFromPlanRow(row, { rawPath: path.relative(PROJECT_ROOT, file) })));
  const uniqueRecords = [...new Map(records.map((record) => [record.id, record])).values()];
  if (uniqueRecords.length !== records.length) throw new Error(`XMU plan records deduplicated unexpectedly: ${records.length} -> ${uniqueRecords.length}`);
  const actualProvinces = [...new Set(uniqueRecords.map((record) => record.province))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const rawFiles = [typeFile, requestFile, ...outputs.map(({ file }) => file)];
  const sourceNote = {
    id: SOURCE.id,
    title: "厦门大学招生网：厦门大学2026年本科（含预科转本科）招生计划",
    publisher: "厦门大学招生办公室",
    url: OFFICIAL_PAGE_URL,
    pageUrl: OFFICIAL_PAGE_URL,
    apiUrl: `${API_BASE_URL}/getList?type=zsjh`,
    quality: SOURCE.quality,
    usage: "抽取厦门大学招生网公开招生数据平台 2026 年 31 省分省分专业计划；用于当年专业池、计划数、科类、选科和特殊路径约束，不替代省级考试院正式计划、投档线或专业录取分。",
    parsedRecords: uniqueRecords.length,
    planRecords: uniqueRecords.length,
    provinceCount: actualProvinces.length,
    provinces: actualProvinces,
    byProvince: countBy(uniqueRecords, (record) => record.province),
    byPlanType: countBy(uniqueRecords, (record) => record.sourcePlanTypeRaw),
    byBatch: countBy(uniqueRecords, (record) => record.batch),
    byFormalScoreScope: countBy(uniqueRecords, (record) => record.formalScoreScope),
    bySubjectType: countBy(uniqueRecords, (record) => record.subjectType),
    totalPlanCount: uniqueRecords.reduce((sum, record) => sum + record.planCount, 0),
    rawPaths: rawFiles.map((file) => path.relative(PROJECT_ROOT, file)),
    sha256: rawFiles.map((file) => ({ path: path.relative(PROJECT_ROOT, file), sha256: sha256File(file) })),
    transcriptionMethod: "official-public-json-api-with-province-request-snapshots",
    cautions: [
      "厦门大学官方页面和接口均提示计划以各省招生考试主管部门最终公布为准；接口记录按省份、批次、招生类别和专业行保存。",
      "普通类、专项计划、民族班、定向西藏就业、南疆单列、艺术类、中外合作办学及马来西亚分校已按 formalScoreScope 隔离，不自动与普通录取边界混用。",
      "接口中的 jhrs 是该省该行计划数；不同省份批次/类别口径不完全相同，不能把跨省合计直接当作学校公告总规模。",
      "正式填报前必须回到当年省考试院、院校招生章程和最新计划目录核验。",
    ],
  };
  const outPath = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify({ sourceNotes: [sourceNote], records: uniqueRecords }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "ok",
    out: path.relative(PROJECT_ROOT, outPath),
    sourceId: SOURCE.id,
    provinces: actualProvinces.length,
    records: uniqueRecords.length,
    totalPlanCount: sourceNote.totalPlanCount,
    byFormalScoreScope: sourceNote.byFormalScoreScope,
    byPlanType: sourceNote.byPlanType,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
