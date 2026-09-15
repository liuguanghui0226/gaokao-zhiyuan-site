#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_INPUT = "data/admissions/official-national-school-plan-2026-v348-suda-import.json";
const DEFAULT_OUTPUT = "site/data/release-v3.275/admission-plan-supplement-v348.json.gz";
const VERSION = "v3.348";
const RECORD_FIELDS = [
  "id", "province", "year", "subjectType", "batch", "schoolName", "schoolCode", "schoolTags",
  "city", "dataType", "majorName", "majorGroup", "planCount", "sourceQuality", "sourceId",
  "sourceSubjectRaw", "formalScoreScope", "admissionType", "admissionSubtype", "schoolOfficialScope",
  "planRemark", "sourceUrl", "sourcePageUrl", "sourceIndexUrl", "sourcePlanTypeRaw", "sourceBatchRaw",
  "cautions",
];

function usage() {
  return [
    "Usage:",
    `  node scripts/build-admission-plan-supplement-v348.mjs --input ${DEFAULT_INPUT} --out ${DEFAULT_OUTPUT}`,
  ].join("\n");
}

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT, out: DEFAULT_OUTPUT };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--input") args.input = argv[++index];
    else if (value === "--out") args.out = argv[++index];
    else if (value === "--help" || value === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${value}\n${usage()}`);
  }
  return args;
}

function normalizeProvince(value) {
  return String(value || "").trim() === "内蒙" ? "内蒙古" : String(value || "").trim();
}

function compactRecord(record) {
  const compact = {};
  for (const field of RECORD_FIELDS) {
    const value = record[field];
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    compact[field] = field === "province" ? normalizeProvince(value) : value;
  }
  if (Array.isArray(compact.cautions) && compact.cautions.length > 2) compact.cautions = compact.cautions.slice(0, 2);
  return compact;
}

function countBy(records, predicate) {
  return records.filter(predicate).length;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const inputPath = path.resolve(PROJECT_ROOT, args.input);
  const outputPath = path.resolve(PROJECT_ROOT, args.out);
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const source = input.sourceNotes?.[0];
  if (!source?.id || !Array.isArray(input.records)) throw new Error("Input must contain sourceNotes[0] and records");
  const records = [...new Map(input.records.map((record) => [record.id, compactRecord(record)])).values()];
  if (records.length !== input.records.length) throw new Error("Input contains duplicate record ids");
  if (!records.every((record) => record.dataType === "admission-plan")) throw new Error("Supplement may contain admission-plan records only");
  const provinces = [...new Set(records.map((record) => record.province).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const provinceBreakdown = provinces.map((province) => {
    const rows = records.filter((record) => record.province === province);
    return {
      province,
      records: rows.length,
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
      quality: source.quality,
      schoolCode: "10285",
      schoolName: "苏州大学",
      usage: source.usage,
    },
    summary: {
      records: records.length,
      ordinaryRecords: countBy(records, (record) => record.formalScoreScope === "school-official-only"),
      specialPathRecords: countBy(records, (record) => record.formalScoreScope === "special-path-only"),
      provinces: provinces.length,
      provinceBreakdown,
    },
    cautions: source.cautions || [],
    inputSha256: sha256(fs.readFileSync(inputPath)),
    records,
  };
  const bytes = Buffer.from(JSON.stringify(payload));
  const compressed = zlib.gzipSync(bytes, { level: 9 });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, compressed);
  console.log(JSON.stringify({
    status: "ok",
    version: VERSION,
    out: path.relative(PROJECT_ROOT, outputPath),
    records: records.length,
    provinces: provinces.length,
    ordinaryRecords: payload.summary.ordinaryRecords,
    specialPathRecords: payload.summary.specialPathRecords,
    bytes: compressed.length,
    sha256: sha256(compressed),
  }, null, 2));
}

main();
