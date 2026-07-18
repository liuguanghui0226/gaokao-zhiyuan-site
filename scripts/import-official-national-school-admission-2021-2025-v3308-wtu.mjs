#!/usr/bin/env node

import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_URL = "https://zsb.wtu.edu.cn/cx/fsx.jsp";
const SOURCE_ID = "official-wtu-national-2021-2025-school-major-admission";
const RAW_REL = "data/admissions/raw/official-national-school-admission-2021-2025-v3308-wtu";
const RAW_DIR = path.join(PROJECT_ROOT, RAW_REL);
const OUTPUT_REL = "data/admissions/official-national-school-admission-2021-2025-v3308-wtu-import.json";
const OUTPUT_PATH = path.join(PROJECT_ROOT, OUTPUT_REL);
const RAW_MANIFEST_REL = `${RAW_REL}/wtu-raw-manifest.json`;
const RAW_MANIFEST_PATH = path.join(PROJECT_ROOT, RAW_MANIFEST_REL);
const YEARS = [2025, 2024, 2023, 2022, 2021];

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
const SPECIAL_RE = /艺术|艺文|艺理|体育|国家专项|地方专项|高校专项|专项|中外合作|合作办学|预科|定向|民族班|少数民族|内高班|新疆班|西藏班|南疆|单列|高水平|征集|对口|单招|飞行技术|军校|警校/;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasSelectedOption(html, value) {
  const escaped = escapeRegExp(value);
  return new RegExp(`<option\\b(?=[^>]*\\bvalue=["']${escaped}["'])(?=[^>]*\\bselected\\b)[^>]*>`, "i").test(html);
}

function decodeHtml(value) {
  const named = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ensp: " ", emsp: " ",
  };
  return String(value || "")
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_, number) => String.fromCodePoint(Number.parseInt(number, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function cleanCell(value) {
  return decodeHtml(String(value || "")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/[\u00a0\u3000]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTableRows(html) {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const rows = [];
  for (const rowMatch of withoutComments.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cellMatch) => cleanCell(cellMatch[1]));
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function numberOrNull(value, { integer = false, positive = false } = {}) {
  const text = String(value ?? "").trim().replace(/,/g, "");
  if (!text || /^(--|—|-|\/|无)$/.test(text)) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || (integer && !Number.isInteger(number)) || (positive && number <= 0)) return null;
  return number;
}

function normalizeSubject(raw) {
  const value = String(raw || "").trim();
  if (/物理|理工|理科/.test(value)) return "物理类";
  if (/历史|文史|文科/.test(value)) return "历史类";
  if (/综合/.test(value)) return "综合";
  if (/艺术|艺文|艺理/.test(value)) return "艺术类";
  if (/体育/.test(value)) return "体育类";
  return value || "未列科类";
}

function isSpecialPath({ subjectRaw, planType, batch, majorName, remark }) {
  if (String(planType || "").trim() !== "普通类") return true;
  return SPECIAL_RE.test([subjectRaw, planType, batch, majorName, remark].join(" "));
}

function parseMajorRow(cells, province, requestedYear, sourceFile, rowIndex) {
  if (cells.length !== 15 || !/^20\d{2}$/.test(cells[0])) return null;
  const year = numberOrNull(cells[0], { integer: true, positive: true });
  const majorName = cells[1];
  const subjectRaw = cells[2];
  const planType = cells[3];
  const batch = cells[4];
  const admittedCount = numberOrNull(cells[5], { integer: true, positive: true });
  const controlLine = numberOrNull(cells[6]);
  const minScore = numberOrNull(cells[7], { positive: true });
  const minRank = numberOrNull(cells[8], { integer: true, positive: true });
  const averageScore = numberOrNull(cells[9]);
  const maxScore = numberOrNull(cells[10]);
  const minScoreDifference = numberOrNull(cells[11]);
  const averageScoreDifference = numberOrNull(cells[12]);
  const maxScoreDifference = numberOrNull(cells[13]);
  const remark = cells[14];
  if (year !== requestedYear || !majorName || !subjectRaw || !batch || minScore === null) return null;

  const subjectType = normalizeSubject(subjectRaw);
  const specialPath = isSpecialPath({ subjectRaw, planType, batch, majorName, remark });
  const rankUnavailable = minRank === null;
  const oldSubjectMapping = /文史|理工|文科|理科/.test(subjectRaw);
  const cautions = [
    "本记录来自武汉纺织大学本科招生信息网官方历年录取分数查询，是学校官网单校分专业边界，不是省级考试院全量投档/录取表。",
    specialPath
      ? "该行属于专项、艺体、中外合作、预科、定向或其他限定路径，只在special-path-only层保留，不进入普通自动推荐。"
      : "普通学校官网单校分数按school-official-only保留，推荐置信度最高只到A-。",
    rankUnavailable
      ? "官网该行未公开最低位次，保持rankUnavailable=true，不生成假位次。"
      : "最低位次为武汉纺织大学官网表格直接公开值，仍只代表该校该专业历史边界。",
  ];
  if (oldSubjectMapping) cautions.push(`官网原科类“${subjectRaw}”为旧高考文理口径，运行层仅映射到${subjectType}用于检索，不能冒充新高考选科要求。`);
  if (province === "西藏") cautions.push("官网西藏行未列A/B类考生类别，不能据此替代西藏类别核验或自治区省级正式录取表。" );

  const fingerprint = [province, year, ...cells].join("\u001f");
  const record = {
    id: `wtu-${year}-${sha256(fingerprint).slice(0, 18)}`,
    province,
    year,
    city: "武汉",
    schoolCode: "10495",
    schoolName: "武汉纺织大学",
    schoolTags: ["公办", "理工", "湖北省属"],
    dataType: "major-admission",
    educationLevel: "本科",
    subjectType,
    sourceSubjectRaw: subjectRaw,
    subjectMappingNote: oldSubjectMapping ? `旧文理口径${subjectRaw}映射为${subjectType}` : "按官网科类原文归一",
    batch,
    admissionType: specialPath ? "特殊路径录取" : "普通录取",
    admissionSubtype: planType || batch,
    formalScoreScope: specialPath ? "special-path-only" : "school-official-only",
    schoolOfficialScope: rankUnavailable ? "single-school-major-score-only" : "single-school-major-score-with-native-min-rank",
    majorName,
    electiveRequirement: /必选|选考/.test(remark) ? remark : "",
    admittedCount,
    controlLine,
    minScore,
    averageScore,
    maxScore,
    minScoreDifference,
    averageScoreDifference,
    maxScoreDifference,
    sourceId: SOURCE_ID,
    sourceQuality: rankUnavailable
      ? "official-school-wtu-2021-2025-national-major-score-only"
      : "official-school-wtu-2021-2025-national-major-score-native-rank",
    sourceUrl: SOURCE_URL,
    sourcePageUrl: SOURCE_URL,
    sourcePlanTypeRaw: planType,
    sourceBatchRaw: batch,
    sourceRemark: remark,
    sourceFile,
    sourceRowIndex: rowIndex,
    scoreOnly: rankUnavailable,
    rankUnavailable,
    nativeAdmissionRankUnavailable: rankUnavailable,
    rankDerivedFromScore: false,
    rankEvidenceScope: rankUnavailable ? "rank-unavailable" : "school-recorded-min-score-rank",
    scoreMetric: specialPath ? "学校官网特殊路径录取成绩" : "学校分专业录取最低分",
    rankMetric: rankUnavailable ? "官网未公开最低位次" : "学校官网表列最低位次",
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

function parseSummaryRow(cells, requestedProvince, requestedYear) {
  if (cells.length !== 16 || cells[0] !== requestedProvince || !/^20\d{2}$/.test(cells[1])) return null;
  const year = numberOrNull(cells[1], { integer: true, positive: true });
  if (year !== requestedYear) return null;
  return {
    province: cells[0],
    year,
    subjectRaw: cells[2],
    educationLevel: cells[3],
    planType: cells[4],
    batch: cells[5],
    admittedCount: numberOrNull(cells[6], { integer: true, positive: true }),
    controlLine: numberOrNull(cells[7]),
    minScore: numberOrNull(cells[8], { positive: true }),
    minRank: numberOrNull(cells[9], { integer: true, positive: true }),
    averageScore: numberOrNull(cells[10]),
    maxScore: numberOrNull(cells[11]),
    remark: cells[15],
  };
}

function summaryKey(row) {
  return [cleanCell(row.subjectRaw), row.planType, row.batch, cleanCell(row.remark)].join("\u001f");
}

function compareRecords(left, right) {
  return PROVINCE_INDEX.get(left.province) - PROVINCE_INDEX.get(right.province)
    || right.year - left.year
    || left.subjectType.localeCompare(right.subjectType, "zh-CN")
    || left.batch.localeCompare(right.batch, "zh-CN")
    || left.majorName.localeCompare(right.majorName, "zh-CN")
    || left.id.localeCompare(right.id);
}

async function downloadPage(year, province, outputPath) {
  const tempPath = `${outputPath}.download-${process.pid}`;
  const result = spawnSync("curl", [
    "--fail", "--silent", "--show-error", "--location",
    "--retry", "8", "--retry-all-errors", "--retry-delay", "2",
    "--connect-timeout", "25", "--max-time", "120",
    "--user-agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) gaokao-data-audit/3.308",
    "--data-urlencode", `nd=${year}`,
    "--data-urlencode", `sf=${province}`,
    "--data-urlencode", "kl=",
    "--data-urlencode", "jhlx=",
    "--data-urlencode", "zy=",
    SOURCE_URL, "-o", tempPath,
  ], { encoding: "utf8" });
  if (result.status !== 0) {
    await fs.rm(tempPath, { force: true });
    throw new Error(`curl failed for ${province} ${year}: ${result.stderr || result.stdout}`);
  }
  await fs.rename(tempPath, outputPath);
}

async function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/mac_2T/")) throw new Error("Refusing to run from /Volumes/mac_2T; use internal APFS staging.");
  const useCache = process.argv.includes("--use-cache");
  await fs.mkdir(RAW_DIR, { recursive: true });
  const records = [];
  const pages = [];
  const summaryMismatches = [];
  const skippedRows = [];

  for (const year of YEARS) {
    for (const [province, slug] of PROVINCES) {
      const sourceFile = `${RAW_REL}/wtu-${year}-${slug}.html`;
      const outputPath = path.join(PROJECT_ROOT, sourceFile);
      const exists = await fs.stat(outputPath).then(() => true, () => false);
      if (!useCache || !exists) await downloadPage(year, province, outputPath);
      const bytes = await fs.readFile(outputPath);
      const html = bytes.toString("utf8");
      if (!html.includes("武汉纺织大学历年录取分数线查询") || !hasSelectedOption(html, province) || !hasSelectedOption(html, year)) {
        throw new Error(`Official response identity drifted for ${province} ${year}`);
      }

      const tableRows = parseTableRows(html);
      const pageRecords = [];
      const summaries = [];
      for (let rowIndex = 0; rowIndex < tableRows.length; rowIndex += 1) {
        const cells = tableRows[rowIndex];
        const major = parseMajorRow(cells, province, year, sourceFile, rowIndex);
        if (major) pageRecords.push(major);
        else {
          const summary = parseSummaryRow(cells, province, year);
          if (summary) summaries.push(summary);
          else if ((cells.length === 15 && /^20\d{2}$/.test(cells[0])) || (cells.length === 16 && cells[0] === province)) {
            skippedRows.push({ province, year, rowIndex, cells, reason: "row-missing-required-field" });
          }
        }
      }

      const majorCounts = new Map();
      for (const record of pageRecords) {
        const key = summaryKey({
          subjectRaw: record.sourceSubjectRaw,
          planType: record.sourcePlanTypeRaw,
          batch: record.batch,
          remark: record.sourceRemark,
        });
        majorCounts.set(key, (majorCounts.get(key) || 0) + Number(record.admittedCount || 0));
      }
      for (const summary of summaries) {
        const majorAdmitted = majorCounts.get(summaryKey(summary)) || 0;
        if (summary.admittedCount !== null && majorAdmitted !== summary.admittedCount) {
          summaryMismatches.push({ province, year, subjectRaw: summary.subjectRaw, planType: summary.planType, batch: summary.batch, summaryAdmitted: summary.admittedCount, majorAdmitted });
        }
      }

      records.push(...pageRecords);
      pages.push({
        province,
        year,
        path: sourceFile,
        url: SOURCE_URL,
        bytes: bytes.length,
        sha256: sha256(bytes),
        majorRows: pageRecords.length,
        summaryRows: summaries.length,
      });
    }
  }

  records.sort(compareRecords);
  const duplicateIds = records.length - new Set(records.map((record) => record.id)).size;
  const ordinaryRecords = records.filter((record) => record.formalScoreScope === "school-official-only");
  const specialPathRecords = records.filter((record) => record.formalScoreScope === "special-path-only");
  const nativeRankRecords = records.filter((record) => record.minRankEnd).length;
  const rankUnavailableRecords = records.filter((record) => record.rankUnavailable).length;
  const provincesWithRecords = [...new Set(records.map((record) => record.province))].sort((a, b) => PROVINCE_INDEX.get(a) - PROVINCE_INDEX.get(b));
  const yearsWithRecords = [...new Set(records.map((record) => record.year))].sort((a, b) => b - a);
  if (duplicateIds) throw new Error(`WTU duplicate IDs: ${duplicateIds}`);

  const rawManifest = {
    dataset: "official-national-school-admission-2021-2025-v3308-wtu-raw",
    generatedAt: new Date().toISOString(),
    sourceUrl: SOURCE_URL,
    queryMethod: "POST form: nd, sf, kl, jhlx, zy",
    pages,
    totals: {
      pages: pages.length,
      bytes: pages.reduce((sum, page) => sum + page.bytes, 0),
      majorRows: pages.reduce((sum, page) => sum + page.majorRows, 0),
      summaryRows: pages.reduce((sum, page) => sum + page.summaryRows, 0),
    },
  };
  await fs.writeFile(RAW_MANIFEST_PATH, `${JSON.stringify(rawManifest, null, 2)}\n`);

  const rawFiles = [...pages.map((page) => page.path), RAW_MANIFEST_REL];
  const output = {
    dataset: "official-national-school-admission-2021-2025-v3308-wtu",
    generatedAt: new Date().toISOString(),
    scope: {
      years: yearsWithRecords,
      provinces: provincesWithRecords,
      dataType: "major-admission",
      school: "武汉纺织大学",
      sourceLevel: "school-official-only-with-special-path-isolation",
    },
    sourceNotes: [{
      id: SOURCE_ID,
      title: "武汉纺织大学2021-2025年全国分省分专业录取分数",
      publisher: "武汉纺织大学本科招生办公室",
      url: SOURCE_URL,
      quality: "official-school-wtu-2021-2025-national-major-score-and-native-rank",
      usage: "导入学校官方历年分数查询的分省分专业录取人数、省线、最低分、最低位次、平均分、最高分和备注；普通记录按school-official-only，专项、艺体、中外合作、预科、定向等按special-path-only隔离。",
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
    }],
    records,
    audit: {
      requestedPages: YEARS.length * PROVINCES.length,
      fetchedPages: pages.length,
      rawBytes: rawManifest.totals.bytes,
      sourceMajorRows: rawManifest.totals.majorRows,
      sourceSummaryRows: rawManifest.totals.summaryRows,
      parsedRecords: records.length,
      skippedRows,
      duplicateIds,
      summaryMismatches,
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
      pageCounts: Object.fromEntries(PROVINCES.map(([province]) => [province, pages.filter((page) => page.province === province && page.majorRows > 0).length])),
    },
    notes: [
      "学校官网单校分数和最低位次不替代省级考试院全量投档/录取表。",
      "专项、艺体、中外合作、预科、定向等限定路径不进入普通自动推荐。",
      "官网未公开最低位次的记录保持rankUnavailable，不生成假位次。",
      "专业行按同科类、计划类型和批次与官网汇总录取人数交叉校验，差异保存在summaryMismatches。",
    ],
  };
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({
    status: "ok",
    output: OUTPUT_REL,
    rawDir: RAW_REL,
    pages: pages.length,
    rawBytes: rawManifest.totals.bytes,
    records: records.length,
    ordinaryRecords: ordinaryRecords.length,
    specialPathRecords: specialPathRecords.length,
    nativeAdmissionRankRecords: nativeRankRecords,
    rankUnavailableRecords,
    provinces: provincesWithRecords.length,
    years: yearsWithRecords,
    skippedRows: skippedRows.length,
    summaryMismatches: summaryMismatches.length,
    duplicateIds,
  }, null, 2));
}

await main();
