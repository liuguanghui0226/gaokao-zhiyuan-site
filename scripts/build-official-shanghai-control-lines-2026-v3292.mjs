#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const GENERATED_AT = "2026-07-16T10:30:00.000Z";
const SOURCE_ID = "official-shanghai-control-lines-2026";
const SOURCE_URL = "https://www.shmeea.edu.cn/page/08000/20260623/20379.html";
const RANK_SOURCE_ID = "official-shanghai-rank-2026";
const RANK_URL = "https://www.shmeea.edu.cn/page/02200/20260623/20375.html";
const RANK_PDF_URL = "https://www.shmeea.edu.cn/download/20260623/2/0.pdf";
const SCHEDULE_URL = "https://www.shmeea.edu.cn/page/08000/20260609/20321.html";
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/shanghai-2026");
const OUTPUT_FILE = path.join(PROJECT_ROOT, "data/admissions/official-shanghai-control-lines-2026-import.json");

const EXPECTED = {
  controlPage: {
    file: "control-lines.html",
    bytes: 10296,
    sha256: "7ec1b138300d46710ea88f21b088b9f10438ad8d94d63caf4ad7cc2c616e28a5",
  },
  rankPage: {
    file: "rank-page.html",
    bytes: 14881,
    sha256: "3faa761df90d0bec7f99627cc1e32cd9df54dc683358d894af9b3cc135a4fa02",
  },
  schedulePage: {
    file: "admission-schedule.html",
    bytes: 57658,
    sha256: "966666374eaefdba5bb3efd97373df43d3b54f6a1c1dce58ba45d396be253beb",
  },
  rankPdf: {
    file: "undergraduate-score-rank.pdf",
    bytes: 114010,
    sha256: "057f58483e7c54f519982d45a91d27f6994a753543d2a4fb73aa7b49474320e1",
    pages: 4,
  },
};

const rows = [
  { category: "普通类", kind: "本科录取控制分数线", score: 403, route: "ordinary-bachelor", ordinary: true },
  { category: "特殊类型招生", kind: "特殊类型招生控制分数线", score: 504, route: "special" },
  { category: "体育类", kind: "体育类本科文化控制分数线", score: 282, route: "sports" },
  { category: "艺术类（舞蹈类、戏曲类除外）", kind: "艺术类本科文化控制分数线（舞蹈类、戏曲类除外）", score: 302, route: "art" },
  { category: "舞蹈类、戏曲类", kind: "舞蹈类、戏曲类本科文化控制分数线", score: 220, route: "art" },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function verifyFile(expected) {
  const file = path.join(RAW_DIR, expected.file);
  const bytes = fs.readFileSync(file);
  assert(bytes.byteLength === expected.bytes, `${expected.file} byte count drifted: ${bytes.byteLength}`);
  assert(sha256(bytes) === expected.sha256, `${expected.file} SHA-256 drifted`);
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
  return `2026-shanghai-control-${sha256([row.category, row.kind, row.score, row.route].join("|")).slice(0, 18)}`;
}

function makeRecord(row) {
  const ordinaryCautions = [
    "这是上海2026年普通本科录取控制分数线，只用于判断普通本科阶段资格边界。",
    "上海2026年专科各批次录取控制分数线按官方日程于7月29日晚公布；403分以下当前只能作专科路径调研，不能认定已达到2026专科资格线。",
    "控制线不是院校专业组投档线、院校录取线、专业录取最低分或最低位次，不能单独生成录取概率。",
  ];
  const specialCautions = [
    "这是上海2026年特殊类型、艺术类或体育类本科文化控制线，不适用于普通类考生直接推荐。",
    "艺术类和体育类还须满足对应专业考试、专业成绩、院校专业组要求及招生章程。",
    "本页只公布文化控制分数线，不含专业统考合格线或具体院校专业组投档线。",
  ];
  return {
    id: recordId(row),
    province: "上海",
    year: 2026,
    subjectType: "综合",
    batch: row.kind,
    schoolName: "上海市2026年普通高校招生本科阶段录取控制分数线",
    schoolTags: ["上海官方控制线", row.ordinary ? "普通类" : "特殊路径", row.category, "本科"],
    city: "上海",
    dataType: "control-line",
    majorName: row.kind,
    majorGroup: row.category,
    minScore: row.score,
    cultureScoreLine: row.score,
    scoreDimension: row.ordinary ? "total-score" : "culture-score",
    scoreBasis: "gaokao-total",
    scoreMaximum: 660,
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: "official-shanghai-control-line-html-verified",
    sourceUrl: SOURCE_URL,
    formalScoreScope: row.ordinary ? "control-line-only" : "special-path-only",
    controlLineRouteKind: row.route,
    controlLineKind: row.kind,
    controlLineSection: "本科",
    cautions: row.ordinary ? ordinaryCautions : specialCautions,
    sourceFile: "data/admissions/raw/shanghai-2026/control-lines.html",
    sourcePublishedAt: "2026-06-23",
  };
}

const controlPage = verifyFile(EXPECTED.controlPage);
const rankPage = verifyFile(EXPECTED.rankPage);
const schedulePage = verifyFile(EXPECTED.schedulePage);
const rankPdf = verifyFile(EXPECTED.rankPdf);
const controlText = visibleHtmlText(fs.readFileSync(path.join(RAW_DIR, controlPage.file)));
const rankPageBytes = fs.readFileSync(path.join(RAW_DIR, rankPage.file));
const rankText = visibleHtmlText(rankPageBytes);
const scheduleText = visibleHtmlText(fs.readFileSync(path.join(RAW_DIR, schedulePage.file)));

for (const phrase of [
  "上海市2026年普通高校招生本科阶段录取控制分数线确定",
  "本科录取控制分数线403",
  "特殊类型招生控制分数线504",
  "体育类本科文化控制分数线282",
  "艺术类本科文化控制分数线（舞蹈类、戏曲类除外）302",
  "舞蹈类、戏曲类本科文化控制分数线220",
  "本市高考成绩满分为660分",
]) {
  assert(controlText.includes(phrase), `Control page is missing: ${phrase}`);
}
assert(rankText.includes("上海市2026年普通高校招生本科阶段考生各类别成绩分布表"), "Rank page title drifted");
assert(rankPageBytes.toString("utf8").includes(RANK_PDF_URL), "Rank page no longer links the expected PDF");
assert(scheduleText.includes("7月29日"), "Admission schedule is missing July 29");
assert(scheduleText.includes("公布专科各批次录取控制分数线"), "Admission schedule no longer declares the vocational-line publication step");
assert(fs.readFileSync(path.join(RAW_DIR, rankPdf.file)).subarray(0, 4).toString("ascii") === "%PDF", "Rank evidence is not a PDF");

const records = rows.map(makeRecord);
assert(records.length === 5, `Expected 5 records, got ${records.length}`);
assert(new Set(records.map((record) => record.id)).size === records.length, "Duplicate record ids detected");
assert(records.filter((record) => record.formalScoreScope === "control-line-only").length === 1, "Expected one ordinary record");
assert(records.filter((record) => record.formalScoreScope === "special-path-only").length === 4, "Expected four special-path records");

const payload = {
  dataset: "official-shanghai-control-lines-2026-import",
  generatedAt: GENERATED_AT,
  scope: { province: "上海", year: 2026, sourceKind: "official-control-lines" },
  notes: [
    "上海2026普通本科线403分进入通用本科资格路由；特殊类型、艺术和体育4条保持特殊路径隔离。",
    "2026专科控制线按上海市教育考试院日程于7月29日晚发布，当前不使用往年线补造，不生成专科资格结论或录取概率。",
    "既有214条上海2026本科线上位次记录来自同日4页PDF，本轮只补齐页面/PDF证据和运行来源链接，不改分数、人数或累计位次。",
  ],
  sourceNotes: [{
    id: SOURCE_ID,
    province: "上海",
    title: "上海市2026年普通高校招生本科阶段录取控制分数线确定",
    publisher: "上海市教育考试院",
    publishedAt: "2026-06-23",
    url: SOURCE_URL,
    relatedUrls: [RANK_URL, SCHEDULE_URL],
    attachmentUrls: [RANK_PDF_URL],
    quality: "official-shanghai-control-line-html-verified",
    usage: "抽取上海2026普通本科、特殊类型、艺术类和体育类本科文化控制线5条；仅普通本科403分参与普通资格路由，专科控制线保持待官方发布。",
    parsedRecords: records.length,
    scoreMaximum: 660,
    ordinaryVocationalStatus: "pending-official-release",
    ordinaryVocationalPending: true,
    ordinaryVocationalCheckedAt: "2026-07-16",
    ordinaryVocationalExpectedPublicationAt: "2026-07-29",
    ordinaryVocationalScheduleUrl: SCHEDULE_URL,
    controlPageBytes: controlPage.bytes,
    controlPageSha256: controlPage.sha256,
    rankPageBytes: rankPage.bytes,
    rankPageSha256: rankPage.sha256,
    rankPdfBytes: rankPdf.bytes,
    rankPdfSha256: rankPdf.sha256,
    rankPdfPages: rankPdf.pages,
    schedulePageBytes: schedulePage.bytes,
    schedulePageSha256: schedulePage.sha256,
    rankEvidence: {
      sourceId: RANK_SOURCE_ID,
      url: RANK_URL,
      attachmentUrl: RANK_PDF_URL,
      records: 214,
      scoreRange: { min: 403, max: 616 },
      rankRange: { min: 1, max: 51853 },
      topScoreRange: { min: 616, max: 660 },
    },
    evidenceBoundary: "control-line-only=1; special-path-only=4; ordinary-vocational=pending official release on 2026-07-29; rank table covers 403-660 only; not institution-group, institution or major admission score",
  }],
  records,
  diagnostics: {
    recordCount: records.length,
    ordinaryRecords: 1,
    specialPathRecords: 4,
    routeCounts: { "ordinary-bachelor": 1, special: 1, sports: 1, art: 2 },
    ordinaryBoundaries: { bachelor: 403, vocational: null },
    ordinaryVocationalStatus: "pending-official-release",
    scoreMaximum: 660,
    rankRecords: 214,
  },
};

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: "ok",
  out: path.relative(PROJECT_ROOT, OUTPUT_FILE),
  diagnostics: payload.diagnostics,
  evidence: { controlPage, rankPage, schedulePage, rankPdf },
}, null, 2));
