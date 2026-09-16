#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUTPUT = "site/data/release-v3.275/admission-plan-supplement-v363.json.gz";
const INPUT = "data/admissions/official-national-school-plan-2026-v363-utibet-import.json";
const VERSION = "v3.363";
const RECORD_FIELDS = [
  "id", "province", "year", "sourcePlanYear", "subjectType", "batch", "sourceBatchRaw", "schoolName", "schoolCode", "schoolIdentifierCode", "schoolTags",
  "dataType", "majorName", "sourceMajorRaw", "majorCode", "majorGroup", "electiveRequirement", "sourceExamRequirementRaw", "educationLevel", "cautions", "planCount",
  "tuition", "sourceTuitionRaw", "programDuration", "sourceQuality", "sourceId", "sourceTypeRaw", "sourceSubjectRaw", "sourceSubjectCategoryRaw", "sourceDepartmentRaw", "sourceCampusRaw", "sourceNoteRaw",
  "formalScoreScope", "admissionType", "admissionSubtype", "schoolOfficialScope", "planRemark", "sourceUrl", "sourcePageUrl", "sourceIndexUrl", "sourceApiEndpoint", "sourceApiMethod", "sourceApiBody", "sourceCategoryId", "sourceCategoryYearId", "sourceCategoryProvinceId", "sourcePlanTypeRaw", "officialEvidencePath", "officialCharterEvidencePath",
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

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }

function compactRecord(record) {
  const compact = {};
  for (const field of RECORD_FIELDS) {
    const value = record[field];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (value === "" && field !== "sourceSubjectRaw") continue;
    compact[field] = value;
  }
  if (Array.isArray(compact.cautions) && compact.cautions.length > 3) compact.cautions = compact.cautions.slice(0, 3);
  return compact;
}

function countBy(records, predicate) { return records.filter(predicate).length; }

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(`Usage:\n  node scripts/build-admission-plan-supplement-v363.mjs --out ${DEFAULT_OUTPUT}`); return; }
  const inputPath = path.resolve(PROJECT_ROOT, INPUT);
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const source = input.sourceNotes?.[0];
  if (input.dataset !== "official-utibet-national-plan-2026-v3.363" || !source || source.id !== "official-utibet-national-plan-2026-api") throw new Error("Invalid UTibet v3.363 import");
  if (!Array.isArray(input.records) || input.records.length !== 659) throw new Error("UTibet record count changed");
  if (source.rawRecords !== 659 || source.invalidRows !== 0 || source.duplicateRows !== 0 || source.rawPlanCount !== 2706 || source.planCount !== 2706 || source.provinces !== 26) throw new Error("UTibet source totals changed");
  const records = input.records.map(compactRecord);
  if (new Set(records.map((record) => record.id)).size !== records.length) throw new Error("UTibet supplement contains duplicate record IDs");
  const provinces = [...new Set(records.map((record) => record.province).filter(Boolean))].sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
  const schools = [...new Set(records.map((record) => record.schoolCode || record.schoolName).filter(Boolean))];
  const provinceBreakdown = provinces.map((province) => {
    const rows = records.filter((record) => record.province === province);
    return { province, records: rows.length, planCount: rows.reduce((sum, record) => sum + Number(record.planCount || 0), 0), ordinaryRecords: countBy(rows, (record) => record.formalScoreScope === "school-official-only"), specialPathRecords: countBy(rows, (record) => record.formalScoreScope === "special-path-only") };
  });
  const payload = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    type: "runtime-admission-plan-supplement",
    source: { id: source.id, title: source.title, publisher: source.publisher, url: source.url, apiEndpoint: source.apiEndpoint, infoEndpoint: source.infoEndpoint, jsUrl: source.jsUrl, charterUrl: source.charterUrl, quality: source.quality, usage: source.usage },
    sources: [{ ...source, records: records.length, parsedRecords: records.length }],
    summary: {
      records: records.length,
      ordinaryRecords: countBy(records, (record) => record.formalScoreScope === "school-official-only"),
      specialPathRecords: countBy(records, (record) => record.formalScoreScope === "special-path-only"),
      planCount: records.reduce((sum, record) => sum + Number(record.planCount || 0), 0),
      rawPlanCount: source.rawPlanCount,
      duplicateRows: source.duplicateRows,
      invalidRows: source.invalidRows,
      rawRecords: source.rawRecords,
      provinces: provinces.length,
      schools: schools.length,
      typeBreakdown: source.typeBreakdown,
      provinceBreakdown,
      categoryRootCount: source.categoryRootCount,
      yearNodeCount: source.yearNodeCount,
      subjectNodeCount: source.subjectNodeCount,
      emptySubjectNodeCount: source.emptySubjectNodeCount,
      headlinePlanCount: source.headlinePlanCount,
      apiPlanCount: source.apiPlanCount,
      unattributedDelta: source.unattributedDelta,
    },
    cautions: source.cautions,
    inputs: [{ path: INPUT, sha256: sha256(fs.readFileSync(inputPath)), records: records.length }],
    records,
  };
  const outputPath = path.resolve(PROJECT_ROOT, args.out);
  const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, compressed);
  console.log(JSON.stringify({ status: "ok", version: VERSION, out: path.relative(PROJECT_ROOT, outputPath), records: records.length, provinces: provinces.length, schools: schools.length, planCount: payload.summary.planCount, ordinaryRecords: payload.summary.ordinaryRecords, specialPathRecords: payload.summary.specialPathRecords, bytes: compressed.length, sha256: sha256(compressed) }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
