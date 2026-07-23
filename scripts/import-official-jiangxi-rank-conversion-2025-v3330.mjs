#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DATASET = "official-jiangxi-rank-conversion-2025-v3330-import";
const SOURCE_ID = "official-jiangxi-rank-2025-v3330";
const PROVINCE = "江西";
const YEAR = 2025;
const SCORE_BASIS = "gaokao-total-including-policy-bonus";
const SOURCE_QUALITY = "official-jiangxi-exam-authority-pdfs-jjcmjt-byte-identical-filing-score-policy-bonus-inclusive";
const CHSI_PAGE_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202506/20250626/2293392942.html";
const JXEEA_HISTORY_PDF_URL = "https://www.jxeea.cn/jxsjyksy/gsgg91/1938096334352519168/WOn27m6u.pdf";
const JXEEA_PHYSICS_PDF_URL = "https://www.jxeea.cn/jxsjyksy/gsgg91/1938096334352519168/7L9uupAh.pdf";
const JJCMJT_PAGE_URL = "https://know.jjcmjt.com/wechat/website/newspage.htm?id=d11b34ab-b992-4a25-913f-16a0c900598a";
const JJCMJT_HISTORY_PDF_URL = "https://know.jjcmjt.com/headImg/2025-06-27/c01c366a-b4e9-44e9-ac87-c227fdb7bd12.pdf";
const JJCMJT_PHYSICS_PDF_URL = "https://know.jjcmjt.com/headImg/2025-06-27/51c0c69e-d025-48b3-a7bc-54157b0eff18.pdf";
const SCORE_BASIS_URL = "https://tt.jxnews.com.cn/news/2744626";
const POLICY_URL = "https://know.jjcmjt.com/website/gkzt/gkztPage.htm?id=1a89f5e7-b6b5-4230-85cf-f095fb9f7c31";
const EXPECTED = {
  "历史类": {
    rows: 562,
    topScore: 661,
    topCount: 24,
    floorScore: 100,
    floorCount: 11,
    floorRankEnd: 206055,
    omittedZeroCandidateScores: [],
  },
  "物理类": {
    rows: 575,
    topScore: 676,
    topCount: 33,
    floorScore: 100,
    floorCount: 3,
    floorRankEnd: 266425,
    omittedZeroCandidateScores: [117, 101],
  },
};

function parseArgs(argv) {
  const args = {
    historyPdf: "",
    historyMirrorPdf: "",
    physicsPdf: "",
    physicsMirrorPdf: "",
    pageHtml: "",
    scoreBasisHtml: "",
    policyHtml: "",
    out: "data/admissions/official-jiangxi-rank-conversion-2025-v3330-import.json",
    pdftotext: process.env.PDFTOTEXT_BIN || "pdftotext",
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--history-pdf") args.historyPdf = argv[++index];
    else if (argv[index] === "--history-mirror-pdf") args.historyMirrorPdf = argv[++index];
    else if (argv[index] === "--physics-pdf") args.physicsPdf = argv[++index];
    else if (argv[index] === "--physics-mirror-pdf") args.physicsMirrorPdf = argv[++index];
    else if (argv[index] === "--page-html") args.pageHtml = argv[++index];
    else if (argv[index] === "--score-basis-html") args.scoreBasisHtml = argv[++index];
    else if (argv[index] === "--policy-html") args.policyHtml = argv[++index];
    else if (argv[index] === "--out") args.out = argv[++index];
    else if (argv[index] === "--pdftotext") args.pdftotext = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  for (const key of [
    "historyPdf",
    "historyMirrorPdf",
    "physicsPdf",
    "physicsMirrorPdf",
    "pageHtml",
    "scoreBasisHtml",
    "policyHtml",
  ]) {
    if (!args[key]) throw new Error(`Missing required ${key}`);
  }
  return args;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stripHtml(value) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&gt;/gi, ">")
    .replace(/&lt;/gi, "<")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFKC");
}

function runPdfText(binary, file) {
  const result = spawnSync(binary, ["-layout", file, "-"], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  assert(result.status === 0, `pdftotext failed for ${path.basename(file)}: ${result.stderr?.trim() || "unknown error"}`);
  assert(result.stdout.length > 8000, `pdftotext output is too short for ${path.basename(file)}`);
  return result.stdout.normalize("NFKC");
}

function normalizeRows(rows, subjectType) {
  const expected = EXPECTED[subjectType];
  const byScore = new Map();
  for (const row of rows) {
    assert(!byScore.has(row.score), `${subjectType} contains duplicate score ${row.score}`);
    byScore.set(row.score, row);
  }
  const sorted = [...byScore.values()].sort((left, right) => right.score - left.score);
  assert(sorted.length === expected.rows, `${subjectType} expected ${expected.rows} rows, got ${sorted.length}`);
  assert(sorted[0].score === expected.topScore && sorted.at(-1).score === expected.floorScore, `${subjectType} score boundaries drifted`);
  assert(sorted[0].people === expected.topCount && sorted[0].cumulative === expected.topCount, `${subjectType} top bucket drifted`);
  assert(
    sorted.at(-1).people === expected.floorCount && sorted.at(-1).cumulative === expected.floorRankEnd,
    `${subjectType} floor bucket drifted`,
  );
  const omittedScores = [];
  for (let index = 1; index < sorted.length; index += 1) {
    for (let score = sorted[index - 1].score - 1; score > sorted[index].score; score -= 1) omittedScores.push(score);
    assert(
      sorted[index].cumulative - sorted[index - 1].cumulative === sorted[index].people,
      `${subjectType} cumulative arithmetic failed at ${sorted[index].score}`,
    );
  }
  assert(
    JSON.stringify(omittedScores) === JSON.stringify(expected.omittedZeroCandidateScores),
    `${subjectType} omitted-score audit drifted: ${omittedScores.join(",")}`,
  );
  return sorted;
}

function parseSubjectPdf(text, subjectType) {
  const title = `江西省2025年普通高考${subjectType}一分一段表`;
  assert(text.replace(/\s+/g, "").includes(title), `${subjectType} PDF title drifted`);
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d{3})(及以上)?\s+(\d{1,6})\s+(\d{1,6})\s*$/);
    if (!match) continue;
    const score = Number(match[1]);
    if (score < 100 || score > 750) continue;
    rows.push({
      score,
      people: Number(match[3]),
      cumulative: Number(match[4]),
      topMerged: Boolean(match[2]),
    });
  }
  return normalizeRows(rows, subjectType);
}

function stableId(subjectType, row) {
  const digest = sha256(`${YEAR}|${PROVINCE}|${subjectType}|${row.score}|${row.people}|${row.cumulative}|${SOURCE_ID}`).slice(0, 18);
  return `${YEAR}-jiangxi-rank-${subjectType === "历史类" ? "history" : "physics"}-v3330-${digest}`;
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const files = Object.fromEntries(
    Object.entries(args)
      .filter(([key]) => key.endsWith("Pdf") || key.endsWith("Html"))
      .map(([key, value]) => [key, path.resolve(PROJECT_ROOT, value)]),
  );
  const historyPdfBytes = fs.readFileSync(files.historyPdf);
  const historyMirrorBytes = fs.readFileSync(files.historyMirrorPdf);
  const physicsPdfBytes = fs.readFileSync(files.physicsPdf);
  const physicsMirrorBytes = fs.readFileSync(files.physicsMirrorPdf);
  const pageHtmlBytes = fs.readFileSync(files.pageHtml);
  const scoreBasisHtmlBytes = fs.readFileSync(files.scoreBasisHtml);
  const policyHtmlBytes = fs.readFileSync(files.policyHtml);

  assert(historyPdfBytes.equals(historyMirrorBytes), "History official and independent mirror PDFs are not byte-identical");
  assert(physicsPdfBytes.equals(physicsMirrorBytes), "Physics official and independent mirror PDFs are not byte-identical");
  const parsedBySubject = {
    "历史类": parseSubjectPdf(runPdfText(args.pdftotext, files.historyPdf), "历史类"),
    "物理类": parseSubjectPdf(runPdfText(args.pdftotext, files.physicsPdf), "物理类"),
  };
  const pageText = stripHtml(pageHtmlBytes.toString("utf8"));
  const scoreBasisText = stripHtml(scoreBasisHtmlBytes.toString("utf8"));
  const policyText = stripHtml(policyHtmlBytes.toString("utf8"));
  assert(pageText.includes("江西省2025年普通高考一分一段表"), "Rank publication page title drifted");
  assert(pageText.includes("来源:江西省教育考试院") || pageText.includes("来源: 江西省教育考试院"), "Rank publication attribution drifted");
  assert(
    scoreBasisText.includes("档案分(考生总分+政策加分)") || scoreBasisText.includes("档案分(考生总分＋政策加分)"),
    "Score-basis explanation no longer identifies total score plus policy bonus",
  );
  assert(policyText.includes("在考生文化统考成绩总分的基础上增加一定分数投档"), "Policy page no longer confirms bonus-to-filing treatment");
  assert(policyText.includes("不得计入投档成绩并使用"), "Policy page no longer states the publication requirement for filing bonuses");

  const rankConversions = [];
  for (const subjectType of ["历史类", "物理类"]) {
    const rows = parsedBySubject[subjectType];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      rankConversions.push({
        id: stableId(subjectType, row),
        province: PROVINCE,
        year: YEAR,
        subjectType,
        dataType: "rank-conversion",
        score: row.score,
        rankStart: index === 0 ? 1 : rows[index - 1].cumulative + 1,
        rankEnd: row.cumulative,
        sameRankScore: row.people,
        ...(row.topMerged ? { scoreRange: [row.score, 750], topMerged: true } : {}),
        scoreBasis: SCORE_BASIS,
        rankPolicyBonusIncluded: true,
        sourceId: SOURCE_ID,
        sourceQuality: SOURCE_QUALITY,
        sourceUrl: CHSI_PAGE_URL,
      });
    }
  }
  assert(rankConversions.length === 1137, `Expected 1137 rank rows, got ${rankConversions.length}`);
  assert(new Set(rankConversions.map((row) => row.id)).size === rankConversions.length, "Duplicate rank IDs");

  const generatedAt = new Date().toISOString();
  const sourceNote = {
    id: SOURCE_ID,
    title: "江西省2025年普通高考一分一段表（档案分）",
    publisher: "江西省教育考试院 / 阳光高考；江教在线镜像",
    url: CHSI_PAGE_URL,
    originalPdfUrls: [JXEEA_HISTORY_PDF_URL, JXEEA_PHYSICS_PDF_URL],
    attachmentUrls: [JJCMJT_HISTORY_PDF_URL, JJCMJT_PHYSICS_PDF_URL],
    relatedUrls: [JJCMJT_PAGE_URL, SCORE_BASIS_URL, POLICY_URL],
    quality: SOURCE_QUALITY,
    usage: "江西2025普通高考历史类562个、物理类575个档案分分数档。用于同年普通历史类/物理类整数最低分换算省级位次；艺术体育综合分、特殊路径、已有原生位次和100分以下不覆盖。",
    province: PROVINCE,
    year: YEAR,
    parsedRecords: rankConversions.length,
    subjectRecords: { "历史类": 562, "物理类": 575 },
    pdfPages: { "历史类": 21, "物理类": 21 },
    scoreRange: {
      "历史类": { min: 100, max: 661, topMergedMax: 750 },
      "物理类": { min: 100, max: 676, topMergedMax: 750 },
    },
    rankRange: { "历史类": { min: 1, max: 206055 }, "物理类": { min: 1, max: 266425 } },
    scoreBasis: SCORE_BASIS,
    rankPolicyBonusIncluded: true,
    automaticAdmissionScoreAlignmentAllowed: true,
    publishedScoreFloor: 100,
    topMergedCandidates: { "历史类": 24, "物理类": 33 },
    omittedZeroCandidateScores: { "历史类": [], "物理类": [117, 101] },
    provenance: {
      historyOfficialPdfBytes: historyPdfBytes.byteLength,
      historyOfficialPdfSha256: sha256(historyPdfBytes),
      historyMirrorPdfBytes: historyMirrorBytes.byteLength,
      historyMirrorPdfSha256: sha256(historyMirrorBytes),
      historyPdfsByteIdentical: true,
      physicsOfficialPdfBytes: physicsPdfBytes.byteLength,
      physicsOfficialPdfSha256: sha256(physicsPdfBytes),
      physicsMirrorPdfBytes: physicsMirrorBytes.byteLength,
      physicsMirrorPdfSha256: sha256(physicsMirrorBytes),
      physicsPdfsByteIdentical: true,
      pageHtmlBytes: pageHtmlBytes.byteLength,
      pageHtmlSha256: sha256(pageHtmlBytes),
      scoreBasisHtmlBytes: scoreBasisHtmlBytes.byteLength,
      scoreBasisHtmlSha256: sha256(scoreBasisHtmlBytes),
      policyHtmlBytes: policyHtmlBytes.byteLength,
      policyHtmlSha256: sha256(policyHtmlBytes),
      parsedHistoryRows: parsedBySubject["历史类"].length,
      parsedPhysicsRows: parsedBySubject["物理类"].length,
      duplicateScores: 0,
      omittedZeroCandidateScores: [117, 101],
      cumulativeArithmeticErrors: 0,
    },
    cautions: [
      "历史类661分及以上仅保存公开的1-24名合并区间，物理类676分及以上仅保存1-33名，不生成档内伪精确位次。",
      "物理类117分和101分在官方表中无考生而省略，不生成空位次记录；两科99分及以下不外推。",
      "档案分口径为考生总分加经审核公示的政策加分；不适用加分的特殊招生项目继续单独核验。",
      "最低分换算位次不是院校录取表直接公布的原生最低位次。",
    ],
  };
  const payload = {
    dataset: DATASET,
    generatedAt,
    province: PROVINCE,
    year: YEAR,
    subjectTypes: ["历史类", "物理类"],
    sourceNotes: [sourceNote],
    rankConversions,
    audit: {
      parsedRecords: rankConversions.length,
      parsedHistoryRows: parsedBySubject["历史类"].length,
      parsedPhysicsRows: parsedBySubject["物理类"].length,
      pdfPages: { "历史类": 21, "物理类": 21 },
      mirrorPdfsByteIdentical: true,
      duplicateIds: rankConversions.length - new Set(rankConversions.map((row) => row.id)).size,
      duplicateScores: 0,
      omittedZeroCandidateScores: { "历史类": [], "物理类": [117, 101] },
      cumulativeArithmeticErrors: 0,
      scoreBasis: SCORE_BASIS,
      rankPolicyBonusIncluded: true,
      scoreBasisExplanationVerified: true,
      filingBonusPolicyVerified: true,
      topMergedCandidates: { "历史类": 24, "物理类": 33 },
      publishedFloorRankEnd: { "历史类": 206055, "物理类": 266425 },
    },
  };

  const outFile = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "ok",
    output: path.relative(PROJECT_ROOT, outFile),
    rows: rankConversions.length,
    subjects: sourceNote.subjectRecords,
    historyPdfSha256: sourceNote.provenance.historyOfficialPdfSha256,
    physicsPdfSha256: sourceNote.provenance.physicsOfficialPdfSha256,
    scoreRange: sourceNote.scoreRange,
    rankRange: sourceNote.rankRange,
  }, null, 2));
}

main();
