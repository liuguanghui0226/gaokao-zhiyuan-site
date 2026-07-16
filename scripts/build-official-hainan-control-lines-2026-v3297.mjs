#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const GENERATED_AT = "2026-07-16T15:30:00.000Z";
const SOURCE_ID = "official-hainan-control-lines-2026";
const RANK_SOURCE_ID = "official-hainan-rank-2026";
const OFFICIAL_URL = "https://ea.hainan.gov.cn/ywdt/ptgkyjszsb/202606/t20260625_4099246.html";
const OFFICIAL_RANK_PAGE_URL = "https://ea.hainan.gov.cn/ywdt/ptgkyjszsb/202606/t20260625_4099593.html";
const OFFICIAL_RANK_PDF_URL = "https://ea.hainan.gov.cn/ywdt/ptgkyjszsb/202606/P020260625627884748040.pdf";
const CHSI_CONTROL_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293847183.html";
const CHSI_CONTROL_IMAGE_URL = "https://t1.chei.com.cn/news/img/2293847184.png";
const CHSI_IMPLEMENTATION_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202605/20260529/2293505726-11.html";
const CHSI_RANK_INDEX_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202607/20260701/2293870259.html";
const CHSI_RANK_PDF_URL = "https://t2.chei.com.cn/news/getfile/2293870260-2293870259-e90d3230a81f15767e6d961f6271460f.pdf";
const CHINANEWS_URL = "https://www.chinanews.com/edu/2026/06-25/10646983.shtml";
const HAINAN_DAILY_URL = "https://news.hndaily.cn/resfile/2026-06-26/005/hnrb20260626005.pdf";
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/hainan-2026");
const RELEASE_DIR = path.join(PROJECT_ROOT, "site/data/release-v3.275");
const OUTPUT_FILE = path.join(PROJECT_ROOT, "data/admissions/official-hainan-control-lines-2026-import.json");

const EXPECTED = {
  chsiControlPage: { file: "chsi-control-lines.html", bytes: 44307, sha256: "35463062b661b401f9d5934c6fac8d8bdf6d038c7cda6f57105b59a7794abd0f" },
  chsiControlImage: { file: "chsi-control-lines.png", bytes: 185168, width: 706, height: 790, sha256: "55be6fdf1034569e3961b5d7ec1573ae5b7a79a96280825977ad2be6c20db5eb" },
  chinaNewsControlPage: { file: "chinanews-control-lines.html", bytes: 79472, sha256: "be3b4bc872626e8b21da02fd332956b8788fb47c668cf1a3d9b27e65544315ba" },
  chsiImplementationRules: { file: "chsi-implementation-rules-art-vocational.html", bytes: 47214, sha256: "9bb3075f7bf7e1acbfcf346253ea755dc76cc3218b983f468b11316f9f78fdd7" },
  chsiRankIndex: { file: "chsi-rank-index.html", bytes: 47506, sha256: "f3538a212e755891d4b8d94f1f572ba91dc89ef914027cd7c48fcb899a2fa318" },
  chsiRankOrdinaryPdf: { file: "chsi-rank-ordinary.pdf", bytes: 134849, pages: 20, sha256: "9ee71c71ebd8c6a1641b2465fd5eff21707a9fd42306d04b219ea2aa8bca062c" },
  hainanDailyControlCrossCheck: { file: "hainan-daily-control-crosscheck.pdf", bytes: 1167182, pages: 1, sha256: "d0ee7079e98b012292896bb04aa75a18ceac12e0826b93beac35c5898196b5f7" },
};

const ART_ROWS = [
  ["舞蹈学类", 383],
  ["音乐表演类（声乐）", 383],
  ["音乐表演类（器乐）", 383],
  ["服装表演类", 383],
  ["戏剧影视导演类", 383],
  ["戏剧影视表演类", 383],
  ["美术与设计类", 407],
  ["书法类", 407],
  ["音乐教育类", 407],
  ["播音与主持类", 407],
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function pngDimensions(buffer) {
  assert(buffer.subarray(1, 4).toString("ascii") === "PNG", "Expected PNG evidence");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function pdfPages(file) {
  const result = spawnSync("pdfinfo", [file], { encoding: "utf8" });
  assert(result.status === 0, `pdfinfo failed for ${path.basename(file)}: ${result.stderr}`);
  const match = result.stdout.match(/^Pages:\s+(\d+)/m);
  assert(match, `Could not read PDF page count for ${path.basename(file)}`);
  return Number(match[1]);
}

function pdfText(file) {
  const result = spawnSync("pdftotext", ["-layout", file, "-"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  assert(result.status === 0, `pdftotext failed for ${path.basename(file)}: ${result.stderr}`);
  return result.stdout;
}

function verifyFile(expected) {
  const file = path.join(RAW_DIR, expected.file);
  const bytes = fs.readFileSync(file);
  assert(bytes.byteLength === expected.bytes, `${expected.file} byte count drifted: ${bytes.byteLength}`);
  assert(sha256(bytes) === expected.sha256, `${expected.file} SHA-256 drifted`);
  if (expected.width) {
    const dimensions = pngDimensions(bytes);
    assert(dimensions.width === expected.width && dimensions.height === expected.height, `${expected.file} dimensions drifted`);
  }
  if (expected.pages) {
    assert(bytes.subarray(0, 5).toString("ascii") === "%PDF-", `${expected.file} is not a PDF`);
    assert(pdfPages(file) === expected.pages, `${expected.file} page count drifted`);
  }
  return { ...expected };
}

function visibleHtmlText(buffer) {
  return buffer.toString("utf8")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, "")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, "");
}

function recordId(row) {
  return `2026-hainan-control-${sha256([
    row.subjectType,
    row.section,
    row.category,
    row.minScore,
    row.professionalMinScore,
    row.route,
  ].join("|")).slice(0, 18)}`;
}

function makeRecord(row) {
  const ordinary = row.route === "ordinary-bachelor";
  const art = row.route === "art";
  const sports = row.route === "sports";
  const category = row.category || "普通类";
  const batch = ordinary
    ? "本科批（普通类）录取最低控制分数线"
    : row.route === "national-special"
      ? "国家专项计划（普通类）录取最低控制分数线"
      : row.route === "special"
        ? "部分特殊类型招生投档最低控制分数线"
        : sports
          ? "本科体育类录取最低控制分数线"
          : `本科艺术类（${category}）文化课成绩录取最低控制分数线`;
  const cautions = ordinary ? [
    "这是海南省2026年本科批普通类录取最低控制分数线，只用于判断普通本科基本资格边界。",
    "海南普通高考使用900分投档成绩口径；专科批次实行先报志愿再划线，本轮不得用往年专科线或高职分类考试线补造普通专科线。",
    "控制线不是院校专业组投档线、院校录取线、专业录取最低分或最低位次，不能单独生成录取概率。",
  ] : sports ? [
    "这是海南省2026年本科体育类文化成绩和专业成绩双重控制线，只适用于体育类考生。",
    "文化成绩421分和专业成绩75分是两个独立门槛，不得相加，也不得用普通类位次直接解释专业成绩。",
    "该边界不是具体院校专业组投档线，仍须核对综合成绩、招生章程、体检和选科要求。",
  ] : art ? [
    `这是海南省2026年本科艺术类${category}文化课成绩录取最低控制分数线，只适用于对应艺术类别考生。`,
    "官方控制线图没有给出该类别专业统考数值；考生还必须达到相应专业成绩要求，不得把文化线当成专业线。",
    "该记录保持 special-path-only，不进入普通本科资格线或普通录取概率计算。",
  ] : [
    `这是海南省2026年${batch}，属于专项或特殊类型路径，不替代本科批普通类479分控制线。`,
    "达到该线不等于获得院校或专业录取资格，专项报名条件、校测、体检政审和招生章程要求须另行满足。",
    "本记录保持 special-path-only，不进入普通类院校推荐概率计算。",
  ];
  return {
    id: recordId(row),
    province: "海南",
    year: 2026,
    subjectType: "综合",
    batch,
    schoolName: "海南省2026年普通高校招生本科各批次录取最低控制分数线",
    schoolTags: ["海南官方内容镜像控制线", ordinary ? "普通类" : "特殊路径", category, row.section],
    city: "海南",
    dataType: "control-line",
    majorName: batch,
    majorGroup: category,
    minScore: row.minScore,
    cultureScoreLine: row.minScore,
    professionalMinScore: row.professionalMinScore,
    professionalScoreMaximum: sports ? 100 : undefined,
    professionalQualification: art ? "专业成绩达到海南省相应艺术类别统考、联考或校考要求" : undefined,
    scoreDimension: sports ? "culture-and-professional" : art ? "culture-and-qualification" : "total-score",
    scoreBasis: ordinary || ["national-special", "special"].includes(row.route) ? "gaokao-total" : "culture-score",
    scoreMaximum: 900,
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: "official-content-mirror-hainan-chsi-official-image-and-hainan-daily-text-verified",
    sourceUrl: CHSI_CONTROL_URL,
    formalScoreScope: ordinary ? "control-line-only" : "special-path-only",
    controlLineRouteKind: row.route,
    controlLineKind: batch,
    controlLineSection: row.section,
    cautions,
    sourceFile: "data/admissions/raw/hainan-2026/chsi-control-lines.png",
    sourcePublishedAt: "2026-06-25",
  };
}

function parseAndVerifyRankPdf() {
  const file = path.join(RAW_DIR, EXPECTED.chsiRankOrdinaryPdf.file);
  const text = pdfText(file);
  const top = text.match(/800分及以上\s*111人/);
  assert(top, "Hainan rank PDF top bucket drifted");
  const parsedExact = [...text.matchAll(/^\s*(\d{3})\s+(\d+)\s+(\d+)/gm)]
    .map((match) => ({ score: Number(match[1]), same: Number(match[2]), cumulative: Number(match[3]) }));
  assert(parsedExact.length === 546, `Expected 546 exact Hainan rank rows, got ${parsedExact.length}`);
  assert(parsedExact[0].score === 799 && parsedExact[0].same === 3 && parsedExact[0].cumulative === 114, "Hainan rank PDF first exact row drifted");
  assert(parsedExact.at(-1).score === 254 && parsedExact.at(-1).same === 6 && parsedExact.at(-1).cumulative === 70398, "Hainan rank PDF final row drifted");
  assert(new Set(parsedExact.map((row) => row.score)).size === parsedExact.length, "Hainan rank PDF contains duplicate scores");

  const shard = readGzipJson(path.join(RELEASE_DIR, "hainan.json.gz"));
  const runtimeRows = shard.rankConversions.filter((row) => row.year === 2026 && row.sourceId === RANK_SOURCE_ID);
  assert(runtimeRows.length === 547, `Expected 547 runtime Hainan rank rows, got ${runtimeRows.length}`);
  const allUnlinked = runtimeRows.every((row) => !row.sourceUrl);
  const allLinked = runtimeRows.every((row) => row.sourceUrl === OFFICIAL_RANK_PDF_URL);
  assert(allUnlinked || allLinked, "Hainan rank source URLs are partially applied or point to an unexpected URL");
  const topRuntime = runtimeRows.find((row) => row.score === 800);
  assert(topRuntime?.scoreRange?.min === 800 && topRuntime?.scoreRange?.max === 900 && topRuntime.rankStart === 1 && topRuntime.rankEnd === 111 && topRuntime.sameRankScore === 111, "Hainan runtime top bucket drifted");
  const byScore = new Map(runtimeRows.map((row) => [row.score, row]));
  let priorCumulative = 111;
  for (const parsed of parsedExact) {
    const runtime = byScore.get(parsed.score);
    assert(runtime, `Missing runtime Hainan rank row at ${parsed.score}`);
    assert(runtime.rankStart === priorCumulative + 1, `Hainan rankStart drifted at ${parsed.score}`);
    assert(runtime.rankEnd === parsed.cumulative, `Hainan rankEnd drifted at ${parsed.score}`);
    assert(runtime.sameRankScore === parsed.same, `Hainan same-score count drifted at ${parsed.score}`);
    priorCumulative = parsed.cumulative;
  }
  return {
    runtimeRows,
    diagnostics: {
      rowsCompared: runtimeRows.length,
      exactRows: parsedExact.length,
      topBucketRows: 1,
      finalCumulative: priorCumulative,
      valueDifferences: 0,
      rankRowsNeedingSourceUrlOnV3296Base: 547,
    },
  };
}

const evidence = Object.fromEntries(Object.entries(EXPECTED).map(([key, expected]) => [key, verifyFile(expected)]));
const chsiControlHtml = fs.readFileSync(path.join(RAW_DIR, evidence.chsiControlPage.file));
const chinaNewsText = visibleHtmlText(fs.readFileSync(path.join(RAW_DIR, evidence.chinaNewsControlPage.file)));
const implementationText = visibleHtmlText(fs.readFileSync(path.join(RAW_DIR, evidence.chsiImplementationRules.file)));
const rankIndexHtml = fs.readFileSync(path.join(RAW_DIR, evidence.chsiRankIndex.file)).toString("utf8");
const dailyText = pdfText(path.join(RAW_DIR, evidence.hainanDailyControlCrossCheck.file)).replace(/\s+/g, "");
assert(chsiControlHtml.toString("utf8").includes("海南：2026年普通高校招生本科各批次录取最低控制分数线公告"), "CHSI control title is missing");
assert(chsiControlHtml.toString("utf8").includes("来源：海南省考试局"), "CHSI control source label is missing");
assert(chsiControlHtml.toString("utf8").includes(CHSI_CONTROL_IMAGE_URL), "CHSI control image URL is missing");
assert(chinaNewsText.includes("据海南省考试局网站消息"), "China News official-site attribution is missing");
assert(implementationText.includes("专科批次实行先报志愿再划线"), "Hainan pending vocational policy is missing");
assert(implementationText.includes("舞蹈学类、音乐表演类（声乐）、音乐表演类（器乐）、服装表演类、戏剧影视导演类、戏剧影视表演类高考文化课成绩录取最低控制分数线不低于本科普通类录取最低控制分数线的80%"), "Hainan 80% art policy drifted");
assert(implementationText.includes("美术与设计类、书法类、音乐教育类、播音与主持类高考文化课成绩录取最低控制分数线不低于普通类本科录取最低控制分数线的85%"), "Hainan 85% art policy drifted");
assert(rankIndexHtml.includes(CHSI_RANK_PDF_URL), "CHSI Hainan ordinary rank PDF link is missing");
for (const phrase of [
  "本科批普通类分数线479分",
  "数线为568分",
  "为421分、专业成绩分数线为75",
  "为383分",
  "文化课成绩分数线为407",
  "实行先填报志愿后再划定分数线",
]) assert(dailyText.includes(phrase), `Hainan Daily cross-check is missing: ${phrase}`);

const rankVerification = parseAndVerifyRankPdf();
const records = [
  makeRecord({ section: "本科", category: "普通类", minScore: 479, route: "ordinary-bachelor" }),
  makeRecord({ section: "本科", category: "国家专项计划（普通类）", minScore: 479, route: "national-special" }),
  makeRecord({ section: "本科", category: "部分特殊类型招生", minScore: 568, route: "special" }),
  makeRecord({ section: "本科", category: "体育类", minScore: 421, professionalMinScore: 75, route: "sports" }),
  ...ART_ROWS.map(([category, minScore]) => makeRecord({ section: "本科", category, minScore, route: "art" })),
];

assert(records.length === 14, `Expected 14 Hainan records, got ${records.length}`);
assert(new Set(records.map((record) => record.id)).size === records.length, "Duplicate Hainan record ids detected");
assert(records.filter((record) => record.formalScoreScope === "control-line-only").length === 1, "Expected one ordinary Hainan record");
assert(records.filter((record) => record.formalScoreScope === "special-path-only").length === 13, "Expected 13 Hainan special-path records");
assert(records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 1, "Expected one numeric Hainan sports professional threshold");
assert(records.filter((record) => record.professionalQualification).length === 10, "Expected ten Hainan art professional-qualification rows");
assert(records.every((record) => record.scoreMaximum === 900), "Every Hainan control row must use the 900-point score scale");

const payload = {
  dataset: "official-hainan-control-lines-2026-import",
  generatedAt: GENERATED_AT,
  scope: { province: "海南", year: 2026, sourceKind: "official-content-mirror-control-lines" },
  notes: [
    "海南2026本科批普通类479分进入普通本科资格路由；普通专科批实行先报志愿再划线，保持待官方发布，不使用往年线或高职分类考试线补造。",
    "国家专项479分、部分特殊类型568分、本科体育文化421分/专业75分和10个本科艺术类别文化线共13条保持 special-path-only。",
    "海南采用900分投档成绩口径；体育文化分与专业分分字段保存，艺术专业数值未在控制线图公布，10条艺术记录只保留专业合格要求。",
    "海南考试局原站当前TLS连接失败；控制线使用阳光高考正式转载的海南考试局原图，并由海南日报文字版和中新网 attribution 交叉核验，明确标注 official-content-mirror。",
    "阳光高考转载的20页普通类位次PDF重新解析547行，与运行层547条海南2026位次逐行零差异；本轮只补考试局正式PDF URL。",
  ],
  sourceNotes: [{
    id: SOURCE_ID,
    province: "海南",
    title: "2026年海南省普通高校招生本科各批次录取最低控制分数线公告",
    publisher: "海南省考试局（阳光高考正式转载；海南日报与中新网交叉核验）",
    publishedAt: "2026-06-25",
    url: CHSI_CONTROL_URL,
    originalOfficialUrl: OFFICIAL_URL,
    relatedUrls: [CHSI_CONTROL_IMAGE_URL, CHSI_IMPLEMENTATION_URL, CHINANEWS_URL, HAINAN_DAILY_URL, OFFICIAL_RANK_PAGE_URL, OFFICIAL_RANK_PDF_URL, CHSI_RANK_INDEX_URL, CHSI_RANK_PDF_URL],
    quality: "official-content-mirror-hainan-chsi-official-image-and-hainan-daily-text-verified",
    usage: "抽取海南2026本科普通类、国家专项、特殊类型、体育和艺术控制线14条；仅本科普通类479分参与普通考生资格路由。",
    parsedRecords: records.length,
    scoreMaximum: 900,
    directOfficialRetrievalStatus: "blocked-current-session-tls",
    ordinaryVocationalStatus: "pending-official-release",
    ordinaryVocationalReason: "海南2026实施办法明确专科批次实行先报志愿再划线；截至本轮只有本科各批次控制线，不使用往年普通专科线或高职分类招生线替代。",
    evidence,
    manualVisualVerification: {
      verifiedAt: "2026-07-16",
      finding: "阳光高考转载的海南省考试局原图清晰显示普通本科479、国家专项479、特殊类型568、体育文化421/专业75、六类艺术383和四类艺术407；与海南日报文字版一致。",
    },
    rankEvidence: {
      sourceId: RANK_SOURCE_ID,
      records: 547,
      officialPageUrl: OFFICIAL_RANK_PAGE_URL,
      officialPdfUrl: OFFICIAL_RANK_PDF_URL,
      chsiMirrorPageUrl: CHSI_RANK_INDEX_URL,
      chsiMirrorPdfUrl: CHSI_RANK_PDF_URL,
      mirrorPdfSha256: evidence.chsiRankOrdinaryPdf.sha256,
      fullRowCrossCheck: rankVerification.diagnostics,
      valueChanges: 0,
      controlBoundaryCrossCheck: {
        ordinaryBachelor: { score: 479, rankEnd: 45098 },
        specialType: { score: 568, rankEnd: 19715 },
        sportsCulture: { score: 421, rankEnd: 58664 },
        artCultureLower: { score: 383, rankEnd: 64360 },
        artCultureUpper: { score: 407, rankEnd: 61050 },
        topBucket: { scoreRange: { min: 800, max: 900 }, rankEnd: 111 },
      },
    },
    evidenceBoundary: "control-line-only=1; special-path-only=13; ordinary vocational=pending after filing; Hainan scoreMaximum=900; sports culture/professional thresholds remain separate; art professional numeric thresholds not invented; 547 rank rows full-cross-checked and values unchanged; not institution-group, institution or major admission score",
  }],
  records,
  diagnostics: {
    recordCount: records.length,
    ordinaryRecords: 1,
    specialPathRecords: 13,
    artRecords: 10,
    artProfessionalQualificationRecords: 10,
    sportsRecords: 1,
    professionalNumericRecords: 1,
    ordinaryVocationalStatus: "pending-official-release",
    routeCounts: { "ordinary-bachelor": 1, "national-special": 1, special: 1, sports: 1, art: 10 },
    ordinaryBoundaries: { comprehensiveBachelor: 479, comprehensiveVocational: null },
    rankRecords: 547,
    rankRowsFullCrossChecked: 547,
    rankValueChanges: 0,
    scoreMaximum: 900,
  },
};

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: "ok",
  out: path.relative(PROJECT_ROOT, OUTPUT_FILE),
  diagnostics: payload.diagnostics,
  evidence,
}, null, 2));
