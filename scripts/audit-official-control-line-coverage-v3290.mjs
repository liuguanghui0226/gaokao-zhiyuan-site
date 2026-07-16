#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const outFile = path.join(projectRoot, "data/admissions/official-control-line-coverage-2026-v3290.json");
const expectedCovered = ["安徽", "北京", "福建", "广东", "河北", "河南", "湖南", "江西", "吉林", "内蒙古", "陕西", "山东", "四川", "天津", "新疆", "西藏", "浙江"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function ordinaryLine(record) {
  if (record.year !== 2026 || record.dataType !== "control-line" || record.formalScoreScope === "special-path-only") return false;
  if (!/历史|物理|综合|文科|理科/.test(String(record.subjectType || ""))) return false;
  if (record.formalScoreScope === "control-line-only") return true;
  const group = String(record.majorGroup || "");
  const batch = String(record.batch || "");
  if (!group.includes("普通类")) return false;
  if (/特殊类型|资格线|专项|军|警|定向|消防|预科|少数民族|3\+2|对口/.test(batch)) return false;
  return /本科|专科|高职|一段线|二段线/.test(batch);
}

function routeKind(record) {
  if (record.controlLineRouteKind) return record.controlLineRouteKind;
  const batch = String(record.batch || "");
  if (/一段线/.test(batch)) return "ordinary-segment-upper";
  if (/二段线/.test(batch)) return "ordinary-segment-lower";
  if (/专科|高职/.test(batch)) return "ordinary-vocational";
  return "ordinary-bachelor";
}

const manifest = readGzipJson(path.join(releaseDir, "manifest.json.gz"));
const core = readGzipJson(path.join(releaseDir, "knowledge-core.json.gz"));
const coverage = [];
for (const [province, entry] of Object.entries(manifest.shards)) {
  const shard = readGzipJson(path.join(releaseDir, `${entry.file}.gz`));
  const records = shard.records.filter(ordinaryLine);
  const pendingVocationalSource = core.admissionScoreLayer.sourceNotes.find((note) =>
    note.province === province && note.ordinaryVocationalStatus === "pending-official-release"
  );
  coverage.push({
    province,
    covered: records.length > 0,
    ordinaryRecords: records.length,
    ordinaryVocationalStatus: pendingVocationalSource ? "pending-official-release" : "not-declared",
    sourceIds: [...new Set(records.map((record) => record.sourceId))].sort(),
    boundaries: records.map((record) => ({
      subjectType: record.subjectType,
      batch: record.batch,
      minScore: record.minScore,
      routeKind: routeKind(record),
      scoreBasis: record.scoreBasis || "gaokao-total",
      candidateCategory: record.candidateCategory || record.candidateClass || "",
    })).sort((left, right) =>
      String(left.subjectType).localeCompare(String(right.subjectType), "zh-CN") ||
      String(left.candidateCategory).localeCompare(String(right.candidateCategory), "zh-CN") ||
      Number(right.minScore) - Number(left.minScore)
    ),
  });
}

coverage.sort((left, right) => left.province.localeCompare(right.province, "zh-CN"));
const coveredProvinces = coverage.filter((row) => row.covered).map((row) => row.province);
const missingProvinces = coverage.filter((row) => !row.covered).map((row) => row.province);
const ordinaryVocationalPendingProvinces = coverage.filter((row) => row.ordinaryVocationalStatus === "pending-official-release").map((row) => row.province);
assert(manifest.provinceCount === 31 && coverage.length === 31, "Expected all 31 province shards");
assert(JSON.stringify([...coveredProvinces].sort()) === JSON.stringify([...expectedCovered].sort()), `Unexpected covered provinces: ${coveredProvinces.join("、")}`);
assert(coveredProvinces.length === 17 && missingProvinces.length === 14, "Expected 17 covered and 14 missing provinces after Hebei v3.290");
assert(JSON.stringify(ordinaryVocationalPendingProvinces) === JSON.stringify(["天津"]), `Unexpected pending vocational provinces: ${ordinaryVocationalPendingProvinces.join("、")}`);

const fujian = coverage.find((row) => row.province === "福建");
assert(fujian?.ordinaryRecords === 4, "Expected four Fujian ordinary boundaries");
for (const expected of [
  ["物理类", "ordinary-bachelor", 446],
  ["物理类", "ordinary-vocational", 235],
  ["历史类", "ordinary-bachelor", 458],
  ["历史类", "ordinary-vocational", 235],
]) {
  assert(fujian.boundaries.some((row) => row.subjectType === expected[0] && row.routeKind === expected[1] && row.minScore === expected[2] && row.scoreBasis === "gaokao-total"), `Fujian boundary drifted: ${expected.join("/")}`);
}
assert(!fujian.boundaries.some((row) => [528, 533, 335, 312, 344, 321, 290, 298].includes(row.minScore)), "Fujian special, art or sports lines leaked into ordinary coverage");

const hebei = coverage.find((row) => row.province === "河北");
assert(hebei?.ordinaryRecords === 4, "Expected four Hebei ordinary boundaries");
for (const expected of [
  ["物理类", "ordinary-bachelor", 443],
  ["物理类", "ordinary-vocational", 200],
  ["历史类", "ordinary-bachelor", 485],
  ["历史类", "ordinary-vocational", 200],
]) {
  assert(hebei.boundaries.some((row) => row.subjectType === expected[0] && row.routeKind === expected[1] && row.minScore === expected[2] && row.scoreBasis === "gaokao-total"), `Hebei boundary drifted: ${expected.join("/")}`);
}
assert(!hebei.boundaries.some((row) => [512, 510, 332, 318, 300, 221, 180, 140].includes(row.minScore)), "Hebei special, art, sports or counterpart lines leaked into ordinary coverage");

const tianjin = coverage.find((row) => row.province === "天津");
assert(tianjin?.ordinaryRecords === 1, "Expected one Tianjin ordinary boundary");
assert(tianjin.boundaries.some((row) => row.routeKind === "ordinary-bachelor" && row.minScore === 458 && row.scoreBasis === "gaokao-total"), "Tianjin bachelor boundary drifted");
assert(!tianjin.boundaries.some((row) => row.routeKind === "ordinary-vocational"), "Tianjin must not invent a 2026 vocational line");

const report = {
  dataset: "official-control-line-coverage-2026-v3290",
  generatedAt: core.generatedAt,
  modelVersion: core.modelVersion,
  definition: "运行分片中2026年普通类本科/专科或普通类一段/二段省级控制线；特殊类型、艺体、军警、专项、定向、预科、少数民族和对口路径不计入。尚未发布的当年专科线单列为pending，不使用往年线补造。",
  provinceCount: coverage.length,
  coveredCount: coveredProvinces.length,
  missingCount: missingProvinces.length,
  coveredProvinces,
  missingProvinces,
  ordinaryVocationalPendingProvinces,
  coverage,
};
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "ok", modelVersion: report.modelVersion, coveredCount: report.coveredCount, missingCount: report.missingCount, coveredProvinces, missingProvinces, ordinaryVocationalPendingProvinces, out: path.relative(projectRoot, outFile) }, null, 2));
