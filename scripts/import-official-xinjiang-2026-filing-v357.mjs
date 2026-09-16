#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const TMP_ROOT = path.join(os.homedir(), ".codex", "tmp", "gaokao-xinjiang-2026-filing-v357");
const DEFAULT_OUT = "data/admissions/official-xinjiang-2026-filing-v357-import.json";
const DEFAULT_RAW_REL = "data/admissions/raw/official-xinjiang-2026-filing-v357";
const SOURCE_ID = "official-xinjiang-2026-filing-v357";
const PROVINCE = "新疆";
const YEAR = 2026;

export const PDF_SPECS = [
  {
    pdfId: "30282",
    pdfUrl: "https://www.xjzk.gov.cn/upload/resources/file/2026/07/24/30282.pdf",
    announcementUrl: "https://www.xjzk.gov.cn/c/2026-07-25/495625.shtml",
    batch: "本科一批",
    batchRaw: "普通类本科一批次",
    subjectType: "历史类",
    originalSubject: "文史",
    expectedRows: 231,
    expectedFilingScoreRows: 229,
    expectedNoFilingRows: 2,
    sha256: "bed27c058c04853adc988f3b7175677ca305df1bde77faa998b4f5633c857216",
  },
  {
    pdfId: "30283",
    pdfUrl: "https://www.xjzk.gov.cn/upload/resources/file/2026/07/24/30283.pdf",
    announcementUrl: "https://www.xjzk.gov.cn/c/2026-07-25/495625.shtml",
    batch: "本科一批",
    batchRaw: "普通类本科一批次",
    subjectType: "物理类",
    originalSubject: "理工",
    expectedRows: 395,
    expectedFilingScoreRows: 392,
    expectedNoFilingRows: 3,
    sha256: "b20c84d6f53cebda7b3b1cf41d3d0286e94b23af098846e4b38b29581cea1bc4",
  },
  {
    pdfId: "30341",
    pdfUrl: "https://www.xjzk.gov.cn/upload/resources/file/2026/08/05/30341.pdf",
    announcementUrl: "https://www.xjzk.gov.cn/c/2026-08-06/495728.shtml",
    batch: "本科二批",
    batchRaw: "普通类本科二批次",
    subjectType: "历史类",
    originalSubject: "文史",
    expectedRows: 512,
    expectedFilingScoreRows: 477,
    expectedNoFilingRows: 35,
    sha256: "3563056c88b86adf81a07de388ac6d4661a131bd1a57548ca4123db356c7cfe5",
  },
  {
    pdfId: "30342",
    pdfUrl: "https://www.xjzk.gov.cn/upload/resources/file/2026/08/05/30342.pdf",
    announcementUrl: "https://www.xjzk.gov.cn/c/2026-08-06/495728.shtml",
    batch: "本科二批",
    batchRaw: "普通类本科二批次",
    subjectType: "物理类",
    originalSubject: "理工",
    expectedRows: 660,
    expectedFilingScoreRows: 651,
    expectedNoFilingRows: 9,
    sha256: "c3e3d67fcd1a518d606e0de2dc33ac5f40fb885d1a064d9a844b89364922ed69",
  },
  {
    pdfId: "30407",
    pdfUrl: "https://www.xjzk.gov.cn/upload/resources/file/2026/08/17/30407.pdf",
    announcementUrl: "https://www.xjzk.gov.cn/c/2026-08-17/495830.shtml",
    batch: "高职（专科）批",
    batchRaw: "普通类高职（专科）批次",
    subjectType: "历史类",
    originalSubject: "文史",
    expectedRows: 646,
    expectedFilingScoreRows: 535,
    expectedNoFilingRows: 111,
    sha256: "5477e0a0437752d2b11b252783ed5567f545e062ec869bd989ffabcfeeab164d",
  },
  {
    pdfId: "30408",
    pdfUrl: "https://www.xjzk.gov.cn/upload/resources/file/2026/08/17/30408.pdf",
    announcementUrl: "https://www.xjzk.gov.cn/c/2026-08-17/495830.shtml",
    batch: "高职（专科）批",
    batchRaw: "普通类高职（专科）批次",
    subjectType: "物理类",
    originalSubject: "理工",
    expectedRows: 730,
    expectedFilingScoreRows: 667,
    expectedNoFilingRows: 63,
    sha256: "7e2f42bf7f73d484f0c7296646bcf19621fec92127ba3632b37ed1d85ff3336a",
  },
];

// Keep the expected totals explicit: they are the reconciliation contract for the six official PDFs.
export const EXPECTED_TOTALS = {
  records: 3174,
  filingScoreRecords: 2951,
  noFilingPlanRecords: 223,
  pdfs: 6,
};

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT, rawDir: DEFAULT_RAW_REL, useCache: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") args.out = argv[++index];
    else if (value === "--raw-dir") args.rawDir = argv[++index];
    else if (value === "--use-cache") args.useCache = true;
    else if (value === "--help" || value === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function invariant(condition, message) {
  if (!condition) throw new Error(`Xinjiang 2026 filing v3.357 audit failed: ${message}`);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hash(value, length = 18) {
  return sha256(String(value)).slice(0, length);
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function relativeProjectPath(file) {
  return path.relative(PROJECT_ROOT, file).replaceAll(path.sep, "/");
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error([`${command} ${args.join(" ")} failed with status ${result.status}`, result.stderr?.trim(), result.stdout?.trim()].filter(Boolean).join("\n"));
  }
  return result.stdout;
}

async function downloadBinary(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 gaokao-xinjiang-2026-filing-v357-importer/1.0",
      accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function downloadText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 gaokao-xinjiang-2026-filing-v357-importer/1.0", accept: "text/html,application/xhtml+xml" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

function parseNormalRow(line, spec) {
  const match = line.match(/^\s*(\d{3,5})\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/);
  if (!match) return null;
  const [, schoolCode, rawName, plan, filing, max, min, chinese, comprehensive, math] = match;
  return {
    pdfId: spec.pdfId,
    schoolCode,
    schoolName: cleanText(rawName),
    planCount: Number(plan),
    filingCount: Number(filing),
    maxScore: Number(max),
    minScore: Number(min),
    tieBreakScores: { totalScore: Number(min), chinese: Number(chinese), comprehensive: Number(comprehensive), math: Number(math) },
    noFiling: false,
  };
}

function parseNoFilingRow(line, spec) {
  const match = line.match(/^\s*(\d{3,5})\s+(.+?)\s+(\d+)\s+0\s*$/);
  if (!match) return null;
  const [, schoolCode, rawName, plan] = match;
  return {
    pdfId: spec.pdfId,
    schoolCode,
    schoolName: cleanText(rawName),
    planCount: Number(plan),
    filingCount: 0,
    maxScore: null,
    minScore: null,
    tieBreakScores: null,
    noFiling: true,
  };
}

export function parsePdfRows(text, spec) {
  const rows = [];
  for (const line of String(text).replaceAll("\r", "").split("\n")) {
    const row = parseNormalRow(line, spec) || parseNoFilingRow(line, spec);
    if (row) rows.push(row);
  }
  return rows;
}

function cautionsFor(spec, noFiling) {
  return [
    "本记录来自新疆教育考试院公开的2026年普通类院校投档 PDF；正式填报前仍须以省级最终目录复核。",
    noFiling
      ? "原表显示院校有招生计划但投档人数为0；本记录保留计划事实，不生成假分数、假位次，也不进入分数预测。"
      : "原表公开最高投档分、最低投档排序分及同分排序项，但未公开最低位次；本导入不生成假位次。",
    "院校投档线只能反映院校进档边界，不等同于专业录取结果或录取概率。",
  ];
}

export function recordFromPdfRow(row, spec, evidencePath = `data/admissions/raw/official-xinjiang-2026-filing-v357/${spec.pdfId}.pdf`) {
  const scoreOnly = !row.noFiling;
  const idBase = [YEAR, PROVINCE, spec.pdfId, spec.batch, spec.subjectType, row.schoolCode, row.schoolName, row.planCount, row.filingCount, row.minScore ?? "no-filing"].join("|");
  return {
    id: `${YEAR}-xinjiang-filing-v357-${hash(idBase)}`,
    province: PROVINCE,
    year: YEAR,
    subjectType: spec.subjectType,
    batch: spec.batch,
    batchRaw: spec.batchRaw,
    schoolName: row.schoolName,
    schoolCode: row.schoolCode,
    schoolTags: [],
    dataType: scoreOnly ? "institution-admission" : "admission-plan",
    majorName: scoreOnly ? `${spec.batch}普通类院校投档线` : `${spec.batch}普通类院校招生计划（未投档）`,
    majorCode: "",
    majorGroup: "",
    planCount: row.planCount,
    filingCount: row.filingCount,
    minScore: row.minScore,
    maxScore: row.maxScore,
    avgScore: null,
    minRankStart: null,
    minRankEnd: null,
    rankRangeText: "",
    scoreOnly,
    noFiling: row.noFiling,
    rankUnavailable: true,
    nativeAdmissionRankUnavailable: true,
    rankDerivedFromScore: false,
    rankEvidenceScope: "rank-unavailable",
    scoreMetric: row.noFiling ? "官方表显示投档人数为0，未形成投档分数" : `新疆教育考试院${YEAR}年${spec.batch}最低投档排序分`,
    rankMetric: row.noFiling ? "未投档，无最低分与最低位次" : "官方投档表未公开最低位次",
    tieBreakScores: row.tieBreakScores,
    sourceId: SOURCE_ID,
    sourceQuality: "official-xinjiang-2026-institution-filing-pdf-score-only-v357",
    sourceUrl: spec.pdfUrl,
    sourcePageUrl: spec.announcementUrl,
    officialEvidencePath: evidencePath,
    pdfId: spec.pdfId,
    originalSubject: spec.originalSubject,
    cautions: cautionsFor(spec, row.noFiling),
  };
}

function compact(value) {
  if (Array.isArray(value)) return value.map(compact).filter((item) => item !== undefined && item !== null && item !== "");
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, compact(item)]).filter(([, item]) => item !== undefined && item !== null && item !== ""));
  return value;
}

function parsePdfText(pdfFile) {
  return run("pdftotext", ["-layout", pdfFile, "-"]);
}

function summarizePdf(spec, rows, pdfFile, textFile, announcementFile) {
  const scoreRows = rows.filter((row) => !row.noFiling);
  return {
    pdfId: spec.pdfId,
    pdfUrl: spec.pdfUrl,
    announcementUrl: spec.announcementUrl,
    batch: spec.batch,
    subjectType: spec.subjectType,
    originalSubject: spec.originalSubject,
    path: relativeProjectPath(pdfFile),
    textPath: relativeProjectPath(textFile),
    announcementPath: relativeProjectPath(announcementFile),
    bytes: fs.statSync(pdfFile).size,
    sha256: sha256File(pdfFile),
    textSha256: sha256File(textFile),
    rowCandidates: rows.length,
    parsedRecords: rows.length,
    filingScoreRecords: scoreRows.length,
    noFilingPlanRecords: rows.length - scoreRows.length,
    minScore: Math.min(...scoreRows.map((row) => row.minScore)),
    maxScore: Math.max(...scoreRows.map((row) => row.maxScore)),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:\n  node scripts/import-official-xinjiang-2026-filing-v357.mjs --out ${DEFAULT_OUT}\n  node scripts/import-official-xinjiang-2026-filing-v357.mjs --use-cache`);
    return;
  }
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const rawDir = path.resolve(PROJECT_ROOT, args.rawDir);
  fs.mkdirSync(rawDir, { recursive: true });
  const records = [];
  const pdfNotes = [];
  const rawFiles = [];
  const seenAnnouncements = new Map();

  for (const spec of PDF_SPECS) {
    const pdfFile = path.join(rawDir, `${spec.pdfId}.pdf`);
    const textFile = path.join(rawDir, `${spec.pdfId}.txt`);
    const announcementFile = path.join(rawDir, `announcement-${spec.announcementUrl.split("/").at(-1)}.html`);
    if (!args.useCache || !fs.existsSync(pdfFile) || fs.statSync(pdfFile).size === 0) fs.writeFileSync(pdfFile, await downloadBinary(spec.pdfUrl));
    const pdfHash = sha256File(pdfFile);
    invariant(pdfHash === spec.sha256, `${spec.pdfId} PDF hash changed`);
    const text = parsePdfText(pdfFile);
    fs.writeFileSync(textFile, text, "utf8");
    if (!seenAnnouncements.has(spec.announcementUrl)) {
      const html = await downloadText(spec.announcementUrl);
      const file = path.join(rawDir, `announcement-${spec.announcementUrl.split("/").at(-1)}.html`);
      fs.writeFileSync(file, html, "utf8");
      seenAnnouncements.set(spec.announcementUrl, file);
    }
    const actualAnnouncementFile = seenAnnouncements.get(spec.announcementUrl);
    const rows = parsePdfRows(text, spec);
    invariant(rows.length === spec.expectedRows, `${spec.pdfId} expected ${spec.expectedRows} rows, got ${rows.length}`);
    invariant(rows.filter((row) => !row.noFiling).length === spec.expectedFilingScoreRows, `${spec.pdfId} filing-score count drifted`);
    invariant(rows.filter((row) => row.noFiling).length === spec.expectedNoFilingRows, `${spec.pdfId} no-filing count drifted`);
    records.push(...rows.map((row) => recordFromPdfRow(row, spec, relativeProjectPath(pdfFile))));
    pdfNotes.push(summarizePdf(spec, rows, pdfFile, textFile, actualAnnouncementFile));
  }

  const uniqueIds = new Set(records.map((record) => record.id));
  invariant(uniqueIds.size === records.length, "duplicate record IDs detected");
  invariant(records.length === EXPECTED_TOTALS.records, `expected ${EXPECTED_TOTALS.records} records, got ${records.length}`);
  invariant(records.filter((record) => record.scoreOnly).length === EXPECTED_TOTALS.filingScoreRecords, "filing-score total drifted");
  invariant(records.filter((record) => record.noFiling).length === EXPECTED_TOTALS.noFilingPlanRecords, "no-filing total drifted");
  invariant(records.every((record) => record.rankUnavailable && record.nativeAdmissionRankUnavailable && !record.rankDerivedFromScore && record.minRankStart === null && record.minRankEnd === null), "rank-unavailable boundary violated");
  invariant(records.filter((record) => record.scoreOnly).every((record) => Number.isInteger(record.planCount) && Number.isInteger(record.filingCount) && Number.isFinite(record.minScore) && Number.isFinite(record.maxScore) && record.minScore <= record.maxScore), "invalid filing-score row");
  invariant(records.filter((record) => record.noFiling).every((record) => record.dataType === "admission-plan" && record.scoreOnly === false && record.filingCount === 0 && record.planCount > 0 && record.minScore === null && record.maxScore === null && record.tieBreakScores === null), "invalid no-filing row");

  const generatedAt = new Date().toISOString();
  const evidenceFiles = [
    ...pdfNotes.flatMap((note) => [note.path, note.textPath]),
    ...[...new Set(pdfNotes.map((note) => note.announcementPath))],
  ].map((relativePath) => {
    const file = path.resolve(PROJECT_ROOT, relativePath);
    return { path: relativePath, bytes: fs.statSync(file).size, sha256: sha256File(file) };
  });
  const rawManifest = {
    dataset: "official-xinjiang-2026-filing-v357-raw",
    generatedAt,
    announcements: [...new Set(PDF_SPECS.map((spec) => spec.announcementUrl))],
    pdfs: pdfNotes,
    evidenceFiles,
    totals: {
      filesBeforeManifest: evidenceFiles.length,
      bytesBeforeManifest: evidenceFiles.reduce((sum, item) => sum + item.bytes, 0),
      rowCandidates: records.length,
      parsedRecords: records.length,
    },
  };
  const rawManifestPath = path.join(rawDir, "raw-manifest.json");
  fs.writeFileSync(rawManifestPath, `${JSON.stringify(rawManifest, null, 2)}\n`, "utf8");
  rawFiles.push(...evidenceFiles.map((item) => item.path), relativeProjectPath(rawManifestPath));

  const scoreRecords = records.filter((record) => record.scoreOnly);
  const noFilingRecords = records.filter((record) => record.noFiling);
  const sourceNote = {
    id: SOURCE_ID,
    title: "新疆维吾尔自治区2026年普通高考录取普通类平行志愿院校投档分数情况统计",
    publisher: "新疆教育考试院",
    url: PDF_SPECS[0].announcementUrl,
    indexUrl: "https://www.xjzk.gov.cn/",
    announcementUrls: [...new Set(PDF_SPECS.map((spec) => spec.announcementUrl))],
    pdfUrls: PDF_SPECS.map((spec) => spec.pdfUrl),
    year: YEAR,
    province: PROVINCE,
    quality: "official-xinjiang-2026-institution-filing-pdf-score-only-v357",
    usage: `官方普通类院校投档 PDF 明细，保留 ${scoreRecords.length} 条投档排序分和 ${noFilingRecords.length} 条投档人数为0的计划记录；无最低位次，不生成位次换算或录取概率。`,
    evidenceBoundary: "province-official ordinary filing score, plan/filing count and same-score tie-break components; no major result, minimum rank or admission probability",
    rawDir: relativeProjectPath(rawDir),
    rawFiles,
    pdfNotes,
    parsedRecords: records.length,
    filingScoreRecords: scoreRecords.length,
    noFilingPlanRecords: noFilingRecords.length,
    rankUnavailableRecords: records.length,
    scoreDerivedRankRecords: 0,
    emptySpecialPaths: ["专项、定向、预科、艺术、体育等非普通类路径未纳入本批次 PDF"],
  };
  const output = {
    dataset: "official-xinjiang-2026-filing-v357-import",
    generatedAt,
    scope: "新疆 2026 普通类本科一批、本科二批和高职（专科）批院校投档表",
    notes: [
      "Official Xinjiang Education Examination Authority PDFs are parsed from selectable text; source PDFs and hashes are recorded in the local raw manifest.",
      "The lowest filing sorting score is not a province-wide rank; rankUnavailable remains true for every record.",
      "Rows with filing count zero remain plan facts with noFiling=true and do not enter score-based recommendation boundaries.",
      "The layer covers ordinary parallel-filing tables only; special, targeted, preparatory and arts/sports paths require separate official evidence.",
    ],
    sourceNotes: [sourceNote],
    records: records.map(compact),
    audit: {
      pdfCount: PDF_SPECS.length,
      rowCandidates: records.length,
      parsedRecords: records.length,
      duplicateIds: records.length - uniqueIds.size,
      filingScoreRecords: scoreRecords.length,
      noFilingPlanRecords: noFilingRecords.length,
      rankUnavailableRecords: records.filter((record) => record.rankUnavailable).length,
      scoreDerivedRankRecords: records.filter((record) => record.rankDerivedFromScore).length,
      recordsWithPlanCount: records.filter((record) => Number.isInteger(record.planCount)).length,
      recordsWithFilingCount: records.filter((record) => Number.isInteger(record.filingCount)).length,
      recordsWithTieBreak: scoreRecords.filter((record) => record.tieBreakScores).length,
      byBatch: Object.fromEntries([...new Set(PDF_SPECS.map((spec) => spec.batch))].map((batch) => [batch, records.filter((record) => record.batch === batch).length])),
      bySubject: Object.fromEntries(["历史类", "物理类"].map((subjectType) => [subjectType, records.filter((record) => record.subjectType === subjectType).length])),
      minScore: Math.min(...scoreRecords.map((record) => record.minScore)),
      maxScore: Math.max(...scoreRecords.map((record) => record.maxScore)),
    },
  };
  const outPath = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "ok", version: "v3.357", out: relativeProjectPath(outPath), records: records.length, filingScoreRecords: scoreRecords.length, noFilingPlanRecords: noFilingRecords.length, pdfs: PDF_SPECS.length, sha256: sha256File(outPath) }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
