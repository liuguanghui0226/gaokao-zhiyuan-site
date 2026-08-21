#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const filePath = path.join(projectRoot, "data", "geography", "knowledge.json");
const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));

const REQUIRED_COURSES = new Set([
  "compulsory-1",
  "compulsory-2",
  "selective-1",
  "selective-2",
  "selective-3",
]);
const REQUIRED_ANCHORS = new Set([
  "geo-c1-atmospheric-heating",
  "geo-c2-agricultural-location",
  "geo-s1-climate-system",
  "geo-s2-regional-coordination",
  "geo-s3-food-security",
]);
const REQUIRED_EXPANSION_SOURCES = new Set([
  "exam-shanxi-affiliated-2025-12-geography",
  "exam-nanning-no3-2026-03-geography",
  "exam-zhejiang-quzhou-2026-04-geography",
  "marine-geology-reference-2024",
  "marine-resources-reference-2017",
  "marine-environment-reference-2023",
  "marine-disaster-reference-2017",
]);
const REQUIRED_EXPANSION_ITEMS = new Set([
  "geo-c1-rock-cycle-evidence",
  "geo-c1-river-regime-diagnosis",
  "geo-c1-coastal-disaster-exposure",
  "geo-c2-city-radiation-and-economic-hinterland",
  "geo-c2-industrial-chain-spatial-division",
  "geo-c2-circular-agriculture",
  "geo-s1-rock-stratigraphy-sequencing",
  "geo-s1-pressure-field-weather",
  "geo-s1-ocean-current-productivity",
  "geo-s1-earth-sun-shadow",
  "geo-s2-regional-scale-and-function",
  "geo-s2-basin-ecological-coordination",
  "geo-s2-industrial-upgrading-path",
  "geo-s3-marine-resources-evaluation",
  "geo-s3-marine-pollution-governance",
  "geo-s3-coastal-wetland-services",
  "geo-s3-marine-disaster-defense",
  "geo-s3-marine-space-conflict",
]);
const REQUIRED_NEXT_EXPANSION_SOURCES = new Set([
  "local-geography-worktree-2026-06",
  "exam-zhejiang-four-schools-2026-03-geography",
  "exam-harbin-no3-2026-04-geography",
  "exam-shenyang-huimin-2026-04-geography",
  "marine-ecology-reference-2017",
  "marine-chemistry-reference-2017",
  "marine-survey-reference-2017",
  "marine-island-reference-2017",
  "marine-weather-reference-2017",
]);
const REQUIRED_NEXT_EXPANSION_ITEMS = new Set([
  "geo-c1-water-resource-balance",
  "geo-c1-ecosystem-biodiversity",
  "geo-c1-coastal-process-tidal-landform",
  "geo-c2-population-change-age-structure",
  "geo-c2-urban-spatial-structure",
  "geo-c2-urban-hierarchy-services",
  "geo-c2-agricultural-type-modernization",
  "geo-c2-industrial-region-formation",
  "geo-c2-transport-corridor-accessibility",
  "geo-s1-solar-radiation-seasonality",
  "geo-s1-earth-structure-seismic-evidence",
  "geo-s1-soil-profile-formation",
  "geo-s1-vegetation-altitudinal-zonation",
  "geo-s1-climate-comfort-and-classification",
  "geo-s1-seawater-salinity-and-ice",
  "geo-s2-gis-remote-sensing-evidence",
  "geo-s2-desertification-mechanism",
  "geo-s2-forest-ecosystem-restoration",
  "geo-s2-energy-development-environment",
  "geo-s2-watershed-ecological-compensation",
  "geo-s2-regional-agriculture-tourism",
  "geo-s3-marine-ecosystem-red-tide",
  "geo-s3-marine-water-quality-indicators",
  "geo-s3-marine-observation-remote-sensing",
  "geo-s3-island-use-ecological-protection",
  "geo-s3-marine-weather-coastal-warning",
  "geo-s3-ocean-acidification-carbon-cycle",
]);
const ALLOWED_LICENSE_STATES = new Set(["authored-summary", "citation-only"]);

assert.equal(typeof payload.version, "string");
assert.ok(payload.version.length > 0);
assert.ok(Array.isArray(payload.courses));
assert.ok(Array.isArray(payload.sources));
assert.ok(Array.isArray(payload.items));
assert.equal(payload.courses.length, REQUIRED_COURSES.size);
assert.deepEqual(new Set(payload.courses.map((course) => course.id)), REQUIRED_COURSES);

const sourceIds = new Set();
for (const source of payload.sources) {
  assert.equal(typeof source.id, "string");
  assert.ok(source.id.length > 0);
  assert.equal(sourceIds.has(source.id), false, `duplicate geography source ${source.id}`);
  sourceIds.add(source.id);
  assert.equal(typeof source.title, "string");
  assert.ok(source.title.length > 0);
  assert.equal(typeof source.publisher, "string");
  assert.ok(source.publisher.length > 0);
  assert.equal(typeof source.licenseNote, "string");
  assert.ok(source.licenseNote.length > 0);
}

const courseIds = new Set(payload.courses.map((course) => course.id));
for (const sourceId of REQUIRED_EXPANSION_SOURCES) {
  assert.equal(sourceIds.has(sourceId), true, `missing expanded geography source ${sourceId}`);
}
for (const sourceId of REQUIRED_NEXT_EXPANSION_SOURCES) {
  assert.equal(sourceIds.has(sourceId), true, `missing next geography source ${sourceId}`);
}
const itemIds = new Set();
for (const item of payload.items) {
  assert.equal(typeof item.id, "string");
  assert.equal(itemIds.has(item.id), false, `duplicate geography item ${item.id}`);
  itemIds.add(item.id);
  assert.equal(courseIds.has(item.courseId), true, `unknown course ${item.courseId}`);
  assert.equal(typeof item.title, "string");
  assert.ok(item.title.length > 0);
  assert.equal(typeof item.summary, "string");
  assert.ok(item.summary.length >= 40);
  assert.ok(item.summary.length <= 500, `${item.id} summary is too long to be an authored summary`);
  assert.ok(Array.isArray(item.keywords) && item.keywords.length >= 2);
  assert.ok(Array.isArray(item.sourceIds) && item.sourceIds.length > 0);
  assert.ok(Array.isArray(item.evidence) && item.evidence.length > 0);
  assert.ok(ALLOWED_LICENSE_STATES.has(item.licenseStatus));
  for (const sourceId of item.sourceIds) {
    assert.equal(sourceIds.has(sourceId), true, `${item.id} references unknown source ${sourceId}`);
  }
  for (const evidence of item.evidence) {
    assert.equal(sourceIds.has(evidence.sourceId), true, `${item.id} evidence references unknown source`);
    assert.match(String(evidence.locator), /第?\s*\d+\s*页/);
    assert.equal(typeof evidence.note, "string");
    assert.ok(evidence.note.length > 0);
  }
}

assert.ok(payload.items.length >= 65, "the comprehensive geography slice must cover the planned next expansion");
for (const courseId of REQUIRED_COURSES) {
  assert.ok(
    payload.items.filter((item) => item.courseId === courseId).length >= 8,
    `${courseId} must retain at least eight geography items`,
  );
}
for (const anchor of REQUIRED_ANCHORS) {
  assert.equal(itemIds.has(anchor), true, `missing curriculum anchor ${anchor}`);
}
for (const itemId of REQUIRED_EXPANSION_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing expanded geography item ${itemId}`);
}
for (const itemId of REQUIRED_NEXT_EXPANSION_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing next expanded geography item ${itemId}`);
}
assert.ok(
  payload.items.filter((item) => item.licenseStatus === "citation-only").length >= 25,
  "expanded question-method and reference-derived items must retain citation-only provenance",
);

console.log(JSON.stringify({
  status: "ok",
  courses: payload.courses.length,
  sources: payload.sources.length,
  items: payload.items.length,
}, null, 2));
