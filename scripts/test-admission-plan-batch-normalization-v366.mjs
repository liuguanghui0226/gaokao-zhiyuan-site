#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  normalizeOfficialOrdinaryPlanRoute,
} from "./audit-admission-plan-route-transition-v3345.mjs";

const ordinary = {
  dataType: "admission-plan",
  admissionType: "普通录取",
  formalScoreScope: "school-official-only",
  province: "北京",
  majorName: "汉语言文学",
};
assert.deepEqual(normalizeOfficialOrdinaryPlanRoute(ordinary), {
  ...ordinary,
  batch: "普通本科批",
});

const alreadyRouted = { ...ordinary, batch: "本科一批" };
assert.deepEqual(normalizeOfficialOrdinaryPlanRoute(alreadyRouted), alreadyRouted);
assert.deepEqual(
  normalizeOfficialOrdinaryPlanRoute({ ...ordinary, admissionType: "提前批" }),
  { ...ordinary, admissionType: "提前批" },
);
assert.deepEqual(
  normalizeOfficialOrdinaryPlanRoute({ ...ordinary, formalScoreScope: "special-path-only" }),
  { ...ordinary, formalScoreScope: "special-path-only" },
);

console.log(JSON.stringify({ status: "ok", normalizedBatch: "普通本科批", specialPathsUntouched: true }, null, 2));
