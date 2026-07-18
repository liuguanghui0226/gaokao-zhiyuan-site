#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importFile = path.join(projectRoot, "data/admissions/official-national-school-admission-2014-2025-v3310-hdu-import.json");
const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
const records = payload.records;
const source = payload.sourceNotes[0];
const mainlandProvinces = ["北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "上海", "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "广西", "海南", "重庆", "四川", "贵州", "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆"];

assert.equal(payload.dataset, "official-national-school-admission-2014-2025-v3310-hdu");
assert.equal(payload.audit.requestedProvinces, 31);
assert.equal(payload.audit.officialProvinceSelectors, 32);
assert.equal(payload.audit.rawResponseFiles, 373);
assert.equal(payload.audit.scoreQueries, 372);
assert.equal(payload.audit.sourceRows, 7463);
assert.equal(payload.audit.skippedRows.length, 0);
assert.equal(records.length, 7463);
assert.equal(new Set(records.map((record) => record.id)).size, records.length);
assert.deepEqual(source.yearsWithRecords, [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014]);
assert.equal(source.provinceCount, 31);
assert.deepEqual(source.provincesWithRecords, mainlandProvinces);
assert.equal(source.rawFiles.length, 374);

const ordinary = records.filter((record) => record.formalScoreScope === "school-official-only");
const special = records.filter((record) => record.formalScoreScope === "special-path-only");
const unavailable = records.filter((record) => record.rankUnavailable);
assert.equal(ordinary.length, 6059);
assert.equal(special.length, 1404);
assert.equal(unavailable.length, 7463);
assert.equal(source.admittedCountRecords, 7463);
assert.equal(source.nativeAdmissionRankRecords, 0);
assert.equal(source.derivedRankRecords, 0);
assert.ok(records.every((record) => record.admittedCount > 0));
assert.ok(records.every((record) => record.rankUnavailable === true && record.scoreOnly === true));
assert.ok(records.every((record) => record.rankEvidenceScope === "rank-unavailable" && record.rankDerivedFromScore === false));
assert.ok(records.every((record) => !record.minRank && !record.minRankStart && !record.minRankEnd));
assert.ok(ordinary.every((record) => !/艺术|体育|美术|音乐|舞蹈|书法|中外合作|合作办学|专项|综合评价|三位一体|高水平|提前|单设|预科|定向|民族班|内高班|内地高中班|南疆|单列|征集|对口|单招/.test([record.sourceSubjectRaw, record.sourceBatchRaw, record.majorName].join(" "))));

const jiangxiComputer = records.find((record) => record.id === "hdu-2025-09dd552ef21fc9fc31");
assert.ok(jiangxiComputer);
assert.equal(jiangxiComputer.province, "江西");
assert.equal(jiangxiComputer.subjectType, "物理类");
assert.equal(jiangxiComputer.sourceBatchRaw, "本科");
assert.equal(jiangxiComputer.majorName, "计算机科学与技术");
assert.equal(jiangxiComputer.admittedCount, 3);
assert.equal(jiangxiComputer.minScore, 605);
assert.equal(jiangxiComputer.averageScore, 605.67);
assert.equal(jiangxiComputer.maxScore, 606);
assert.equal(jiangxiComputer.formalScoreScope, "school-official-only");
assert.equal(jiangxiComputer.electiveRequirement, "");
assert.ok(jiangxiComputer.cautions.some((text) => /最低录取位次/.test(text)));
assert.ok(jiangxiComputer.cautions.some((text) => /选科要求/.test(text)));

const zhejiangComputer = records.find((record) => record.id === "hdu-2025-19b94ab7c5acac6256");
assert.ok(zhejiangComputer);
assert.equal(zhejiangComputer.sourceBatchRaw, "普通类平行");
assert.equal(zhejiangComputer.admittedCount, 241);
assert.equal(zhejiangComputer.minScore, 634);
assert.equal(zhejiangComputer.formalScoreScope, "school-official-only");

const zhejiangEarly = records.find((record) => record.id === "hdu-2025-99f7483d108727b198");
assert.ok(zhejiangEarly);
assert.equal(zhejiangEarly.sourceBatchRaw, "普通类提前");
assert.equal(zhejiangEarly.formalScoreScope, "special-path-only");
assert.equal(zhejiangEarly.admittedCount, 25);

const rawManifestPath = path.join(projectRoot, "data/admissions/raw/official-national-school-admission-2014-2025-v3310-hdu/hdu-raw-manifest.json");
if (fs.existsSync(rawManifestPath)) {
  const rawManifest = JSON.parse(fs.readFileSync(rawManifestPath, "utf8"));
  assert.equal(rawManifest.responses.length, 373);
  assert.equal(rawManifest.totals.scoreQueries, 372);
  assert.equal(rawManifest.totals.sourceRows, 7463);
  assert.deepEqual(rawManifest.officialSelectors.excludedFromMainlandRuntime, ["港澳台"]);
  for (const response of rawManifest.responses) {
    const bytes = fs.readFileSync(path.join(projectRoot, response.path));
    assert.equal(bytes.length, response.bytes, `${response.path} byte count drifted`);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), response.sha256, `${response.path} hash drifted`);
  }
} else {
  assert.ok(source.rawFiles.includes("data/admissions/raw/official-national-school-admission-2014-2025-v3310-hdu/hdu-admission-index.html"));
  assert.ok(source.rawFiles.includes("data/admissions/raw/official-national-school-admission-2014-2025-v3310-hdu/hdu-raw-manifest.json"));
}

console.log(JSON.stringify({
  ok: true,
  records: records.length,
  admittedCountRecords: source.admittedCountRecords,
  ordinary: ordinary.length,
  special: special.length,
  rankUnavailableRecords: unavailable.length,
  provinces: source.provinceCount,
  years: source.yearsWithRecords,
  sample: { province: jiangxiComputer.province, major: jiangxiComputer.majorName, minScore: jiangxiComputer.minScore, admittedCount: jiangxiComputer.admittedCount },
}, null, 2));
