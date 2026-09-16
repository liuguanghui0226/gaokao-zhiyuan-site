#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED,
  canonicalPayloadSha256,
  classifyPlanType,
  parseMajorListPayload,
  subjectTypeFrom,
} from "./import-official-national-school-plan-2026-v361-gzu.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importFile = path.join(root, "data/admissions/official-national-school-plan-2026-v361-gzu-import.json");
assert.ok(fs.existsSync(importFile), "v3.361 import output must exist");
const imported = JSON.parse(fs.readFileSync(importFile, "utf8"));

assert.equal(imported.dataset, "official-gzu-national-plan-2026-v3.361");
assert.equal(imported.version, "v3.361");
assert.equal(imported.records.length, EXPECTED.records);
assert.deepEqual(imported.summary, {
  records: EXPECTED.records,
  planCount: EXPECTED.planCount,
  rawRecords: EXPECTED.rawRecords,
  rawPlanCount: EXPECTED.rawPlanCount,
  duplicateRows: EXPECTED.duplicateRows,
  invalidRows: EXPECTED.invalidRows,
  provinces: EXPECTED.provinces,
  ordinaryRecords: EXPECTED.ordinaryRecords,
  specialPathRecords: EXPECTED.specialPathRecords,
  typeBreakdown: EXPECTED.typeBreakdown,
});
assert.equal(new Set(imported.records.map((record) => record.id)).size, imported.records.length);
assert.equal(new Set(imported.records.map((record) => record.province)).size, EXPECTED.provinces);
assert.ok(imported.records.every((record) => record.schoolCode === "10657" && record.year === 2026 && record.dataType === "admission-plan" && Number.isInteger(record.planCount) && record.planCount > 0));
assert.equal(imported.records.filter((record) => record.formalScoreScope === "school-official-only").length, EXPECTED.ordinaryRecords);
assert.equal(imported.records.filter((record) => record.formalScoreScope === "special-path-only").length, EXPECTED.specialPathRecords);
assert.equal(imported.records.filter((record) => record.province === "西藏").length, 2);
assert.ok(imported.records.filter((record) => record.province === "西藏").every((record) => record.formalScoreScope === "special-path-only" && record.admissionType === "西藏班"));
assert.ok(imported.records.some((record) => record.province === "新疆" && record.admissionType === "新疆班" && record.subjectType === "物理类"));
assert.ok(imported.records.some((record) => record.province === "青海" && record.formalScoreScope === "school-official-only"));
assert.ok(imported.records.some((record) => record.province === "宁夏" && record.formalScoreScope === "school-official-only"));
assert.ok(imported.records.some((record) => record.majorName === "资源勘查工作" && record.sourceMajorRaw === "资源勘查工作"));
assert.ok(imported.records.every((record) => record.sourceId === "official-gzu-national-plan-2026" && record.sourcePageUrl && record.officialEvidencePath));
assert.equal(imported.sourceNotes[0].schoolCode, "10657");
assert.equal(imported.sourceNotes[0].schoolIdentifierCode, "4152010657");
assert.equal(imported.sourceNotes[0].canonicalPayloadSha256, "fa912c7318ec57c59bf3013078729451e85d3701acdb8f1ba061fd8eaf780dbf");
assert.equal(imported.sourceNotes[0].finalPlanCaveat, true);

const fixture = `<section><div id="major-list">[&nbsp;&nbsp;{&quot;year&quot;: 2026, &quot;type&quot;: &quot;普通类&quot;, &quot;province&quot;: &quot;青海&quot;, &quot;major&quot;: &quot;资源勘查工作&quot;, &quot;subject&quot;: &quot;物理类&quot;, &quot;plan&quot;: 2&nbsp;&nbsp;}]</div></section>`;
const parsed = parseMajorListPayload(fixture);
assert.deepEqual(parsed, [{ year: 2026, type: "普通类", province: "青海", major: "资源勘查工作", subject: "物理类", plan: 2 }]);
assert.equal(canonicalPayloadSha256(parsed), "8331efaad732d7df882374769d2ae04a601b0d3b6e49e10c76608fc8f15d5f79");
assert.deepEqual(classifyPlanType("普通类"), { admissionType: "普通录取", formalScoreScope: "school-official-only" });
assert.deepEqual(classifyPlanType("国家专项"), { admissionType: "国家专项", formalScoreScope: "special-path-only" });
assert.deepEqual(classifyPlanType("中外合作办学"), { admissionType: "中外合作办学", formalScoreScope: "special-path-only" });
assert.equal(subjectTypeFrom("文史"), "历史类");
assert.equal(subjectTypeFrom("理工"), "物理类");
assert.equal(subjectTypeFrom("不分文理/不分科目"), "综合改革");

console.log(JSON.stringify({ status: "ok", version: imported.version, records: imported.records.length, provinces: imported.summary.provinces, planCount: imported.summary.planCount, ordinaryRecords: imported.summary.ordinaryRecords, specialPathRecords: imported.summary.specialPathRecords }, null, 2));
