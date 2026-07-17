#!/usr/bin/env node

import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const QUERY_URL = "https://zsw.nchu.edu.cn/index.php?sys=home&module=school_lnlqcj";
const AJAX_URL = `${QUERY_URL}&dev=ajax`;
const ARTICLE_URL = "https://zsw.nchu.edu.cn/index.php?act=view&article_id=Qqwnj8g5YyZW&module=article&param=49&sys=home";
const JS_URL = "https://zsw.nchu.edu.cn/js/school_lnlqcj_map_ajax.js";
const SOURCE_ID = "official-nchu-national-2021-2025-school-major-admission";
const SOURCE_QUALITY = "official-school-nchu-2021-2025-national-major-score-derived-segment-rank";
const DEFAULT_OUT = "data/admissions/official-national-school-admission-2021-2025-v3306-nchu-import.json";
const RAW_DIR = "data/admissions/raw/official-national-school-admission-2021-2025-v3306-nchu";
const YEARS = [2021, 2022, 2023, 2024, 2025];
const PROVINCES = [
  ["北京", "beijing"], ["天津", "tianjin"], ["河北", "hebei"], ["山西", "shanxi"], ["内蒙古", "inner-mongolia"],
  ["辽宁", "liaoning"], ["吉林", "jilin"], ["黑龙江", "heilongjiang"], ["上海", "shanghai"], ["江苏", "jiangsu"],
  ["浙江", "zhejiang"], ["安徽", "anhui"], ["福建", "fujian"], ["江西", "jiangxi"], ["山东", "shandong"],
  ["河南", "henan"], ["湖北", "hubei"], ["湖南", "hunan"], ["广东", "guangdong"], ["广西", "guangxi"],
  ["海南", "hainan"], ["重庆", "chongqing"], ["四川", "sichuan"], ["贵州", "guizhou"], ["云南", "yunnan"],
  ["西藏", "xizang"], ["陕西", "shaanxi"], ["甘肃", "gansu"], ["青海", "qinghai"], ["宁夏", "ningxia"], ["新疆", "xinjiang"],
];
const ARTICLE_ATTACHMENTS = [
  "https://zsw.nchu.edu.cn/userfiles/editorfiles/file/20250723/1753252672223547.xlsx",
  "https://zsw.nchu.edu.cn/userfiles/editorfiles/file/20250723/1753252753665229.xlsx",
];

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT, useCache: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--out") args.out = argv[++i];
    else if (argv[i] === "--use-cache") args.useCache = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function projectPath(relativePath) {
  return path.resolve(PROJECT_ROOT, relativePath);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sha256(value, length = 18) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function normalizeText(value) {
  return String(value ?? "").replace(/\u00a0/g, " ").replace(/[\t\r\n ]+/g, " ").trim();
}

function optionalNumber(value) {
  const text = normalizeText(value).replace(/[,，]/g, "");
  if (!text || !/^-?\d+(?:\.\d+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function countBy(items, keyFn) {
  const result = {};
  for (const item of items) {
    const key = keyFn(item) || "(blank)";
    result[key] = (result[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b, "zh-CN")));
}

function numericRange(values) {
  const numbers = values.filter(Number.isFinite);
  return numbers.length ? { min: Math.min(...numbers), max: Math.max(...numbers) } : null;
}

function curlOnce(url, options = {}) {
  return new Promise((resolve, reject) => {
    const args = [
      "-L", "--fail", "--silent", "--show-error",
      "--connect-timeout", "30", "--max-time", "120",
      "-H", `user-agent: Mozilla/5.0 gaokao-zhiyuan-site-nchu-v3306/1.0`,
      "-H", `accept: ${options.accept || "*/*"}`,
      "-H", `referer: ${options.referer || QUERY_URL}`,
      url,
    ];
    const child = spawn("curl", args, { cwd: PROJECT_ROOT, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(stdout));
      else reject(new Error(`curl failed (${code}) for ${url}: ${Buffer.concat(stderr).toString("utf8")}`));
    });
  });
}

async function fetchBuffer(url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await curlOnce(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, attempt * 700));
    }
  }
  throw lastError;
}

async function ensureStaticSource(relativePath, url, useCache, minimumBytes, accept) {
  const file = projectPath(relativePath);
  ensureDir(path.dirname(file));
  if (!useCache || !fs.existsSync(file) || fs.statSync(file).size < minimumBytes) {
    fs.writeFileSync(file, await fetchBuffer(url, { accept }));
  }
  if (fs.statSync(file).size < minimumBytes) throw new Error(`Source file too small: ${relativePath}`);
  return relativePath;
}

function queryApiUrl(year, province) {
  const url = new URL(AJAX_URL);
  url.searchParams.set("ND", String(year));
  url.searchParams.set("SFMC", province);
  url.searchParams.set("PCMC", "");
  url.searchParams.set("KLMC", "");
  url.searchParams.set("pagelist", "500");
  url.searchParams.set("limit", "500");
  url.searchParams.set("offset", "0");
  return url.href;
}

function declaredTotal(payload) {
  const match = String(payload.countpage || "").match(/共\s*<b>(\d+)<\/b>\s*条/);
  return match ? Number(match[1]) : (payload.records_block || []).length;
}

async function downloadApiFile(year, province, slug, useCache) {
  const relativePath = `${RAW_DIR}/api/${year}-${slug}.json`;
  const file = projectPath(relativePath);
  ensureDir(path.dirname(file));
  if (!useCache || !fs.existsSync(file) || fs.statSync(file).size < 50) {
    fs.writeFileSync(file, await fetchBuffer(queryApiUrl(year, province), { accept: "application/json,text/plain,*/*" }));
  }
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  const rows = payload.records_block || [];
  const total = declaredTotal(payload);
  if (rows.length !== total || total > 500) throw new Error(`${province}/${year} pagination mismatch: rows=${rows.length}, total=${total}`);
  return { year, province, slug, relativePath, rows, total, sha256: sha256File(file) };
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function normalizeSubject(raw, province) {
  const value = normalizeText(raw);
  if (/历史|文史|文科/.test(value)) return "历史类";
  if (/物理|理工|理科/.test(value)) return "物理类";
  if (/艺术/.test(value)) return "艺术类";
  if (/体育/.test(value)) return "体育类";
  if (/综合|不分文理|不分科目/.test(value)) return "综合";
  if (["北京", "天津", "上海", "浙江", "山东", "海南"].includes(province)) return "综合";
  return value || "不确定";
}

function classifyPath(row) {
  const text = normalizeText([row.PCMC, row.KLMC, row.KSLX, row.ZYMC, row.BZ].join(" "));
  const special = /专项|艺术|体育|提前|飞行技术|飞行学员|中外合作|国际合作|预科|定向|单列|民族班|高水平|运动训练|专升本|职教|对口|港澳台/.test(text);
  let admissionType = "普通录取";
  if (/国家专项/.test(text)) admissionType = "国家专项";
  else if (/地方专项/.test(text)) admissionType = "地方专项";
  else if (/苏区专项/.test(text)) admissionType = "苏区专项";
  else if (/艺术/.test(text)) admissionType = "艺术类";
  else if (/体育/.test(text)) admissionType = "体育类";
  else if (/飞行技术|飞行学员/.test(text)) admissionType = "飞行技术/提前批";
  else if (/中外合作|国际合作/.test(text)) admissionType = "合作办学";
  else if (special) admissionType = "特殊路径";
  return { formalScoreScope: special ? "special-path-only" : "school-official-only", admissionType };
}

function buildRecord(row) {
  const province = normalizeText(row.SFMC);
  const year = Number(row.ND);
  const minScore = optionalNumber(row.ZDF);
  const averageScore = optionalNumber(row.PJF);
  const maxScore = optionalNumber(row.ZGF);
  const controlLine = optionalNumber(row.SKX);
  const scoreDerivedRank = optionalNumber(row.ZDFPW);
  const averageScoreDerivedRank = optionalNumber(row.PJFPW);
  const admittedCount = optionalNumber(row.TDRS);
  const majorName = normalizeText(row.ZYMC);
  const subjectType = normalizeSubject(row.KLMC, province);
  const classification = classifyPath(row);
  const record = {
    id: `nchu-${year}-${normalizeText(row.ID) || sha256([province, row.PCMC, row.KLMC, majorName, minScore].join("|"))}`,
    province,
    year,
    city: "南昌",
    schoolCode: "10406",
    schoolName: "南昌航空大学",
    schoolTags: ["公办", "理工", "航空特色"],
    dataType: "major-admission",
    educationLevel: normalizeText(row.CCMC) || "本科",
    subjectType,
    sourceSubjectRaw: normalizeText(row.KLMC),
    batch: normalizeText(row.PCMC) || "本科批",
    admissionType: classification.admissionType,
    admissionSubtype: classification.admissionType,
    formalScoreScope: classification.formalScoreScope,
    schoolOfficialScope: scoreDerivedRank ? "single-school-major-score-with-score-derived-rank" : "single-school-major-score",
    majorName,
    majorGroup: normalizeText(row.BZ),
    examType: normalizeText(row.KSLX),
    minScore,
    averageScore,
    maxScore,
    controlLine,
    admittedCount,
    sourceId: SOURCE_ID,
    sourceQuality: SOURCE_QUALITY,
    sourceUrl: QUERY_URL,
    sourcePageUrl: QUERY_URL,
    sourceIndexUrl: ARTICLE_URL,
    sourceMajorRaw: majorName,
    sourceBatchRaw: normalizeText(row.PCMC),
    sourceMinScoreRaw: normalizeText(row.ZDF),
    sourceRankRaw: normalizeText(row.ZDFPW),
    sourceRecordId: normalizeText(row.ID),
    scoreOnly: !scoreDerivedRank,
    rankUnavailable: !scoreDerivedRank,
    nativeAdmissionRankUnavailable: true,
    rankDerivedFromScore: Boolean(scoreDerivedRank),
    rankEvidenceScope: scoreDerivedRank ? "score-derived-provincial-segment" : "unavailable",
    scoreMetric: "学校分专业录取最低分；位次按该最低分对应省级一分一段表换算",
    rankMetric: scoreDerivedRank ? "最低分对应全省最低位次（非本校录取最低位次）" : "未公开可用位次",
    rankDisclaimer: "南昌航空大学明确说明：排位按各省一分一段表统计，为相应分数全省最低位次，不是学校录取最低位次。",
    officialEvidencePath: `${RAW_DIR}/api/${year}-${PROVINCES.find(([name]) => name === province)?.[1] || "unknown"}.json`,
    cautions: [
      "本记录来自南昌航空大学招生信息网官方全国历年分数查询，是学校官网单校分专业边界，不是省级考试院全量投档/录取表。",
      scoreDerivedRank ? "位次由学校按最低分对应的一分一段表换算，不是本校录取考生中的真实最低位次；仅作分数-位次对齐参考。" : "源表未提供可用位次；不生成假位次。",
      classification.formalScoreScope === "special-path-only" ? "专项、艺体、飞行技术、合作办学等按special-path-only隔离，不与普通本科批混用。" : "普通学校官网单校分数按school-official-only保留，推荐置信度最高只到A-。",
    ],
  };
  if (scoreDerivedRank) {
    record.minRank = scoreDerivedRank;
    record.minRankStart = scoreDerivedRank;
    record.minRankEnd = scoreDerivedRank;
    record.rankRangeText = `${scoreDerivedRank}（最低分换算）`;
    record.scoreDerivedRank = scoreDerivedRank;
  }
  if (averageScoreDerivedRank) record.averageScoreDerivedRank = averageScoreDerivedRank;
  return record;
}

function validateRecord(record) {
  const maxScore = record.province === "海南" ? 900 : record.province === "上海" ? 660 : 750;
  if (!record.province || !record.year || !record.majorName || !Number.isFinite(record.minScore)) return "required-field-missing";
  if (record.minScore <= 0 || record.minScore > 1000) return "score-out-of-global-range";
  if (record.formalScoreScope === "school-official-only" && (record.minScore < 100 || record.minScore > maxScore)) return "ordinary-score-out-of-range";
  if (record.maxScore != null && record.maxScore < record.minScore) return "score-order-invalid";
  if (record.rankDerivedFromScore !== Boolean(record.minRankEnd)) return "rank-derived-flag-mismatch";
  if (record.minRankEnd && !record.rankDisclaimer) return "rank-disclaimer-missing";
  return "";
}

function writeJson(relativePath, value) {
  const file = projectPath(relativePath);
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/mac_2T/")) throw new Error("Refusing to run from /Volumes/mac_2T; use internal APFS staging.");
  const args = parseArgs(process.argv);
  const staticFiles = [];
  staticFiles.push(await ensureStaticSource(`${RAW_DIR}/nchu-score-query.html`, QUERY_URL, args.useCache, 10_000, "text/html,*/*"));
  staticFiles.push(await ensureStaticSource(`${RAW_DIR}/nchu-score-query.js`, JS_URL, args.useCache, 3_000, "text/javascript,*/*"));
  staticFiles.push(await ensureStaticSource(`${RAW_DIR}/nchu-2025-score-article.html`, ARTICLE_URL, args.useCache, 10_000, "text/html,*/*"));
  for (let i = 0; i < ARTICLE_ATTACHMENTS.length; i += 1) {
    staticFiles.push(await ensureStaticSource(`${RAW_DIR}/nchu-2025-jiangxi-attachment-${i + 1}.xlsx`, ARTICLE_ATTACHMENTS[i], args.useCache, 5_000, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*"));
  }
  const queryHtml = fs.readFileSync(projectPath(staticFiles[0]), "utf8");
  const articleHtml = fs.readFileSync(projectPath(staticFiles[2]), "utf8");
  if (!/历年分数查询/.test(queryHtml) || !/2025年录取分数线查询/.test(articleHtml) || !/不是我校录取最低位次/.test(articleHtml)) {
    throw new Error("NCHU source identity or rank disclaimer check failed");
  }

  const jobs = YEARS.flatMap((year) => PROVINCES.map(([province, slug]) => ({ year, province, slug })));
  const apiFiles = await mapLimit(jobs, 6, (job) => downloadApiFile(job.year, job.province, job.slug, args.useCache));
  const rawRows = apiFiles.flatMap((item) => item.rows);
  const skippedRows = [];
  const records = [];
  for (const row of rawRows) {
    const record = buildRecord(row);
    const issue = validateRecord(record);
    if (issue) skippedRows.push({ issue, sourceRecordId: normalizeText(row.ID), row });
    else records.push(record);
  }
  const deduped = [...new Map(records.map((record) => [record.id, record])).values()];
  const duplicateRecordsSkipped = records.length - deduped.length;
  const provincesWithRecords = [...new Set(deduped.map((record) => record.province))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const yearsWithRecords = [...new Set(deduped.map((record) => record.year))].sort((a, b) => b - a);
  const derivedRankRecords = deduped.filter((record) => record.rankDerivedFromScore);
  const nativeRankClaims = deduped.filter((record) => record.minRankEnd && record.nativeAdmissionRankUnavailable !== true);
  const ordinaryOutliers = deduped.filter((record) => validateRecord(record) === "ordinary-score-out-of-range");
  if (deduped.length < 2_000) throw new Error(`Too few NCHU records: ${deduped.length}`);
  if (provincesWithRecords.length < 25) throw new Error(`Too few NCHU provinces: ${provincesWithRecords.length}`);
  if (yearsWithRecords.length !== YEARS.length) throw new Error(`Expected ${YEARS.length} years, got ${yearsWithRecords.length}`);
  if (derivedRankRecords.length < 1_000) throw new Error(`Too few score-derived rank rows: ${derivedRankRecords.length}`);
  if (nativeRankClaims.length) throw new Error(`Unexpected native-rank claims: ${nativeRankClaims.length}`);
  if (ordinaryOutliers.length) throw new Error(`Ordinary score outliers: ${ordinaryOutliers.length}`);

  const parseIndexRel = `${RAW_DIR}/nchu-parse-index.json`;
  writeJson(parseIndexRel, {
    generatedAt: new Date().toISOString(),
    queryUrl: QUERY_URL,
    articleUrl: ARTICLE_URL,
    rankDisclaimerVerified: true,
    staticFiles: staticFiles.map((relativePath) => ({ relativePath, sha256: sha256File(projectPath(relativePath)) })),
    apiFiles: apiFiles.map(({ rows, ...item }) => item),
    skippedRows,
  });
  const rawFiles = [...staticFiles, parseIndexRel, ...apiFiles.map((item) => item.relativePath)];
  const byFormalScoreScope = countBy(deduped, (record) => record.formalScoreScope);
  const byProvince = countBy(deduped, (record) => record.province);
  const byYear = countBy(deduped, (record) => String(record.year));
  const sourceNote = {
    id: SOURCE_ID,
    title: "南昌航空大学2021-2025年全国分省分专业录取分数",
    publisher: "南昌航空大学招生就业管理处",
    publishedAt: "2025-07-23",
    url: QUERY_URL,
    indexUrl: ARTICLE_URL,
    queryUrl: QUERY_URL,
    attachmentUrls: ARTICLE_ATTACHMENTS,
    quality: SOURCE_QUALITY,
    usage: "导入学校官方历年分数查询中的分省分专业最低分、平均分、最高分、录取人数和最低分对应一分一段位次；普通记录按school-official-only，专项、艺体、飞行技术、合作办学等按special-path-only隔离。",
    evidenceBoundary: "single-school major admission score; rank is score-derived provincial segment rank, not school-recorded lowest admitted rank; not province-wide closure",
    rawDir: RAW_DIR,
    rawFiles,
    parsedRecords: deduped.length,
    derivedRankRecords: derivedRankRecords.length,
    nativeAdmissionRankRecords: 0,
    rankUnavailableRecords: deduped.length - derivedRankRecords.length,
    provinceCount: provincesWithRecords.length,
    provincesWithRecords,
    yearsWithRecords,
    byFormalScoreScope,
    byProvince,
    byYear,
    scoreRange: numericRange(deduped.map((record) => record.minScore)),
    skippedRows,
    duplicateRecordsSkipped,
    cautions: [
      "学校官网单校分专业分数不替代省级教育考试院全量投档或最终录取表。",
      "官网明确说明排位由各省一分一段表按相应分数统计，不是学校录取最低位次；全部用rankDerivedFromScore和rankEvidenceScope显式标记。",
      "专项、艺体、飞行技术、合作办学等保持special-path-only，不与普通本科批混用。",
      "正式填报仍须核对考生省份当年招生计划、专业组、选科要求和学校章程。",
    ],
  };
  const payload = {
    dataset: "official-national-school-admission-2021-2025-v3306-nchu",
    generatedAt: new Date().toISOString(),
    scope: { years: YEARS, school: "南昌航空大学", provinceCount: provincesWithRecords.length },
    notes: sourceNote.cautions,
    sourceNotes: [sourceNote],
    records: deduped,
    audit: {
      totalRecords: deduped.length,
      rawRows: rawRows.length,
      duplicateRecordsSkipped,
      derivedRankRecords: derivedRankRecords.length,
      nativeAdmissionRankRecords: 0,
      rankUnavailableRecords: deduped.length - derivedRankRecords.length,
      skippedRows,
      ordinaryOutliers,
      byFormalScoreScope,
      byProvince,
      byYear,
      byDataType: countBy(deduped, (record) => record.dataType),
      bySubjectType: countBy(deduped, (record) => record.subjectType),
      scoreRange: sourceNote.scoreRange,
    },
  };
  writeJson(args.out, payload);
  console.log(JSON.stringify({ out: args.out, records: deduped.length, provinceCount: provincesWithRecords.length, years: yearsWithRecords, derivedRankRecords: derivedRankRecords.length, rankUnavailableRecords: deduped.length - derivedRankRecords.length, skippedRows: skippedRows.length, byFormalScoreScope, scoreRange: sourceNote.scoreRange }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
