#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const GENERATED_AT = "2026-07-16T19:45:00.000Z";
const SOURCE_ID = "official-ningxia-control-lines-2026";
const RANK_SOURCE_ID = "official-ningxia-rank-2026";
const CONTROL_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293847132.html";
const RANK_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293847211.html";
const RANK_HISTORY_URL = "https://t2.chei.com.cn/news/getfile/2293847237-2293847211-6e97879425ea63e133cf22df41989fef.pdf";
const RANK_PHYSICS_URL = "https://t2.chei.com.cn/news/getfile/2293847236-2293847211-cfba6e5fc57b5d9f67885f0b8626fe9a.pdf";
const CONTROL_IMAGES = {
  ordinary: "https://t1.chei.com.cn/news/img/2293847133.png",
  sports: "https://t3.chei.com.cn/news/img/2293847134.png",
  art: "https://t1.chei.com.cn/news/img/2293847135.png",
};
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/ningxia-2026");
const RELEASE_DIR = path.join(PROJECT_ROOT, "site/data/release-v3.275");
const OUTPUT_FILE = path.join(PROJECT_ROOT, "data/admissions/official-ningxia-control-lines-2026-import.json");

const EXPECTED = {
  chsiControlPage: { file: "chsi-control-lines.html", bytes: 44569, sha256: "223f1de3edf360047a1ea636884d345c776be02e8a8191e11d7b300ba16db13a" },
  ordinaryImage: { file: "control-ordinary.png", bytes: 7544, sha256: "4bb7ef514872495f4baf218f500ed3a9d498b4f98df81dddc19e785921cef724", width: 889, height: 261 },
  sportsImage: { file: "control-sports.png", bytes: 9619, sha256: "29dbbf62d165ba229e16cdb247b2bc6ead831d7eca20afccb9992f2242eeb3a9", width: 965, height: 257 },
  artImage: { file: "control-art.png", bytes: 27769, sha256: "2b0144c9945d9caacd94ea311212c4e944e5908b32f9fc6fced10c050b92fe14", width: 965, height: 1025 },
  chsiRankIndex: { file: "chsi-rank-index.html", bytes: 50887, sha256: "78ee2d541240b840a46227b348516c397810a664c62a48975449fa369a626a6d" },
  historyPdf: { file: "rank-history.pdf", bytes: 270336, sha256: "3c9ed5ff44c9841026873e4a405c951d2fa8b4207cc972d1362902ca5862f507" },
  historyText: { file: "rank-history.txt", bytes: 8393, sha256: "7bdf679654807071e3bca453c6bf2b4409899b759e453c823beba5e5b2716007" },
  physicsPdf: { file: "rank-physics.pdf", bytes: 271360, sha256: "19f9bd652b516435f4ded2ab92699881b987737b3c29a3ce8c891c69fcefa6b2" },
  physicsText: { file: "rank-physics.txt", bytes: 8796, sha256: "ae2c74d0f35566e2af6aad7cb8dae74de3aa52ed93f623498a3a01deb739b2b5" },
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
  if (Number.isFinite(expected.width)) {
    assert(bytes.subarray(1, 4).toString("ascii") === "PNG", `${expected.file} is not PNG`);
    assert(bytes.readUInt32BE(16) === expected.width && bytes.readUInt32BE(20) === expected.height, `${expected.file} dimensions drifted`);
  }
  return { ...expected };
}

function parseRankText(file) {
  const rows = [...fs.readFileSync(path.join(RAW_DIR, file), "utf8").matchAll(/(\d+)分\s+(\d+)/g)]
    .map((match) => ({ score: Number(match[1]), rankEnd: Number(match[2]) }))
    .sort((left, right) => right.score - left.score);
  for (let index = 0; index < rows.length; index += 1) {
    const previous = index ? rows[index - 1].rankEnd : 0;
    rows[index].rankStart = previous + 1;
    rows[index].sameRankScore = rows[index].rankEnd - previous;
  }
  return rows;
}

function rankUrlForSubject(subjectType) {
  if (subjectType === "历史类") return RANK_HISTORY_URL;
  if (subjectType === "物理类") return RANK_PHYSICS_URL;
  throw new Error(`Unexpected Ningxia rank subject: ${subjectType}`);
}

function verifyRankInventory() {
  const shard = readGzipJson(path.join(RELEASE_DIR, "ningxia.json.gz"));
  const core = readGzipJson(path.join(RELEASE_DIR, "knowledge-core.json.gz"));
  const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === RANK_SOURCE_ID);
  assert(sourceNote?.parsedRecords === 960, "Ningxia rank source inventory drifted");
  assert(sourceNote.url === RANK_URL, "Ningxia rank source URL drifted");
  assert(sourceNote.quality === "official-ningxia-rank-conversion-pdf", "Ningxia rank quality drifted");
  assert(sourceNote.attachmentUrls?.some((url) => url.includes("2293847237-2293847211-6e97879425ea63e133cf22df41989fef.pdf")), "Ningxia history rank PDF identity drifted");
  assert(sourceNote.attachmentUrls?.some((url) => url.includes("2293847236-2293847211-cfba6e5fc57b5d9f67885f0b8626fe9a.pdf")), "Ningxia physics rank PDF identity drifted");

  const diagnostics = [];
  for (const spec of [
    { subjectType: "历史类", file: "rank-history.txt", rows: 469, scoreMin: 150, scoreMax: 624, topRank: 53, finalRank: 19622, gapEvents: 5, omittedScores: 6 },
    { subjectType: "物理类", file: "rank-physics.txt", rows: 491, scoreMin: 154, scoreMax: 658, topRank: 53, finalRank: 44247, gapEvents: 7, omittedScores: 14 },
  ]) {
    const parsed = parseRankText(spec.file);
    const runtime = shard.rankConversions
      .filter((row) => row.year === 2026 && row.sourceId === RANK_SOURCE_ID && row.subjectType === spec.subjectType)
      .sort((left, right) => right.score - left.score);
    assert(parsed.length === spec.rows && runtime.length === spec.rows, `${spec.subjectType} rank row count drifted`);
    assert(parsed[0].score === spec.scoreMax && parsed[0].rankEnd === spec.topRank, `${spec.subjectType} top row drifted`);
    assert(parsed.at(-1).score === spec.scoreMin && parsed.at(-1).rankEnd === spec.finalRank, `${spec.subjectType} final row drifted`);
    const allUnlinked = runtime.every((row) => !row.sourceUrl);
    const allLinked = runtime.every((row) => row.sourceUrl === rankUrlForSubject(spec.subjectType));
    assert(allUnlinked || allLinked, `${spec.subjectType} rank URLs are partially applied or unexpected`);
    for (let index = 0; index < parsed.length; index += 1) {
      const expected = parsed[index];
      const actual = runtime[index];
      assert(actual.score === expected.score, `${spec.subjectType}/${index} score drifted`);
      assert(actual.rankStart === expected.rankStart && actual.rankEnd === expected.rankEnd && actual.sameRankScore === expected.sameRankScore, `${spec.subjectType}/${expected.score} rank values drifted`);
    }
    diagnostics.push({
      subjectType: spec.subjectType,
      rowsFullCrossChecked: parsed.length,
      scoreMin: spec.scoreMin,
      scoreMax: spec.scoreMax,
      topRank: spec.topRank,
      finalCumulative: spec.finalRank,
      officialZeroPersonGapEventsRetained: spec.gapEvents,
      officialZeroPersonScoresRetained: spec.omittedScores,
      valueDifferences: 0,
      rankRowsNeedingSourceUrlOnV3300Base: spec.rows,
    });
  }
  return diagnostics;
}

function recordId(row) {
  return `2026-ningxia-control-${sha256([row.subjectType, row.section, row.category, row.minScore, row.professionalMinScore ?? "", row.route].join("|")).slice(0, 18)}`;
}

function makeRecord(row) {
  const ordinary = row.route === "ordinary-bachelor" || row.route === "ordinary-vocational";
  const hasProfessional = Number.isFinite(row.professionalMinScore);
  const batch = row.route === "ordinary-bachelor"
    ? "普通类本科录取控制分数线"
    : row.route === "ordinary-vocational"
      ? "普通类高职（专科）录取控制分数线"
      : row.route === "special"
        ? "普通类特殊类型录取控制分数线"
        : `${row.category}${row.section}录取控制分数线`;
  return {
    id: recordId(row),
    province: "宁夏",
    year: 2026,
    subjectType: row.subjectType,
    batch,
    schoolName: "宁夏回族自治区2026年普通高校招生录取控制分数线",
    schoolTags: ["宁夏教育厅官方图片控制线", ordinary ? "普通类" : "特殊路径", row.category, row.section],
    city: "宁夏",
    dataType: "control-line",
    majorName: batch,
    majorGroup: row.category,
    minScore: row.minScore,
    cultureScoreLine: row.minScore,
    professionalMinScore: row.professionalMinScore,
    professionalScoreMaximum: row.route === "sports" ? 100 : hasProfessional ? 300 : undefined,
    scoreDimension: hasProfessional ? "culture-score" : "total-score",
    professionalScoreDimension: row.route === "sports" ? "ningxia-sports-test" : row.route === "art" ? "ningxia-art-unified-exam" : undefined,
    scoreBasis: ordinary || row.route === "special" ? "gaokao-total" : "culture-score",
    scoreMaximum: 750,
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: "official-chsi-mirror-ningxia-education-department-control-line-images-verified",
    sourceUrl: CONTROL_URL,
    sourceImageUrl: CONTROL_IMAGES[row.route === "sports" ? "sports" : row.route === "art" ? "art" : "ordinary"],
    formalScoreScope: ordinary ? "control-line-only" : "special-path-only",
    controlLineRouteKind: row.route,
    controlLineKind: batch,
    controlLineSection: row.section,
    cautions: ordinary ? [
      `这是宁夏2026年普通类${row.subjectType}${row.section}控制分数线，只用于判断对应普通批次基本资格边界。`,
      "控制线不是院校专业组、院校或专业投档线，也不是录取最低分、最低位次或录取概率。",
    ] : [
      `这是宁夏2026年${batch}，属于特殊类型、体育或艺术路径，不替代普通类控制线。`,
      hasProfessional ? `文化课和专业成绩必须分别达到 ${row.minScore} 分与 ${row.professionalMinScore} 分，两个分数维度不得相加或互相替代。` : "该记录保持 special-path-only，不进入普通类资格线或普通录取概率计算。",
    ],
    sourceFile: `data/admissions/raw/ningxia-2026/${row.route === "sports" ? "control-sports.png" : row.route === "art" ? "control-art.png" : "control-ordinary.png"}`,
    sourcePublishedAt: "2026-06-25",
  };
}

const evidence = Object.fromEntries(Object.entries(EXPECTED).map(([key, expected]) => [key, verifyFile(expected)]));
const controlHtml = fs.readFileSync(path.join(RAW_DIR, EXPECTED.chsiControlPage.file), "utf8");
const controlText = visibleHtmlText(Buffer.from(controlHtml));
const rankHtml = fs.readFileSync(path.join(RAW_DIR, EXPECTED.chsiRankIndex.file), "utf8");
assert(controlText.includes("宁夏回族自治区2026年普通高校招生录取控制分数线") && controlText.includes("来源：宁夏教育厅"), "Ningxia control title or publisher drifted");
for (const url of Object.values(CONTROL_IMAGES)) assert(controlHtml.includes(url), `Ningxia control image URL drifted: ${url}`);
assert(rankHtml.includes("2026年普通高考考生成绩一分段表（历史组）.pdf") && rankHtml.includes(RANK_HISTORY_URL), "Ningxia history rank PDF identity drifted");
assert(rankHtml.includes("2026年普通高考考生成绩一分段表（物理组）.pdf") && rankHtml.includes(RANK_PHYSICS_URL), "Ningxia physics rank PDF identity drifted");
const rankVerification = verifyRankInventory();

const ordinaryRows = [
  ["历史类", "本科", 393, "ordinary-bachelor"],
  ["历史类", "高职（专科）", 150, "ordinary-vocational"],
  ["物理类", "本科", 360, "ordinary-bachelor"],
  ["物理类", "高职（专科）", 150, "ordinary-vocational"],
];
const sportsRows = [
  ["历史类", "本科", 315, 73],
  ["历史类", "高职（专科）", 150, 60],
  ["物理类", "本科", 269, 73],
  ["物理类", "高职（专科）", 150, 60],
];
const artCategories = [
  ["音乐类", 295, 270],
  ["表（导）演类", 295, 270],
  ["播音与主持类", 295, 270],
  ["美术与设计类", 295, 270],
  ["书法类", 295, 270],
  ["舞蹈类", 275, 252],
  ["戏曲类", 197, 180],
];
const records = [
  ...ordinaryRows.map(([subjectType, section, minScore, route]) => makeRecord({ subjectType, section, category: "普通类", minScore, route })),
  makeRecord({ subjectType: "历史类", section: "特殊类型", category: "普通类特殊类型招生", minScore: 474, route: "special" }),
  makeRecord({ subjectType: "物理类", section: "特殊类型", category: "普通类特殊类型招生", minScore: 437, route: "special" }),
  ...sportsRows.map(([subjectType, section, minScore, professionalMinScore]) => makeRecord({ subjectType, section, category: "体育类", minScore, professionalMinScore, route: "sports" })),
  ...artCategories.flatMap(([category, historyBachelor, physicsBachelor]) => [
    makeRecord({ subjectType: "历史类", section: "本科", category, minScore: historyBachelor, professionalMinScore: 180, route: "art" }),
    makeRecord({ subjectType: "历史类", section: "高职（专科）", category, minScore: 150, professionalMinScore: 180, route: "art" }),
    makeRecord({ subjectType: "物理类", section: "本科", category, minScore: physicsBachelor, professionalMinScore: 180, route: "art" }),
    makeRecord({ subjectType: "物理类", section: "高职（专科）", category, minScore: 150, professionalMinScore: 180, route: "art" }),
  ]),
];

assert(records.length === 38, `Expected 38 records, got ${records.length}`);
assert(new Set(records.map((record) => record.id)).size === records.length, "Duplicate record ids detected");
assert(records.filter((record) => record.formalScoreScope === "control-line-only").length === 4, "Expected four ordinary records");
assert(records.filter((record) => record.formalScoreScope === "special-path-only").length === 34, "Expected 34 special-path records");
assert(records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 32, "Expected 32 sports/art dual-threshold records");

const payload = {
  dataset: "official-ningxia-control-lines-2026-import",
  generatedAt: GENERATED_AT,
  scope: { province: "宁夏", year: 2026, sourceKind: "official-content-mirror-control-line-images" },
  notes: [
    "宁夏2026普通历史本科/专科393/150分、物理本科/专科360/150分共4条进入普通资格路由。",
    "特殊类型2条、体育4条和艺术28条共34条保持 special-path-only。",
    "体育4条和艺术28条分别保存文化与专业数值门槛；两个分数维度不得相加或互相替代。",
    "既有960条宁夏普通类官方PDF位次与本轮重新下载的两份PDF逐行零差异，并补齐科类PDF URL；物理表最低154分，不为150分补造位次。",
  ],
  sourceNotes: [{
    id: SOURCE_ID,
    province: "宁夏",
    title: "宁夏回族自治区2026年普通高校招生录取控制分数线",
    publisher: "宁夏教育厅 / 阳光高考",
    publishedAt: "2026-06-25",
    url: CONTROL_URL,
    relatedUrls: [RANK_URL, ...Object.values(CONTROL_IMAGES), RANK_HISTORY_URL, RANK_PHYSICS_URL],
    quality: "official-chsi-mirror-ningxia-education-department-control-line-images-verified",
    usage: "抽取宁夏2026普通、特殊类型、体育和艺术控制线38条；仅4条普通类本专科记录参与普通考生资格路由。",
    parsedRecords: records.length,
    scoreMaximum: 750,
    originalPublisher: "宁夏教育厅",
    directMirrorRetrievalStatus: "success",
    evidence,
    rankEvidence: {
      sourceId: RANK_SOURCE_ID,
      records: 960,
      indexUrl: RANK_URL,
      historyUrl: RANK_HISTORY_URL,
      physicsUrl: RANK_PHYSICS_URL,
      fullPdfRowCrossCheck: rankVerification,
      valueChanges: 0,
      controlBoundaryCrossCheck: {
        history: { vocationalScore: 150, vocationalRankEnd: 19622, bachelorScore: 393, bachelorRankEnd: 9093, specialScore: 474, specialRankEnd: 3417 },
        physics: { vocationalScore: 150, vocationalRankEnd: null, publishedTableMinScore: 154, publishedTableMinRankEnd: 44247, bachelorScore: 360, bachelorRankEnd: 31395, specialScore: 437, specialRankEnd: 16994 },
      },
    },
    evidenceBoundary: "control-line-only=4; special-path-only=34; sports/art culture-and-professional dual-threshold rows=32; ordinary rank rows=960 full-PDF row cross-checked and values unchanged; physics 150 rank unavailable because official table ends at 154; not institution, major or admission probability",
  }],
  records,
  diagnostics: {
    recordCount: records.length,
    ordinaryRecords: 4,
    specialPathRecords: 34,
    professionalNumericRecords: 32,
    routeCounts: { "ordinary-bachelor": 2, "ordinary-vocational": 2, special: 2, sports: 4, art: 28 },
    ordinaryBoundaries: { historyBachelor: 393, historyVocational: 150, physicsBachelor: 360, physicsVocational: 150 },
    rankRecords: 960,
    rankRowsFullCrossChecked: 960,
    rankValueChanges: 0,
    officialZeroPersonGapEventsRetained: 12,
    officialZeroPersonScoresRetained: 20,
    scoreMaximum: 750,
  },
};

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "ok", out: path.relative(PROJECT_ROOT, OUTPUT_FILE), diagnostics: payload.diagnostics, evidence, rankVerification }, null, 2));
