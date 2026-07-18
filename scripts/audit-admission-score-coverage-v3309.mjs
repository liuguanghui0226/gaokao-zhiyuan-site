#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const RELEASE_DIR = path.join(PROJECT_ROOT, "site/data/release-v3.275");
const MANIFEST_FILE = path.join(RELEASE_DIR, "manifest.json.gz");
const DEFAULT_OUT = path.join(PROJECT_ROOT, "data/admissions/admission-score-coverage-v3309.json");
const SCORE_TYPES = new Set([
  "major-admission",
  "major-group-admission",
  "institution-admission",
  "vocational-admission",
]);

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--out") args.out = path.resolve(PROJECT_ROOT, argv[++i]);
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) || "(blank)";
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b, "zh-CN")));
}

function evidenceLayer(record) {
  if (record.formalScoreScope === "school-official-only") return "school-official-ordinary";
  if (record.formalScoreScope === "special-path-only") return "special-path-isolated";
  if (record.formalScoreScope === "vacancy-plan-only" || record.planOnly || record.dataType === "admission-plan") return "plan-only";
  const quality = String(record.sourceQuality || "");
  if (/^third-party/.test(quality)) return "third-party";
  if (/^official/.test(quality)) return "province-or-other-official";
  return "unclassified";
}

function hasUsableRank(record) {
  return Number(record.minRankEnd) > 0 || Number(record.minRank) > 0;
}

function isDerivedRank(record) {
  return record.rankDerivedFromScore === true || record.rankEvidenceScope === "score-derived-provincial-segment";
}

function summarizeProvince(province, records) {
  const scoreRecords = records.filter((record) => SCORE_TYPES.has(record.dataType));
  const recent = scoreRecords.filter((record) => Number(record.year) >= 2023);
  const rankRows = scoreRecords.filter(hasUsableRank);
  const derivedRankRows = rankRows.filter(isDerivedRank);
  const nativeRankRows = rankRows.filter((record) => !isDerivedRank(record));
  const sourceIds = new Set(scoreRecords.map((record) => record.sourceId).filter(Boolean));
  const recentSourceIds = new Set(recent.map((record) => record.sourceId).filter(Boolean));
  return {
    province,
    records: scoreRecords.length,
    recentRecords2023Plus: recent.length,
    byDataType: countBy(scoreRecords, (record) => record.dataType),
    byEvidenceLayer: countBy(scoreRecords, evidenceLayer),
    recordsWithAnyRank: rankRows.length,
    recordsWithNativeRank: nativeRankRows.length,
    recordsWithScoreDerivedRank: derivedRankRows.length,
    rankUnavailableRecords: scoreRecords.length - rankRows.length,
    rankCoverageRate: scoreRecords.length ? Number((rankRows.length / scoreRecords.length).toFixed(4)) : 0,
    nativeRankCoverageRate: scoreRecords.length ? Number((nativeRankRows.length / scoreRecords.length).toFixed(4)) : 0,
    sourceCount: sourceIds.size,
    recentSourceCount2023Plus: recentSourceIds.size,
    years: [...new Set(scoreRecords.map((record) => Number(record.year)).filter(Number.isFinite))].sort((a, b) => b - a),
  };
}

function sumMaps(rows, field) {
  const result = {};
  for (const row of rows) {
    for (const [key, value] of Object.entries(row[field] || {})) result[key] = (result[key] || 0) + value;
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b, "zh-CN")));
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/mac_2T/")) throw new Error("Refusing to audit from /Volumes/mac_2T; use internal APFS staging.");
  const args = parseArgs(process.argv);
  const manifest = readGzipJson(MANIFEST_FILE);
  const provinceFiles = Array.isArray(manifest.provinces)
    ? manifest.provinces
    : Object.entries(manifest.shards || {}).map(([province, item]) => ({ province, ...item }));
  const provinceRows = [];
  for (const item of provinceFiles) {
    const fileName = item.file || `${item.slug}.json`;
    const gzipName = fileName.endsWith(".gz") ? fileName : `${fileName}.gz`;
    const shard = readGzipJson(path.join(RELEASE_DIR, path.basename(gzipName)));
    provinceRows.push(summarizeProvince(shard.province || item.province, shard.records || []));
  }
  provinceRows.sort((a, b) => a.records - b.records || a.province.localeCompare(b.province, "zh-CN"));
  const payload = {
    dataset: "admission-score-coverage-v3309",
    generatedAt: new Date().toISOString(),
    runtimeRelease: "site/data/release-v3.275",
    definitions: {
      scoreDataTypes: [...SCORE_TYPES],
      recent: "year >= 2023",
      provinceOrOtherOfficial: "sourceQuality begins with official, excluding records explicitly isolated as school-official-only, special-path-only, vacancy-plan-only or plan-only",
      schoolOfficialOrdinary: "formalScoreScope=school-official-only; single-school evidence, never province-wide closure",
      specialPathIsolated: "formalScoreScope=special-path-only; not mixed with ordinary admission",
      nativeRank: "minRank/minRankEnd is present and rank is not marked score-derived",
      scoreDerivedRank: "rankDerivedFromScore=true or rankEvidenceScope=score-derived-provincial-segment; useful for score-rank alignment but not a school-recorded lowest admitted rank",
      warning: "province-or-other-official is an audit bucket, not an automatic claim that every row is a province examination authority full table",
    },
    totals: {
      provinces: provinceRows.length,
      records: provinceRows.reduce((sum, row) => sum + row.records, 0),
      recentRecords2023Plus: provinceRows.reduce((sum, row) => sum + row.recentRecords2023Plus, 0),
      recordsWithAnyRank: provinceRows.reduce((sum, row) => sum + row.recordsWithAnyRank, 0),
      recordsWithNativeRank: provinceRows.reduce((sum, row) => sum + row.recordsWithNativeRank, 0),
      recordsWithScoreDerivedRank: provinceRows.reduce((sum, row) => sum + row.recordsWithScoreDerivedRank, 0),
      byDataType: sumMaps(provinceRows, "byDataType"),
      byEvidenceLayer: sumMaps(provinceRows, "byEvidenceLayer"),
    },
    lowestCoverageProvinces: provinceRows.slice(0, 10).map((row) => row.province),
    provinces: provinceRows,
  };
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ out: path.relative(PROJECT_ROOT, args.out), totals: payload.totals, lowestCoverageProvinces: payload.lowestCoverageProvinces }, null, 2));
}

main();
