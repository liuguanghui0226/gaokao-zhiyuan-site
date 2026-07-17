#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importFile = path.join(projectRoot, "data/admissions/official-national-school-admission-2021-2025-v3306-nchu-import.json");
const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
const records = payload.records;

assert.equal(payload.dataset, "official-national-school-admission-2021-2025-v3306-nchu");
assert.equal(records.length, 4860);
assert.equal(new Set(records.map((record) => record.id)).size, records.length);
assert.deepEqual(payload.sourceNotes[0].yearsWithRecords, [2025, 2024, 2023, 2022, 2021]);
assert.equal(payload.sourceNotes[0].provinceCount, 29);
assert.deepEqual(
  ["西藏", "宁夏"],
  ["北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "上海", "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "广西", "海南", "重庆", "四川", "贵州", "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆"]
    .filter((province) => !payload.sourceNotes[0].provincesWithRecords.includes(province)),
);

const derived = records.filter((record) => record.rankDerivedFromScore);
const unavailable = records.filter((record) => record.rankUnavailable);
assert.equal(derived.length, 4804);
assert.equal(unavailable.length, 56);
assert.ok(derived.every((record) => record.rankEvidenceScope === "score-derived-provincial-segment"));
assert.ok(derived.every((record) => record.nativeAdmissionRankUnavailable === true));
assert.ok(derived.every((record) => record.minRankEnd === record.scoreDerivedRank && /不是学校录取最低位次/.test(record.rankDisclaimer)));
assert.ok(unavailable.every((record) => !record.minRankEnd && record.rankEvidenceScope === "unavailable"));
assert.equal(payload.sourceNotes[0].nativeAdmissionRankRecords, 0);

const ordinary = records.filter((record) => record.formalScoreScope === "school-official-only");
const special = records.filter((record) => record.formalScoreScope === "special-path-only");
assert.equal(ordinary.length, 3955);
assert.equal(special.length, 905);
assert.ok(ordinary.every((record) => !/专项|艺术|体育|飞行技术|飞行学员|中外合作|国际合作|预科|定向|单列|民族班|高水平|运动训练|专升本|职教|对口|港澳台/.test([record.batch, record.subjectType, record.examType, record.majorName, record.majorGroup].join(" "))));
assert.ok(special.every((record) => /special-path-only/.test(record.formalScoreScope)));

const computer = records.find((record) => record.province === "江西" && record.year === 2025 && record.majorName === "计算机科学与技术");
assert.ok(computer);
assert.equal(computer.minScore, 562);
assert.equal(computer.minRankEnd, 26975);
assert.equal(computer.rankEvidenceScope, "score-derived-provincial-segment");
assert.equal(computer.majorGroup, "506组");
assert.equal(computer.admittedCount, 46);

console.log(JSON.stringify({
  ok: true,
  records: records.length,
  ordinary: ordinary.length,
  special: special.length,
  derivedRankRecords: derived.length,
  rankUnavailableRecords: unavailable.length,
  provinces: payload.sourceNotes[0].provinceCount,
  computerSample: { minScore: computer.minScore, scoreDerivedRank: computer.minRankEnd, majorGroup: computer.majorGroup },
}, null, 2));
