#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const SOURCE_ID = "official-anhui-control-lines-2026";
const SOURCE_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293847624.html";
const SOURCE_IMAGE_URL = "https://t2.chei.com.cn/news/img/2293847625.png";
const GOVERNMENT_URL = "https://www.huoqiu.gov.cn/public/6601621/38811837.html";
const GOVERNMENT_IMAGE_URL = "https://www.huoqiu.gov.cn/group3/M00/90/D2/wKgSG2o8mLeAOsXlAALgh6Li4p0518.png";
const TITLE = "安徽省2026年普通高校招生文化课录取控制分数线";
const QUALITY = "official-anhui-control-line-chsi-and-government-image-verified";
const GENERATED_AT = "2026-07-16T00:30:00.000Z";
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/official-anhui-control-lines-2026");

const evidence = {
  page: {
    url: SOURCE_URL,
    cache: "tmp/anhui-2026-chsi.html",
    raw: "control-lines-chsi.html",
    bytes: 44840,
    sha256: "1523c6a6a935cfe4b3ff284f694e8788a46e2edc836eb022dbd9cab56c3ae099",
  },
  image: {
    url: SOURCE_IMAGE_URL,
    cache: "tmp/anhui-2026-control-lines-chsi.png",
    raw: "control-lines-chsi.png",
    bytes: 119014,
    sha256: "9761df950662518da62273f02405988502f0c39c01a3d69ab24ae58be65fd04b",
  },
  governmentPage: {
    url: GOVERNMENT_URL,
    cache: "tmp/anhui-2026-control-lines-government.html",
    raw: "control-lines-government.html",
    bytes: 102094,
    sha256: "91f15a15e8083a049a6d032f6bd09d7bf633914b08111762fab3608a3cb44a9c",
  },
  governmentImage: {
    url: GOVERNMENT_IMAGE_URL,
    cache: "tmp/anhui-2026-control-lines-government.png",
    raw: "control-lines-government.png",
    bytes: 188551,
    sha256: "d33d0e946068916663584237da62cb0255143f598352ac4b1119a38f9e002e8e",
  },
};

const ordinaryRows = [
  { subjectType: "历史类", section: "本科", score: 490, route: "ordinary-bachelor" },
  { subjectType: "物理类", section: "本科", score: 451, route: "ordinary-bachelor" },
  { subjectType: "历史类", section: "高职（专科）", score: 200, route: "ordinary-vocational" },
  { subjectType: "物理类", section: "高职（专科）", score: 200, route: "ordinary-vocational" },
];

const specialRows = [
  { subjectType: "历史类", score: 522 },
  { subjectType: "物理类", score: 514 },
];

const sportsRows = [
  { subjectType: "历史类", section: "本科", score: 319 },
  { subjectType: "物理类", section: "本科", score: 293 },
  { subjectType: "历史类", section: "高职（专科）", score: 200 },
  { subjectType: "物理类", section: "高职（专科）", score: 200 },
];

const artCategories = [
  { name: "播音与主持类", cultureGroup: "播音与主持类", bachelor: { history: 490, physics: 451 }, vocational: 160, professional: { bachelor: 128, vocational: 128 } },
  { name: "美术与设计类", cultureGroup: "美术与设计类、书法类、音乐类（不含音乐表演专业）", bachelor: { history: 368, physics: 338 }, vocational: 160, professional: { bachelor: 154, vocational: 154 } },
  { name: "书法类", cultureGroup: "美术与设计类、书法类、音乐类（不含音乐表演专业）", bachelor: { history: 368, physics: 338 }, vocational: 160, professional: { bachelor: 201, vocational: 193 } },
  { name: "音乐教育类", cultureGroup: "美术与设计类、书法类、音乐类（不含音乐表演专业）", bachelor: { history: 368, physics: 338 }, vocational: 160, professional: { bachelor: 196, vocational: 196 } },
  { name: "音乐表演类（器乐方向）", cultureGroup: "舞蹈类、表（导）演类、音乐表演专业", bachelor: { history: 343, physics: 316 }, vocational: 160, professional: { bachelor: 196, vocational: 196 } },
  { name: "音乐表演类（声乐方向）", cultureGroup: "舞蹈类、表（导）演类、音乐表演专业", bachelor: { history: 343, physics: 316 }, vocational: 160, professional: { bachelor: 196, vocational: 196 } },
  { name: "舞蹈类", cultureGroup: "舞蹈类、表（导）演类、音乐表演专业", bachelor: { history: 343, physics: 316 }, vocational: 160, professional: { bachelor: 190, vocational: 190 } },
  { name: "表（导）演类（戏剧影视表演方向）", cultureGroup: "舞蹈类、表（导）演类、音乐表演专业", bachelor: { history: 343, physics: 316 }, vocational: 160, professional: { bachelor: 210, vocational: 189 } },
  { name: "表（导）演类（戏剧影视导演方向）", cultureGroup: "舞蹈类、表（导）演类、音乐表演专业", bachelor: { history: 343, physics: 316 }, vocational: 160, professional: { bachelor: 210, vocational: 189 } },
  { name: "表（导）演类（服装表演方向）", cultureGroup: "舞蹈类、表（导）演类、音乐表演专业", bachelor: { history: 343, physics: 316 }, vocational: 160, professional: { bachelor: 228, vocational: 206 } },
  { name: "戏曲类（省际联考）", cultureGroup: "戏曲类省际联考（本科）", bachelor: { history: 245, physics: 226 }, professionalRequirement: "戏曲类省际联考合格" },
];

function parseArgs(argv) {
  const args = {
    useCache: false,
    out: "data/admissions/official-anhui-control-lines-2026-import.json",
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--use-cache") args.useCache = true;
    else if (argv[index] === "--out") args.out = argv[++index];
  }
  return args;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function fetchBuffer(url) {
  const response = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 gaokao-evidence/3.285" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function loadEvidence(item, useCache) {
  const cacheFile = path.join(PROJECT_ROOT, item.cache);
  const bytes = useCache ? fs.readFileSync(cacheFile) : await fetchBuffer(item.url);
  assert(bytes.length === item.bytes, `${item.raw} byte count drifted: ${bytes.length}`);
  assert(sha256(bytes) === item.sha256, `${item.raw} SHA-256 drifted`);
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(path.join(RAW_DIR, item.raw), bytes);
  return bytes;
}

function recordId(fields) {
  return `2026-anhui-control-${sha256(fields.join("|")).slice(0, 18)}`;
}

function makeRecord({ subjectType, section, category, cultureGroup = category, score, professionalMinScore = null, professionalRequirement = "", route, ordinary = false }) {
  const kind = ordinary
    ? `普通类${section}文化课录取控制分数线`
    : route === "special" ? "特殊类型招生控制线" : `${category}${section}文化课录取控制分数线`;
  const id = recordId([subjectType, section, category, cultureGroup, score, professionalMinScore ?? "", professionalRequirement, route]);
  const ordinaryCautions = [
    "这是安徽省2026年普通类本科或高职（专科）文化课录取控制分数线，只用于判断普通批资格边界。",
    "控制线不是院校专业组投档线、专业录取最低分或最低位次，不能单独生成录取概率。",
    "达到控制线后仍须结合首选科目、再选科目、位次、院校专业组和招生章程核验。",
  ];
  const specialCautions = [
    "这是安徽省2026年对应特殊类别控制线，不适用于普通类考生直接推荐。",
    "艺术类须同时达到文化课线和对应省统考专业课线；体育类仍须按当年招生办法核验专业成绩。",
    "文化课分、艺术统考专业分和资格要求是不同维度，不得相加或互相替代。",
  ];
  return {
    id,
    province: "安徽",
    year: 2026,
    subjectType,
    batch: kind,
    schoolName: TITLE,
    schoolTags: ["安徽官方控制线", ordinary ? "普通类" : "特殊路径", category, section],
    city: "安徽",
    dataType: "control-line",
    majorName: kind,
    majorGroup: category,
    minScore: score,
    cultureScoreLine: score,
    professionalMinScore,
    professionalRequirement,
    cultureCategoryGroup: cultureGroup,
    scoreDimension: "culture-score",
    professionalScoreDimension: professionalMinScore === null ? "" : "anhui-art-unified-exam",
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: QUALITY,
    sourceUrl: SOURCE_URL,
    sourceMirrorUrl: GOVERNMENT_URL,
    formalScoreScope: ordinary ? "control-line-only" : "special-path-only",
    controlLineRouteKind: route,
    controlLineKind: kind,
    controlLineSection: section,
    cautions: ordinary ? ordinaryCautions : specialCautions,
    sourceFile: "data/admissions/raw/official-anhui-control-lines-2026/control-lines-chsi.png",
    sourcePublishedAt: "2026-06-25",
  };
}

function buildRecords() {
  const records = ordinaryRows.map((row) => makeRecord({
    subjectType: row.subjectType,
    section: row.section,
    category: "普通类",
    score: row.score,
    route: row.route,
    ordinary: true,
  }));
  records.push(...specialRows.map((row) => makeRecord({
    subjectType: row.subjectType,
    section: "特殊类型",
    category: "特殊类型招生",
    score: row.score,
    route: "special",
  })));
  records.push(...sportsRows.map((row) => makeRecord({
    subjectType: row.subjectType,
    section: row.section,
    category: "体育类",
    score: row.score,
    route: "sports",
  })));
  for (const category of artCategories) {
    for (const [subjectType, key] of [["历史类", "history"], ["物理类", "physics"]]) {
      records.push(makeRecord({
        subjectType,
        section: "本科",
        category: category.name,
        cultureGroup: category.cultureGroup,
        score: category.bachelor[key],
        professionalMinScore: category.professional?.bachelor ?? null,
        professionalRequirement: category.professionalRequirement || "",
        route: "art",
      }));
      if (Number.isFinite(category.vocational)) {
        records.push(makeRecord({
          subjectType,
          section: "高职（专科）",
          category: category.name,
          cultureGroup: category.cultureGroup,
          score: category.vocational,
          professionalMinScore: category.professional.vocational,
          route: "art",
        }));
      }
    }
  }
  return records;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loaded = {};
  for (const [key, item] of Object.entries(evidence)) loaded[key] = await loadEvidence(item, args.useCache);
  assert(loaded.image.subarray(1, 4).toString("ascii") === "PNG", "CHSI evidence is not a PNG image");
  assert(loaded.governmentImage.subarray(1, 4).toString("ascii") === "PNG", "Government evidence is not a PNG image");
  const records = buildRecords();
  assert(records.length === 52, `Expected 52 records, got ${records.length}`);
  assert(new Set(records.map((record) => record.id)).size === records.length, "Duplicate record ids detected");
  const routeCounts = Object.fromEntries([...new Set(records.map((record) => record.controlLineRouteKind))]
    .map((route) => [route, records.filter((record) => record.controlLineRouteKind === route).length]));
  const payload = {
    dataset: "official-anhui-control-lines-2026-import",
    generatedAt: GENERATED_AT,
    sourceNotes: [{
      id: SOURCE_ID,
      title: TITLE,
      publisher: "安徽省教育招生考试院",
      host: "教育部阳光高考信息平台",
      publishedAt: "2026-06-25",
      url: SOURCE_URL,
      mirrorUrl: GOVERNMENT_URL,
      quality: QUALITY,
      usage: "抽取安徽2026普通类、艺术类、体育类和特殊类型控制线52条；仅4条普通类记录参与普通考生本专科边界路由，艺术类文化课和省统考专业课双重门槛保持分列。",
      parsedRecords: records.length,
      pageHtmlBytes: evidence.page.bytes,
      pageHtmlSha256: evidence.page.sha256,
      imageBytes: evidence.image.bytes,
      imageSha256: evidence.image.sha256,
      governmentPageHtmlBytes: evidence.governmentPage.bytes,
      governmentPageHtmlSha256: evidence.governmentPage.sha256,
      governmentImageBytes: evidence.governmentImage.bytes,
      governmentImageSha256: evidence.governmentImage.sha256,
      evidenceBoundary: "control-line-only; ordinary=4; special-path-only=48; culture score and art professional score remain separate; not filing or admission score",
    }],
    records,
    diagnostics: {
      recordCount: records.length,
      ordinaryRecords: records.filter((record) => record.formalScoreScope === "control-line-only").length,
      specialPathRecords: records.filter((record) => record.formalScoreScope === "special-path-only").length,
      routeCounts,
      ordinaryBoundaries: { historyBachelor: 490, historyVocational: 200, physicsBachelor: 451, physicsVocational: 200 },
      professionalScoreRecords: records.filter((record) => Number.isFinite(record.professionalMinScore)).length,
      professionalQualificationRecords: records.filter((record) => record.professionalRequirement).length,
    },
  };
  const outFile = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "ok", out: path.relative(PROJECT_ROOT, outFile), ...payload.diagnostics }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
