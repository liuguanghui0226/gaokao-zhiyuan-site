#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_RAW = "data/admissions/raw/official-jiangsu-rank-conversion-2025-v3319";
const DEFAULT_OCR = `${DEFAULT_RAW}/jiangsu-first-stage-cell-ocr.json`;
const DEFAULT_OUT = "data/admissions/official-jiangsu-rank-conversion-2025-v3319-import.json";
const SOURCE_ID = "official-jiangsu-rank-2025-v3319";
const PROVINCE = "江苏";
const YEAR = 2025;
const OFFICIAL_INDEX_URL = "https://www.jseea.cn/webfile/index/index_zkxx/index_13.html";
const OFFICIAL_RELEASE_URL = "https://www.jseea.cn/webfile/index/index_zkxx/2025-06-24/7343234265133355008.html";
const OFFICIAL_HISTORY_IMAGE_URL = "https://www.jseea.cn/webfile/upload/2025/06-24/19-09-080264-1984111850.jpg";
const OFFICIAL_PHYSICS_IMAGE_URL = "https://www.jseea.cn/webfile/upload/2025/06-24/19-09-070773-818991274.jpg";
const CHSI_HISTORY_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202506/20250626/2293390984.html";
const CHSI_PHYSICS_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202506/20250626/2293390982.html";
const CHSI_HISTORY_IMAGE_URL = "https://t3.chei.com.cn/news/img/2293390985.jpg";
const CHSI_PHYSICS_IMAGE_URL = "https://t1.chei.com.cn/news/img/2293390983.jpg";
const DXSBB_HISTORY_URL = "https://www.dxsbb.com/news/148855.html";
const DXSBB_PHYSICS_URL = "https://www.dxsbb.com/news/148854.html";
const DXSBB_HISTORY_IMAGE_URL = "https://img.dxsbb.com/upFiles/infoImg/2025062668237161.png";
const DXSBB_PHYSICS_IMAGE_URL = "https://img.dxsbb.com/upFiles/infoImg/2025062668205065.png";
const SECOND_STAGE_URL = "https://www.jseea.cn/webfile/index/index_zkxx/2025-07-26/7354482513139470336.html";
const QUALITY = "official-jiangsu-education-examination-authority-image-chsi-byte-identical-dxsbb-pixel-equivalent-cross-verified";

const EVIDENCE = {
  "jseea-index.html": "d0e8b44693a6902e7cb80799dbd01d020d87a96432c20c58414d30b32244bf31",
  "jseea-release.html": "4ab30beb0ee4af6ea2293d91cee2f1f0bec356f6849f992173815437e742a702",
  "jseea-history.jpg": "e6a629b4c977d7c0358f638516854eee0b39c5c398ec64b25c6a2405d1632ecd",
  "jseea-physics.jpg": "fcff5805ada8cffd60879bfbc859c5c31d7a9a1cac0db47ad49d995594144058",
  "chsi-history.html": "2b281cedcfa8cad9271033c8b565d14ab722fcc7f619febaaced195683376f25",
  "chsi-physics.html": "942d1374a38175c341ceff63d9e3bf928f9e88512c10456ea72062204031cdb2",
  "chsi-history.jpg": "e6a629b4c977d7c0358f638516854eee0b39c5c398ec64b25c6a2405d1632ecd",
  "chsi-physics.jpg": "fcff5805ada8cffd60879bfbc859c5c31d7a9a1cac0db47ad49d995594144058",
  "dxsbb-history.html": "927fc32906f7403050a21da41dba19520c4306b3ccbf7acd248e14491368554d",
  "dxsbb-physics.html": "9eeb505cbfc453aa1080016263578182aa357c1437500c12f2a1a3fb0376599a",
  "dxsbb-history.png": "91d6465bb8011ca64d536ac2e8b2adb04dc34466b5c8cb631e1773acd605473f",
  "dxsbb-physics.png": "93c114c6914c850cd31959c22932c091ad3f6b55d53edf7915100d156c6f88ab",
  "jseea-history-tesseract.tsv": "5a745ba9c8d0dd15fb25b498ff5a086f57a61b8b73b9c8a7d8739d5f7c3c5482",
  "jseea-physics-tesseract.tsv": "55d9972a72fd36111b6857c98e5814a9e4158bbd7641e3a20d10d5113abf8ba5",
  "dxsbb-history-tesseract.tsv": "5a745ba9c8d0dd15fb25b498ff5a086f57a61b8b73b9c8a7d8739d5f7c3c5482",
  "dxsbb-physics-tesseract.tsv": "55d9972a72fd36111b6857c98e5814a9e4158bbd7641e3a20d10d5113abf8ba5",
  "jseea-second-stage.html": "2c076b6c3e5dd2249c316162a56ff9a73b7270683e66302a5c0ee766decb5211",
  "jseea-second-history.jpg": "e484030d2bc1ad9b3c6b1f583dd5d413b45bf62c01a14b29e706ef08c9d4ee98",
  "jseea-second-physics.jpg": "e18f1ca924c73eeb0965ffd51c4438790024a45fef4859d7e0e82b2b14f6fce1",
  "jseea-second-history-ocr.json": "6296ac730736eab2c1af3d11a62ee2a90edcd7dfd2cae6a3a7bd531ee6d389bb",
  "jseea-second-physics-ocr.json": "6407fd2a5ede8f710f4afaf83d5b3c5f1bf3f2e78d14742ce05c2dc38a739294",
  "mirror-history.pdf": "36d6f599efbb280a1074777b30c46edd808b45b9f3f24575318431d896cba631",
  "mirror-physics.pdf": "442da4f25a813f4c144f6cff91a54d2ebe84018baf0c4dbf5d7affb34b4425ae",
};

const SUBJECTS = [
  {
    subjectType: "历史类",
    key: "history",
    expectedRows: 177,
    topScore: 658,
    topRankEnd: 109,
    bottomScore: 482,
    bottomRankEnd: 56398,
    officialImageUrl: OFFICIAL_HISTORY_IMAGE_URL,
    chsiUrl: CHSI_HISTORY_URL,
    chsiImageUrl: CHSI_HISTORY_IMAGE_URL,
    mirrorUrl: DXSBB_HISTORY_URL,
    mirrorImageUrl: DXSBB_HISTORY_IMAGE_URL,
  },
  {
    subjectType: "物理类",
    key: "physics",
    expectedRows: 221,
    topScore: 683,
    topRankEnd: 126,
    bottomScore: 463,
    bottomRankEnd: 205975,
    officialImageUrl: OFFICIAL_PHYSICS_IMAGE_URL,
    chsiUrl: CHSI_PHYSICS_URL,
    chsiImageUrl: CHSI_PHYSICS_IMAGE_URL,
    mirrorUrl: DXSBB_PHYSICS_URL,
    mirrorImageUrl: DXSBB_PHYSICS_IMAGE_URL,
  },
];

function parseArgs(argv) {
  const args = { raw: DEFAULT_RAW, ocr: DEFAULT_OCR, out: DEFAULT_OUT };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--raw") args.raw = argv[++index];
    else if (argv[index] === "--ocr") args.ocr = argv[++index];
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

function cleanText(value) {
  return String(value ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;|\u00a0/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function pngDimensions(bytes) {
  assert(bytes.length >= 24 && bytes.subarray(1, 4).toString("ascii") === "PNG", "Invalid PNG evidence");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function jpegDimensions(bytes) {
  assert(bytes[0] === 0xff && bytes[1] === 0xd8, "Invalid JPEG evidence");
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
    }
    assert(length >= 2, "Invalid JPEG marker length");
    offset += 2 + length;
  }
  throw new Error("JPEG dimensions not found");
}

function makeId(subjectType, score) {
  const digest = sha256(`${YEAR}|${PROVINCE}|${subjectType}|${score}|${SOURCE_ID}`).slice(0, 16);
  return `${YEAR}-jiangsu-rank-${subjectType === "历史类" ? "history" : "physics"}-${digest}`;
}

function validateOcr(payload) {
  assert(payload.dataset === "official-jiangsu-rank-cell-ocr-v3319", `Unexpected OCR dataset ${payload.dataset}`);
  assert(payload.sources?.length === 2 && payload.sources[0].source === "official" && payload.sources[1].source === "mirror", "OCR source inventory drifted");
  assert(payload.comparison?.rowComparisons === 398 && payload.comparison?.cellComparisons === 1194 && payload.comparison?.differences === 0, "OCR source comparison drifted");
  assert(payload.audit?.officialRows === 398 && payload.audit?.mirrorRows === 398 && payload.audit?.allCountsClose === true, "OCR audit drifted");
  assert(payload.audit?.ocrCorrections === 15 && payload.audit?.lowConfidenceCells === 18, "OCR correction inventory drifted");
  for (const config of SUBJECTS) {
    const rows = payload.sources[0].subjects[config.subjectType];
    const mirrorRows = payload.sources[1].subjects[config.subjectType];
    assert(rows.length === config.expectedRows && mirrorRows.length === config.expectedRows, `${config.subjectType} OCR row count drifted`);
    assert(rows[0].score === config.topScore && rows[0].rankEnd === config.topRankEnd && rows[0].scoreRange?.max === 750, `${config.subjectType} top bucket drifted`);
    assert(rows.at(-1).score === config.bottomScore && rows.at(-1).rankEnd === config.bottomRankEnd, `${config.subjectType} bottom boundary drifted`);
    assert(rows.every((row, index) => index === 0 || rows[index - 1].score - row.score === 1), `${config.subjectType} scores are not contiguous`);
    assert(rows.every((row, index) => row.rankEnd - (index ? rows[index - 1].rankEnd : 0) === row.sameRankScore), `${config.subjectType} counts do not close`);
  }
}

function buildRankConversions(rows, config) {
  let previousRankEnd = 0;
  return rows.map((row) => {
    const record = {
      id: makeId(config.subjectType, row.score),
      province: PROVINCE,
      year: YEAR,
      subjectType: config.subjectType,
      dataType: "rank-conversion",
      score: row.score,
      rankStart: previousRankEnd + 1,
      rankEnd: row.rankEnd,
      sameRankScore: row.sameRankScore,
      sourceId: SOURCE_ID,
      sourceQuality: QUALITY,
      sourceUrl: OFFICIAL_RELEASE_URL,
      officialImageUrl: config.officialImageUrl,
      chsiPageUrl: config.chsiUrl,
      chsiImageUrl: config.chsiImageUrl,
      mirrorUrl: config.mirrorUrl,
      mirrorImageUrl: config.mirrorImageUrl,
      evidenceStage: "first-stage-full-cohort-eligible-candidates",
    };
    previousRankEnd = row.rankEnd;
    if (row.scoreRange) record.scoreRange = row.scoreRange;
    return record;
  });
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const rawDir = path.resolve(PROJECT_ROOT, args.raw);
  const ocrFile = path.resolve(PROJECT_ROOT, args.ocr);
  const outFile = path.resolve(PROJECT_ROOT, args.out);
  const raw = {};
  for (const [name, expectedHash] of Object.entries(EVIDENCE)) {
    const file = path.join(rawDir, name);
    assert(fs.existsSync(file), `Missing evidence file: ${file}`);
    raw[name] = fs.readFileSync(file);
    assert(sha256(raw[name]) === expectedHash, `${name} hash drifted`);
  }

  const officialIndexText = cleanText(raw["jseea-index.html"].toString("utf8"));
  const officialReleaseHtml = raw["jseea-release.html"].toString("utf8");
  assert(officialIndexText.includes("江苏省2025年普通高考第一阶段逐分段统计表"), "Official index entry is missing");
  assert(officialReleaseHtml.includes("7343234265133355008") && officialReleaseHtml.includes(OFFICIAL_HISTORY_IMAGE_URL.replace("https:", "http:")) && officialReleaseHtml.includes(OFFICIAL_PHYSICS_IMAGE_URL.replace("https:", "http:")), "Official first-stage image links are missing");

  for (const config of SUBJECTS) {
    const key = config.key;
    const officialImage = raw[`jseea-${key}.jpg`];
    const chsiImage = raw[`chsi-${key}.jpg`];
    assert(officialImage.equals(chsiImage), `${config.subjectType} CHSI image is not byte-identical to JSEEA`);
    assert(JSON.stringify(jpegDimensions(officialImage)) === JSON.stringify({ width: 1588, height: 4488 }), `${config.subjectType} official image dimensions drifted`);
    assert(JSON.stringify(pngDimensions(raw[`dxsbb-${key}.png`])) === JSON.stringify({ width: 1588, height: 4488 }), `${config.subjectType} mirror image dimensions drifted`);
    const chsiHtml = raw[`chsi-${key}.html`].toString("utf8");
    assert(cleanText(chsiHtml).includes("来源：江苏省教育考试院") && chsiHtml.includes(config.chsiImageUrl), `${config.subjectType} CHSI attribution or image link is missing`);
    const mirrorHtml = raw[`dxsbb-${key}.html`].toString("utf8");
    assert(mirrorHtml.includes(config.mirrorImageUrl), `${config.subjectType} mirror image link is missing`);
    assert(raw[`jseea-${key}-tesseract.tsv`].equals(raw[`dxsbb-${key}-tesseract.tsv`]), `${config.subjectType} full-image OCR streams differ between official JPEG and mirror PNG`);
  }

  const secondStageHtml = raw["jseea-second-stage.html"].toString("utf8");
  assert(cleanText(secondStageHtml).includes("江苏省2025年普通高考第二阶段逐分段统计表"), "Official second-stage boundary page is missing");
  for (const key of ["history", "physics"]) {
    const secondOcr = JSON.parse(raw[`jseea-second-${key}-ocr.json`].toString("utf8"));
    const joined = secondOcr.items.map((item) => item.text).join("");
    assert(joined.includes("符合第二阶段志愿填报条件考生"), `${key} second-stage eligibility boundary OCR is missing`);
  }

  const ocrPayload = JSON.parse(fs.readFileSync(ocrFile, "utf8"));
  validateOcr(ocrPayload);
  const official = ocrPayload.sources[0];
  const rankConversions = SUBJECTS.flatMap((config) => buildRankConversions(official.subjects[config.subjectType], config));
  assert(rankConversions.length === 398 && new Set(rankConversions.map((row) => row.id)).size === 398, "Jiangsu rank conversion inventory drifted");

  const generatedAt = new Date().toISOString();
  const sourceNote = {
    id: SOURCE_ID,
    title: "江苏省2025年普通高考第一阶段普通类逐分段统计表（历史、物理等科目类）",
    publisher: "江苏省教育考试院",
    province: PROVINCE,
    year: YEAR,
    url: OFFICIAL_RELEASE_URL,
    quality: QUALITY,
    usage: "用于把江苏2025第一阶段公布范围内、同科类普通高考录取最低分换算为全省累计位次区间；不冒充院校原表直接公布的录取最低位次。",
    parsedRecords: rankConversions.length,
    subjectBreakdown: { 历史类: 177, 物理类: 221 },
    firstStagePublishedFloor: { 历史类: 482, 物理类: 463 },
    provenance: {
      officialIndexUrl: OFFICIAL_INDEX_URL,
      officialReleaseUrl: OFFICIAL_RELEASE_URL,
      officialHistoryImageUrl: OFFICIAL_HISTORY_IMAGE_URL,
      officialPhysicsImageUrl: OFFICIAL_PHYSICS_IMAGE_URL,
      chsiHistoryUrl: CHSI_HISTORY_URL,
      chsiPhysicsUrl: CHSI_PHYSICS_URL,
      chsiImageByteIdentityVerified: true,
      dxsbbHistoryUrl: DXSBB_HISTORY_URL,
      dxsbbPhysicsUrl: DXSBB_PHYSICS_URL,
      dxsbbPixelEquivalentOcrVerified: true,
      secondStageUrl: SECOND_STAGE_URL,
      secondStageExcluded: true,
      secondStageExclusionReason: "第二阶段表仅统计仍符合第二阶段志愿填报条件的考生，不是全体同科类考生累计位次，不能与第一阶段累计位次拼接。",
      verification: "398 rows and 1194 score/count/cumulative-rank cells match between the JSEEA images and the independent full-size mirror; CHSI images are byte-identical to JSEEA; every row closes arithmetically after 15 disclosed OCR corrections.",
      rowComparisons: 398,
      cellComparisons: 1194,
      sourceDifferences: 0,
      ocrCorrections: 15,
      lowConfidenceCells: 18,
      allCountsClose: true,
      allCumulativeRanksStrictlyIncrease: true,
      imageDimensions: { 历史类: { width: 1588, height: 4488 }, 物理类: { width: 1588, height: 4488 } },
      evidenceSha256: EVIDENCE,
      ocrPayloadSha256: sha256(fs.readFileSync(ocrFile)),
    },
    evidenceBoundary: "The first-stage tables cover history scores 658-and-above through 482 and physics scores 683-and-above through 463 for candidates eligible for first-stage application. They support same-year cultural-score rank ranges only, not lower-score full-cohort ranks, second-stage remaining-candidate ranks, institution-native minimum admission ranks, or art/sports composite-score ranks.",
  };

  const payload = {
    dataset: "official-jiangsu-rank-conversion-2025-v3319-import",
    generatedAt,
    sourceId: SOURCE_ID,
    sourceNotes: [sourceNote],
    rankConversions,
    audit: {
      expectedRecords: 398,
      parsedRecords: rankConversions.length,
      duplicateIds: rankConversions.length - new Set(rankConversions.map((row) => row.id)).size,
      emittedRows: { 历史类: 177, 物理类: 221 },
      publishedFloors: { 历史类: 482, 物理类: 463 },
      rowComparisons: 398,
      cellComparisons: 1194,
      sourceDifferences: 0,
      ocrCorrections: 15,
      lowConfidenceCells: 18,
      allCountsClose: true,
      allCumulativeRanksStrictlyIncrease: true,
      chsiImagesByteIdentical: true,
      secondStageExcluded: true,
    },
    notes: [
      "历史类658-750分为1-109名合并档，物理类683-750分为1-126名合并档；不生成合并档内的伪精确位次。",
      "第一阶段全表只公布到历史类482分、物理类463分；低于公布下限的记录继续保持缺位次。",
      "第二阶段表只统计仍符合第二阶段志愿填报条件的考生，不是全体考生累计位次，已明确排除且不与第一阶段拼接。",
      "只用于同年同科类文化课总分到省级位次区间换算；艺术、体育综合投档分、科类不明、非整数分和特殊路径不参与。",
      "398行、1194个分数/同分人数/累计人数单元在考试院原图和独立全尺寸镜像间零差异；15处OCR校正均由固定分数网格或累计位次算术闭合恢复。",
    ],
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    ok: true,
    dataset: payload.dataset,
    rows: rankConversions.length,
    historyRows: 177,
    physicsRows: 221,
    rowComparisons: 398,
    cellComparisons: 1194,
    ocrCorrections: 15,
    out: path.relative(PROJECT_ROOT, outFile),
  }, null, 2));
}

main();
