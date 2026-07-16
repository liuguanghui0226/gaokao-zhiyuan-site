#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const outFile = path.join(projectRoot, "data/admissions/official-control-line-coverage-2026-v3293.json");
const expectedCovered = ["安徽", "北京", "重庆", "福建", "广东", "河北", "河南", "湖北", "湖南", "江西", "吉林", "内蒙古", "陕西", "山东", "上海", "四川", "天津", "新疆", "西藏", "浙江"];

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
assert(coveredProvinces.length === 20 && missingProvinces.length === 11, "Expected 20 covered and 11 missing provinces after Chongqing v3.293");
assert(JSON.stringify([...ordinaryVocationalPendingProvinces].sort()) === JSON.stringify(["上海", "天津"].sort()), `Unexpected pending vocational provinces: ${ordinaryVocationalPendingProvinces.join("、")}`);

const chongqing = coverage.find((row) => row.province === "重庆");
assert(chongqing?.ordinaryRecords === 4, "Expected four Chongqing ordinary boundaries");
for (const expected of [
  ["历史类", "ordinary-bachelor", 415],
  ["历史类", "ordinary-vocational", 180],
  ["物理类", "ordinary-bachelor", 406],
  ["物理类", "ordinary-vocational", 180],
]) {
  assert(chongqing.boundaries.some((row) => row.subjectType === expected[0] && row.routeKind === expected[1] && row.minScore === expected[2] && row.scoreBasis === "gaokao-total"), `Chongqing boundary drifted: ${expected.join("/")}`);
}
assert(!chongqing.boundaries.some((row) => [510, 496, 353, 305].includes(row.minScore)), "Chongqing special, art or sports lines leaked into ordinary coverage");

const shanghai = coverage.find((row) => row.province === "上海");
assert(shanghai?.ordinaryRecords === 1, "Expected one Shanghai ordinary boundary");
assert(!shanghai.boundaries.some((row) => row.routeKind === "ordinary-vocational"), "Shanghai must not invent a 2026 vocational line");
const tianjin = coverage.find((row) => row.province === "天津");
assert(tianjin?.ordinaryRecords === 1, "Expected one Tianjin ordinary boundary");
assert(!tianjin.boundaries.some((row) => row.routeKind === "ordinary-vocational"), "Tianjin must not invent a 2026 vocational line");

const report = {
  dataset: "official-control-line-coverage-2026-v3293",
  generatedAt: core.generatedAt,
  modelVersion: core.modelVersion,
  definition: "运行分片中2026年普通类本科/专科或普通类一段/二段省级通用控制线；限定院校、特殊类型、艺体、军警、专项、定向、预科、少数民族、技能高考和对口路径不计入。尚未发布的当年专科线单列为pending，不使用往年线补造。",
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
