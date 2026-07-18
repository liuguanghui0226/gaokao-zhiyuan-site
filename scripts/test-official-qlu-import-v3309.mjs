#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importFile = path.join(projectRoot, "data/admissions/official-national-school-admission-2021-2025-v3309-qlu-import.json");
const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
const records = payload.records;
const source = payload.sourceNotes[0];
const mainlandProvinces = ["北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "上海", "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "广西", "海南", "重庆", "四川", "贵州", "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆"];

assert.equal(payload.dataset, "official-national-school-admission-2021-2025-v3309-qlu");
assert.equal(payload.audit.requestedProvinces, 31);
assert.equal(payload.audit.rawResponseFiles, 718);
assert.equal(payload.audit.scoreQueries, 297);
assert.equal(payload.audit.sourceRows, 2157);
assert.equal(payload.audit.skippedRows.length, 0);
assert.equal(records.length, 2157);
assert.equal(new Set(records.map((record) => record.id)).size, records.length);
assert.deepEqual(source.yearsWithRecords, [2025, 2024, 2023, 2022, 2021]);
assert.equal(source.provinceCount, 28);
assert.equal(source.provincesWithRecords.length, 28);
assert.deepEqual(mainlandProvinces.filter((province) => !source.provincesWithRecords.includes(province)), ["西藏", "青海", "宁夏"]);
assert.equal(source.rawFiles.length, 719);

const nativeRank = records.filter((record) => record.minRankEnd);
const unavailable = records.filter((record) => record.rankUnavailable);
assert.equal(nativeRank.length, 2074);
assert.equal(unavailable.length, 83);
assert.ok(nativeRank.every((record) => record.rankEvidenceScope === "school-recorded-min-score-rank"));
assert.ok(nativeRank.every((record) => record.rankDerivedFromScore === false && record.nativeAdmissionRankUnavailable === false));
assert.ok(nativeRank.every((record) => record.minRank === record.minRankStart && record.minRankStart === record.minRankEnd));
assert.ok(unavailable.every((record) => !record.minRankEnd && record.rankEvidenceScope === "rank-unavailable" && record.scoreOnly === true));
assert.equal(source.derivedRankRecords, 0);

const ordinary = records.filter((record) => record.formalScoreScope === "school-official-only");
const special = records.filter((record) => record.formalScoreScope === "special-path-only");
assert.equal(ordinary.length, 1849);
assert.equal(special.length, 308);
assert.ok(ordinary.every((record) => record.sourcePlanTypeRaw === "普通类"));
assert.ok(ordinary.every((record) => !/艺术|体育|中外合作|地方专项|民族班|校企合作|菏泽校区/.test([record.sourceSubjectRaw, record.sourcePlanTypeRaw, record.majorName].join(" "))));
assert.equal(payload.audit.ordinaryMinScore, 305);
assert.equal(payload.audit.ordinaryMaxScore, 603);
assert.equal(payload.audit.minScore, 68.28);

const computer = records.find((record) => record.id === "qlu-2025-9170e490195e37b6ae");
assert.ok(computer);
assert.equal(computer.province, "江西");
assert.equal(computer.subjectType, "物理类");
assert.equal(computer.majorName, "网络空间安全");
assert.equal(computer.minScore, 529);
assert.equal(computer.averageScore, 538.35);
assert.equal(computer.maxScore, 551);
assert.equal(computer.controlLine, 429);
assert.equal(computer.minRankEnd, 52796);
assert.equal(computer.electiveRequirement, "");
assert.ok(computer.cautions.some((text) => /未列选科要求/.test(text)));

const art = records.find((record) => record.id === "qlu-2025-ba75e83d650809e8b9");
assert.ok(art);
assert.equal(art.subjectType, "历史类");
assert.equal(art.sourcePlanTypeRaw, "艺考类");
assert.equal(art.formalScoreScope, "special-path-only");
assert.equal(art.rankUnavailable, true);

const xinjiang = records.filter((record) => record.province === "新疆");
assert.equal(xinjiang.length, 9);
assert.ok(xinjiang.every((record) => record.sourcePlanTypeRaw === "民族班"));
assert.ok(xinjiang.every((record) => record.formalScoreScope === "special-path-only" && record.rankUnavailable));

const rawManifestPath = path.join(projectRoot, "data/admissions/raw/official-national-school-admission-2021-2025-v3309-qlu/qlu-raw-manifest.json");
if (fs.existsSync(rawManifestPath)) {
  const rawManifest = JSON.parse(fs.readFileSync(rawManifestPath, "utf8"));
  assert.equal(rawManifest.responses.length, 718);
  assert.equal(rawManifest.totals.scoreQueries, 297);
  assert.equal(rawManifest.totals.sourceRows, 2157);
  for (const response of rawManifest.responses) {
    const bytes = fs.readFileSync(path.join(projectRoot, response.path));
    assert.equal(bytes.length, response.bytes, `${response.path} byte count drifted`);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), response.sha256, `${response.path} hash drifted`);
  }
} else {
  assert.ok(source.rawFiles.includes("data/admissions/raw/official-national-school-admission-2021-2025-v3309-qlu/qlu-score-index.html"));
  assert.ok(source.rawFiles.includes("data/admissions/raw/official-national-school-admission-2021-2025-v3309-qlu/qlu-raw-manifest.json"));
}

console.log(JSON.stringify({
  ok: true,
  records: records.length,
  ordinary: ordinary.length,
  special: special.length,
  nativeRankRecords: nativeRank.length,
  rankUnavailableRecords: unavailable.length,
  officialNonEmptyProvinces: source.provinceCount,
  officialEmptyProvinces: ["西藏", "青海", "宁夏"],
  sample: { minScore: computer.minScore, minRank: computer.minRankEnd },
}, null, 2));
