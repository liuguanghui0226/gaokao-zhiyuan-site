#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "github-geolab-high-school-platform": {
    url: "https://github.com/1195214305/GeoLab",
    commitSha: "1792de4d2814d796e28bc6c62a7cf596f5a73a8b",
    accessedAt: "2026-08-23",
  },
  "github-geolab-128-coupled-systems": {
    url: "https://github.com/laiyukai910-star/geolab-128",
    commitSha: "0b6c9c4770cd8d0cf2b36fb12549affa2489c907",
    accessedAt: "2026-08-23",
  },
  "github-geography-note-regional-index": {
    url: "https://github.com/a15355447898/Geography_Note",
    commitSha: "17d8cc03eaca3a548b5e168218462890b062718c",
    accessedAt: "2026-08-23",
  },
  "web-epa-heat-islands": {
    url: "https://www.epa.gov/heatislands",
    accessedAt: "2026-08-23",
  },
  "web-national-geographic-urban-heat-island": {
    url: "https://education.nationalgeographic.org/resource/urban-heat-island/",
    accessedAt: "2026-08-23",
  },
  "web-met-office-learn-weather": {
    url: "https://www.metoffice.gov.uk/weather/learn-about/weather",
    accessedAt: "2026-08-23",
  },
};

const expectedItems = {
  "geo-c1-coupled-terrain-water-ecology-feedback": "compulsory-1",
  "geo-c1-weather-observation-before-process-inference": "compulsory-1",
  "geo-c1-urban-surface-energy-and-heat-island": "compulsory-1",
  "geo-c2-high-school-knowledge-system-and-chapter-navigation": "compulsory-2",
  "geo-c2-regional-notes-from-case-to-comparison": "compulsory-2",
  "geo-c2-urban-heat-island-land-use-and-service-planning": "compulsory-2",
  "geo-s1-urban-heat-island-surface-energy-process": "selective-1",
  "geo-s1-weather-scale-and-observation-uncertainty": "selective-1",
  "geo-s1-coupled-model-process-gates": "selective-1",
  "geo-s2-terrain-water-infrastructure-scenario-tradeoff": "selective-2",
  "geo-s2-knowledge-platform-as-regional-retrieval-map": "selective-2",
  "geo-s2-urban-heat-adaptation-and-spatial-equity": "selective-2",
  "geo-s3-urban-heat-risk-exposure-vulnerability-adaptation": "selective-3",
  "geo-s3-coupled-systems-scenario-uncertainty-and-resilience": "selective-3",
  "geo-s3-educational-simulation-and-ai-evidence-boundary": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.23.30");
assert.equal(payload.sources.length, 206);
assert.equal(payload.items.length, 470);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v27 source ${sourceId}`);
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
  assert.ok(item, `missing v27 item ${itemId}`);
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
