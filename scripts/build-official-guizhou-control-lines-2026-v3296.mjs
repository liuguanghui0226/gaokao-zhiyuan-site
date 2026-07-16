#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const GENERATED_AT = "2026-07-16T15:30:00.000Z";
const SOURCE_ID = "official-guizhou-control-lines-2026";
const CHSI_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293847640.html";
const ORIGINAL_WECHAT_URL = "https://mp.weixin.qq.com/s/nKVg7jaelGMXD2NrAKEDAQ";
const TONGREN_URL = "https://www.tongren.gov.cn/2026/0626/349877.shtml";
const TONGREN_IMAGE_URL = "https://upload.tongren.gov.cn/2026/0626/1782441098295.jpg";
const CHINANEWS_URL = "https://www.gz.chinanews.com.cn/jjgz/2026-06-25/doc-ihfftkrx9678346.shtml";
const RANK_SOURCE_ID = "official-guizhou-rank-2026";
const RANK_PAGE_URL = "https://zsksy.guizhou.gov.cn/zlxz/202606/t20260625_90556851.html";
const RANK_HISTORY_URL = "https://zsksy.guizhou.gov.cn/zlxz/202606/P020260625601945966806.pdf";
const RANK_PHYSICS_URL = "https://zsksy.guizhou.gov.cn/zlxz/202606/P020260625601945906859.pdf";
const RANK_HISTORY_MIRROR_URL = "https://www.jhgk.cn/upload/file/20260625/1782391200436011607.pdf";
const RANK_PHYSICS_MIRROR_URL = "https://www.jhgk.cn/upload/file/20260625/1782391176947090104.pdf";
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/guizhou-2026");
const OUTPUT_FILE = path.join(PROJECT_ROOT, "data/admissions/official-guizhou-control-lines-2026-import.json");

const EXPECTED = {
  officialWechatBlockedPage: { file: "official-wechat-control-lines.html", bytes: 18165, sha256: "2a9a2424eccd3c1b0e5b0e4b0ea58150020e9741409ff7a9f6d3abeab98a6e90" },
  chsiControlPage: { file: "chsi-control-lines.html", bytes: 45328, sha256: "f120e3eb02405ef70242b8936438bd8e8a24a2607ea26c4674aedfb675e7d4c6" },
  chinaNewsControlPage: { file: "chinanews-control-lines.html", bytes: 53754, sha256: "8226481d69def8df3e625227a8095ef027a40597a6dbc55186263c32dfc913b9" },
  tongrenGovernmentPage: { file: "tongren-government-control-lines.html", bytes: 29082, sha256: "3970e4b82573636e4195fdcf006c9adf58ab72e908f029bcbe7e477313a4f2c0" },
  tongrenGovernmentImage: { file: "tongren-government-official-content-mirror.jpg", bytes: 279718, width: 550, height: 2305, sha256: "803941857c6ba11d75791d157f1710d2b7d5855791ed188b86b79970dfad339f" },
  rankHistoryIdenticalMirror: { file: "rank-history-identical-mirror.pdf", bytes: 310144, pages: 3, sha256: "0b8cf4360336c19442eab70355617624ca87d9f4f40a65b99346ff8fb798d183" },
  rankPhysicsIdenticalMirror: { file: "rank-physics-identical-mirror.pdf", bytes: 455692, pages: 3, sha256: "361ae84119880307acff21018f96cd06d1c530859bf4ad6fee41f1e07099f9c4" },
};

const ORDINARY_ROWS = [
  { subjectType: "物理类", section: "本科", minScore: 393, route: "ordinary-bachelor" },
  { subjectType: "物理类", section: "高职（专科）", minScore: 200, route: "ordinary-vocational" },
  { subjectType: "历史类", section: "本科", minScore: 439, route: "ordinary-bachelor" },
  { subjectType: "历史类", section: "高职（专科）", minScore: 200, route: "ordinary-vocational" },
];

const SPECIAL_ROWS = [
  { subjectType: "物理类", section: "特殊类型", category: "特殊类型录取资格线", minScore: 494, route: "special" },
  { subjectType: "历史类", section: "特殊类型", category: "特殊类型录取资格线", minScore: 503, route: "special" },
];

const ART_ROWS = [
  ["播音与主持类", 334, 373],
  ["表（导）演类（戏剧影视导演）", 334, 373],
  ["美术与设计类", 314, 351],
  ["书法类", 314, 351],
  ["音乐类", 294, 329],
  ["表（导）演类（戏剧影视表演）", 294, 329],
  ["表（导）演类（服装表演）", 294, 329],
  ["舞蹈类", 275, 307],
];

const SPORTS_ROWS = [
  { subjectType: "物理类", section: "本科", category: "体育类", minScore: 325, route: "sports" },
  { subjectType: "历史类", section: "本科", category: "体育类", minScore: 351, route: "sports" },
  { subjectType: "物理类", section: "高职（专科）", category: "体育类", minScore: 180, route: "sports" },
  { subjectType: "历史类", section: "高职（专科）", category: "体育类", minScore: 180, route: "sports" },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function jpegDimensions(buffer) {
  assert(buffer[0] === 0xff && buffer[1] === 0xd8, "Expected JPEG evidence");
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    const length = buffer.readUInt16BE(offset + 2);
    assert(length >= 2, "Invalid JPEG segment");
    offset += 2 + length;
  }
  throw new Error("Could not read JPEG dimensions");
}

function verifyFile(expected) {
  const file = path.join(RAW_DIR, expected.file);
  const bytes = fs.readFileSync(file);
  assert(bytes.byteLength === expected.bytes, `${expected.file} byte count drifted: ${bytes.byteLength}`);
  assert(sha256(bytes) === expected.sha256, `${expected.file} SHA-256 drifted`);
  if (expected.width) {
    const dimensions = jpegDimensions(bytes);
    assert(dimensions.width === expected.width && dimensions.height === expected.height, `${expected.file} dimensions drifted`);
  }
  if (expected.file.endsWith(".pdf")) assert(bytes.subarray(0, 5).toString("ascii") === "%PDF-", `${expected.file} is not a PDF`);
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
  return `2026-guizhou-control-${sha256([
    row.subjectType,
    row.section,
    row.category,
    row.minScore,
    row.route,
  ].join("|")).slice(0, 18)}`;
}

function makeRecord(row) {
  const ordinary = row.route.startsWith("ordinary-");
  const artsSports = ["art", "sports"].includes(row.route);
  const bilingual = row.route === "minority-language-oral";
  const category = row.category || "普通类";
  const batch = ordinary
    ? `普通类${row.section}录取控制分数线`
    : row.route === "special"
      ? `${row.subjectType}特殊类型录取资格线`
      : bilingual
        ? "民汉双语专业民族语言口语测试成绩资格线"
        : `${category}${row.subjectType}${row.section}文化录取控制线`;
  const cautions = ordinary ? [
    "这是贵州省2026年普通类对应首选科目本科或高职专科录取控制分数线，只用于判断基本资格边界。",
    "物理类本科393分、历史类本科439分；普通高职专科两科均为200分，必须按首选科目和批次判断。",
    "控制线不是院校专业组投档线、院校录取线、专业录取最低分或最低位次，不能单独生成录取概率。",
  ] : artsSports ? [
    `这是贵州省2026年${category}${row.subjectType}${row.section}文化录取控制线，只适用于对应艺体类别考生。`,
    "官方控制线页面未给出本记录对应的专业统考数值；考生还必须达到相应专业成绩要求，不得把文化线当成专业线。",
    "该边界不是具体院校或专业投档线，还须核对专业合格线、综合成绩算法、招生章程和选科要求。",
  ] : bilingual ? [
    "这是贵州省2026年民汉双语专业民族语言口语测试成绩资格线，只适用于具备相应报考资格的考生。",
    "97.70分是民族语言口语测试口径，不是750分制普通高考总分，不能进入普通物理类或历史类资格路由。",
    "达到口语资格线不等于获得院校或专业录取资格，仍须满足文化成绩、招生计划和其他报考条件。",
  ] : [
    "这是贵州省2026年特殊类型录取资格线，不替代普通类本科控制分数线。",
    "达到资格线不等于获得院校或专业录取资格，专项条件、体检政审、校测或招生章程要求须另行满足。",
    "本记录保持 special-path-only，不进入普通类院校推荐概率计算。",
  ];
  return {
    id: recordId(row),
    province: "贵州",
    year: 2026,
    subjectType: row.subjectType,
    batch,
    schoolName: "贵州省2026年高考录取控制分数线",
    schoolTags: ["贵州官方内容镜像控制线", ordinary ? "普通类" : "特殊路径", category, row.section],
    city: "贵州",
    dataType: "control-line",
    majorName: batch,
    majorGroup: category,
    candidateCategory: bilingual ? "民汉双语专业" : undefined,
    minScore: row.minScore,
    cultureScoreLine: bilingual ? undefined : row.minScore,
    professionalQualification: artsSports ? "专业成绩达到贵州省相应类别统考、联考或校考要求" : undefined,
    scoreDimension: artsSports ? "culture-and-qualification" : bilingual ? "oral-test-score" : "total-score",
    scoreBasis: artsSports ? "culture-score" : bilingual ? "minority-language-oral-test" : "gaokao-total",
    scoreMaximum: bilingual ? 100 : 750,
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: "official-content-mirror-guizhou-chsi-government-image-and-chinanews-verified",
    sourceUrl: CHSI_URL,
    formalScoreScope: ordinary ? "control-line-only" : "special-path-only",
    controlLineRouteKind: row.route,
    controlLineKind: batch,
    controlLineSection: row.section,
    cautions,
    sourceFile: "data/admissions/raw/guizhou-2026/chsi-control-lines.html",
    sourcePublishedAt: "2026-06-25",
  };
}

const evidence = Object.fromEntries(Object.entries(EXPECTED).map(([key, expected]) => [key, verifyFile(expected)]));
const wechatHtml = fs.readFileSync(path.join(RAW_DIR, evidence.officialWechatBlockedPage.file));
const chsiText = visibleHtmlText(fs.readFileSync(path.join(RAW_DIR, evidence.chsiControlPage.file)));
const chinaNewsText = visibleHtmlText(fs.readFileSync(path.join(RAW_DIR, evidence.chinaNewsControlPage.file)));
const tongrenHtml = fs.readFileSync(path.join(RAW_DIR, evidence.tongrenGovernmentPage.file));
const tongrenText = visibleHtmlText(tongrenHtml);
assert(visibleHtmlText(wechatHtml).includes("环境异常"), "Official WeChat retrieval boundary changed");
assert(wechatHtml.toString("utf8").includes(ORIGINAL_WECHAT_URL), "Official WeChat target URL is missing");
for (const phrase of [
  "贵州省2026年高考录取控制分数线划定",
  "来源：贵州省招生考试院",
  "特殊类型录取资格线：494分",
  "本科录取控制分数线：393分",
  "高职（专科）录取控制分数线：200分",
  "特殊类型录取资格线：503分",
  "本科录取控制分数线：439分",
  "播音与主持类、表（导）演类（戏剧影视导演）334分",
  "艺术类高职（专科）统一控制线：180分",
  "民汉双语专业民族语言口语测试成绩资格线：97.70分",
]) assert(chsiText.includes(phrase), `CHSI control page is missing: ${phrase}`);
for (const phrase of [
  "普通类首选物理类，特殊类型录取资格线：494分；本科录取控制分数线：393分；高职（专科）录取控制分数线：200分",
  "普通类首选历史类，特殊类型录取资格线：503分；本科录取控制分数线：439分；高职（专科）录取控制分数线：200分",
  "体育类首选物理类本科录取控制线：325分；首选历史类本科录取控制线：351分；体育类高职（专科）统一控制线：180分",
  "民汉双语专业民族语言口语测试成绩资格线：97.70分",
]) assert(chinaNewsText.includes(phrase), `China News control page is missing: ${phrase}`);
assert(tongrenText.includes("来源：贵州省考试招生院"), "Tongren government source label is missing");
assert(tongrenHtml.toString("utf8").includes(TONGREN_IMAGE_URL), "Tongren government image URL is missing");

const records = [
  ...ORDINARY_ROWS.map((row) => makeRecord({ ...row, category: "普通类" })),
  ...SPECIAL_ROWS.map(makeRecord),
  ...ART_ROWS.flatMap(([category, physicsScore, historyScore]) => [
    makeRecord({ subjectType: "物理类", section: "本科", category, minScore: physicsScore, route: "art" }),
    makeRecord({ subjectType: "历史类", section: "本科", category, minScore: historyScore, route: "art" }),
  ]),
  makeRecord({ subjectType: "物理类", section: "高职（专科）", category: "艺术类", minScore: 180, route: "art" }),
  makeRecord({ subjectType: "历史类", section: "高职（专科）", category: "艺术类", minScore: 180, route: "art" }),
  ...SPORTS_ROWS.map(makeRecord),
  makeRecord({ subjectType: "民汉双语", section: "口语测试", category: "民汉双语专业", minScore: 97.70, route: "minority-language-oral" }),
];

assert(records.length === 29, `Expected 29 records, got ${records.length}`);
assert(new Set(records.map((record) => record.id)).size === records.length, "Duplicate record ids detected");
assert(records.filter((record) => record.formalScoreScope === "control-line-only").length === 4, "Expected four ordinary records");
assert(records.filter((record) => record.formalScoreScope === "special-path-only").length === 25, "Expected 25 special-path records");
assert(records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 0, "Guizhou source must not invent professional score lines");
assert(records.filter((record) => ["art", "sports"].includes(record.controlLineRouteKind)).every((record) => record.professionalQualification), "Art/sports records need professional qualification cautions");

const payload = {
  dataset: "official-guizhou-control-lines-2026-import",
  generatedAt: GENERATED_AT,
  scope: { province: "贵州", year: 2026, sourceKind: "official-content-mirror-control-lines" },
  notes: [
    "贵州2026普通类物理本科393分、专科200分，历史本科439分、专科200分进入普通资格路由。",
    "特殊类型2条、艺术18条、体育4条和民汉双语口语1条共25条保持 special-path-only。",
    "艺体页面仅公开文化控制线，22条艺体记录保留专业资格要求但不生成任何假专业分。",
    "贵州招生考试院微信公众号本轮返回环境验证页，考试院独立站TLS连接失败；控制线使用阳光高考完整转载、铜仁政府来源原图和中新网文字交叉核验，明确标注 official-content-mirror。",
    "既有1201条贵州2026官方一分一段记录不改分数和位次，本轮只补齐历史/物理对应考试院PDF URL；两份同字节镜像与既有官方PDF哈希一致。",
  ],
  sourceNotes: [{
    id: SOURCE_ID,
    province: "贵州",
    title: "贵州省2026年高考录取控制分数线划定",
    publisher: "贵州省招生考试院（阳光高考正式转载；铜仁政府原图与中新网交叉核验）",
    publishedAt: "2026-06-25",
    url: CHSI_URL,
    originalOfficialUrl: ORIGINAL_WECHAT_URL,
    relatedUrls: [TONGREN_URL, TONGREN_IMAGE_URL, CHINANEWS_URL, RANK_PAGE_URL, RANK_HISTORY_URL, RANK_PHYSICS_URL, RANK_HISTORY_MIRROR_URL, RANK_PHYSICS_MIRROR_URL],
    quality: "official-content-mirror-guizhou-chsi-government-image-and-chinanews-verified",
    usage: "抽取贵州2026普通类、特殊类型、艺术、体育和民汉双语口语控制线29条；仅4条普通类本专科记录参与普通考生资格路由。",
    parsedRecords: records.length,
    scoreMaximum: 750,
    originalWechatRetrievalStatus: "blocked-by-environment-verification",
    officialRankSiteRedownloadStatus: "blocked-current-session-tls",
    evidence,
    manualVisualVerification: {
      verifiedAt: "2026-07-16",
      finding: "铜仁政府转载原图清晰展示普通、艺术、体育和民汉双语口语全部控制线；逐项数值与阳光高考及中新网正文一致。",
    },
    rankEvidence: {
      sourceId: RANK_SOURCE_ID,
      records: 1201,
      historyUrl: RANK_HISTORY_URL,
      physicsUrl: RANK_PHYSICS_URL,
      historyIdenticalMirrorUrl: RANK_HISTORY_MIRROR_URL,
      physicsIdenticalMirrorUrl: RANK_PHYSICS_MIRROR_URL,
      valueChanges: 0,
      controlBoundaryCrossCheck: {
        history: { vocationalScore: 200, vocationalRankEnd: 83144, bachelorScore: 439, bachelorRankEnd: 37867, specialScore: 503, specialRankEnd: 15657 },
        physics: { vocationalScore: 200, vocationalRankEnd: 212055, bachelorScore: 393, bachelorRankEnd: 158893, specialScore: 494, specialRankEnd: 66184 },
      },
    },
    evidenceBoundary: "control-line-only=4; special-path-only=25; art/sports culture lines=22 with professional qualification but no invented professional score; rank rows=1201 official PDF URL inventory retained and values unchanged; control source is official-content-mirror; not institution-group, institution or major admission score",
  }],
  records,
  diagnostics: {
    recordCount: records.length,
    ordinaryRecords: 4,
    specialPathRecords: 25,
    artSportsCultureRecords: 22,
    professionalNumericRecords: 0,
    routeCounts: { "ordinary-bachelor": 2, "ordinary-vocational": 2, special: 2, art: 18, sports: 4, "minority-language-oral": 1 },
    ordinaryBoundaries: { historyBachelor: 439, historyVocational: 200, physicsBachelor: 393, physicsVocational: 200 },
    rankRecords: 1201,
    rankValueChanges: 0,
    scoreMaximum: 750,
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
