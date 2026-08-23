#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "github-yuta-edu-3d-terrain": {
    url: "https://github.com/YutaOzawaTU/edu-3d-terrain",
    commitSha: "34b7ecd7a1cb6a0948e26869ea56b08c55935a28",
    accessedAt: "2026-08-23",
  },
  "github-vrautenbach-isprs-catalogue": {
    url: "https://github.com/vrautenbach/isprs_catalogue",
    commitSha: "9825eda0b70f33860ba4e0e8ba018685da8098cc",
    accessedAt: "2026-08-23",
  },
  "github-yujinnee-worldhunter": {
    url: "https://github.com/yujinnee/WorldHunter",
    commitSha: "84dcc3a76132e73dfe6f29572f8723c7d6a1d791",
    accessedAt: "2026-08-23",
  },
  "github-mukombradon-globeguesser": {
    url: "https://github.com/mukombradon/GlobeGuesser",
    commitSha: "f0129d7b41a8519361472adae686cd6d2fc292f3",
    accessedAt: "2026-08-23",
  },
  "github-gisphere-kg-chatbot": {
    url: "https://github.com/GIS-Info/GISphereKG-ChatBot",
    commitSha: "a59ae1ae927344f2fa75058b91b79f819a76e455",
    accessedAt: "2026-08-23",
  },
  "web-noaa-education-resource-collections": {
    url: "https://www.noaa.gov/education/resource-collections",
    accessedAt: "2026-08-23",
  },
};

const expectedItems = {
  "geo-c1-terrain-relief-and-vertical-exaggeration": "compulsory-1",
  "geo-c1-3d-model-viewpoint-and-scale": "compulsory-1",
  "geo-c1-ocean-weather-resource-collection": "compulsory-1",
  "geo-c2-continent-country-neighbor-clues": "compulsory-2",
  "geo-c2-global-flag-information-and-regional-hierarchy": "compulsory-2",
  "geo-c2-geography-resource-catalogue-metadata": "compulsory-2",
  "geo-s1-terrain-dem-map-layer-and-attribution": "selective-1",
  "geo-s1-ocean-atmosphere-resource-path": "selective-1",
  "geo-s1-terrain-viewpoint-and-landform-evidence": "selective-1",
  "geo-s2-geospatial-resource-catalogue-and-reproducibility": "selective-2",
  "geo-s2-knowledge-graph-entity-relation-region": "selective-2",
  "geo-s2-country-region-spatial-comparison-game": "selective-2",
  "geo-s3-ocean-climate-resource-evidence": "selective-3",
  "geo-s3-geospatial-data-standardization-and-provenance": "selective-3",
  "geo-s3-geography-game-data-scope-and-fairness": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.23.33");
assert.equal(payload.sources.length, 224);
assert.equal(payload.items.length, 515);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v25 source ${sourceId}`);
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
  assert.ok(item, `missing v25 item ${itemId}`);
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
