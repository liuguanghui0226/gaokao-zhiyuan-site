#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const GENERATED_AT = "2026-07-16T18:45:00.000Z";
const SOURCE_ID = "official-liaoning-control-lines-2026";
const RANK_SOURCE_ID = "official-liaoning-rank-2026";
const CONTROL_URL = "https://jyt.ln.gov.cn/jyt/jyzx/jyyw/2026063013492555300/index.shtml";
const CHSI_CONTROL_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293845433.html";
const RANK_INDEX_URL = "https://jyt.ln.gov.cn/jyt/jyzx/jyyw/2026063014014729932/index.shtml";
const CHSI_RANK_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293847495.html";
const ORIGINAL_RANK_PAGE_URL = "https://www.lnzsks.com/newsinfo/IMS_20260624_46117_xCuXJ7lN6W.htm";
const RANK_HISTORY_URL = "https://www.lnzsks.com/lnzkbfiles/2026/lns2026gkcjtjb0624clhptlw02.pdf";
const RANK_PHYSICS_URL = "https://www.lnzsks.com/lnzkbfiles/2026/lns2026gkcjtjb0624clhptll01.pdf";
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/liaoning-2026");
const RELEASE_DIR = path.join(PROJECT_ROOT, "site/data/release-v3.275");
const OUTPUT_FILE = path.join(PROJECT_ROOT, "data/admissions/official-liaoning-control-lines-2026-import.json");

const EXPECTED = {
  governmentControlPage: { file: "official-government-control-lines.html", bytes: 40803, sha256: "78342d9274cee339f8fc25252f9de9bb745c93d8a96565553c360df1ce9cfd45" },
  governmentRankIndex: { file: "official-government-rank-index.html", bytes: 37631, sha256: "3dcb7f67183aa319696596cb99dead220bbb58187a10a1303eed278ab932cac4" },
  chsiControlPage: { file: "chsi-control-lines.html", bytes: 46105, sha256: "80c539ebaef02e2c09bc177910179bc8d72fa7cfe8b393237d8e6d27e1ba570d" },
  chsiRankIndex: { file: "chsi-rank-index.html", bytes: 46212, sha256: "01a89ee35cf85f4f35a8ea60e58757e40bc40853c050d2927c708bed6a79420e" },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function visibleHtmlText(buffer) {
  return buffer.toString("utf8")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;|&ensp;|&emsp;/gi, "")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, "");
}

function verifyFile(expected) {
  const file = path.join(RAW_DIR, expected.file);
  const bytes = fs.readFileSync(file);
  assert(bytes.byteLength === expected.bytes, `${expected.file} byte count drifted: ${bytes.byteLength}`);
  assert(sha256(bytes) === expected.sha256, `${expected.file} SHA-256 drifted`);
  return { ...expected };
}

function rankUrlForSubject(subjectType) {
  if (subjectType === "历史类") return RANK_HISTORY_URL;
  if (subjectType === "物理类") return RANK_PHYSICS_URL;
  throw new Error(`Unexpected Liaoning rank subject: ${subjectType}`);
}

function verifyRankInventory() {
  const shard = readGzipJson(path.join(RELEASE_DIR, "liaoning.json.gz"));
  const core = readGzipJson(path.join(RELEASE_DIR, "knowledge-core.json.gz"));
  const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === RANK_SOURCE_ID);
  assert(sourceNote?.parsedRecords === 1076, "Liaoning rank source inventory drifted");
  assert(sourceNote.url === ORIGINAL_RANK_PAGE_URL, "Liaoning rank source URL drifted");
  assert(sourceNote.quality === "official-liaoning-rank-conversion-pdf", "Liaoning rank quality drifted");
  assert(sourceNote.attachmentUrls?.includes(RANK_HISTORY_URL) && sourceNote.attachmentUrls?.includes(RANK_PHYSICS_URL), "Liaoning rank PDF URLs drifted");
  const diagnostics = [];
  for (const spec of [
    { subjectType: "历史类", rows: 518, scoreMin: 150, scoreMax: 672, topRank: 12, finalRank: 52453, url: RANK_HISTORY_URL, omittedScoreGaps: 3 },
    { subjectType: "物理类", rows: 558, scoreMin: 150, scoreMax: 708, topRank: 10, finalRank: 141691, url: RANK_PHYSICS_URL, omittedScoreGaps: 1 },
  ]) {
    const rows = shard.rankConversions.filter((row) => row.year === 2026 && row.sourceId === RANK_SOURCE_ID && row.subjectType === spec.subjectType);
    assert(rows.length === spec.rows, `${spec.subjectType} rank row count drifted`);
    assert(rows[0].score === spec.scoreMax && rows[0].scoreRange?.min === spec.scoreMax && rows[0].scoreRange?.max === 750 && rows[0].rankEnd === spec.topRank, `${spec.subjectType} top bucket drifted`);
    assert(rows.at(-1).score === spec.scoreMin && rows.at(-1).rankEnd === spec.finalRank, `${spec.subjectType} final row drifted`);
    const allUnlinked = rows.every((row) => !row.sourceUrl);
    const allLinked = rows.every((row) => row.sourceUrl === spec.url);
    assert(allUnlinked || allLinked, `${spec.subjectType} rank URLs are partially applied or unexpected`);
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      assert(row.rankEnd - row.rankStart + 1 === row.sameRankScore, `${spec.subjectType}/${row.score} rank width drifted`);
      if (index) assert(rows[index - 1].rankEnd + 1 === row.rankStart, `${spec.subjectType}/${row.score} rank continuity drifted`);
    }
    diagnostics.push({
      subjectType: spec.subjectType,
      rowsInventoryChecked: rows.length,
      scoreMin: spec.scoreMin,
      scoreMax: spec.scoreMax,
      topRank: spec.topRank,
      finalCumulative: spec.finalRank,
      officialZeroPersonScoreGapsRetained: spec.omittedScoreGaps,
      valueDifferences: 0,
      rankRowsNeedingSourceUrlOnV3299Base: spec.rows,
    });
  }
  return diagnostics;
}

function recordId(row) {
  return `2026-liaoning-control-${sha256([row.subjectType, row.section, row.category, row.minScore, row.route].join("|")).slice(0, 18)}`;
}

function makeRecord(row) {
  const ordinary = row.route === "ordinary-bachelor" || row.route === "ordinary-vocational";
  const category = row.category || "普通类";
  const batch = row.route === "ordinary-bachelor"
    ? "普通类本科控制分数线"
    : row.route === "ordinary-vocational"
      ? "普通类专科（高职、提前专科）控制分数线"
      : row.route === "special"
        ? "特殊类型招生控制分数线"
        : row.route === "sports"
          ? "体育类本、专科（高职）文化成绩控制分数线"
          : category;
  const hasQualification = Boolean(row.professionalQualification);
  return {
    id: recordId(row),
    province: "辽宁",
    year: 2026,
    subjectType: row.subjectType,
    batch,
    schoolName: "辽宁省2026年普通高等学校招生文化课录取控制分数线",
    schoolTags: ["辽宁官方内容镜像控制线", ordinary ? "普通类" : "特殊路径", category, row.section],
    city: "辽宁",
    dataType: "control-line",
    majorName: batch,
    majorGroup: category,
    minScore: row.minScore,
    cultureScoreLine: row.minScore,
    professionalQualification: row.professionalQualification,
    scoreDimension: hasQualification ? "culture-and-qualification" : "total-score",
    scoreBasis: ordinary || row.route === "special" ? "gaokao-total" : "culture-score",
    scoreMaximum: 750,
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: "official-content-mirror-liaoning-education-government-and-chsi-verified",
    sourceUrl: CONTROL_URL,
    formalScoreScope: ordinary ? "control-line-only" : "special-path-only",
    controlLineRouteKind: row.route,
    controlLineKind: batch,
    controlLineSection: row.section,
    cautions: ordinary ? [
      `这是辽宁省2026年普通类${row.subjectType}${row.section}文化课控制分数线，只用于判断对应普通批次基本资格边界。`,
      "控制线不是院校或专业投档线、录取最低分、最低位次或录取概率。",
    ] : [
      `这是辽宁省2026年${batch}，属于特殊、体育或艺术路径，不替代普通类控制线。`,
      hasQualification ? "本源只公开文化成绩控制线，专业考试合格要求须按当年政策和招生章程另行核验，不补造专业分。" : "该记录保持 special-path-only，不进入普通类资格线或普通录取概率计算。",
    ],
    sourceFile: "data/admissions/raw/liaoning-2026/official-government-control-lines.html",
    sourcePublishedAt: "2026-06-24",
  };
}

const evidence = Object.fromEntries(Object.entries(EXPECTED).map(([key, expected]) => [key, verifyFile(expected)]));
const governmentControlText = visibleHtmlText(fs.readFileSync(path.join(RAW_DIR, EXPECTED.governmentControlPage.file)));
const chsiControlText = visibleHtmlText(fs.readFileSync(path.join(RAW_DIR, EXPECTED.chsiControlPage.file)));
const governmentRankHtml = fs.readFileSync(path.join(RAW_DIR, EXPECTED.governmentRankIndex.file), "utf8");
const chsiRankText = visibleHtmlText(fs.readFileSync(path.join(RAW_DIR, EXPECTED.chsiRankIndex.file)));
for (const token of ["特殊类型招生控制分数线：527分", "本科控制分数线：442分", "特殊类型招生控制分数线：508分", "本科控制分数线：344分", "本科文化成绩控制分数线：331分", "本科戏曲类专业文化成绩控制分数线：221分", "本科文化成绩控制分数线：258分", "本科戏曲类专业文化成绩控制分数线：172分"]) {
  assert(governmentControlText.includes(token) && chsiControlText.includes(token), `Liaoning control text drifted: ${token}`);
}
assert((governmentControlText.match(/专科（高职、提前专科）控制分数线：150分/g) || []).length === 2, "Liaoning ordinary vocational line count drifted");
assert((governmentControlText.match(/本、专科（高职）文化成绩控制分数线：150分/g) || []).length === 2, "Liaoning sports culture line count drifted");
assert((governmentControlText.match(/专科（高职）文化成绩控制分数线：150分/g) || []).length === 4, "Liaoning sports/art vocational culture-line count drifted");
assert(governmentRankHtml.includes("lns2026gkcjtjb0624clhptll01.pdf") && governmentRankHtml.includes("lns2026gkcjtjb0624clhptlw02.pdf"), "Liaoning government rank links drifted");
assert(chsiRankText.includes("辽宁省2026年普通高校招生考试成绩统计表"), "Liaoning CHSI rank mirror title drifted");
const rankVerification = verifyRankInventory();

const ordinaryRows = [
  ["历史类", "本科", 442, "ordinary-bachelor"],
  ["历史类", "专科（高职、提前专科）", 150, "ordinary-vocational"],
  ["物理类", "本科", 344, "ordinary-bachelor"],
  ["物理类", "专科（高职、提前专科）", 150, "ordinary-vocational"],
];
const records = [
  ...ordinaryRows.map(([subjectType, section, minScore, route]) => makeRecord({ subjectType, section, category: "普通类", minScore, route })),
  makeRecord({ subjectType: "历史类", section: "本科", category: "特殊类型招生", minScore: 527, route: "special" }),
  makeRecord({ subjectType: "物理类", section: "本科", category: "特殊类型招生", minScore: 508, route: "special" }),
  ...["历史类", "物理类"].map((subjectType) => makeRecord({ subjectType, section: "本、专科（高职）", category: "体育类", minScore: 150, professionalQualification: "体育类专业考试达到辽宁省2026年对应招生要求", route: "sports" })),
  makeRecord({ subjectType: "历史类", section: "本科", category: "艺术类本科普通专业文化线", minScore: 331, professionalQualification: "艺术类专业考试达到辽宁省2026年对应招生要求", route: "art" }),
  makeRecord({ subjectType: "历史类", section: "本科", category: "舞蹈、戏剧影视表演、服装表演、音乐表演文化线", minScore: 250, professionalQualification: "对应艺术类专业考试达到辽宁省2026年招生要求", route: "art" }),
  makeRecord({ subjectType: "历史类", section: "本科", category: "戏曲类专业文化线", minScore: 221, professionalQualification: "戏曲类专业考试达到辽宁省2026年招生要求", route: "art" }),
  makeRecord({ subjectType: "历史类", section: "专科（高职）", category: "艺术类专科（高职）文化线", minScore: 150, professionalQualification: "艺术类专业考试达到辽宁省2026年对应招生要求", route: "art" }),
  makeRecord({ subjectType: "物理类", section: "本科", category: "艺术类本科普通专业文化线", minScore: 258, professionalQualification: "艺术类专业考试达到辽宁省2026年对应招生要求", route: "art" }),
  makeRecord({ subjectType: "物理类", section: "本科", category: "舞蹈、戏剧影视表演、服装表演、音乐表演文化线", minScore: 250, professionalQualification: "对应艺术类专业考试达到辽宁省2026年招生要求", route: "art" }),
  makeRecord({ subjectType: "物理类", section: "本科", category: "戏曲类专业文化线", minScore: 172, professionalQualification: "戏曲类专业考试达到辽宁省2026年招生要求", route: "art" }),
  makeRecord({ subjectType: "物理类", section: "专科（高职）", category: "艺术类专科（高职）文化线", minScore: 150, professionalQualification: "艺术类专业考试达到辽宁省2026年对应招生要求", route: "art" }),
];

assert(records.length === 16, `Expected 16 records, got ${records.length}`);
assert(new Set(records.map((record) => record.id)).size === records.length, "Duplicate record ids detected");
assert(records.filter((record) => record.formalScoreScope === "control-line-only").length === 4, "Expected four ordinary records");
assert(records.filter((record) => record.formalScoreScope === "special-path-only").length === 12, "Expected 12 special-path records");
assert(records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 0, "Liaoning source does not publish numeric professional thresholds");
assert(records.filter((record) => record.professionalQualification).length === 10, "Expected ten sports/art qualification rows");

const payload = {
  dataset: "official-liaoning-control-lines-2026-import",
  generatedAt: GENERATED_AT,
  scope: { province: "辽宁", year: 2026, sourceKind: "official-content-mirror-control-lines" },
  notes: [
    "辽宁2026普通历史本科/专科442/150分、物理本科/专科344/150分共4条进入普通资格路由。",
    "特殊类型2条、体育2条和艺术8条共12条保持 special-path-only。",
    "体育和艺术10条只保存文化线与专业资格要求；本源未公开专业数值门槛，不补造专业分。",
    "既有1076条辽宁普通类官方PDF位次保留原值，本轮复核库存、端点、宽度和连续性并补齐科类PDF URL；原站直连当前超时，由省教育厅正式转载索引确认附件身份。",
  ],
  sourceNotes: [{
    id: SOURCE_ID,
    province: "辽宁",
    title: "辽宁省2026年普通高等学校招生文化课录取控制分数线",
    publisher: "辽宁省教育厅（文章来源：辽宁招生考试之窗）",
    publishedAt: "2026-06-24",
    url: CONTROL_URL,
    relatedUrls: [CHSI_CONTROL_URL, RANK_INDEX_URL, CHSI_RANK_URL, ORIGINAL_RANK_PAGE_URL, RANK_HISTORY_URL, RANK_PHYSICS_URL],
    quality: "official-content-mirror-liaoning-education-government-and-chsi-verified",
    usage: "抽取辽宁2026普通、特殊类型、体育和艺术文化控制线16条；仅4条普通类本专科记录参与普通考生资格路由。",
    parsedRecords: records.length,
    scoreMaximum: 750,
    originalPublisher: "辽宁招生考试之窗",
    directOriginalRetrievalStatus: "timed-out-current-session",
    directOriginalBoundary: "辽宁招生考试之窗控制线原文与两份位次PDF本轮直连超时；不宣称已重新下载原站正文或PDF。控制线由辽宁省教育厅正式转载页与阳光高考转载页双源一致确认，位次附件身份由辽宁省教育厅正式转载索引确认。",
    evidence,
    rankEvidence: {
      sourceId: RANK_SOURCE_ID,
      records: 1076,
      originalPageUrl: ORIGINAL_RANK_PAGE_URL,
      governmentMirrorIndexUrl: RANK_INDEX_URL,
      historyUrl: RANK_HISTORY_URL,
      physicsUrl: RANK_PHYSICS_URL,
      inventoryAndContinuityCheck: rankVerification,
      valueChanges: 0,
      controlBoundaryCrossCheck: {
        history: { vocationalScore: 150, vocationalRankEnd: 52453, bachelorScore: 442, bachelorRankEnd: 24410, specialScore: 527, specialRankEnd: 10124 },
        physics: { vocationalScore: 150, vocationalRankEnd: 141691, bachelorScore: 344, bachelorRankEnd: 119069, specialScore: 508, specialRankEnd: 49824 },
      },
    },
    evidenceBoundary: "control-line-only=4; special-path-only=12; sports/art culture-only qualification rows=10; numeric professional thresholds=0; ordinary rank rows=1076 official PDF identities confirmed by government mirror, runtime inventory/continuity checked and values unchanged; not institution, major or admission probability",
  }],
  records,
  diagnostics: {
    recordCount: records.length,
    ordinaryRecords: 4,
    specialPathRecords: 12,
    professionalQualificationRecords: 10,
    professionalNumericRecords: 0,
    routeCounts: { "ordinary-bachelor": 2, "ordinary-vocational": 2, special: 2, sports: 2, art: 8 },
    ordinaryBoundaries: { historyBachelor: 442, historyVocational: 150, physicsBachelor: 344, physicsVocational: 150 },
    rankRecords: 1076,
    rankRowsInventoryChecked: 1076,
    rankValueChanges: 0,
    scoreMaximum: 750,
  },
};

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "ok", out: path.relative(PROJECT_ROOT, OUTPUT_FILE), diagnostics: payload.diagnostics, evidence, rankVerification }, null, 2));
