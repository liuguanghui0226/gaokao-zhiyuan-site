#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "github-shanghai-high-school-lab": {
    url: "https://github.com/wuhy80/shanghai-high-school-lab",
    commitSha: "a2a05482c66267b611cda67ca960b03feefbf811",
    accessedAt: "2026-08-22",
  },
  "github-geo-teaching-workbench": {
    url: "https://github.com/SUNhui918/geo-teaching-workbench",
    commitSha: "301564e3e8f731b97478b71b1f859479cac53b5d",
    accessedAt: "2026-08-22",
  },
  "github-high-school-geography-notes": {
    url: "https://github.com/felixyu9722/high-school-geography",
    commitSha: "048db7e7c1156fe50e1ceb0fcc542a19f6f42712",
    accessedAt: "2026-08-22",
  },
  "web-wmo-climate": {
    url: "https://wmo.int/themes/climate",
    accessedAt: "2026-08-22",
  },
  "web-nasa-carbon-cycle": {
    url: "https://science.nasa.gov/earth/earth-observatory/the-carbon-cycle/",
    accessedAt: "2026-08-22",
  },
  "web-fao-land-resources": {
    url: "https://www.fao.org/land-water/land/en/",
    accessedAt: "2026-08-22",
  },
  "web-fao-water-resources": {
    url: "https://www.fao.org/land-water/water/en/",
    accessedAt: "2026-08-22",
  },
};

const expectedItems = new Set([
  "geo-c1-natural-geography-process-unit-map",
  "geo-c2-human-geography-unit-map",
  "geo-s1-solar-motion-polar-day-boundary",
  "geo-s1-climate-observation-variability-evidence",
  "geo-s2-world-region-comparison-evidence",
  "geo-s2-map-chart-region-comparison",
  "geo-s3-globalization-resource-environment-security",
  "geo-s3-carbon-cycle-reservoir-feedback",
  "geo-s3-land-degradation-food-security",
  "geo-s3-water-allocation-competing-uses",
]);

assert.match(payload.version, /^geo-2026\.08\.\d+\.\d+$/);
assert.ok(payload.sources.length >= 72);
assert.ok(payload.items.length >= 185);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v8 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  if (expected.commitSha) assert.equal(source.commitSha, expected.commitSha);
  assert.equal(source.accessedAt, expected.accessedAt);
  assert.match(source.licenseNote, /citation|原创|不复制|仅作/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const itemId of expectedItems) {
  const item = items.get(itemId);
  assert.ok(item, `missing v8 item ${itemId}`);
  assert.equal(item.licenseStatus, "citation-only");
  assert.equal(item.reviewStatus, "reviewed");
  assert.ok(item.summary.length >= 40 && item.summary.length <= 500);
  assert.ok(item.keywords.length >= 2);
  assert.ok(item.evidence.length >= 2);
  assert.ok(item.evidence.some((evidence) => Object.hasOwn(expectedSources, evidence.sourceId)));
}

const courseCounts = Object.groupBy([...expectedItems].map((id) => items.get(id)), (item) => item.courseId);
assert.deepEqual(Object.fromEntries(Object.entries(courseCounts).map(([courseId, entries]) => [courseId, entries.length])), {
  "compulsory-1": 1,
  "compulsory-2": 1,
  "selective-1": 2,
  "selective-2": 2,
  "selective-3": 4,
});

console.log(JSON.stringify({
  ok: true,
  version: payload.version,
  addedSources: Object.keys(expectedSources).length,
  addedItems: expectedItems.size,
  courseCounts: Object.fromEntries(Object.entries(courseCounts).map(([courseId, entries]) => [courseId, entries.length])),
}, null, 2));
