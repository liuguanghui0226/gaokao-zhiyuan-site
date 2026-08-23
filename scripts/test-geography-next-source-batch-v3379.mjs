#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "web-moa-agriculture-rural-development": {
    url: "https://www.moa.gov.cn/",
    accessedAt: "2026-08-23",
  },
  "web-mee-environmental-monitoring": {
    url: "https://www.mee.gov.cn/ywgz/",
    accessedAt: "2026-08-23",
  },
  "web-mnr-natural-resources-data": {
    url: "https://www.mnr.gov.cn/sj/",
    accessedAt: "2026-08-23",
  },
  "web-unesco-global-geoparks": {
    url: "https://www.unesco.org/en/iggp/geoparks/about",
    accessedAt: "2026-08-23",
  },
  "web-wmo-weather": {
    url: "https://wmo.int/themes/weather",
    accessedAt: "2026-08-23",
  },
  "web-cma-weather-climate-observation": {
    url: "https://www.cma.gov.cn/2011xwzx/2011xqxxw/2016/201603/t20160322_306543.html",
    accessedAt: "2026-08-23",
  },
  "github-sems-sun-earth-moon-geography": {
    url: "https://github.com/Thanhson1674/SEMSsimulator",
    commitSha: "633373a8b869589f062aae5a575f664ade56f611",
    accessedAt: "2026-08-23",
  },
  "exam-guigang-2026-02-geography": {
    accessedAt: "2026-08-23",
    sha256: "db8633980741c185061d867b4549068271057daa7762a0f956f30f841058fa5c",
  },
};

const expectedItems = {
  "geo-c1-permafrost-activity-layer-water-cycle": "compulsory-1",
  "geo-c1-pm10-sand-dust-and-cold-air-observation": "compulsory-1",
  "geo-c1-geopark-fieldwork-and-geological-process": "compulsory-1",
  "geo-c2-mining-town-industrial-heritage-transition": "compulsory-2",
  "geo-c2-agricultural-rural-resource-base": "compulsory-2",
  "geo-c2-rural-revitalization-and-land-use-evidence": "compulsory-2",
  "geo-s1-upwelling-seasonality-and-walker-circulation": "selective-1",
  "geo-s1-sun-earth-moon-observation-model": "selective-1",
  "geo-s1-weather-climate-observation-source-selection": "selective-1",
  "geo-s2-geopark-conservation-and-regional-tourism": "selective-2",
  "geo-s2-environmental-monitoring-indicator-chain": "selective-2",
  "geo-s2-natural-resources-data-and-land-use-planning": "selective-2",
  "geo-s3-agricultural-resource-security-and-food-system": "selective-3",
  "geo-s3-environmental-monitoring-and-pollution-risk": "selective-3",
  "geo-s3-weather-warning-and-climate-risk-governance": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.24.39");
assert.equal(payload.sources.length, 271);
assert.equal(payload.items.length, 605);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v20 source ${sourceId}`);
  if (expected.url) {
    assert.equal(source.url, expected.url);
    assert.equal(source.accessedAt, expected.accessedAt);
  } else {
    assert.equal(source.url, undefined);
    assert.equal(source.editionNote.includes(expected.sha256), true);
  }
  if (expected.commitSha) assert.equal(source.commitSha, expected.commitSha);
  assert.match(source.licenseNote, /citation|原创|不复制|仅作/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v20 item ${itemId}`);
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
