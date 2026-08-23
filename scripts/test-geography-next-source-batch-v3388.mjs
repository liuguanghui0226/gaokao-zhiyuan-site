#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "github-cicada-high-school-geography-notes": {
    url: "https://github.com/Cicada000/Geography-Notes",
    commitSha: "d0e91a407ed3768907eb39e09aecfd8116703fcc",
    accessedAt: "2026-08-23",
  },
  "web-national-geographic-flood": {
    url: "https://education.nationalgeographic.org/resource/flood/",
    accessedAt: "2026-08-23",
  },
  "web-national-geographic-landslide": {
    url: "https://education.nationalgeographic.org/resource/landslide/",
    accessedAt: "2026-08-23",
  },
  "web-national-geographic-renewable-energy": {
    url: "https://education.nationalgeographic.org/resource/renewable-energy/",
    accessedAt: "2026-08-23",
  },
  "web-nasa-earthdata-learn": {
    url: "https://www.earthdata.nasa.gov/learn",
    accessedAt: "2026-08-23",
  },
};

const expectedItems = {
  "geo-c1-flood-runoff-and-land-use-process": "compulsory-1",
  "geo-c1-landslide-slope-water-and-geology": "compulsory-1",
  "geo-c1-earth-data-observation-and-process": "compulsory-1",
  "geo-c2-floodplain-settlement-and-land-use": "compulsory-2",
  "geo-c2-renewable-energy-location-and-land-use": "compulsory-2",
  "geo-c2-textbook-variant-and-concept-mapping": "compulsory-2",
  "geo-s1-landslide-slope-geology-and-water-evidence": "selective-1",
  "geo-s1-earth-observation-scale-and-process": "selective-1",
  "geo-s1-renewable-energy-natural-conditions": "selective-1",
  "geo-s2-flood-risk-and-regional-planning": "selective-2",
  "geo-s2-renewable-energy-spatial-comparison": "selective-2",
  "geo-s2-multi-edition-regional-case-crosswalk": "selective-2",
  "geo-s3-landslide-risk-exposure-and-vulnerability": "selective-3",
  "geo-s3-renewable-energy-security-and-tradeoffs": "selective-3",
  "geo-s3-earth-data-provenance-and-uncertainty": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.23.33");
assert.equal(payload.sources.length, 224);
assert.equal(payload.items.length, 515);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v28 source ${sourceId}`);
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
  assert.ok(item, `missing v28 item ${itemId}`);
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
