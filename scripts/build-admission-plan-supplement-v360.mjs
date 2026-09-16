#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUTPUT = "site/data/release-v3.275/admission-plan-supplement-v360.json.gz";
const INPUT = "data/admissions/official-national-school-plan-2026-v360-xzmu-import.json";
const VERSION = "v3.360";
const RECORD_FIELDS = [
  "id", "province", "year", "sourcePlanYear", "subjectType", "batch", "sourceBatchRaw", "schoolName", "schoolCode", "schoolTags",
  "dataType", "majorName", "majorCode", "majorGroup", "electiveRequirement", "sourceExamRequirementRaw", "educationLevel", "cautions", "planCount",
  "tuition", "sourceTuitionRaw", "programDuration", "sourceQuality", "sourceId", "sourceSubjectRaw", "sourceDepartmentRaw", "sourceCampusRaw", "sourceNoteRaw", "sourceSchoolRowTotal",
  "formalScoreScope", "admissionType", "admissionSubtype", "schoolOfficialScope", "planRemark", "sourceUrl", "sourcePageUrl", "sourceIndexUrl", "officialEvidencePath",
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
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    compact[field] = value;
  }
  if (Array.isArray(compact.cautions) && compact.cautions.length > 3) compact.cautions = compact.cautions.slice(0, 3);
  return compact;
}

function countBy(records, predicate) { return records.filter(predicate).length; }

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(`Usage:\n  node scripts/build-admission-plan-supplement-v360.mjs --out ${DEFAULT_OUTPUT}`); return; }
  const inputPath = path.resolve(PROJECT_ROOT, INPUT);
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const source = input.sourceNotes?.[0];
  if (input.dataset !== "official-xzmu-national-plan-2026-v3.360" || !source || source.id !== "official-xzmu-national-plan-2026") throw new Error("Invalid XZMU v3.360 import");
  if (!Array.isArray(input.records) || input.records.length !== 259) throw new Error("XZMU record count changed");
  if (source.rawRows !== 54 || source.duplicateRows !== 0 || source.rawPlanCount !== 2825 || source.planCount !== 2825 || source.provinces !== 20) throw new Error("XZMU source totals changed");
  const records = input.records.map(compactRecord);
  if (new Set(records.map((record) => record.id)).size !== records.length) throw new Error("XZMU supplement contains duplicate record IDs");
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
    source: { id: source.id, title: source.title, publisher: source.publisher, url: source.url, quality: source.quality, usage: source.usage },
    sources: [{ ...source, records: records.length, parsedRecords: records.length }],
    summary: {
      records: records.length,
      ordinaryRecords: countBy(records, (record) => record.formalScoreScope === "school-official-only"),
      specialPathRecords: countBy(records, (record) => record.formalScoreScope === "special-path-only"),
      planCount: records.reduce((sum, record) => sum + Number(record.planCount || 0), 0),
      rawPlanCount: source.rawPlanCount,
      duplicateRows: source.duplicateRows,
      provinces: provinces.length,
      schools: schools.length,
      provinceBreakdown,
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
