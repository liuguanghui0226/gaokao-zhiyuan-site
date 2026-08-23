#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "web-mee-2025-ecological-environment-bulletin": {
    url: "https://www.mee.gov.cn/hjzl/sthjzk/zghjzkgb/202606/P020260604583244574595.pdf",
    accessedAt: "2026-08-23",
  },
  "web-mee-2023-marine-ecological-environment-bulletin": {
    url: "https://www.mee.gov.cn/hjzl/sthjzk/jagb/202405/P020240522601361012621.pdf",
    accessedAt: "2026-08-23",
  },
  "web-mnr-natural-resources-bulletins": {
    url: "https://www.mnr.gov.cn/sj/tjgb/",
    accessedAt: "2026-08-23",
  },
  "web-mnr-south-china-sea-island-ecosystem": {
    url: "https://www.mnr.gov.cn/dt/ywbb/202608/t20260815_2936356.html",
    accessedAt: "2026-08-23",
  },
  "web-cma-meteorological-data": {
    url: "https://data.cma.cn/",
    accessedAt: "2026-08-23",
  },
  "web-cma-satellite-remote-sensing": {
    url: "https://www.cma.gov.cn/2011xwzx/2011xqxxw/202402/t20240226_6086025.html",
    accessedAt: "2026-08-23",
  },
  "github-felix-high-school-geography": {
    url: "https://github.com/felixyu9722/high-school-geography",
    commitSha: "048db7e7c1156fe50e1ceb0fcc542a19f6f42712",
    accessedAt: "2026-08-23",
  },
  "github-clck-shanghai-high-school-knowledge": {
    url: "https://github.com/CLCK0622/Shanghai-High-School-Knowledge",
    commitSha: "2064cd3254bb3977defa4290f029da5b935ea622",
    accessedAt: "2026-08-23",
  },
  "github-zero2geoquest": {
    url: "https://github.com/YusufEminoglu/zero2geoquest",
    commitSha: "ac44c990f34d6531a78c7ca030b2b646983d6da0",
    accessedAt: "2026-08-23",
  },
};

const expectedItems = {
  "geo-c1-ecological-quality-indicator-reading": "compulsory-1",
  "geo-c1-meteorological-observation-and-weather-process": "compulsory-1",
  "geo-c1-high-school-natural-geography-knowledge-map": "compulsory-1",
  "geo-c2-natural-resources-statistical-comparison": "compulsory-2",
  "geo-c2-world-region-human-geography-knowledge-map": "compulsory-2",
  "geo-c2-textbook-outline-and-regional-case": "compulsory-2",
  "geo-s1-marine-ecosystem-and-sea-air-process": "selective-1",
  "geo-s1-satellite-observation-and-atmospheric-process": "selective-1",
  "geo-s1-natural-geography-knowledge-index": "selective-1",
  "geo-s2-island-ecosystem-monitoring-and-spatial-protection": "selective-2",
  "geo-s2-map-quest-and-spatial-reasoning": "selective-2",
  "geo-s2-regional-development-textbook-comparison": "selective-2",
  "geo-s3-ecological-quality-and-environmental-security": "selective-3",
  "geo-s3-marine-ecosystem-status-and-governance": "selective-3",
  "geo-s3-natural-resource-bulletin-and-security-indicators": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.23.30");
assert.equal(payload.sources.length, 206);
assert.equal(payload.items.length, 470);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v18 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  assert.equal(source.accessedAt, expected.accessedAt);
  if (expected.commitSha) assert.equal(source.commitSha, expected.commitSha);
  assert.match(source.licenseNote, /citation|原创|不复制|仅作/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v18 item ${itemId}`);
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
