#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "github-geography-viz-kit": {
    url: "https://github.com/edu-ai-builders/geography-viz-kit",
    commitSha: "b20d01c1739bc9a1aff14d1873da1f1d23b8ddbb",
    accessedAt: "2026-08-22",
  },
  "github-interactive-geography-web-workflow": {
    url: "https://github.com/Deledy/Interactive-Webpage-for-Geography-Teaching",
    commitSha: "13eb4bafabe3abd5a383f38bae8a61dd2c321d51",
    accessedAt: "2026-08-22",
  },
  "github-ocean-currents-map": {
    url: "https://github.com/zzz081129/ocean-currents-map",
    commitSha: "6990d88506cf91c81447f9360f7c029449435bda",
    accessedAt: "2026-08-22",
  },
  "github-geology-high-school-website": {
    url: "https://github.com/astaghitsa/ghist",
    commitSha: "26c29961ef4cd3b2a4df05db5efe378a83ebb29e",
    accessedAt: "2026-08-22",
  },
  "web-noaa-national-hurricane-center": {
    url: "https://www.nhc.noaa.gov/",
    accessedAt: "2026-08-22",
  },
  "web-national-geographic-plate-tectonics": {
    url: "https://education.nationalgeographic.org/resource/plate-tectonics/",
    accessedAt: "2026-08-22",
  },
  "web-national-geographic-population-density": {
    url: "https://education.nationalgeographic.org/resource/population-density/",
    accessedAt: "2026-08-22",
  },
  "web-national-geographic-migration": {
    url: "https://education.nationalgeographic.org/resource/migration/",
    accessedAt: "2026-08-22",
  },
  "web-national-geographic-urban-planning": {
    url: "https://education.nationalgeographic.org/resource/urban-planning/",
    accessedAt: "2026-08-22",
  },
  "web-ipcc-ar6-synthesis-report": {
    url: "https://www.ipcc.ch/report/ar6/syr/",
    accessedAt: "2026-08-22",
  },
  "web-world-bank-farming-agribusiness": {
    url: "https://www.worldbank.org/ext/en/topic/farming-and-agribusiness",
    accessedAt: "2026-08-22",
  },
};

const expectedItems = new Set([
  "geo-s1-three-cell-circulation-visual-model",
  "geo-s1-day-length-heatmap-latitude",
  "geo-s1-ocean-current-map-flow",
  "geo-s1-karst-landform-evidence",
  "geo-s2-geography-lesson-design-review",
  "geo-c1-hurricane-formation-structure",
  "geo-s3-hurricane-risk-coastal-preparedness",
  "geo-c1-plate-boundary-landform-process",
  "geo-c2-population-density-map-scale",
  "geo-c2-migration-push-pull-network",
  "geo-c2-urban-planning-land-use-infrastructure",
  "geo-s3-climate-risk-adaptation-equity",
  "geo-s2-climate-adaptation-pathways",
  "geo-c2-agricultural-productivity-value-chain",
  "geo-s3-agriculture-water-soil-security",
  "geo-s2-agriculture-regional-resilience",
]);

assert.equal(payload.version, "geo-2026.08.22.11");
assert.equal(payload.sources.length, 72);
assert.equal(payload.items.length, 185);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v7 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  if (expected.commitSha) assert.equal(source.commitSha, expected.commitSha);
  assert.equal(source.accessedAt, expected.accessedAt);
  assert.match(source.licenseNote, /citation|原创|不复制|仅作/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const itemId of expectedItems) {
  const item = items.get(itemId);
  assert.ok(item, `missing v7 item ${itemId}`);
  assert.equal(item.licenseStatus, "citation-only");
  assert.equal(item.reviewStatus, "reviewed");
  assert.ok(item.summary.length >= 40 && item.summary.length <= 500);
  assert.ok(item.keywords.length >= 2);
  assert.ok(item.evidence.length >= 2);
  assert.ok(item.evidence.some((evidence) => Object.hasOwn(expectedSources, evidence.sourceId)));
}

const courseCounts = Object.groupBy([...expectedItems].map((id) => items.get(id)), (item) => item.courseId);
assert.deepEqual(Object.fromEntries(Object.entries(courseCounts).map(([courseId, entries]) => [courseId, entries.length])), {
  "compulsory-1": 2,
  "compulsory-2": 4,
  "selective-1": 4,
  "selective-2": 3,
  "selective-3": 3,
});

console.log(JSON.stringify({
  ok: true,
  version: payload.version,
  addedSources: Object.keys(expectedSources).length,
  addedItems: expectedItems.size,
  courseCounts: Object.fromEntries(Object.entries(courseCounts).map(([courseId, entries]) => [courseId, entries.length])),
}, null, 2));
