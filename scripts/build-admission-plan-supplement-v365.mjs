#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUTPUT = "site/data/release-v3.275/admission-plan-supplement-v365.json.gz";
const INPUT = "data/admissions/official-national-school-plan-2026-v365-cust-import.json";
const VERSION = "v3.365";
const RECORD_FIELDS = [
  "id", "province", "year", "sourcePlanYear", "subjectType", "batch", "sourceBatchRaw",
  "schoolName", "schoolCode", "schoolIdentifierCode", "schoolTags", "dataType",
  "majorName", "sourceMajorRaw", "majorCode", "majorGroup", "electiveRequirement", "sourceElectiveRaw",
  "sourceTypeRaw", "sourceSubjectRaw", "sourceProvinceLabel", "sourcePlanSchemaColumns",
  "planCount", "tuition", "programDuration", "formalScoreScope", "admissionType", "admissionSubtype",
  "schoolOfficialScope", "planRemark", "sourceQuality", "sourceId", "sourceUrl", "sourcePageUrl",
  "sourceIndexUrl", "officialEvidencePath", "officialCharterEvidencePath", "cautions",
];

function invariant(condition, message) {
  if (!condition) throw new Error(`CUST v3.365 runtime build failed: ${message}`);
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
    if (value === "" && !["sourceElectiveRaw", "sourceSubjectRaw"].includes(field)) continue;
    compact[field] = value;
  }
  if (Array.isArray(compact.cautions) && compact.cautions.length > 4) compact.cautions = compact.cautions.slice(0, 4);
  return compact;
}

function countBy(records, predicate) {
  return records.filter(predicate).length;
}

function sumPlans(records) {
  return records.reduce((sum, record) => sum + Number(record.planCount || 0), 0);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:\n  node scripts/build-admission-plan-supplement-v365.mjs --out ${DEFAULT_OUTPUT}`);
    return;
  }
  const inputPath = path.resolve(PROJECT_ROOT, INPUT);
  const inputBytes = fs.readFileSync(inputPath);
  const input = JSON.parse(inputBytes.toString("utf8"));
  const source = input.sourceNotes?.[0];
  invariant(input.dataset === "official-cust-national-plan-2026-v3.365", "unexpected import dataset");
  invariant(source?.id === "official-cust-national-plan-2026-html", "unexpected source id");
  invariant(Array.isArray(input.records) && input.records.length === 1283, "record count changed");
  invariant(source.rawRecords === 1283 && source.rawPlanCount === 5132 && source.invalidRows === 0 && source.duplicateRows === 0, "source totals changed");
  invariant(source.rawCorpusSha256 === "b6759cdc4a4feee1970a3f25b7ebf131b0a15a17139e61cd23d78f15a1a6e0ac", "raw corpus hash changed");
  invariant(source.canonicalPayloadSha256 === "d7062daa30920c4d17101e0cb598dc05cdd5276f4193f516839862c81a35a0fe", "canonical payload hash changed");

  const records = input.records.map(compactRecord);
  invariant(new Set(records.map((record) => record.id)).size === records.length, "duplicate record IDs");
  invariant(records.every((record) => record.dataType === "admission-plan"), "non-plan records are not allowed");
  const provinces = [...new Set(records.map((record) => record.province).filter(Boolean))].sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
  const schools = [...new Set(records.map((record) => record.schoolCode || record.schoolName).filter(Boolean))];
  const ordinaryRecords = records.filter((record) => record.formalScoreScope === "school-official-only");
  const specialRecords = records.filter((record) => record.formalScoreScope === "special-path-only");
  invariant(provinces.length === 31 && schools.length === 1, "province or school coverage changed");
  invariant(ordinaryRecords.length === 1035 && sumPlans(ordinaryRecords) === 4075, "ordinary totals changed");
  invariant(specialRecords.length === 248 && sumPlans(specialRecords) === 1057, "special totals changed");

  const provinceBreakdown = provinces.map((province) => {
    const rows = records.filter((record) => record.province === province);
    return {
      province,
      records: rows.length,
      planCount: sumPlans(rows),
      ordinaryRecords: countBy(rows, (record) => record.formalScoreScope === "school-official-only"),
      specialPathRecords: countBy(rows, (record) => record.formalScoreScope === "special-path-only"),
    };
  });
  const payload = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    type: "runtime-admission-plan-supplement",
    source: {
      id: source.id,
      title: source.title,
      publisher: source.publisher,
      url: source.url,
      indexUrl: source.indexUrl,
      charterUrl: source.charterUrl,
      quality: source.quality,
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
      provinces: provinces.length,
      schools: schools.length,
      ordinaryRecords: ordinaryRecords.length,
      ordinaryPlanCount: sumPlans(ordinaryRecords),
      specialPathRecords: specialRecords.length,
      specialPlanCount: sumPlans(specialRecords),
      fourColumnPageCount: source.fourColumnPageCount,
      threeColumnPageCount: source.threeColumnPageCount,
      typeBreakdown: source.typeBreakdown,
      provinceBreakdown,
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
    provinces: provinces.length,
    schools: schools.length,
    planCount: payload.summary.planCount,
    ordinaryRecords: ordinaryRecords.length,
    specialPathRecords: specialRecords.length,
    bytes: compressed.length,
    sha256: sha256(compressed),
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
