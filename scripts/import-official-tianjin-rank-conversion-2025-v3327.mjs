#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DATASET = "official-tianjin-rank-conversion-2025-v3327-import";
const SOURCE_ID = "official-tianjin-rank-2025-v3327";
const PROVINCE = "天津";
const YEAR = 2025;
const SUBJECT_TYPE = "综合";
const SCORE_BASIS = "gaokao-total-including-policy-bonus";
const SOURCE_PAGE_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202506/20250624/2293390529.html";
const ORIGINAL_PDF_URL = "https://www.zhaokao.net/gkck/doc/003/000/107/00300010770_fff3e877.pdf";
const CHSI_PDF_URL = "https://www.chsi.com.cn/news/file.do?id=2293390530&method=downFile";
const EOL_URL = "https://gaokao.eol.cn/tian_jin/dongtai/202506/t20250623_2676457.shtml";
const POLICY_URL = "https://gaokao.chsi.com.cn/news/file.do?attach=true&hist=false&id=2293394044&method=downFile";
const SOURCE_QUALITY = "official-tianjin-exam-authority-chsi-pdf-eol-html-cross-verified-policy-bonus-inclusive";

function parseArgs(argv) {
  const args = {
    pdf: "",
    html: "",
    policyPdf: "",
    out: "data/admissions/official-tianjin-rank-conversion-2025-v3327-import.json",
    pdftotext: process.env.PDFTOTEXT_BIN || "pdftotext",
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--pdf") args.pdf = argv[++index];
    else if (argv[index] === "--html") args.html = argv[++index];
    else if (argv[index] === "--policy-pdf") args.policyPdf = argv[++index];
    else if (argv[index] === "--out") args.out = argv[++index];
    else if (argv[index] === "--pdftotext") args.pdftotext = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  for (const key of ["pdf", "html", "policyPdf"]) {
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

function runPdfText(binary, file) {
  const result = spawnSync(binary, ["-layout", file, "-"], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  assert(result.status === 0, `pdftotext failed for ${path.basename(file)}: ${result.stderr?.trim() || "unknown error"}`);
  assert(result.stdout.length > 100, `pdftotext output is too short for ${path.basename(file)}`);
  return result.stdout.normalize("NFKC");
}

function parsePdfRows(text) {
  const rows = [];
  const pattern = /(\d{3})(?:\s*及以上)?\s+(\d{1,6})\s+(\d{1,6})/g;
  for (const match of text.matchAll(pattern)) {
    const score = Number(match[1]);
    if (score < 300 || score > 680) continue;
    rows.push({ score, people: Number(match[2]), cumulative: Number(match[3]) });
  }
  return normalizeRows(rows, "PDF");
}

function stripHtml(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&gt;/gi, ">")
    .replace(/&lt;/gi, "<")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseHtmlRows(html) {
  const rows = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => stripHtml(cell[1]));
    if (cells.length !== 3) continue;
    const scoreMatch = cells[0].match(/^(\d{3})(?:-750)?$/);
    if (!scoreMatch) continue;
    const score = Number(scoreMatch[1]);
    const people = Number(cells[1]);
    const cumulative = Number(cells[2]);
    if (score < 300 || score > 680 || !Number.isInteger(people) || !Number.isInteger(cumulative)) continue;
    rows.push({ score, people, cumulative });
  }
  return normalizeRows(rows, "HTML");
}

function normalizeRows(rows, label) {
  const byScore = new Map();
  for (const row of rows) {
    assert(!byScore.has(row.score), `${label} contains duplicate score ${row.score}`);
    byScore.set(row.score, row);
  }
  const sorted = [...byScore.values()].sort((left, right) => right.score - left.score);
  assert(sorted.length === 381, `${label} expected 381 rows, got ${sorted.length}`);
  assert(sorted[0].score === 680 && sorted.at(-1).score === 300, `${label} score boundaries drifted`);
  for (let index = 1; index < sorted.length; index += 1) {
    assert(sorted[index - 1].score - sorted[index].score === 1, `${label} score continuity failed at ${sorted[index - 1].score}`);
    assert(sorted[index].cumulative - sorted[index - 1].cumulative === sorted[index].people, `${label} cumulative arithmetic failed at ${sorted[index].score}`);
  }
  assert(sorted[0].people === 656 && sorted[0].cumulative === 656, `${label} top bucket drifted`);
  assert(sorted.at(-1).people === 35 && sorted.at(-1).cumulative === 71938, `${label} published floor drifted`);
  return sorted;
}

function stableId(row) {
  const digest = sha256(`${YEAR}|${PROVINCE}|${SUBJECT_TYPE}|${row.score}|${row.people}|${row.cumulative}|${SOURCE_ID}`).slice(0, 18);
  return `${YEAR}-tianjin-rank-v3327-${digest}`;
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const pdfFile = path.resolve(PROJECT_ROOT, args.pdf);
  const htmlFile = path.resolve(PROJECT_ROOT, args.html);
  const policyFile = path.resolve(PROJECT_ROOT, args.policyPdf);
  const outFile = path.resolve(PROJECT_ROOT, args.out);
  const pdfBytes = fs.readFileSync(pdfFile);
  const htmlBytes = fs.readFileSync(htmlFile);
  const policyBytes = fs.readFileSync(policyFile);
  const pdfText = runPdfText(args.pdftotext, pdfFile);
  const policyText = runPdfText(args.pdftotext, policyFile);
  const html = htmlBytes.toString("utf8");

  assert(pdfText.replace(/\s+/g, "").includes("2025年普通高考总成绩分数档(含政策加分)"), "Official rank PDF does not state the policy-bonus basis");
  assert(policyText.replace(/\s+/g, "").includes("未经公示的考生及其加分项目、分值不得计入投档成绩并使用"), "Policy PDF does not close the filing-score bonus rule");
  const pdfRows = parsePdfRows(pdfText);
  const htmlRows = parseHtmlRows(html);
  const differences = [];
  for (let index = 0; index < pdfRows.length; index += 1) {
    for (const field of ["score", "people", "cumulative"]) {
      if (pdfRows[index][field] !== htmlRows[index][field]) {
        differences.push({ index, field, pdf: pdfRows[index][field], html: htmlRows[index][field] });
      }
    }
  }
  assert(differences.length === 0, `PDF/HTML comparison found ${differences.length} cell differences`);

  const rankConversions = pdfRows.map((row, index) => ({
    id: stableId(row),
    province: PROVINCE,
    year: YEAR,
    subjectType: SUBJECT_TYPE,
    dataType: "rank-conversion",
    score: row.score,
    rankStart: index === 0 ? 1 : pdfRows[index - 1].cumulative + 1,
    rankEnd: row.cumulative,
    sameRankScore: row.people,
    ...(row.score === 680 ? { scoreRange: [680, 750], topMerged: true } : {}),
    scoreBasis: SCORE_BASIS,
    rankPolicyBonusIncluded: true,
    sourceId: SOURCE_ID,
    sourceQuality: SOURCE_QUALITY,
    sourceUrl: SOURCE_PAGE_URL,
  }));
  assert(new Set(rankConversions.map((row) => row.id)).size === rankConversions.length, "Duplicate rank IDs");

  const generatedAt = new Date().toISOString();
  const payload = {
    dataset: DATASET,
    generatedAt,
    province: PROVINCE,
    year: YEAR,
    subjectType: SUBJECT_TYPE,
    sourceNotes: [
      {
        id: SOURCE_ID,
        title: "天津市2025年普通高考总成绩分数档（含政策加分）",
        publisher: "天津市教育招生考试院 / 阳光高考",
        url: SOURCE_PAGE_URL,
        originalPdfUrl: ORIGINAL_PDF_URL,
        attachmentUrls: [CHSI_PDF_URL],
        relatedUrls: [EOL_URL, POLICY_URL],
        quality: SOURCE_QUALITY,
        usage: "天津2025普通高考综合改革总成绩381个分数档；考试院原表标题明确含政策加分，政策文件明确审核通过的加分计入投档成绩。用于同年普通综合类最低分换算省级位次，特殊路径、历史/物理类标签和非整数分不连接。",
        province: PROVINCE,
        year: YEAR,
        parsedRecords: rankConversions.length,
        pdfPages: 2,
        scoreRange: { min: 300, max: 680, topMergedMax: 750 },
        rankRange: { min: 1, max: 71938 },
        scoreBasis: SCORE_BASIS,
        rankPolicyBonusIncluded: true,
        publishedScoreFloor: 300,
        topMergedCandidates: 656,
        directOfficialPdfRetrievalStatus: "blocked-current-session-tls",
        provenance: {
          officialOriginalPdfIndexed: true,
          chsiPdfBytes: pdfBytes.byteLength,
          chsiPdfSha256: sha256(pdfBytes),
          eolHtmlBytes: htmlBytes.byteLength,
          eolHtmlSha256: sha256(htmlBytes),
          policyPdfBytes: policyBytes.byteLength,
          policyPdfSha256: sha256(policyBytes),
          pdfRows: pdfRows.length,
          htmlRows: htmlRows.length,
          comparedCells: pdfRows.length * 3,
          valueDifferences: differences.length,
          cumulativeArithmeticClosed: true,
        },
        cautions: [
          "680分及以上仅保存公开的1-656名合并区间，不生成档内伪精确位次。",
          "299分及以下未在该表公开，不向下外推。",
          "最低分换算位次不是院校录取表直接公布的原生最低位次。",
        ],
      },
    ],
    rankConversions,
    audit: {
      parsedRecords: rankConversions.length,
      pdfRows: pdfRows.length,
      htmlRows: htmlRows.length,
      comparedCells: pdfRows.length * 3,
      valueDifferences: differences.length,
      duplicateIds: rankConversions.length - new Set(rankConversions.map((row) => row.id)).size,
      scoreBasis: SCORE_BASIS,
      rankPolicyBonusIncluded: true,
      policyBonusTitleVerified: true,
      policyBonusFilingRuleVerified: true,
      allScoresContinuous: true,
      allCumulativeCountsClose: true,
      topMergedCandidates: 656,
      publishedFloorRankEnd: 71938,
    },
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "ok",
    output: path.relative(PROJECT_ROOT, outFile),
    rows: rankConversions.length,
    comparedCells: payload.audit.comparedCells,
    valueDifferences: payload.audit.valueDifferences,
    scoreRange: payload.sourceNotes[0].scoreRange,
    rankRange: payload.sourceNotes[0].rankRange,
  }, null, 2));
}

main();
