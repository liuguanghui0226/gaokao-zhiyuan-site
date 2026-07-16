#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const outFile = path.join(projectRoot, "data/admissions/official-control-line-coverage-2026-v3301.json");
const expectedCovered = ["安徽", "北京", "重庆", "福建", "甘肃", "广东", "广西", "贵州", "海南", "河北", "河南", "黑龙江", "湖北", "湖南", "吉林", "江苏", "江西", "辽宁", "内蒙古", "宁夏", "山东", "陕西", "上海", "四川", "天津", "西藏", "新疆", "浙江"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function ordinaryLine(record) {
  if (record.year !== 2026 || record.dataType !== "control-line") return false;
  if (["special-path-only", "limited-school-control-line-only"].includes(record.formalScoreScope)) return false;
  if (!/历史|物理|综合|文科|理科/.test(String(record.subjectType || ""))) return false;
  if (record.formalScoreScope === "control-line-only") return true;
  const group = String(record.majorGroup || "");
  const batch = String(record.batch || "");
  if (!group.includes("普通类")) return false;
  if (/特殊类型|资格线|专项|军|警|定向|消防|预科|少数民族|3\+2|对口|限定院校/.test(batch)) return false;
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
assert(manifest.modelVersion === "local-deterministic-v3.301-ningxia-control-lines2026-dual-thresholds-and-rank-provenance-847133records", "Unexpected v3.301 model version");
assert(manifest.recordCount === 847133, "Unexpected v3.301 record count");
assert(core.admissionScoreLayer.coverage.dataTypes["control-line"] === 1487, "Unexpected v3.301 control-line count");

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
    ordinaryVocationalExpectedPublicationAt: pendingVocationalSource?.ordinaryVocationalExpectedPublicationAt || null,
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
assert(coveredProvinces.length === 28 && missingProvinces.length === 3, "Expected 28 covered and 3 missing provinces after Ningxia v3.301");
assert(JSON.stringify([...missingProvinces].sort()) === JSON.stringify(["青海", "山西", "云南"].sort()), `Unexpected missing provinces: ${missingProvinces.join("、")}`);
assert(JSON.stringify([...ordinaryVocationalPendingProvinces].sort()) === JSON.stringify(["上海", "天津", "江苏", "海南"].sort()), `Unexpected pending vocational provinces: ${ordinaryVocationalPendingProvinces.join("、")}`);

const ningxia = coverage.find((row) => row.province === "宁夏");
assert(ningxia?.ordinaryRecords === 4, "Expected four Ningxia ordinary boundaries");
for (const expected of [
  ["历史类", "ordinary-bachelor", 393],
  ["历史类", "ordinary-vocational", 150],
  ["物理类", "ordinary-bachelor", 360],
  ["物理类", "ordinary-vocational", 150],
]) {
  assert(ningxia.boundaries.some((row) => row.subjectType === expected[0] && row.routeKind === expected[1] && row.minScore === expected[2] && row.scoreBasis === "gaokao-total"), `Ningxia boundary drifted: ${expected.join("/")}`);
}
assert(!ningxia.boundaries.some((row) => [474, 437, 315, 295, 275, 269, 252, 197, 180].includes(row.minScore)), "Ningxia special, art or sports lines leaked into ordinary coverage");

const liaoning = coverage.find((row) => row.province === "辽宁");
assert(liaoning?.ordinaryRecords === 4, "Expected four Liaoning ordinary boundaries");
for (const expected of [
  ["历史类", "ordinary-bachelor", 442],
  ["历史类", "ordinary-vocational", 150],
  ["物理类", "ordinary-bachelor", 344],
  ["物理类", "ordinary-vocational", 150],
]) {
  assert(liaoning.boundaries.some((row) => row.subjectType === expected[0] && row.routeKind === expected[1] && row.minScore === expected[2]), `Liaoning boundary drifted: ${expected.join("/")}`);
}

for (const province of ["上海", "天津", "海南"]) {
  const row = coverage.find((item) => item.province === province);
  assert(row?.ordinaryRecords === 1, `Expected one ${province} ordinary boundary`);
  assert(!row.boundaries.some((item) => item.routeKind === "ordinary-vocational"), `${province} must not invent a 2026 vocational line`);
}

const report = {
  dataset: "official-control-line-coverage-2026-v3301",
  generatedAt: core.generatedAt,
  modelVersion: core.modelVersion,
  definition: "运行分片中2026年普通类本科/专科或普通类一段/二段省级通用控制线；限定院校、特殊类型、艺体、军警、专项、定向、预科、少数民族、中职升学、技能高考和对口路径不计入。尚未发布的当年专科线单列为pending，不使用往年线补造。",
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
console.log(JSON.stringify({
  status: "ok",
  modelVersion: report.modelVersion,
  coveredCount: report.coveredCount,
  missingCount: report.missingCount,
  coveredProvinces,
  missingProvinces,
  ordinaryVocationalPendingProvinces,
  out: path.relative(projectRoot, outFile),
}, null, 2));
