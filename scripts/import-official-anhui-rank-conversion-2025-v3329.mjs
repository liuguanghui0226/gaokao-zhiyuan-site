#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DATASET = "official-anhui-rank-conversion-2025-v3329-import";
const SOURCE_ID = "official-anhui-rank-2025-v3329";
const PROVINCE = "安徽";
const YEAR = 2025;
const SCORE_BASIS = "gaokao-total-including-policy-bonus";
const CHSI_PAGE_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202506/20250625/2293392866.html";
const CHSI_PDF_URL = "https://gaokao.chsi.com.cn/news/file.do?attach=true&hist=false&id=2293392867&method=downFile";
const AQNU_PAGE_URL = "https://zsw.aqnu.edu.cn/info/1501/22339.htm";
const AQNU_PDF_URL = "https://zsw.aqnu.edu.cn/__local/5/FA/68/67183E6529F4952AF7D7B783E0C_6F54CD6A_109F1.pdf";
const JHGK_PDF_URL = "https://jhgk.cn/upload/file/20250625/1750840838805073518.pdf";
const POLICY_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202505/20250512/2293378850-6.html";
const SOURCE_QUALITY = "official-source-attributed-anhui-exam-authority-chsi-aqnu-pdf-jhgk-byte-identical-policy-bonus-inclusive";
const EXPECTED = {
  "历史类": { rows: 469, topScore: 668, topCount: 23, floorScore: 200, floorCount: 70, floorRankEnd: 141400 },
  "物理类": { rows: 492, topScore: 691, topCount: 43, floorScore: 200, floorCount: 29, floorRankEnd: 320779 },
};

function parseArgs(argv) {
  const args = {
    pdf: "",
    mirrorPdf: "",
    pageHtml: "",
    out: "data/admissions/official-anhui-rank-conversion-2025-v3329-import.json",
    pdftotext: process.env.PDFTOTEXT_BIN || "pdftotext",
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--pdf") args.pdf = argv[++index];
    else if (argv[index] === "--mirror-pdf") args.mirrorPdf = argv[++index];
    else if (argv[index] === "--page-html") args.pageHtml = argv[++index];
    else if (argv[index] === "--out") args.out = argv[++index];
    else if (argv[index] === "--pdftotext") args.pdftotext = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  for (const key of ["pdf", "mirrorPdf", "pageHtml"]) {
    if (!args[key]) throw new Error(`Missing required --${key.replace(/[A-Z]/g, (value) => `-${value.toLowerCase()}`)}`);
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
    .trim();
}

function runPdfText(binary, file) {
  const result = spawnSync(binary, ["-layout", file, "-"], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  assert(result.status === 0, `pdftotext failed for ${path.basename(file)}: ${result.stderr?.trim() || "unknown error"}`);
  assert(result.stdout.length > 1000, `pdftotext output is too short for ${path.basename(file)}`);
  return result.stdout.normalize("NFKC");
}

function normalizeSubjectRows(rows, subjectType) {
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
  for (let index = 1; index < sorted.length; index += 1) {
    assert(sorted[index - 1].score - sorted[index].score === 1, `${subjectType} score continuity failed at ${sorted[index - 1].score}`);
    assert(
      sorted[index].cumulative - sorted[index - 1].cumulative === sorted[index].people,
      `${subjectType} cumulative arithmetic failed at ${sorted[index].score}`,
    );
  }
  return sorted;
}

function parsePdfRows(text) {
  const rows = { "历史类": [], "物理类": [] };
  let subjectType = "";
  for (const line of text.split(/\r?\n/)) {
    if (/科类[:：]历史科目组合/.test(line)) subjectType = "历史类";
    else if (/科类[:：]物理科目组合/.test(line)) subjectType = "物理类";
    if (!subjectType) continue;
    for (const match of line.matchAll(/(\d{3})(及以上)?\s+(\d{1,6})\s+(\d{1,6})/g)) {
      const score = Number(match[1]);
      if (score < 200 || score > 750) continue;
      rows[subjectType].push({
        score,
        people: Number(match[3]),
        cumulative: Number(match[4]),
        topMerged: Boolean(match[2]),
      });
    }
  }
  return Object.fromEntries(
    Object.entries(rows).map(([subjectType, subjectRows]) => [subjectType, normalizeSubjectRows(subjectRows, subjectType)]),
  );
}

function stableId(subjectType, row) {
  const digest = sha256(`${YEAR}|${PROVINCE}|${subjectType}|${row.score}|${row.people}|${row.cumulative}|${SOURCE_ID}`).slice(0, 18);
  return `${YEAR}-anhui-rank-${subjectType === "历史类" ? "history" : "physics"}-v3329-${digest}`;
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const pdfFile = path.resolve(PROJECT_ROOT, args.pdf);
  const mirrorPdfFile = path.resolve(PROJECT_ROOT, args.mirrorPdf);
  const pageHtmlFile = path.resolve(PROJECT_ROOT, args.pageHtml);
  const outFile = path.resolve(PROJECT_ROOT, args.out);
  const pdfBytes = fs.readFileSync(pdfFile);
  const mirrorPdfBytes = fs.readFileSync(mirrorPdfFile);
  const pageHtmlBytes = fs.readFileSync(pageHtmlFile);

  assert(pdfBytes.equals(mirrorPdfBytes), "AQNU and independent PDF mirrors are not byte-identical");
  const pdfText = runPdfText(args.pdftotext, pdfFile);
  const compactPdfText = pdfText.replace(/\s+/g, "");
  const pageText = stripHtml(pageHtmlBytes.toString("utf8"));
  assert(
    compactPdfText.includes("安徽省2025年普通高等学校招生统一考试考生成绩分档表(含加分)"),
    "Rank PDF does not identify the 2025 policy-bonus-inclusive score distribution",
  );
  assert(compactPdfText.includes("历史科目组合(含艺术、体育类考生,不含已录取考生、少年班等考生)"), "History population boundary is missing");
  assert(compactPdfText.includes("物理科目组合(含艺术、体育类考生,不含已录取考生、少年班等考生)"), "Physics population boundary is missing");
  assert(compactPdfText.match(/200以下略/g)?.length === 2, "Published 200-point floor is not present for both subjects");
  assert(pageText.includes("安徽省2025年普通高等学校招生统一考试考生成绩分档表（含加分）"), "AQNU source page title drifted");

  const parsedBySubject = parsePdfRows(pdfText);
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
  assert(rankConversions.length === 961, `Expected 961 rank rows, got ${rankConversions.length}`);
  assert(new Set(rankConversions.map((row) => row.id)).size === rankConversions.length, "Duplicate rank IDs");

  const generatedAt = new Date().toISOString();
  const pdfHash = sha256(pdfBytes);
  const sourceNote = {
    id: SOURCE_ID,
    title: "安徽省2025年普通高等学校招生统一考试考生成绩分档表（含加分）",
    publisher: "安徽省教育招生考试院 / 阳光高考；安庆师范大学本科招生网镜像",
    url: CHSI_PAGE_URL,
    originalPdfUrl: CHSI_PDF_URL,
    attachmentUrls: [AQNU_PDF_URL, JHGK_PDF_URL],
    relatedUrls: [AQNU_PAGE_URL, POLICY_URL],
    quality: SOURCE_QUALITY,
    usage: "安徽2025普通高考历史科目组合469个、物理科目组合492个含加分分数档。仅用于同年普通历史类/物理类整数最低分换算省级位次；艺术体育综合分、特殊路径、非整数分和200分以下不连接。",
    province: PROVINCE,
    year: YEAR,
    parsedRecords: rankConversions.length,
    subjectRecords: { "历史类": 469, "物理类": 492 },
    pdfPages: 6,
    scoreRange: {
      "历史类": { min: 200, max: 668, topMergedMax: 750 },
      "物理类": { min: 200, max: 691, topMergedMax: 750 },
    },
    rankRange: { "历史类": { min: 1, max: 141400 }, "物理类": { min: 1, max: 320779 } },
    scoreBasis: SCORE_BASIS,
    rankPolicyBonusIncluded: true,
    publishedScoreFloor: 200,
    topMergedCandidates: { "历史类": 23, "物理类": 43 },
    tablePopulation: "含艺术、体育类考生；不含已录取考生、少年班等考生",
    directChsiRetrievalStatus: "blocked-http-412-current-session",
    provenance: {
      aqnuPdfBytes: pdfBytes.byteLength,
      aqnuPdfSha256: pdfHash,
      independentMirrorPdfBytes: mirrorPdfBytes.byteLength,
      independentMirrorPdfSha256: sha256(mirrorPdfBytes),
      mirrorPdfsByteIdentical: true,
      aqnuPageHtmlBytes: pageHtmlBytes.byteLength,
      aqnuPageHtmlSha256: sha256(pageHtmlBytes),
      parsedHistoryRows: parsedBySubject["历史类"].length,
      parsedPhysicsRows: parsedBySubject["物理类"].length,
      duplicateScores: 0,
      scoreGaps: 0,
      cumulativeArithmeticErrors: 0,
    },
    cautions: [
      "历史类668分及以上仅保存公开的1-23名合并区间，物理类691分及以上仅保存1-43名合并区间，不生成档内伪精确位次。",
      "历史类和物理类均只公开至200分；199分及以下不向下外推。",
      "分档表统计人口含艺术、体育考生，但艺术体育录取使用综合分，艺术体育记录不连接本文化总分表。",
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
      pdfPages: 6,
      mirrorPdfsByteIdentical: true,
      duplicateIds: rankConversions.length - new Set(rankConversions.map((row) => row.id)).size,
      duplicateScores: 0,
      scoreGaps: 0,
      cumulativeArithmeticErrors: 0,
      scoreBasis: SCORE_BASIS,
      rankPolicyBonusIncluded: true,
      policyBonusTitleVerified: true,
      populationBoundaryVerified: true,
      tableSubjectSeparationVerified: true,
      allScoresContinuous: true,
      allCumulativeCountsClose: true,
      topMergedCandidates: { "历史类": 23, "物理类": 43 },
      publishedFloorRankEnd: { "历史类": 141400, "物理类": 320779 },
    },
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "ok",
    output: path.relative(PROJECT_ROOT, outFile),
    rows: rankConversions.length,
    subjects: sourceNote.subjectRecords,
    pdfSha256: pdfHash,
    scoreRange: sourceNote.scoreRange,
    rankRange: sourceNote.rankRange,
  }, null, 2));
}

main();
