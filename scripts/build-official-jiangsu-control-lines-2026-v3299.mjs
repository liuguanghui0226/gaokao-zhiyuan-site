#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const GENERATED_AT = "2026-07-16T17:45:00.000Z";
const SOURCE_ID = "official-jiangsu-control-lines-2026";
const RANK_SOURCE_ID = "official-jiangsu-rank-2026";
const CONTROL_URL = "https://www.jseea.cn/webfile/index/index_zkxx/2026-06-24/7475450259783553024.html";
const CONTROL_IMAGE_URL = "https://www.jseea.cn/webfile/upload/2026/06-24/14-41-220832-2001256129.jpg";
const RANK_PAGE_URL = "https://www.jseea.cn/webfile/index/index_zkxx/2026-06-24/7475494421979467776.html";
const RANK_HISTORY_URL = "https://www.jseea.cn/webfile/upload/2026/06-24/18-24-3205871556923388.jpg";
const RANK_PHYSICS_URL = "https://www.jseea.cn/webfile/upload/2026/06-24/18-24-3208191910823240.jpg";
const REMINDER_URL = "https://www.jseea.cn/webfile/index/index_zkxx/2026-06-10/7470370318775750656.html";
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/jiangsu-2026");
const RELEASE_DIR = path.join(PROJECT_ROOT, "site/data/release-v3.275");
const OUTPUT_FILE = path.join(PROJECT_ROOT, "data/admissions/official-jiangsu-control-lines-2026-import.json");

const EXPECTED = {
  controlPage: { file: "official-control-page.html", bytes: 14354, sha256: "d08db6c1748e2b762a93c3f035831e26280efd2cd6daad4a5dc934b3b2745ce5" },
  controlImage: { file: "official-control-lines.jpg", bytes: 230454, width: 1080, height: 626, sha256: "f4815a19ec6452887aa8007bb57c88f16ace5382ed4a25ab754ca1a3d81837b5" },
  rankPage: { file: "official-rank-page.html", bytes: 27615, sha256: "c0f44e2f60e32bc63e662b08ea136d9fba8c8015800e934ab0212dba54878441" },
  rankHistory: { file: "official-rank-history.jpg", bytes: 2285122, width: 1588, height: 4488, sha256: "c90751acf88c8cc0129f7cb11c0e48736832a39688bdbf98a49245313b2de46b" },
  rankPhysics: { file: "official-rank-physics.jpg", bytes: 3022147, width: 1588, height: 4488, sha256: "90b38029cd2e345c28400f1cfa9ebaf66030bec6e32b6a06070713fa5af56c96" },
  postExamReminder: { file: "official-post-exam-reminder.html", bytes: 19383, sha256: "0b2b70579bddad875ef43016e5f8c66ca50ecf20c778946956ab901a2c52ee95" },
};

const ART_ROWS = [
  ["音乐表演（声乐、器乐）", 330, 180],
  ["音乐教育（声乐、器乐）", 330, 180],
  ["舞蹈类", 279, 185],
  ["戏剧影视表演", 363, 190],
  ["服装表演", 363, 190],
  ["戏剧影视导演", 363, 190],
  ["播音与主持类", 390, 190],
  ["美术与设计类", 363, 180],
  ["书法类", 390, 210],
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

function jpegDimensions(buffer) {
  assert(buffer[0] === 0xff && buffer[1] === 0xd8, "Expected JPEG evidence");
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    const length = buffer.readUInt16BE(offset + 2);
    assert(length >= 2, "Invalid JPEG segment length");
    offset += 2 + length;
  }
  throw new Error("Could not read JPEG dimensions");
}

function verifyFile(expected) {
  const file = path.join(RAW_DIR, expected.file);
  const bytes = fs.readFileSync(file);
  assert(bytes.byteLength === expected.bytes, `${expected.file} byte count drifted: ${bytes.byteLength}`);
  assert(sha256(bytes) === expected.sha256, `${expected.file} SHA-256 drifted`);
  if (expected.width) {
    const size = jpegDimensions(bytes);
    assert(size.width === expected.width && size.height === expected.height, `${expected.file} dimensions drifted`);
  }
  return { ...expected };
}

function visibleHtmlText(buffer) {
  return buffer.toString("utf8")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;|&ensp;/gi, "")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, "");
}

function rankUrlForSubject(subjectType) {
  if (subjectType === "历史类") return RANK_HISTORY_URL;
  if (subjectType === "物理类") return RANK_PHYSICS_URL;
  throw new Error(`Unexpected Jiangsu rank subject: ${subjectType}`);
}

function verifyRankInventory() {
  const shard = readGzipJson(path.join(RELEASE_DIR, "jiangsu.json.gz"));
  const core = readGzipJson(path.join(RELEASE_DIR, "knowledge-core.json.gz"));
  const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === RANK_SOURCE_ID);
  assert(sourceNote?.parsedRecords === 408, "Jiangsu rank source inventory drifted");
  assert(sourceNote.url === RANK_PAGE_URL, "Jiangsu rank page URL drifted");
  assert(sourceNote.quality === "official-jiangsu-rank-conversion-image-vision-validated", "Jiangsu rank quality drifted");
  assert(sourceNote.imageUrls?.includes(RANK_HISTORY_URL) && sourceNote.imageUrls?.includes(RANK_PHYSICS_URL), "Jiangsu rank image URLs drifted");
  assert(sourceNote.ocrCorrections === 12, "Jiangsu OCR correction inventory drifted");
  const diagnostics = [];
  for (const spec of [
    { subjectType: "历史类", rows: 174, scoreMin: 484, scoreMax: 657, topRank: 104, finalRank: 54036, url: RANK_HISTORY_URL },
    { subjectType: "物理类", rows: 234, scoreMin: 456, scoreMax: 689, topRank: 110, finalRank: 217438, url: RANK_PHYSICS_URL },
  ]) {
    const rows = shard.rankConversions.filter((row) => row.year === 2026 && row.sourceId === RANK_SOURCE_ID && row.subjectType === spec.subjectType);
    assert(rows.length === spec.rows, `${spec.subjectType} rank row count drifted`);
    assert(rows[0].score === spec.scoreMax && rows[0].scoreRange?.min === spec.scoreMax && rows[0].scoreRange?.max === 750 && rows[0].rankEnd === spec.topRank, `${spec.subjectType} top bucket drifted`);
    assert(rows.at(-1).score === spec.scoreMin && rows.at(-1).rankEnd === spec.finalRank, `${spec.subjectType} final first-stage row drifted`);
    const allUnlinked = rows.every((row) => !row.sourceUrl);
    const allLinked = rows.every((row) => row.sourceUrl === spec.url);
    assert(allUnlinked || allLinked, `${spec.subjectType} rank URLs are partially applied or unexpected`);
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      assert(row.rankEnd - row.rankStart + 1 === row.sameRankScore, `${spec.subjectType}/${row.score} rank width drifted`);
      if (index) assert(rows[index - 1].rankEnd + 1 === row.rankStart, `${spec.subjectType}/${row.score} rank continuity drifted`);
    }
    diagnostics.push({
      subjectType: spec.subjectType,
      rowsInventoryChecked: rows.length,
      scoreMin: spec.scoreMin,
      scoreMax: spec.scoreMax,
      topRank: spec.topRank,
      finalCumulative: spec.finalRank,
      priorVisionCorrectionsRetained: sourceNote.subjects.find((row) => row.subjectType === spec.subjectType)?.ocrCorrections,
      valueDifferences: 0,
      rankRowsNeedingSourceUrlOnV3298Base: spec.rows,
    });
  }
  return diagnostics;
}

function recordId(row) {
  return `2026-jiangsu-control-${sha256([row.subjectType, row.section, row.category, row.minScore, row.professionalMinScore, row.route].join("|")).slice(0, 18)}`;
}

function makeRecord(row) {
  const ordinary = row.route === "ordinary-bachelor";
  const art = row.route === "art";
  const sports = row.route === "sports";
  const hasProfessionalScore = Number.isFinite(row.professionalMinScore);
  const hasProfessionalQualification = Boolean(row.professionalQualification);
  const category = row.category || "普通类";
  const batch = ordinary
    ? "普通类本科录取控制分数线"
    : row.route === "special"
      ? "特殊类型招生控制线"
      : sports
        ? "体育类本科统考文化课和专业省统考录取控制分数线"
        : row.route === "art-school-exam"
          ? "艺术类校考本科专业录取控制分数线"
          : row.route === "opera-joint-exam"
            ? "戏曲类省际联考本科专业录取控制分数线"
            : `艺术类本科统考（${category}）文化课和专业省统考录取控制分数线`;
  const cautions = ordinary ? [
    `这是江苏省2026年普通类${row.subjectType}本科第一阶段录取控制分数线，只用于判断普通本科基本资格边界。`,
    "江苏普通专科控制线将在第二阶段志愿填报前另行发布，本轮不得使用往年220分替代。",
    "控制线不是院校专业组投档线、院校录取线、专业录取最低分或最低位次。",
  ] : [
    `这是江苏省2026年${batch}，属于特殊或艺体路径，不替代普通本科控制线。`,
    hasProfessionalScore
      ? `文化成绩${row.minScore}分和专业成绩${row.professionalMinScore}分是两个独立门槛，不得相加。`
      : `文化成绩${row.minScore}分之外还须满足专业校考、省统考或省际联考要求。`,
    "该记录保持 special-path-only，不进入普通类资格线或普通录取概率计算。",
  ];
  return {
    id: recordId(row),
    province: "江苏",
    year: 2026,
    subjectType: row.subjectType,
    batch,
    schoolName: "江苏省2026年普通高校招生第一阶段录取控制分数线",
    schoolTags: ["江苏官方第一阶段控制线", ordinary ? "普通类" : "特殊路径", category, row.section],
    city: "江苏",
    dataType: "control-line",
    majorName: batch,
    majorGroup: category,
    minScore: row.minScore,
    cultureScoreLine: row.minScore,
    professionalMinScore: row.professionalMinScore,
    professionalScoreMetric: hasProfessionalScore ? (sports ? "体育类专业省统考" : "艺术类专业省统考") : undefined,
    professionalQualification: row.professionalQualification,
    scoreDimension: hasProfessionalScore ? "culture-and-professional" : hasProfessionalQualification ? "culture-and-qualification" : "total-score",
    scoreBasis: ordinary || row.route === "special" ? "gaokao-total" : "culture-score",
    scoreMaximum: 750,
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: "official-jiangsu-first-stage-control-line-image-manually-verified",
    sourceUrl: CONTROL_URL,
    formalScoreScope: ordinary ? "control-line-only" : "special-path-only",
    controlLineRouteKind: row.route,
    controlLineKind: batch,
    controlLineSection: row.section,
    cautions,
    sourceFile: "data/admissions/raw/jiangsu-2026/official-control-lines.jpg",
    sourcePublishedAt: "2026-06-24",
  };
}

const evidence = Object.fromEntries(Object.entries(EXPECTED).map(([key, expected]) => [key, verifyFile(expected)]));
const controlPageHtml = fs.readFileSync(path.join(RAW_DIR, EXPECTED.controlPage.file)).toString("utf8");
const rankPageHtml = fs.readFileSync(path.join(RAW_DIR, EXPECTED.rankPage.file)).toString("utf8");
const reminderText = visibleHtmlText(fs.readFileSync(path.join(RAW_DIR, EXPECTED.postExamReminder.file)));
assert(controlPageHtml.includes("江苏省2026年普通高校招生第一阶段录取控制分数线"), "Jiangsu control title is missing");
assert(controlPageHtml.includes("14-41-220832-2001256129.jpg"), "Jiangsu official control image link is missing");
assert(rankPageHtml.includes("江苏省2026年普通高考第一阶段逐分段统计表"), "Jiangsu rank title is missing");
assert(rankPageHtml.includes("18-24-3205871556923388.jpg") && rankPageHtml.includes("18-24-3208191910823240.jpg"), "Jiangsu ordinary rank image links are missing");
assert(reminderText.includes("第二阶段为7月27日至28日（截止时间为7月28日17:00），填报专科院校专业组志愿"), "Jiangsu second-stage vocational schedule drifted");
const rankVerification = verifyRankInventory();

const records = [
  makeRecord({ subjectType: "历史类", section: "本科", category: "普通类", minScore: 484, route: "ordinary-bachelor" }),
  makeRecord({ subjectType: "物理类", section: "本科", category: "普通类", minScore: 456, route: "ordinary-bachelor" }),
  makeRecord({ subjectType: "历史类", section: "本科", category: "特殊类型招生", minScore: 532, route: "special" }),
  makeRecord({ subjectType: "物理类", section: "本科", category: "特殊类型招生", minScore: 513, route: "special" }),
  makeRecord({ subjectType: "历史类", section: "本科", category: "体育类", minScore: 413, professionalMinScore: 110, route: "sports" }),
  makeRecord({ subjectType: "物理类", section: "本科", category: "体育类", minScore: 413, professionalMinScore: 110, route: "sports" }),
  ...["历史类", "物理类"].flatMap((subjectType) => ART_ROWS.map(([category, minScore, professionalMinScore]) => makeRecord({ subjectType, section: "本科", category, minScore, professionalMinScore, route: "art" }))),
  makeRecord({ subjectType: "历史类", section: "本科", category: "艺术类校考", minScore: 484, professionalQualification: "专业校考合格；参加对应省统考的考生还须达到音乐170、舞蹈175、表（导）演180、播音与主持180、美术与设计170、书法200分", route: "art-school-exam" }),
  makeRecord({ subjectType: "物理类", section: "本科", category: "艺术类校考", minScore: 456, professionalQualification: "专业校考合格；参加对应省统考的考生还须达到音乐170、舞蹈175、表（导）演180、播音与主持180、美术与设计170、书法200分", route: "art-school-exam" }),
  makeRecord({ subjectType: "历史类", section: "本科", category: "戏曲类省际联考", minScore: 242, professionalQualification: "戏曲类省际联考专业合格", route: "opera-joint-exam" }),
  makeRecord({ subjectType: "物理类", section: "本科", category: "戏曲类省际联考", minScore: 228, professionalQualification: "戏曲类省际联考专业合格", route: "opera-joint-exam" }),
];

assert(records.length === 28, `Expected 28 records, got ${records.length}`);
assert(new Set(records.map((record) => record.id)).size === records.length, "Duplicate record ids detected");
assert(records.filter((record) => record.formalScoreScope === "control-line-only").length === 2, "Expected two ordinary records");
assert(records.filter((record) => record.formalScoreScope === "special-path-only").length === 26, "Expected 26 special-path records");
assert(records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 20, "Expected 20 culture-professional records");
assert(records.filter((record) => record.professionalQualification).length === 4, "Expected four professional qualification rows");

const payload = {
  dataset: "official-jiangsu-control-lines-2026-import",
  generatedAt: GENERATED_AT,
  scope: { province: "江苏", year: 2026, sourceKind: "official-first-stage-control-lines" },
  notes: [
    "江苏2026普通类历史本科484分、物理本科456分进入普通本科资格路由；普通专科线将在第二阶段志愿填报前另行发布，保持pending。",
    "特殊类型2条、体育2条、艺术统考18条、艺术校考2条和戏曲省际联考2条共26条保持 special-path-only。",
    "20条艺体统考记录把文化分和专业省统考分分字段保存；校考和戏曲4条只保存专业合格要求，不补造专业分。",
    "既有408条江苏第一阶段普通类官方图片位次保留此前Vision校验和12处连续性纠正，本轮重新锁定两张官方图片哈希、复核行库存/连续性并补齐科类图片URL；本科线以下不估位。",
  ],
  sourceNotes: [{
    id: SOURCE_ID,
    province: "江苏",
    title: "江苏省2026年普通高校招生第一阶段录取控制分数线",
    publisher: "江苏省教育考试院",
    publishedAt: "2026-06-24",
    url: CONTROL_URL,
    relatedUrls: [CONTROL_IMAGE_URL, RANK_PAGE_URL, RANK_HISTORY_URL, RANK_PHYSICS_URL, REMINDER_URL],
    quality: "official-jiangsu-first-stage-control-line-image-manually-verified",
    usage: "抽取江苏2026第一阶段普通本科、特殊类型、体育和艺术控制线28条；仅2条普通类本科记录参与普通考生资格路由。",
    parsedRecords: records.length,
    scoreMaximum: 750,
    ordinaryVocationalStatus: "pending-official-release",
    ordinaryVocationalReason: "江苏省教育考试院明确2026年第二阶段于7月27日至28日填报专科院校专业组志愿；截至本轮仅发布第一阶段本科控制线，不使用2025年普通专科220分替代。",
    ordinaryVocationalSchedule: { fillingStartsAt: "2026-07-27", fillingEndsAt: "2026-07-28T17:00:00+08:00", sourceUrl: REMINDER_URL },
    evidence,
    manualVisualVerification: {
      verifiedAt: "2026-07-17",
      finding: "省考试院原图清晰显示普通本科历史484、物理456，特殊类型历史532、物理513，体育413/110，18条艺术统考双门槛、2条校考资格和戏曲省际联考历史242/物理228。",
    },
    rankEvidence: {
      sourceId: RANK_SOURCE_ID,
      records: 408,
      pageUrl: RANK_PAGE_URL,
      historyUrl: RANK_HISTORY_URL,
      physicsUrl: RANK_PHYSICS_URL,
      inventoryAndContinuityCheck: rankVerification,
      priorVisionCorrectionsRetained: 12,
      valueChanges: 0,
      controlBoundaryCrossCheck: {
        history: { bachelorScore: 484, bachelorRankEnd: 54036, specialScore: 532, specialRankEnd: 31312 },
        physics: { bachelorScore: 456, bachelorRankEnd: 217438, specialScore: 513, specialRankEnd: 145420 },
      },
    },
    evidenceBoundary: "control-line-only=2; special-path-only=26; ordinary vocational=pending before second-stage filing; culture-and-professional=20; professional-qualification=4; first-stage rank rows=408 official images rehashed, inventory/continuity checked and values unchanged; not institution-group, institution or major admission score",
  }],
  records,
  diagnostics: {
    recordCount: records.length,
    ordinaryRecords: 2,
    specialPathRecords: 26,
    cultureProfessionalRecords: 20,
    professionalQualificationRecords: 4,
    routeCounts: { "ordinary-bachelor": 2, special: 2, sports: 2, art: 18, "art-school-exam": 2, "opera-joint-exam": 2 },
    ordinaryBoundaries: { historyBachelor: 484, historyVocational: null, physicsBachelor: 456, physicsVocational: null },
    ordinaryVocationalStatus: "pending-official-release",
    rankRecords: 408,
    rankRowsInventoryChecked: 408,
    rankValueChanges: 0,
    scoreMaximum: 750,
  },
};

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "ok", out: path.relative(PROJECT_ROOT, OUTPUT_FILE), diagnostics: payload.diagnostics, evidence, rankVerification }, null, 2));
