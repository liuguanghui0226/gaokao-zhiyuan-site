#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DATASET = "official-shanghai-rank-conversion-2025-v3328-import";
const SOURCE_ID = "official-shanghai-rank-2025-v3328";
const PROVINCE = "上海";
const YEAR = 2025;
const SUBJECT_TYPE = "综合";
const SCORE_BASIS = "gaokao-total-including-policy-bonus";
const SOURCE_PAGE_URL = "https://www.shmeea.edu.cn/page/02200/20250623/19540.html";
const OFFICIAL_PDF_URL = "https://www.shmeea.edu.cn/download/202506230/2/0.pdf";
const POLICY_URL = "https://www.shmeea.edu.cn/page/06300/20250425/19280.html";
const FILING_URL = "https://www.shmeea.edu.cn/page/02200/20250719/19647.html";
const CROSS_CHECK_URL = "https://www.gk100.com/read_407945916.htm";
const SOURCE_QUALITY = "official-shanghai-exam-authority-image-pdf-gk100-html-cross-verified-policy-bonus-inclusive";

function parseArgs(argv) {
  const args = {
    pdf: "",
    html: "",
    pageHtml: "",
    policyHtml: "",
    filingHtml: "",
    out: "data/admissions/official-shanghai-rank-conversion-2025-v3328-import.json",
    pdftoppm: process.env.PDFTOPPM_BIN || "pdftoppm",
    tesseract: process.env.TESSERACT_BIN || "tesseract",
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--pdf") args.pdf = argv[++index];
    else if (argv[index] === "--html") args.html = argv[++index];
    else if (argv[index] === "--page-html") args.pageHtml = argv[++index];
    else if (argv[index] === "--policy-html") args.policyHtml = argv[++index];
    else if (argv[index] === "--filing-html") args.filingHtml = argv[++index];
    else if (argv[index] === "--out") args.out = argv[++index];
    else if (argv[index] === "--pdftoppm") args.pdftoppm = argv[++index];
    else if (argv[index] === "--tesseract") args.tesseract = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  for (const key of ["pdf", "html", "pageHtml", "policyHtml", "filingHtml"]) {
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

function normalizeRows(rows, label) {
  const byScore = new Map();
  for (const row of rows) {
    assert(!byScore.has(row.score), `${label} contains duplicate score ${row.score}`);
    byScore.set(row.score, row);
  }
  const sorted = [...byScore.values()].sort((left, right) => right.score - left.score);
  assert(sorted.length === 222, `${label} expected 222 rows, got ${sorted.length}`);
  assert(sorted[0].score === 623 && sorted.at(-1).score === 402, `${label} score boundaries drifted`);
  for (let index = 1; index < sorted.length; index += 1) {
    assert(sorted[index - 1].score - sorted[index].score === 1, `${label} score continuity failed at ${sorted[index - 1].score}`);
    assert(sorted[index].cumulative - sorted[index - 1].cumulative === sorted[index].people, `${label} cumulative arithmetic failed at ${sorted[index].score}`);
  }
  assert(sorted[0].people === 52 && sorted[0].cumulative === 52, `${label} top bucket drifted`);
  assert(sorted.at(-1).people === 207 && sorted.at(-1).cumulative === 49276, `${label} published floor drifted`);
  return sorted;
}

function parseHtmlRows(html) {
  const rows = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => stripHtml(cell[1]));
    if (cells.length < 3) continue;
    const scoreMatch = cells[0].match(/^(\d{3})/);
    if (!scoreMatch) continue;
    const score = Number(scoreMatch[1]);
    const people = Number(cells[1]);
    const cumulative = Number(cells[2]);
    if (score < 402 || score > 623 || !Number.isInteger(people) || !Number.isInteger(cumulative)) continue;
    rows.push({ score, people, cumulative });
  }
  return normalizeRows(rows, "Cross-check HTML");
}

function runOcr(pdfFile, pdftoppm, tesseract) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gaokao-shanghai-v3328-"));
  try {
    const prefix = path.join(tempDir, "page");
    const render = spawnSync(pdftoppm, ["-png", "-r", "220", pdfFile, prefix], {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
    assert(render.status === 0, `pdftoppm failed: ${render.stderr?.trim() || "unknown error"}`);
    const pageFiles = fs.readdirSync(tempDir)
      .filter((file) => /^page-\d+\.png$/.test(file))
      .sort((left, right) => Number(left.match(/\d+/)[0]) - Number(right.match(/\d+/)[0]));
    assert(pageFiles.length === 4, `Expected four rendered PDF pages, got ${pageFiles.length}`);

    const pageTexts = pageFiles.map((file) => {
      const result = spawnSync(tesseract, [path.join(tempDir, file), "stdout", "-l", "eng", "--psm", "4"], {
        cwd: PROJECT_ROOT,
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
      });
      assert(result.status === 0, `tesseract failed for ${file}: ${result.stderr?.trim() || "unknown error"}`);
      return result.stdout.normalize("NFKC");
    });
    return { pageTexts, pageCount: pageFiles.length };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function parseOcrRows(pageTexts) {
  const rows = [];
  for (const text of pageTexts) {
    for (const line of text.split(/\r?\n/)) {
      const numbers = line.match(/\d+/g)?.map(Number) || [];
      if (line.trim().startsWith("623") && numbers.at(-2) === 52 && numbers.at(-1) === 52) {
        rows.push({ score: 623, people: 52, cumulative: 52, raw: line });
      } else if (numbers.length === 3 && numbers[0] >= 402 && numbers[0] <= 622) {
        rows.push({ score: numbers[0], people: numbers[1], cumulative: numbers[2], raw: line });
      }
    }
  }
  const byScore = new Map();
  for (const row of rows) {
    assert(!byScore.has(row.score), `OCR contains duplicate score ${row.score}`);
    byScore.set(row.score, row);
  }
  return [...byScore.values()].sort((left, right) => right.score - left.score);
}

function stableId(row) {
  const digest = sha256(`${YEAR}|${PROVINCE}|${SUBJECT_TYPE}|${row.score}|${row.people}|${row.cumulative}|${SOURCE_ID}`).slice(0, 18);
  return `${YEAR}-shanghai-rank-v3328-${digest}`;
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const pdfFile = path.resolve(PROJECT_ROOT, args.pdf);
  const htmlFile = path.resolve(PROJECT_ROOT, args.html);
  const pageFile = path.resolve(PROJECT_ROOT, args.pageHtml);
  const policyFile = path.resolve(PROJECT_ROOT, args.policyHtml);
  const filingFile = path.resolve(PROJECT_ROOT, args.filingHtml);
  const outFile = path.resolve(PROJECT_ROOT, args.out);
  const pdfBytes = fs.readFileSync(pdfFile);
  const htmlBytes = fs.readFileSync(htmlFile);
  const pageBytes = fs.readFileSync(pageFile);
  const policyBytes = fs.readFileSync(policyFile);
  const filingBytes = fs.readFileSync(filingFile);
  const pageText = stripHtml(pageBytes.toString("utf8"));
  const policyText = stripHtml(policyBytes.toString("utf8"));
  const filingText = stripHtml(filingBytes.toString("utf8"));

  assert(pageText.includes("本科录取控制分数线上考生高考成绩分布表"), "Official source page does not identify the ordinary undergraduate score distribution");
  assert(policyText.includes("考生如获政策性加分，则计入高考成绩"), "Policy page does not close the policy-bonus score basis");
  assert(filingText.includes("将考生按照高考总分由高到低进行排序"), "Official filing explainer does not confirm total-score ordering");

  const htmlRows = parseHtmlRows(htmlBytes.toString("utf8"));
  const ocr = runOcr(pdfFile, args.pdftoppm, args.tesseract);
  const ocrRows = parseOcrRows(ocr.pageTexts);
  const ocrByScore = new Map(ocrRows.map((row) => [row.score, row]));
  const missingOcrRows = htmlRows.filter((row) => !ocrByScore.has(row.score));
  const ocrDifferences = [];
  for (const row of htmlRows) {
    const ocrRow = ocrByScore.get(row.score);
    if (!ocrRow) continue;
    for (const field of ["score", "people", "cumulative"]) {
      if (row[field] !== ocrRow[field]) {
        ocrDifferences.push({ score: row.score, field, officialOcr: ocrRow[field], crossCheckHtml: row[field], raw: ocrRow.raw });
      }
    }
  }
  assert(ocrRows.length === 221, `Expected 221 machine-readable official PDF rows, got ${ocrRows.length}`);
  assert(missingOcrRows.length === 1 && missingOcrRows[0].score === 621 && missingOcrRows[0].people === 11 && missingOcrRows[0].cumulative === 75, "Unexpected OCR-missing row");
  assert(
    ocrDifferences.length === 1
      && ocrDifferences[0].score === 563
      && ocrDifferences[0].field === "cumulative"
      && ocrDifferences[0].officialOcr === 1447
      && ocrDifferences[0].crossCheckHtml === 7447,
    `Unexpected official OCR differences: ${JSON.stringify(ocrDifferences)}`,
  );

  const rankConversions = htmlRows.map((row, index) => ({
    id: stableId(row),
    province: PROVINCE,
    year: YEAR,
    subjectType: SUBJECT_TYPE,
    dataType: "rank-conversion",
    score: row.score,
    rankStart: index === 0 ? 1 : htmlRows[index - 1].cumulative + 1,
    rankEnd: row.cumulative,
    sameRankScore: row.people,
    ...(row.score === 623 ? { scoreRange: [623, 660], topMerged: true } : {}),
    scoreBasis: SCORE_BASIS,
    rankPolicyBonusIncluded: true,
    sourceId: SOURCE_ID,
    sourceQuality: SOURCE_QUALITY,
    sourceUrl: SOURCE_PAGE_URL,
  }));
  assert(new Set(rankConversions.map((row) => row.id)).size === rankConversions.length, "Duplicate rank IDs");

  const generatedAt = new Date().toISOString();
  const sourceNote = {
    id: SOURCE_ID,
    title: "上海市2025年本科录取控制分数线上考生高考成绩分布表",
    publisher: "上海市教育考试院",
    url: SOURCE_PAGE_URL,
    attachmentUrls: [OFFICIAL_PDF_URL],
    relatedUrls: [POLICY_URL, FILING_URL, CROSS_CHECK_URL],
    quality: SOURCE_QUALITY,
    usage: "上海2025普通高考综合改革本科线上222个分数档；招生政策明确政策性加分计入高考成绩，普通批按高考总分排序。用于同年普通综合类最低分换算市级位次，艺术体育、特殊路径、历史/物理类标签、非整数分和本科线下分数不连接。",
    province: PROVINCE,
    year: YEAR,
    parsedRecords: rankConversions.length,
    pdfPages: ocr.pageCount,
    scoreRange: { min: 402, max: 623, topMergedMax: 660 },
    rankRange: { min: 1, max: 49276 },
    scoreBasis: SCORE_BASIS,
    rankPolicyBonusIncluded: true,
    publishedScoreFloor: 402,
    topMergedCandidates: 52,
    provenance: {
      officialPdfBytes: pdfBytes.byteLength,
      officialPdfSha256: sha256(pdfBytes),
      officialPageHtmlBytes: pageBytes.byteLength,
      officialPageHtmlSha256: sha256(pageBytes),
      policyHtmlBytes: policyBytes.byteLength,
      policyHtmlSha256: sha256(policyBytes),
      filingHtmlBytes: filingBytes.byteLength,
      filingHtmlSha256: sha256(filingBytes),
      crossCheckHtmlBytes: htmlBytes.byteLength,
      crossCheckHtmlSha256: sha256(htmlBytes),
      officialPdfOcrRows: ocrRows.length,
      crossCheckHtmlRows: htmlRows.length,
      comparedOcrCells: ocrRows.length * 3,
      ocrDifferences: ocrDifferences.length,
      missingOcrRows: missingOcrRows.length,
      retainedOcrCorrections: 2,
      cumulativeArithmeticClosed: true,
    },
    cautions: [
      "623分及以上仅保存公开的1-52名合并区间，不生成档内伪精确位次。",
      "401分及以下未在本科线上分布表公开，不向下外推。",
      "最低分换算位次不是院校录取表直接公布的原生最低位次。",
    ],
  };
  const payload = {
    dataset: DATASET,
    generatedAt,
    province: PROVINCE,
    year: YEAR,
    subjectType: SUBJECT_TYPE,
    sourceNotes: [sourceNote],
    rankConversions,
    audit: {
      parsedRecords: rankConversions.length,
      officialPdfPages: ocr.pageCount,
      officialPdfOcrRows: ocrRows.length,
      crossCheckHtmlRows: htmlRows.length,
      comparedOcrCells: ocrRows.length * 3,
      ocrDifferences,
      missingOcrRows,
      retainedOcrCorrections: 2,
      duplicateIds: rankConversions.length - new Set(rankConversions.map((row) => row.id)).size,
      scoreBasis: SCORE_BASIS,
      rankPolicyBonusIncluded: true,
      policyBonusRuleVerified: true,
      ordinaryFilingTotalScoreOrderVerified: true,
      allScoresContinuous: true,
      allCumulativeCountsClose: true,
      topMergedCandidates: 52,
      publishedFloorRankEnd: 49276,
    },
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "ok",
    output: path.relative(PROJECT_ROOT, outFile),
    rows: rankConversions.length,
    officialPdfOcrRows: ocrRows.length,
    comparedOcrCells: payload.audit.comparedOcrCells,
    retainedOcrCorrections: payload.audit.retainedOcrCorrections,
    scoreRange: sourceNote.scoreRange,
    rankRange: sourceNote.rankRange,
  }, null, 2));
}

main();
