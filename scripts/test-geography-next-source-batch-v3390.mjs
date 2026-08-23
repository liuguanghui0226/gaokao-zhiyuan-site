#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "github-malu-china-terrain-map": {
    url: "https://github.com/malu322-jpg/china-terrain-map",
    commitSha: "1bde0972dc06ee7ec96534ac91beaecb7fda9beb",
    accessedAt: "2026-08-23",
  },
  "github-yusuf-zero2truesize": {
    url: "https://github.com/YusufEminoglu/zero2truesize",
    commitSha: "2ebc95e7e6aae01c8efe1394e7cc33458f08cbc1",
    accessedAt: "2026-08-23",
  },
  "github-google-aog-education": {
    url: "https://github.com/googleinterns/AOG-Education",
    commitSha: "cda8c68d2bd339299b1a6bf7d95ee301dcfbcd0b",
    accessedAt: "2026-08-23",
  },
  "github-geofun": {
    url: "https://github.com/Emil-Lima/GeoFun",
    commitSha: "b64b1931f775ff285ec677c53d61e3674c6343b2",
    accessedAt: "2026-08-23",
  },
  "web-nasa-earth-observatory": {
    url: "https://earthobservatory.nasa.gov/",
    accessedAt: "2026-08-23",
  },
};

const expectedItems = {
  "geo-c1-china-terrain-three-staircases-and-profile": "compulsory-1",
  "geo-c1-map-projection-apparent-and-true-area": "compulsory-1",
  "geo-c1-earth-observatory-image-to-process": "compulsory-1",
  "geo-c2-china-terrain-and-settlement-location": "compulsory-2",
  "geo-c2-country-capital-and-city-hierarchy-game": "compulsory-2",
  "geo-c2-country-comparison-and-population-context": "compulsory-2",
  "geo-s1-terrain-exaggeration-and-relief-evidence": "selective-1",
  "geo-s1-projection-distortion-and-geographic-scale": "selective-1",
  "geo-s1-earth-observatory-multitemporal-natural-process": "selective-1",
  "geo-s2-china-terrain-regional-development-crosswalk": "selective-2",
  "geo-s2-map-projection-and-regional-comparison": "selective-2",
  "geo-s2-interactive-geography-task-to-evidence": "selective-2",
  "geo-s3-earth-observatory-hazard-exposure-evidence": "selective-3",
  "geo-s3-terrain-data-and-land-resource-security": "selective-3",
  "geo-s3-true-size-map-and-spatial-justice": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.24.39");
assert.equal(payload.sources.length, 271);
assert.equal(payload.items.length, 605);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v29 source ${sourceId}`);
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
  assert.ok(item, `missing v29 item ${itemId}`);
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
