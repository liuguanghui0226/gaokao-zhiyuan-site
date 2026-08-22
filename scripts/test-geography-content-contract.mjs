#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const filePath = path.join(projectRoot, "data", "geography", "knowledge.json");
const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));

const REQUIRED_COURSES = new Set([
  "compulsory-1",
  "compulsory-2",
  "selective-1",
  "selective-2",
  "selective-3",
]);
const REQUIRED_ANCHORS = new Set([
  "geo-c1-atmospheric-heating",
  "geo-c2-agricultural-location",
  "geo-s1-climate-system",
  "geo-s2-regional-coordination",
  "geo-s3-food-security",
]);
const REQUIRED_EXPANSION_SOURCES = new Set([
  "exam-shanxi-affiliated-2025-12-geography",
  "exam-nanning-no3-2026-03-geography",
  "exam-zhejiang-quzhou-2026-04-geography",
  "marine-geology-reference-2024",
  "marine-resources-reference-2017",
  "marine-environment-reference-2023",
  "marine-disaster-reference-2017",
]);
const REQUIRED_EXPANSION_ITEMS = new Set([
  "geo-c1-rock-cycle-evidence",
  "geo-c1-river-regime-diagnosis",
  "geo-c1-coastal-disaster-exposure",
  "geo-c2-city-radiation-and-economic-hinterland",
  "geo-c2-industrial-chain-spatial-division",
  "geo-c2-circular-agriculture",
  "geo-s1-rock-stratigraphy-sequencing",
  "geo-s1-pressure-field-weather",
  "geo-s1-ocean-current-productivity",
  "geo-s1-earth-sun-shadow",
  "geo-s2-regional-scale-and-function",
  "geo-s2-basin-ecological-coordination",
  "geo-s2-industrial-upgrading-path",
  "geo-s3-marine-resources-evaluation",
  "geo-s3-marine-pollution-governance",
  "geo-s3-coastal-wetland-services",
  "geo-s3-marine-disaster-defense",
  "geo-s3-marine-space-conflict",
]);
const REQUIRED_NEXT_EXPANSION_SOURCES = new Set([
  "local-geography-worktree-2026-06",
  "exam-zhejiang-four-schools-2026-03-geography",
  "exam-harbin-no3-2026-04-geography",
  "exam-shenyang-huimin-2026-04-geography",
  "marine-ecology-reference-2017",
  "marine-chemistry-reference-2017",
  "marine-survey-reference-2017",
  "marine-island-reference-2017",
  "marine-weather-reference-2017",
  "web-noaa-tides-education",
  "web-noaa-ocean-acidification",
  "web-nasa-remote-sensing-earth-observatory",
  "github-geospatial-data-analysis-cn",
]);
const REQUIRED_NEXT_EXPANSION_ITEMS = new Set([
  "geo-c1-water-resource-balance",
  "geo-c1-ecosystem-biodiversity",
  "geo-c1-coastal-process-tidal-landform",
  "geo-c2-population-change-age-structure",
  "geo-c2-urban-spatial-structure",
  "geo-c2-urban-hierarchy-services",
  "geo-c2-agricultural-type-modernization",
  "geo-c2-industrial-region-formation",
  "geo-c2-transport-corridor-accessibility",
  "geo-s1-solar-radiation-seasonality",
  "geo-s1-earth-structure-seismic-evidence",
  "geo-s1-soil-profile-formation",
  "geo-s1-vegetation-altitudinal-zonation",
  "geo-s1-climate-comfort-and-classification",
  "geo-s1-seawater-salinity-and-ice",
  "geo-s2-gis-remote-sensing-evidence",
  "geo-s2-desertification-mechanism",
  "geo-s2-forest-ecosystem-restoration",
  "geo-s2-energy-development-environment",
  "geo-s2-watershed-ecological-compensation",
  "geo-s2-regional-agriculture-tourism",
  "geo-s3-marine-ecosystem-red-tide",
  "geo-s3-marine-water-quality-indicators",
  "geo-s3-marine-observation-remote-sensing",
  "geo-s3-island-use-ecological-protection",
  "geo-s3-marine-weather-coastal-warning",
  "geo-s3-ocean-acidification-carbon-cycle",
  "geo-c1-atmospheric-moisture-precipitation",
  "geo-c1-weathering-and-soil-erosion",
  "geo-c1-volcanic-earthquake-risk",
  "geo-c2-demographic-transition-and-policy",
  "geo-c2-urbanization-and-rural-urban-integration",
  "geo-c2-service-industry-and-digital-connectivity",
  "geo-s1-monsoon-seasonal-precipitation",
  "geo-s1-water-balance-evapotranspiration",
  "geo-s1-glacier-permafrost-and-climate",
  "geo-s1-tidal-current-estuary-dynamics",
  "geo-s2-regional-planning-land-use",
  "geo-s2-remote-sensing-spectral-resolution",
  "geo-s3-water-security-ecological-flow",
  "geo-s3-biodiversity-connectivity-conservation",
  "geo-s3-carbon-budget-low-carbon-transition",
  "geo-s3-ocean-acidification-food-security",
]);
const REQUIRED_EXTERNAL_SOURCES = new Set([
  "github-orange-geography-coach",
  "github-shanghai-knowledge-cards",
  "github-ckgg-high-school-geography",
  "github-geospatial-data-analysis-cn",
  "github-atlasgpt-secondary-geography",
  "github-terrain-explorer-africa",
  "github-intro-gispro",
  "github-open-geo-data-education",
  "github-geog-510",
  "github-adaptive-geography",
  "github-openguessr-education",
  "github-multitouch-geography-game",
  "github-sun-motion-visualization",
  "github-geowiki-high-school-geography",
  "github-k12-gis-resources",
  "github-geography-viz-kit",
  "github-interactive-geography-web-workflow",
  "github-ocean-currents-map",
  "github-geology-high-school-website",
  "github-shanghai-high-school-lab",
  "github-geo-teaching-workbench",
  "github-high-school-geography-notes",
]);
const REQUIRED_PUBLIC_WEB_SOURCES = new Set([
  "web-noaa-tides-education",
  "web-noaa-ocean-acidification",
  "web-nasa-remote-sensing-earth-observatory",
  "web-nasa-el-nino",
  "web-nasa-gpm-water-cycle",
  "web-esa-copernicus-earth-observation",
  "web-fao-global-soil-partnership",
  "web-noaa-jetstream-weather-school",
  "web-national-geographic-water-cycle",
  "web-nasa-world-of-change",
  "web-noaa-national-hurricane-center",
  "web-national-geographic-plate-tectonics",
  "web-national-geographic-population-density",
  "web-national-geographic-migration",
  "web-national-geographic-urban-planning",
  "web-ipcc-ar6-synthesis-report",
  "web-world-bank-farming-agribusiness",
  "web-wmo-climate",
  "web-nasa-carbon-cycle",
  "web-fao-land-resources",
  "web-fao-water-resources",
]);
const REQUIRED_V3_ITEMS = new Set([
  "geo-c1-water-cycle-observation",
  "geo-c1-soil-health-and-erosion",
  "geo-c1-africa-relief-river-ecology",
  "geo-c2-map-based-regional-evidence",
  "geo-c2-landscape-and-human-environment",
  "geo-s1-enso-wind-current-upwelling",
  "geo-s1-enso-teleconnection-precipitation",
  "geo-s1-water-cycle-evaporation-runoff",
  "geo-s2-copernicus-multisource-monitoring",
  "geo-s2-vector-raster-scale",
  "geo-s2-map-workflow-and-reproducibility",
  "geo-s2-protected-area-spatial-evidence",
  "geo-s2-sentinel-emergency-response",
  "geo-s3-soil-carbon-and-food-security",
  "geo-s3-soil-salinity-and-land-restoration",
  "geo-s3-enso-climate-risk-and-resources",
]);
const REQUIRED_V4_ITEMS = new Set([
  "geo-c1-dem-relief-and-drainage",
  "geo-c1-gridded-climate-surface",
  "geo-c2-population-grid-and-scale",
  "geo-c2-network-accessibility-and-hinterland",
  "geo-c2-map-reading-place-clues",
  "geo-s1-raster-resolution-and-natural-process",
  "geo-s1-elevation-profile-and-contour",
  "geo-s2-vector-raster-overlay-analysis",
  "geo-s2-reproducible-map-workflow",
  "geo-s2-map-scale-generalization",
  "geo-s3-environmental-indicator-crosscheck",
  "geo-s3-resource-security-data-freshness",
]);
const REQUIRED_V5_ITEMS = new Set([
  "geo-c1-weather-radar-precipitation",
  "geo-c1-groundwater-recharge-discharge",
  "geo-c1-solar-surface-heating-and-energy",
  "geo-c1-land-cover-surface-feedback",
  "geo-c2-urban-expansion-and-land-use",
  "geo-c2-digital-map-evidence-for-community",
  "geo-c2-geography-wiki-knowledge-navigation",
  "geo-s1-sun-path-latitude-season",
  "geo-s1-air-mass-front-weather-map",
  "geo-s1-weather-radar-and-convective-risk",
  "geo-s2-land-cover-change-and-regional-planning",
  "geo-s2-k12-gis-layer-and-scale",
  "geo-s2-k12-gis-source-attribution",
  "geo-s2-geowiki-cross-course-concept-map",
  "geo-s3-water-cycle-and-resource-security",
  "geo-s3-remote-sensing-environmental-change",
  "geo-s3-extreme-weather-adaptation-chain",
  "geo-s3-resource-environment-map-attribution",
]);
const REQUIRED_V7_ITEMS = new Set([
  "geo-s1-three-cell-circulation-visual-model",
  "geo-s1-day-length-heatmap-latitude",
  "geo-s1-ocean-current-map-flow",
  "geo-s1-karst-landform-evidence",
  "geo-s2-geography-lesson-design-review",
  "geo-c1-hurricane-formation-structure",
  "geo-s3-hurricane-risk-coastal-preparedness",
  "geo-c1-plate-boundary-landform-process",
  "geo-c2-population-density-map-scale",
  "geo-c2-migration-push-pull-network",
  "geo-c2-urban-planning-land-use-infrastructure",
  "geo-s3-climate-risk-adaptation-equity",
  "geo-s2-climate-adaptation-pathways",
  "geo-c2-agricultural-productivity-value-chain",
  "geo-s3-agriculture-water-soil-security",
  "geo-s2-agriculture-regional-resilience",
]);
const REQUIRED_V8_ITEMS = new Set([
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
const REQUIRED_EXTERNAL_ITEMS = new Set([
  "geo-s1-coriolis-force-direction",
  "geo-s1-time-zone-and-date-line",
  "geo-s1-terminator-time-chain",
  "geo-s1-pressure-belt-seasonal-migration",
  "geo-s1-tidal-cycle-and-coastal-impact",
  "geo-s1-moon-phase-and-tidal-link",
  "geo-c2-rural-space-and-industry-transformation",
  "geo-c2-regional-culture-and-environment",
  "geo-s2-multisource-regional-evidence",
  "geo-s2-geographic-knowledge-graph-evidence",
]);
const ALLOWED_LICENSE_STATES = new Set(["authored-summary", "citation-only"]);

assert.equal(typeof payload.version, "string");
assert.ok(payload.version.length > 0);
assert.ok(Array.isArray(payload.courses));
assert.ok(Array.isArray(payload.sources));
assert.ok(Array.isArray(payload.items));
assert.equal(payload.courses.length, REQUIRED_COURSES.size);
assert.deepEqual(new Set(payload.courses.map((course) => course.id)), REQUIRED_COURSES);

const sourceIds = new Set();
for (const source of payload.sources) {
  assert.equal(typeof source.id, "string");
  assert.ok(source.id.length > 0);
  assert.equal(sourceIds.has(source.id), false, `duplicate geography source ${source.id}`);
  sourceIds.add(source.id);
  assert.equal(typeof source.title, "string");
  assert.ok(source.title.length > 0);
  assert.equal(typeof source.publisher, "string");
  assert.ok(source.publisher.length > 0);
  assert.equal(typeof source.licenseNote, "string");
  assert.ok(source.licenseNote.length > 0);
}

const courseIds = new Set(payload.courses.map((course) => course.id));
for (const sourceId of REQUIRED_EXPANSION_SOURCES) {
  assert.equal(sourceIds.has(sourceId), true, `missing expanded geography source ${sourceId}`);
}
for (const sourceId of REQUIRED_NEXT_EXPANSION_SOURCES) {
  assert.equal(sourceIds.has(sourceId), true, `missing next geography source ${sourceId}`);
}
for (const sourceId of REQUIRED_EXTERNAL_SOURCES) {
  assert.equal(sourceIds.has(sourceId), true, `missing external geography source ${sourceId}`);
}
for (const source of payload.sources.filter((item) => REQUIRED_EXTERNAL_SOURCES.has(item.id))) {
  assert.match(String(source.url), /^https:\/\//, `${source.id} must retain a public source URL`);
  assert.match(String(source.commitSha), /^[a-f0-9]{40}$/i, `${source.id} must retain an immutable commit SHA`);
  assert.match(String(source.accessedAt), /^2026-08-22$/, `${source.id} must retain an access date`);
}
for (const source of payload.sources.filter((item) => REQUIRED_PUBLIC_WEB_SOURCES.has(item.id))) {
  assert.match(String(source.url), /^https:\/\//, `${source.id} must retain a public source URL`);
  assert.match(String(source.accessedAt), /^2026-08-22$/, `${source.id} must retain an access date`);
}
const itemIds = new Set();
for (const item of payload.items) {
  assert.equal(typeof item.id, "string");
  assert.equal(itemIds.has(item.id), false, `duplicate geography item ${item.id}`);
  itemIds.add(item.id);
  assert.equal(courseIds.has(item.courseId), true, `unknown course ${item.courseId}`);
  assert.equal(typeof item.title, "string");
  assert.ok(item.title.length > 0);
  assert.equal(typeof item.summary, "string");
  assert.ok(item.summary.length >= 40);
  assert.ok(item.summary.length <= 500, `${item.id} summary is too long to be an authored summary`);
  assert.ok(Array.isArray(item.keywords) && item.keywords.length >= 2);
  assert.ok(Array.isArray(item.sourceIds) && item.sourceIds.length > 0);
  assert.ok(Array.isArray(item.evidence) && item.evidence.length > 0);
  assert.ok(ALLOWED_LICENSE_STATES.has(item.licenseStatus));
  for (const sourceId of item.sourceIds) {
    assert.equal(sourceIds.has(sourceId), true, `${item.id} references unknown source ${sourceId}`);
  }
  for (const evidence of item.evidence) {
    assert.equal(sourceIds.has(evidence.sourceId), true, `${item.id} evidence references unknown source`);
    assert.match(
      String(evidence.locator),
      /第?\s*\d+\s*页|章节|教材|项目描述|README|data\/|pages\/|docs\/|gallery|ontology|RDF|geography\.html|earthmotion|src\/curriculum|01高中世界地理|高中地理考点重点复习|Tides|Remote Sensing|Ocean Acidification|pH|pixels|vector vs raster|El Niño|Water Cycle|World of Change|JetStream|Copernicus|Sentinel|Global Soil Partnership|soil|AtlasGPT|terrain-explorer|GeoPandas|Raster Data|GIS Programming|sun-motion|SunMotion|GeoWiki|K-12|GeoFest|No_License|Tornadoes|Hurricanes|National Hurricane Center|Climate change impacts|Urbanization|Urban Planning|Population Density|Plate Tectonics|Migration|IPCC|Farming and Agribusiness|Water Use and Stress|WMO|Climate|Carbon Cycle|carbon|land-water|water scarcity|competing uses|weather|radar|groundwater/,
      `${item.id} evidence locator must be a page or stable web/repository section`,
    );
    assert.equal(typeof evidence.note, "string");
    assert.ok(evidence.note.length > 0);
  }
}

assert.ok(payload.items.length >= 65, "the comprehensive geography slice must cover the planned next expansion");
assert.ok(payload.items.length >= 143, "the public-source geography slice must include the v5 batch");
for (const courseId of REQUIRED_COURSES) {
  assert.ok(
    payload.items.filter((item) => item.courseId === courseId).length >= 8,
    `${courseId} must retain at least eight geography items`,
  );
}
for (const anchor of REQUIRED_ANCHORS) {
  assert.equal(itemIds.has(anchor), true, `missing curriculum anchor ${anchor}`);
}
for (const itemId of REQUIRED_EXPANSION_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing expanded geography item ${itemId}`);
}
for (const itemId of REQUIRED_NEXT_EXPANSION_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing next expanded geography item ${itemId}`);
}
for (const itemId of REQUIRED_EXTERNAL_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing external geography item ${itemId}`);
}
for (const itemId of REQUIRED_V3_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing v3 geography item ${itemId}`);
}
for (const itemId of REQUIRED_V4_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing v4 geography item ${itemId}`);
}
for (const itemId of REQUIRED_V5_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing v5 geography item ${itemId}`);
}
for (const itemId of REQUIRED_V7_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing v7 geography item ${itemId}`);
}
for (const itemId of REQUIRED_V8_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing v8 geography item ${itemId}`);
}
assert.ok(
  payload.items.filter((item) => item.licenseStatus === "citation-only").length >= 25,
  "expanded question-method and reference-derived items must retain citation-only provenance",
);

console.log(JSON.stringify({
  status: "ok",
  courses: payload.courses.length,
  sources: payload.sources.length,
  items: payload.items.length,
}, null, 2));
