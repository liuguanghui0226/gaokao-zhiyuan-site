#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUT = "data/admissions/official-national-school-plan-2026-v363-utibet-import.json";
const DEFAULT_RAW_DIR = "data/admissions/raw/official-utibet-national-plan-2026";
const CATEGORY_URL = "https://www.xzu.edu.cn/api/zjc/zsxx/category/list";
const INFO_URL = "https://www.xzu.edu.cn/api/zjc/zsxx/info/list";
const UI_URL = "https://zjc.utibet.edu.cn/bkzsxxw/zsjh.htm";
const LIB_URL = "https://zjc.utibet.edu.cn/bkzsxxw/js/lib.js";
const CHARTER_URL = "https://zjc.utibet.edu.cn/info/1014/2132.htm";
const SOURCE_ID = "official-utibet-national-plan-2026-api";
const SCHOOL_CODE = "10694";
const SCHOOL_IDENTIFIER_CODE = "4154010694";
const SCHOOL_NAME = "西藏大学";
const YEAR = 2026;

export const EXPECTED = {
  rawRecords: 659,
  records: 659,
  rawPlanCount: 2706,
  planCount: 2706,
  duplicateRows: 0,
  invalidRows: 0,
  provinces: 26,
  ordinaryRecords: 621,
  ordinaryPlanCount: 2231,
  specialPathRecords: 38,
  specialPlanCount: 475,
  categoryRootCount: 26,
  yearNodeCount: 31,
  subjectNodeCount: 59,
  emptySubjectNodeCount: 4,
  emptySubjectNodeIds: [799, 851, 878, 879],
};

const EXPECTED_CANONICAL_SHA256 = "8ce0fcfa7975b33c8372fbfb8c75bd8a3f29226ef95ede4c1269c59e8822c856";
const EXPECTED_CATEGORY_SHA256 = "176d8fe71751ccf387fb72cff7a0d1f0cef4a7c55b3cf3c2498a51a8882befbd";
const EXPECTED_RAW_CORPUS_SHA256 = "decf5294d4f63ad0dc6825389aea2366d1768c7d2c4ef0dde2c445935f539647";

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT, rawDir: DEFAULT_RAW_DIR, useCache: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") args.out = argv[++index];
    else if (value === "--raw-dir") args.rawDir = argv[++index];
    else if (value === "--use-cache") args.useCache = true;
    else if (value === "--help" || value === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function invariant(condition, message) {
  if (!condition) throw new Error(`西藏大学 2026 计划 v3.363 audit failed: ${message}`);
}

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function sha256File(file) { return sha256(fs.readFileSync(file)); }
function relativeProjectPath(file) { return path.relative(PROJECT_ROOT, file).replaceAll(path.sep, "/"); }
function parseJson(input, label) {
  const text = Buffer.isBuffer(input) ? input.toString("utf8") : String(input);
  try { return JSON.parse(text.replace(/^\uFEFF/, "")); } catch (error) { throw new Error(`${label} JSON parse failed: ${error.message}`); }
}

export function parseCategoryResponse(input) {
  const value = parseJson(input, "category/list");
  invariant(Array.isArray(value), "category/list payload must be an array");
  return value.map((item, index) => {
    invariant(item && typeof item === "object" && !Array.isArray(item), `category row ${index} must be an object`);
    const id = Number(item.id);
    const parent = Number(item.parent);
    invariant(Number.isInteger(id) && id > 0, `category row ${index} id invalid`);
    invariant(Number.isInteger(parent) && parent >= 0, `category row ${index} parent invalid`);
    invariant(typeof item.name === "string" && item.name.trim(), `category row ${index} name invalid`);
    return { id, parent, name: item.name.trim() };
  });
}

export function parseInfoResponse(input) {
  const value = parseJson(input, "info/list");
  invariant(Array.isArray(value), "info/list payload must be an array");
  return value.map((item, index) => {
    invariant(item && typeof item === "object" && !Array.isArray(item), `info row ${index} must be an object`);
    const id = Number(item.id);
    const spec = String(item.spec ?? "").trim();
    const subject = String(item.subject ?? "").trim();
    const num = Number(item.num);
    const score = Number(item.score);
    const batch = String(item.batch ?? "").trim();
    invariant(Number.isInteger(id) && id > 0, `info row ${index} id invalid`);
    invariant(spec, `info row ${index} spec invalid`);
    invariant(Number.isInteger(num) && num > 0, `info row ${index} num invalid`);
    invariant(Number.isFinite(score), `info row ${index} score invalid`);
    return { id, spec, subject, num, score, batch };
  });
}

export function canonicalPayloadSha256(entries) {
  const canonical = entries
    .map((entry) => ({
      province: { id: Number(entry.province.id), name: String(entry.province.name) },
      year: { id: Number(entry.year.id), name: String(entry.year.name) },
      subject: { id: Number(entry.subject.id), name: String(entry.subject.name) },
      items: entry.items,
    }))
    .sort((left, right) => left.subject.id - right.subject.id);
  return sha256(JSON.stringify(canonical));
}

export function subjectTypeFrom(raw) {
  const text = String(raw ?? "").trim();
  if (/历史|文史/.test(text)) return "历史类";
  if (/物理|理工/.test(text)) return "物理类";
  if (/综合/.test(text)) return "综合改革";
  if (/艺术/.test(text)) return "艺术类";
  return text || "综合";
}

export function classifyPlanType(yearName) {
  const text = String(yearName ?? "").trim();
  const type = text.replace(/^2026/, "").trim();
  if (!type || type === "普通计划") return { admissionType: "普通录取", formalScoreScope: "school-official-only", admissionSubtype: "普通计划" };
  return { admissionType: type, formalScoreScope: "special-path-only", admissionSubtype: type };
}

function fetchHeaders() {
  return {
    "user-agent": "Mozilla/5.0 gaokao-utibet-v363-importer/1.0",
    accept: "application/json,text/plain,*/*",
    origin: "https://zjc.utibet.edu.cn",
    referer: UI_URL,
  };
}

async function fetchBytes(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...fetchHeaders(), ...(options.headers || {}) }, signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function readOrFetch(file, fetcher, useCache) {
  if (useCache && fs.existsSync(file) && fs.statSync(file).size > 0) return fs.readFileSync(file);
  const bytes = await fetcher();
  fs.writeFileSync(file, bytes);
  return bytes;
}

function categoryIndex(categories) {
  const byId = new Map(categories.map((node) => [node.id, node]));
  const roots = categories.filter((node) => node.parent === 0).sort((a, b) => a.id - b.id);
  const years = categories.filter((node) => node.name === "2026" || node.name.startsWith("2026")).sort((a, b) => a.id - b.id);
  const subjects = years.flatMap((year) => categories.filter((node) => node.parent === year.id).map((subject) => {
    const province = byId.get(year.parent);
    invariant(province?.parent === 0, `year ${year.id} province parent missing`);
    return { province, year, subject };
  })).sort((a, b) => a.subject.id - b.subject.id);
  return { byId, roots, years, subjects };
}

function recordFromItem(item, entry, evidence) {
  const classification = classifyPlanType(entry.year.name);
  const record = {
    id: `2026-utibet-national-plan-${item.id}`,
    province: entry.province.name,
    year: YEAR,
    sourcePlanYear: YEAR,
    subjectType: subjectTypeFrom(entry.subject.name),
    schoolName: SCHOOL_NAME,
    schoolCode: SCHOOL_CODE,
    schoolIdentifierCode: SCHOOL_IDENTIFIER_CODE,
    schoolTags: ["西藏", "公办", "双一流"],
    dataType: "admission-plan",
    majorName: item.spec,
    sourceMajorRaw: item.spec,
    planCount: item.num,
    sourceTypeRaw: entry.subject.name,
    sourceSubjectRaw: item.subject,
    electiveRequirement: item.subject || undefined,
    formalScoreScope: classification.formalScoreScope,
    admissionType: classification.admissionType,
    admissionSubtype: classification.admissionSubtype,
    schoolOfficialScope: "single-school-admission-plan",
    planRemark: classification.formalScoreScope === "special-path-only" ? `招生类型：${classification.admissionType}` : undefined,
    sourceQuality: "official-school-utibet-2026-national-plan-api",
    sourceId: SOURCE_ID,
    sourceUrl: UI_URL,
    sourcePageUrl: UI_URL,
    sourceApiEndpoint: INFO_URL,
    sourceApiMethod: "POST",
    sourceApiBody: `cid=${entry.subject.id}`,
    sourceCategoryId: entry.subject.id,
    sourceCategoryYearId: entry.year.id,
    sourceCategoryProvinceId: entry.province.id,
    sourcePlanTypeRaw: entry.year.name,
    sourceSubjectCategoryRaw: entry.subject.name,
    officialEvidencePath: evidence.categoryPath,
    officialCharterEvidencePath: evidence.charterPath,
    cautions: [
      "本记录来自西藏大学本科招生网公开的2026年分省分专业招生计划 API，只作当年专业池、计划数、科类和招生路径约束，不是投档线、录取最低分或录取概率。",
      "接口中的 score=0 是占位值，batch 为空；运行层不把它们转换成录取分数、批次或专业组。西藏普通计划的空选科保持为空，不补造‘不限选考’。",
      "学校章程提示最终招生专业及人数以各省发布数据为准；章程 headline 为2770个计划，接口明细合计2706个，差额64不推断缺失记录。",
    ],
  };
  return record;
}

function compactRecord(record) {
  const compact = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    // sourceSubjectRaw is intentionally retained when it is an empty string as API evidence.
    if (value === "" && key !== "sourceSubjectRaw") continue;
    compact[key] = value;
  }
  return compact;
}

function typeBreakdown(records) {
  return Object.fromEntries([...new Set(records.map((record) => record.admissionType))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN")).map((type) => {
    const rows = records.filter((record) => record.admissionType === type);
    return [type, { records: rows.length, planCount: rows.reduce((sum, row) => sum + row.planCount, 0) }];
  }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(`Usage:\n  node scripts/import-official-national-school-plan-2026-v363-utibet.mjs --use-cache`); return; }
  const rawDir = path.resolve(PROJECT_ROOT, args.rawDir);
  fs.mkdirSync(rawDir, { recursive: true });
  const categoryPath = path.join(rawDir, "category-list.json");
  const categoryBytes = await readOrFetch(categoryPath, () => fetchBytes(CATEGORY_URL, { method: "POST", body: "type=1", headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" } }), args.useCache);
  const categories = parseCategoryResponse(categoryBytes);
  const hierarchy = categoryIndex(categories);
  invariant(sha256(categoryBytes) === EXPECTED_CATEGORY_SHA256, "category/list raw response hash changed");
  invariant(hierarchy.roots.length === EXPECTED.categoryRootCount, `expected ${EXPECTED.categoryRootCount} province roots, got ${hierarchy.roots.length}`);
  invariant(hierarchy.years.length === EXPECTED.yearNodeCount, `expected ${EXPECTED.yearNodeCount} 2026 nodes, got ${hierarchy.years.length}`);
  invariant(hierarchy.subjects.length === EXPECTED.subjectNodeCount, `expected ${EXPECTED.subjectNodeCount} subject nodes, got ${hierarchy.subjects.length}`);

  const entries = [];
  for (const entry of hierarchy.subjects) {
    const infoPath = path.join(rawDir, `info-${entry.subject.id}.json`);
    const infoBytes = await readOrFetch(infoPath, () => fetchBytes(INFO_URL, { method: "POST", body: `cid=${entry.subject.id}`, headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" } }), args.useCache);
    entries.push({ ...entry, items: parseInfoResponse(infoBytes), infoPath, infoBytes });
  }
  const emptySubjectNodeIds = entries.filter((entry) => entry.items.length === 0).map((entry) => entry.subject.id).sort((a, b) => a - b);
  invariant(JSON.stringify(emptySubjectNodeIds) === JSON.stringify(EXPECTED.emptySubjectNodeIds), `empty subject nodes changed: ${emptySubjectNodeIds.join(",")}`);
  const canonicalHash = canonicalPayloadSha256(entries);
  const rawCorpusHash = sha256(Buffer.concat([categoryBytes, ...entries.map((entry) => entry.infoBytes)]));
  invariant(canonicalHash === EXPECTED_CANONICAL_SHA256, "canonical API payload hash changed");
  invariant(rawCorpusHash === EXPECTED_RAW_CORPUS_SHA256, "raw API corpus hash changed");

  const charterPath = path.join(rawDir, "charter-page.html");
  const charterBytes = await readOrFetch(charterPath, () => fetchBytes(CHARTER_URL, { headers: { accept: "text/html,*/*", referer: UI_URL } }), args.useCache);
  const charterText = charterBytes.toString("utf8");
  invariant(/西藏大学/.test(charterText) && /2026年普通本科招生章程/.test(charterText), "official charter evidence missing");
  const evidence = { categoryPath: relativeProjectPath(categoryPath), charterPath: relativeProjectPath(charterPath) };
  const records = entries.flatMap((entry) => entry.items.map((item) => compactRecord(recordFromItem(item, entry, evidence))));
  const provinces = [...new Set(records.map((record) => record.province))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const ordinary = records.filter((record) => record.formalScoreScope === "school-official-only");
  const special = records.filter((record) => record.formalScoreScope === "special-path-only");
  const planCount = records.reduce((sum, record) => sum + record.planCount, 0);
  const sourceNote = {
    id: SOURCE_ID,
    title: "西藏大学2026年招生计划",
    publisher: "西藏大学本科招生网",
    url: UI_URL,
    apiEndpoint: CATEGORY_URL,
    infoEndpoint: INFO_URL,
    jsUrl: LIB_URL,
    charterUrl: CHARTER_URL,
    quality: "official-school-utibet-2026-national-plan-api",
    schoolCode: SCHOOL_CODE,
    schoolIdentifierCode: SCHOOL_IDENTIFIER_CODE,
    schoolName: SCHOOL_NAME,
    records: records.length,
    parsedRecords: records.length,
    rawRecords: records.length,
    duplicateRows: 0,
    invalidRows: 0,
    rawPlanCount: planCount,
    planCount,
    provinces: provinces.length,
    provinceCount: provinces.length,
    ordinaryRecords: ordinary.length,
    ordinaryPlanCount: ordinary.reduce((sum, record) => sum + record.planCount, 0),
    specialPathRecords: special.length,
    specialPlanCount: special.reduce((sum, record) => sum + record.planCount, 0),
    categoryRootCount: hierarchy.roots.length,
    yearNodeCount: hierarchy.years.length,
    subjectNodeCount: hierarchy.subjects.length,
    emptySubjectNodeCount: emptySubjectNodeIds.length,
    emptySubjectNodeIds,
    headlinePlanCount: 2770,
    apiPlanCount: planCount,
    unattributedDelta: 64,
    typeBreakdown: typeBreakdown(records),
    canonicalPayloadSha256: canonicalHash,
    categoryResponseSha256: sha256(categoryBytes),
    rawCorpusSha256: rawCorpusHash,
    evidencePath: evidence.categoryPath,
    charterEvidencePath: evidence.charterPath,
    finalPlanCaveat: true,
    usage: "仅用于当年专业池、计划数、科类和招生路径约束，不替代省级考试院计划、投档线、录取最低分或录取概率。",
    cautions: [
      "分类目录由 category/list 提供，专业明细由 info/list 按 subject 节点提供；59个节点中4个为空，未补造缺失记录。",
      "全部明细 score=0、batch为空；西藏普通计划存在空选科，运行层保留原始空值，不将占位值解释为录取分数或‘不限选考’。",
      "西藏大学2026年招生章程 headline 为2770个计划，API明细合计2706个，存在64个未归属差额；最终招生专业及人数以各省发布数据为准。",
    ],
  };
  invariant(records.length === EXPECTED.records, `expected ${EXPECTED.records} records, got ${records.length}`);
  invariant(planCount === EXPECTED.planCount, `expected ${EXPECTED.planCount} plans, got ${planCount}`);
  invariant(ordinary.length === EXPECTED.ordinaryRecords && ordinary.reduce((sum, record) => sum + record.planCount, 0) === EXPECTED.ordinaryPlanCount, "ordinary totals changed");
  invariant(special.length === EXPECTED.specialPathRecords && special.reduce((sum, record) => sum + record.planCount, 0) === EXPECTED.specialPlanCount, "special totals changed");
  invariant(new Set(records.map((record) => record.id)).size === records.length, "record IDs must be unique");
  const output = {
    version: "v3.363",
    generatedAt: new Date().toISOString(),
    dataset: "official-utibet-national-plan-2026-v3.363",
    sourceNotes: [sourceNote],
    summary: { records: records.length, planCount, rawRecords: records.length, rawPlanCount: planCount, duplicateRows: 0, invalidRows: 0, provinces: provinces.length, ordinaryRecords: ordinary.length, specialPathRecords: special.length, typeBreakdown: typeBreakdown(records) },
    records,
  };
  const outputFile = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "ok", version: output.version, records: records.length, provinces: provinces.length, planCount, ordinaryRecords: ordinary.length, specialPathRecords: special.length, canonicalPayloadSha256: canonicalHash, rawCorpusSha256: rawCorpusHash, sha256: sha256File(outputFile) }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
