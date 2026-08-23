#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "github-yvki-secondary-geography-quiz": {
    url: "https://github.com/yvki/quiz",
    commitSha: "db8f3174b18cd984a7d1822e1c13b9a4bd71afed",
    accessedAt: "2026-08-24",
  },
  "github-jeanextreme-geography-game": {
    url: "https://github.com/JeanExtreme002/Geography-Game",
    commitSha: "e8a2f19fa24468a80263ef7e55497bfd5ae298b2",
    accessedAt: "2026-08-24",
  },
  "github-felipe-access-to-education-map": {
    url: "https://github.com/felipehlvo/access_to_education_map",
    commitSha: "b509c7f7cfb9ef3d1088c07c893ad194f515fc34",
    accessedAt: "2026-08-24",
  },
  "github-poc-unesco-education-planning": {
    url: "https://github.com/PoCInnovation/UNESCO-Hacking-ED-Planning",
    commitSha: "b52497e31ff77635be37338d00fe65a99004eb0c",
    accessedAt: "2026-08-24",
  },
  "github-romina-high-school-geography-quiz": {
    url: "https://github.com/rominacarabathampi/AndroidQuiz",
    commitSha: "5d3440282e1cdf03cd3ae369828f22645bbe0ead",
    accessedAt: "2026-08-24",
  },
  "web-fao-global-forest-resources-assessment": {
    url: "https://www.fao.org/interactive/forest-resources-assessment/2020/en/",
    accessedAt: "2026-08-24",
  },
  "web-esa-climate-change-initiative": {
    url: "https://climate.esa.int/en/",
    accessedAt: "2026-08-24",
  },
};

const expectedItems = {
  "geo-c1-geography-field-observation-and-scale": "compulsory-1",
  "geo-c1-weather-quiz-concept-and-evidence": "compulsory-1",
  "geo-c1-climate-record-and-time-scale": "compulsory-1",
  "geo-c2-school-access-and-service-area": "compulsory-2",
  "geo-c2-education-quality-and-spatial-disparity": "compulsory-2",
  "geo-c2-population-and-place-evidence": "compulsory-2",
  "geo-s1-climate-observation-record-and-anomaly": "selective-1",
  "geo-s1-region-clues-and-map-verification": "selective-1",
  "geo-s1-surface-model-and-scale-selection": "selective-1",
  "geo-s2-public-service-access-and-regional-equity": "selective-2",
  "geo-s2-education-data-and-spatial-unit": "selective-2",
  "geo-s2-map-game-and-regional-hierarchy": "selective-2",
  "geo-s3-forest-resource-carbon-and-security": "selective-3",
  "geo-s3-education-resilience-and-governance": "selective-3",
  "geo-s3-geography-quiz-data-boundary-and-fairness": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.24.38");
assert.equal(payload.sources.length, 263);
assert.equal(payload.items.length, 590);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v35 source ${sourceId}`);
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
  assert.ok(item, `missing v35 item ${itemId}`);
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
