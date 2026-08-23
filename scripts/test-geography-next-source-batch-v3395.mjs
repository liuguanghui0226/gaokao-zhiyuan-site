#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "github-mapwork-board-geography": {
    url: "https://github.com/pradumon14/Mapwork",
    commitSha: "38e00e852118b6798c76ca881d45e386ffffb95e",
    accessedAt: "2026-08-23",
  },
  "github-geojunior-interactive-geography": {
    url: "https://github.com/aarong21/geo-junior",
    commitSha: "867424338acb9cd387e8197fa83a8d050f0be4fd",
    accessedAt: "2026-08-23",
  },
  "github-geo-data-teaching": {
    url: "https://github.com/barguzin/geo_data",
    commitSha: "3dda4ffc44cc8c6fce4cefb0bf87213c429fd31e",
    accessedAt: "2026-08-23",
  },
};

const expectedItems = {
  "geo-c1-mapwork-scale-direction-and-feature-location": "compulsory-1",
  "geo-c1-fire-perimeter-land-cover-and-risk": "compulsory-1",
  "geo-c1-quiz-recall-to-process-evidence": "compulsory-1",
  "geo-c2-resource-facility-location-and-network": "compulsory-2",
  "geo-c2-cholera-point-pattern-and-environmental-clues": "compulsory-2",
  "geo-c2-country-capital-hierarchy-and-political-space": "compulsory-2",
  "geo-s1-coordinate-calibration-and-spatial-error": "selective-1",
  "geo-s1-temperature-series-and-climate-scale": "selective-1",
  "geo-s1-mapwork-relief-water-feature-and-process": "selective-1",
  "geo-s2-data-extent-and-regional-comparison": "selective-2",
  "geo-s2-mapwork-feature-clusters-and-regional-structure": "selective-2",
  "geo-s2-interactive-quiz-to-geographic-inquiry": "selective-2",
  "geo-s3-resource-facility-map-and-security-boundary": "selective-3",
  "geo-s3-open-environment-data-and-provenance": "selective-3",
  "geo-s3-geography-quiz-coverage-and-validation": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.24.38");
assert.equal(payload.sources.length, 263);
assert.equal(payload.items.length, 590);

const sources = new Map(payload.sources.map((source) => [source.id, source]));
for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = sources.get(sourceId);
  assert.ok(source, `missing v32 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  assert.equal(source.commitSha, expected.commitSha);
  assert.equal(source.accessedAt, expected.accessedAt);
  assert.match(source.licenseNote, /citation|原创|不复制|仅作|许可/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v32 item ${itemId}`);
  assert.equal(item.courseId, courseId);
  assert.equal(item.licenseStatus, "citation-only");
  assert.equal(item.reviewStatus, "reviewed");
  assert.ok(item.summary.length >= 60 && item.summary.length <= 500);
  assert.ok(item.keywords.length >= 4);
  assert.ok(item.evidence.length >= 2);
  assert.ok(item.evidence.some((evidence) => Object.hasOwn(expectedSources, evidence.sourceId)));
  assert.ok(item.evidence.some((evidence) => evidence.sourceId.startsWith("pep-geography-")));
  assert.ok(item.sourceIds.some((sourceId) => sourceId.startsWith("pep-geography-")));
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
