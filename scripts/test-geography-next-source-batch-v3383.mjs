#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "github-onicio-geodeck": {
    url: "https://github.com/onicio/geodeck",
    commitSha: "f43955d7d50b97bb5f75698cba5c99aed59ee3d6",
    accessedAt: "2026-08-23",
  },
  "github-nocci-high-school-geography": {
    url: "https://github.com/Nocci-lab/geography_high_school",
    commitSha: "955972d59683d5b67fcdc6a706503b4dfb92d449",
    accessedAt: "2026-08-23",
  },
  "github-alexjohnj-geographyas": {
    url: "https://github.com/alexjohnj/geographyas",
    commitSha: "1b8a7666bc1004955a45787a49e81930f8aba6e5",
    accessedAt: "2026-08-23",
  },
  "github-spatialthoughts-qgis-tutorials": {
    url: "https://github.com/spatialthoughts/qgis-tutorials",
    commitSha: "e6c1e1650e37ada34ae78be3155c6b63c526c3b8",
    accessedAt: "2026-08-23",
  },
  "github-opengeos-pygis": {
    url: "https://github.com/opengeos/pygis",
    commitSha: "bb36d465c05fadf768e4ca21fbfa0eeee419b8ce",
    accessedAt: "2026-08-23",
  },
};

const expectedItems = {
  "geo-c1-absolute-distance-direction-map-reading": "compulsory-1",
  "geo-c1-elevation-isoline-evidence": "compulsory-1",
  "geo-c1-revision-process-chain-and-scale": "compulsory-1",
  "geo-c2-cartogram-statistical-space": "compulsory-2",
  "geo-c2-europe-north-america-regional-comparison": "compulsory-2",
  "geo-c2-case-study-evidence-chain": "compulsory-2",
  "geo-s1-map-projection-distortion-purpose": "selective-1",
  "geo-s1-physical-region-map-compare": "selective-1",
  "geo-s1-climate-case-evidence-and-uncertainty": "selective-1",
  "geo-s2-thematic-map-symbol-selection": "selective-2",
  "geo-s2-qgis-tutorial-task-sequence": "selective-2",
  "geo-s2-geospatial-environment-reproducibility": "selective-2",
  "geo-s3-map-design-and-environmental-equity": "selective-3",
  "geo-s3-resource-environment-case-review": "selective-3",
  "geo-s3-data-license-and-provenance-boundary": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.23.33");
assert.equal(payload.sources.length, 224);
assert.equal(payload.items.length, 515);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v23 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  assert.equal(source.commitSha, expected.commitSha);
  assert.equal(source.accessedAt, expected.accessedAt);
  assert.ok(source.editionNote.includes(expected.commitSha), `${sourceId} edition note must repeat its commit SHA`);
  assert.match(source.licenseNote, /citation|原创|不复制|仅作/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v23 item ${itemId}`);
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
