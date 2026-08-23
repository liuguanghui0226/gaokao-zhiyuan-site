#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "github-junyilee7-geography-ai-teaching": {
    url: "https://github.com/junyilee7/geography-ai-teaching",
    commitSha: "48076c91943bf52d614a69ceae90a565595bb522",
    accessedAt: "2026-08-24",
  },
  "github-wal33d-school-districts-api": {
    url: "https://github.com/Wal33D/us-school-districts-api",
    commitSha: "76e32482c58645aa86ac066b60b7996926a763c6",
    accessedAt: "2026-08-24",
  },
  "github-geomoer-remote-sensing": {
    url: "https://github.com/GeoMOER/moer-mpg-remote-sensing",
    commitSha: "08db1cccd531a487749cda4b87855f5783a8412d",
    accessedAt: "2026-08-24",
  },
  "github-leosolar-deforestation-detection": {
    url: "https://github.com/LEOSOLAR8/Satellite-Deforestation-Detection",
    commitSha: "26689bf2983e8c250d6cebccfffd0daff6f220b4",
    accessedAt: "2026-08-24",
  },
  "web-wri-aqueduct-water-risk": {
    url: "https://www.wri.org/aqueduct",
    accessedAt: "2026-08-24",
  },
  "web-nasa-firms-active-fire": {
    url: "https://firms.modaps.eosdis.nasa.gov/",
    accessedAt: "2026-08-24",
  },
  "web-noaa-sea-level-rise-viewer": {
    url: "https://coast.noaa.gov/slr/",
    accessedAt: "2026-08-24",
  },
  "web-un-sdg13-climate-action": {
    url: "https://sdgs.un.org/goals/goal13",
    accessedAt: "2026-08-24",
  },
};

const expectedItems = {
  "geo-c1-water-risk-map-and-scale": "compulsory-1",
  "geo-c1-wildfire-weather-fuel-and-relief": "compulsory-1",
  "geo-c1-remote-sensing-soil-and-surface-evidence": "compulsory-1",
  "geo-c2-school-district-boundary-and-service-area": "compulsory-2",
  "geo-c2-public-service-boundary-and-statistical-bias": "compulsory-2",
  "geo-c2-climate-action-and-urban-adaptation": "compulsory-2",
  "geo-s1-remote-sensing-spectral-feature-and-ground-truth": "selective-1",
  "geo-s1-soil-map-and-multispectral-inference": "selective-1",
  "geo-s1-fire-detection-sensor-and-temporal-resolution": "selective-1",
  "geo-s2-school-boundary-change-and-regional-comparison": "selective-2",
  "geo-s2-water-risk-scenario-and-regional-planning": "selective-2",
  "geo-s2-sea-level-viewer-and-coastal-exposure": "selective-2",
  "geo-s3-climate-adaptation-and-disaster-risk": "selective-3",
  "geo-s3-forest-loss-monitoring-and-ecosystem-security": "selective-3",
  "geo-s3-sea-level-rise-and-coastal-security": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.24.39");
assert.equal(payload.sources.length, 271);
assert.equal(payload.items.length, 605);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v36 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  assert.equal(source.accessedAt, expected.accessedAt);
  if (expected.commitSha) {
    assert.equal(source.commitSha, expected.commitSha);
    assert.ok(source.editionNote.includes(expected.commitSha), `${sourceId} edition note must repeat its commit SHA`);
  }
  assert.match(source.licenseNote, /citation|原创|不复制|仅作|license|许可/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v36 item ${itemId}`);
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
