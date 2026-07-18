#!/usr/bin/env node

import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_URL = "https://zhaosheng.hdu.edu.cn/list.php?cid=28";
const QUERY_URL = "https://zhaosheng.hdu.edu.cn/deal.php";
const SOURCE_ID = "official-hdu-national-2014-2025-school-major-admission";
const RAW_REL = "data/admissions/raw/official-national-school-admission-2014-2025-v3310-hdu";
const RAW_DIR = path.join(PROJECT_ROOT, RAW_REL);
const OUTPUT_REL = "data/admissions/official-national-school-admission-2014-2025-v3310-hdu-import.json";
const OUTPUT_PATH = path.join(PROJECT_ROOT, OUTPUT_REL);
const RAW_MANIFEST_REL = `${RAW_REL}/hdu-raw-manifest.json`;
const RAW_MANIFEST_PATH = path.join(PROJECT_ROOT, RAW_MANIFEST_REL);
const YEARS = Array.from({ length: 12 }, (_, index) => 2025 - index);

const PROVINCES = [
  ["北京", "北京市", "beijing"], ["天津", "天津市", "tianjin"], ["河北", "河北省", "hebei"],
  ["山西", "山西省", "shanxi"], ["内蒙古", "内蒙古区", "inner-mongolia"], ["辽宁", "辽宁省", "liaoning"],
  ["吉林", "吉林省", "jilin"], ["黑龙江", "黑龙江省", "heilongjiang"], ["上海", "上海市", "shanghai"],
  ["江苏", "江苏省", "jiangsu"], ["浙江", "浙江省", "zhejiang"], ["安徽", "安徽省", "anhui"],
  ["福建", "福建省", "fujian"], ["江西", "江西省", "jiangxi"], ["山东", "山东省", "shandong"],
  ["河南", "河南省", "henan"], ["湖北", "湖北省", "hubei"], ["湖南", "湖南省", "hunan"],
  ["广东", "广东省", "guangdong"], ["广西", "广西区", "guangxi"], ["海南", "海南省", "hainan"],
  ["重庆", "重庆市", "chongqing"], ["四川", "四川省", "sichuan"], ["贵州", "贵州省", "guizhou"],
  ["云南", "云南省", "yunnan"], ["西藏", "西藏区", "xizang"], ["陕西", "陕西省", "shaanxi"],
  ["甘肃", "甘肃省", "gansu"], ["青海", "青海省", "qinghai"], ["宁夏", "宁夏区", "ningxia"],
  ["新疆", "新疆区", "xinjiang"],
];
const PROVINCE_INDEX = new Map(PROVINCES.map(([province], index) => [province, index]));
const SPECIAL_RE = /艺术|体育|美术|音乐|舞蹈|书法|中外合作|合作办学|地方专项|国家专项|高校专项|专项|综合评价|三位一体|高水平|提前|单设|预科|定向|少数民族|民族班|内高班|内地高中班|新疆班|西藏班|南疆|单列|征集|对口|单招|专升本|飞行技术/;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function decodeHtml(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(value || "")
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_, number) => String.fromCodePoint(Number.parseInt(number, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function clean(value) {
  return decodeHtml(String(value ?? "")).replace(/[\u00a0\u3000]/g, " ").replace(/\s+/g, " ").trim();
}

function numberOrNull(value, { integer = false, positive = false } = {}) {
  const text = clean(value).replace(/,/g, "");
  if (!text || /^(?:--|——|—|-|\/|无|null|undefined)$/i.test(text)) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || (integer && !Number.isInteger(number)) || (positive && number <= 0)) return null;
  return number;
}

function normalizeSubject(raw) {
  const value = clean(raw);
  if (/物理|理工|理科/.test(value)) return "物理类";
  if (/历史|文史|文科/.test(value)) return "历史类";
  if (/艺术|美术|音乐|舞蹈|书法/.test(value)) return "艺术类";
  if (/体育/.test(value)) return "体育类";
  if (/综合|不分科目|不分文理|普通类/.test(value)) return "综合";
  return value || "未列科类";
}

function parseRadioValues(html, name) {
  return [...html.matchAll(new RegExp(`<input\\b[^>]*name=["']${name}["'][^>]*value=["']([^"']+)["']`, "gi"))]
    .map((match) => clean(match[1]));
}

function parseResponse(bytes, label) {
  const text = bytes.toString("utf8").replace(/^\uFEFF/, "").trim();
  if (!text) return [];
  const values = text.split(",").map(clean);
  while (values.length && !values.at(-1)) values.pop();
  if (values.length % 7 !== 0) {
    throw new Error(`${label} response field count ${values.length} is not divisible by 7: ${text.slice(0, 500)}`);
  }
  const rows = [];
  for (let index = 0; index < values.length; index += 7) {
    rows.push({
      subject: values[index],
      batch: values[index + 1],
      major: values[index + 2],
      admittedCount: values[index + 3],
      maxScore: values[index + 4],
      minScore: values[index + 5],
      averageScore: values[index + 6],
    });
  }
  return rows;
}

async function download(url, outputPath, form = null) {
  const tempPath = `${outputPath}.download-${process.pid}`;
  const args = [
    "--fail", "--silent", "--show-error", "--location", "--compressed",
    "--retry", "8", "--retry-all-errors", "--retry-delay", "2",
    "--connect-timeout", "25", "--max-time", "120",
    "--user-agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) gaokao-data-audit/3.310",
    "--header", `Referer: ${SOURCE_URL}`,
  ];
  if (form) {
    args.push("--request", "POST");
    for (const [key, value] of Object.entries(form)) args.push("--data-urlencode", `${key}=${value}`);
  }
  args.push(url, "-o", tempPath);
  const result = spawnSync("curl", args, { encoding: "utf8" });
  if (result.status !== 0) {
    await fs.rm(tempPath, { force: true });
    throw new Error(`curl failed for ${url}: ${result.stderr || result.stdout}`);
  }
  await fs.rename(tempPath, outputPath);
}

async function readOfficial(relativePath, url, form, useCache) {
  const outputPath = path.join(PROJECT_ROOT, relativePath);
  const exists = await fs.stat(outputPath).then(() => true, () => false);
  if (!useCache || !exists) await download(url, outputPath, form);
  return fs.readFile(outputPath);
}

function buildRecord({ row, province, officialProvince, year, sourceFile, rowIndex }) {
  const majorName = clean(row.major);
  const minScore = numberOrNull(row.minScore, { positive: true });
  if (!majorName || minScore === null) return null;
  const maxScore = numberOrNull(row.maxScore, { positive: true });
  const averageScore = numberOrNull(row.averageScore, { positive: true });
  const admittedCount = numberOrNull(row.admittedCount, { integer: true, positive: true });
  const subjectRaw = clean(row.subject);
  const batchRaw = clean(row.batch) || "官网未列批次";
  const subjectType = normalizeSubject(subjectRaw);
  const specialPath = SPECIAL_RE.test([subjectRaw, batchRaw, majorName].join(" "));
  const oldSubjectMapping = /文史|理工|文科|理科/.test(subjectRaw);
  const fingerprint = [province, officialProvince, year, subjectRaw, batchRaw, majorName, row.admittedCount, row.maxScore, row.minScore, row.averageScore].join("\u001f");
  const cautions = [
    "本记录来自杭州电子科技大学本科招生网历年录取页面，是学校官网单校分专业首轮投档录取边界，不是省级考试院全量投档/录取表。",
    specialPath
      ? "该行属于艺体、专项、三位一体、中外合作或其他限定路径，只在special-path-only层保留；不能与普通本科直接混用。"
      : "普通学校官网单校分数按school-official-only保留，推荐置信度最高只到A-，不能单独生成录取概率。",
    "官网该页没有公布最低录取位次，保持rankUnavailable=true，不以最低分生成假位次。",
    "官网科类是当年录取分类，不等同于专业选科要求；正式填报须回当年分省招生计划和招生章程复核。",
  ];
  if (oldSubjectMapping) cautions.push(`官网原科类“${subjectRaw}”为旧高考文理口径，运行层仅映射到${subjectType}用于检索，不能冒充新高考选科要求。`);

  return {
    id: `hdu-${year}-${sha256(fingerprint).slice(0, 18)}`,
    province,
    year,
    city: "杭州",
    campus: "",
    schoolCode: "10336",
    schoolName: "杭州电子科技大学",
    schoolTags: ["公办", "理工", "浙江省属"],
    dataType: "major-admission",
    educationLevel: "本科",
    subjectType,
    sourceSubjectRaw: subjectRaw,
    subjectMappingNote: oldSubjectMapping ? `旧文理口径${subjectRaw}映射为${subjectType}` : "按官网科类原文归一",
    batch: specialPath ? batchRaw : "本科普通类",
    admissionType: specialPath ? "特殊路径录取" : "普通录取",
    admissionSubtype: batchRaw,
    formalScoreScope: specialPath ? "special-path-only" : "school-official-only",
    schoolOfficialScope: "single-school-major-score-and-admitted-count-only",
    majorName,
    electiveRequirement: "",
    admittedCount,
    minScore,
    averageScore,
    maxScore,
    sourceId: SOURCE_ID,
    sourceQuality: "official-school-hdu-2014-2025-national-major-score-and-admitted-count",
    sourceUrl: SOURCE_URL,
    sourcePageUrl: SOURCE_URL,
    sourceAdmissionTypeRaw: batchRaw,
    sourcePlanTypeRaw: batchRaw,
    sourceBatchRaw: batchRaw,
    sourceAdmissionCountRaw: clean(row.admittedCount),
    sourceRemark: admittedCount === null ? "官网该行未列有效招生数" : `官网列招生数：${admittedCount}`,
    sourceFile,
    sourceRowIndex: rowIndex,
    scoreOnly: true,
    rankUnavailable: true,
    nativeAdmissionRankUnavailable: true,
    rankDerivedFromScore: false,
    rankEvidenceScope: "rank-unavailable",
    scoreMetric: specialPath ? "学校官网特殊路径首轮投档录取成绩" : "学校分专业首轮投档录取最低分",
    rankMetric: "官网未公开最低录取位次",
    officialEvidencePath: sourceFile,
    cautions,
  };
}

function compareRecords(left, right) {
  return PROVINCE_INDEX.get(left.province) - PROVINCE_INDEX.get(right.province)
    || right.year - left.year
    || left.subjectType.localeCompare(right.subjectType, "zh-CN")
    || left.batch.localeCompare(right.batch, "zh-CN")
    || left.majorName.localeCompare(right.majorName, "zh-CN")
    || left.id.localeCompare(right.id);
}

async function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/mac_2T/")) throw new Error("Refusing to run from /Volumes/mac_2T; use internal APFS staging.");
  const useCache = process.argv.includes("--use-cache");
  await fs.mkdir(RAW_DIR, { recursive: true });
  const records = [];
  const rawResponses = [];
  const skippedRows = [];

  const indexFile = `${RAW_REL}/hdu-admission-index.html`;
  const indexBytes = await readOfficial(indexFile, SOURCE_URL, null, useCache);
  const indexHtml = indexBytes.toString("utf8");
  if (!indexHtml.includes("历年录取") || !indexHtml.includes("deal.php") || !indexHtml.includes("各省各专业首轮投档录取分")) {
    throw new Error("HDU admission index identity drifted");
  }
  const officialProvinces = parseRadioValues(indexHtml, "province");
  const officialYears = parseRadioValues(indexHtml, "year").map(Number);
  if (officialProvinces.length !== 32 || !officialProvinces.includes("港澳台")) throw new Error(`Expected 32 official province selectors, received ${officialProvinces.length}`);
  if (officialYears.length !== YEARS.length || YEARS.some((year) => !officialYears.includes(year))) throw new Error(`Official year selectors drifted: ${officialYears.join(",")}`);
  for (const [, officialProvince] of PROVINCES) if (!officialProvinces.includes(officialProvince)) throw new Error(`Missing official province selector ${officialProvince}`);
  rawResponses.push({ kind: "index", path: indexFile, url: SOURCE_URL, bytes: indexBytes.length, sha256: sha256(indexBytes) });

  for (const [province, officialProvince, slug] of PROVINCES) {
    for (const year of YEARS) {
      const sourceFile = `${RAW_REL}/scores-${slug}-${year}.txt`;
      const form = { province: officialProvince, year };
      const bytes = await readOfficial(sourceFile, QUERY_URL, form, useCache);
      const rows = parseResponse(bytes, `${province} ${year}`);
      rawResponses.push({ kind: "scores", province, officialProvince, year, path: sourceFile, url: QUERY_URL, form, bytes: bytes.length, sha256: sha256(bytes), rows: rows.length });
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        const record = buildRecord({ row, province, officialProvince, year, sourceFile, rowIndex });
        if (record) records.push(record);
        else skippedRows.push({ province, officialProvince, year, sourceFile, rowIndex, row, reason: "missing-major-or-min-score" });
      }
    }
  }

  records.sort(compareRecords);
  const duplicateIds = records.length - new Set(records.map((record) => record.id)).size;
  if (duplicateIds) throw new Error(`HDU duplicate IDs: ${duplicateIds}`);
  const ordinaryRecords = records.filter((record) => record.formalScoreScope === "school-official-only");
  const specialPathRecords = records.filter((record) => record.formalScoreScope === "special-path-only");
  const provincesWithRecords = [...new Set(records.map((record) => record.province))].sort((a, b) => PROVINCE_INDEX.get(a) - PROVINCE_INDEX.get(b));
  const yearsWithRecords = [...new Set(records.map((record) => record.year))].sort((a, b) => b - a);
  const generatedAt = new Date().toISOString();
  const rawManifest = {
    dataset: "official-national-school-admission-2014-2025-v3310-hdu-raw",
    generatedAt,
    sourceUrl: SOURCE_URL,
    api: { endpoint: QUERY_URL, queryMethod: "POST form: province + year", responseSchema: ["科类", "批次", "专业", "招生数", "最高分", "最低分", "平均分"] },
    officialSelectors: { provinces: officialProvinces, excludedFromMainlandRuntime: ["港澳台"], years: officialYears },
    responses: rawResponses,
    totals: {
      files: rawResponses.length,
      bytes: rawResponses.reduce((sum, response) => sum + response.bytes, 0),
      scoreQueries: rawResponses.filter((response) => response.kind === "scores").length,
      sourceRows: rawResponses.filter((response) => response.kind === "scores").reduce((sum, response) => sum + response.rows, 0),
    },
  };
  await fs.writeFile(RAW_MANIFEST_PATH, `${JSON.stringify(rawManifest, null, 2)}\n`);

  const subjectNames = [...new Set(records.map((record) => record.sourceSubjectRaw))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const batchNames = [...new Set(records.map((record) => record.sourceBatchRaw))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const rawFiles = [...rawResponses.map((response) => response.path), RAW_MANIFEST_REL];
  const output = {
    dataset: "official-national-school-admission-2014-2025-v3310-hdu",
    generatedAt,
    scope: { years: yearsWithRecords, provinces: provincesWithRecords, dataType: "major-admission", school: "杭州电子科技大学", sourceLevel: "school-official-only-with-special-path-isolation" },
    sourceNotes: [{
      id: SOURCE_ID,
      title: "杭州电子科技大学2014-2025年全国分省分专业首轮投档录取分",
      publisher: "杭州电子科技大学本科招生办公室",
      url: SOURCE_URL,
      quality: "official-school-hdu-2014-2025-national-major-score-and-admitted-count",
      usage: "导入学校官方历年录取页面的分省分专业科类、批次、招生数、最低分、平均分和最高分；普通记录按school-official-only，艺体、专项、三位一体、中外合作等按special-path-only隔离。",
      evidenceBoundary: "single-school major first-round admission score and admitted count; rank and elective requirement unavailable; not province-wide closure or admission probability",
      rawDir: RAW_REL,
      rawFiles,
      parsedRecords: records.length,
      admittedCountRecords: records.filter((record) => record.admittedCount).length,
      nativeAdmissionRankRecords: 0,
      derivedRankRecords: 0,
      rankUnavailableRecords: records.length,
      ordinaryRecords: ordinaryRecords.length,
      specialPathRecords: specialPathRecords.length,
      provinceCount: provincesWithRecords.length,
      provincesWithRecords,
      yearsWithRecords,
      subjectNames,
      batchNames,
    }],
    records,
    audit: {
      requestedProvinces: PROVINCES.length,
      officialProvinceSelectors: officialProvinces.length,
      rawResponseFiles: rawResponses.length,
      rawBytes: rawManifest.totals.bytes,
      scoreQueries: rawManifest.totals.scoreQueries,
      sourceRows: rawManifest.totals.sourceRows,
      parsedRecords: records.length,
      skippedRows,
      duplicateIds,
      admittedCountRecords: records.filter((record) => record.admittedCount).length,
      ordinaryRecords: ordinaryRecords.length,
      specialPathRecords: specialPathRecords.length,
      nativeAdmissionRankRecords: 0,
      derivedRankRecords: 0,
      rankUnavailableRecords: records.length,
      minScore: Math.min(...records.map((record) => record.minScore)),
      maxScore: Math.max(...records.map((record) => record.maxScore || record.minScore)),
      ordinaryMinScore: Math.min(...ordinaryRecords.map((record) => record.minScore)),
      ordinaryMaxScore: Math.max(...ordinaryRecords.map((record) => record.maxScore || record.minScore)),
      provinceCount: provincesWithRecords.length,
      yearCounts: Object.fromEntries(yearsWithRecords.map((year) => [year, records.filter((record) => record.year === year).length])),
      provinceCounts: Object.fromEntries(provincesWithRecords.map((province) => [province, records.filter((record) => record.province === province).length])),
      provinceYearCounts: Object.fromEntries(provincesWithRecords.map((province) => [province, Object.fromEntries(yearsWithRecords.map((year) => [year, records.filter((record) => record.province === province && record.year === year).length]))])),
      subjectNames,
      batchNames,
    },
    notes: [
      "学校官网单校分数和招生数不替代省级考试院全量投档/录取表，也不单独生成录取概率。",
      "艺体、专项、三位一体、中外合作等限定路径不进入普通自动推荐。",
      "官网未公开最低录取位次，全部记录保持rankUnavailable，不生成假位次。",
      "官网科类不等于专业选科要求，运行层不补造选科字段，正式填报须回当年分省计划和招生章程。",
      "官网列有港澳台入口，但本站全国高考运行层只接入31个内地省级口径；港澳台不混入普通高考分片。",
    ],
  };
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({
    status: "ok", output: OUTPUT_REL, rawDir: RAW_REL,
    rawResponseFiles: rawResponses.length, rawBytes: rawManifest.totals.bytes,
    scoreQueries: rawManifest.totals.scoreQueries, sourceRows: rawManifest.totals.sourceRows,
    records: records.length, admittedCountRecords: output.audit.admittedCountRecords,
    ordinaryRecords: ordinaryRecords.length, specialPathRecords: specialPathRecords.length,
    rankUnavailableRecords: records.length, provinces: provincesWithRecords.length,
    years: yearsWithRecords, subjects: subjectNames, batches: batchNames,
    skippedRows: skippedRows.length, duplicateIds,
  }, null, 2));
}

await main();
