#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "web-cgs-geological-survey": {
    url: "https://www.cgs.gov.cn/",
    accessedAt: "2026-08-23",
  },
  "web-mot-transport-geography-data": {
    url: "https://www.mot.gov.cn/",
    accessedAt: "2026-08-23",
  },
  "web-nea-energy-security-information": {
    url: "https://www.nea.gov.cn/",
    accessedAt: "2026-08-23",
  },
  "web-nmdis-marine-information": {
    url: "https://www.nmdis.org.cn/",
    accessedAt: "2026-08-23",
  },
  "web-geodata-earth-system-data": {
    url: "https://www.geodata.cn/",
    accessedAt: "2026-08-23",
  },
  "github-lmec-map-education-collections": {
    url: "https://github.com/boston-library/lmec_collections",
    commitSha: "1d2f104a2a5a8b186bfd06a45dde7fd1af25279f",
    accessedAt: "2026-08-23",
  },
  "github-qgis-lesson-geography": {
    url: "https://github.com/sagesteppe/QGIS_Lesson",
    commitSha: "baccacf5893cf02d545258c0d3ceacab35430a62",
    accessedAt: "2026-08-23",
  },
  "github-tactile-map-generator": {
    url: "https://github.com/jesse-flores/Tactile-Map-Generator",
    commitSha: "623966ce1963b41472ea667fbae62dc24b97f90a",
    accessedAt: "2026-08-23",
  },
};

const expectedItems = {
  "geo-c1-river-basin-water-resource-observation": "compulsory-1",
  "geo-c1-geological-survey-map-and-landform-evidence": "compulsory-1",
  "geo-c1-tactile-map-scale-and-spatial-orientation": "compulsory-1",
  "geo-c2-transport-corridor-and-accessibility": "compulsory-2",
  "geo-c2-energy-industry-location-and-transition": "compulsory-2",
  "geo-c2-historical-map-and-regional-change": "compulsory-2",
  "geo-s1-river-basin-process-and-runoff-seasonality": "selective-1",
  "geo-s1-geological-map-and-plate-process-evidence": "selective-1",
  "geo-s1-marine-observation-and-coastal-change": "selective-1",
  "geo-s2-national-geospatial-data-and-regional-planning": "selective-2",
  "geo-s2-qgis-layer-overlay-and-field-verification": "selective-2",
  "geo-s2-map-education-collection-and-scale-comparison": "selective-2",
  "geo-s3-energy-security-and-low-carbon-transition": "selective-3",
  "geo-s3-marine-data-and-coastal-resource-governance": "selective-3",
  "geo-s3-accessible-mapping-and-spatial-inclusion": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.23.25");
assert.equal(payload.sources.length, 178);
assert.equal(payload.items.length, 395);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v21 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  assert.equal(source.accessedAt, expected.accessedAt);
  if (expected.commitSha) assert.equal(source.commitSha, expected.commitSha);
  assert.match(source.licenseNote, /citation|原创|不复制|仅作/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v21 item ${itemId}`);
  assert.equal(item.courseId, courseId);
  assert.equal(item.licenseStatus, "citation-only");
  assert.equal(item.reviewStatus, "reviewed");
  assert.ok(item.summary.length >= 60 && item.summary.length <= 500);
  assert.ok(item.keywords.length >= 4);
  assert.ok(item.evidence.length >= 2);
  assert.ok(item.evidence.some((evidence) => Object.hasOwn(expectedSources, evidence.sourceId)));
  assert.ok(item.evidence.some((evidence) => evidence.sourceId.startsWith("pep-geography-")));
}

const courseCounts = Object.groupBy(Object.values(expectedItems), (courseId) => courseId);
assert.deepEqual(
  Object.fromEntries(Object.entries(courseCounts).map(([courseId, entries]) => [courseId, entries.length])),
  {
    "compulsory-1": 3,
    "compulsory-2": 3,
    "selective-1": 3,
    "selective-2": 3,
    "selective-3": 3,
  },
);

console.log(JSON.stringify({
  ok: true,
  version: payload.version,
  addedSources: Object.keys(expectedSources).length,
  addedItems: Object.keys(expectedItems).length,
  courseCounts: Object.fromEntries(Object.entries(courseCounts).map(([courseId, entries]) => [courseId, entries.length])),
}, null, 2));
