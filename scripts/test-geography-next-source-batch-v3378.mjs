#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "web-tianditu-national-geospatial-platform": {
    url: "https://www.tianditu.gov.cn/",
    accessedAt: "2026-08-23",
  },
  "web-nbs-national-statistical-yearbook": {
    url: "https://www.stats.gov.cn/sj/ndsj/",
    accessedAt: "2026-08-23",
  },
  "web-nbs-2022-statistical-bulletin": {
    url: "https://www.stats.gov.cn/sj/zxfb/202302/t20230228_1919011.html",
    accessedAt: "2026-08-23",
  },
  "web-china-earthquake-data-center": {
    url: "https://data.earthquake.cn/",
    accessedAt: "2026-08-23",
  },
  "web-national-forestry-grassland-administration": {
    url: "https://www.forestry.gov.cn/",
    accessedAt: "2026-08-23",
  },
  "github-global-circulation-simulator": {
    url: "https://github.com/Eason455/global-circulation-simulator",
    commitSha: "ff76608f10acf33a5eaca5fd0568b237f91efede",
    accessedAt: "2026-08-23",
  },
  "github-satv-geography-tool": {
    url: "https://github.com/jamekes355/SATV-Geography-Tool",
    commitSha: "706bc6916d6706ac43ebfa84682e66b7fc07d1f5",
    accessedAt: "2026-08-23",
  },
};

const expectedItems = {
  "geo-c1-national-geospatial-platform-map-scale": "compulsory-1",
  "geo-c1-earthquake-catalogue-risk-evidence": "compulsory-1",
  "geo-c1-forest-ecosystem-water-regulation": "compulsory-1",
  "geo-c2-population-census-structure-and-demand": "compulsory-2",
  "geo-c2-urbanization-statistical-indicator-chain": "compulsory-2",
  "geo-c2-transport-and-regional-connectivity-indicators": "compulsory-2",
  "geo-s1-global-circulation-seasonal-shift-model": "selective-1",
  "geo-s1-solar-altitude-time-zone-cross-check": "selective-1",
  "geo-s1-earthquake-plate-boundary-process": "selective-1",
  "geo-s2-tianditu-layer-scale-and-regional-planning": "selective-2",
  "geo-s2-forest-restoration-spatial-evidence": "selective-2",
  "geo-s2-circulation-model-and-monsoon-regional-case": "selective-2",
  "geo-s3-forest-resource-security-and-ecosystem-services": "selective-3",
  "geo-s3-statistical-bulletin-resource-environment-indicators": "selective-3",
  "geo-s3-earthquake-disaster-risk-and-resilience": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.23.31");
assert.equal(payload.sources.length, 213);
assert.equal(payload.items.length, 485);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v19 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  assert.equal(source.accessedAt, expected.accessedAt);
  if (expected.commitSha) assert.equal(source.commitSha, expected.commitSha);
  assert.match(source.licenseNote, /citation|原创|不复制|仅作/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v19 item ${itemId}`);
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
