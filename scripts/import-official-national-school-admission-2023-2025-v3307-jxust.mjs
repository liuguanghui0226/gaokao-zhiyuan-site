import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_URL = "https://zs.jxust.edu.cn/zsxx/lnfs.htm";
const SOURCE_ID = "official-jxust-national-2023-2025-school-major-admission";
const RAW_REL = "data/admissions/raw/official-national-school-admission-2023-2025-v3307-jxust";
const RAW_DIR = path.join(PROJECT_ROOT, RAW_REL);
const OUTPUT_REL = "data/admissions/official-national-school-admission-2023-2025-v3307-jxust-import.json";
const OUTPUT_PATH = path.join(PROJECT_ROOT, OUTPUT_REL);
const PAGE_REL = `${RAW_REL}/jxust-score-query.html`;
const PAGE_PATH = path.join(PROJECT_ROOT, PAGE_REL);
const ROWS_REL = `${RAW_REL}/jxust-embedded-major-records.json`;
const ROWS_PATH = path.join(PROJECT_ROOT, ROWS_REL);
const RAW_MANIFEST_REL = `${RAW_REL}/jxust-raw-manifest.json`;
const RAW_MANIFEST_PATH = path.join(PROJECT_ROOT, RAW_MANIFEST_REL);

const MAINLAND_PROVINCES = [
  "北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "上海", "江苏", "浙江",
  "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "广西", "海南", "重庆", "四川",
  "贵州", "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆",
];
const SPECIAL_RE = /艺术|体育|预科|专项|定向|征集|中外合作|合作办学|联合培养|南单|对口|飞行技术|高水平|高收费|民族班|内高班|港澳台|军校|警校/;

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function numberOrNull(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "/" || text === "-") return null;
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function integerOrNull(value) {
  const number = numberOrNull(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

function normalizeSubject(raw) {
  const value = String(raw || "").trim();
  if (/物理/.test(value) || /^理工/.test(value)) return "物理类";
  if (/历史/.test(value) || /^文史/.test(value)) return "历史类";
  if (/综合/.test(value)) return "综合";
  if (/艺术/.test(value)) return "艺术类";
  if (/体育/.test(value)) return "体育类";
  return value || "未列科类";
}

function isSpecialPath(row) {
  if (String(row.zslx || "").trim() !== "普通类") return true;
  return SPECIAL_RE.test([
    row.cc, row.kl, row.zslx, row.pc, row.zyz_tddw, row.zymc,
  ].map((value) => String(value || "")).join(" "));
}

function compareRecords(a, b) {
  return MAINLAND_PROVINCES.indexOf(a.province) - MAINLAND_PROVINCES.indexOf(b.province)
    || b.year - a.year
    || a.subjectType.localeCompare(b.subjectType, "zh-CN")
    || a.batch.localeCompare(b.batch, "zh-CN")
    || a.majorName.localeCompare(b.majorName, "zh-CN")
    || a.id.localeCompare(b.id);
}

function downloadWithCurl(url, outputPath) {
  const result = spawnSync("curl", [
    "--fail", "--silent", "--show-error", "--location",
    "--retry", "5", "--retry-all-errors", "--retry-delay", "2",
    "--user-agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) gaokao-data-audit/3.307",
    url, "-o", outputPath,
  ], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`curl failed for ${url}: ${result.stderr || result.stdout}`);
}

function parseEmbeddedRows(html) {
  const match = html.match(/var\s+year_listObject\d+\s*=\s*(\[.*?\]);\s*\r?\n/s);
  if (!match) throw new Error("Official embedded major-record array was not found");
  const rows = JSON.parse(match[1]);
  if (!Array.isArray(rows) || rows.length < 2500) throw new Error(`Unexpected official row count: ${rows?.length}`);
  return rows;
}

function buildRecord(row) {
  const sourceRecordId = integerOrNull(row._id);
  const province = String(row.sf || "").trim();
  const year = integerOrNull(row.lqnf);
  const minScore = numberOrNull(row.lqzdf);
  const averageScore = numberOrNull(row.lqpjf);
  const maxScore = numberOrNull(row.lqzgf);
  const admittedCount = integerOrNull(row.lqrs);
  const minRank = integerOrNull(row.zdfwc);
  const maxScoreRank = integerOrNull(row.zgfwc);
  const majorName = String(row.zymc || "").trim();
  const sourceSubjectRaw = String(row.kl || "").trim();
  const batch = String(row.pc || "").trim();
  const sourceAdmissionType = String(row.zslx || "").trim();
  const majorGroup = String(row.zyz_tddw || "").trim();
  const educationLevel = String(row.cc || "本科").trim();
  const collegeName = String(row.xy || "").trim();

  if (!sourceRecordId || !MAINLAND_PROVINCES.includes(province) || !year || !minScore || !majorName) return null;

  const specialPath = isSpecialPath(row);
  const rankUnavailable = minRank === null;
  const subjectType = normalizeSubject(sourceSubjectRaw);
  const oldSubjectMapping = /^(理工|文史)(类)?$/.test(sourceSubjectRaw);
  const cautions = [
    "本记录来自江西理工大学本科招生信息网官方历年分数页，是学校官网单校分专业边界，不是省级考试院全量投档/录取表。",
    specialPath
      ? "该行属于艺体、预科、专项、定向、征集、中外合作等限定路径，只在special-path-only层保留，不进入普通自动推荐。"
      : "普通学校官网单校分数按school-official-only保留，推荐置信度最高只到A-。",
    rankUnavailable
      ? "官网该行未公开最低分位次，保持rankUnavailable=true，不生成假位次。"
      : "最低分位次为江西理工大学官网表格直接公开值，仍只代表该校该专业历史边界。",
  ];
  if (oldSubjectMapping) cautions.push(`官网原科类“${sourceSubjectRaw}”为旧高考文理口径，运行层仅映射到${subjectType}用于检索，不能冒充新高考选科要求。`);
  if (province === "西藏") cautions.push("官网西藏行未列A/B类考生类别，不能据此替代西藏类别核验或自治区省级正式录取表。");

  const record = {
    id: `jxust-${year}-${sourceRecordId}`,
    province,
    year,
    city: "赣州",
    schoolCode: "10407",
    schoolName: "江西理工大学",
    schoolTags: ["公办", "理工", "江西省属"],
    dataType: "major-admission",
    educationLevel,
    subjectType,
    sourceSubjectRaw,
    subjectMappingNote: oldSubjectMapping ? `旧文理口径${sourceSubjectRaw}映射为${subjectType}` : "按官网科类原文归一",
    batch,
    admissionType: specialPath ? "特殊路径录取" : "普通录取",
    admissionSubtype: sourceAdmissionType || batch,
    formalScoreScope: specialPath ? "special-path-only" : "school-official-only",
    schoolOfficialScope: rankUnavailable ? "single-school-major-score-only" : "single-school-major-score-with-native-min-rank",
    majorName,
    majorGroup,
    electiveRequirement: majorGroup,
    collegeName,
    minScore,
    averageScore,
    maxScore,
    admittedCount,
    sourceId: SOURCE_ID,
    sourceQuality: rankUnavailable
      ? "official-school-jxust-2023-2025-national-major-score-only"
      : "official-school-jxust-2023-2025-national-major-score-native-rank",
    sourceUrl: SOURCE_URL,
    sourcePageUrl: SOURCE_URL,
    sourceMajorRaw: String(row.zymc || ""),
    sourceBatchRaw: String(row.pc || ""),
    sourceAdmissionTypeRaw: String(row.zslx || ""),
    sourceMajorGroupRaw: String(row.zyz_tddw || ""),
    sourceMinScoreRaw: String(row.lqzdf || ""),
    sourceRankRaw: String(row.zdfwc || ""),
    sourceMaxRankRaw: String(row.zgfwc || ""),
    sourceRecordId: String(sourceRecordId),
    scoreOnly: rankUnavailable,
    rankUnavailable,
    nativeAdmissionRankUnavailable: rankUnavailable,
    rankDerivedFromScore: false,
    rankEvidenceScope: rankUnavailable ? "rank-unavailable" : "school-recorded-min-score-rank",
    scoreMetric: "学校分专业录取最低分",
    rankMetric: rankUnavailable ? "官网未公开最低分位次" : "学校官网表列最低分位次",
    officialEvidencePath: PAGE_REL,
    cautions,
  };
  if (minRank !== null) {
    record.minRank = minRank;
    record.minRankStart = minRank;
    record.minRankEnd = minRank;
    record.rankRangeText = String(minRank);
  }
  if (maxScoreRank !== null) record.maxScoreRank = maxScoreRank;
  return record;
}

async function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/mac_2T/")) throw new Error("Refusing to run from /Volumes/mac_2T; use internal APFS staging.");
  await fs.mkdir(RAW_DIR, { recursive: true });
  const useCache = process.argv.includes("--use-cache") && await fs.stat(PAGE_PATH).then(() => true, () => false);
  if (!useCache) downloadWithCurl(SOURCE_URL, PAGE_PATH);

  const pageBuffer = await fs.readFile(PAGE_PATH);
  const html = pageBuffer.toString("utf8");
  const sourceRows = parseEmbeddedRows(html);
  await fs.writeFile(ROWS_PATH, `${JSON.stringify(sourceRows, null, 2)}\n`);

  const records = [];
  const skippedRows = [];
  for (const row of sourceRows) {
    const record = buildRecord(row);
    if (record) records.push(record);
    else skippedRows.push({
      sourceRecordId: String(row._id || ""),
      province: String(row.sf || ""),
      year: String(row.lqnf || ""),
      majorName: String(row.zymc || ""),
      reason: row.sf === "港澳台" ? "non-mainland-route" : "missing-required-field",
    });
  }
  records.sort(compareRecords);

  const duplicateIds = records.length - new Set(records.map((record) => record.id)).size;
  const ordinaryRecords = records.filter((record) => record.formalScoreScope === "school-official-only");
  const specialPathRecords = records.filter((record) => record.formalScoreScope === "special-path-only");
  const nativeRankRecords = records.filter((record) => record.minRankEnd).length;
  const rankUnavailableRecords = records.filter((record) => record.rankUnavailable).length;
  const provinces = [...new Set(records.map((record) => record.province))].sort((a, b) => MAINLAND_PROVINCES.indexOf(a) - MAINLAND_PROVINCES.indexOf(b));
  const years = [...new Set(records.map((record) => record.year))].sort((a, b) => b - a);

  const rawManifest = {
    dataset: "official-national-school-admission-2023-2025-v3307-jxust-raw",
    generatedAt: new Date().toISOString(),
    sourceUrl: SOURCE_URL,
    page: { path: PAGE_REL, bytes: pageBuffer.length, sha256: sha256(pageBuffer) },
    embeddedRows: { path: ROWS_REL, rows: sourceRows.length },
  };
  await fs.writeFile(RAW_MANIFEST_PATH, `${JSON.stringify(rawManifest, null, 2)}\n`);

  const rawFiles = [PAGE_REL, ROWS_REL, RAW_MANIFEST_REL];
  const output = {
    dataset: "official-national-school-admission-2023-2025-v3307-jxust",
    generatedAt: new Date().toISOString(),
    scope: {
      years,
      provinces,
      dataType: "major-admission",
      school: "江西理工大学",
      sourceLevel: "school-official-only-with-special-path-isolation",
    },
    sourceNotes: [{
      id: SOURCE_ID,
      title: "江西理工大学2023-2025年全国分省分专业录取分数",
      publisher: "江西理工大学本科招生办公室",
      url: SOURCE_URL,
      quality: "official-school-jxust-2023-2025-national-major-score-and-native-rank",
      usage: "导入学校官方历年分数页内嵌的分省分专业最低分、平均分、最高分、录取人数和官网表列最低分位次；普通记录按school-official-only，艺体、预科、专项、定向、征集、中外合作等按special-path-only隔离。",
      evidenceBoundary: "single-school major admission score and school-recorded min-score rank; not province-wide closure or admission probability",
      rawDir: RAW_REL,
      rawFiles,
      parsedRecords: records.length,
      nativeAdmissionRankRecords: nativeRankRecords,
      derivedRankRecords: 0,
      rankUnavailableRecords,
      ordinaryRecords: ordinaryRecords.length,
      specialPathRecords: specialPathRecords.length,
      provinceCount: provinces.length,
      provincesWithRecords: provinces,
      yearsWithRecords: years,
    }],
    records,
    audit: {
      sourceRows: sourceRows.length,
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
      provinceCount: provinces.length,
      yearCounts: Object.fromEntries(years.map((year) => [year, records.filter((record) => record.year === year).length])),
      provinceCounts: Object.fromEntries(provinces.map((province) => [province, records.filter((record) => record.province === province).length])),
    },
    notes: [
      "学校官网单校分数和最低分位次不替代省级考试院全量投档/录取表。",
      "艺体、预科、专项、定向、征集、中外合作等限定路径不进入普通自动推荐。",
      "官网未公开最低分位次的记录保持rankUnavailable，不生成假位次。",
      "港澳台联合招生不属于内地31省普通高考运行口径，仅进入skippedRows审计。",
    ],
  };
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({
    status: "ok",
    output: OUTPUT_REL,
    rawDir: RAW_REL,
    sourceRows: sourceRows.length,
    records: records.length,
    ordinaryRecords: ordinaryRecords.length,
    specialPathRecords: specialPathRecords.length,
    nativeAdmissionRankRecords: nativeRankRecords,
    rankUnavailableRecords,
    provinces: provinces.length,
    years,
    skippedRows: skippedRows.length,
    duplicateIds,
  }, null, 2));
}

await main();
