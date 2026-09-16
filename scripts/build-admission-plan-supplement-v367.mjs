#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUTPUT = "site/data/release-v3.275/admission-plan-supplement-v367.json.gz";
const INPUT = "data/admissions/official-national-school-plan-2026-v367-nchu-import.json";
const VERSION = "v3.367";
const RECORD_FIELDS = [
  "id", "sourceRowId", "province", "year", "sourcePlanYear", "subjectType", "batch", "sourceBatchRaw",
  "schoolName", "schoolCode", "schoolIdentifierCode", "schoolTags", "city", "dataType",
  "majorName", "sourceMajorRaw", "majorCode", "majorGroup", "sourceProfessionalGroupRaw",
  "planCount", "educationLevel", "programDuration", "tuition", "sourceTuitionRaw",
  "electiveRequirement", "sourceSubjectRaw", "sourceExamTypeRaw", "sourceDirectionRaw",
  "sourceTeacherTrainingRaw", "sourcePlanNatureRaw", "sourcePlanCategoryRaw", "sourceTypeRaw", "sourceNoteRaw",
  "formalScoreScope", "admissionType", "admissionSubtype", "schoolOfficialScope", "planRemark",
  "sourceQuality", "sourceId", "sourceUrl", "sourcePageUrl", "sourceIndexUrl", "officialEvidencePath", "cautions",
];

function invariant(condition, message) {
  if (!condition) throw new Error(`NCHU v3.367 runtime build failed: ${message}`);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

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
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (value === "" && field !== "sourceProfessionalGroupRaw") continue;
    compact[field] = value;
  }
  if (Array.isArray(compact.cautions) && compact.cautions.length > 4) compact.cautions = compact.cautions.slice(0, 4);
  return compact;
}

function sumPlans(records) {
  return records.reduce((sum, record) => sum + Number(record.planCount || 0), 0);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:\n  node scripts/build-admission-plan-supplement-v367.mjs --out ${DEFAULT_OUTPUT}`);
    return;
  }
  const inputPath = path.resolve(PROJECT_ROOT, INPUT);
  const inputBytes = fs.readFileSync(inputPath);
  const input = JSON.parse(inputBytes.toString("utf8"));
  const source = input.sourceNotes?.[0];
  invariant(input.version === VERSION && input.dataset === "official-nchu-national-plan-2026-v3.367", "unexpected import dataset");
  invariant(source?.id === "official-nchu-national-plan-2026-api", "unexpected source id");
  invariant(Array.isArray(input.records) && input.records.length === 1092, "record count changed");
  invariant(source.rawRecords === 1092 && source.rawPlanCount === 6988 && source.invalidRows === 0 && source.duplicateRows === 0, "source totals changed");
  invariant(source.apiRequests === 31 && source.provinces === 29 && JSON.stringify(source.emptyProvinces) === JSON.stringify(["西藏", "宁夏"]), "source province coverage changed");
  invariant(source.apiResponseBytes === 1_654_541, "API corpus byte count changed");
  invariant(source.apiCorpusSha256 === "4bdc52c4dfb1a2a3b54b69a18e5814bf47104c4911f4e5e3f688249b94025c97", "API corpus hash changed");
  invariant(source.planScriptSha256 === "e51b23b189902611295795ff07a8479a6c69d15e05972fc4090331f463ecd702", "plan script hash changed");
  invariant(source.canonicalPlanPageSha256 === "793736e03b3298374a5beb664facfa0e3c66ab9885f1eb7e00db08ce50f9c815", "canonical plan page hash changed");
  invariant(source.canonicalArticlePageSha256 === "063b9a66d514ec5bce662364572f55eb5e6e7ff834842cabb40a0724c4ceac02", "canonical article page hash changed");
  invariant(source.stableEvidenceCorpusSha256 === "59e06548fcf9af9ad86c69138a4fb714bfe46ed4a89111cc698c7e24d3f71006", "stable evidence corpus hash changed");
  invariant(source.canonicalPayloadSha256 === "46446617f346820661fe9ce11c91504f692e4d16bb3b4e277dcbaacacd29950b", "canonical payload hash changed");

  const records = input.records.map(compactRecord);
  invariant(new Set(records.map((record) => record.id)).size === records.length, "duplicate record IDs");
  invariant(new Set(records.map((record) => record.sourceRowId)).size === records.length, "duplicate source row IDs");
  invariant(records.every((record) => record.dataType === "admission-plan" && Number.isInteger(record.planCount) && record.planCount > 0), "invalid admission-plan record");
  invariant(records.every((record) => record.schoolCode === "10406" && record.schoolIdentifierCode === "4136010406"), "unexpected school identity");
  const provinces = [...new Set(records.map((record) => record.province).filter(Boolean))];
  const schools = [...new Set(records.map((record) => record.schoolCode || record.schoolName).filter(Boolean))];
  const ordinary = records.filter((record) => record.formalScoreScope === "school-official-only");
  const special = records.filter((record) => record.formalScoreScope === "special-path-only");
  invariant(provinces.length === 29 && schools.length === 1, "province or school coverage changed");
  invariant(sumPlans(records) === 6988, "runtime plan total changed");
  invariant(ordinary.length === 913 && sumPlans(ordinary) === 5780, "ordinary totals changed");
  invariant(special.length === 179 && sumPlans(special) === 1208, "special-path totals changed");

  const payload = {
    version: VERSION,
    generatedAt: input.generatedAt,
    type: "runtime-admission-plan-supplement",
    source: {
      id: source.id,
      title: source.title,
      publisher: source.publisher,
      url: source.url,
      apiUrl: source.apiUrl,
      scriptUrl: source.scriptUrl,
      articleUrl: source.articleUrl,
      publishedDate: source.publishedDate,
      quality: source.quality,
      schoolCode: source.schoolCode,
      schoolIdentifierCode: source.schoolIdentifierCode,
      schoolName: source.schoolName,
      usage: source.usage,
    },
    sources: [{ ...source, records: records.length }],
    summary: {
      records: records.length,
      planCount: sumPlans(records),
      rawRecords: source.rawRecords,
      rawPlanCount: source.rawPlanCount,
      duplicateRows: source.duplicateRows,
      invalidRows: source.invalidRows,
      requestedProvinces: source.requestedProvinces,
      provinces: provinces.length,
      schools: schools.length,
      emptyProvinces: source.emptyProvinces,
      ordinaryRecords: ordinary.length,
      ordinaryPlanCount: sumPlans(ordinary),
      specialPathRecords: special.length,
      specialPlanCount: sumPlans(special),
      typeBreakdown: source.typeBreakdown,
    },
    cautions: source.cautions,
    inputs: [{ path: INPUT, sha256: sha256(inputBytes), records: records.length }],
    records,
  };
  const outputPath = path.resolve(PROJECT_ROOT, args.out);
  const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, compressed);
  console.log(JSON.stringify({
    status: "ok",
    version: VERSION,
    out: path.relative(PROJECT_ROOT, outputPath).replaceAll(path.sep, "/"),
    records: records.length,
    requestedProvinces: source.requestedProvinces,
    provinces: provinces.length,
    schools: schools.length,
    planCount: payload.summary.planCount,
    ordinaryRecords: ordinary.length,
    ordinaryPlanCount: payload.summary.ordinaryPlanCount,
    specialPathRecords: special.length,
    specialPlanCount: payload.summary.specialPlanCount,
    inputBytes: inputBytes.length,
    inputSha256: sha256(inputBytes),
    bytes: compressed.length,
    sha256: sha256(compressed),
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
