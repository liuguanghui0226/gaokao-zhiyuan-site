#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const assetFile = path.join(root, "site/data/release-v3.275/admission-plan-supplement-v365.json.gz");
assert.ok(fs.existsSync(assetFile), "v3.365 CUST runtime asset must exist");
const supplement = JSON.parse(zlib.gunzipSync(fs.readFileSync(assetFile), { to: "string" }));

assert.equal(supplement.version, "v3.365");
assert.equal(supplement.type, "runtime-admission-plan-supplement");
assert.equal(supplement.source.id, "official-cust-national-plan-2026-html");
assert.equal(supplement.source.url, "https://zsb.cust.edu.cn/gszsjhcx/sc_1/2026/index.htm");
assert.equal(supplement.source.charterUrl, "https://zsb.cust.edu.cn/zxgg/aa163ef4df814a21a43e0d19aa5811d1.htm");
assert.deepEqual(supplement.sources.map((source) => source.id), ["official-cust-national-plan-2026-html"]);
assert.equal(supplement.sources[0].rawCorpusSha256, "b6759cdc4a4feee1970a3f25b7ebf131b0a15a17139e61cd23d78f15a1a6e0ac");
assert.equal(supplement.sources[0].canonicalPayloadSha256, "d7062daa30920c4d17101e0cb598dc05cdd5276f4193f516839862c81a35a0fe");
assert.equal(supplement.sources[0].rawPaths.length, 33);

assert.equal(supplement.summary.records, 1283);
assert.equal(supplement.summary.planCount, 5132);
assert.equal(supplement.summary.rawRecords, 1283);
assert.equal(supplement.summary.rawPlanCount, 5132);
assert.equal(supplement.summary.duplicateRows, 0);
assert.equal(supplement.summary.invalidRows, 0);
assert.equal(supplement.summary.provinces, 31);
assert.equal(supplement.summary.schools, 1);
assert.equal(supplement.summary.ordinaryRecords, 1035);
assert.equal(supplement.summary.ordinaryPlanCount, 4075);
assert.equal(supplement.summary.specialPathRecords, 248);
assert.equal(supplement.summary.specialPlanCount, 1057);
assert.equal(supplement.summary.fourColumnPageCount, 29);
assert.equal(supplement.summary.threeColumnPageCount, 2);
assert.deepEqual(supplement.summary.typeBreakdown["普通类"], { records: 1035, planCount: 4075 });
assert.deepEqual(supplement.summary.typeBreakdown["中外合作办学"], { records: 101, planCount: 600 });
assert.deepEqual(supplement.summary.typeBreakdown["国家专项"], { records: 96, planCount: 221 });
assert.deepEqual(supplement.summary.typeBreakdown["艺术类（设计学类）"], { records: 16, planCount: 110 });
assert.deepEqual(supplement.summary.typeBreakdown["高职分类/对口升学"], { records: 5, planCount: 35 });
assert.deepEqual(supplement.summary.typeBreakdown["新疆班"], { records: 11, planCount: 22 });

assert.equal(supplement.records.length, 1283);
assert.equal(new Set(supplement.records.map((record) => record.id)).size, 1283);
assert.ok(supplement.records.every((record) => record.schoolCode === "10186" && record.schoolIdentifierCode === "4122010186" && record.year === 2026 && record.dataType === "admission-plan" && Number.isInteger(record.planCount) && record.planCount > 0));
assert.equal(supplement.records.filter((record) => record.formalScoreScope === "school-official-only").length, 1035);
assert.equal(supplement.records.filter((record) => record.formalScoreScope === "special-path-only").length, 248);
assert.equal(supplement.records.filter((record) => record.province === "河南").length, 60);
assert.equal(supplement.records.filter((record) => record.province === "河南").reduce((sum, record) => sum + record.planCount, 0), 195);
assert.ok(supplement.records.filter((record) => record.province === "西藏").every((record) => record.sourcePlanSchemaColumns === 3 && record.sourceElectiveRaw === "" && record.electiveRequirement === undefined));
assert.ok(supplement.records.filter((record) => record.province === "新疆").every((record) => record.sourcePlanSchemaColumns === 3 && record.sourceElectiveRaw === "" && record.electiveRequirement === undefined));
assert.ok(supplement.records.some((record) => record.sourceElectiveRaw === "不提科目要求不提科目要求" && record.electiveRequirement === "不提科目要求"));
assert.ok(supplement.records.some((record) => record.sourceMajorRaw === "电子信息工程(对口)" && record.majorName === "电子信息工程" && record.admissionType === "高职分类/对口升学" && record.planCount === 12));
assert.ok(supplement.records.some((record) => record.sourceMajorRaw === "设计学类" && record.admissionType === "艺术类" && record.formalScoreScope === "special-path-only"));
assert.ok(supplement.records.every((record) => record.sourceId === supplement.source.id && record.sourcePageUrl && record.sourceIndexUrl && record.officialEvidencePath && record.officialCharterEvidencePath));
assert.match(supplement.cautions.join("；"), /西藏和新疆.*三列/);
assert.match(supplement.cautions.join("；"), /招生办公室公布/);

console.log(JSON.stringify({ status: "ok", version: supplement.version, records: supplement.records.length, provinces: supplement.summary.provinces, planCount: supplement.summary.planCount, ordinaryRecords: supplement.summary.ordinaryRecords, specialPathRecords: supplement.summary.specialPathRecords }, null, 2));
