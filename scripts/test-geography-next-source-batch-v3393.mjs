#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "web-fao-water-scarcity": "https://www.fao.org/land-water/water/water-scarcity/en/",
  "web-sdg6-water-security": "https://sdgs.un.org/goals/goal6",
  "web-sdg11-sustainable-cities": "https://sdgs.un.org/goals/goal11",
  "web-ipcc-ar6-wg2-impacts-adaptation": "https://www.ipcc.ch/report/ar6/wg2/",
  "github-mapping-chinese-universities": "https://github.com/lzz0722/mapping-chinese-universities",
  "github-gisnepal-environmental-demographic": "https://github.com/a4aron/GisNepal",
  "github-plane-navigation-geography": "https://github.com/olivercoltart/plane-game",
};

const expectedCommits = {
  "github-mapping-chinese-universities": "a4cdb1c01f9b964db7785125659666bab30943de",
  "github-gisnepal-environmental-demographic": "755fd7bdae2b9ce26efc436b648b29700c6026a2",
  "github-plane-navigation-geography": "2823b0c2496f4f283930208114a5079d1bd03e80",
};

const expectedItems = {
  "geo-c1-water-scarcity-and-seasonal-balance": "compulsory-1",
  "geo-c1-map-distance-and-route-scale": "compulsory-1",
  "geo-c1-climate-impact-evidence-and-uncertainty": "compulsory-1",
  "geo-c2-sustainable-city-indicator-chain": "compulsory-2",
  "geo-c2-university-distribution-and-regional-inequality": "compulsory-2",
  "geo-c2-environmental-demographic-overlay": "compulsory-2",
  "geo-s1-water-scarcity-evapotranspiration-and-balance": "selective-1",
  "geo-s1-climate-impact-chain-and-time-scale": "selective-1",
  "geo-s1-route-distance-map-projection": "selective-1",
  "geo-s2-sustainable-city-planning-and-spatial-equity": "selective-2",
  "geo-s2-university-network-and-regional-development": "selective-2",
  "geo-s2-gis-environmental-demographic-planning": "selective-2",
  "geo-s3-water-security-demand-and-ecological-flow": "selective-3",
  "geo-s3-climate-adaptation-confidence-and-security": "selective-3",
  "geo-s3-spatial-inequality-data-and-resource-allocation": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.24.38");
assert.equal(payload.sources.length, 263);
assert.equal(payload.items.length, 590);

const sources = new Map(payload.sources.map((source) => [source.id, source]));
for (const [sourceId, url] of Object.entries(expectedSources)) {
  const source = sources.get(sourceId);
  assert.ok(source, `missing v31 source ${sourceId}`);
  assert.equal(source.url, url);
  assert.equal(source.accessedAt, "2026-08-23");
  assert.match(source.licenseNote, /citation|原创|不复制|仅作|许可/i);
  if (expectedCommits[sourceId]) assert.equal(source.commitSha, expectedCommits[sourceId]);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v31 item ${itemId}`);
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
