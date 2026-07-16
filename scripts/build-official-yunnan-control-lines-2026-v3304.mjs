#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const GENERATED_AT = "2026-07-16T22:25:00.000Z";
const SOURCE_ID = "official-yunnan-control-lines-2026";
const RANK_SOURCE_ID = "official-yunnan-rank-2026";
const CONTROL_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293847730.html";
const CONTROL_IMAGE_URL = "https://t4.chei.com.cn/news/img/2293847731.png";
const ART_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293847735.html";
const ART_IMAGE_URL = "https://t2.chei.com.cn/news/img/2293847736.png";
const RANK_URL = "https://gaokao.chsi.com.cn/gkxx/ss/202606/20260626/2293847808.html";
const RANK_IMAGE_URL = "https://t2.chei.com.cn/news/img/2293847809.png";
const ORIGINAL_RANK_URL = "https://www.ynzs.cn/html/content/8818.html";
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/yunnan-2026");
const RELEASE_DIR = path.join(PROJECT_ROOT, "site/data/release-v3.275");
const OUTPUT_FILE = path.join(PROJECT_ROOT, "data/admissions/official-yunnan-control-lines-2026-import.json");

const EXPECTED = {
  chsiControlPage: { file: "chsi-control-lines.html", bytes: 44167, sha256: "f7398a32eca5a5e5e04aba16ff71abffb5ad97628d3b49ddc87cf36e7fa1c676" },
  controlImage: { file: "control-lines.png", bytes: 44316, width: 754, height: 311, sha256: "3a8c9c72b0af918d8edafab3eac6b85bfe93d5513c7b9d11109b5b4ce48fb2e6" },
  chsiArtProfessionalPage: { file: "chsi-art-professional-lines.html", bytes: 44272, sha256: "e3210a24b5aa05223acc340be38fb122ff5554dc57df9153e853612b94287be7" },
  artProfessionalImage: { file: "art-professional-lines.png", bytes: 111538, width: 499, height: 612, sha256: "25b74f136750c48215999a47c0e8d62259abb3dd499cdca3f091247673eb4f4d" },
  chsiRankPage: { file: "chsi-rank-page.html", bytes: 43920, sha256: "5c5c569b734e4f293c40cb676780818c366fbdcb9bd62032076c5f2716266fc3" },
  rankImage: { file: "rank-table.png", bytes: 584926, width: 900, height: 8615, sha256: "2ab0fadc3af4f1d68ad15a14c5bf2a0514c5364723c12c2c32ff4224d7dc797a" },
};

const ART_THRESHOLDS = [
  ["音乐表演（声乐）", 130, 120],
  ["音乐表演（器乐）", 130, 120],
  ["音乐教育（声乐主项）", 130, 120],
  ["音乐教育（器乐主项）", 130, 120],
  ["美术与设计类", 185, 175],
  ["表（导）演类（戏剧影视表演方向）", 130, 130],
  ["表（导）演类（服装表演方向）", 185, 185],
  ["表（导）演类（戏剧影视导演方向）", 160, 160],
  ["舞蹈类", 120, 120],
  ["播音与主持类", 165, 165],
  ["书法类", 190, 190],
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function visibleHtmlText(value) {
  return value
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
  if (expected.width) {
    assert(bytes.subarray(1, 4).toString("ascii") === "PNG", `${expected.file} is not PNG`);
    assert(bytes.readUInt32BE(16) === expected.width && bytes.readUInt32BE(20) === expected.height, `${expected.file} dimensions drifted`);
  }
  return { ...expected };
}

function verifyRankInventory() {
  const shard = readGzipJson(path.join(RELEASE_DIR, "yunnan.json.gz"));
  const core = readGzipJson(path.join(RELEASE_DIR, "knowledge-core.json.gz"));
  const note = core.admissionScoreLayer.sourceNotes.find((item) => item.id === RANK_SOURCE_ID);
  assert(note?.parsedRecords === 986, "Yunnan rank source inventory drifted");
  assert(note.url === ORIGINAL_RANK_URL, "Yunnan original rank URL drifted");
  assert(note.quality === "official-yunnan-rank-conversion-image-tesseract-validated", "Yunnan rank quality drifted");
  assert(note.imageBytes === EXPECTED.rankImage.bytes && note.imageSha256 === EXPECTED.rankImage.sha256, "Yunnan stored official image identity drifted");
  assert(note.imageDimensions?.width === EXPECTED.rankImage.width && note.imageDimensions?.height === EXPECTED.rankImage.height, "Yunnan stored official image dimensions drifted");
  assert(note.ocr?.corrections === 32, "Yunnan retained OCR correction count drifted");

  const diagnostics = [];
  for (const spec of [
    { subjectType: "文科", rows: 482, scoreMin: 180, scoreMax: 661, topRank: 50, finalRank: 107628, ocrCorrections: 13 },
    { subjectType: "理科", rows: 504, scoreMin: 180, scoreMax: 683, topRank: 52, finalRank: 177823, ocrCorrections: 19 },
  ]) {
    const rows = shard.rankConversions
      .filter((row) => row.year === 2026 && row.sourceId === RANK_SOURCE_ID && row.subjectType === spec.subjectType)
      .sort((left, right) => right.score - left.score);
    assert(rows.length === spec.rows, `${spec.subjectType} rank row count drifted`);
    assert(rows[0].score === spec.scoreMax && rows[0].rankStart === 1 && rows[0].rankEnd === spec.topRank, `${spec.subjectType} top bucket drifted`);
    assert(rows[0].scoreRange?.min === spec.scoreMax && rows[0].scoreRange?.max === 750, `${spec.subjectType} top scoreRange drifted`);
    assert(rows.at(-1).score === spec.scoreMin && rows.at(-1).rankEnd === spec.finalRank, `${spec.subjectType} final row drifted`);
    assert(rows.every((row) => !row.sourceUrl) || rows.every((row) => row.sourceUrl === RANK_IMAGE_URL), `${spec.subjectType} rank URLs are partially applied or unexpected`);
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      assert(row.rankEnd - row.rankStart + 1 === row.sameRankScore, `${spec.subjectType}/${row.score} rank width drifted`);
      if (index) {
        assert(rows[index - 1].score - 1 === row.score, `${spec.subjectType}/${row.score} score continuity drifted`);
        assert(rows[index - 1].rankEnd + 1 === row.rankStart, `${spec.subjectType}/${row.score} rank continuity drifted`);
      }
    }
    diagnostics.push({
      subjectType: spec.subjectType,
      rowsInventoryChecked: rows.length,
      rowsContinuityChecked: rows.length,
      scoreMin: spec.scoreMin,
      scoreMax: spec.scoreMax,
      topRank: spec.topRank,
      finalCumulative: spec.finalRank,
      retainedOcrCorrections: spec.ocrCorrections,
      valueChanges: 0,
      rankRowsNeedingSourceUrlOnV3303Base: spec.rows,
    });
  }
  return diagnostics;
}

function recordId(row) {
  return `2026-yunnan-control-${sha256([row.subjectType, row.section, row.route, row.category, row.minScore, row.professionalMinScore ?? "", row.professionalQualification ?? ""].join("|")).slice(0, 18)}`;
}

function makeRecord(row) {
  const ordinary = ["ordinary-bachelor", "ordinary-vocational"].includes(row.route);
  const hasProfessional = Number.isFinite(row.professionalMinScore);
  const hasQualification = Boolean(row.professionalQualification);
  const batch = row.route === "ordinary-bachelor"
    ? "普通类本科批录取最低控制分数线"
    : row.route === "ordinary-vocational"
      ? "普通类高职（专科）批录取最低控制分数线"
      : row.route === "special"
        ? "特殊类型录取资格线"
        : row.route === "sports"
          ? `体育类${row.section}录取最低控制分数线`
          : `艺术类${row.section}（${row.category}）录取最低控制分数线`;
  return {
    id: recordId(row),
    province: "云南",
    year: 2026,
    subjectType: row.subjectType,
    batch,
    schoolName: "云南省2026年普通高校招生录取最低控制分数线",
    schoolTags: ["云南省招生考试院控制线", ordinary ? "普通类" : "特殊路径", row.category, row.section],
    city: "云南",
    dataType: "control-line",
    majorName: batch,
    majorGroup: row.category,
    minScore: row.minScore,
    cultureScoreLine: row.minScore,
    professionalMinScore: row.professionalMinScore,
    professionalQualification: row.professionalQualification,
    scoreDimension: hasProfessional ? "culture-and-professional" : hasQualification ? "culture-and-qualification" : "total-score",
    professionalScoreDimension: hasProfessional ? "yunnan-art-provincial-unified-score" : undefined,
    scoreBasis: ordinary || row.route === "special" ? "gaokao-total" : "culture-score",
    scoreMaximum: 750,
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: "official-chsi-mirror-yunnan-exam-authority-control-line-images-verified",
    sourceUrl: CONTROL_URL,
    sourceImageUrl: CONTROL_IMAGE_URL,
    sourceArtProfessionalUrl: row.route === "art" ? ART_URL : undefined,
    sourceArtProfessionalImageUrl: row.route === "art" ? ART_IMAGE_URL : undefined,
    formalScoreScope: ordinary ? "control-line-only" : "special-path-only",
    controlLineRouteKind: row.route,
    controlLineKind: batch,
    controlLineSection: row.section,
    cautions: ordinary ? [
      `这是云南省2026年普通${row.subjectType}${row.section}最低控制分数线，只用于判断对应普通批次基本资格边界。`,
      "控制线不是院校专业组、院校或专业投档线、录取最低分、最低位次或录取概率。",
    ] : [
      `这是云南省2026年${batch}，只适用于对应特殊类型、艺术或体育路径。`,
      hasProfessional ? `文化成绩和专业成绩必须分别达到 ${row.minScore} 分与 ${row.professionalMinScore} 分，两个维度不得相加或互相替代。` : hasQualification ? "本轮官方控制线图只给体育文化线，专业成绩仍须达到相应录取要求，不补造数值专业分。" : "本记录保持 special-path-only，不进入普通类资格计算。",
      "该边界不是具体院校专业组或专业录取分，仍须核对招生章程、选科、体检和资格要求。",
    ],
    sourceFile: row.route === "art" ? "data/admissions/raw/yunnan-2026/art-professional-lines.png" : "data/admissions/raw/yunnan-2026/control-lines.png",
    sourcePublishedAt: "2026-06-25",
  };
}

const evidence = Object.fromEntries(Object.entries(EXPECTED).map(([key, expected]) => [key, verifyFile(expected)]));
const controlHtml = fs.readFileSync(path.join(RAW_DIR, EXPECTED.chsiControlPage.file), "utf8");
const artHtml = fs.readFileSync(path.join(RAW_DIR, EXPECTED.chsiArtProfessionalPage.file), "utf8");
const rankHtml = fs.readFileSync(path.join(RAW_DIR, EXPECTED.chsiRankPage.file), "utf8");
assert(visibleHtmlText(controlHtml).includes("云南省2026年普通高校招生录取最低控制分数线") && controlHtml.includes("来源：云南省招生考试院"), "Yunnan control title or publisher drifted");
assert(controlHtml.includes(CONTROL_IMAGE_URL), "Yunnan control image URL drifted");
assert(visibleHtmlText(artHtml).includes("云南省2026年普通高校招生艺术类省级统考专业成绩录取最低控制分数线") && artHtml.includes(ART_IMAGE_URL), "Yunnan art professional evidence drifted");
assert(visibleHtmlText(rankHtml).includes("云南：2026年高考成绩分数段统计表") && rankHtml.includes(RANK_IMAGE_URL), "Yunnan rank mirror evidence drifted");
const rankVerification = verifyRankInventory();

const records = [
  makeRecord({ subjectType: "历史类", section: "本科", route: "ordinary-bachelor", category: "普通类", minScore: 465 }),
  makeRecord({ subjectType: "历史类", section: "高职（专科）", route: "ordinary-vocational", category: "普通类", minScore: 180 }),
  makeRecord({ subjectType: "物理类", section: "本科", route: "ordinary-bachelor", category: "普通类", minScore: 435 }),
  makeRecord({ subjectType: "物理类", section: "高职（专科）", route: "ordinary-vocational", category: "普通类", minScore: 180 }),
  makeRecord({ subjectType: "历史类", section: "特殊类型", route: "special", category: "特殊类型招生", minScore: 545 }),
  makeRecord({ subjectType: "物理类", section: "特殊类型", route: "special", category: "特殊类型招生", minScore: 505 }),
  ...["历史类", "物理类"].flatMap((subjectType) => ["本科", "高职（专科）"].flatMap((section) =>
    ART_THRESHOLDS.map(([category, bachelorProfessional, vocationalProfessional]) => makeRecord({
      subjectType,
      section,
      route: "art",
      category,
      minScore: section === "本科" ? (subjectType === "历史类" ? 345 : 325) : 180,
      professionalMinScore: section === "本科" ? bachelorProfessional : vocationalProfessional,
    }))
  )),
  ...[["历史类", "本科", 380], ["历史类", "高职（专科）", 180], ["物理类", "本科", 365], ["物理类", "高职（专科）", 180]]
    .map(([subjectType, section, minScore]) => makeRecord({
      subjectType,
      section,
      route: "sports",
      category: "体育类",
      minScore,
      professionalQualification: "体育类专业成绩达到云南省2026年相应录取要求",
    })),
];

assert(records.length === 54, `Expected 54 records, got ${records.length}`);
assert(new Set(records.map((record) => record.id)).size === records.length, "Duplicate record ids detected");
assert(records.filter((record) => record.formalScoreScope === "control-line-only").length === 4, "Expected four ordinary records");
assert(records.filter((record) => record.formalScoreScope === "special-path-only").length === 50, "Expected 50 special-path records");
assert(records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 44, "Expected 44 numeric art professional thresholds");
assert(records.filter((record) => record.professionalQualification).length === 4, "Expected four sports qualification records");
const routeCounts = Object.fromEntries([...new Set(records.map((record) => record.controlLineRouteKind))]
  .map((route) => [route, records.filter((record) => record.controlLineRouteKind === route).length]));

const payload = {
  dataset: "official-yunnan-control-lines-2026-import",
  generatedAt: GENERATED_AT,
  scope: { province: "云南", year: 2026, sourceKind: "official-chsi-mirror-control-line-images" },
  notes: [
    "云南2026普通历史本科/专科465/180分、物理本科/专科435/180分共4条进入普通资格路由。",
    "特殊类型2条、艺术44条和体育4条共50条保持 special-path-only。",
    "艺术44条把文化线与11类专业本科/专科统考线分列；体育4条只保存文化线与专业资格要求，不补造专业分。",
    "既有986条普通类位次对应的官方长图由阳光高考重新下载，字节、尺寸和SHA-256与库存官方图完全一致；保留32处OCR校正并补镜像图URL，位次数值零改动。",
  ],
  sourceNotes: [{
    id: SOURCE_ID,
    province: "云南",
    title: "云南省2026年普通高校招生录取最低控制分数线",
    publisher: "云南省招生考试院 / 阳光高考",
    publishedAt: "2026-06-25",
    url: CONTROL_URL,
    relatedUrls: [CONTROL_IMAGE_URL, ART_URL, ART_IMAGE_URL, RANK_URL, RANK_IMAGE_URL, ORIGINAL_RANK_URL],
    quality: "official-chsi-mirror-yunnan-exam-authority-control-line-images-verified",
    usage: "抽取云南2026普通、特殊类型、艺术和体育控制线54条；仅4条普通类本专科记录参与普通考生资格路由。",
    parsedRecords: records.length,
    scoreMaximum: 750,
    originalPublisher: "云南省招生考试院",
    directChsiMirrorRetrievalStatus: "success",
    directOriginalRankPageRetrievalStatus: "blocked-current-session-tls",
    evidence,
    rankEvidence: {
      sourceId: RANK_SOURCE_ID,
      records: 986,
      indexUrl: RANK_URL,
      imageUrl: RANK_IMAGE_URL,
      originalUrl: ORIGINAL_RANK_URL,
      imageByteIdentityWithStoredOfficialSource: true,
      inventoryAndContinuityCheck: rankVerification,
      retainedOcrCorrections: 32,
      valueChanges: 0,
      controlBoundaryCrossCheck: {
        history: { vocationalScore: 180, vocationalRankEnd: 107628, bachelorScore: 465, bachelorRankEnd: 43559, specialScore: 545, specialRankEnd: 13390, score600RankEnd: 2738, topBucketMin: 661, topBucketMax: 750, topBucketRankEnd: 50 },
        physics: { vocationalScore: 180, vocationalRankEnd: 177823, bachelorScore: 435, bachelorRankEnd: 118990, specialScore: 505, specialRankEnd: 67138, score600RankEnd: 11493, topBucketMin: 683, topBucketMax: 750, topBucketRankEnd: 52 },
      },
    },
    evidenceBoundary: "control-line-only=4; special-path-only=50; art culture-and-professional dual-threshold rows=44; sports culture-only qualification rows=4; ordinary rank rows=986 image-byte-identity and continuity checked; retained OCR corrections=32; not institution, major or admission probability",
  }],
  records,
  diagnostics: {
    recordCount: records.length,
    ordinaryRecords: 4,
    specialPathRecords: 50,
    professionalNumericRecords: 44,
    professionalQualificationRecords: 4,
    routeCounts,
    ordinaryBoundaries: { historyBachelor: 465, historyVocational: 180, physicsBachelor: 435, physicsVocational: 180 },
    rankRecords: 986,
    rankRowsInventoryChecked: 986,
    rankRowsContinuityChecked: 986,
    retainedOcrCorrections: 32,
    rankValueChanges: 0,
    scoreMaximum: 750,
  },
};

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "ok", out: path.relative(PROJECT_ROOT, OUTPUT_FILE), diagnostics: payload.diagnostics, evidence, rankVerification }, null, 2));
