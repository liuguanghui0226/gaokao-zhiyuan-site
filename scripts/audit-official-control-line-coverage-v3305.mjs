#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const outFile = path.join(projectRoot, "data/admissions/official-control-line-coverage-2026-v3305.json");
const modelVersion = "local-deterministic-v3.327-tianjin-official-rank2025-policy-bonus-inclusive-full-table-aligned-868426records";
const expectedCovered = ["安徽", "北京", "重庆", "福建", "甘肃", "广东", "广西", "贵州", "海南", "河北", "河南", "黑龙江", "湖北", "湖南", "吉林", "江苏", "江西", "辽宁", "内蒙古", "宁夏", "青海", "山东", "山西", "陕西", "上海", "四川", "天津", "西藏", "新疆", "云南", "浙江"];
const expectedPending = ["上海", "天津", "江苏", "海南", "山西"];

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
  if (/特殊类型|资格线|专项|军|警|定向|消防|预科|少数民族|民族语言|藏文|蒙文|3\+2|对口|限定院校/.test(batch)) return false;
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
assert(manifest.modelVersion === modelVersion && core.modelVersion === modelVersion, "Unexpected current model version");
assert(manifest.recordCount === 868426, "Unexpected current record count");
assert(core.admissionScoreLayer.coverage.dataTypes["control-line"] === 1592, "Unexpected v3.305 control-line count");

const coverage = [];
for (const [province, entry] of Object.entries(manifest.shards)) {
  const shard = readGzipJson(path.join(releaseDir, `${entry.file}.gz`));
  const records = shard.records.filter(ordinaryLine);
  const pendingSource = core.admissionScoreLayer.sourceNotes.find((note) => note.province === province && note.ordinaryVocationalStatus === "pending-official-release");
  const review = pendingSource?.ordinaryVocationalReview || null;
  coverage.push({
    province,
    covered: records.length > 0,
    ordinaryRecords: records.length,
    ordinaryVocationalStatus: pendingSource ? "pending-official-release" : "not-declared",
    ordinaryVocationalReview: review ? {
      checkedAt: review.checkedAt,
      expectedPublicationAt: review.expectedPublicationAt,
      exactPublicationDateStatus: review.exactPublicationDateStatus,
      statusLabel: review.statusLabel,
      noHistoricalSubstitution: review.noHistoricalSubstitution,
      primarySource: review.primarySource,
      officialMilestones: review.officialMilestones,
    } : null,
    sourceIds: [...new Set(records.map((record) => record.sourceId))].sort(),
    boundaries: records.map((record) => ({
      subjectType: record.subjectType,
      batch: record.batch,
      minScore: record.minScore,
      routeKind: routeKind(record),
      scoreBasis: record.scoreBasis || "gaokao-total",
      candidateCategory: record.candidateCategory || record.candidateClass || "",
    })).sort((left, right) => String(left.subjectType).localeCompare(String(right.subjectType), "zh-CN") || Number(right.minScore) - Number(left.minScore)),
  });
}

coverage.sort((left, right) => left.province.localeCompare(right.province, "zh-CN"));
const coveredProvinces = coverage.filter((row) => row.covered).map((row) => row.province);
const missingProvinces = coverage.filter((row) => !row.covered).map((row) => row.province);
const pendingRows = coverage.filter((row) => row.ordinaryVocationalStatus === "pending-official-release");
assert(manifest.provinceCount === 31 && coverage.length === 31, "Expected all 31 province shards");
assert(JSON.stringify([...coveredProvinces].sort()) === JSON.stringify([...expectedCovered].sort()), `Unexpected covered provinces: ${coveredProvinces.join("、")}`);
assert(missingProvinces.length === 0, "Expected no missing province-level ordinary control coverage");
assert(JSON.stringify(pendingRows.map((row) => row.province).sort()) === JSON.stringify([...expectedPending].sort()), "Pending province inventory drifted");
assert(pendingRows.every((row) => row.ordinaryVocationalReview?.checkedAt === "2026-07-17"), "Pending review date is missing");
assert(pendingRows.every((row) => row.ordinaryVocationalReview?.noHistoricalSubstitution === true), "Historical substitution guard is missing");
assert(pendingRows.filter((row) => row.ordinaryVocationalReview?.expectedPublicationAt).length === 1, "Only Shanghai may have an announced publication date");
assert(coverage.find((row) => row.province === "上海")?.ordinaryVocationalReview?.expectedPublicationAt === "2026-07-29", "Shanghai publication date drifted");
assert(pendingRows.filter((row) => row.province !== "上海").every((row) => row.ordinaryVocationalReview?.expectedPublicationAt === null), "Unannounced dates must remain null");
assert(pendingRows.every((row) => !row.boundaries.some((boundary) => boundary.routeKind === "ordinary-vocational")), "Pending province contains an invented vocational line");

const yunnan = coverage.find((row) => row.province === "云南");
for (const expected of [["历史类", "ordinary-bachelor", 465], ["历史类", "ordinary-vocational", 180], ["物理类", "ordinary-bachelor", 435], ["物理类", "ordinary-vocational", 180]]) {
  assert(yunnan?.boundaries.some((row) => row.subjectType === expected[0] && row.routeKind === expected[1] && row.minScore === expected[2]), `Yunnan boundary drifted: ${expected.join("/")}`);
}

const report = {
  dataset: "official-control-line-coverage-2026-v3305",
  generatedAt: core.generatedAt,
  modelVersion: core.modelVersion,
  definition: "运行分片中2026年普通类本科/专科或普通类一段/二段省级通用控制线；限定院校和特殊路径不计入。尚未发布的当年专科线单列为pending，并区分控制线发布日期、填报窗口、录取窗口与划线规则，不使用往年线补造。",
  provinceCount: coverage.length,
  coveredCount: coveredProvinces.length,
  missingCount: missingProvinces.length,
  coveredProvinces,
  missingProvinces,
  ordinaryVocationalPendingProvinces: pendingRows.map((row) => row.province),
  pendingReviewCount: pendingRows.length,
  exactPublicationDateProvinces: pendingRows.filter((row) => row.ordinaryVocationalReview.expectedPublicationAt).map((row) => row.province),
  publicationDateUnannouncedProvinces: pendingRows.filter((row) => !row.ordinaryVocationalReview.expectedPublicationAt).map((row) => row.province),
  coverage,
};
fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "ok", modelVersion, coveredCount: report.coveredCount, pendingReviewCount: report.pendingReviewCount, exactPublicationDateProvinces: report.exactPublicationDateProvinces, publicationDateUnannouncedProvinces: report.publicationDateUnannouncedProvinces, out: path.relative(projectRoot, outFile) }, null, 2));
