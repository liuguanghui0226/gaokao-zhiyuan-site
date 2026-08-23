#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "web-globe-program-clouds-api": {
    url: "https://www.globe.gov/globe-data/globe-api",
    accessedAt: "2026-08-23",
  },
  "github-ruddro-globe-cloud-insights": {
    url: "https://github.com/ruddro-roy/globe-cloud-insights",
    commitSha: "b956e24ac5f41ece2e3e4b7d096c06d76df79cc5",
    accessedAt: "2026-08-23",
  },
  "github-ccosse-colormyworld": {
    url: "https://github.com/ccosse/colormyworld",
    commitSha: "6a17d2ccd12503e31344ab6050eef86f9985d3d6",
    accessedAt: "2026-08-23",
  },
  "github-ayushishukla-geography": {
    url: "https://github.com/ayushishukla-geo/Geography",
    commitSha: "3769f9c88270450ae6a930d40dc761590fb8b6cc",
    accessedAt: "2026-08-23",
  },
  "github-bhagyashree-geography-lesson-plans": {
    url: "https://github.com/bhagyashree21289/Geography-ICSE-Lesson-Plans",
    commitSha: "ff0c43a86f756574180acfc59f68a3e3ea9693a4",
    accessedAt: "2026-08-23",
  },
  "github-osgeo-geospatial-education": {
    url: "https://github.com/OSGeo/osgeo",
    commitSha: "ba9b9f1228451dc717b95289e82c9d36ba67a954",
    accessedAt: "2026-08-23",
  },
};

const expectedItems = {
  "geo-c1-cloud-observation-and-weather-evidence": "compulsory-1",
  "geo-c1-field-observation-sampling-and-bias": "compulsory-1",
  "geo-c1-landform-climate-gis-learning-path": "compulsory-1",
  "geo-c2-geography-scavenger-hunt-place-clues": "compulsory-2",
  "geo-c2-map-color-and-data-meaning": "compulsory-2",
  "geo-c2-lesson-plan-from-place-to-region": "compulsory-2",
  "geo-s1-cloud-cover-and-radiation-observation": "selective-1",
  "geo-s1-ground-observation-satellite-match": "selective-1",
  "geo-s1-landform-climate-gis-concept-integration": "selective-1",
  "geo-s2-citizen-science-spatial-sampling": "selective-2",
  "geo-s2-open-source-geospatial-education-stack": "selective-2",
  "geo-s2-map-color-classification-and-legend": "selective-2",
  "geo-s3-cloud-data-and-climate-risk-boundary": "selective-3",
  "geo-s3-citizen-observation-ethics-and-location-privacy": "selective-3",
  "geo-s3-open-geospatial-governance-and-resource-security": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.23.30");
assert.equal(payload.sources.length, 206);
assert.equal(payload.items.length, 470);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v24 source ${sourceId}`);
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
  assert.ok(item, `missing v24 item ${itemId}`);
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
