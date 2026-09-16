#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const assetFile = path.join(root, "site/data/release-v3.275/admission-plan-supplement-v366.json.gz");
assert.ok(fs.existsSync(assetFile), "v3.366 ECNU runtime asset must exist");
const supplement = JSON.parse(zlib.gunzipSync(fs.readFileSync(assetFile), { to: "string" }));

assert.equal(supplement.version, "v3.366");
assert.equal(supplement.type, "runtime-admission-plan-supplement");
assert.equal(supplement.source.id, "official-ecnu-national-plan-2026-html");
assert.equal(supplement.source.url, "https://xxgk.ecnu.edu.cn/b2/82/c29049a766594/page.htm");
assert.equal(supplement.source.charterUrl, "https://xxgk.ecnu.edu.cn/a3/52/c11816a762706/page.htm");
assert.deepEqual(supplement.sources.map((source) => source.id), ["official-ecnu-national-plan-2026-html"]);
assert.equal(supplement.sources[0].planPageSha256, "fa465bdee163c1b25d8f6cb3277e39eed263c54045ed2c57e509b80c3f6c6f06");
assert.equal(supplement.sources[0].charterPageSha256, "3728b33e05d282440bb05c272c35a7cfff02537663ba05c282e8ddc75b569cb3");
assert.equal(supplement.sources[0].rawCorpusSha256, "7768cfe9e6e958e753ed31b63e1cac56f1ca35ffba8925db367aca82429dc81b");
assert.equal(supplement.sources[0].canonicalPayloadSha256, "9946a7a9ed1a896b40847d617e9b814bdcb8796976a13641b0835f0c3f99c8af");

assert.equal(supplement.summary.records, 1244);
assert.equal(supplement.summary.planCount, 3661);
assert.equal(supplement.summary.rawRecords, 1244);
assert.equal(supplement.summary.rawPlanCount, 3661);
assert.equal(supplement.summary.duplicateRows, 0);
assert.equal(supplement.summary.invalidRows, 0);
assert.equal(supplement.summary.provinces, 31);
assert.equal(supplement.summary.schools, 1);
assert.equal(supplement.summary.ordinaryRecords, 519);
assert.equal(supplement.summary.ordinaryPlanCount, 1791);
assert.equal(supplement.summary.specialPathRecords, 725);
assert.equal(supplement.summary.specialPlanCount, 1870);
assert.deepEqual(supplement.summary.typeBreakdown["普通类(本科批)"], { records: 519, planCount: 1791 });
assert.deepEqual(supplement.summary.typeBreakdown["普通类(提前批)"], { records: 208, planCount: 754 });
assert.deepEqual(supplement.summary.typeBreakdown["国家优师专项"], { records: 77, planCount: 150 });
assert.deepEqual(supplement.summary.typeBreakdown["艺考类"], { records: 57, planCount: 194 });
assert.deepEqual(supplement.summary.typeBreakdown["综合评价"], { records: 33, planCount: 141 });

assert.equal(supplement.records.length, 1244);
assert.equal(new Set(supplement.records.map((record) => record.id)).size, 1244);
assert.ok(supplement.records.every((record) => record.schoolName === "华东师范大学" && record.schoolCode === "10269" && record.schoolIdentifierCode === "4131010269" && record.year === 2026 && record.dataType === "admission-plan" && Number.isInteger(record.planCount) && record.planCount > 0));
assert.equal(supplement.records.filter((record) => record.formalScoreScope === "school-official-only").length, 519);
assert.equal(supplement.records.filter((record) => record.formalScoreScope === "special-path-only").length, 725);
assert.equal(supplement.records.filter((record) => record.province === "上海").length, 95);
assert.equal(supplement.records.filter((record) => record.province === "上海").reduce((sum, record) => sum + record.planCount, 0), 627);
assert.equal(supplement.records.filter((record) => record.province === "西藏" && record.formalScoreScope === "school-official-only").length, 0);
assert.ok(supplement.records.some((record) => record.province === "北京" && record.majorName === "汉语言文学" && record.sourcePlanCategoryRaw === "普通类(本科批)" && record.formalScoreScope === "school-official-only"));
assert.ok(supplement.records.some((record) => record.sourcePlanCategoryRaw === "普通类(提前批)" && record.admissionType === "提前批" && record.formalScoreScope === "special-path-only"));
assert.ok(supplement.records.some((record) => record.sourcePlanCategoryRaw === "艺考类" && record.admissionType === "艺术类" && record.formalScoreScope === "special-path-only"));
assert.ok(supplement.records.filter((record) => record.sourceProfessionalGroupRaw === "").every((record) => record.electiveRequirement === undefined));
assert.ok(supplement.records.every((record) => record.sourceId === supplement.source.id && record.sourcePageUrl && record.officialEvidencePath && record.officialCharterEvidencePath));
assert.match(supplement.cautions.join("；"), /普通类\(提前批\).*special-path-only/);
assert.match(supplement.cautions.join("；"), /省级招生考试机构/);

console.log(JSON.stringify({ status: "ok", version: supplement.version, records: supplement.records.length, provinces: supplement.summary.provinces, planCount: supplement.summary.planCount, ordinaryRecords: supplement.summary.ordinaryRecords, specialPathRecords: supplement.summary.specialPathRecords }, null, 2));
