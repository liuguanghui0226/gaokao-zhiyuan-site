#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "github-hocbigg-human-geography": {
    url: "https://github.com/hocbigg/human-geography",
    commitSha: "889f15761b3333abf8d24c92bdc5b61a132f2cb5",
    accessedAt: "2026-08-24",
  },
  "github-giswqs-i-guide-geoai-education": {
    url: "https://github.com/giswqs/I-GUIDE-GeoAI-Education",
    commitSha: "114a5d687c5a4443cfa35926c40586a7c2c74d31",
    accessedAt: "2026-08-24",
  },
  "github-carpentries-geospatial-python": {
    url: "https://github.com/carpentries-incubator/geospatial-python",
    commitSha: "36832e58858b808a95f89a03e025807f1c3c7854",
    accessedAt: "2026-08-24",
  },
  "github-cielo-geoscience-lesson-plans-k12": {
    url: "https://github.com/CIELO-G/geoscience-lesson-plans-k12",
    commitSha: "a858f8bd212a588a624b9aaf2ce6202ae6a8250c",
    accessedAt: "2026-08-24",
  },
  "web-nasa-learning-resources": {
    url: "https://www.nasa.gov/learning-resources/",
    accessedAt: "2026-08-24",
  },
  "web-national-geographic-gis": {
    url: "https://education.nationalgeographic.org/resource/geographic-information-system-gis/",
    accessedAt: "2026-08-24",
  },
  "web-osgeo-geo-for-all": {
    url: "https://www.osgeo.org/initiatives/geo-for-all/",
    accessedAt: "2026-08-24",
  },
  "web-nps-geology-education": {
    url: "https://www.nps.gov/subjects/geology/index.htm",
    accessedAt: "2026-08-24",
  },
};

const expectedItems = {
  "geo-c1-earth-science-learning-and-evidence": "compulsory-1",
  "geo-c1-geology-field-observation-and-process": "compulsory-1",
  "geo-c1-earth-system-resource-and-scale": "compulsory-1",
  "geo-c2-human-geography-space-place-and-scale": "compulsory-2",
  "geo-c2-public-service-map-and-spatial-equity": "compulsory-2",
  "geo-c2-population-region-and-evidence-chain": "compulsory-2",
  "geo-s1-geoai-data-pipeline-and-validation": "selective-1",
  "geo-s1-raster-vector-and-spatial-model": "selective-1",
  "geo-s1-geoscience-remote-sensing-and-field-check": "selective-1",
  "geo-s2-place-region-scale-and-comparison": "selective-2",
  "geo-s2-open-gis-education-and-spatial-inquiry": "selective-2",
  "geo-s2-geographic-data-reproducibility": "selective-2",
  "geo-s3-human-environment-system-and-resilience": "selective-3",
  "geo-s3-geology-conservation-and-ecosystem-service": "selective-3",
  "geo-s3-geoai-land-change-and-decision-risk": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.24.39");
assert.equal(payload.sources.length, 271);
assert.equal(payload.items.length, 605);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v37 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  assert.equal(source.accessedAt, expected.accessedAt);
  assert.equal(source.commitSha, expected.commitSha ?? undefined);
  if (expected.commitSha) {
    assert.ok(source.editionNote.includes(expected.commitSha), `${sourceId} edition note must repeat its commit SHA`);
  }
  assert.match(source.licenseNote, /citation|原创|不复制|仅作|未声明|公开|license|许可/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v37 item ${itemId}`);
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
