#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importFile = path.join(projectRoot, "data/admissions/official-national-school-admission-2021-2025-v3308-wtu-import.json");
const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
const records = payload.records;
const source = payload.sourceNotes[0];

assert.equal(payload.dataset, "official-national-school-admission-2021-2025-v3308-wtu");
assert.equal(payload.audit.requestedPages, 155);
assert.equal(payload.audit.fetchedPages, 155);
assert.equal(payload.audit.sourceMajorRows, 2222);
assert.equal(payload.audit.sourceSummaryRows, 481);
assert.equal(payload.audit.skippedRows.length, 0);
assert.equal(payload.audit.summaryMismatches.length, 0);
assert.equal(records.length, 2222);
assert.equal(new Set(records.map((record) => record.id)).size, records.length);
assert.deepEqual(source.yearsWithRecords, [2025, 2024, 2023, 2022, 2021]);
assert.equal(source.provinceCount, 31);
assert.equal(source.provincesWithRecords.length, 31);
assert.equal(source.rawFiles.length, 156);

const nativeRank = records.filter((record) => record.minRankEnd);
const unavailable = records.filter((record) => record.rankUnavailable);
assert.equal(nativeRank.length, 1921);
assert.equal(unavailable.length, 301);
assert.ok(nativeRank.every((record) => record.rankEvidenceScope === "school-recorded-min-score-rank"));
assert.ok(nativeRank.every((record) => record.rankDerivedFromScore === false && record.nativeAdmissionRankUnavailable === false));
assert.ok(nativeRank.every((record) => record.minRank === record.minRankStart && record.minRankStart === record.minRankEnd));
assert.ok(unavailable.every((record) => !record.minRankEnd && record.rankEvidenceScope === "rank-unavailable" && record.scoreOnly === true));
assert.equal(source.derivedRankRecords, 0);

const ordinary = records.filter((record) => record.formalScoreScope === "school-official-only");
const special = records.filter((record) => record.formalScoreScope === "special-path-only");
assert.equal(ordinary.length, 1633);
assert.equal(special.length, 589);
assert.ok(ordinary.every((record) => !/艺术|艺文|艺理|体育|专项|中外合作|合作办学|预科|定向|民族班|内高班|新疆班|西藏班|南疆|单列|高水平|征集|对口|单招|飞行技术|军校|警校/.test([
  record.sourceSubjectRaw,
  record.sourcePlanTypeRaw,
  record.batch,
  record.majorName,
  record.sourceRemark,
].join(" "))));
assert.equal(payload.audit.ordinaryMinScore, 323);
assert.equal(payload.audit.ordinaryMaxScore, 609);
assert.equal(payload.audit.minScore, 69.7);

const computer = records.find((record) => record.id === "wtu-2025-1730b6dda0ef0ea3a4");
assert.ok(computer);
assert.equal(computer.province, "江西");
assert.equal(computer.subjectType, "物理类");
assert.equal(computer.majorName, "计算机类");
assert.equal(computer.electiveRequirement, "化学必选");
assert.equal(computer.minScore, 554);
assert.equal(computer.averageScore, 560.1);
assert.equal(computer.maxScore, 572);
assert.equal(computer.minScoreDifference, 125);
assert.equal(computer.admittedCount, 7);
assert.equal(computer.minRankEnd, 32276);

const art = records.find((record) => record.id === "wtu-2021-383b9477f8ee697fbd");
assert.ok(art);
assert.equal(art.sourceSubjectRaw, "艺文");
assert.equal(art.subjectType, "艺术类");
assert.equal(art.formalScoreScope, "special-path-only");
assert.equal(art.rankUnavailable, true);

const xizang = records.filter((record) => record.province === "西藏");
assert.equal(xizang.length, 17);
assert.ok(xizang.every((record) => record.rankUnavailable));
assert.ok(xizang.every((record) => record.cautions.some((text) => /未列A\/B类/.test(text))));

const rawManifestPath = path.join(projectRoot, "data/admissions/raw/official-national-school-admission-2021-2025-v3308-wtu/wtu-raw-manifest.json");
if (fs.existsSync(rawManifestPath)) {
  const rawManifest = JSON.parse(fs.readFileSync(rawManifestPath, "utf8"));
  assert.equal(rawManifest.pages.length, 155);
  assert.equal(rawManifest.totals.majorRows, 2222);
  assert.equal(rawManifest.totals.summaryRows, 481);
  for (const page of rawManifest.pages) {
    const bytes = fs.readFileSync(path.join(projectRoot, page.path));
    assert.equal(bytes.length, page.bytes, `${page.path} byte count drifted`);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), page.sha256, `${page.path} hash drifted`);
  }
} else {
  assert.ok(source.rawFiles.includes("data/admissions/raw/official-national-school-admission-2021-2025-v3308-wtu/wtu-2025-beijing.html"));
  assert.ok(source.rawFiles.includes("data/admissions/raw/official-national-school-admission-2021-2025-v3308-wtu/wtu-raw-manifest.json"));
}

console.log(JSON.stringify({
  ok: true,
  records: records.length,
  ordinary: ordinary.length,
  special: special.length,
  nativeRankRecords: nativeRank.length,
  rankUnavailableRecords: unavailable.length,
  pages: payload.audit.fetchedPages,
  summaryMismatches: payload.audit.summaryMismatches.length,
  sample: { minScore: computer.minScore, minRank: computer.minRankEnd, admittedCount: computer.admittedCount },
}, null, 2));
