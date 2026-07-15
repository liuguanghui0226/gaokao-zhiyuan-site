#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_URL = "https://eea.gd.gov.cn/ptgk/content/post_4915151.html";
const DEFAULT_OUT = "data/admissions/official-guangdong-control-lines-2026-import.json";
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/official-guangdong-control-lines-2026");
const TMP_FILE = path.join(PROJECT_ROOT, "tmp/official-guangdong-control-lines-2026.html");
const EXPECTED_SHA256 = "fba7a579d36918cda0bede7be5d0ebac92320629cb8d12f8f9cedba3b8353052";
const YEAR = 2026;
const PROVINCE = "广东";
const TITLE = "关于公布广东省2026年普通高校招生录取最低分数线的通知";
const SOURCE_ID = "official-guangdong-control-lines-2026";
const SOURCE_QUALITY = "official-guangdong-control-line-html-verified";

const ordinaryRows = [
  { subjectType: "历史类", section: "本科", category: "普通类", minScore: 440, route: "ordinary-bachelor" },
  { subjectType: "物理类", section: "本科", category: "普通类", minScore: 425, route: "ordinary-bachelor" },
  { subjectType: "历史类", section: "高职专科", category: "普通类", minScore: 200, route: "ordinary-vocational" },
  { subjectType: "物理类", section: "高职专科", category: "普通类", minScore: 200, route: "ordinary-vocational" },
];

const bachelorArtSportsRows = [
  ["体育类", 350, 200],
  ["音乐类（含音乐教育、音乐表演）", 310, 190],
  ["舞蹈类", 305, 200],
  ["表（导）演类（戏剧影视表演）", 330, 220],
  ["表（导）演类（戏剧影视导演）", 350, 233],
  ["表（导）演类（服装表演）", 315, 215],
  ["播音与主持类（含粤语）", 310, 208],
  ["美术与设计类", 310, 185],
  ["书法类", 310, 220],
  ["戏曲类", 220, null, "省际联考须合格"],
];

const vocationalArtSportsRows = [
  ["体育类", 290, 190],
  ["音乐类（含音乐教育、音乐表演）", 200, 150],
  ["舞蹈类", 200, 150],
  ["表（导）演类（含戏剧影视表演、服装表演、戏剧影视导演）", 310, 210],
  ["播音与主持类（含粤语）", 270, 200],
  ["美术与设计类", 200, 150],
  ["书法类", 305, 205],
  ["戏曲类", 190, null, "省际联考须合格"],
];

const specialRows = [
  { subjectType: "历史类", section: "特殊类型", category: "特殊类型招生", minScore: 546, route: "special" },
  { subjectType: "物理类", section: "特殊类型", category: "特殊类型招生", minScore: 539, route: "special" },
  { subjectType: "历史类", section: "地方专项", category: "重点高校招收农村和脱贫地区学生", minScore: 516, route: "local-special" },
  { subjectType: "物理类", section: "地方专项", category: "重点高校招收农村和脱贫地区学生", minScore: 509, route: "local-special" },
  { subjectType: "历史类", section: "本科", category: "军队提前本科批次院校", minScore: 546, route: "military" },
  { subjectType: "物理类", section: "本科", category: "军队提前本科批次院校", minScore: 539, route: "military" },
  { subjectType: "物理类", section: "本科", category: "军队本科批次院校（人防系统定向）", minScore: 468, route: "military", applicableSchools: ["陆军工程大学"] },
  { subjectType: "历史类", section: "本科", category: "中国消防救援学院", minScore: 546, route: "fire-rescue", applicableSchools: ["中国消防救援学院"] },
  { subjectType: "物理类", section: "本科", category: "中国消防救援学院", minScore: 539, route: "fire-rescue", applicableSchools: ["中国消防救援学院"] },
  { subjectType: "历史类", section: "本科", category: "订单定向培养农村教师人才", minScore: 485, route: "teacher-special" },
  { subjectType: "物理类", section: "本科", category: "订单定向培养农村教师人才", minScore: 468, route: "teacher-special" },
  { subjectType: "历史类", section: "本科", category: "订单定向培养农村教师人才（指定院校）", minScore: 526, route: "teacher-special", applicableSchools: ["华南师范大学", "广州大学"] },
  { subjectType: "物理类", section: "本科", category: "订单定向培养农村教师人才（指定院校）", minScore: 519, route: "teacher-special", applicableSchools: ["华南师范大学", "广州大学"] },
  { subjectType: "体育类", section: "本科", category: "订单定向培养农村教师人才（体育类）", minScore: 350, professionalMinScore: 200, route: "sports" },
  { subjectType: "艺术类", section: "本科", category: "订单定向培养农村教师人才（音乐教育）", minScore: 310, professionalMinScore: 190, route: "art" },
  { subjectType: "艺术类", section: "本科", category: "订单定向培养农村教师人才（美术与设计类）", minScore: 310, professionalMinScore: 185, route: "art" },
  { subjectType: "历史类", section: "本科", category: "订单定向培养农村卫生人才", minScore: 526, route: "health-special" },
  { subjectType: "物理类", section: "本科", category: "订单定向培养农村卫生人才", minScore: 468, route: "health-special" },
  { subjectType: "物理类", section: "本科", category: "订单定向培养农村卫生人才（指定院校）", minScore: 519, route: "health-special", applicableSchools: ["广州中医药大学", "汕头大学医学院"] },
  { subjectType: "历史类", section: "高职专科", category: "订单定向培养农村卫生人才", minScore: 420, route: "health-special" },
  { subjectType: "物理类", section: "高职专科", category: "订单定向培养农村卫生人才", minScore: 405, route: "health-special" },
  { subjectType: "历史类", section: "本科", category: "少数民族班", minScore: 400, route: "minority-class", applicableSchools: ["广东技术师范大学"] },
  { subjectType: "物理类", section: "本科", category: "少数民族班", minScore: 385, route: "minority-class", applicableSchools: ["广东技术师范大学"] },
  { subjectType: "历史类", section: "本科预科", category: "边防军人子女预科班", minScore: 380, route: "preparatory" },
  { subjectType: "物理类", section: "本科预科", category: "边防军人子女预科班", minScore: 365, route: "preparatory" },
  { subjectType: "历史类", section: "本科预科", category: "边防军人子女预科班（指定院校）", minScore: 546, route: "preparatory", applicableSchools: ["湖南大学"] },
  { subjectType: "物理类", section: "本科预科", category: "边防军人子女预科班（指定院校）", minScore: 539, route: "preparatory", applicableSchools: ["湖南大学", "重庆大学"] },
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
    `  node scripts/import-official-guangdong-control-lines-2026.mjs --out ${DEFAULT_OUT}`,
    "  node scripts/import-official-guangdong-control-lines-2026.mjs --use-cache",
    "",
    "Imports 49 Guangdong 2026 control-line records from the official HTML page.",
    "Only four ordinary bachelor/vocational records route ordinary recommendations.",
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

function assertOfficialUrl(value) {
  const parsed = new URL(value);
  assert(parsed.protocol === "https:", `Official page must use HTTPS: ${value}`);
  assert(parsed.hostname === "eea.gd.gov.cn", `Official page must use eea.gd.gov.cn: ${value}`);
  return parsed.href;
}

async function download(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(90_000),
    headers: { "user-agent": "Mozilla/5.0 gaokao-guangdong-control-importer/1.0", accept: "text/html,application/xhtml+xml" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function pageMeta(html, pageUrl) {
  const title = cleanHtmlText(/<h3[^>]*class=["']articleTitle["'][^>]*>([\s\S]*?)<\/h3>/i.exec(html)?.[1] || "");
  const publishedAt = /class=["']time["'][^>]*>\s*时间\s*:\s*([^<]+)/i.exec(html)?.[1]?.trim() || "";
  const publisher = /class=["']ly["'][^>]*>\s*来源\s*:\s*([^<]+)/i.exec(html)?.[1]?.trim() || "";
  const text = cleanHtmlText(/<div[^>]*class=["']article["'][^>]*>([\s\S]*?)<div[^>]*class=["']fj["']/i.exec(html)?.[1] || "");
  assert(title === TITLE, `Unexpected Guangdong title: ${title}`);
  assert(publishedAt === "2026-06-24 11:07:34", `Unexpected Guangdong publish time: ${publishedAt}`);
  assert(publisher === "广东省教育考试院", `Unexpected Guangdong publisher: ${publisher}`);
  const requiredSnippets = [
    "普通类（历史）：总分440分", "普通类（物理）：总分425分",
    "普通类（历史）：总分200分", "普通类（物理）：总分200分",
    "特殊类型招生录取控制线", "普通类（历史）：总分546分", "普通类（物理）：总分539分",
    "重点高校招收农村和脱贫地区学生", "普通类（历史）：总分516分", "普通类（物理）：总分509分",
    "陆军工程大学（人防系统定向）", "中国消防救援学院",
    "本科院校订单定向培养农村教师人才", "订单定向培养农村卫生人才",
    "广东技术师范大学（少数民族班）", "本科院校边防军人子女预科班",
    "广东省招生委员会 2026年6月24日",
  ];
  for (const snippet of requiredSnippets) assert(text.includes(snippet), `Official Guangdong page missed: ${snippet}`);
  return { title, publishedAt, publisher, pageUrl, text };
}

function controlLineKind(row) {
  if (row.route === "ordinary-bachelor") return "普通类本科录取最低分数线";
  if (row.route === "ordinary-vocational") return "普通类高职专科录取最低分数线";
  return `${row.category}${row.section}录取最低分数线`;
}

function baseRecord(row) {
  const ordinary = row.route.startsWith("ordinary-");
  const kind = controlLineKind(row);
  const idKey = [YEAR, PROVINCE, row.subjectType, row.section, row.category, row.minScore, row.professionalMinScore ?? "", row.professionalRequirement || "", row.route, (row.applicableSchools || []).join("、")].join("|");
  return {
    id: `${YEAR}-guangdong-control-${hash(idKey)}`,
    province: PROVINCE,
    year: YEAR,
    subjectType: row.subjectType,
    batch: kind,
    schoolName: TITLE,
    schoolTags: ["广东官方控制线", ordinary ? "普通类" : "特殊路径", row.category, row.section],
    city: "广东",
    dataType: "control-line",
    majorName: kind,
    majorGroup: row.category,
    minScore: row.minScore,
    cultureScoreLine: row.minScore,
    professionalMinScore: row.professionalMinScore ?? null,
    professionalRequirement: row.professionalRequirement || "",
    applicableSchools: row.applicableSchools || [],
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: SOURCE_QUALITY,
    sourceUrl: DEFAULT_URL,
    formalScoreScope: ordinary ? "control-line-only" : "special-path-only",
    controlLineRouteKind: row.route,
    controlLineKind: kind,
    controlLineSection: row.section,
    cautions: ordinary ? [
      "这是广东省2026年普通类本科或高职专科录取最低分数线，只用于判断普通批资格边界。",
      "控制线不是院校专业组投档线、专业录取最低分或最低位次，不能单独生成录取概率。",
      "广东实行院校专业组志愿，达到控制线后仍须结合首选科目、再选科目、位次、专业组和招生章程核验。",
    ] : [
      "这是广东省2026年对应特殊类别或专项路径控制线，不适用于普通类考生直接推荐。",
      "文化分、专业分、考生资格、适用院校和专业组必须同时按官方口径核验。",
      "该记录不是普通类院校专业组投档线或专业录取分，不参与普通推荐边界计算。",
    ],
  };
}

function makeRecords() {
  const bachelorArtSports = bachelorArtSportsRows.map(([category, minScore, professionalMinScore, professionalRequirement]) => baseRecord({
    subjectType: category === "体育类" ? "体育类" : "艺术类",
    section: "本科",
    category,
    minScore,
    professionalMinScore,
    professionalRequirement,
    route: category === "体育类" ? "sports" : "art",
  }));
  const vocationalArtSports = vocationalArtSportsRows.map(([category, minScore, professionalMinScore, professionalRequirement]) => baseRecord({
    subjectType: category === "体育类" ? "体育类" : "艺术类",
    section: "高职专科",
    category,
    minScore,
    professionalMinScore,
    professionalRequirement,
    route: category === "体育类" ? "sports" : "art",
  }));
  return [
    ...ordinaryRows.map(baseRecord),
    ...bachelorArtSports,
    ...specialRows.map(baseRecord),
    ...vocationalArtSports,
  ];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  args.url = assertOfficialUrl(args.url);
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const pageFile = path.join(RAW_DIR, "control-lines.html");
  const pageBytes = args.useCache && fs.existsSync(TMP_FILE) ? fs.readFileSync(TMP_FILE) : await download(args.url);
  assert(sha256(pageBytes) === EXPECTED_SHA256, "Official Guangdong control-line page SHA-256 drifted");
  fs.writeFileSync(pageFile, pageBytes);
  const meta = pageMeta(pageBytes.toString("utf8"), args.url);
  const records = makeRecords();
  assert(records.length === 49, `Expected 49 Guangdong records, got ${records.length}`);
  assert(new Set(records.map((record) => record.id)).size === 49, "Guangdong control-line record ids are not unique");
  assert(records.filter((record) => record.formalScoreScope === "control-line-only").length === 4, "Expected four ordinary route records");
  assert(records.filter((record) => record.formalScoreScope === "special-path-only").length === 45, "Expected 45 special-path records");
  for (const record of records) {
    record.sourceFile = rel(pageFile);
    record.sourcePublishedAt = meta.publishedAt;
  }

  const routeCounts = Object.fromEntries([...new Set(records.map((record) => record.controlLineRouteKind))]
    .map((route) => [route, records.filter((record) => record.controlLineRouteKind === route).length]));
  const outFile = path.resolve(PROJECT_ROOT, args.out);
  const priorGeneratedAt = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")).generatedAt : "";
  const payload = {
    dataset: "official-guangdong-control-lines-2026-import",
    generatedAt: args.generatedAt || priorGeneratedAt || new Date().toISOString(),
    scope: { province: PROVINCE, year: YEAR, sourceKind: "official-control-lines" },
    notes: [
      "本文件由 scripts/import-official-guangdong-control-lines-2026.mjs 从广东省教育考试院官方HTML正文生成。",
      "普通类本科/高职专科4条只作资格路由；艺体、特控、地方专项、军队、消防、教师、卫生、少数民族班和预科45条保持特殊路径隔离。",
      "控制线不是院校专业组投档线、专业录取最低分或录取概率证据。",
    ],
    sourceNotes: [{
      id: SOURCE_ID,
      title: meta.title,
      publisher: meta.publisher,
      publishedAt: meta.publishedAt,
      url: meta.pageUrl,
      quality: SOURCE_QUALITY,
      usage: "抽取广东2026普通类、艺体、特殊类型、地方专项、军队、消防、教师、卫生、少数民族班和预科控制线49条；仅4条普通类记录参与普通考生本专科边界路由。",
      parsedRecords: records.length,
      pageFile: rel(pageFile),
      pageHtmlBytes: pageBytes.length,
      pageHtmlSha256: sha256(pageBytes),
      evidenceBoundary: "control-line-only; ordinary=4; special-path-only=45; not major-group filing or admission score",
    }],
    records,
    diagnostics: {
      recordCount: records.length,
      ordinaryRecords: 4,
      specialPathRecords: 45,
      routeCounts,
      ordinaryBoundaries: { historyBachelor: 440, historyVocational: 200, physicsBachelor: 425, physicsVocational: 200 },
      professionalScoreRecords: records.filter((record) => Number.isFinite(record.professionalMinScore)).length,
      professionalQualificationRecords: records.filter((record) => record.professionalRequirement).length,
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
