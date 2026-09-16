#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUTPUT = "site/data/release-v3.275/admission-plan-supplement-v352.json.gz";
const BASE_INPUT = "site/data/release-v3.275/admission-plan-supplement-v351.json.gz";
const LNPU_INPUT = "data/admissions/official-national-school-plan-2026-v352-lnpu-import.json";
const VERSION = "v3.352";
const RECORD_FIELDS = [
  "id", "province", "year", "subjectType", "batch", "schoolName", "schoolCode", "schoolTags",
  "city", "campus", "dataType", "majorName", "majorCode", "majorGroup", "electiveRequirement",
  "selectionRequirementSourceUrl", "selectionRequirementEvidencePath", "sourcePlanYear", "programDuration",
  "educationLevel", "cautions", "planCount", "tuition", "sourceQuality", "sourceId", "sourceSubjectRaw",
  "formalScoreScope", "admissionType", "admissionSubtype", "schoolOfficialScope", "planRemark", "sourceUrl",
  "sourcePageUrl", "sourceIndexUrl", "sourcePlanTypeRaw", "sourceBatchRaw", "sourceMajorGroupRaw",
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
  if (Array.isArray(compact.cautions) && compact.cautions.length > 2) compact.cautions = compact.cautions.slice(0, 2);
  return compact;
}

function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function countBy(records, predicate) { return records.filter(predicate).length; }

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(`Usage:\n  node scripts/build-admission-plan-supplement-v352.mjs --out ${DEFAULT_OUTPUT}`); return; }
  const basePath = path.resolve(PROJECT_ROOT, BASE_INPUT);
  const lnpuPath = path.resolve(PROJECT_ROOT, LNPU_INPUT);
  const base = JSON.parse(zlib.gunzipSync(fs.readFileSync(basePath), { to: "string" }));
  const lnpu = JSON.parse(fs.readFileSync(lnpuPath, "utf8"));
  if (base.version !== "v3.351" || !Array.isArray(base.records)) throw new Error("Invalid v3.351 base supplement");
  const lnpuSource = lnpu.sourceNotes?.[0];
  if (!lnpuSource?.id || !Array.isArray(lnpu.records) || lnpu.records.length !== 638) throw new Error("Invalid LNPU import");
  const records = [...base.records, ...lnpu.records].map(compactRecord);
  const uniqueRecords = [...new Map(records.map((record) => [record.id, record])).values()];
  if (uniqueRecords.length !== records.length) throw new Error("Combined supplement contains duplicate record ids");
  const provinces = [...new Set(uniqueRecords.map((record) => record.province).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const schools = [...new Set(uniqueRecords.map((record) => record.schoolCode || record.schoolName).filter(Boolean))];
  const sourceSummaries = [
    ...(base.sources || []).map((source) => ({ ...source })),
    {
      id: lnpuSource.id,
      title: lnpuSource.title,
      publisher: lnpuSource.publisher,
      url: lnpuSource.url,
      quality: lnpuSource.quality,
      schoolCode: lnpu.records[0]?.schoolCode || "",
      schoolName: lnpu.records[0]?.schoolName || "",
      records: lnpu.records.length,
      ordinaryRecords: countBy(lnpu.records, (record) => record.formalScoreScope === "school-official-only"),
      specialPathRecords: countBy(lnpu.records, (record) => record.formalScoreScope === "special-path-only"),
      provinces: new Set(lnpu.records.map((record) => record.province).filter(Boolean)).size,
      planCount: lnpu.records.reduce((sum, record) => sum + Number(record.planCount || 0), 0),
      tableTotal: lnpuSource.tableTotal,
      provincePlanCount: lnpuSource.provincePlanCount,
      otherPlanCountExcluded: lnpuSource.otherPlanCountExcluded,
      usage: lnpuSource.usage,
    },
  ];
  const payload = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    type: "runtime-admission-plan-supplement",
    source: {
      id: "official-national-school-plan-supplement-2026",
      title: "官方院校 2026 分省分专业计划补充（苏州大学、暨南大学、茅台学院、厦门大学、辽宁石油化工大学）",
      publisher: "苏州大学、暨南大学、茅台学院、厦门大学、辽宁石油化工大学招生办公室",
      url: lnpuSource.url,
      quality: "official-school-national-plan-html-api-2026-multi-source",
      usage: "运行时独立补充层，汇总五所高校官网 2026 年分省分专业计划；只用于当年专业池、计划数、科类、选科和路径约束，不替代省级考试院计划、投档线或录取概率。",
    },
    sources: sourceSummaries,
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
    cautions: [...new Set([...(base.cautions || []), ...(lnpuSource.cautions || [])])],
    inputs: [
      { path: BASE_INPUT, sha256: sha256(fs.readFileSync(basePath)), records: base.records.length },
      { path: LNPU_INPUT, sha256: sha256(fs.readFileSync(lnpuPath)), records: lnpu.records.length },
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
