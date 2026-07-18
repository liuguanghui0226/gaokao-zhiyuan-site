#!/usr/bin/env node

import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_URL = "https://zsb.qlu.edu.cn/score";
const DICT_URL = "https://zsb.qlu.edu.cn/home/api/biz_dict";
const SCORE_URL = "https://zsb.qlu.edu.cn/home/api/score";
const SOURCE_ID = "official-qlu-national-2021-2025-school-major-admission";
const RAW_REL = "data/admissions/raw/official-national-school-admission-2021-2025-v3309-qlu";
const RAW_DIR = path.join(PROJECT_ROOT, RAW_REL);
const OUTPUT_REL = "data/admissions/official-national-school-admission-2021-2025-v3309-qlu-import.json";
const OUTPUT_PATH = path.join(PROJECT_ROOT, OUTPUT_REL);
const RAW_MANIFEST_REL = `${RAW_REL}/qlu-raw-manifest.json`;
const RAW_MANIFEST_PATH = path.join(PROJECT_ROOT, RAW_MANIFEST_REL);
const YEARS = new Set([2025, 2024, 2023, 2022, 2021]);

const PROVINCES = [
  ["北京", "beijing"], ["天津", "tianjin"], ["河北", "hebei"], ["山西", "shanxi"],
  ["内蒙古", "inner-mongolia"], ["辽宁", "liaoning"], ["吉林", "jilin"], ["黑龙江", "heilongjiang"],
  ["上海", "shanghai"], ["江苏", "jiangsu"], ["浙江", "zhejiang"], ["安徽", "anhui"],
  ["福建", "fujian"], ["江西", "jiangxi"], ["山东", "shandong"], ["河南", "henan"],
  ["湖北", "hubei"], ["湖南", "hunan"], ["广东", "guangdong"], ["广西", "guangxi"],
  ["海南", "hainan"], ["重庆", "chongqing"], ["四川", "sichuan"], ["贵州", "guizhou"],
  ["云南", "yunnan"], ["西藏", "xizang"], ["陕西", "shaanxi"], ["甘肃", "gansu"],
  ["青海", "qinghai"], ["宁夏", "ningxia"], ["新疆", "xinjiang"],
];
const PROVINCE_INDEX = new Map(PROVINCES.map(([province], index) => [province, index]));
const PROVINCE_SLUG = new Map(PROVINCES);
const SPECIAL_RE = /艺术|体育|中外合作|合作办学|地方专项|国家专项|高校专项|专项|菏泽校区|校企合作|综合评价|高水平|预科|定向|少数民族|民族班|内高班|新疆班|西藏班|南疆|单列|征集|对口|单招|飞行技术|军校|警校/;

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

function scaledScore(value) {
  const raw = numberOrNull(value, { integer: true, positive: true });
  if (raw === null) return null;
  return raw / 100;
}

function normalizeSubject(raw) {
  const value = clean(raw);
  if (/物理|理工|理科/.test(value)) return "物理类";
  if (/历史|文史|文科/.test(value)) return "历史类";
  if (/艺术|美术|音乐|舞蹈|书法/.test(value)) return "艺术类";
  if (/体育/.test(value)) return "体育类";
  if (/综合|不分文理/.test(value)) return "综合";
  return value || "未列科类";
}

function parseProvinceIds(html) {
  const block = html.match(/<ul\b[^>]*class=["'][^"']*province-box-ul[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1] || "";
  const result = new Map();
  for (const match of block.matchAll(/<li\b[^>]*data-id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/li>/gi)) {
    const province = clean(match[2].replace(/<[^>]+>/g, " "));
    if (PROVINCE_SLUG.has(province)) result.set(province, clean(match[1]));
  }
  return result;
}

function parseApi(bytes, label) {
  let payload;
  try {
    payload = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${error.message}`);
  }
  if (Number(payload.code) !== 200 || !Array.isArray(payload.data)) {
    throw new Error(`${label} response drifted: ${bytes.toString("utf8").slice(0, 500)}`);
  }
  return payload.data;
}

async function download(url, outputPath, form = null) {
  const tempPath = `${outputPath}.download-${process.pid}`;
  const args = [
    "--fail", "--silent", "--show-error", "--location", "--compressed",
    "--retry", "8", "--retry-all-errors", "--retry-delay", "2",
    "--connect-timeout", "25", "--max-time", "120",
    "--user-agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) gaokao-data-audit/3.309",
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

function buildRecord({ row, province, year, categoryName, typeName, typeId, sourceFile, rowIndex }) {
  const majorName = clean(row.major_name);
  const included = clean(row.majors_included);
  const minScore = scaledScore(row.score_min);
  const averageScore = scaledScore(row.score_avg);
  const maxScore = scaledScore(row.score_max);
  const minRank = numberOrNull(row.admission_num_min, { integer: true, positive: true });
  const controlLine = numberOrNull(row.ctrl_line);
  if (!majorName || minScore === null) return null;

  const subjectRaw = clean(row.category_name || categoryName);
  const sourceType = clean(row.type_name || typeName);
  const subjectType = normalizeSubject(subjectRaw);
  const specialPath = sourceType !== "普通类" || SPECIAL_RE.test([subjectRaw, sourceType, majorName, included].join(" "));
  const rankUnavailable = minRank === null;
  const oldSubjectMapping = /文史|理工|文科|理科/.test(subjectRaw);
  const xizangBoundary = province === "西藏" ? " 官网西藏记录未列A/B类考生类别，不能替代自治区类别核验。" : "";
  const cautions = [
    "本记录来自齐鲁工业大学本科招生网官方历年分数接口，是学校官网单校分专业边界，不是省级考试院全量投档/录取表。",
    specialPath
      ? "该行属于艺体、中外合作、地方专项、菏泽校区或其他限定路径，只在special-path-only层保留；官网分数页未列选科要求，须回当年计划和章程复核。"
      : "普通学校官网单校分数按school-official-only保留，推荐置信度最高只到A-；官网分数页未列选科要求，须回当年计划和章程复核。",
    rankUnavailable
      ? `官网该行未公开最低录取位次，保持rankUnavailable=true，不生成假位次。${xizangBoundary}`
      : `最低录取位次为齐鲁工业大学官网接口直接公开值，仍只代表该校该专业历史边界。${xizangBoundary}`,
  ];
  if (oldSubjectMapping) cautions.push(`官网原科类“${subjectRaw}”为旧高考文理口径，运行层仅映射到${subjectType}用于检索，不能冒充新高考选科要求。`);

  const fingerprint = [province, year, categoryName, typeName, typeId, majorName, included, row.score_min, row.score_avg, row.score_max, row.admission_num_min, row.ctrl_line].join("\u001f");
  const campus = /菏泽校区/.test(sourceType) ? "菏泽校区" : "";
  const record = {
    id: `qlu-${year}-${sha256(fingerprint).slice(0, 18)}`,
    province,
    year,
    city: campus ? "菏泽" : "济南",
    campus,
    schoolCode: "10431",
    schoolName: "齐鲁工业大学",
    schoolTags: ["公办", "理工", "山东省属"],
    dataType: "major-admission",
    educationLevel: "本科",
    subjectType,
    sourceSubjectRaw: subjectRaw,
    subjectMappingNote: oldSubjectMapping ? `旧文理口径${subjectRaw}映射为${subjectType}` : "按官网科类原文归一",
    batch: specialPath ? sourceType : "本科普通类",
    admissionType: specialPath ? "特殊路径录取" : "普通录取",
    admissionSubtype: sourceType,
    formalScoreScope: specialPath ? "special-path-only" : "school-official-only",
    schoolOfficialScope: rankUnavailable ? "single-school-major-score-only" : "single-school-major-score-with-native-min-rank",
    majorName,
    majorGroup: included && included !== "——" ? included : "",
    electiveRequirement: "",
    controlLine,
    minScore,
    averageScore,
    maxScore,
    sourceId: SOURCE_ID,
    sourceQuality: rankUnavailable
      ? "official-school-qlu-2021-2025-national-major-score-only"
      : "official-school-qlu-2021-2025-national-major-score-native-rank",
    sourceUrl: SOURCE_URL,
    sourcePageUrl: SOURCE_URL,
    sourceAdmissionTypeRaw: sourceType,
    sourceMajorGroupRaw: included === "——" ? "" : included,
    sourcePlanTypeRaw: sourceType,
    sourceBatchRaw: "官网未单列批次",
    sourceRemark: included && included !== "——" ? `包含专业：${included}` : "官网未列包含专业",
    sourceFile,
    sourceRowIndex: rowIndex,
    scoreOnly: rankUnavailable,
    rankUnavailable,
    nativeAdmissionRankUnavailable: rankUnavailable,
    rankDerivedFromScore: false,
    rankEvidenceScope: rankUnavailable ? "rank-unavailable" : "school-recorded-min-score-rank",
    scoreMetric: specialPath ? "学校官网特殊路径录取成绩" : "学校分专业录取最低分",
    rankMetric: rankUnavailable ? "官网未公开最低录取位次" : "学校官网表列最低录取位次",
    officialEvidencePath: sourceFile,
    cautions,
  };
  if (minRank !== null) {
    record.minRank = minRank;
    record.minRankStart = minRank;
    record.minRankEnd = minRank;
    record.rankRangeText = String(minRank);
  }
  return record;
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
  const queryTree = [];

  const indexFile = `${RAW_REL}/qlu-score-index.html`;
  const indexBytes = await readOfficial(indexFile, SOURCE_URL, null, useCache);
  const indexHtml = indexBytes.toString("utf8");
  if (!indexHtml.includes("历年分数查询") || !indexHtml.includes("/home/api/score")) throw new Error("QLU score index identity drifted");
  const provinceIds = parseProvinceIds(indexHtml);
  if (provinceIds.size !== 31) throw new Error(`Expected 31 mainland province IDs, received ${provinceIds.size}`);
  rawResponses.push({ kind: "index", path: indexFile, url: SOURCE_URL, bytes: indexBytes.length, sha256: sha256(indexBytes) });

  for (const [province, slug] of PROVINCES) {
    const provinceId = provinceIds.get(province);
    if (!provinceId) throw new Error(`Missing official province ID for ${province}`);
    const provinceNode = { province, provinceId, years: [] };
    queryTree.push(provinceNode);

    const yearsFile = `${RAW_REL}/dict-years-${slug}.json`;
    const yearsForm = { biz_category_id: 2, biz_type: provinceId, biz_code: 0 };
    const yearsBytes = await readOfficial(yearsFile, DICT_URL, yearsForm, useCache);
    const yearNodes = parseApi(yearsBytes, `${province} years`).filter((item) => YEARS.has(Number(item.biz_name)));
    rawResponses.push({ kind: "years", province, path: yearsFile, url: DICT_URL, form: yearsForm, bytes: yearsBytes.length, sha256: sha256(yearsBytes), rows: yearNodes.length });

    for (const yearNode of yearNodes) {
      const year = Number(yearNode.biz_name);
      const yearId = clean(yearNode.id);
      const treeYear = { year, yearId, categories: [] };
      provinceNode.years.push(treeYear);
      const categoriesFile = `${RAW_REL}/dict-categories-${slug}-${year}.json`;
      const categoriesForm = { biz_category_id: 3, biz_type: yearId, biz_code: 0 };
      const categoriesBytes = await readOfficial(categoriesFile, DICT_URL, categoriesForm, useCache);
      const categoryNodes = parseApi(categoriesBytes, `${province} ${year} categories`);
      rawResponses.push({ kind: "categories", province, year, path: categoriesFile, url: DICT_URL, form: categoriesForm, bytes: categoriesBytes.length, sha256: sha256(categoriesBytes), rows: categoryNodes.length });

      for (const categoryNode of categoryNodes) {
        const categoryId = clean(categoryNode.id);
        const categoryName = clean(categoryNode.biz_name);
        const treeCategory = { categoryId, categoryName, types: [] };
        treeYear.categories.push(treeCategory);
        const typesFile = `${RAW_REL}/dict-types-${slug}-${year}-${categoryId}.json`;
        const typesForm = { biz_category_id: 4, biz_type: categoryId, biz_code: 0 };
        const typesBytes = await readOfficial(typesFile, DICT_URL, typesForm, useCache);
        const typeNodes = parseApi(typesBytes, `${province} ${year} ${categoryName} types`);
        rawResponses.push({ kind: "types", province, year, categoryName, path: typesFile, url: DICT_URL, form: typesForm, bytes: typesBytes.length, sha256: sha256(typesBytes), rows: typeNodes.length });

        for (const typeNode of typeNodes) {
          const typeId = clean(typeNode.id);
          const typeName = clean(typeNode.biz_name);
          const scoreFile = `${RAW_REL}/scores-${slug}-${year}-${categoryId}-${typeId}.json`;
          const scoreForm = { type_id: typeId };
          const scoreBytes = await readOfficial(scoreFile, SCORE_URL, scoreForm, useCache);
          const rows = parseApi(scoreBytes, `${province} ${year} ${categoryName} ${typeName} scores`);
          treeCategory.types.push({ typeId, typeName, sourceFile: scoreFile, rows: rows.length });
          rawResponses.push({ kind: "scores", province, year, categoryName, typeName, path: scoreFile, url: SCORE_URL, form: scoreForm, bytes: scoreBytes.length, sha256: sha256(scoreBytes), rows: rows.length });

          for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
            const row = rows[rowIndex];
            if (clean(row.province_name) !== province || clean(row.category_name) !== categoryName || clean(row.type_name) !== typeName) {
              throw new Error(`QLU row identity drifted for ${province} ${year} ${categoryName} ${typeName} row ${rowIndex}`);
            }
            const record = buildRecord({ row, province, year, categoryName, typeName, typeId, sourceFile: scoreFile, rowIndex });
            if (record) records.push(record);
            else skippedRows.push({ province, year, categoryName, typeName, sourceFile: scoreFile, rowIndex, row, reason: "missing-major-or-min-score" });
          }
        }
      }
    }
  }

  records.sort(compareRecords);
  const duplicateIds = records.length - new Set(records.map((record) => record.id)).size;
  if (duplicateIds) throw new Error(`QLU duplicate IDs: ${duplicateIds}`);
  const ordinaryRecords = records.filter((record) => record.formalScoreScope === "school-official-only");
  const specialPathRecords = records.filter((record) => record.formalScoreScope === "special-path-only");
  const nativeRankRecords = records.filter((record) => record.minRankEnd).length;
  const rankUnavailableRecords = records.filter((record) => record.rankUnavailable).length;
  const provincesWithRecords = [...new Set(records.map((record) => record.province))].sort((a, b) => PROVINCE_INDEX.get(a) - PROVINCE_INDEX.get(b));
  const yearsWithRecords = [...new Set(records.map((record) => record.year))].sort((a, b) => b - a);
  const generatedAt = new Date().toISOString();

  const rawManifest = {
    dataset: "official-national-school-admission-2021-2025-v3309-qlu-raw",
    generatedAt,
    sourceUrl: SOURCE_URL,
    api: { dictionary: DICT_URL, scores: SCORE_URL, queryMethod: "POST form hierarchy: province -> year -> category -> type -> scores" },
    queryTree,
    responses: rawResponses,
    totals: {
      files: rawResponses.length,
      bytes: rawResponses.reduce((sum, response) => sum + response.bytes, 0),
      scoreQueries: rawResponses.filter((response) => response.kind === "scores").length,
      sourceRows: rawResponses.filter((response) => response.kind === "scores").reduce((sum, response) => sum + response.rows, 0),
    },
  };
  await fs.writeFile(RAW_MANIFEST_PATH, `${JSON.stringify(rawManifest, null, 2)}\n`);

  const categoryNames = [...new Set(records.map((record) => record.sourceSubjectRaw))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const typeNames = [...new Set(records.map((record) => record.sourcePlanTypeRaw))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const rawFiles = [...rawResponses.map((response) => response.path), RAW_MANIFEST_REL];
  const output = {
    dataset: "official-national-school-admission-2021-2025-v3309-qlu",
    generatedAt,
    scope: { years: yearsWithRecords, provinces: provincesWithRecords, dataType: "major-admission", school: "齐鲁工业大学", sourceLevel: "school-official-only-with-special-path-isolation" },
    sourceNotes: [{
      id: SOURCE_ID,
      title: "齐鲁工业大学2021-2025年全国分省分专业录取分数",
      publisher: "齐鲁工业大学本科招生办公室",
      url: SOURCE_URL,
      quality: "official-school-qlu-2021-2025-national-major-score-and-native-rank",
      usage: "导入学校官方历年分数接口的分省分专业最低分、平均分、最高分、最低录取位次、控制线和包含专业；普通记录按school-official-only，艺体、中外合作、地方专项、菏泽校区等按special-path-only隔离。",
      evidenceBoundary: "single-school major admission score and school-recorded min-score rank; not province-wide closure or admission probability",
      rawDir: RAW_REL,
      rawFiles,
      parsedRecords: records.length,
      nativeAdmissionRankRecords: nativeRankRecords,
      derivedRankRecords: 0,
      rankUnavailableRecords,
      ordinaryRecords: ordinaryRecords.length,
      specialPathRecords: specialPathRecords.length,
      provinceCount: provincesWithRecords.length,
      provincesWithRecords,
      yearsWithRecords,
      categoryNames,
      typeNames,
    }],
    records,
    audit: {
      requestedProvinces: PROVINCES.length,
      rawResponseFiles: rawResponses.length,
      rawBytes: rawManifest.totals.bytes,
      scoreQueries: rawManifest.totals.scoreQueries,
      sourceRows: rawManifest.totals.sourceRows,
      parsedRecords: records.length,
      skippedRows,
      duplicateIds,
      ordinaryRecords: ordinaryRecords.length,
      specialPathRecords: specialPathRecords.length,
      nativeAdmissionRankRecords: nativeRankRecords,
      derivedRankRecords: 0,
      rankUnavailableRecords,
      minScore: Math.min(...records.map((record) => record.minScore)),
      maxScore: Math.max(...records.map((record) => record.maxScore || record.minScore)),
      ordinaryMinScore: Math.min(...ordinaryRecords.map((record) => record.minScore)),
      ordinaryMaxScore: Math.max(...ordinaryRecords.map((record) => record.maxScore || record.minScore)),
      provinceCount: provincesWithRecords.length,
      yearCounts: Object.fromEntries(yearsWithRecords.map((year) => [year, records.filter((record) => record.year === year).length])),
      provinceCounts: Object.fromEntries(provincesWithRecords.map((province) => [province, records.filter((record) => record.province === province).length])),
      provinceYearCounts: Object.fromEntries(provincesWithRecords.map((province) => [province, Object.fromEntries(yearsWithRecords.map((year) => [year, records.filter((record) => record.province === province && record.year === year).length]))])),
      categoryNames,
      typeNames,
    },
    notes: [
      "学校官网单校分数和最低录取位次不替代省级考试院全量投档/录取表。",
      "艺体、中外合作、地方专项、菏泽校区等限定路径不进入普通自动推荐。",
      "官网未公开最低录取位次的记录保持rankUnavailable，不生成假位次。",
      "官网分数接口未列选科要求和录取人数，运行层不补造这些字段，正式填报须回当年计划和招生章程。",
    ],
  };
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({
    status: "ok", output: OUTPUT_REL, rawDir: RAW_REL,
    rawResponseFiles: rawResponses.length, rawBytes: rawManifest.totals.bytes,
    scoreQueries: rawManifest.totals.scoreQueries, sourceRows: rawManifest.totals.sourceRows,
    records: records.length, ordinaryRecords: ordinaryRecords.length, specialPathRecords: specialPathRecords.length,
    nativeAdmissionRankRecords: nativeRankRecords, rankUnavailableRecords,
    provinces: provincesWithRecords.length, years: yearsWithRecords, categories: categoryNames, types: typeNames,
    skippedRows: skippedRows.length, duplicateIds,
  }, null, 2));
}

await main();
