#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "github-lurea-geography-teaching-lecture": {
    url: "https://github.com/lurea-git/geography-teaching-lecture",
    commitSha: "3f23a8662cec3e55f8656bbeb2cb7f2e859d5d01",
    accessedAt: "2026-08-23",
  },
  "github-geography-study-react": {
    url: "https://github.com/swingboat/geography-study-react",
    commitSha: "ca94e23989de595560189c3d1463f249639260d5",
    accessedAt: "2026-08-23",
  },
  "github-geographical-education-qa-hallucination": {
    url: "https://github.com/7tigersniffstherose7/Geographical-Education-Multi-round-QA-Dataset",
    commitSha: "5dc19bc3c429907868aad9cbbdb569f283ec5fb6",
    accessedAt: "2026-08-23",
  },
  "github-mizmay-web-map-quickstart": {
    url: "https://github.com/mizmay/web-map-quickstart",
    commitSha: "e71b11067fc820a9ef4df546b15b5b193ed4695b",
    accessedAt: "2026-08-23",
  },
  "web-rgs-schools-geography-resources": {
    url: "https://www.rgs.org/schools",
    accessedAt: "2026-08-23",
  },
  "web-geographical-association-teaching-resources": {
    url: "https://geography.org.uk/online-teaching-resources/",
    accessedAt: "2026-08-23",
  },
};

const expectedItems = {
  "geo-c1-problem-solving-evidence-and-transfer": "compulsory-1",
  "geo-c1-fieldwork-question-observation-and-reflection": "compulsory-1",
  "geo-c1-physical-process-animation-observation": "compulsory-1",
  "geo-c2-geography-lesson-from-place-to-region": "compulsory-2",
  "geo-c2-web-map-layer-to-story": "compulsory-2",
  "geo-c2-rgs-locational-knowledge-and-people": "compulsory-2",
  "geo-s1-sun-earth-moon-model-parameter-check": "selective-1",
  "geo-s1-multi-view-evidence-before-conclusion": "selective-1",
  "geo-s1-map-scale-and-projection-in-web-mapping": "selective-1",
  "geo-s2-web-mapping-from-question-to-layer": "selective-2",
  "geo-s2-teaching-system-as-problem-solving-structure": "selective-2",
  "geo-s2-fieldwork-and-enquiry-design": "selective-2",
  "geo-s3-geography-qa-source-evidence-and-hallucination": "selective-3",
  "geo-s3-multi-round-qa-uncertainty-check": "selective-3",
  "geo-s3-teaching-resource-license-and-access-boundary": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.23.26");
assert.equal(payload.sources.length, 184);
assert.equal(payload.items.length, 410);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v26 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  assert.equal(source.accessedAt, expected.accessedAt);
  if (expected.commitSha) {
    assert.equal(source.commitSha, expected.commitSha);
    assert.ok(source.editionNote.includes(expected.commitSha), `${sourceId} edition note must repeat its commit SHA`);
  }
  assert.match(source.licenseNote, /citation|原创|不复制|仅作/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v26 item ${itemId}`);
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
