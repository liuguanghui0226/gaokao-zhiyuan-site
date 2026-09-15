#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUTPUT = "site/data/release-v3.275/admission-plan-supplement-v349.json.gz";
const INPUTS = [
  "data/admissions/official-national-school-plan-2026-v348-suda-import.json",
  "data/admissions/official-national-school-plan-2026-v349-jnu-import.json",
];
const VERSION = "v3.349";
const RECORD_FIELDS = [
  "id", "province", "year", "subjectType", "batch", "schoolName", "schoolCode", "schoolTags",
  "city", "campus", "dataType", "majorName", "majorCode", "majorGroup", "electiveRequirement",
  "sourcePlanYear", "programDuration", "educationLevel", "cautions", "planCount", "tuition",
  "sourceQuality", "sourceId", "sourceSubjectRaw", "formalScoreScope", "admissionType", "admissionSubtype",
  "schoolOfficialScope", "planRemark", "sourceUrl", "sourcePageUrl", "sourceIndexUrl", "sourcePlanTypeRaw",
  "sourceBatchRaw", "sourceMajorGroupRaw",
];

function usage() {
  return `Usage:\n  node scripts/build-admission-plan-supplement-v349.mjs --out ${DEFAULT_OUTPUT}`;
}

function parseArgs(argv) {
  const args = { out: DEFAULT_OUTPUT };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") args.out = argv[++index];
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

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function countBy(records, predicate) {
  return records.filter(predicate).length;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const inputs = INPUTS.map((relativePath) => {
    const file = path.resolve(PROJECT_ROOT, relativePath);
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    const source = parsed.sourceNotes?.[0];
    if (!source?.id || !Array.isArray(parsed.records)) throw new Error(`Invalid input: ${relativePath}`);
    return { relativePath, file, parsed, source };
  });
  const records = [];
  for (const input of inputs) {
    for (const record of input.parsed.records) records.push(compactRecord(record));
  }
  const uniqueRecords = [...new Map(records.map((record) => [record.id, record])).values()];
  if (uniqueRecords.length !== records.length) throw new Error("Combined supplement contains duplicate record ids");
  if (!uniqueRecords.every((record) => record.dataType === "admission-plan")) throw new Error("Combined supplement may contain admission-plan records only");
  const provinces = [...new Set(uniqueRecords.map((record) => record.province).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const schools = [...new Set(uniqueRecords.map((record) => record.schoolCode || record.schoolName).filter(Boolean))];
  const sourceSummaries = inputs.map(({ source, parsed }) => ({
    id: source.id,
    title: source.title,
    publisher: source.publisher,
    url: source.url,
    quality: source.quality,
    schoolCode: parsed.records[0]?.schoolCode || "",
    schoolName: parsed.records[0]?.schoolName || "",
    records: parsed.records.length,
    ordinaryRecords: countBy(parsed.records, (record) => record.formalScoreScope === "school-official-only"),
    specialPathRecords: countBy(parsed.records, (record) => record.formalScoreScope === "special-path-only"),
    provinces: new Set(parsed.records.map((record) => record.province).filter(Boolean)).size,
    usage: source.usage,
  }));
  const aggregateSource = {
    id: "official-national-school-plan-supplement-2026",
    title: "官方院校 2026 分省分专业计划补充（苏州大学、暨南大学）",
    publisher: "苏州大学、暨南大学本科招生办公室",
    url: "https://zsb.jnu.edu.cn/40329/main.psp",
    quality: "official-school-national-plan-html-2026-multi-source",
    usage: "运行时独立补充层，汇总两所高校官网 2026 年分省分专业计划；只用于当年专业池、计划数、科类、选科和路径约束，不替代省级考试院计划、投档线或录取概率。",
  };
  const payload = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    type: "runtime-admission-plan-supplement",
    source: aggregateSource,
    sources: sourceSummaries,
    summary: {
      records: uniqueRecords.length,
      ordinaryRecords: countBy(uniqueRecords, (record) => record.formalScoreScope === "school-official-only"),
      specialPathRecords: countBy(uniqueRecords, (record) => record.formalScoreScope === "special-path-only"),
      provinces: provinces.length,
      schools: schools.length,
      provinceBreakdown: provinces.map((province) => {
        const rows = uniqueRecords.filter((record) => record.province === province);
        return {
          province,
          records: rows.length,
          ordinaryRecords: countBy(rows, (record) => record.formalScoreScope === "school-official-only"),
          specialPathRecords: countBy(rows, (record) => record.formalScoreScope === "special-path-only"),
        };
      }),
    },
    cautions: [...new Set(inputs.flatMap(({ source }) => source.cautions || []))],
    inputs: inputs.map(({ relativePath, file, parsed }) => ({
      path: relativePath,
      sha256: sha256(fs.readFileSync(file)),
      records: parsed.records.length,
    })),
    records: uniqueRecords,
  };
  const outputPath = path.resolve(PROJECT_ROOT, args.out);
  const bytes = Buffer.from(JSON.stringify(payload));
  const compressed = zlib.gzipSync(bytes, { level: 9 });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, compressed);
  console.log(JSON.stringify({
    status: "ok",
    version: VERSION,
    out: path.relative(PROJECT_ROOT, outputPath),
    records: uniqueRecords.length,
    provinces: provinces.length,
    schools: schools.length,
    ordinaryRecords: payload.summary.ordinaryRecords,
    specialPathRecords: payload.summary.specialPathRecords,
    bytes: compressed.length,
    sha256: sha256(compressed),
  }, null, 2));
}

main();
