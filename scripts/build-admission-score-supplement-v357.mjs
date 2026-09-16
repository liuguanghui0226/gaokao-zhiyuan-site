#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_INPUT = "data/admissions/official-xinjiang-2026-filing-v357-import.json";
const DEFAULT_OUTPUT = "site/data/release-v3.275/admission-score-supplement-v357.json.gz";
const VERSION = "v3.357";

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT, out: DEFAULT_OUTPUT };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--input") args.input = argv[++index];
    else if (value === "--out") args.out = argv[++index];
    else if (value === "--help" || value === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function countBy(records, predicate) {
  return records.filter(predicate).length;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:\n  node scripts/build-admission-score-supplement-v357.mjs --input ${DEFAULT_INPUT} --out ${DEFAULT_OUTPUT}`);
    return;
  }
  const inputPath = path.resolve(PROJECT_ROOT, args.input);
  const outputPath = path.resolve(PROJECT_ROOT, args.out);
  const inputBytes = fs.readFileSync(inputPath);
  const input = JSON.parse(inputBytes.toString("utf8"));
  const source = input.sourceNotes?.[0];
  const records = Array.isArray(input.records) ? input.records : [];
  if (input.dataset !== "official-xinjiang-2026-filing-v357-import" || !source || source.id !== "official-xinjiang-2026-filing-v357") throw new Error("Invalid Xinjiang v3.357 import");
  if (records.length !== 3174 || source.parsedRecords !== 3174 || source.filingScoreRecords !== 2951 || source.noFilingPlanRecords !== 223) throw new Error("Xinjiang v3.357 source totals changed");
  if (new Set(records.map((record) => record.id)).size !== records.length) throw new Error("Xinjiang v3.357 contains duplicate record ids");
  if (!records.every((record) => record.province === "新疆" && record.year === 2026 && record.sourceId === source.id && record.rankUnavailable === true && record.rankDerivedFromScore === false)) throw new Error("Xinjiang v3.357 record boundary changed");

  const payload = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    type: "runtime-admission-score-supplement",
    source: {
      id: "official-national-admission-score-supplement-2026",
      title: "官方省级院校投档分数补充（新疆 2026 普通类）",
      publisher: "新疆教育考试院",
      url: source.url,
      quality: source.quality,
      usage: "独立投档分数补充层，只用于同省同科类院校进档边界核验；不生成最低位次、专业录取结果或录取概率。",
    },
    sources: [source],
    summary: {
      records: records.length,
      filingScoreRecords: countBy(records, (record) => record.scoreOnly === true),
      noFilingPlanRecords: countBy(records, (record) => record.noFiling === true),
      provinces: [...new Set(records.map((record) => record.province))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
      batches: Object.fromEntries([...new Set(records.map((record) => record.batch))].map((batch) => [batch, records.filter((record) => record.batch === batch).length])),
      subjects: Object.fromEntries([...new Set(records.map((record) => record.subjectType))].map((subjectType) => [subjectType, records.filter((record) => record.subjectType === subjectType).length])),
      rankUnavailableRecords: countBy(records, (record) => record.rankUnavailable === true),
    },
    cautions: input.notes || [],
    inputs: [{ path: args.input, sha256: sha256(inputBytes), records: records.length }],
    records,
  };
  const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9, mtime: 0 });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, compressed);
  console.log(JSON.stringify({ status: "ok", version: VERSION, out: path.relative(PROJECT_ROOT, outputPath), records: records.length, filingScoreRecords: payload.summary.filingScoreRecords, noFilingPlanRecords: payload.summary.noFilingPlanRecords, bytes: compressed.length, sha256: sha256(compressed) }, null, 2));
}

main();
