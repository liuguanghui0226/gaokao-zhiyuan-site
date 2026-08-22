#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "github-geographic-interactive-teaching": {
    url: "https://github.com/swingboat/geographic-interactive-teaching",
    commitSha: "afb85fda5672bc4b50a446a2ffab3f4e8cc12c2f",
    accessedAt: "2026-08-22",
  },
  "github-geography-education-solar-earth": {
    url: "https://github.com/xiangyun14159/geography-education",
    commitSha: "3048e18233774268f39c57a06b559597980d4d01",
    accessedAt: "2026-08-22",
  },
  "github-geo-rag-high-school-geography": {
    url: "https://github.com/NanNingmalou/geo-rag",
    commitSha: "e7a479bfccac0246847654955c3e28e86296f761",
    accessedAt: "2026-08-22",
  },
  "web-noaa-tornadoes": {
    url: "https://www.noaa.gov/education/resource-collections/weather-atmosphere/tornadoes",
    accessedAt: "2026-08-22",
  },
  "web-noaa-climate-change-impacts": {
    url: "https://www.noaa.gov/education/resource-collections/climate/climate-change-impacts",
    accessedAt: "2026-08-22",
  },
  "web-our-world-in-data-urbanization": {
    url: "https://ourworldindata.org/urbanization",
    accessedAt: "2026-08-22",
  },
  "web-our-world-in-data-water-use-stress": {
    url: "https://ourworldindata.org/water-use-stress",
    accessedAt: "2026-08-22",
  },
  "web-national-geographic-urbanization": {
    url: "https://education.nationalgeographic.org/resource/urbanization/",
    accessedAt: "2026-08-22",
  },
};

const expectedItems = new Set([
  "geo-s1-earth-rotation-and-linear-speed",
  "geo-s1-obliquity-and-solar-declination",
  "geo-s1-solar-altitude-azimuth-model",
  "geo-s1-solar-model-observation-boundaries",
  "geo-c2-textbook-grounded-geography-qa",
  "geo-s3-self-testing-and-evidence-boundary",
  "geo-c1-tornado-formation-and-updraft",
  "geo-s3-tornado-exposure-and-response",
  "geo-s3-climate-impact-chain",
  "geo-s2-climate-adaptation-regional-planning",
  "geo-c2-urbanization-transition-and-land",
  "geo-c2-urbanization-data-and-spatial-scale",
  "geo-c1-water-withdrawal-and-basin-balance",
  "geo-s3-water-stress-and-resource-security",
  "geo-c2-urban-services-and-spatial-inequality",
  "geo-c2-urbanization-land-use-and-livelihoods",
]);

assert.equal(payload.version, "geo-2026.08.22.9");
assert.equal(payload.sources.length, 54);
assert.equal(payload.items.length, 159);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v6 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  if (expected.commitSha) assert.equal(source.commitSha, expected.commitSha);
  assert.equal(source.accessedAt, expected.accessedAt);
  assert.match(source.licenseNote, /citation|原创|不复制|仅作/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const itemId of expectedItems) {
  const item = items.get(itemId);
  assert.ok(item, `missing v6 item ${itemId}`);
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
  "compulsory-2": 5,
  "selective-1": 4,
  "selective-2": 1,
  "selective-3": 4,
});

console.log(JSON.stringify({
  ok: true,
  version: payload.version,
  addedSources: Object.keys(expectedSources).length,
  addedItems: expectedItems.size,
  courseCounts: Object.fromEntries(Object.entries(courseCounts).map(([courseId, entries]) => [courseId, entries.length])),
}, null, 2));
