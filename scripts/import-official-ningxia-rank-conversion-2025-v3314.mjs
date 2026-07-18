#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_RAW = "data/admissions/raw/official-ningxia-rank-conversion-2025-v3314";
const DEFAULT_OUT = "data/admissions/official-ningxia-rank-conversion-2025-v3314-import.json";
const SOURCE_ID = "official-ningxia-rank-2025-v3314";
const OFFICIAL_INDEX_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202506/20250625/2293390695.html";
const PROVINCE = "宁夏";
const YEAR = 2025;

const SUBJECTS = [
  {
    key: "history",
    subjectType: "历史类",
    officialFilename: "01-2025年宁夏普通高考考生成绩一分段表（历史组）.pdf",
    pdfSha256: "e28bb509aa331e201474dfdb29fc6f804b6d1ba8228c71c049e11fdfb860286f",
    textSha256: "2ad7c43ce8313e7ea4fa86f50cb8d526ec67f499152ec6d356afe40eb9dedcf1",
    expectedRows: 467,
    topScore: 616,
    topRankEnd: 54,
    bottomScore: 150,
    bottomRankEnd: 21406,
    primaryMirrorUrl: "https://cdn.gaokzx.com/zixunzhan/1750823085127%E5%AE%81%E5%A4%8F%E5%8E%86%E5%8F%B2.pdf",
    secondMirrorUrl: "https://www.jhgk.cn/upload/file/20250625/1750842732662038889.pdf",
    checkpoints: { 482: 3415, 404: 9485, 150: 21406 },
  },
  {
    key: "physics",
    subjectType: "物理类",
    officialFilename: "02-2025年宁夏普通高考考生成绩一分段表（物理组）.pdf",
    pdfSha256: "4f3c76dcfe85d70836290cfc866480b2d10e8d8f8a634d3f2448ed8e326548c3",
    textSha256: "3bc16694464475a263840aa61e6e036b64ba52bbde3f0af8ca2ed8223be5e784",
    expectedRows: 492,
    topScore: 641,
    topRankEnd: 104,
    bottomScore: 150,
    bottomRankEnd: 44491,
    primaryMirrorUrl: "https://cdn.gaokzx.com/zixunzhan/1750822960933%E5%AE%81%E5%A4%8F%E7%89%A9%E7%90%86.pdf",
    secondMirrorUrl: "https://www.jhgk.cn/upload/file/20250625/1750842716111067904.pdf",
    checkpoints: { 441: 16119, 372: 30025, 150: 44491 },
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
  return `${YEAR}-nx-rank-${subject === "历史类" ? "history" : "physics"}-${digest}`;
}

function parseSubject(rawDir, config) {
  const pdfFile = path.join(rawDir, `${config.key}.pdf`);
  const mirrorFile = path.join(rawDir, `${config.key}-mirror2.pdf`);
  const textFile = path.join(rawDir, `${config.key}.txt`);
  for (const file of [pdfFile, mirrorFile, textFile]) assert(fs.existsSync(file), `Missing evidence file: ${file}`);

  const pdf = fs.readFileSync(pdfFile);
  const mirror = fs.readFileSync(mirrorFile);
  const text = fs.readFileSync(textFile);
  assert(sha256(pdf) === config.pdfSha256, `${config.subjectType} primary PDF hash drifted`);
  assert(sha256(mirror) === config.pdfSha256, `${config.subjectType} second mirror PDF is not byte-identical`);
  assert(sha256(text) === config.textSha256, `${config.subjectType} text-layer hash drifted`);

  const parsed = [...text.toString("utf8").matchAll(/(\d+)分以上\s+(\d+)/g)]
    .map((match) => ({ score: Number(match[1]), rankEnd: Number(match[2]) }))
    .sort((left, right) => right.score - left.score);
  assert(parsed.length === config.expectedRows, `${config.subjectType} expected ${config.expectedRows} rows, got ${parsed.length}`);
  assert(new Set(parsed.map((row) => row.score)).size === parsed.length, `${config.subjectType} contains duplicate score rows`);
  assert(parsed.every((row, index) => index === 0 || parsed[index - 1].score - row.score === 1), `${config.subjectType} score rows are not contiguous`);
  assert(parsed.every((row, index) => index === 0 || row.rankEnd >= parsed[index - 1].rankEnd), `${config.subjectType} cumulative ranks are not monotonic`);
  assert(parsed[0].score === config.topScore && parsed[0].rankEnd === config.topRankEnd, `${config.subjectType} top bucket drifted`);
  assert(parsed.at(-1).score === config.bottomScore && parsed.at(-1).rankEnd === config.bottomRankEnd, `${config.subjectType} bottom bucket drifted`);
  for (const [score, expected] of Object.entries(config.checkpoints)) {
    assert(parsed.find((row) => row.score === Number(score))?.rankEnd === expected, `${config.subjectType} checkpoint ${score} drifted`);
  }

  let previousRankEnd = 0;
  const rankConversions = parsed.map((row, index) => {
    const rankStart = previousRankEnd + 1;
    const sameRankScore = row.rankEnd - previousRankEnd;
    previousRankEnd = row.rankEnd;
    const record = {
      id: makeId(config.subjectType, row.score),
      province: PROVINCE,
      year: YEAR,
      subjectType: config.subjectType,
      dataType: "rank-conversion",
      score: row.score,
      rankStart,
      rankEnd: row.rankEnd,
      sameRankScore,
      sourceId: SOURCE_ID,
      sourceQuality: "official-ningxia-rank-conversion-pdf-mirror-verified",
      sourceUrl: OFFICIAL_INDEX_URL,
      attachmentUrl: config.primaryMirrorUrl,
      officialAttachmentFilename: config.officialFilename,
    };
    if (index === 0) record.scoreRange = { min: row.score, max: 750 };
    return record;
  });
  assert(rankConversions.reduce((sum, row) => sum + row.sameRankScore, 0) === config.bottomRankEnd, `${config.subjectType} same-score totals do not close`);

  return {
    config,
    rankConversions,
    evidence: {
      subjectType: config.subjectType,
      officialFilename: config.officialFilename,
      primaryMirrorUrl: config.primaryMirrorUrl,
      secondMirrorUrl: config.secondMirrorUrl,
      pdfBytes: pdf.byteLength,
      pdfSha256: sha256(pdf),
      secondMirrorByteIdentical: pdf.equals(mirror),
      textBytes: text.byteLength,
      textSha256: sha256(text),
      parsedRows: rankConversions.length,
      scoreRange: { min: config.bottomScore, max: config.topScore },
      topBucket: { scoreRange: `${config.topScore}-750`, rankStart: 1, rankEnd: config.topRankEnd },
      finalCumulativeRank: config.bottomRankEnd,
      checkpoints: config.checkpoints,
    },
  };
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const rawDir = path.resolve(PROJECT_ROOT, args.raw);
  const outFile = path.resolve(PROJECT_ROOT, args.out);
  const subjects = SUBJECTS.map((config) => parseSubject(rawDir, config));
  const rankConversions = subjects.flatMap((subject) => subject.rankConversions);
  assert(rankConversions.length === 959, `Expected 959 total rows, got ${rankConversions.length}`);
  assert(new Set(rankConversions.map((row) => row.id)).size === rankConversions.length, "Duplicate rank conversion IDs detected");

  const generatedAt = new Date().toISOString();
  const sourceNote = {
    id: SOURCE_ID,
    title: "宁夏2025年普通高考考生成绩一分一段表（历史组、物理组）",
    publisher: "宁夏教育考试院",
    province: PROVINCE,
    year: YEAR,
    url: OFFICIAL_INDEX_URL,
    quality: "official-ningxia-rank-conversion-pdf-mirror-verified",
    usage: "用于把宁夏2025院校投档最低分换算为同省、同年、同科类的全省位次区间；不冒充院校原表直接公布的录取最低位次。",
    parsedRecords: rankConversions.length,
    subjectBreakdown: Object.fromEntries(subjects.map(({ config, rankConversions: rows }) => [config.subjectType, rows.length])),
    officialFilenamesListedByChsi: SUBJECTS.map((subject) => subject.officialFilename),
    provenance: {
      authorityAuthored: true,
      officialIndexUrl: OFFICIAL_INDEX_URL,
      officialSiteDirectRetrievalStatus: "blocked-current-session-tls-timeout",
      mirrorVerification: "two-independent-domains-byte-identical-per-subject",
      primaryMirrorDomain: "cdn.gaokzx.com",
      secondMirrorDomain: "www.jhgk.cn",
      valueCrossCheck: "history 404=9485, 482=3415; physics 372=30025, 441=16119; both 150-point tails match published checkpoints",
    },
    evidence: Object.fromEntries(subjects.map(({ config, evidence }) => [config.subjectType, evidence])),
    evidenceBoundary: "The authority-authored PDFs publish provincial score-to-cumulative-rank tables. They do not publish any institution's native minimum admission rank; linked institution ranks are score-derived provincial segment ranges.",
  };
  const payload = {
    dataset: "official-ningxia-rank-conversion-2025-v3314-import",
    generatedAt,
    sourceId: SOURCE_ID,
    sourceNotes: [sourceNote],
    rankConversions,
    audit: {
      expectedRecords: 959,
      parsedRecords: rankConversions.length,
      duplicateIds: rankConversions.length - new Set(rankConversions.map((row) => row.id)).size,
      subjects: Object.fromEntries(subjects.map(({ config, evidence }) => [config.subjectType, evidence])),
      allScoreRowsContiguous: true,
      allCumulativeRanksMonotonic: true,
      bothMirrorPairsByteIdentical: subjects.every(({ evidence }) => evidence.secondMirrorByteIdentical),
    },
    notes: [
      "最高分行是官方合并档，历史类616分及以上仅能确定为1-54名，物理类641分及以上仅能确定为1-104名。",
      "一分一段表只负责分数到省级位次区间的换算；院校投档表未直接公开最低位次时，网站必须标注为分数换算位次。",
      "普通类和专项、预科、民族班继续按原投档记录的formalScoreScope隔离。",
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
    out: path.relative(PROJECT_ROOT, outFile),
  }, null, 2));
}

main();
