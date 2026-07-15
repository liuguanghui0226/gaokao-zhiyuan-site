#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293847174.html";
const DEFAULT_OUT = "data/admissions/official-jiangxi-control-lines-2026-import.json";
const TMP_ROOT = path.join(PROJECT_ROOT, "tmp", "official-jiangxi-control-lines-2026");
const YEAR = 2026;
const PROVINCE = "江西";
const SOURCE_ID = "official-jiangxi-control-lines-2026";
const SOURCE_QUALITY = "official-jiangxi-government-chsi-republication-html-verified";
const TITLE = "江西省2026年普通高校招生各类各批次录取控制分数线揭晓";

const TEXT_ASSERTIONS = [
  "普通类历史科目组本科分数线479分，高职（专科）分数线220分",
  "普通类物理科目组本科分数线412分，高职（专科）分数线200分",
  "普通类历史科目组：535分、普通类物理科目组：505分",
  "三校生类本科分数线448分，高职（专科）分数线220分",
  "音乐表演类（声乐）本科文化线309分，专业线150分；高职（专科）文化线140分，专业线150分",
  "舞蹈类本科文化线309分，专业线217分；高职（专科）文化线140分，专业线135分",
  "播音与主持类本科文化线412分，专业线150分；高职（专科）文化线200分，专业线150分",
  "书法类本科文化线309分，专业线241分；高职（专科）文化线140分，专业线180分",
  "体育类本科文化线288分，专业线89分；高职（专科）文化线140分，专业线60分",
];

const ART_LINES = [
  ["音乐表演类（声乐）", 309, 150, 140, 150],
  ["音乐表演类（器乐）", 309, 150, 140, 150],
  ["音乐教育类", 309, 150, 140, 150],
  ["舞蹈类", 309, 217, 140, 135],
  ["戏剧影视表演类", 309, 135, 140, 135],
  ["服装表演类", 309, 135, 140, 135],
  ["戏剧影视导演类", 309, 135, 140, 135],
  ["播音与主持类", 412, 150, 200, 150],
  ["美术与设计类", 309, 180, 140, 180],
  ["书法类", 309, 241, 140, 180],
];

function usage() {
  return [
    "Usage:",
    `  node scripts/import-official-jiangxi-control-lines-2026.mjs --out ${DEFAULT_OUT}`,
    "  node scripts/import-official-jiangxi-control-lines-2026.mjs --html /path/to/page.html",
    "  node scripts/import-official-jiangxi-control-lines-2026.mjs --use-cache",
    "",
    "Notes:",
    "  - Imports 30 official Jiangxi 2026 ordinary, special, three-school, art and sports control lines.",
    "  - Control lines are eligibility boundaries, not university filing scores or major admission results.",
  ].join("\n");
}

function parseArgs(argv) {
  const args = { url: DEFAULT_URL, out: DEFAULT_OUT, useCache: false };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--url") args.url = argv[++index];
    else if (item === "--html") args.html = argv[++index];
    else if (item === "--out") args.out = argv[++index];
    else if (item === "--use-cache") args.useCache = true;
    else if (item === "--help" || item === "-h") args.help = true;
  }
  return args;
}

function hash(value, length = 16) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/\u00a0/g, " ");
}

function cleanHtmlText(value) {
  return decodeEntities(String(value ?? ""))
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value) {
  return cleanHtmlText(value).replace(/\s+/g, "").replace(/[。；]/g, (mark) => mark);
}

async function downloadText(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(90_000),
    headers: {
      "user-agent": "Mozilla/5.0 gaokao-jiangxi-control-importer/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

function parsePage(html, pageUrl) {
  const title = cleanHtmlText(/<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(html)?.[1] || "");
  const publishedAt = cleanHtmlText(/<div[^>]+class=["']news-msg["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i.exec(html)?.[1] || "");
  const publisher = cleanHtmlText(/来源：\s*([^<]+)/i.exec(html)?.[1] || "");
  const articleHtml = /<div[^>]+class=["']detail["'][^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1] || "";
  const articleText = compactText(articleHtml);
  if (title !== TITLE) throw new Error(`Unexpected Jiangxi control-line title: ${title}`);
  if (publishedAt !== "2026年06月25日") throw new Error(`Unexpected Jiangxi publish date: ${publishedAt}`);
  if (publisher !== "江西省教育厅") throw new Error(`Unexpected Jiangxi publisher: ${publisher}`);
  const missing = TEXT_ASSERTIONS.filter((expected) => !articleText.includes(expected.replace(/\s+/g, "")));
  if (missing.length) throw new Error(`Official Jiangxi page is missing expected values: ${missing.join(" | ")}`);
  return { title, publishedAt, publisher, articleHtml, articleText, pageUrl };
}

function baseRecord({ subjectType, section, category, minScore, professionalScoreLine, disciplineCodes = [], rankUsage = "", rankUsageLabel = "" }) {
  const batch = category === "特殊类型"
    ? "特殊类型招生参考分数线"
    : `${category}${section}控制线`;
  const idBase = [YEAR, PROVINCE, subjectType, section, category, minScore, professionalScoreLine ?? ""].join("|");
  const specialRoute = category !== "普通类";
  return {
    id: `${YEAR}-${hash(idBase)}`,
    province: PROVINCE,
    year: YEAR,
    subjectType,
    batch,
    schoolName: TITLE,
    schoolTags: ["批次控制线", category, section],
    city: "江西",
    dataType: "control-line",
    majorName: `${category}${subjectType}${section}${professionalScoreLine == null ? "最低控制线" : "文化及专业控制线"}`,
    majorCode: "",
    majorGroup: category,
    disciplineCodes,
    minScore,
    cultureScoreLine: minScore,
    professionalScoreLine,
    rankUsage,
    rankUsageLabel,
    rankRangeText: "",
    sourceId: SOURCE_ID,
    sourceQuality: SOURCE_QUALITY,
    controlLineKind: category === "特殊类型" ? "特殊类型招生参考分数线" : `${category}${section}控制线`,
    controlLineSection: section,
    formalScoreScope: specialRoute ? "special-path-only" : "control-line-only",
    cautions: [
      "这是江西省教育厅发布、阳光高考转载的2026年各类各批次录取控制分数线，只用于批次/类别资格边界。",
      "控制线不是院校投档线、专业组最低投档分、专业录取最低分或录取概率证据。",
      "艺术和体育记录须同时达到对应文化线、专业线，并继续核对当年招生章程和综合成绩规则。",
      "江西省综合管理平台内的2024-2025专业组投档分/位次需要考生本人登录，本公开导入不绕过登录抓取个人或受限数据。",
    ],
  };
}

function recordsFor() {
  const records = [
    baseRecord({ subjectType: "历史类", section: "本科", category: "普通类", minScore: 479 }),
    baseRecord({ subjectType: "历史类", section: "高职（专科）", category: "普通类", minScore: 220 }),
    baseRecord({ subjectType: "物理类", section: "本科", category: "普通类", minScore: 412 }),
    baseRecord({ subjectType: "物理类", section: "高职（专科）", category: "普通类", minScore: 200 }),
    baseRecord({ subjectType: "历史类", section: "本科", category: "特殊类型", minScore: 535, rankUsage: "special", rankUsageLabel: "特殊类型" }),
    baseRecord({ subjectType: "物理类", section: "本科", category: "特殊类型", minScore: 505, rankUsage: "special", rankUsageLabel: "特殊类型" }),
    baseRecord({ subjectType: "三校生类", section: "本科", category: "三校生类（职教）", minScore: 448, rankUsage: "jiangxi-three-school", rankUsageLabel: "江西三校生类" }),
    baseRecord({ subjectType: "三校生类", section: "高职（专科）", category: "三校生类（职教）", minScore: 220, rankUsage: "jiangxi-three-school", rankUsageLabel: "江西三校生类" }),
  ];
  for (const [category, undergraduateCulture, undergraduateProfessional, vocationalCulture, vocationalProfessional] of ART_LINES) {
    records.push(baseRecord({
      subjectType: "艺术类",
      section: "本科",
      category,
      minScore: undergraduateCulture,
      professionalScoreLine: undergraduateProfessional,
      disciplineCodes: ["13"],
      rankUsage: "art",
      rankUsageLabel: category,
    }));
    records.push(baseRecord({
      subjectType: "艺术类",
      section: "高职（专科）",
      category,
      minScore: vocationalCulture,
      professionalScoreLine: vocationalProfessional,
      disciplineCodes: ["13"],
      rankUsage: "art",
      rankUsageLabel: category,
    }));
  }
  records.push(baseRecord({ subjectType: "体育类", section: "本科", category: "体育类", minScore: 288, professionalScoreLine: 89, disciplineCodes: ["04"], rankUsage: "sports", rankUsageLabel: "体育类" }));
  records.push(baseRecord({ subjectType: "体育类", section: "高职（专科）", category: "体育类", minScore: 140, professionalScoreLine: 60, disciplineCodes: ["04"], rankUsage: "sports", rankUsageLabel: "体育类" }));
  return records;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const cachePath = path.join(TMP_ROOT, "control-lines.html");
  const html = args.html
    ? fs.readFileSync(path.resolve(args.html), "utf8")
    : args.useCache && fs.existsSync(cachePath)
      ? fs.readFileSync(cachePath, "utf8")
      : await downloadText(args.url);
  if (!args.html) fs.writeFileSync(cachePath, html, "utf8");

  const parsed = parsePage(html, args.url);
  const records = recordsFor();
  if (records.length !== 30) throw new Error(`Expected 30 Jiangxi control-line records, got ${records.length}`);
  if (new Set(records.map((record) => record.id)).size !== records.length) throw new Error("Duplicate Jiangxi control-line record ids");

  const payload = {
    dataset: "official-jiangxi-control-lines-2026-import",
    generatedAt: new Date().toISOString(),
    scope: { province: PROVINCE, year: YEAR, sourceKind: "official-control-lines" },
    notes: [
      "由 scripts/import-official-jiangxi-control-lines-2026.mjs 从公开官方转载页自动生成。",
      "普通历史/物理本科与高职线用于普通考生本专科资格路由；特殊类型、三校生、艺体记录保持路径隔离。",
      "控制线不是院校或专业组投档线，不生成录取概率。",
    ],
    sourceNotes: [{
      id: SOURCE_ID,
      title: parsed.title,
      publisher: "江西省教育厅（阳光高考转载）",
      publishedAt: parsed.publishedAt,
      url: parsed.pageUrl,
      quality: SOURCE_QUALITY,
      usage: "抽取江西2026普通类、特殊类型、三校生类、艺术类和体育类控制线30条；普通本科线用于本专科资格路由，其余路径隔离。",
      parsedRecords: records.length,
      pageHtmlSha256: sha256(html),
      articleHtmlSha256: sha256(parsed.articleHtml),
      articleTextSha256: sha256(parsed.articleText),
    }],
    diagnostics: {
      recordCount: records.length,
      textAssertions: TEXT_ASSERTIONS,
      breakdown: { ordinary: 4, special: 2, threeSchool: 2, art: 20, sports: 2 },
      ordinaryBoundaries: { historyBachelor: 479, historyVocational: 220, physicsBachelor: 412, physicsVocational: 200 },
    },
    records,
  };
  const out = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ out: path.relative(PROJECT_ROOT, out), records: records.length, sourceId: SOURCE_ID, pageHtmlSha256: payload.sourceNotes[0].pageHtmlSha256 }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
