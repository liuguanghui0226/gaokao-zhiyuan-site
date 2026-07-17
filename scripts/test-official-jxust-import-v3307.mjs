#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importFile = path.join(projectRoot, "data/admissions/official-national-school-admission-2023-2025-v3307-jxust-import.json");
const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
const records = payload.records;
const source = payload.sourceNotes[0];

assert.equal(payload.dataset, "official-national-school-admission-2023-2025-v3307-jxust");
assert.equal(payload.audit.sourceRows, 2910);
assert.equal(records.length, 2905);
assert.equal(new Set(records.map((record) => record.id)).size, records.length);
assert.deepEqual(source.yearsWithRecords, [2025, 2024, 2023]);
assert.equal(source.provinceCount, 31);
assert.equal(source.provincesWithRecords.length, 31);
assert.equal(payload.audit.skippedRows.length, 5);
assert.ok(payload.audit.skippedRows.every((row) => row.province === "港澳台" && row.reason === "non-mainland-route"));

const nativeRank = records.filter((record) => record.minRankEnd);
const unavailable = records.filter((record) => record.rankUnavailable);
assert.equal(nativeRank.length, 2704);
assert.equal(unavailable.length, 201);
assert.ok(nativeRank.every((record) => record.rankEvidenceScope === "school-recorded-min-score-rank"));
assert.ok(nativeRank.every((record) => record.rankDerivedFromScore === false && record.nativeAdmissionRankUnavailable === false));
assert.ok(nativeRank.every((record) => record.minRank === record.minRankStart && record.minRankStart === record.minRankEnd));
assert.ok(unavailable.every((record) => !record.minRankEnd && record.rankEvidenceScope === "rank-unavailable" && record.scoreOnly === true));
assert.equal(source.derivedRankRecords, 0);

const ordinary = records.filter((record) => record.formalScoreScope === "school-official-only");
const special = records.filter((record) => record.formalScoreScope === "special-path-only");
assert.equal(ordinary.length, 2596);
assert.equal(special.length, 309);
assert.ok(ordinary.every((record) => !/艺术|体育|预科|专项|定向|征集|中外合作|合作办学|联合培养|南单|对口|飞行技术|高水平|高收费|民族班|内高班|港澳台|军校|警校/.test([record.batch, record.subjectType, record.admissionSubtype, record.majorName, record.majorGroup].join(" "))));
assert.equal(payload.audit.ordinaryMinScore, 300);
assert.equal(payload.audit.ordinaryMaxScore, 645);
assert.equal(payload.audit.minScore, 72.32400691);

const xizang = records.filter((record) => record.province === "西藏");
assert.equal(xizang.length, 9);
assert.ok(xizang.every((record) => record.rankUnavailable && record.formalScoreScope === "school-official-only"));
assert.ok(xizang.every((record) => record.cautions.some((text) => /未列A\/B类/.test(text))));

const computer = records.find((record) => record.id === "jxust-2025-5333");
assert.ok(computer);
assert.equal(computer.province, "江西");
assert.equal(computer.subjectType, "物理类");
assert.equal(computer.majorName, "计算机科学与技术");
assert.equal(computer.majorGroup, "第502组");
assert.equal(computer.minScore, 554);
assert.equal(computer.averageScore, 557.96);
assert.equal(computer.maxScore, 574);
assert.equal(computer.admittedCount, 73);
assert.equal(computer.minRankEnd, 32276);
assert.equal(computer.rankEvidenceScope, "school-recorded-min-score-rank");

const rawManifestPath = path.join(projectRoot, "data/admissions/raw/official-national-school-admission-2023-2025-v3307-jxust/jxust-raw-manifest.json");
if (fs.existsSync(rawManifestPath)) {
  const rawManifest = JSON.parse(fs.readFileSync(rawManifestPath, "utf8"));
  const pageBytes = fs.readFileSync(path.join(projectRoot, rawManifest.page.path));
  assert.equal(pageBytes.length, rawManifest.page.bytes);
  assert.equal(crypto.createHash("sha256").update(pageBytes).digest("hex"), rawManifest.page.sha256);
} else {
  assert.ok(source.rawFiles.includes("data/admissions/raw/official-national-school-admission-2023-2025-v3307-jxust/jxust-score-query.html"));
  assert.ok(source.rawFiles.includes("data/admissions/raw/official-national-school-admission-2023-2025-v3307-jxust/jxust-embedded-major-records.json"));
  assert.ok(source.rawFiles.includes("data/admissions/raw/official-national-school-admission-2023-2025-v3307-jxust/jxust-raw-manifest.json"));
}

console.log(JSON.stringify({
  ok: true,
  records: records.length,
  ordinary: ordinary.length,
  special: special.length,
  nativeRankRecords: nativeRank.length,
  rankUnavailableRecords: unavailable.length,
  provinces: source.provinceCount,
  xizangRecords: xizang.length,
  computerSample: { minScore: computer.minScore, minRank: computer.minRankEnd, admittedCount: computer.admittedCount },
}, null, 2));
