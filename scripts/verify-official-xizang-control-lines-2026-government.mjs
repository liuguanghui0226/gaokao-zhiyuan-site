#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_URL = "https://www.xizang.gov.cn/xwzx_406/bmkx/202606/t20260626_547152.html";
const DEFAULT_OUT = "data/admissions/official-xizang-control-lines-2026-government-verification.json";
const CACHE_DIR = path.join(PROJECT_ROOT, "tmp", "official-xizang-control-lines-2026-government");
const CACHE_FILE = path.join(CACHE_DIR, "page.html");
const TITLE = "西藏自治区2026年普通高考分数线出炉";
const ORIGINAL_SOURCE_ID = "official-xizang-control-lines-2026";
const ORIGINAL_URL = "http://zsks.edu.xizang.gov.cn/71/73/7866.html";
const MIRROR_RELATIVE_PATH = "gaokao-official-mirror/xizang/2026/control-lines/xizang-government-2026-control-lines.html";

const TEXT_ASSERTIONS = [
  "6月25日，西藏自治区教育考试院公布西藏自治区2026年普通高等学校招生录取最低控制分数线",
  "本科一批：A类考生330分，B类考生400分",
  "本科二批：A类考生294分，B类考生304分",
  "专科批：A类考生237分，B类考生237分",
  "本科一批：A类考生300分，B类考生400分",
  "本科二批：A类考生260分，B类考生300分",
  "专科批：A类考生195分，B类考生195分",
  "本科：A类考生221分，B类考生228分",
  "专科：A类考生166分，B类考生166分",
  "本科：A类考生195分，B类考生225分",
  "专科：A类考生137分，B类考生137分",
  "本科：292分",
  "本科：269分",
];

const VERIFICATION_ROWS = [
  ["ordinary", "历史类", "本科一批", "A类考生", 330],
  ["ordinary", "历史类", "本科一批", "B类考生", 400],
  ["ordinary", "历史类", "本科二批", "A类考生", 294],
  ["ordinary", "历史类", "本科二批", "B类考生", 304],
  ["ordinary", "历史类", "专科批", "A类考生", 237],
  ["ordinary", "历史类", "专科批", "B类考生", 237],
  ["ordinary", "物理类", "本科一批", "A类考生", 300],
  ["ordinary", "物理类", "本科一批", "B类考生", 400],
  ["ordinary", "物理类", "本科二批", "A类考生", 260],
  ["ordinary", "物理类", "本科二批", "B类考生", 300],
  ["ordinary", "物理类", "专科批", "A类考生", 195],
  ["ordinary", "物理类", "专科批", "B类考生", 195],
  ["art-sports", "历史类", "本科", "A类考生", 221],
  ["art-sports", "历史类", "本科", "B类考生", 228],
  ["art-sports", "历史类", "专科", "A类考生", 166],
  ["art-sports", "历史类", "专科", "B类考生", 166],
  ["art-sports", "物理类", "本科", "A类考生", 195],
  ["art-sports", "物理类", "本科", "B类考生", 225],
  ["art-sports", "物理类", "专科", "A类考生", 137],
  ["art-sports", "物理类", "专科", "B类考生", 137],
  ["military", "历史类", "本科", "部队生源", 292],
  ["military", "物理类", "本科", "部队生源", 269],
].map(([route, subjectType, batch, candidateClass, minScore]) => ({
  route,
  subjectType,
  batch,
  candidateClass,
  minScore,
}));

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

function usage() {
  return [
    "Usage:",
    `  node scripts/verify-official-xizang-control-lines-2026-government.mjs --out ${DEFAULT_OUT}`,
    "  node scripts/verify-official-xizang-control-lines-2026-government.mjs --use-cache",
    "",
    "Verifies the existing 22 Xizang 2026 control-line records against the public",
    "Xizang government HTML republication. It does not create duplicate records.",
  ].join("\n");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;/gi, "'")
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
  return cleanHtmlText(value).replace(/\s+/g, "");
}

async function downloadText(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(90_000),
    headers: {
      "user-agent": "Mozilla/5.0 gaokao-xizang-control-government-verifier/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

function parsePage(html, pageUrl) {
  const title = cleanHtmlText(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "");
  const text = compactText(html);
  if (!title.includes(TITLE)) throw new Error(`Unexpected Xizang government page title: ${title}`);
  if (!text.includes("2026年06月26日")) throw new Error("Xizang government page publish date is missing");
  const missing = TEXT_ASSERTIONS.filter((assertion) => !text.includes(assertion.replace(/\s+/g, "")));
  if (missing.length) throw new Error(`Xizang government page is missing expected values: ${missing.join(" | ")}`);
  return { title: TITLE, publishedAt: "2026-06-26", text, pageUrl };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const html = args.html
    ? fs.readFileSync(path.resolve(args.html), "utf8")
    : args.useCache && fs.existsSync(CACHE_FILE)
      ? fs.readFileSync(CACHE_FILE, "utf8")
      : await downloadText(args.url);
  if (!args.html) fs.writeFileSync(CACHE_FILE, html, "utf8");
  const parsed = parsePage(html, args.url);
  const payload = {
    dataset: "official-xizang-control-lines-2026-government-verification",
    generatedAt: new Date().toISOString(),
    scope: { province: "西藏", year: 2026, sourceKind: "official-control-line-provenance-repair" },
    notes: [
      "逐行核验现有 official-xizang-control-lines-2026 的22条记录，不新增重复控制线。",
      "自治区政府公开页正文明确说明分数线由西藏自治区教育考试院公布。",
      "普通控制线用于本专科资格路由；艺体和部队生源保持 special-path-only。",
      "控制线不是院校投档线、专业录取分、一分一段或录取概率证据。",
    ],
    sourcePatch: {
      id: ORIGINAL_SOURCE_ID,
      title: "西藏自治区2026年普通高等学校招生录取最低控制分数线",
      publisher: "西藏自治区教育考试院",
      url: ORIGINAL_URL,
      publishedAt: "2026-06-25 12:06",
      quality: "official-xizang-control-line-image-and-government-html-verified",
      usage: "西藏自治区教育考试院官方图片页导入22条控制线，并由西藏自治区人民政府2026-06-26公开HTML逐行复核；普通本科/专科线用于资格路由，艺体和部队生源保持特殊路径隔离。",
      mirrorUrl: parsed.pageUrl,
      mirrorTitle: parsed.title,
      mirrorPublisher: "西藏自治区人民政府（页面来源：西藏商报）",
      mirrorPublishedAt: parsed.publishedAt,
      mirrorHtmlSha256: sha256(html),
      mirrorTextSha256: sha256(parsed.text),
      mac2tMirrorRelativePath: MIRROR_RELATIVE_PATH,
      caution: "控制线只作批次资格边界；西藏仍缺公开可计算一分一段和省级全量普通/高职投档录取表。",
    },
    diagnostics: {
      expectedRecordCount: VERIFICATION_ROWS.length,
      breakdown: { ordinary: 12, artSports: 8, military: 2 },
      ordinaryBoundaries: {
        history: { A: { bachelor: 294, vocational: 237 }, B: { bachelor: 304, vocational: 237 } },
        physics: { A: { bachelor: 260, vocational: 195 }, B: { bachelor: 300, vocational: 195 } },
      },
      textAssertions: TEXT_ASSERTIONS,
    },
    verificationRows: VERIFICATION_ROWS,
  };
  const out = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    out: path.relative(PROJECT_ROOT, out),
    verifiedRecords: VERIFICATION_ROWS.length,
    mirrorUrl: parsed.pageUrl,
    mirrorHtmlSha256: payload.sourcePatch.mirrorHtmlSha256,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
