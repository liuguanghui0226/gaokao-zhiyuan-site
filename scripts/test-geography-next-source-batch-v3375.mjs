#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "web-usgs-landsat-missions": {
    url: "https://www.usgs.gov/landsat-missions",
    accessedAt: "2026-08-22",
  },
  "web-usgs-volcano-hazards": {
    url: "https://www.usgs.gov/programs/volcano-hazards",
    accessedAt: "2026-08-22",
  },
  "web-fao-forestry": {
    url: "https://www.fao.org/forestry/en/",
    accessedAt: "2026-08-22",
  },
  "web-unesco-world-water-development": {
    url: "https://www.unesco.org/reports/wwdr",
    accessedAt: "2026-08-22",
  },
  "web-unep-global-environment-outlook-7": {
    url: "https://www.unep.org/resources/global-environment-outlook-7",
    accessedAt: "2026-08-22",
  },
  "github-walkerke-education-map": {
    url: "https://github.com/walkerke/education_map",
    commitSha: "bb9d96aca424a06477ceab0fbb678c0faddd1f8c",
    accessedAt: "2026-08-22",
  },
  "github-gdsl-teaching-links": {
    url: "https://github.com/GDSL-UL/Teaching_Links",
    commitSha: "fe41d44d9ef89ada8d4f38c5f1a30ba7e603f0ba",
    accessedAt: "2026-08-22",
  },
  "github-sshuair-awesome-gis": {
    url: "https://github.com/sshuair/awesome-gis",
    commitSha: "0f21c1f6aa9fcefb044456827e9eb8363135f392",
    accessedAt: "2026-08-22",
  },
};

const expectedItems = {
  "geo-c1-landsat-land-cover-change-evidence": "compulsory-1",
  "geo-c1-volcanic-risk-and-lava-landform": "compulsory-1",
  "geo-c1-forest-soil-water-cycle": "compulsory-1",
  "geo-c2-forest-products-and-rural-industry": "compulsory-2",
  "geo-c2-urban-water-supply-and-service": "compulsory-2",
  "geo-c2-education-map-and-local-place-evidence": "compulsory-2",
  "geo-s1-volcanic-plume-and-atmosphere": "selective-1",
  "geo-s1-forest-evapotranspiration-and-climate": "selective-1",
  "geo-s1-global-water-cycle-and-water-storage": "selective-1",
  "geo-s2-landsat-resolution-and-change-detection": "selective-2",
  "geo-s2-education-map-projection-and-scale": "selective-2",
  "geo-s2-gis-teaching-sequence-and-field-verification": "selective-2",
  "geo-s3-forest-carbon-and-land-security": "selective-3",
  "geo-s3-water-security-sdgs-and-equity": "selective-3",
  "geo-s3-environmental-outlook-and-policy-scenario": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.24.38");
assert.equal(payload.sources.length, 263);
assert.equal(payload.items.length, 590);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v17 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  assert.equal(source.accessedAt, expected.accessedAt);
  if (expected.commitSha) assert.equal(source.commitSha, expected.commitSha);
  assert.match(source.licenseNote, /citation|原创|不复制|仅作/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v17 item ${itemId}`);
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
assert.deepEqual(Object.fromEntries(Object.entries(courseCounts).map(([courseId, entries]) => [courseId, entries.length])), {
  "compulsory-1": 3,
  "compulsory-2": 3,
  "selective-1": 3,
  "selective-2": 3,
  "selective-3": 3,
});

console.log(JSON.stringify({
  ok: true,
  version: payload.version,
  addedSources: Object.keys(expectedSources).length,
  addedItems: Object.keys(expectedItems).length,
  courseCounts: Object.fromEntries(Object.entries(courseCounts).map(([courseId, entries]) => [courseId, entries.length])),
}, null, 2));
