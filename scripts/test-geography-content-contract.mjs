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
  "github-secondary-geography-course",
  "github-opengis-curriculum",
  "github-school-geography-maps",
  "github-cielo-geoscience-k12",
  "github-ghist-high-school-geology",
  "github-transport-geography-resources",
  "github-biogeo-secondary-education",
  "github-gis-oer-works",
  "github-apa-urban-planning-resources",
  "github-walkerke-education-map",
  "github-gdsl-teaching-links",
  "github-sshuair-awesome-gis",
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
  "web-unccd-desertification",
  "web-nsidc-glaciers",
  "web-fao-aquastat",
  "web-un-climate-science",
  "web-owid-population-growth",
  "web-noaa-climate-enso",
  "web-eia-energy-explained",
  "web-fao-soil-portal",
  "web-unesco-ocean-literacy",
  "web-bgs-discovering-geology",
  "web-world-bank-urban-development",
  "web-world-bank-water",
  "web-world-bank-disaster-risk",
  "web-usgs-water-cycle",
  "web-usgs-groundwater",
  "web-usgs-earthquake-hazards",
  "web-unhabitat-world-cities-report",
  "web-unep-global-resources-outlook",
  "web-fao-biodiversity",
  "web-usgs-landsat-missions",
  "web-usgs-volcano-hazards",
  "web-fao-forestry",
  "web-unesco-world-water-development",
  "web-unep-global-environment-outlook-7",
  "web-nasa-earth-energy-budget",
  "web-world-bank-migration",
  "web-world-bank-transport",
  "web-owid-urbanization",
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
const REQUIRED_V12_SOURCES = new Set([
  "github-secondary-geography-course",
  "github-opengis-curriculum",
  "github-school-geography-maps",
  "web-unccd-desertification",
  "web-nsidc-glaciers",
  "web-fao-aquastat",
  "web-un-climate-science",
  "web-owid-population-growth",
]);
const REQUIRED_V12_ITEMS = new Set([
  "geo-c1-groundwater-overdraft-subsidence",
  "geo-c1-glacier-runoff-seasonality",
  "geo-c1-desertification-wind-water-erosion",
  "geo-c2-population-growth-age-demand",
  "geo-c2-rural-urban-service-access",
  "geo-c2-map-atlas-scale-distortion",
  "geo-s1-greenhouse-radiative-balance",
  "geo-s1-glacier-mass-balance-climate-evidence",
  "geo-s1-aquastat-water-balance-indicators",
  "geo-s2-desertification-monitoring-restoration",
  "geo-s2-open-gis-curriculum-evidence-chain",
  "geo-s2-school-map-comparative-reading",
  "geo-s3-water-withdrawal-accounting-security",
  "geo-s3-climate-action-mitigation-adaptation",
  "geo-s3-population-resource-pressure",
]);
const REQUIRED_V13_SOURCES = new Set([
  "web-noaa-climate-enso",
  "web-eia-energy-explained",
  "web-fao-soil-portal",
  "web-unesco-ocean-literacy",
  "web-bgs-discovering-geology",
  "web-world-bank-urban-development",
  "web-world-bank-water",
  "web-world-bank-disaster-risk",
]);
const REQUIRED_V13_ITEMS = new Set([
  "geo-c1-enso-ocean-atmosphere-observation",
  "geo-c1-soil-profile-carbon-and-water",
  "geo-c1-geological-map-hazard-evidence",
  "geo-c2-urban-development-and-service-equity",
  "geo-c2-water-security-and-city-growth",
  "geo-c2-energy-industry-spatial-chain",
  "geo-s1-enso-seasonal-evidence",
  "geo-s1-geology-process-and-hazard-scale",
  "geo-s1-ocean-literacy-system-boundaries",
  "geo-s2-urban-resilience-and-regional-planning",
  "geo-s2-water-governance-and-cross-scale-evidence",
  "geo-s2-disaster-risk-map-and-exposure",
  "geo-s3-energy-transition-security-tradeoff",
  "geo-s3-soil-carbon-and-land-security",
  "geo-s3-disaster-risk-adaptation-capacity",
]);
const REQUIRED_V14_SOURCES = new Set([
  "web-noaa-climate-at-a-glance",
  "web-nasa-climate-global-temperature",
  "web-fao-food-systems",
  "web-fao-faostat",
  "github-geocompr",
  "github-geo-python-course",
  "github-geemap",
  "github-leafmap",
]);
const REQUIRED_V14_ITEMS = new Set([
  "geo-c1-climate-observation-scale",
  "geo-c1-global-temperature-process-chain",
  "geo-c1-food-system-natural-base",
  "geo-c2-food-system-value-chain",
  "geo-c2-faostat-indicator-comparison",
  "geo-c2-open-geospatial-map-workflow",
  "geo-s1-climate-time-series-variability",
  "geo-s1-temperature-anomaly-energy-balance",
  "geo-s1-geocomputation-raster-vector-evidence",
  "geo-s2-geopython-reproducible-analysis",
  "geo-s2-geemap-remote-sensing-workflow",
  "geo-s2-leafmap-interactive-layer-scale",
  "geo-s3-food-systems-resource-resilience",
  "geo-s3-faostat-definition-time-series",
  "geo-s3-geospatial-reproducibility-attribution",
]);
const REQUIRED_V15_SOURCES = new Set([
  "web-nasa-earth-energy-budget",
  "web-world-bank-migration",
  "web-world-bank-transport",
  "web-owid-urbanization",
  "github-cielo-geoscience-k12",
  "github-ghist-high-school-geology",
  "github-transport-geography-resources",
  "github-biogeo-secondary-education",
]);
const REQUIRED_V15_ITEMS = new Set([
  "geo-c1-earth-energy-budget-system",
  "geo-c1-eco-hydrology-soil-plant-atmosphere",
  "geo-c1-seismic-wave-and-earthquake-evidence",
  "geo-c2-migration-labor-mobility-and-region",
  "geo-c2-urbanization-rate-and-spatial-scale",
  "geo-c2-transport-infrastructure-and-regional-links",
  "geo-s1-earth-energy-budget-feedback-boundary",
  "geo-s1-eco-hydrology-evapotranspiration-evidence",
  "geo-s1-plate-tectonics-seismic-wave-interpretation",
  "geo-s2-transport-network-accessibility-indicator",
  "geo-s2-secondary-geography-course-problem-chain",
  "geo-s2-school-geology-map-and-field-evidence",
  "geo-s3-migration-development-resource-security",
  "geo-s3-urbanization-resource-environment-security",
  "geo-s3-geoscience-hazard-community-resilience",
]);
const REQUIRED_V16_SOURCES = new Set([
  "web-usgs-water-cycle",
  "web-usgs-groundwater",
  "web-usgs-earthquake-hazards",
  "web-unhabitat-world-cities-report",
  "web-unep-global-resources-outlook",
  "web-fao-biodiversity",
  "github-gis-oer-works",
  "github-apa-urban-planning-resources",
]);
const REQUIRED_V16_ITEMS = new Set([
  "geo-c1-water-cycle-pathway-and-runoff",
  "geo-c1-groundwater-recharge-and-landform",
  "geo-c1-earthquake-hazard-exposure-and-intensity",
  "geo-c2-urban-network-and-urban-rural-flow",
  "geo-c2-regional-industry-and-logistics-choice",
  "geo-c2-agricultural-landscape-and-biodiversity",
  "geo-s1-global-circulation-and-seasonal-precipitation",
  "geo-s1-karst-landscape-water-rock-interaction",
  "geo-s1-ecosystem-services-and-natural-geography-integrity",
  "geo-s2-urban-land-use-conflict-and-planning-scale",
  "geo-s2-gis-hazard-map-and-community-evidence",
  "geo-s2-regional-data-catalog-and-scale-traceability",
  "geo-s3-circular-resource-use-and-material-security",
  "geo-s3-biodiversity-ecosystem-services-and-food-security",
  "geo-s3-urban-resilience-and-equity-governance",
]);
const REQUIRED_V17_SOURCES = new Set([
  "web-usgs-landsat-missions",
  "web-usgs-volcano-hazards",
  "web-fao-forestry",
  "web-unesco-world-water-development",
  "web-unep-global-environment-outlook-7",
  "github-walkerke-education-map",
  "github-gdsl-teaching-links",
  "github-sshuair-awesome-gis",
]);
const REQUIRED_V17_ITEMS = new Set([
  "geo-c1-landsat-land-cover-change-evidence",
  "geo-c1-volcanic-risk-and-lava-landform",
  "geo-c1-forest-soil-water-cycle",
  "geo-c2-forest-products-and-rural-industry",
  "geo-c2-urban-water-supply-and-service",
  "geo-c2-education-map-and-local-place-evidence",
  "geo-s1-volcanic-plume-and-atmosphere",
  "geo-s1-forest-evapotranspiration-and-climate",
  "geo-s1-global-water-cycle-and-water-storage",
  "geo-s2-landsat-resolution-and-change-detection",
  "geo-s2-education-map-projection-and-scale",
  "geo-s2-gis-teaching-sequence-and-field-verification",
  "geo-s3-forest-carbon-and-land-security",
  "geo-s3-water-security-sdgs-and-equity",
  "geo-s3-environmental-outlook-and-policy-scenario",
]);
const REQUIRED_V18_SOURCES = new Set([
  "web-mee-2025-ecological-environment-bulletin",
  "web-mee-2023-marine-ecological-environment-bulletin",
  "web-mnr-natural-resources-bulletins",
  "web-mnr-south-china-sea-island-ecosystem",
  "web-cma-meteorological-data",
  "web-cma-satellite-remote-sensing",
  "github-felix-high-school-geography",
  "github-clck-shanghai-high-school-knowledge",
  "github-zero2geoquest",
]);
const REQUIRED_V18_EXTERNAL_SOURCES = new Set([
  "github-felix-high-school-geography",
  "github-clck-shanghai-high-school-knowledge",
  "github-zero2geoquest",
]);
const REQUIRED_V18_PUBLIC_WEB_SOURCES = new Set([
  "web-mee-2025-ecological-environment-bulletin",
  "web-mee-2023-marine-ecological-environment-bulletin",
  "web-mnr-natural-resources-bulletins",
  "web-mnr-south-china-sea-island-ecosystem",
  "web-cma-meteorological-data",
  "web-cma-satellite-remote-sensing",
]);
const REQUIRED_V18_ITEMS = new Set([
  "geo-c1-ecological-quality-indicator-reading",
  "geo-c1-meteorological-observation-and-weather-process",
  "geo-c1-high-school-natural-geography-knowledge-map",
  "geo-c2-natural-resources-statistical-comparison",
  "geo-c2-world-region-human-geography-knowledge-map",
  "geo-c2-textbook-outline-and-regional-case",
  "geo-s1-marine-ecosystem-and-sea-air-process",
  "geo-s1-satellite-observation-and-atmospheric-process",
  "geo-s1-natural-geography-knowledge-index",
  "geo-s2-island-ecosystem-monitoring-and-spatial-protection",
  "geo-s2-map-quest-and-spatial-reasoning",
  "geo-s2-regional-development-textbook-comparison",
  "geo-s3-ecological-quality-and-environmental-security",
  "geo-s3-marine-ecosystem-status-and-governance",
  "geo-s3-natural-resource-bulletin-and-security-indicators",
]);
const REQUIRED_V19_SOURCES = new Set([
  "web-tianditu-national-geospatial-platform",
  "web-nbs-national-statistical-yearbook",
  "web-nbs-2022-statistical-bulletin",
  "web-china-earthquake-data-center",
  "web-national-forestry-grassland-administration",
  "github-global-circulation-simulator",
  "github-satv-geography-tool",
]);
const REQUIRED_V19_EXTERNAL_SOURCES = new Set([
  "github-global-circulation-simulator",
  "github-satv-geography-tool",
]);
const REQUIRED_V19_PUBLIC_WEB_SOURCES = new Set([
  "web-tianditu-national-geospatial-platform",
  "web-nbs-national-statistical-yearbook",
  "web-nbs-2022-statistical-bulletin",
  "web-china-earthquake-data-center",
  "web-national-forestry-grassland-administration",
]);
const REQUIRED_V19_ITEMS = new Set([
  "geo-c1-national-geospatial-platform-map-scale",
  "geo-c1-earthquake-catalogue-risk-evidence",
  "geo-c1-forest-ecosystem-water-regulation",
  "geo-c2-population-census-structure-and-demand",
  "geo-c2-urbanization-statistical-indicator-chain",
  "geo-c2-transport-and-regional-connectivity-indicators",
  "geo-s1-global-circulation-seasonal-shift-model",
  "geo-s1-solar-altitude-time-zone-cross-check",
  "geo-s1-earthquake-plate-boundary-process",
  "geo-s2-tianditu-layer-scale-and-regional-planning",
  "geo-s2-forest-restoration-spatial-evidence",
  "geo-s2-circulation-model-and-monsoon-regional-case",
  "geo-s3-forest-resource-security-and-ecosystem-services",
  "geo-s3-statistical-bulletin-resource-environment-indicators",
  "geo-s3-earthquake-disaster-risk-and-resilience",
]);
const REQUIRED_V20_SOURCES = new Set([
  "web-moa-agriculture-rural-development",
  "web-mee-environmental-monitoring",
  "web-mnr-natural-resources-data",
  "web-unesco-global-geoparks",
  "web-wmo-weather",
  "web-cma-weather-climate-observation",
  "github-sems-sun-earth-moon-geography",
  "exam-guigang-2026-02-geography",
]);
const REQUIRED_V20_EXTERNAL_SOURCES = new Set([
  "github-sems-sun-earth-moon-geography",
]);
const REQUIRED_V20_PUBLIC_WEB_SOURCES = new Set([
  "web-moa-agriculture-rural-development",
  "web-mee-environmental-monitoring",
  "web-mnr-natural-resources-data",
  "web-unesco-global-geoparks",
  "web-wmo-weather",
  "web-cma-weather-climate-observation",
]);
const REQUIRED_V20_ITEMS = new Set([
  "geo-c1-permafrost-activity-layer-water-cycle",
  "geo-c1-pm10-sand-dust-and-cold-air-observation",
  "geo-c1-geopark-fieldwork-and-geological-process",
  "geo-c2-mining-town-industrial-heritage-transition",
  "geo-c2-agricultural-rural-resource-base",
  "geo-c2-rural-revitalization-and-land-use-evidence",
  "geo-s1-upwelling-seasonality-and-walker-circulation",
  "geo-s1-sun-earth-moon-observation-model",
  "geo-s1-weather-climate-observation-source-selection",
  "geo-s2-geopark-conservation-and-regional-tourism",
  "geo-s2-environmental-monitoring-indicator-chain",
  "geo-s2-natural-resources-data-and-land-use-planning",
  "geo-s3-agricultural-resource-security-and-food-system",
  "geo-s3-environmental-monitoring-and-pollution-risk",
  "geo-s3-weather-warning-and-climate-risk-governance",
]);
const REQUIRED_V21_SOURCES = new Set([
  "web-cgs-geological-survey",
  "web-mot-transport-geography-data",
  "web-nea-energy-security-information",
  "web-nmdis-marine-information",
  "web-geodata-earth-system-data",
  "github-lmec-map-education-collections",
  "github-qgis-lesson-geography",
  "github-tactile-map-generator",
]);
const REQUIRED_V21_EXTERNAL_SOURCES = new Set([
  "github-lmec-map-education-collections",
  "github-qgis-lesson-geography",
  "github-tactile-map-generator",
]);
const REQUIRED_V21_PUBLIC_WEB_SOURCES = new Set([
  "web-cgs-geological-survey",
  "web-mot-transport-geography-data",
  "web-nea-energy-security-information",
  "web-nmdis-marine-information",
  "web-geodata-earth-system-data",
]);
const REQUIRED_V21_ITEMS = new Set([
  "geo-c1-river-basin-water-resource-observation",
  "geo-c1-geological-survey-map-and-landform-evidence",
  "geo-c1-tactile-map-scale-and-spatial-orientation",
  "geo-c2-transport-corridor-and-accessibility",
  "geo-c2-energy-industry-location-and-transition",
  "geo-c2-historical-map-and-regional-change",
  "geo-s1-river-basin-process-and-runoff-seasonality",
  "geo-s1-geological-map-and-plate-process-evidence",
  "geo-s1-marine-observation-and-coastal-change",
  "geo-s2-national-geospatial-data-and-regional-planning",
  "geo-s2-qgis-layer-overlay-and-field-verification",
  "geo-s2-map-education-collection-and-scale-comparison",
  "geo-s3-energy-security-and-low-carbon-transition",
  "geo-s3-marine-data-and-coastal-resource-governance",
  "geo-s3-accessible-mapping-and-spatial-inclusion",
]);
const REQUIRED_V22_SOURCES = new Set([
  "web-qgis-training-manual",
  "web-arcgis-learn-geography",
  "web-nasa-worldview-earth-observation",
  "web-protected-planet-conservation-data",
  "github-qgis-training-data",
  "github-qgis-documentation",
  "github-spatialthoughts-open-courseware",
  "github-geography-teaching-tools",
  "github-geography-teaching-plugin",
]);
const REQUIRED_V22_EXTERNAL_SOURCES = new Set([
  "github-qgis-training-data",
  "github-qgis-documentation",
  "github-spatialthoughts-open-courseware",
  "github-geography-teaching-tools",
  "github-geography-teaching-plugin",
]);
const REQUIRED_V22_PUBLIC_WEB_SOURCES = new Set([
  "web-qgis-training-manual",
  "web-arcgis-learn-geography",
  "web-nasa-worldview-earth-observation",
  "web-protected-planet-conservation-data",
]);
const REQUIRED_V22_ITEMS = new Set([
  "geo-c1-qgis-training-data-and-relief-reading",
  "geo-c1-satellite-time-series-land-cover-observation",
  "geo-c1-atmospheric-circulation-interactive-model",
  "geo-c2-open-map-place-and-service-accessibility",
  "geo-c2-spatial-visualization-and-regional-comparison",
  "geo-c2-teacher-dataset-and-local-field-evidence",
  "geo-s1-raster-vector-and-natural-process-scale",
  "geo-s1-protected-area-ecosystem-and-natural-integrity",
  "geo-s1-satellite-weather-and-hazard-timeline",
  "geo-s2-qgis-coordinate-reference-and-overlay",
  "geo-s2-spatial-analysis-and-regional-planning",
  "geo-s2-open-courseware-data-workflow",
  "geo-s3-protected-area-governance-and-connectivity",
  "geo-s3-geography-teaching-tools-and-resource-security",
  "geo-s3-disaster-risk-map-and-inclusive-decision",
]);
const REQUIRED_V23_SOURCES = new Set([
  "github-onicio-geodeck",
  "github-nocci-high-school-geography",
  "github-alexjohnj-geographyas",
  "github-spatialthoughts-qgis-tutorials",
  "github-opengeos-pygis",
]);
const REQUIRED_V23_EXTERNAL_SOURCES = new Set([
  "github-onicio-geodeck",
  "github-nocci-high-school-geography",
  "github-alexjohnj-geographyas",
  "github-spatialthoughts-qgis-tutorials",
  "github-opengeos-pygis",
]);
const REQUIRED_V23_ITEMS = new Set([
  "geo-c1-absolute-distance-direction-map-reading",
  "geo-c1-elevation-isoline-evidence",
  "geo-c1-revision-process-chain-and-scale",
  "geo-c2-cartogram-statistical-space",
  "geo-c2-europe-north-america-regional-comparison",
  "geo-c2-case-study-evidence-chain",
  "geo-s1-map-projection-distortion-purpose",
  "geo-s1-physical-region-map-compare",
  "geo-s1-climate-case-evidence-and-uncertainty",
  "geo-s2-thematic-map-symbol-selection",
  "geo-s2-qgis-tutorial-task-sequence",
  "geo-s2-geospatial-environment-reproducibility",
  "geo-s3-map-design-and-environmental-equity",
  "geo-s3-resource-environment-case-review",
  "geo-s3-data-license-and-provenance-boundary",
]);
const REQUIRED_V24_SOURCES = new Set([
  "web-globe-program-clouds-api",
  "github-ruddro-globe-cloud-insights",
  "github-ccosse-colormyworld",
  "github-ayushishukla-geography",
  "github-bhagyashree-geography-lesson-plans",
  "github-osgeo-geospatial-education",
]);
const REQUIRED_V24_EXTERNAL_SOURCES = new Set([
  "github-ruddro-globe-cloud-insights",
  "github-ccosse-colormyworld",
  "github-ayushishukla-geography",
  "github-bhagyashree-geography-lesson-plans",
  "github-osgeo-geospatial-education",
]);
const REQUIRED_V24_PUBLIC_WEB_SOURCES = new Set([
  "web-globe-program-clouds-api",
]);
const REQUIRED_V24_ITEMS = new Set([
  "geo-c1-cloud-observation-and-weather-evidence",
  "geo-c1-field-observation-sampling-and-bias",
  "geo-c1-landform-climate-gis-learning-path",
  "geo-c2-geography-scavenger-hunt-place-clues",
  "geo-c2-map-color-and-data-meaning",
  "geo-c2-lesson-plan-from-place-to-region",
  "geo-s1-cloud-cover-and-radiation-observation",
  "geo-s1-ground-observation-satellite-match",
  "geo-s1-landform-climate-gis-concept-integration",
  "geo-s2-citizen-science-spatial-sampling",
  "geo-s2-open-source-geospatial-education-stack",
  "geo-s2-map-color-classification-and-legend",
  "geo-s3-cloud-data-and-climate-risk-boundary",
  "geo-s3-citizen-observation-ethics-and-location-privacy",
  "geo-s3-open-geospatial-governance-and-resource-security",
]);
const REQUIRED_V25_SOURCES = new Set([
  "github-yuta-edu-3d-terrain",
  "github-vrautenbach-isprs-catalogue",
  "github-yujinnee-worldhunter",
  "github-mukombradon-globeguesser",
  "github-gisphere-kg-chatbot",
  "web-noaa-education-resource-collections",
]);
const REQUIRED_V25_EXTERNAL_SOURCES = new Set([
  "github-yuta-edu-3d-terrain",
  "github-vrautenbach-isprs-catalogue",
  "github-yujinnee-worldhunter",
  "github-mukombradon-globeguesser",
  "github-gisphere-kg-chatbot",
]);
const REQUIRED_V25_PUBLIC_WEB_SOURCES = new Set([
  "web-noaa-education-resource-collections",
]);
const REQUIRED_V25_ITEMS = new Set([
  "geo-c1-terrain-relief-and-vertical-exaggeration",
  "geo-c1-3d-model-viewpoint-and-scale",
  "geo-c1-ocean-weather-resource-collection",
  "geo-c2-continent-country-neighbor-clues",
  "geo-c2-global-flag-information-and-regional-hierarchy",
  "geo-c2-geography-resource-catalogue-metadata",
  "geo-s1-terrain-dem-map-layer-and-attribution",
  "geo-s1-ocean-atmosphere-resource-path",
  "geo-s1-terrain-viewpoint-and-landform-evidence",
  "geo-s2-geospatial-resource-catalogue-and-reproducibility",
  "geo-s2-knowledge-graph-entity-relation-region",
  "geo-s2-country-region-spatial-comparison-game",
  "geo-s3-ocean-climate-resource-evidence",
  "geo-s3-geospatial-data-standardization-and-provenance",
  "geo-s3-geography-game-data-scope-and-fairness",
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
for (const sourceId of REQUIRED_V12_SOURCES) {
  assert.equal(sourceIds.has(sourceId), true, `missing v12 geography source ${sourceId}`);
}
for (const sourceId of REQUIRED_V13_SOURCES) {
  assert.equal(sourceIds.has(sourceId), true, `missing v13 geography source ${sourceId}`);
}
for (const sourceId of REQUIRED_V14_SOURCES) {
  assert.equal(sourceIds.has(sourceId), true, `missing v14 geography source ${sourceId}`);
}
for (const sourceId of REQUIRED_V15_SOURCES) {
  assert.equal(sourceIds.has(sourceId), true, `missing v15 geography source ${sourceId}`);
}
for (const sourceId of REQUIRED_V16_SOURCES) {
  assert.equal(sourceIds.has(sourceId), true, `missing v16 geography source ${sourceId}`);
}
for (const sourceId of REQUIRED_V17_SOURCES) {
  assert.equal(sourceIds.has(sourceId), true, `missing v17 geography source ${sourceId}`);
}
for (const sourceId of REQUIRED_V18_SOURCES) {
  assert.equal(sourceIds.has(sourceId), true, `missing v18 geography source ${sourceId}`);
}
for (const sourceId of REQUIRED_V19_SOURCES) {
  assert.equal(sourceIds.has(sourceId), true, `missing v19 geography source ${sourceId}`);
}
for (const sourceId of REQUIRED_V20_SOURCES) {
  assert.equal(sourceIds.has(sourceId), true, `missing v20 geography source ${sourceId}`);
}
for (const sourceId of REQUIRED_V21_SOURCES) {
  assert.equal(sourceIds.has(sourceId), true, `missing v21 geography source ${sourceId}`);
}
for (const sourceId of REQUIRED_V22_SOURCES) {
  assert.equal(sourceIds.has(sourceId), true, `missing v22 geography source ${sourceId}`);
}
for (const sourceId of REQUIRED_V23_SOURCES) {
  assert.equal(sourceIds.has(sourceId), true, `missing v23 geography source ${sourceId}`);
}
for (const sourceId of REQUIRED_V24_SOURCES) {
  assert.equal(sourceIds.has(sourceId), true, `missing v24 geography source ${sourceId}`);
}
for (const sourceId of REQUIRED_V25_SOURCES) {
  assert.equal(sourceIds.has(sourceId), true, `missing v25 geography source ${sourceId}`);
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
for (const source of payload.sources.filter((item) => REQUIRED_V18_EXTERNAL_SOURCES.has(item.id))) {
  assert.match(String(source.url), /^https:\/\//, `${source.id} must retain a public source URL`);
  assert.match(String(source.commitSha), /^[a-f0-9]{40}$/i, `${source.id} must retain an immutable commit SHA`);
  assert.match(String(source.accessedAt), /^2026-08-23$/, `${source.id} must retain an access date`);
}
for (const source of payload.sources.filter((item) => REQUIRED_V18_PUBLIC_WEB_SOURCES.has(item.id))) {
  assert.match(String(source.url), /^https:\/\//, `${source.id} must retain a public source URL`);
  assert.match(String(source.accessedAt), /^2026-08-23$/, `${source.id} must retain an access date`);
}
for (const source of payload.sources.filter((item) => REQUIRED_V19_EXTERNAL_SOURCES.has(item.id))) {
  assert.match(String(source.url), /^https:\/\//, `${source.id} must retain a public source URL`);
  assert.match(String(source.commitSha), /^[a-f0-9]{40}$/i, `${source.id} must retain an immutable commit SHA`);
  assert.match(String(source.accessedAt), /^2026-08-23$/, `${source.id} must retain an access date`);
}
for (const source of payload.sources.filter((item) => REQUIRED_V19_PUBLIC_WEB_SOURCES.has(item.id))) {
  assert.match(String(source.url), /^https:\/\//, `${source.id} must retain a public source URL`);
  assert.match(String(source.accessedAt), /^2026-08-23$/, `${source.id} must retain an access date`);
}
for (const source of payload.sources.filter((item) => REQUIRED_V20_EXTERNAL_SOURCES.has(item.id))) {
  assert.match(String(source.url), /^https:\/\//, `${source.id} must retain a public source URL`);
  assert.match(String(source.commitSha), /^[a-f0-9]{40}$/i, `${source.id} must retain an immutable commit SHA`);
  assert.match(String(source.accessedAt), /^2026-08-23$/, `${source.id} must retain an access date`);
}
for (const source of payload.sources.filter((item) => REQUIRED_V20_PUBLIC_WEB_SOURCES.has(item.id))) {
  assert.match(String(source.url), /^https:\/\//, `${source.id} must retain a public source URL`);
  assert.match(String(source.accessedAt), /^2026-08-23$/, `${source.id} must retain an access date`);
}
for (const source of payload.sources.filter((item) => REQUIRED_V21_EXTERNAL_SOURCES.has(item.id))) {
  assert.match(String(source.url), /^https:\/\//, `${source.id} must retain a public source URL`);
  assert.match(String(source.commitSha), /^[a-f0-9]{40}$/i, `${source.id} must retain an immutable commit SHA`);
  assert.match(String(source.accessedAt), /^2026-08-23$/, `${source.id} must retain an access date`);
}
for (const source of payload.sources.filter((item) => REQUIRED_V21_PUBLIC_WEB_SOURCES.has(item.id))) {
  assert.match(String(source.url), /^https:\/\//, `${source.id} must retain a public source URL`);
  assert.match(String(source.accessedAt), /^2026-08-23$/, `${source.id} must retain an access date`);
}
for (const source of payload.sources.filter((item) => REQUIRED_V22_EXTERNAL_SOURCES.has(item.id))) {
  assert.match(String(source.url), /^https:\/\//, `${source.id} must retain a public source URL`);
  assert.match(String(source.commitSha), /^[a-f0-9]{40}$/i, `${source.id} must retain an immutable commit SHA`);
  assert.match(String(source.accessedAt), /^2026-08-23$/, `${source.id} must retain an access date`);
}
for (const source of payload.sources.filter((item) => REQUIRED_V22_PUBLIC_WEB_SOURCES.has(item.id))) {
  assert.match(String(source.url), /^https:\/\//, `${source.id} must retain a public source URL`);
  assert.match(String(source.accessedAt), /^2026-08-23$/, `${source.id} must retain an access date`);
}
for (const source of payload.sources.filter((item) => REQUIRED_V23_EXTERNAL_SOURCES.has(item.id))) {
  assert.match(String(source.url), /^https:\/\//, `${source.id} must retain a public source URL`);
  assert.match(String(source.commitSha), /^[a-f0-9]{40}$/i, `${source.id} must retain an immutable commit SHA`);
  assert.match(String(source.accessedAt), /^2026-08-23$/, `${source.id} must retain an access date`);
}
for (const source of payload.sources.filter((item) => REQUIRED_V24_EXTERNAL_SOURCES.has(item.id))) {
  assert.match(String(source.url), /^https:\/\//, `${source.id} must retain a public source URL`);
  assert.match(String(source.commitSha), /^[a-f0-9]{40}$/i, `${source.id} must retain an immutable commit SHA`);
  assert.match(String(source.accessedAt), /^2026-08-23$/, `${source.id} must retain an access date`);
}
for (const source of payload.sources.filter((item) => REQUIRED_V24_PUBLIC_WEB_SOURCES.has(item.id))) {
  assert.match(String(source.url), /^https:\/\//, `${source.id} must retain a public source URL`);
  assert.match(String(source.accessedAt), /^2026-08-23$/, `${source.id} must retain an access date`);
}
for (const source of payload.sources.filter((item) => REQUIRED_V25_EXTERNAL_SOURCES.has(item.id))) {
  assert.match(String(source.url), /^https:\/\//, `${source.id} must retain a public source URL`);
  assert.match(String(source.commitSha), /^[a-f0-9]{40}$/i, `${source.id} must retain an immutable commit SHA`);
  assert.match(String(source.accessedAt), /^2026-08-23$/, `${source.id} must retain an access date`);
}
for (const source of payload.sources.filter((item) => REQUIRED_V25_PUBLIC_WEB_SOURCES.has(item.id))) {
  assert.match(String(source.url), /^https:\/\//, `${source.id} must retain a public source URL`);
  assert.match(String(source.accessedAt), /^2026-08-23$/, `${source.id} must retain an access date`);
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
      /第?\s*\d+\s*页|章节|教材|第一章|第二章|第三章|第四章|第一节|第二节|第三节|第四节|项目描述|README|data\/|pages\/|docs\/|gallery|ontology|RDF|geography\.html|earthmotion|src\/curriculum|01高中世界地理|高中地理考点重点复习|Tides|Remote Sensing|Ocean Acidification|pH|pixels|vector vs raster|El Niño|ENSO|Water Cycle|World of Change|JetStream|Copernicus|Sentinel|Global Soil Partnership|soil|AtlasGPT|terrain-explorer|GeoPandas|Raster Data|GIS Programming|sun-motion|SunMotion|Sun-Earth-Moon|index\.html|GeoWiki|K-12|GeoFest|No_License|Tornadoes|Hurricanes|National Hurricane Center|Climate change impacts|Urbanization|Urban Planning|Population Density|Plate Tectonics|Migration|IPCC|Farming and Agribusiness|Water Use and Stress|WMO|Climate|Carbon Cycle|carbon|land-water|water scarcity|competing uses|weather|Weather|weather observations|agriculture|agricultural|rural development|food production|environmental monitoring|natural resources data|spatial planning|resources|environment|geography curriculum|NOAA|EIA|FAO|UNESCO|Global Geoparks|BGS|World Bank|geological|geological survey|hazard|urbanization|infrastructure|inclusion|resilience|water services|governance|ocean system|stewardship|disaster risk|exposure|vulnerability|preparedness|recovery|EnergyBalance|energy|power-system|geospatial data|data center|High_School|Secondary Education|niveles\.html|recursos\.html|Transport|USGS|UN-Habitat|UNEP|Biodiversity|Global Resources|GIS OER|APA Technology|ArcGIS|QGIS|Protected Planet|Worldview|Spatial Thoughts|Training Data|QGIS Documentation|Geography Teaching Tools|GLOBE|cloud|Clouds|Scavenger Hunt|landforms|lesson plans|OSGeo|citizen science|location privacy|terrain|raster-dem|起伏|视点|ISPRS|Firestore|metadata|WorldHunter|GlobeGuesser|flag|continent|neighboring|GISphere|knowledge graph|geographic locations|semantic similarity|resource collections|Ocean and coasts|Weather and atmosphere|Freshwater|公报|自然资源|气象|风云|卫星|地理信息技术|区域研究|meteorological|satellite|marine|island|coral|ecosystem|天地图|统计|地震|森林|环流|季风|太阳高度角|地方时|Tianditu|earthquake|forest|forestry|circulation|monsoon|time zone|solar altitude|SATV|Solar System|NASA Science|Sun:|Geologic Time|Ocean Currents|UNFPA|MAB|太阳科学|太阳系|地质年代|人口情景|人口指标|人与生物圈/,
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
for (const itemId of REQUIRED_V12_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing v12 geography item ${itemId}`);
}
for (const itemId of REQUIRED_V13_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing v13 geography item ${itemId}`);
}
for (const itemId of REQUIRED_V14_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing v14 geography item ${itemId}`);
}
for (const itemId of REQUIRED_V15_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing v15 geography item ${itemId}`);
}
for (const itemId of REQUIRED_V16_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing v16 geography item ${itemId}`);
}
for (const itemId of REQUIRED_V17_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing v17 geography item ${itemId}`);
}
for (const itemId of REQUIRED_V18_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing v18 geography item ${itemId}`);
}
for (const itemId of REQUIRED_V19_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing v19 geography item ${itemId}`);
}
for (const itemId of REQUIRED_V20_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing v20 geography item ${itemId}`);
}
for (const itemId of REQUIRED_V21_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing v21 geography item ${itemId}`);
}
for (const itemId of REQUIRED_V22_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing v22 geography item ${itemId}`);
}
for (const itemId of REQUIRED_V23_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing v23 geography item ${itemId}`);
}
for (const itemId of REQUIRED_V24_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing v24 geography item ${itemId}`);
}
for (const itemId of REQUIRED_V25_ITEMS) {
  assert.equal(itemIds.has(itemId), true, `missing v25 geography item ${itemId}`);
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
