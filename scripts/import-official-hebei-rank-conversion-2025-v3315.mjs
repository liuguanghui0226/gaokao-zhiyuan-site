#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_RAW = "data/admissions/raw/official-hebei-rank-conversion-2025-v3315";
const DEFAULT_OUT = "data/admissions/official-hebei-rank-conversion-2025-v3315-import.json";
const SOURCE_ID = "official-hebei-rank-2025-v3315";
const PROVINCE = "河北";
const YEAR = 2025;
const OFFICIAL_INDEX_URL = "http://www.hebeea.edu.cn/html/xxgl/tzgg/2025/0624-194513-559.html";
const OFFICIAL_PDF_URL = "https://file.hebeea.edu.cn/files/article/2025/06/20250624193800_658.pdf";
const EOL_INDEX_URL = "https://gaokao.eol.cn/he_bei/dongtai/202506/t20250624_2676842.shtml";
const MIRROR_URL = "https://985.zhidianwuli.com/qzgl/1759.html";
const PDF_SHA256 = "d4b2e17f81b3aeb80cdbe9e2b5fbdcc1318f4f57b0dbfb6a1b4707bb5f16f3e2";
const OCR_SHA256 = "6e57ba38389e4fc77faeac2d6bcf2bffa4a2897c08968d64499ee2840d8faead";
const MIRROR_SHA256 = "cdbaa423992e87def2b183f3e825ea143aa520f3edfd35f4ae87f8ae3a5fb6c9";

const SUBJECTS = [
  {
    key: "history",
    subjectType: "历史类",
    rankField: "historyRankEnd",
    expectedRows: 533,
    topScore: 672,
    topRankEnd: 35,
    bottomRankEnd: 243714,
    checkpoints: { 600: 6004, 527: 33954, 477: 64897, 200: 236503, 140: 243714 },
  },
  {
    key: "physics",
    subjectType: "物理类",
    rankField: "physicsRankEnd",
    expectedRows: 554,
    topScore: 693,
    topRankEnd: 32,
    bottomRankEnd: 363040,
    checkpoints: { 600: 27073, 499: 162246, 459: 224230, 200: 361477, 140: 363040 },
  },
];

function parseArgs(argv) {
  const args = { raw: DEFAULT_RAW, out: DEFAULT_OUT };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--raw") args.raw = argv[++index];
    else if (argv[index] === "--out") args.out = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return args;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function makeId(subject, score) {
  const digest = sha256(`${YEAR}|${PROVINCE}|${subject}|${score}|${SOURCE_ID}`).slice(0, 16);
  return `${YEAR}-hebei-rank-${subject === "历史类" ? "history" : "physics"}-${digest}`;
}

function parseMirror(html) {
  const rows = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((cell) => cell[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim());
    const score = Number(cells[0]?.match(/^\d{3}/)?.[0]);
    if (cells.length !== 5 || score < 140 || score > 693) continue;
    rows.push({
      score,
      physicsSameScore: Number(cells[1]),
      physicsRankEnd: Number(cells[2]),
      historySameScore: cells[3] ? Number(cells[3]) : null,
      historyRankEnd: cells[4] ? Number(cells[4]) : null,
    });
  }
  return rows;
}

function parseOcrTsv(text) {
  const lines = text.trim().split(/\r?\n/);
  assert(lines.shift() === "score\tphysicsRankEnd\thistoryRankEnd", "OCR TSV header drifted");
  return lines.map((line) => {
    const [score, physicsRankEnd, historyRankEnd] = line.split("\t");
    return {
      score: Number(score),
      physicsRankEnd: Number(physicsRankEnd),
      historyRankEnd: historyRankEnd ? Number(historyRankEnd) : null,
    };
  });
}

function validateCompleteTable(mirrorRows, ocrRows) {
  assert(mirrorRows.length === 554 && ocrRows.length === 554, "Expected 554 complete score rows in both sources");
  assert(mirrorRows.every((row, index) => row.score === 693 - index), "Mirror score rows are not contiguous from 693 to 140");
  assert(ocrRows.every((row, index) => row.score === 693 - index), "Official PDF OCR score rows are not contiguous from 693 to 140");
  let comparisons = 0;
  for (let index = 0; index < mirrorRows.length; index += 1) {
    for (const field of ["physicsRankEnd", "historyRankEnd"]) {
      assert(mirrorRows[index][field] === ocrRows[index][field], `Official PDF OCR and mirror differ at score ${mirrorRows[index].score} ${field}`);
      if (mirrorRows[index][field] !== null) comparisons += 1;
    }
  }
  assert(comparisons === 1087, `Expected 1087 cumulative-rank comparisons, got ${comparisons}`);
  return comparisons;
}

function buildSubject(mirrorRows, config) {
  const rows = mirrorRows.filter((row) => row.score <= config.topScore && Number.isInteger(row[config.rankField]));
  assert(rows.length === config.expectedRows, `${config.subjectType} expected ${config.expectedRows} rows, got ${rows.length}`);
  assert(rows[0].score === config.topScore && rows.at(-1).score === 140, `${config.subjectType} score boundary drifted`);
  assert(rows.every((row, index) => index === 0 || rows[index - 1].score - row.score === 1), `${config.subjectType} scores are not contiguous`);
  assert(rows.every((row, index) => index === 0 || row[config.rankField] >= rows[index - 1][config.rankField]), `${config.subjectType} cumulative ranks are not monotonic`);
  assert(rows[0][config.rankField] === config.topRankEnd && rows.at(-1)[config.rankField] === config.bottomRankEnd, `${config.subjectType} cumulative rank boundary drifted`);
  for (const [score, expected] of Object.entries(config.checkpoints)) {
    assert(rows.find((row) => row.score === Number(score))?.[config.rankField] === expected, `${config.subjectType} checkpoint ${score} drifted`);
  }

  let previousRankEnd = 0;
  const rankConversions = rows.map((row, index) => {
    const rankEnd = row[config.rankField];
    const rankStart = previousRankEnd + 1;
    const sameRankScore = rankEnd - previousRankEnd;
    const publishedSameScore = config.subjectType === "物理类" ? row.physicsSameScore : row.historySameScore;
    previousRankEnd = rankEnd;
    assert(sameRankScore === publishedSameScore, `${config.subjectType} score ${row.score} count does not close: ${sameRankScore} != ${publishedSameScore}`);
    const record = {
      id: makeId(config.subjectType, row.score),
      province: PROVINCE,
      year: YEAR,
      subjectType: config.subjectType,
      dataType: "rank-conversion",
      score: row.score,
      rankStart,
      rankEnd,
      sameRankScore,
      sourceId: SOURCE_ID,
      sourceQuality: "official-hebei-rank-conversion-pdf-ocr-full-table-cross-verified",
      sourceUrl: OFFICIAL_INDEX_URL,
      attachmentUrl: OFFICIAL_PDF_URL,
      officialAttachmentFilename: "2025年河北省普通高校招生物理科目组合、历史科目组合考生成绩统计表.pdf",
    };
    if (index === 0) record.scoreRange = { min: row.score, max: 750 };
    return record;
  });
  assert(rankConversions.reduce((sum, row) => sum + row.sameRankScore, 0) === config.bottomRankEnd, `${config.subjectType} same-score totals do not close`);
  return rankConversions;
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const rawDir = path.resolve(PROJECT_ROOT, args.raw);
  const outFile = path.resolve(PROJECT_ROOT, args.out);
  const pdfFile = path.join(rawDir, "official.pdf");
  const ocrFile = path.join(rawDir, "official-ocr.tsv");
  const mirrorFile = path.join(rawDir, "mirror.html");
  for (const file of [pdfFile, ocrFile, mirrorFile]) assert(fs.existsSync(file), `Missing evidence file: ${file}`);
  const pdf = fs.readFileSync(pdfFile);
  const ocr = fs.readFileSync(ocrFile);
  const mirror = fs.readFileSync(mirrorFile);
  assert(sha256(pdf) === PDF_SHA256, "Official PDF hash drifted");
  assert(sha256(ocr) === OCR_SHA256, "Official PDF OCR TSV hash drifted");
  assert(sha256(mirror) === MIRROR_SHA256, "Independent mirror HTML hash drifted");

  const mirrorRows = parseMirror(mirror.toString("utf8"));
  const ocrRows = parseOcrTsv(ocr.toString("utf8"));
  const fullTableComparisons = validateCompleteTable(mirrorRows, ocrRows);
  const subjects = SUBJECTS.map((config) => ({ config, rankConversions: buildSubject(mirrorRows, config) }));
  const rankConversions = subjects.flatMap((subject) => subject.rankConversions);
  assert(rankConversions.length === 1087, `Expected 1087 total rank rows, got ${rankConversions.length}`);
  assert(new Set(rankConversions.map((row) => row.id)).size === rankConversions.length, "Duplicate rank conversion IDs detected");

  const generatedAt = new Date().toISOString();
  const sourceNote = {
    id: SOURCE_ID,
    title: "河北省2025年普通高校招生物理科目组合、历史科目组合考生成绩统计表",
    publisher: "河北省教育考试院",
    province: PROVINCE,
    year: YEAR,
    url: OFFICIAL_INDEX_URL,
    quality: "official-hebei-rank-conversion-pdf-ocr-full-table-cross-verified",
    usage: "用于把河北2025同科类普通高考录取最低分换算为全省累计位次区间；不冒充院校原表直接公布的录取最低位次。",
    parsedRecords: rankConversions.length,
    subjectBreakdown: Object.fromEntries(subjects.map(({ config, rankConversions: rows }) => [config.subjectType, rows.length])),
    provenance: {
      authorityAuthored: true,
      officialIndexUrl: OFFICIAL_INDEX_URL,
      officialPdfUrl: OFFICIAL_PDF_URL,
      officialPdfPages: 18,
      officialPdfRetrieved: true,
      eolAuthorityIndexUrl: EOL_INDEX_URL,
      independentMirrorUrl: MIRROR_URL,
      verification: "all 1087 published cumulative-rank cells match between the 18-page authority PDF OCR and the independent structured mirror",
      fullTableComparisons,
      officialPdfSha256: PDF_SHA256,
      officialOcrSha256: OCR_SHA256,
      independentMirrorSha256: MIRROR_SHA256,
    },
    evidenceBoundary: "The authority PDF publishes provincial score-to-cumulative-rank tables. It does not publish any institution's native minimum admission rank; linked admission ranks remain score-derived provincial segment ranges.",
  };
  const payload = {
    dataset: "official-hebei-rank-conversion-2025-v3315-import",
    generatedAt,
    sourceId: SOURCE_ID,
    sourceNotes: [sourceNote],
    rankConversions,
    audit: {
      expectedRecords: 1087,
      parsedRecords: rankConversions.length,
      duplicateIds: rankConversions.length - new Set(rankConversions.map((row) => row.id)).size,
      officialPdfPages: 18,
      mirrorScoreRows: mirrorRows.length,
      officialOcrScoreRows: ocrRows.length,
      fullTableComparisons,
      fullTableDifferences: 0,
      allScoreRowsContiguous: true,
      allCumulativeRanksMonotonic: true,
      allPublishedCountsClose: true,
    },
    notes: [
      "物理类693分及以上为1-32名合并档，历史类672分及以上为1-35名合并档；不生成合并档内的伪精确位次。",
      "一分一档表只负责同年同省同科类的分数到省级位次区间换算，院校原表未公布位次时必须明确标注为最低分换算。",
      "仅历史类、物理类且使用普通高考总分口径的整数分记录可建立换算；艺术、体育、综合分和科类不明数据继续排除。",
    ],
  };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    ok: true,
    dataset: payload.dataset,
    rows: rankConversions.length,
    historyRows: subjects[0].rankConversions.length,
    physicsRows: subjects[1].rankConversions.length,
    fullTableComparisons,
    out: path.relative(PROJECT_ROOT, outFile),
  }, null, 2));
}

main();
