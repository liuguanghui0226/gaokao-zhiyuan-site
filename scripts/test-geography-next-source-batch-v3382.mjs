#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "web-qgis-training-manual": {
    url: "https://docs.qgis.org/latest/en/docs/training_manual/",
    accessedAt: "2026-08-23",
  },
  "web-arcgis-learn-geography": {
    url: "https://learn.arcgis.com/en/",
    accessedAt: "2026-08-23",
  },
  "web-nasa-worldview-earth-observation": {
    url: "https://worldview.earthdata.nasa.gov/",
    accessedAt: "2026-08-23",
  },
  "web-protected-planet-conservation-data": {
    url: "https://www.protectedplanet.net/en",
    accessedAt: "2026-08-23",
  },
  "github-qgis-training-data": {
    url: "https://github.com/qgis/QGIS-Training-Data",
    commitSha: "fd26dd88e39b9aec550eea450cec18d02b1de3b5",
    accessedAt: "2026-08-23",
  },
  "github-qgis-documentation": {
    url: "https://github.com/qgis/QGIS-Documentation",
    commitSha: "a33d48826a2673b58a66adc12b0aa1895cecaec6",
    accessedAt: "2026-08-23",
  },
  "github-spatialthoughts-open-courseware": {
    url: "https://github.com/spatialthoughts/courses",
    commitSha: "a627b988b54b9dd0fe879d3a4b0c8148564c42be",
    accessedAt: "2026-08-23",
  },
  "github-geography-teaching-tools": {
    url: "https://github.com/geo-dan/Geography_teaching_tools",
    commitSha: "c6721a440e4f1dcb2dc8c2c87115d5af1fd15285",
    accessedAt: "2026-08-23",
  },
  "github-geography-teaching-plugin": {
    url: "https://github.com/1Mengjin/GeographyTeachingPlugin",
    commitSha: "0ea592460b04452e7e761343113f1092968b1b2b",
    accessedAt: "2026-08-23",
  },
};

const expectedItems = {
  "geo-c1-qgis-training-data-and-relief-reading": "compulsory-1",
  "geo-c1-satellite-time-series-land-cover-observation": "compulsory-1",
  "geo-c1-atmospheric-circulation-interactive-model": "compulsory-1",
  "geo-c2-open-map-place-and-service-accessibility": "compulsory-2",
  "geo-c2-spatial-visualization-and-regional-comparison": "compulsory-2",
  "geo-c2-teacher-dataset-and-local-field-evidence": "compulsory-2",
  "geo-s1-raster-vector-and-natural-process-scale": "selective-1",
  "geo-s1-protected-area-ecosystem-and-natural-integrity": "selective-1",
  "geo-s1-satellite-weather-and-hazard-timeline": "selective-1",
  "geo-s2-qgis-coordinate-reference-and-overlay": "selective-2",
  "geo-s2-spatial-analysis-and-regional-planning": "selective-2",
  "geo-s2-open-courseware-data-workflow": "selective-2",
  "geo-s3-protected-area-governance-and-connectivity": "selective-3",
  "geo-s3-geography-teaching-tools-and-resource-security": "selective-3",
  "geo-s3-disaster-risk-map-and-inclusive-decision": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.23.26");
assert.equal(payload.sources.length, 184);
assert.equal(payload.items.length, 410);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v22 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  assert.equal(source.accessedAt, expected.accessedAt);
  if (expected.commitSha) {
    assert.equal(source.commitSha, expected.commitSha);
    assert.ok(source.editionNote.includes(expected.commitSha), `${sourceId} edition note must repeat its commit SHA`);
  }
  assert.match(source.licenseNote, /citation|原创|不复制|仅作/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v22 item ${itemId}`);
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
