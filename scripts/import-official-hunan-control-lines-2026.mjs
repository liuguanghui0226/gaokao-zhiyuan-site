#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_URL = "https://jyt.hunan.gov.cn/jyt/sjyt/hnsjyksy/web/ksyzkzx/202606/t20260625_34011553.html";
const DEFAULT_OUT = "data/admissions/official-hunan-control-lines-2026-import.json";
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/official-hunan-control-lines-2026");
const TMP_DIR = path.join(PROJECT_ROOT, "tmp/official-hunan-control-lines-2026");
const OCR_HELPER = path.join(PROJECT_ROOT, "scripts/vision-ocr-json.swift");
const YEAR = 2026;
const PROVINCE = "湖南";
const TITLE = "湖南省2026年普通高校招生录取控制分数线";
const SOURCE_ID = "official-hunan-control-lines-2026";
const SOURCE_QUALITY = "official-hunan-control-line-images-ocr-verified";

const EXPECTED_FILES = [
  {
    name: "table-1.png",
    sourceName: "20260625113134885.png",
    width: 796,
    height: 726,
    sha256: "cf4db00a4178b9d1200f01b618131f8f6333fc47c45684186e4ab859e213840d",
  },
  {
    name: "table-2.png",
    sourceName: "20260625112759600.png",
    width: 1561,
    height: 800,
    sha256: "e8c62b0004c40ba2cd6a42ec231caae7a8198ea3e1cd5eb8fb1fcfe9e05b20ea",
  },
  {
    name: "table-3.png",
    sourceName: "20260625112812624.png",
    width: 716,
    height: 864,
    sha256: "4913ecef2b20ecd6dff0307606e55c9afac418eab9791dca3f066e24c3306440",
  },
];

const ORDINARY_ROWS = [
  { subjectType: "历史类", section: "本科", minScore: 446, route: "ordinary-bachelor" },
  { subjectType: "物理类", section: "本科", minScore: 400, route: "ordinary-bachelor" },
  { subjectType: "历史类", section: "高职专科", minScore: 200, route: "ordinary-vocational" },
  { subjectType: "物理类", section: "高职专科", minScore: 200, route: "ordinary-vocational" },
];

const SPECIAL_ROWS = [
  { subjectType: "历史类", section: "特殊类型", category: "特殊类型招生", minScore: 494, route: "special" },
  { subjectType: "物理类", section: "特殊类型", category: "特殊类型招生", minScore: 481, route: "special" },
];

const SPORTS_ROWS = [
  { subjectType: "历史类", section: "本科", minScore: 349, professionalMinScore: 257 },
  { subjectType: "物理类", section: "本科", minScore: 310, professionalMinScore: 257 },
  { subjectType: "历史类", section: "高职专科", minScore: 160, professionalMinScore: 155 },
  { subjectType: "物理类", section: "高职专科", minScore: 160, professionalMinScore: 155 },
];

const ART_BACHELOR_ROWS = [
  ["音乐类", 320, 209],
  ["舞蹈类", 300, 174],
  ["表（导）演类（服装表演类）", 300, 221],
  ["表（导）演类（戏剧表演类）", 300, 231],
  ["表（导）演类（戏剧影视导演类）", 300, 233],
  ["播音与主持类", 400, 189],
  ["美术与设计类", 320, 197],
  ["书法类", 320, 222],
];

const COUNTERPART_BACHELOR_ROWS = [
  ["师范类", 553],
  ["种植类", 553],
  ["养殖类", 493],
  ["机电类", 551],
  ["电子电工类", 532],
  ["计算机类", 596],
  ["建筑类", 557],
  ["旅游类", 602],
  ["医卫类", 566],
  ["财会类", 567],
  ["商贸类", 565],
  ["文秘类", 568],
  ["英语类", 513],
];

const COUNTERPART_ART_ROWS = [
  ["服装类", 210, 271],
  ["美术类", 251, 307],
  ["音乐类", 196, 312],
];

function parseArgs(argv) {
  const args = { url: DEFAULT_URL, out: DEFAULT_OUT, useCache: false };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--url") args.url = argv[++index];
    else if (item === "--out") args.out = argv[++index];
    else if (item === "--generated-at") args.generatedAt = argv[++index];
    else if (item === "--use-cache") args.useCache = true;
    else if (item === "--help" || item === "-h") args.help = true;
  }
  return args;
}

function usage() {
  return [
    "Usage:",
    `  node scripts/import-official-hunan-control-lines-2026.mjs --out ${DEFAULT_OUT}`,
    "  node scripts/import-official-hunan-control-lines-2026.mjs --use-cache",
    "  node scripts/import-official-hunan-control-lines-2026.mjs --use-cache --generated-at ISO_TIMESTAMP",
    "",
    "Imports 37 Hunan 2026 control-line boundaries from three official images.",
    "Only four ordinary bachelor/vocational rows can route ordinary recommendations.",
  ].join("\n");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hash(value, length = 18) {
  return sha256(String(value)).slice(0, length);
}

function rel(file) {
  return path.relative(PROJECT_ROOT, file).replaceAll(path.sep, "/");
}

function cleanHtmlText(value) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function assertOfficialUrl(value, host, label) {
  const parsed = new URL(value);
  assert(parsed.protocol === "https:", `${label} must use HTTPS: ${value}`);
  assert(parsed.hostname === host, `${label} must use ${host}: ${value}`);
  return parsed.href;
}

async function download(url, accept) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(90_000),
    headers: { "user-agent": "Mozilla/5.0 gaokao-hunan-control-importer/1.0", accept },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error([`${command} ${args.join(" ")} failed`, result.stderr, result.stdout].filter(Boolean).join("\n"));
  }
  return result.stdout;
}

function imageDimensions(file) {
  const output = run("/usr/bin/sips", ["-g", "pixelWidth", "-g", "pixelHeight", file]);
  return {
    width: Number(/pixelWidth:\s*(\d+)/.exec(output)?.[1]),
    height: Number(/pixelHeight:\s*(\d+)/.exec(output)?.[1]),
  };
}

function pageMeta(html, pageUrl) {
  const title = cleanHtmlText(/<h2[^>]+id=["']title["'][^>]*>([\s\S]*?)<\/h2>/i.exec(html)?.[1] || "");
  const publishedAt = /<meta\s+name=["']PubDate["']\s+content=["']([^"']+)/i.exec(html)?.[1] || "";
  const publisher = /var\s+docSource\s*=\s*["']["'];[\s\S]*?docSource\s*=\s*["']([^"']+)/i.exec(html)?.[1] || "";
  const imageMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+\.png)["']/gi)]
    .map((match) => new URL(match[1].replace(/^http:/, "https:"), pageUrl).href)
    .filter((url) => /hneeb\.cn\/hnxxg\/uploadfiles\/202606\//.test(url));
  assert(title === TITLE, `Unexpected Hunan title: ${title}`);
  assert(publishedAt === "2026-06-25 11:41:58", `Unexpected Hunan publish time: ${publishedAt}`);
  assert(publisher === "湖南省教育厅", `Unexpected Hunan publisher: ${publisher}`);
  assert(imageMatches.length === 3, `Expected three official images, got ${imageMatches.length}`);
  EXPECTED_FILES.forEach((expected, index) => {
    assert(imageMatches[index].endsWith(expected.sourceName), `Unexpected image ${index + 1}: ${imageMatches[index]}`);
    assertOfficialUrl(imageMatches[index], "www.hneeb.cn", `image ${index + 1}`);
  });
  return { title, publishedAt, publisher, pageUrl, imageUrls: imageMatches };
}

function ocrImage(imageFile, ocrFile) {
  assert(fs.existsSync(OCR_HELPER), `Missing OCR helper: ${OCR_HELPER}`);
  const parsed = JSON.parse(run("swift", [OCR_HELPER, imageFile]));
  fs.writeFileSync(ocrFile, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  return parsed;
}

function normalizedOcr(parsed) {
  return (parsed.items || []).map((item) => String(item.text || "").replace(/\s+/g, ""));
}

function assertOcrTables(ocrTables) {
  const joined = ocrTables.map((table) => normalizedOcr(table).join("|"));
  assert(joined[0].includes("湖南省2026年普通高校招生录取控制分数线（一）"), "OCR table 1 title mismatch");
  assert(joined[0].includes("我省特类型招生录取控制分数线为历史类494分、物") && joined[0].includes("理类481分"), "OCR table 1 special-type scores mismatch");
  for (const score of [446, 349, 257, 400, 310, 200, 160, 155]) {
    assert(normalizedOcr(ocrTables[0]).includes(String(score)), `OCR table 1 missed score ${score}`);
  }
  assert(joined[1].includes("湖南省2026年普通高校招生录取控制分数线（二）"), "OCR table 2 title mismatch");
  for (const value of ART_BACHELOR_ROWS.flatMap(([, culture, professional]) => [culture, professional])) {
    assert(normalizedOcr(ocrTables[1]).includes(String(value)), `OCR table 2 missed value ${value}`);
  }
  assert(joined[1].includes("文化160") && joined[1].includes("专业155"), "OCR table 2 vocational art scores mismatch");
  assert(joined[2].includes("湖南省2026年普通高校职高对口招生|录取控制分数线"), "OCR table 3 title mismatch");
  for (const [category, score] of COUNTERPART_BACHELOR_ROWS) {
    assert(joined[2].includes(category) && normalizedOcr(ocrTables[2]).includes(String(score)), `OCR table 3 missed ${category} ${score}`);
  }
  for (const [category, culture, professional] of COUNTERPART_ART_ROWS) {
    assert(joined[2].includes(category) && joined[2].includes(`文化${culture}专业${professional}`), `OCR table 3 missed ${category}`);
  }
  return {
    observations: ocrTables.map((table) => table.items?.length || 0),
    titlesVerified: 3,
  };
}

function baseRecord({ subjectType, section, category, minScore, professionalMinScore = null, route }) {
  const ordinary = route.startsWith("ordinary-");
  const idKey = [YEAR, PROVINCE, subjectType, section, category, minScore, professionalMinScore ?? "", route].join("|");
  const batch = ordinary
    ? `普通类${section}录取控制分数线`
    : `${category}${section === "特殊类型" ? "" : section}录取控制分数线`;
  return {
    id: `${YEAR}-hunan-control-${hash(idKey)}`,
    province: PROVINCE,
    year: YEAR,
    subjectType,
    batch,
    schoolName: TITLE,
    schoolCode: null,
    schoolTags: ["湖南官方控制线", ordinary ? "普通类" : "特殊路径", category, section],
    city: "湖南",
    dataType: "control-line",
    majorName: `${category}${section}录取控制分数线`,
    majorCode: null,
    majorGroup: category,
    disciplineCodes: [],
    minScore,
    cultureScoreLine: minScore,
    professionalMinScore,
    minRankStart: null,
    minRankEnd: null,
    rankRangeText: "",
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: SOURCE_QUALITY,
    sourceUrl: DEFAULT_URL,
    formalScoreScope: ordinary ? "control-line-only" : "special-path-only",
    controlLineRouteKind: route,
    controlLineKind: batch,
    controlLineSection: section,
    cautions: ordinary ? [
      "这是湖南省2026年普通高校招生普通类批次录取控制分数线，只用于判断本科或高职专科资格边界。",
      "该记录不是院校投档线、专业录取最低分或最低位次，不能单独生成录取概率。",
      "官方说明的生源不足降分投档只在规定范围、征集志愿和具体院校专业组条件下适用，系统不会自动下调普通控制线。",
    ] : [
      "这是湖南省2026年对应特殊类别的录取控制分数线，不适用于普通类考生直接推荐。",
      "文化分与专业分必须同时按官方类别核验，不得与普通类总分、院校投档线或专业录取分混算。",
      "官方说明的降分投档仅在生源不足、征集志愿和规定幅度内适用，系统不据此自动降低资格边界。",
    ],
  };
}

function makeRecords() {
  const ordinary = ORDINARY_ROWS.map((row) => baseRecord({ ...row, category: "普通类" }));
  const special = SPECIAL_ROWS.map((row) => baseRecord(row));
  const sports = SPORTS_ROWS.map((row) => baseRecord({ ...row, category: "体育类", route: "sports" }));
  const artBachelor = ART_BACHELOR_ROWS.map(([category, culture, professional]) => baseRecord({
    subjectType: "艺术类",
    section: "本科",
    category,
    minScore: culture,
    professionalMinScore: professional,
    route: "art",
  }));
  const artVocational = [baseRecord({
    subjectType: "艺术类",
    section: "高职专科",
    category: "艺术类（各类别共用）",
    minScore: 160,
    professionalMinScore: 155,
    route: "art",
  })];
  const counterpartBachelor = COUNTERPART_BACHELOR_ROWS.map(([category, score]) => baseRecord({
    subjectType: "职高对口",
    section: "本科",
    category,
    minScore: score,
    route: "counterpart",
  }));
  const counterpartVocational = [baseRecord({
    subjectType: "职高对口",
    section: "专科",
    category: "职高对口普通门类（共用）",
    minScore: 200,
    route: "counterpart",
  })];
  const counterpartArt = COUNTERPART_ART_ROWS.map(([category, culture, professional]) => baseRecord({
    subjectType: "职高对口",
    section: "本科",
    category,
    minScore: culture,
    professionalMinScore: professional,
    route: "counterpart",
  }));
  const counterpartArtVocational = [baseRecord({
    subjectType: "职高对口",
    section: "专科",
    category: "职高对口艺术门类（共用）",
    minScore: 160,
    professionalMinScore: 155,
    route: "counterpart",
  })];
  return [
    ...ordinary,
    ...special,
    ...sports,
    ...artBachelor,
    ...artVocational,
    ...counterpartBachelor,
    ...counterpartVocational,
    ...counterpartArt,
    ...counterpartArtVocational,
  ];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  args.url = assertOfficialUrl(args.url, "jyt.hunan.gov.cn", "page URL");
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const pageFile = path.join(RAW_DIR, "control-lines.html");
  const cachedPage = path.join(TMP_DIR, "control-lines.html");
  const pageBytes = args.useCache && fs.existsSync(cachedPage)
    ? fs.readFileSync(cachedPage)
    : await download(args.url, "text/html,application/xhtml+xml");
  assert(sha256(pageBytes) === "cf4e18a47cd675d8921f0e78c3a035dcdbc56312aa8bb74cc51bf03ac2df5aae", "Official Hunan page SHA-256 drifted");
  fs.writeFileSync(pageFile, pageBytes);
  const meta = pageMeta(pageBytes.toString("utf8"), args.url);

  const imageFiles = [];
  const ocrFiles = [];
  const ocrTables = [];
  for (let index = 0; index < EXPECTED_FILES.length; index += 1) {
    const expected = EXPECTED_FILES[index];
    const imageFile = path.join(RAW_DIR, expected.name);
    const cachedImage = path.join(TMP_DIR, expected.name);
    const imageBytes = args.useCache && fs.existsSync(cachedImage)
      ? fs.readFileSync(cachedImage)
      : await download(meta.imageUrls[index], "image/png,image/*");
    assert(sha256(imageBytes) === expected.sha256, `Official Hunan ${expected.name} SHA-256 drifted`);
    fs.writeFileSync(imageFile, imageBytes);
    const dimensions = imageDimensions(imageFile);
    assert(dimensions.width === expected.width && dimensions.height === expected.height, `${expected.name} dimensions drifted`);
    const ocrFile = path.join(RAW_DIR, expected.name.replace(".png", "-ocr.json"));
    ocrTables.push(ocrImage(imageFile, ocrFile));
    imageFiles.push(imageFile);
    ocrFiles.push(ocrFile);
  }
  const ocrDiagnostics = assertOcrTables(ocrTables);
  const records = makeRecords();
  assert(records.length === 37, `Expected 37 Hunan records, got ${records.length}`);
  assert(new Set(records.map((record) => record.id)).size === 37, "Hunan record ids are not unique");
  assert(records.filter((record) => record.formalScoreScope === "control-line-only").length === 4, "Expected four ordinary route records");
  assert(records.filter((record) => record.formalScoreScope === "special-path-only").length === 33, "Expected 33 special-path records");

  for (const record of records) {
    record.sourceFile = rel(pageFile);
    record.sourceImageFiles = imageFiles.map(rel);
    record.sourceOcrFiles = ocrFiles.map(rel);
    record.sourcePublishedAt = meta.publishedAt;
  }

  const routeCounts = Object.fromEntries([...new Set(records.map((record) => record.controlLineRouteKind))]
    .map((route) => [route, records.filter((record) => record.controlLineRouteKind === route).length]));
  const outFile = path.resolve(PROJECT_ROOT, args.out);
  const priorGeneratedAt = fs.existsSync(outFile)
    ? JSON.parse(fs.readFileSync(outFile, "utf8")).generatedAt
    : "";
  const payload = {
    dataset: "official-hunan-control-lines-2026-import",
    generatedAt: args.generatedAt || priorGeneratedAt || new Date().toISOString(),
    scope: { province: PROVINCE, year: YEAR, sourceKind: "official-control-lines" },
    notes: [
      "本文件由 scripts/import-official-hunan-control-lines-2026.mjs 从湖南省教育考试院公开页及三张官方原图生成。",
      "普通类本科/高职专科4条只作资格路由；特殊类型、体育、艺术和职高对口33条保持特殊路径隔离。",
      "控制线不是院校投档线、专业录取最低分或录取概率证据，官方降分政策不自动改写普通控制线。",
    ],
    sourceNotes: [{
      id: SOURCE_ID,
      title: meta.title,
      publisher: meta.publisher,
      publishedAt: meta.publishedAt,
      url: meta.pageUrl,
      imageUrls: meta.imageUrls,
      quality: SOURCE_QUALITY,
      usage: "抽取湖南2026普通类、特殊类型、体育、艺术和职高对口录取控制分数线37条；仅4条普通类记录参与普通考生本专科边界路由。",
      parsedRecords: records.length,
      pageFile: rel(pageFile),
      pageHtmlSha256: sha256(pageBytes),
      imageFiles: imageFiles.map(rel),
      imageSha256: imageFiles.map((file) => sha256(fs.readFileSync(file))),
      ocrFiles: ocrFiles.map(rel),
      evidenceBoundary: "control-line-only; ordinary=4; special-path-only=33; not filing or admission score",
    }],
    records,
    diagnostics: {
      recordCount: records.length,
      ordinaryRecords: 4,
      specialPathRecords: 33,
      routeCounts,
      ordinaryBoundaries: { historyBachelor: 446, historyVocational: 200, physicsBachelor: 400, physicsVocational: 200 },
      professionalScoreRecords: records.filter((record) => Number.isFinite(record.professionalMinScore)).length,
      ocr: ocrDiagnostics,
    },
  };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "ok", out: rel(outFile), ...payload.diagnostics }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
