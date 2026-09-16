#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED,
  canonicalPayloadSha256,
  parseCategoryResponse,
  parseInfoResponse,
} from "./import-official-national-school-plan-2026-v363-utibet.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const importFile = path.join(root, "data/admissions/official-national-school-plan-2026-v363-utibet-import.json");
assert.ok(fs.existsSync(importFile), "UTibet v3.363 import output must exist");
const imported = JSON.parse(fs.readFileSync(importFile, "utf8"));
const source = imported.sourceNotes?.[0];
assert.equal(imported.dataset, "official-utibet-national-plan-2026-v3.363");
assert.equal(source.id, "official-utibet-national-plan-2026-api");
assert.equal(source.schoolCode, "10694");
assert.equal(source.schoolIdentifierCode, "4154010694");
assert.equal(source.parsedRecords, EXPECTED.records);
assert.equal(source.rawRecords, EXPECTED.rawRecords);
assert.equal(source.planCount, EXPECTED.planCount);
assert.equal(source.rawPlanCount, EXPECTED.rawPlanCount);
assert.equal(source.duplicateRows, 0);
assert.equal(source.invalidRows, 0);
assert.equal(source.provinceCount, EXPECTED.provinces);
assert.equal(source.categoryRootCount, 26);
assert.equal(source.yearNodeCount, 31);
assert.equal(source.subjectNodeCount, 59);
assert.equal(source.emptySubjectNodeCount, 4);
assert.equal(source.canonicalPayloadSha256, "8ce0fcfa7975b33c8372fbfb8c75bd8a3f29226ef95ede4c1269c59e8822c856");
assert.equal(source.rawCorpusSha256, "decf5294d4f63ad0dc6825389aea2366d1768c7d2c4ef0dde2c445935f539647");
assert.equal(source.headlinePlanCount, 2770);
assert.equal(source.apiPlanCount, 2706);
assert.equal(source.unattributedDelta, 64);
assert.match(source.cautions.join("；"), /最终招生专业及人数以各省发布数据为准/);
assert.match(source.cautions.join("；"), /score=0/);
assert.match(source.cautions.join("；"), /空选科/);

assert.deepEqual(parseCategoryResponse(JSON.stringify([{ id: 1, parent: 0, name: "西藏" }, { id: 2, parent: 1, name: "2026普通计划" }, { id: 3, parent: 2, name: "文史" }])), [
  { id: 1, parent: 0, name: "西藏" },
  { id: 2, parent: 1, name: "2026普通计划" },
  { id: 3, parent: 2, name: "文史" },
]);
assert.deepEqual(parseInfoResponse(JSON.stringify([{ id: 3773, spec: "中国少数民族语言文学（翻译）", subject: "", num: 11, score: 0, batch: "" }]))[0], {
  id: 3773,
  spec: "中国少数民族语言文学（翻译）",
  subject: "",
  num: 11,
  score: 0,
  batch: "",
});
assert.equal(canonicalPayloadSha256([{ province: { id: 1, name: "西藏" }, year: { id: 2, name: "2026" }, subject: { id: 3, name: "文史" }, items: [] }]), "bb0eb2d9ee3228f990ae1b68ee1364ed0765f5a6d7ec533b64b038c9c454fe81");

assert.equal(imported.records.length, EXPECTED.records);
assert.equal(new Set(imported.records.map((record) => record.id)).size, EXPECTED.records);
assert.ok(imported.records.every((record) => record.schoolCode === "10694" && record.schoolIdentifierCode === "4154010694" && record.year === 2026 && record.dataType === "admission-plan" && Number.isInteger(record.planCount) && record.planCount > 0));
assert.equal(imported.records.filter((record) => record.formalScoreScope === "school-official-only").length, EXPECTED.ordinaryRecords);
assert.equal(imported.records.filter((record) => record.formalScoreScope === "special-path-only").length, EXPECTED.specialPathRecords);
assert.equal(imported.records.filter((record) => record.province === "西藏").length, 115);
assert.equal(imported.records.filter((record) => record.province === "西藏" && record.formalScoreScope === "school-official-only").length, 77);
assert.equal(imported.records.filter((record) => record.province === "西藏" && record.formalScoreScope === "special-path-only").length, 38);
assert.equal(imported.records.filter((record) => record.province === "青海" && record.formalScoreScope === "school-official-only").length, 15);
assert.equal(imported.records.filter((record) => record.province === "上海" && record.formalScoreScope === "school-official-only").length, 10);
assert.equal(imported.records.filter((record) => record.id.endsWith("-3773")).length, 1);
const xzOrdinary = imported.records.find((record) => record.id.endsWith("-3773"));
assert.equal(xzOrdinary.sourceSubjectRaw, "");
assert.equal(xzOrdinary.subjectType, "历史类");
assert.equal(xzOrdinary.admissionType, "普通录取");
assert.equal(xzOrdinary.formalScoreScope, "school-official-only");
assert.equal(xzOrdinary.electiveRequirement, undefined);
assert.equal(xzOrdinary.score, undefined);
assert.ok(imported.records.some((record) => record.id.endsWith("-3748") && record.admissionType === "国家专项" && record.sourceSubjectRaw === "历史、地理" && record.planCount === 20));
assert.ok(imported.records.some((record) => record.id.endsWith("-3736") && record.admissionType === "部队专项" && record.planCount === 30));
assert.ok(imported.records.some((record) => record.id.endsWith("-3219") && record.province === "上海" && record.sourceSubjectRaw === "物理、化学"));
assert.ok(imported.records.some((record) => record.id.endsWith("-3323") && record.province === "青海" && record.sourceSubjectRaw === "物理、化学、生物"));
assert.ok(imported.records.every((record) => record.sourceId === source.id && record.sourcePageUrl && record.officialEvidencePath && record.officialCharterEvidencePath));
assert.ok(imported.records.every((record) => record.sourcePlanTypeRaw && record.sourceApiEndpoint && record.sourceCategoryId));

console.log(JSON.stringify({ status: "ok", version: "v3.363", records: imported.records.length, provinces: source.provinceCount, planCount: source.planCount, ordinaryRecords: EXPECTED.ordinaryRecords, specialPathRecords: EXPECTED.specialPathRecords }, null, 2));
