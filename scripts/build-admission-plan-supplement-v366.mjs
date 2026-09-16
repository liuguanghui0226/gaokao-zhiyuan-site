#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUTPUT = "site/data/release-v3.275/admission-plan-supplement-v366.json.gz";
const INPUT = "data/admissions/official-national-school-plan-2026-v366-ecnu-import.json";
const VERSION = "v3.366";
const RECORD_FIELDS = [
  "id", "province", "year", "sourcePlanYear", "subjectType", "batch", "sourceBatchRaw",
  "schoolName", "schoolCode", "schoolIdentifierCode", "schoolTags", "dataType",
  "majorName", "sourceMajorRaw", "majorCode", "majorGroup", "planCount", "tuition", "programDuration",
  "electiveRequirement", "sourceElectiveRaw", "sourceProfessionalGroupRaw", "sourceSubjectRaw",
  "sourceTypeRaw", "sourcePlanCategoryRaw", "formalScoreScope", "admissionType", "admissionSubtype",
  "schoolOfficialScope", "planRemark", "sourceQuality", "sourceId", "sourceUrl", "sourcePageUrl",
  "sourceIndexUrl", "officialEvidencePath", "officialCharterEvidencePath", "cautions",
];

function invariant(condition, message) {
  if (!condition) throw new Error(`ECNU v3.366 runtime build failed: ${message}`);
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
    if (value === "" && !["sourceElectiveRaw", "sourceProfessionalGroupRaw"].includes(field)) continue;
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
    console.log(`Usage:\n  node scripts/build-admission-plan-supplement-v366.mjs --out ${DEFAULT_OUTPUT}`);
    return;
  }
  const inputPath = path.resolve(PROJECT_ROOT, INPUT);
  const inputBytes = fs.readFileSync(inputPath);
  const input = JSON.parse(inputBytes.toString("utf8"));
  const source = input.sourceNotes?.[0];
  invariant(input.dataset === "official-ecnu-national-plan-2026-v3.366", "unexpected import dataset");
  invariant(source?.id === "official-ecnu-national-plan-2026-html", "unexpected source id");
  invariant(Array.isArray(input.records) && input.records.length === 1244, "record count changed");
  invariant(source.rawRecords === 1244 && source.rawPlanCount === 3661 && source.invalidRows === 0 && source.duplicateRows === 0, "source totals changed");
  invariant(source.planPageSha256 === "fa465bdee163c1b25d8f6cb3277e39eed263c54045ed2c57e509b80c3f6c6f06", "plan page hash changed");
  invariant(source.charterPageSha256 === "3728b33e05d282440bb05c272c35a7cfff02537663ba05c282e8ddc75b569cb3", "charter page hash changed");
  invariant(source.rawCorpusSha256 === "7768cfe9e6e958e753ed31b63e1cac56f1ca35ffba8925db367aca82429dc81b", "raw corpus hash changed");
  invariant(source.canonicalPayloadSha256 === "9946a7a9ed1a896b40847d617e9b814bdcb8796976a13641b0835f0c3f99c8af", "canonical payload hash changed");

  const records = input.records.map(compactRecord);
  invariant(new Set(records.map((record) => record.id)).size === records.length, "duplicate record IDs");
  invariant(records.every((record) => record.dataType === "admission-plan" && Number.isInteger(record.planCount) && record.planCount > 0), "invalid admission-plan record");
  const provinces = [...new Set(records.map((record) => record.province).filter(Boolean))].sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
  const schools = [...new Set(records.map((record) => record.schoolCode || record.schoolName).filter(Boolean))];
  const ordinaryRecords = records.filter((record) => record.formalScoreScope === "school-official-only");
  const specialRecords = records.filter((record) => record.formalScoreScope === "special-path-only");
  invariant(provinces.length === 31 && schools.length === 1, "province or school coverage changed");
  invariant(ordinaryRecords.length === 519 && sumPlans(ordinaryRecords) === 1791, "ordinary totals changed");
  invariant(specialRecords.length === 725 && sumPlans(specialRecords) === 1870, "special-path totals changed");

  const provinceBreakdown = provinces.map((province) => {
    const rows = records.filter((record) => record.province === province);
    return {
      province,
      records: rows.length,
      planCount: sumPlans(rows),
      ordinaryRecords: rows.filter((record) => record.formalScoreScope === "school-official-only").length,
      specialPathRecords: rows.filter((record) => record.formalScoreScope === "special-path-only").length,
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
      charterUrl: source.charterUrl,
      publishedDate: source.publishedDate,
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
      typeBreakdown: source.typeBreakdown,
      provinceBreakdown,
    },
    cautions: source.cautions,
    inputs: [{ path: INPUT, sha256: sha256(inputBytes), records: records.length }],
    records,
  };
  invariant(payload.summary.planCount === 3661, "runtime plan total changed");
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
