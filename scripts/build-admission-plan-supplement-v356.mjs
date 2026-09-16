#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUTPUT = "site/data/release-v3.275/admission-plan-supplement-v356.json.gz";
const BASE_INPUT = "site/data/release-v3.275/admission-plan-supplement-v355.json.gz";
const SDNU_INPUT = "data/admissions/official-national-school-plan-2026-v356-sdnu-import.json";
const VERSION = "v3.356";
const RECORD_FIELDS = [
  "id", "province", "year", "subjectType", "batch", "schoolName", "schoolCode", "schoolTags",
  "city", "campus", "dataType", "majorName", "majorCode", "majorGroup", "electiveRequirement",
  "selectionRequirementSourceUrl", "selectionRequirementEvidencePath", "sourcePlanYear", "programDuration",
  "educationLevel", "cautions", "planCount", "tuition", "sourceQuality", "sourceId", "sourceSubjectRaw",
  "formalScoreScope", "admissionType", "admissionSubtype", "schoolOfficialScope", "planRemark", "sourceUrl",
  "sourcePageUrl", "sourceIndexUrl", "sourcePlanTypeRaw", "sourceBatchRaw", "sourceMajorGroupRaw",
  "sourceProvinceId", "sourceYearId", "sourceCategoryId", "sourceTypeId", "sourceProvinceQuery", "sourceYearQuery",
  "sourceCategoryQuery", "sourceTypeQuery", "officialEvidencePath",
];

function parseArgs(argv) {
  const args = { out: DEFAULT_OUTPUT };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") args.out = argv[++index];
    else if (value === "--help" || value === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function compactRecord(record) {
  const compact = {};
  for (const field of RECORD_FIELDS) {
    const value = record[field];
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    compact[field] = value;
  }
  if (Array.isArray(compact.cautions) && compact.cautions.length > 3) compact.cautions = compact.cautions.slice(0, 3);
  return compact;
}

function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function countBy(records, predicate) { return records.filter(predicate).length; }

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(`Usage:\n  node scripts/build-admission-plan-supplement-v356.mjs --out ${DEFAULT_OUTPUT}`); return; }
  const basePath = path.resolve(PROJECT_ROOT, BASE_INPUT);
  const sdnuPath = path.resolve(PROJECT_ROOT, SDNU_INPUT);
  const base = JSON.parse(zlib.gunzipSync(fs.readFileSync(basePath), { to: "string" }));
  const sdnu = JSON.parse(fs.readFileSync(sdnuPath, "utf8"));
  const sdnuSource = sdnu.sourceNotes?.[0];
  if (base.version !== "v3.355" || !Array.isArray(base.records)) throw new Error("Invalid v3.355 base supplement");
  if (!sdnuSource?.id || sdnuSource.id !== "official-sdnu-national-plan-2026" || !Array.isArray(sdnu.records) || sdnu.records.length !== 1032) throw new Error("Invalid SDNU import");
  if (sdnuSource.planCount !== 6119 || sdnuSource.provinces !== 29 || sdnuSource.pathCount !== 103) throw new Error("SDNU source totals changed");
  const records = [...base.records, ...sdnu.records].map(compactRecord);
  const uniqueRecords = [...new Map(records.map((record) => [record.id, record])).values()];
  if (uniqueRecords.length !== records.length) throw new Error("Combined supplement contains duplicate record ids");
  const provinces = [...new Set(uniqueRecords.map((record) => record.province).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const schools = [...new Set(uniqueRecords.map((record) => record.schoolCode || record.schoolName).filter(Boolean))];
  const sdnuSummary = {
    id: sdnuSource.id,
    title: sdnuSource.title,
    publisher: sdnuSource.publisher,
    url: sdnuSource.url,
    quality: sdnuSource.quality,
    schoolCode: sdnuSource.schoolCode,
    schoolName: sdnuSource.schoolName,
    records: sdnu.records.length,
    ordinaryRecords: countBy(sdnu.records, (record) => record.formalScoreScope === "school-official-only"),
    specialPathRecords: countBy(sdnu.records, (record) => record.formalScoreScope === "special-path-only"),
    provinces: sdnuSource.provinces,
    pathCount: sdnuSource.pathCount,
    queryCount: sdnuSource.queryCount,
    provinceOptions: sdnuSource.provinceOptions,
    emptyProvinces: sdnuSource.emptyProvinces,
    byType: sdnuSource.byType,
    byTypePlanCount: sdnuSource.byTypePlanCount,
    headlinePlanCount: sdnuSource.headlinePlanCount,
    apiPlanCount: sdnuSource.apiPlanCount,
    unattributedDelta: sdnuSource.unattributedDelta,
    planCount: sdnuSource.planCount,
    charterUrl: sdnuSource.charterUrl,
    guideUrl: sdnuSource.guideUrl,
    cautions: sdnuSource.cautions,
    evidencePath: sdnuSource.evidencePath,
    pageSha256: sdnuSource.pageSha256,
    usage: sdnuSource.usage,
  };
  const payload = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    type: "runtime-admission-plan-supplement",
    source: {
      id: "official-national-school-plan-supplement-2026",
      title: "官方院校 2026 分省分专业计划补充（苏州大学、暨南大学、茅台学院、厦门大学、辽宁石油化工大学、大连海事大学、上海理工大学、齐鲁工业大学、山东师范大学）",
      publisher: "九所高校招生办公室或本科招生网",
      url: sdnuSource.url,
      quality: "official-school-national-plan-html-api-2026-multi-source",
      usage: "运行时独立补充层，汇总九所高校官网 2026 年分省分专业计划；只用于当年专业池、计划数、科类、选科和路径约束，不替代省级考试院计划、投档线或录取概率。",
    },
    sources: [...(base.sources || []).map((source) => ({ ...source })), sdnuSummary],
    summary: {
      records: uniqueRecords.length,
      ordinaryRecords: countBy(uniqueRecords, (record) => record.formalScoreScope === "school-official-only"),
      specialPathRecords: countBy(uniqueRecords, (record) => record.formalScoreScope === "special-path-only"),
      provinces: provinces.length,
      schools: schools.length,
      provinceBreakdown: provinces.map((province) => {
        const rows = uniqueRecords.filter((record) => record.province === province);
        return { province, records: rows.length, ordinaryRecords: countBy(rows, (record) => record.formalScoreScope === "school-official-only"), specialPathRecords: countBy(rows, (record) => record.formalScoreScope === "special-path-only") };
      }),
    },
    cautions: [...new Set([...(base.cautions || []), ...(sdnuSource.cautions || [])])],
    inputs: [
      { path: BASE_INPUT, sha256: sha256(fs.readFileSync(basePath)), records: base.records.length },
      { path: SDNU_INPUT, sha256: sha256(fs.readFileSync(sdnuPath)), records: sdnu.records.length },
    ],
    records: uniqueRecords,
  };
  const outputPath = path.resolve(PROJECT_ROOT, args.out);
  const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, compressed);
  console.log(JSON.stringify({ status: "ok", version: VERSION, out: path.relative(PROJECT_ROOT, outputPath), records: uniqueRecords.length, provinces: provinces.length, schools: schools.length, ordinaryRecords: payload.summary.ordinaryRecords, specialPathRecords: payload.summary.specialPathRecords, bytes: compressed.length, sha256: sha256(compressed) }, null, 2));
}

main();
