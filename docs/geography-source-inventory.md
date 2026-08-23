# 高中地理来源清单与发布边界

盘点日期：2026-08-24；扩展轮次：geo-2026.08.24.39

本清单服务于 `data/geography/knowledge.json`。公开站点只发布原创学习摘要、关键词、课程归属和可回到教材核对的页码证据，不复制教材正文、插图、版式或整章内容。

当前发布版本 `geo-2026.08.24.39`：271 个来源、605 条卡片，其中 38 条 `authored-summary`、567 条 `citation-only`；五个课程族分别为 112、122、127、120、124 条。本轮新增 5 个 GitHub 地理实地调查、历史地图、人口密度与学校可达性项目、3 个公开地理空间/人口数据入口，以及 15 条原创 `citation-only` 方法卡，继续补齐实地调查误差、历史地图比较、人口密度口径、学校公共服务可达性、迁移地图伦理、国家地理空间图层和资源环境公平等专题。

本轮累计新增 271 条 citation-only 方法卡：在上一轮 256 条的基础上，本轮继续从当前机器可读取的五册人民教育出版社教材 PDF 提取目录和章节锚点，并吸收新的 GitHub 地理教育/地理空间项目与公开人口、地理空间数据入口。`/Volumes/mac_2T` 当前不可读取，本轮没有声称已吸收其他机器材料；`Downloads/地理书` 的教材文件只用于本地课程结构核对，不复制教材正文。站点发布的是重新组织后的学习方法，不是原题、答案、解析或竞赛知识点清单。


## geo-2026.08.24.39 新增公开来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `github-isr-field-app` | [ISR Field：地理实地调查与空间数据管理应用](https://github.com/isr-oeaw/isr-field-app) | commit `95ffd7095883ba851ceb4c5a80390b171b1645ce`；访问日期 2026-08-24 | 参照实地调查、空间点记录、CSV、交互地图和审计字段；不复制代码、数据库或用户数据。 |
| `github-family-history-migration-map` | [Family History Migration Map：高中生家庭迁移与地方文化地图](https://github.com/gamzeulu/family-history-migration-map) | commit `1ac747b74af36c146d77111e28b9b2be7f6724e9`；访问日期 2026-08-24 | 参照学生迁移地图、地方文化和个人叙事边界；不复制页面、个人信息、数据或图表。 |
| `github-wettstein-schulatlas-zurich` | [Schul-Atlas von Wettstein：1887 年中学地理学校地图集](https://github.com/d33pk3rn3l/1887-wettstein-schulatlas-zurich) | commit `4b310545ad7eeb4de4fedd8e24b2dcd9b58a798c`；访问日期 2026-08-24 | 参照历史地图、景观记录和地图教育；不复制 PDF、图版或图片。 |
| `github-everest-maps` | [Everest Maps：学校地理课人口密度地图实践](https://github.com/amahjo/Everest-maps) | commit `70f7ce0de7d5e41c14e5a4f45e157b222ec06a22`；访问日期 2026-08-24 | 参照人口密度面积归一化、对数色阶和跨区域比较；不复制代码、图表或数据。 |
| `github-geospatial-school-mapping` | [Geospatial School Mapping：学校空间分布与可达性地图](https://github.com/alphacrypto246/Geospatial-School-Mapping) | commit `fdb20ee2624487abe613c2b6beccaca19eac6f6c`；访问日期 2026-08-24 | 参照学校点位、可达性、服务不足区域和空间规划；不复制代码、数据或地图。 |
| `web-national-archives-education` | [The National Archives：Education and Outreach](https://www.nationalarchives.gov.uk/education/) | 公共教育入口；访问日期 2026-08-24 | 参照历史档案、地图资料、来源批判和课堂探究；不复制档案图像或课程材料。 |
| `web-owid-population-density` | [Our World in Data：Population Density](https://ourworldindata.org/grapher/population-density) | 公共数据图入口；访问日期 2026-08-24 | 参照人口密度归一化指标、时间序列和数据定义；不复制图表或数据转储。 |
| `web-un-geospatial` | [United Nations Geospatial：地理空间与位置数据入口](https://www.un.org/geospatial/) | 公共地理空间入口；访问日期 2026-08-24 | 参照位置数据、地图服务、空间信息协调和区域规划治理；不复制地图、数据或页面内容。 |

本轮新增 15 条原创 `citation-only` 方法卡，每门课程族 3 条。所有卡片均保留人民教育出版社教材证据；新来源只用于实地调查、历史地图、人口密度、学校可达性、迁移地图伦理、地理空间图层和资源环境公平的方法边界交叉核对，不把第三方题目、答案、代码、地图、数据或页面文字并入站点。

## geo-2026.08.24.38 新增公开来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `github-deephydro-gisrs` | [GISRS：地理信息系统与遥感应用课程资源](https://github.com/DeepHydro/GISRS) | commit `e5d6fa243a91c7d8e17dbf3b85615ed2d97ad88e`；GPL-3.0；访问日期 2026-08-24 | 参照 GIS/遥感课程结构、空间分析和观测流程；不复制代码、课件、数据、图像或页面文字。 |
| `github-cumt-gis` | [CUMT-GIS：地理信息科学课程资料整理](https://github.com/lovelydayss/CUMT-GIS) | commit `76a57dd8c308a1d0668602074d22898a241361eb`；未声明统一许可证；访问日期 2026-08-24 | 参照 GIS、数据库设计、GNSS、测量平差和软件实践模块；不复制源码、报告、数据或页面文字。 |
| `github-geovisualization-tutorial` | [Geovisualization Tutorial：地理数据可视化实践教程](https://github.com/sshuair/Geovisualization-Tutorial) | commit `576762f83f1edb26a786f315b41f8a0e31e7cc3e`；未声明统一许可证；访问日期 2026-08-24 | 参照专题地图、投影、符号化和地图叙事；不复制幻灯片、素材、案例地图或页面文字。 |
| `github-spatialdb-nnu` | [SpatialDB_NNU：空间数据库实验手册](https://github.com/solidjerryc/SpatialDB_NNU) | commit `d5379cc4f8434a9528bb4ceafe2720845fbebf83`；未声明统一许可证；访问日期 2026-08-24 | 参照空间查询、属性—空间联合证据和数据安全；不复制实验手册、SQL、数据或页面文字。 |
| `github-gis-rs-2024fall` | [2024Fall GIS&RS：GIS 与遥感课程资料包](https://github.com/es-palloc/GIS-RS-2024Fall) | commit `ce360267826bdf8e9037ac0a4db5a4df1eb91374`；MIT（第三方材料仍需分别核验）；访问日期 2026-08-24 | 参照 GIS/遥感任务分解、图表表达和报告复核；不复制教程、作业、图表、代码或数据。 |
| `web-openstreetmap-map-features` | [OpenStreetMap Wiki：Map features](https://wiki.openstreetmap.org/wiki/Map_features) | 公共 Wiki 入口；访问日期 2026-08-24 | 参照点、线、面要素、属性标签和开放地图归因；不复制页面文字、地图数据或图件。 |
| `web-us-census-geographic-areas` | [U.S. Census Bureau：Geographic Areas](https://www.census.gov/programs-surveys/geography/guidance/geo-areas.html) | 公共统计地理入口；访问日期 2026-08-24 | 参照统计单元定义、层级、边界和跨尺度人口比较；不复制数据、地图或页面正文。 |
| `web-usgs-national-map` | [USGS The National Map](https://www.usgs.gov/programs/national-geospatial-program/national-map) | 公共地理空间数据入口；访问日期 2026-08-24 | 参照高程、水系、交通、土地覆盖和基础地理图层的数据治理与更新边界；不复制数据、地图或页面内容。 |

本轮新增 15 条原创 `citation-only` 方法卡，每门课程族 3 条。所有卡片均保留人民教育出版社教材证据；新来源只用于专题地图设计、空间单元、产业—交通网络、空间数据库、可达性、GIS/遥感验证和资源环境数据治理的方法边界交叉核对，不把第三方题目、答案、代码、课程正文、地图、数据或页面文字并入站点。`/Volumes/mac_2T` 当前不可读取，本轮没有声称已吸收其他机器目录内容。

## geo-2026.08.24.37 新增公开来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `github-hocbigg-human-geography` | [Human Geography：开放式人文地理课程路径](https://github.com/hocbigg/human-geography) | commit `889f15761b3333abf8d24c92bdc5b61a132f2cb5`；CC BY-SA 4.0；访问日期 2026-08-24 | 参照人文地理基础、空间概念、研究方法、人口和区域系统的课程组织；不复制课程正文、书目、链接清单或页面文字。 |
| `github-giswqs-i-guide-geoai-education` | [I-GUIDE GeoAI Education：地理人工智能教学材料](https://github.com/giswqs/I-GUIDE-GeoAI-Education) | commit `114a5d687c5a4443cfa35926c40586a7c2c74d31`；MIT；访问日期 2026-08-24 | 参照 STAC 数据、训练数据、语义分割、变化检测、像元回归和结果验证；不复制 notebook、代码、数据、模型或图像。 |
| `github-carpentries-geospatial-python` | [Geospatial Python：栅格与矢量数据开放教学](https://github.com/carpentries-incubator/geospatial-python) | commit `36832e58858b808a95f89a03e025807f1c3c7854`；API 未声明统一 SPDX 许可证；访问日期 2026-08-24 | 参照栅格/矢量概念、地理数据工作坊、可复现实践和数据致谢；不复制课程正文、代码、数据或图表。 |
| `github-cielo-geoscience-lesson-plans-k12` | [CIELO-G：K–12 地球科学与遥感课例](https://github.com/CIELO-G/geoscience-lesson-plans-k12) | commit `a858f8bd212a588a624b9aaf2ce6202ae6a8250c`；未声明统一许可证；访问日期 2026-08-24 | 参照地球科学、地球物理、生态水文、遥感和社区参与课例；不复制课件、代码、图像、数据或活动正文。 |
| `web-nasa-learning-resources` | [NASA Learning Resources：地球与空间科学学习入口](https://www.nasa.gov/learning-resources/) | 公共学习资源入口；访问日期 2026-08-24 | 核对地球系统观测、模型、科学探究和学习活动的来源边界；不复制正文、图片、视频或活动材料。 |
| `web-national-geographic-gis` | [National Geographic Education：GIS 地理信息系统](https://education.nationalgeographic.org/resource/geographic-information-system-gis/) | 公共教育条目；访问日期 2026-08-24 | 核对 GIS 图层、空间问题、空间分析和地图表达；不复制页面正文或图件。 |
| `web-osgeo-geo-for-all` | [OSGeo Geo for All：开放地理空间教育网络](https://www.osgeo.org/initiatives/geo-for-all/) | 公共社区与教育入口；访问日期 2026-08-24 | 核对开放 GIS、空间思维、教育公平和可复现工具链；不复制课程、代码、图件或页面文字。 |
| `web-nps-geology-education` | [National Park Service：Geology 地质教育入口](https://www.nps.gov/subjects/geology/index.htm) | 公共地质教育入口；访问日期 2026-08-24 | 核对地质过程、地貌观察、保护地和现场证据；不复制正文、图片或案例。 |

本轮新增 15 条原创 `citation-only` 方法卡，每门课程族 3 条。所有卡片均保留人民教育出版社教材证据；新 GitHub 项目和公开教育入口只用于人文地理、地质观察、GeoAI/GIS、地球科学教育和资源环境决策的方法边界交叉核对，不把第三方题目、答案、代码、课程正文、地图、数据或页面文字并入站点。`/Volumes/mac_2T` 仍不可读取，本轮没有声称吸收其他机器目录内容。

## geo-2026.08.24.36 新增公开来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `github-junyilee7-geography-ai-teaching` | [Geography AI Teaching：地理与水文可复现教学笔记](https://github.com/junyilee7/geography-ai-teaching) | commit `48076c91943bf52d614a69ceae90a565595bb522`；MIT；访问日期 2026-08-24 | 参照真实数据、可复现 notebook、模型解释和地理水文教学边界；不复制 notebook、代码、数据或图表。 |
| `github-wal33d-school-districts-api` | [US School Districts Service：学校行政区边界查询](https://github.com/Wal33D/us-school-districts-api) | commit `76e32482c58645aa86ac066b60b7996926a763c6`；MIT；访问日期 2026-08-24 | 参照学校行政区边界、空间索引、坐标查询和公共服务空间单元；不复制代码、数据库、边界文件或页面文字。 |
| `github-geomoer-remote-sensing` | [MOER Remote Sensing：物理地理遥感开放课程](https://github.com/GeoMOER/moer-mpg-remote-sensing) | commit `08db1cccd531a487749cda4b87855f5783a8412d`；CC BY-SA 4.0；访问日期 2026-08-24 | 参照遥感、物理地理、地表特征、自然保护和开放课程组织；不复制课程正文、代码、图片或数据。 |
| `github-leosolar-deforestation-detection` | [Satellite Deforestation Detection：卫星影像森林变化分析](https://github.com/LEOSOLAR8/Satellite-Deforestation-Detection) | commit `26689bf2983e8c250d6cebccfffd0daff6f220b4`；未声明统一许可证；访问日期 2026-08-24 | 参照植被分割、绿色覆盖率、多时相影像比较和生态监测边界；不复制代码、影像、输出图或页面文字。 |
| `web-wri-aqueduct-water-risk` | [WRI Aqueduct：全球水风险地图与情景工具](https://www.wri.org/aqueduct) | 公共工具入口；访问日期 2026-08-24 | 核对水风险指标、水资源稀缺、气候/增长情景和区域规划边界；不复制数据、地图或页面内容。 |
| `web-nasa-firms-active-fire` | [NASA FIRMS：全球主动火点与火灾监测](https://firms.modaps.eosdis.nasa.gov/) | 公共科学数据入口；访问日期 2026-08-24 | 核对 MODIS/VIIRS 主动火点、近实时观测、传感器和灾害监测边界；不复制数据、地图或页面资源。 |
| `web-noaa-sea-level-rise-viewer` | [NOAA Sea Level Rise Viewer：海平面上升与沿海淹没影响](https://coast.noaa.gov/slr/) | 公共海岸风险工具；访问日期 2026-08-24 | 核对海平面情景、低洼区、沿海暴露和适应规划边界；不复制地图、模型或数据。 |
| `web-un-sdg13-climate-action` | [United Nations SDG 13：气候行动与适应治理](https://sdgs.un.org/goals/goal13) | 联合国目标与指标入口；访问日期 2026-08-24 | 核对气候适应、减灾、教育、制度能力和治理指标链；不复制正文、数据或图表。 |

本轮新增 15 条原创 `citation-only` 方法卡，每门课程族 3 条。所有卡片均保留人民教育出版社教材证据；GitHub 项目和公共网站只用于水风险、火灾遥感、土壤观测、公共服务空间单元、森林变化、海平面情景和气候治理的方法边界交叉核对，不把第三方题目、答案、代码、地图、数据或页面文字并入站点。`/Volumes/mac_2T` 仍不可读取，本轮没有声称吸收其他机器目录内容。

## geo-2026.08.24.35 新增公开来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `github-yvki-secondary-geography-quiz` | [Secondary School Geography Quiz](https://github.com/yvki/quiz) | commit `db8f3174b18cd984a7d1822e1c13b9a4bd71afed`；MIT；访问日期 2026-08-24 | 参照中学地理概念练习、作答和反馈结构；不复制题目、答案、代码或页面文字。 |
| `github-jeanextreme-geography-game` | [Geography-Game](https://github.com/JeanExtreme002/Geography-Game) | commit `e8a2f19fa24468a80263ef7e55497bfd5ae298b2`；BSD-3-Clause；访问日期 2026-08-24 | 参照学校地理问答、地图线索和区域识别任务；不复制题目、代码、素材或页面文字。 |
| `github-felipe-access-to-education-map` | [Mapa do Ensino Médio](https://github.com/felipehlvo/access_to_education_map) | commit `b509c7f7cfb9ef3d1088c07c893ad194f515fc34`；未声明统一许可证；访问日期 2026-08-24 | 参照公立高中空间可达性、人口需求和公共服务公平；不复制代码、数据或地图。 |
| `github-poc-unesco-education-planning` | [UNESCO Hacking ED Planning / Athena](https://github.com/PoCInnovation/UNESCO-Hacking-ED-Planning) | commit `b52497e31ff77635be37338d00fe65a99004eb0c`；MIT；访问日期 2026-08-24 | 参照教育质量空间差异、文本指标与区域治理；不复制报告文本、数据、代码或地图。 |
| `github-romina-high-school-geography-quiz` | [AndroidQuiz](https://github.com/rominacarabathampi/AndroidQuiz) | commit `5d3440282e1cdf03cd3ae369828f22645bbe0ead`；未声明统一许可证；访问日期 2026-08-24 | 参照高中地理考试练习与即时反馈边界；不复制题目、答案、APK、代码或页面文字。 |
| `web-fao-global-forest-resources-assessment` | [FAO Global Forest Resources Assessment 2020](https://www.fao.org/interactive/forest-resources-assessment/2020/en/) | 公开互动评估入口；访问日期 2026-08-24 | 核对森林资源、碳储量、生物多样性与生态治理指标；不复制正文、图表或数据。 |
| `web-esa-climate-change-initiative` | [ESA Climate Change Initiative](https://climate.esa.int/en/) | 公开气候观测与数据记录入口；访问日期 2026-08-24 | 核对气候变量、长期观测记录、异常判读与观测—模型边界；不复制数据、图表或页面内容。 |

本轮 15 条卡片仍全部保留至少一条人民教育出版社五册教材证据和至少一条新增来源证据，课程分配为每门 3 条。GitHub 项目和公共科学入口只作结构、概念与数据边界的研究来源；公开层继续发布原创摘要，不把第三方题目、答案、代码、地图、数据或报告原文并入站点。`/Volumes/mac_2T` 仍不可读取，本轮没有声称吸收其他机器目录内容。

## geo-2026.08.23.34 新增公开来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `github-omu-musubouar-disaster-education` | [MUSUBOU-AR：防灾教育扩展现实应用](https://github.com/omu-geolab/musubouAR) | commit `d4528c459bf03fcbf19e14e1c08eda788ecc9332`；MIT；访问日期 2026-08-23 | 参照灾害图层、路线、AR 警示和防灾实地教育；不复制代码、素材、数据或页面文字。 |
| `github-earthai-earth-science-platform` | [EarthAi：地球科学与灾害韧性平台](https://github.com/Ethos2022/EarthAi) | commit `c312be45dd728aec0c6b77b2f461c19ba811fccd`；MIT；访问日期 2026-08-23 | 参照地球系统模型、地理智能、灾害韧性和教育边界；不复制代码、模型、数据或页面内容。 |
| `github-foss-geospatial-science-education` | [FOSS geospatial science education：开源地理空间教育](https://github.com/wenzeslaus/foss-in-geospatial-science-education) | commit `5d5a0faaa2ab1e8b1f18885f46c701dfa2036989`；CC BY-SA 4.0；访问日期 2026-08-23 | 参照开源工具、开放数据、归因和可复核教学流程；不复制演示文稿、图片、代码或正文。 |
| `github-gitenberg-commercial-geography-high-school` | [Commercial Geography：High Schools 历史教材](https://github.com/GITenberg/Commercial-GeographyA-Book-for-High-Schools-Commercial-Courses-and-Business-Colleges_24884) | commit `43bf9b196fbf5b81f646114b823293f0d24026ec`；Project Gutenberg 公共领域边界；访问日期 2026-08-23 | 参照历史商业地理、产业联系和供应链空间；不复制书稿、版式或原文。 |
| `web-iom-world-migration-report` | [IOM：World Migration Report 世界移民报告](https://worldmigrationreport.iom.int/) | 报告入口；访问日期 2026-08-23 | 核对迁移类型、驱动因素、数据口径、网络和区域联系；不复制正文、图表或数据。 |
| `web-unhabitat-urban-data` | [UN-Habitat Data：全球城市数据平台](https://data.unhabitat.org/) | 数据平台；访问日期 2026-08-23 | 核对城市指标、居住环境、基础设施、空间单元和空间公平；不复制数据表、图表或页面内容。 |
| `web-census-statistics-in-schools` | [U.S. Census Bureau：Statistics in Schools](https://www.census.gov/programs-surveys/sis.html) | 教育入口；访问日期 2026-08-23 | 核对人口普查、人口结构、统计图表和数据素养的课堂边界；不复制活动材料、图表或数据。 |
| `web-noaa-coastal-issues` | [NOAA Ocean Service：Coastal Issues](https://oceanservice.noaa.gov/education/tutorial_coastal_issues/welcome.html) | 海岸带教育入口；访问日期 2026-08-23 | 核对海岸过程、风暴潮、海平面变化、海岸风险、生态缓冲和治理选择；不复制正文、图片、活动或数据。 |

本轮新增 15 条原创 `citation-only` 方法卡，每门课程族 3 条。所有卡片均保留人民教育出版社教材证据；GitHub 项目和公共网站只用于概念、模型、统计、海岸过程与教学方法的交叉核对，不把第三方正文、题目、答案、代码、地图、模型、图表或数据并入站点。

## geo-2026.08.23.33 新增公开来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `github-ap-human-geography-textbook` | [AP Human Geography：高中人文地理智能教材](https://github.com/dmccreary/ap-human-geography) | commit `7652907ea71eeba431cb966082adaa3b4c91c33e`；访问日期 2026-08-23；未声明统一许可证 | 参照人口迁移、文化、政治、农业、城市和经济发展等高中人文地理单元；不复制正文、题目、图表、代码或页面文字。 |
| `github-world-regional-geography-textbook` | [World Regional Geography：世界区域地理在线教材](https://github.com/sounny/worldregionalgeography) | commit `67aefeb291ad8dacf40c223e02f674d771b101e0`；访问日期 2026-08-23；未声明统一许可证 | 参照世界区域组织、区域比较、尺度转换和案例回查；不复制教材正文、图表、代码或页面文字。 |
| `github-python-gis-book` | [Introduction to Python for Geographic Data Analysis](https://github.com/Python-GIS-book/site) | commit `ed1b78f7d9172c7cc647e67e8f95737faf89539c`；访问日期 2026-08-23；未声明统一许可证 | 参照栅格/矢量、空间分析、版本记录和可复现地理数据流程；不复制代码、数据、图表或章节正文。 |
| `web-un-world-population-prospects` | [United Nations：World Population Prospects](https://population.un.org/wpp/) | 页面访问日期 2026-08-23 | 核对人口规模、年龄结构、出生率、死亡率和人口情景的时间序列边界；不复制数据库、图表或报告正文。 |
| `web-copernicus-data-space` | [Copernicus Data Space Ecosystem](https://dataspace.copernicus.eu/) | 数据空间入口；访问日期 2026-08-23 | 核对 Sentinel、陆地/海洋/大气观测、产品尺度和处理链；不复制影像、数据或页面资源。 |
| `web-mem-emergency-science` | [应急管理部：防灾减灾救灾科普](https://www.mem.gov.cn/kp/) | 科普栏目；访问日期 2026-08-23 | 核对灾害识别、风险沟通、预警响应和应急治理；不复制正文、图片、图表或案例材料。 |
| `web-mohurd-urban-rural-development` | [住房和城乡建设部：城乡建设公开信息](https://www.mohurd.gov.cn/gongkai/) | 公开信息入口；访问日期 2026-08-23 | 核对城乡规划、基础设施、公共服务和建设治理；不复制政策原文、图表或数据。 |
| `web-cma-public-science` | [中国气象局：气象科普与观测知识](https://www.cma.gov.cn/kp/) | 科普入口；访问日期 2026-08-23 | 核对天气与气候、观测要素、时间尺度和气象服务证据；不复制正文、图表或数据。 |

本轮新增 15 条原创 `citation-only` 方法卡，每门课程族 3 条。联合国、Copernicus、中国应急管理、住房城乡建设和气象公开入口只用于指标、观测和治理方法边界核对；GitHub 项目只用于高中人文地理、世界区域比较和 GIS 数据流程参照。所有卡片仍保留人民教育出版社教材证据，不把第三方正文、题目、代码、地图、影像或数据表并入站点。

## geo-2026.08.23.32 新增公开 GitHub 来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `github-mapwork-board-geography` | [Project Naksha：交互式印度高中地图练习](https://github.com/pradumon14/Mapwork) | commit `38e00e852118b6798c76ca881d45e386ffffb95e`；Apache-2.0；访问日期 2026-08-23 | 参照地图实践、缩放平移、坐标校准、点位反馈和空间误差；不复制代码、地图、图标、题目或页面文字。 |
| `github-geojunior-interactive-geography` | [GeoJunior：互动地理问答学习应用](https://github.com/aarong21/geo-junior) | commit `867424338acb9cd387e8197fa83a8d050f0be4fd`；README 标明未提供许可证；访问日期 2026-08-23 | 参照互动问答、动态内容、异常输入校验和学习反馈流程；不复制题目、地名数据、代码、图片或页面文字。 |
| `github-geo-data-teaching` | [Geographic data：开放地理数据教学仓库](https://github.com/barguzin/geo_data) | commit `3dda4ffc44cc8c6fce4cefb0bf87213c429fd31e`；仓库未声明统一许可证；访问日期 2026-08-23 | 参照火灾边界、温度序列、点模式教学数据的空间范围和元数据；不复制数据、图表、代码或处理结果。 |

本轮新增 15 条原创 `citation-only` 方法卡，每个课程族 3 条。GitHub 项目只用于地图实践、学习流程、教学数据范围和来源溯源的交叉核对；公开卡片保留人民教育出版社教材证据，未把第三方题目、答案、代码、地图、数据或页面文字并入站点。

## geo-2026.08.23.31 新增公开来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `web-fao-water-scarcity` | [FAO Land and Water：Water Scarcity](https://www.fao.org/land-water/water/water-scarcity/en/) | FAO 官方专题页；访问日期 2026-08-23 | 参照水资源稀缺、供需压力、农业用水和管理响应；不复制正文、图表、数据表或页面版式。 |
| `web-sdg6-water-security` | [United Nations SDG 6：Clean Water and Sanitation](https://sdgs.un.org/goals/goal6) | 联合国可持续发展目标 6；访问日期 2026-08-23 | 参照饮水、卫生、水质、用水效率、综合管理和公平配置指标链；不复制正文、图表或指标数据。 |
| `web-sdg11-sustainable-cities` | [United Nations SDG 11：Sustainable Cities and Communities](https://sdgs.un.org/goals/goal11) | 联合国可持续发展目标 11；访问日期 2026-08-23 | 参照住房、交通、规划、灾害韧性、环境影响和空间公平的城市指标关系；不复制正文、图表或指标数据。 |
| `web-ipcc-ar6-wg2-impacts-adaptation` | [IPCC AR6 WGII：Impacts, Adaptation and Vulnerability](https://www.ipcc.ch/report/ar6/wg2/) | IPCC 第六次评估报告第二工作组入口；访问日期 2026-08-23 | 参照气候影响、暴露、脆弱性、适应路径和证据不确定性；不复制报告正文、图表或数据。 |
| `github-mapping-chinese-universities` | [Mapping Chinese Universities](https://github.com/lzz0722/mapping-chinese-universities) | commit `a4cdb1c01f9b964db7785125659666bab30943de`；MIT；访问日期 2026-08-23 | 参照高校时空扩张、人口标准化、区域不均衡、空间重心和样本限制；不复制代码、数据、图表或页面文字。 |
| `github-gisnepal-environmental-demographic` | [GisNepal](https://github.com/a4aron/GisNepal) | commit `755fd7bdae2b9ce26efc436b648b29700c6026a2`；访问日期 2026-08-23 | 参照环境—人口图层叠加、城市规划、公共服务和灾害应用；仓库未声明统一许可证，不复制代码、数据库、地图或页面文字。 |
| `github-plane-navigation-geography` | [Plane Navigation Game](https://github.com/olivercoltart/plane-game) | commit `2823b0c2496f4f283930208114a5079d1bd03e80`；项目标注 proprietary；访问日期 2026-08-23 | 参照地图定位、方位、距离、路线反馈和交互学习；不复制代码、地图、题目、图像或页面文字。 |

本轮新增 15 条原创 `citation-only` 方法卡，每个课程族 3 条。外部来源只用于水资源、城市指标、气候风险、空间统计和 GIS 方法的交叉核对；公开层继续保留人民教育出版社教材证据和原创表述，没有把第三方报告正文、指标数据、代码、地图或题目并入站点。

## geo-2026.08.23.30 新增公开来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `web-nasa-sun` | [NASA Science：Sun](https://science.nasa.gov/sun/) | NASA 官方太阳科学入口；访问日期 2026-08-23 | 参照太阳结构、辐射、太阳活动、太阳风与地球系统影响；不复制正文、图像或数据产品。 |
| `web-nasa-solar-system` | [NASA Science：Solar System](https://science.nasa.gov/solar-system/) | NASA 官方太阳系科学入口；访问日期 2026-08-23 | 参照天体系统、行星环境、轨道运动和空间观测；不复制正文、动画或页面资源。 |
| `web-usgs-geologic-time` | [USGS：Geologic Time](https://pubs.usgs.gov/gip/geotime/) | USGS 官方公开资料；访问日期 2026-08-23 | 参照地质年代、地层、化石、地球历史和资源形成时间尺度；不复制正文、图表或版式。 |
| `web-noaa-ocean-currents` | [NOAA Ocean Service：Ocean Currents](https://oceanservice.noaa.gov/education/tutorial_currents/01_intro.html) | NOAA 官方教育教程；访问日期 2026-08-23 | 参照洋流成因、方向、热量输送、沿海环境和观测证据；不复制正文、图示、活动或数据。 |
| `web-unfpa-state-world-population` | [UNFPA：State of World Population](https://www.unfpa.org/swp2023) | UNFPA 官方报告入口；访问日期 2026-08-23 | 参照人口增长、人口结构、人口指标、情景判断和公共服务分析；不复制报告正文、图表或数据表。 |
| `web-unesco-mab-programme` | [UNESCO：Man and the Biosphere Programme](https://www.unesco.org/en/mab) | UNESCO 官方计划入口；访问日期 2026-08-23 | 参照保护、发展、地方参与、人地关系和区域治理协同；不复制正文、图表或案例材料。 |

本轮新增 15 条原创 `citation-only` 方法卡，每个课程族 3 条。外部来源只用于教材概念、公开科学资料与方法边界的交叉核对，公开层继续保留人民教育出版社教材证据和原创表述；没有把第三方题目、答案、报告正文、图表、代码、地图或数据表并入站点。

## geo-2026.08.23.29 新增公开来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `github-malu-china-terrain-map` | [中国3D地形地貌互动教学地图](https://github.com/malu322-jpg/china-terrain-map) | commit `1bde0972dc06ee7ec96534ac91beaecb7fda9beb`；访问日期 2026-08-23；README 介绍三级阶梯、DEM、地形剖面、山脉、高原、盆地、平原、河流和城市的教学级三维观察 | 参照中国地形可视化、剖面、垂直夸张和教学精度边界；仓库未声明统一许可证，不复制代码、数据、图片或页面文字。 |
| `github-yusuf-zero2truesize` | [02truesize：地图真实面积与投影教学工具](https://github.com/YusufEminoglu/zero2truesize) | commit `2ebc95e7e6aae01c8efe1394e7cc33458f08cbc1`；访问日期 2026-08-23；GPL-3.0 | 参照真实面积、Mercator 失真、投影选择、Tissot 指示圈和空间比较；不复制插件代码、图标、数据或页面文字。 |
| `github-google-aog-education` | [AOG Education：Google Nest Hub 地理教育游戏](https://github.com/googleinterns/AOG-Education) | commit `cda8c68d2bd339299b1a6bf7d95ee301dcfbcd0b`；访问日期 2026-08-23；README 说明 geography、language、reading 三学科和国家/首都/城市地图问答 | 参照地理层级、地图问答、位置反馈和交互学习流程；未声明统一许可证，不复制代码、地名数据、Google 地图输出或页面文字。 |
| `github-geofun` | [GeoFun：基于国家与人口的地理学习应用](https://github.com/Emil-Lima/GeoFun) | commit `b64b1931f775ff285ec677c53d61e3674c6343b2`；访问日期 2026-08-23；README 介绍国家选择、欧洲国家资料、人口页面、保存国家和 quiz | 参照国家比较、人口指标、地图交互和复习闭环；未声明统一许可证，不复制代码、REST Countries 返回、图片、数据库或页面文字。 |
| `web-nasa-earth-observatory` | [NASA Earth Observatory：地球观测图像与科学故事](https://earthobservatory.nasa.gov/) | NASA 官方入口；访问日期 2026-08-23 | 参照气候、土地、水体、生态、灾害和人类活动图像的多时相、多尺度证据判读；具体图像和第三方素材按各自署名/使用条件处理，不复制图片、图注或数据产品。 |

本轮新增 15 条原创 `citation-only` 方法卡，每个课程族 3 条。外部来源只用于地形、投影、交互学习、国家与人口比较、地球观测和资源环境安全的交叉核对，公开层继续保留人民教育出版社教材证据和原创表述；没有把第三方题目、答案、代码、地图、接口返回或图像并入站点。

## geo-2026.08.23.28 新增公开来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `github-cicada-high-school-geography-notes` | [高中地理笔记：湘教版教材与复习索引](https://github.com/Cicada000/Geography-Notes) | commit `d0e91a407ed3768907eb39e09aecfd8116703fcc`；访问日期 2026-08-23；CC-BY-SA 4.0；仓库已归档 | 参照教材版本识别、章节索引和区域案例回查；不复制 TeX、PDF、图片、题目或笔记正文。 |
| `web-national-geographic-flood` | [National Geographic Education：Flood 洪涝](https://education.nationalgeographic.org/resource/flood/) | Grades 9–12+ 教育条目；访问日期 2026-08-23 | 核对洪涝概念、地球过程、聚落暴露和土地利用比较；不复制条目正文、图片、活动或页面版式。 |
| `web-national-geographic-landslide` | [National Geographic Education：Landslide 滑坡](https://education.nationalgeographic.org/resource/landslide/) | Grades 6–12+ 教育条目；访问日期 2026-08-23 | 核对坡面物质运动、岩性—水分证据、地质灾害过程和风险判断；不复制条目正文、图片、活动或页面版式。 |
| `web-national-geographic-renewable-energy` | [National Geographic Education：Renewable Energy 可再生能源](https://education.nationalgeographic.org/resource/renewable-energy/) | Grades 2–12 教育条目；访问日期 2026-08-23 | 核对可再生能源概念、自然条件、空间布局和能源转型边界；不复制条目正文、图片、活动或页面版式。 |
| `web-nasa-earthdata-learn` | [NASA Earthdata：Learn 地球科学数据学习入口](https://www.earthdata.nasa.gov/learn) | 官方公开学习入口；访问日期 2026-08-23 | 核对地球观测数据、空间/时间尺度、数据处理链和教育使用边界；不复制页面正文、图片、数据产品或接口返回。 |

本轮新增 15 条原创 `citation-only` 方法卡，每个课程族 3 条。外部来源只用于教材版本、自然灾害、能源区位、地球观测和区域规划的交叉核对，公开层继续保留人民教育出版社教材证据和原创表述；没有把第三方题目、答案、笔记正文、图片、数据、代码或模型输出并入站点。

## geo-2026.08.23.27 新增公开来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `github-geolab-high-school-platform` | [GeoLab：高中地理知识系统与交互演示](https://github.com/1195214305/GeoLab) | commit `1792de4d2814d796e28bc6c62a7cf596f5a73a8b`；访问日期 2026-08-23 | 参照人教版高中地理知识导航、交互演示和 AI 辅导边界；仓库未声明统一许可证，不复制代码、页面文字、图片、组件或模型输出。 |
| `github-geolab-128-coupled-systems` | [GeoLab 128：地形、水文、生态与基础设施耦合实验室](https://github.com/laiyukai910-star/geolab-128) | commit `0b6c9c4770cd8d0cf2b36fb12549affa2489c907`；访问日期 2026-08-23；MIT | 参照地形—水文—生态—基础设施耦合、过程闸门、守恒检查和不确定性报告；不复制代码、数据、资产或页面文字。 |
| `github-geography-note-regional-index` | [地理笔记：高中区域地理与复习资料索引](https://github.com/a15355447898/Geography_Note) | commit `17d8cc03eaca3a548b5e168218462890b062718c`；访问日期 2026-08-23；GPL-2.0 | 参照世界地理、中国地理、区域专题和复习目录的案例回查方式；不复制 PDF、PPT、DOCX、图片、题目或页面文字。 |
| `web-epa-heat-islands` | [US EPA：Heat Island Effect 城市热岛](https://www.epa.gov/heatislands) | 官方专题页；访问日期 2026-08-23 | 核对城市热岛形成、影响、脆弱群体、规划减缓和适应路径；不复制正文、图片、数据表或页面版式。 |
| `web-national-geographic-urban-heat-island` | [National Geographic Education：Urban Heat Island](https://education.nationalgeographic.org/resource/urban-heat-island/) | Grades 5–12+ 教育条目；访问日期 2026-08-23 | 核对城市热岛的地球科学、气象学、人文地理和自然地理课程定位；不复制条目正文、图片、活动或页面版式。 |
| `web-met-office-learn-weather` | [Met Office：Learn about weather](https://www.metoffice.gov.uk/weather/learn-about/weather) | 官方天气学习入口；访问日期 2026-08-23 | 核对天气观测、云、降水、风、预报和极端天气的主题边界与观测顺序；不复制正文、图片、活动或预报产品。 |

本轮新增 15 条原创 `citation-only` 方法卡，每个课程族 3 条。外部来源只用于自然—人文过程、城市热环境、区域规划、天气观测和学习证据边界的交叉核对；公开层继续保留人民教育出版社教材证据和原创表述，没有把第三方题目、答案、笔记正文、PPT、代码、数据、图件或模型输出并入站点。

## geo-2026.08.23.26 新增公开来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `github-lurea-geography-teaching-lecture` | [高中地理教学讲座：从教会答题到学会解决问题](https://github.com/lurea-git/geography-teaching-lecture) | commit `3f23a8662cec3e55f8656bbeb2cb7f2e859d5d01`；访问日期 2026-08-23 | 参照课例诊断、证据—关系—过程—迁移和问题解决结构；不复制讲稿、课件、文档或页面文字。 |
| `github-geography-study-react` | [高中地理动画教学：日地运动交互模型](https://github.com/swingboat/geography-study-react) | commit `ca94e23989de595560189c3d1463f249639260d5`；访问日期 2026-08-23 | 参照黄赤交角动画、参数观察和课程标签核对；README 声明 MIT，不复制代码、图片、组件或页面文字。 |
| `github-geographical-education-qa-hallucination` | [地理教育多轮问答与幻觉分析数据集](https://github.com/7tigersniffstherose7/Geographical-Education-Multi-round-QA-Dataset) | commit `5dc19bc3c429907868aad9cbbdb569f283ec5fb6`；访问日期 2026-08-23 | 参照多轮问答、知识点对齐、幻觉识别和证据核验；仓库未声明统一许可证，不复制 CSV、压缩包或论文正文。 |
| `github-mizmay-web-map-quickstart` | [Web-Mapping Quickstart：三次课的网络制图教学](https://github.com/mizmay/web-map-quickstart) | gh-pages commit `e71b11067fc820a9ef4df546b15b5b193ed4695b`；访问日期 2026-08-23 | 参照 session 分段、图层表达和地图叙事；不复制幻灯片、图片、代码或页面文字。 |
| `web-rgs-schools-geography-resources` | [Royal Geographical Society Schools](https://www.rgs.org/schools) | 页面访问日期 2026-08-23 | 参照学校资源、实地考察、学生/教师活动、项目和课程支持入口；不复制正文、图片、活动材料或会员资源。 |
| `web-geographical-association-teaching-resources` | [Geographical Association：在线地理教学资源](https://geography.org.uk/online-teaching-resources/) | 页面访问日期 2026-08-23；页面标注更新 2026-08-06 | 参照按学段与主题筛选案例、视频、活动、野外调查、地图制图和资源环境材料的方式；部分内容需会员权限，不复制受限内容。 |

本轮新增 15 条原创 `citation-only` 方法卡，每个课程族 3 条。外部来源只用于问题解决、交互模型、网络地图、地理实践、问答核验和资源访问边界的交叉核对，公开层继续保留人民教育出版社教材证据和原创表述；没有把第三方题目、答案、讲稿、课件、数据记录、页面代码或图件并入站点。

## geo-2026.08.23.25 新增公开来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `github-yuta-edu-3d-terrain` | [edu-3d-terrain：教育用三维地形查看器](https://github.com/YutaOzawaTU/edu-3d-terrain) | commit `34b7ecd7a1cb6a0948e26869ea56b08c55935a28`；访问日期 2026-08-23 | 参照 DEM、视点预设、起伏夸张、地形地点和国土地理院地图归因；不复制代码、图件、数据或页面文字。 |
| `github-vrautenbach-isprs-catalogue` | [ISPRS Catalogue：地理空间教育资源目录](https://github.com/vrautenbach/isprs_catalogue) | commit `9825eda0b70f33860ba4e0e8ba018685da8098cc`；访问日期 2026-08-23 | 参照标题、描述、日期、作者、关键词、检索和资源维护等元数据；不复制代码、资源正文、图片或数据库内容。 |
| `github-yujinnee-worldhunter` | [WorldHunter：大陆、邻国线索与全球地理探索](https://github.com/yujinnee/WorldHunter) | commit `84dcc3a76132e73dfe6f29572f8723c7d6a1d791`；访问日期 2026-08-23 | 参照大陆选择、国家地图、邻国线索和区域定位；不复制代码、地图、图片、国家资料或应用版式。 |
| `github-mukombradon-globeguesser` | [GlobeGuesser：国旗、国家与地理游戏化学习](https://github.com/mukombradon/GlobeGuesser) | commit `f0129d7b41a8519361472adae686cd6d2fc292f3`；访问日期 2026-08-23 | 参照国家、属地、历史国家、难度分层和复习公平性；不复制代码、旗帜、题目或页面文字。 |
| `github-gisphere-kg-chatbot` | [GISphere-KG ChatBot：GIS 地理教育知识图谱](https://github.com/GIS-Info/GISphereKG-ChatBot) | commit `a59ae1ae927344f2fa75058b91b79f819a76e455`；访问日期 2026-08-23 | 参照地理实体、空间位置、关系、标准化和知识图谱检索；不复制论文、代码、数据库、图件或个人资料。 |
| `web-noaa-education-resource-collections` | [NOAA Education：地球系统资源合集](https://www.noaa.gov/education/resource-collections) | 页面访问日期 2026-08-23 | 参照海洋、天气、大气、气候、海洋生物、淡水和教育者数据资源的主题组织；不复制正文、图片、活动材料或数据。 |

本轮新增 15 条原创 `citation-only` 方法卡，每个课程族 3 条。外部来源只用于三维观察、资源组织、区域定位、知识图谱、游戏化复习和地球系统资料边界的交叉核对，公开层继续保留人民教育出版社教材证据和原创表述；没有把第三方题目、答案、页面代码、图件或个人资料并入站点。

## geo-2026.08.23.24 新增公开来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `web-globe-program-clouds-api` | [GLOBE Program：云观测协议与开放数据 API](https://www.globe.gov/globe-data/globe-api) | 官方 API 与 Clouds protocol 入口；访问日期 2026-08-23 | 核对云观测协议、时间位置字段、公民科学数据和卫星匹配的资料边界；不复制正文、数据记录、照片或接口返回。 |
| `github-ruddro-globe-cloud-insights` | [GLOBE Cloud Insights：云观测交互分析](https://github.com/ruddro-roy/globe-cloud-insights) | commit `b956e24ac5f41ece2e3e4b7d096c06d76df79cc5`；访问日期 2026-08-23 | 参照云观测数据清洗、时间序列、世界地图、卫星匹配和位置隐私；仓库声明 MIT，不复制代码、数据、图表或 notebook。 |
| `github-ccosse-colormyworld` | [ColorMyWorld：地理地图寻宝与区域识别](https://github.com/ccosse/colormyworld) | commit `6a17d2ccd12503e31344ab6050eef86f9985d3d6`；访问日期 2026-08-23 | 参照地图寻宝、国家识别、交互着色与统计专题图的区别；仓库声明 Apache-2.0，不复制代码、地图、图片或题目。 |
| `github-ayushishukla-geography` | [Geography：地貌、气候与 GIS 地理教育网站](https://github.com/ayushishukla-geo/Geography) | commit `3769f9c88270450ae6a930d40dc761590fb8b6cc`；访问日期 2026-08-23 | 参照地貌、气候和 GIS 的学习路径；未声明统一许可证，不复制页面文字、图片、代码或资源。 |
| `github-bhagyashree-geography-lesson-plans` | [Geography ICSE Lesson Plans：中学地理课例计划](https://github.com/bhagyashree21289/Geography-ICSE-Lesson-Plans) | commit `ff0c43a86f756574180acfc59f68a3e3ea9693a4`；访问日期 2026-08-23 | 参照目标、活动、资料和课堂评价的课例结构；未声明统一许可证，不复制教案正文、图片、题目或课件。 |
| `github-osgeo-geospatial-education` | [OSGeo：开源地理空间教育与治理生态](https://github.com/OSGeo/osgeo) | commit `ba9b9f1228451dc717b95289e82c9d36ba67a954`；访问日期 2026-08-23 | 参照开放软件、标准、数据、教育和 CC BY/CC BY-SA/CC0 等许可边界；不复制文档、图片、代码或品牌材料。 |

本轮新增 15 条原创 `citation-only` 方法卡，每个课程族 3 条。外部资料只用于方法、教学组织和证据边界交叉核对，公开层继续以人民教育出版社教材页码为主证据；没有把第三方题目、答案、页面代码或图件并入站点。

## geo-2026.08.23.23 新增公开 GitHub 来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `github-onicio-geodeck` | [GeoDeck：地图与空间思维高中学习卡](https://github.com/onicio/geodeck) | commit `f43955d7d50b97bb5f75698cba5c99aed59ee3d6`；访问日期 2026-08-23 | 参照绝对距离、方向、高程、等值线、专题图和投影学习卡的组织方式；仓库声明 CC0-1.0，不复制 HTML、图片、题目或页面文字。 |
| `github-nocci-high-school-geography` | [Geography High School：欧洲与北美地理复习游戏](https://github.com/Nocci-lab/geography_high_school) | commit `955972d59683d5b67fcdc6a706503b4dfb92d449`；访问日期 2026-08-23 | 参照欧洲、北美自然地理、产业和区域联系的地图复习与比较任务；未声明统一许可证，不复制页面、地图、题目或图片。 |
| `github-alexjohnj-geographyas` | [Geography AS Notes：地理复习网站](https://github.com/alexjohnj/geographyas) | commit `1b8a7666bc1004955a45787a49e81930f8aba6e5`；访问日期 2026-08-23 | 参照学生复习网站的案例索引、过程链和学习导航；README 说明文字采用 CC BY-NC 4.0，不复制正文、图片、题目或版式。 |
| `github-spatialthoughts-qgis-tutorials` | [QGIS Tutorials and Tips：GIS 教程](https://github.com/spatialthoughts/qgis-tutorials) | commit `e6c1e1650e37ada34ae78be3155c6b63c526c3b8`；访问日期 2026-08-23 | 参照 QGIS 任务序列、空间处理、构建复核与归因流程；README 说明教程采用 CC BY 4.0，不复制教程正文、代码、图件或数据。 |
| `github-opengeos-pygis` | [pygis：GIS 编程工具环境](https://github.com/opengeos/pygis) | commit `bb36d465c05fadf768e4ca21fbfa0eeee419b8ce`；访问日期 2026-08-23 | 参照 GIS 环境安装、文档入口和可复现空间工作流；仓库声明 MIT，不复制代码、notebook、图片或数据。 |

本轮新增 15 条原创 `citation-only` 方法卡，每个课程族 3 条。第三方仓库只用于方法和资料组织交叉核对，公开层继续以人民教育出版社教材页码为主证据；没有把第三方题目、答案、页面代码或图件并入站点。

## geo-2026.08.23.22 新增公开来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `web-qgis-training-manual` | [QGIS Training Manual：GIS 图层、栅格与空间分析](https://docs.qgis.org/latest/en/docs/training_manual/) | 在线文档入口；访问日期 2026-08-23 | 核对矢量/栅格、坐标参考、空间分析、制图和地理实践教学组织；不复制正文、图件、数据或代码。 |
| `web-arcgis-learn-geography` | [ArcGIS Learn：地图与 GIS 学习课程](https://learn.arcgis.com/en/) | 在线学习入口；访问日期 2026-08-23 | 核对地图图层、空间分析、现场数据、制图表达和区域问题探究；不复制课程正文、图件或软件资源。 |
| `web-nasa-worldview-earth-observation` | [NASA Worldview：动态地球遥感观测](https://worldview.earthdata.nasa.gov/) | 在线观测入口；访问日期 2026-08-23 | 核对每日卫星影像、历史时间序列、植被、尘暴和洪水观测的任务边界；不复制影像、数据或页面文字。 |
| `web-protected-planet-conservation-data` | [Protected Planet：全球保护地与保护成效空间数据](https://www.protectedplanet.net/en) | 在线数据入口；访问日期 2026-08-23 | 核对保护地、生物多样性、空间覆盖和保护治理数据边界；不复制数据库记录、地图图层或页面文字。 |
| `github-qgis-training-data` | [QGIS Training Data：GIS 练习数据](https://github.com/qgis/QGIS-Training-Data) | commit `fd26dd88e39b9aec550eea450cec18d02b1de3b5`；访问日期 2026-08-23 | 参照 GIS 练习数据、图层操作和地理实践流程；仓库声明 GPL-2.0，不复制数据文件、代码或练习正文。 |
| `github-qgis-documentation` | [QGIS Documentation：开源 GIS 官方文档](https://github.com/qgis/QGIS-Documentation) | commit `a33d48826a2673b58a66adc12b0aa1895cecaec6`；访问日期 2026-08-23 | 参照栅格/矢量、坐标参考和空间处理方法；不复制文档正文、图片、代码或数据。 |
| `github-spatialthoughts-open-courseware` | [Spatial Thoughts OpenCourseWare：空间分析与 GIS 课程](https://github.com/spatialthoughts/courses) | commit `a627b988b54b9dd0fe879d3a4b0c8148564c42be`；访问日期 2026-08-23 | 参照空间可视化、QGIS 自动化、Python 空间分析和 Earth Engine 工作流；不复制课程正文、notebook、代码或数据。 |
| `github-geography-teaching-tools` | [Geography Teaching Tools：地理教师工具与数据集](https://github.com/geo-dan/Geography_teaching_tools) | commit `c6721a440e4f1dcb2dc8c2c87115d5af1fd15285`；访问日期 2026-08-23 | 参照教师工具、数据集组织和课堂工作坊；仓库声明 CC0-1.0，不复制图片、数据、代码或教学正文。 |
| `github-geography-teaching-plugin` | [GeographyTeachingPlugin：大气环流交互教学模型](https://github.com/1Mengjin/GeographyTeachingPlugin) | commit `0ea592460b04452e7e761343113f1092968b1b2b`；访问日期 2026-08-23 | 参照地转偏向力、三圈环流和交互观察模型；不复制 HTML、代码、图片或页面文字。 |

本轮新增 15 条原创 `citation-only` 方法卡，每个课程族 3 条。外部来源只用于方法边界与资料组织交叉核对，公开层继续保留人民教育出版社教材证据和原创表述。

## geo-2026.08.23.21 新增公开来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `web-cgs-geological-survey` | [中国地质调查局：地质调查与地学信息入口](https://www.cgs.gov.cn/) | 网站入口；访问日期 2026-08-23 | 核对地质调查、矿产资源、地下水、地质灾害与地学信息服务的资料边界；只发布原创方法，不复制正文、图件或数据。 |
| `web-mot-transport-geography-data` | [交通运输部：综合交通运输信息入口](https://www.mot.gov.cn/) | 网站入口；访问日期 2026-08-23 | 核对交通网络、可达性、区域联系和运输治理的空间与时间口径；只发布原创方法，不复制正文、图表或数据。 |
| `web-nea-energy-security-information` | [国家能源局：能源信息与能源安全入口](https://www.nea.gov.cn/) | 网站入口；访问日期 2026-08-23 | 核对能源资源、能源结构、电力系统、能源转型与能源安全的指标边界；只发布原创方法，不复制正文、图表或数据。 |
| `web-nmdis-marine-information` | [中国海洋信息网：海洋信息与观测入口](https://www.nmdis.org.cn/) | 网站入口；访问日期 2026-08-23 | 核对海洋观测、海洋资源、海洋环境、海洋灾害与海岸带信息的组织边界；只发布原创方法，不复制正文、图表或数据。 |
| `web-geodata-earth-system-data` | [国家地球系统科学数据中心：地球系统数据入口](https://www.geodata.cn/) | 网站入口；访问日期 2026-08-23 | 核对地球系统数据的元数据、空间尺度、时间分辨率和跨源比较边界；不复制数据表、图件或产品内容。 |
| `github-lmec-map-education-collections` | [LMEC Collections：地图与地理图像数据教育入口](https://github.com/boston-library/lmec_collections) | commit `1d2f104a2a5a8b186bfd06a45dde7fd1af25279f`；访问日期 2026-08-23 | 参照地图检索、历史空间证据、图像教育使用和尺度比较；不复制图像、数据、代码或页面文字。 |
| `github-qgis-lesson-geography` | [QGIS Lesson：GIS 图层与野外数据教学](https://github.com/sagesteppe/QGIS_Lesson) | commit `baccacf5893cf02d545258c0d3ceacab35430a62`；访问日期 2026-08-23 | 参照 GIS 图层叠加、项目数据组织和野外核验；不复制代码、图片、数据或教程正文。 |
| `github-tactile-map-generator` | [Tactile Map Generator：可触摸地图与城市空间建模](https://github.com/jesse-flores/Tactile-Map-Generator) | commit `623966ce1963b41472ea667fbae62dc24b97f90a`；访问日期 2026-08-23 | 参照投影、缩放、空间简化、比例尺和无障碍地图表达；不复制代码、数据、模型或图片。 |

本轮新增 15 条原创 `citation-only` 方法卡，每门课程族 3 条。卡片把官方地质、交通、能源、海洋和地球系统入口，以及 GitHub 地图/GIS 项目转换为高中地理的证据判断与读图方法；每条仍保留人民教育出版社教材证据，外部来源只作 citation-only 交叉核对。`/Volumes/mac_2T` 仍不可读取，本轮没有声称已吸收其他机器材料。

## 已核验教材来源

| Source ID | 书名 | 出版者 | 页数 | 进入范围 |
|---|---|---|---:|---|
| `pep-geography-compulsory-1` | 普通高中教科书 地理 必修 第一册 | 人民教育出版社 | 134 | 自然地理过程、圈层、地貌、水循环、灾害 |
| `pep-geography-compulsory-2` | 普通高中教科书 地理 必修 第二册 | 人民教育出版社 | 134 | 人口、城镇、产业、交通、人地协调 |
| `pep-geography-selective-1` | 普通高中教科书 地理 选择性必修1 自然地理基础 | 人民教育出版社 | 106 | 地球运动、大气环流、水体、地域差异 |
| `pep-geography-selective-2` | 普通高中教科书 地理 选择性必修2 区域发展 | 人民教育出版社 | 102 | 区域联系、生态治理、产业、资源调配 |
| `pep-geography-selective-3` | 普通高中教科书 地理 选择性必修3 资源、环境与国家安全 | 人民教育出版社 | 126 | 资源安全、粮食、海洋、环境与生态文明 |

## 本轮新增来源

| Source ID | 来源 | 文件范围 | 用途与证据边界 |
|---|---|---|---|
| `exam-shanxi-affiliated-2025-12-geography` | 山西大学附属中学校高二 12 月月考地理试题 | 2025-12 PDF，10 页；SHA-256 `faf107b4d98bc6472bf24a8d90e8e899b70a36f3907c98f5fc693b8abb581cf5` | 岩石循环、径流、等压线、洋流与海气作用的题型方法；只引用页码，不公开题面 |
| `exam-nanning-no3-2026-03-geography` | 南宁三中高二月考（一）地理试题 | 2026-03 PDF，8 页；SHA-256 `08b15d407edd1eb129b7e8520437b6eb10e83787b9086b4fcfcde55a40586988` | 城市辐射、产业链、太阳高度、地层与产业升级的题型方法；只引用页码，不公开题面 |
| `exam-zhejiang-quzhou-2026-04-geography` | 浙江衢州五校联考高二下学期期中地理试卷 | 2026-04 PDF，8 页；SHA-256 `30752ef92ca9e412c741fa505aff1a194a1a623d2481402226f327570124ac88` | 人口流动、都市圈、循环农业与流域湿地协调的题型方法；只引用页码，不公开题面 |
| `marine-geology-reference-2024` | 海赛参考知识点：海洋地质地理 | DOCX 与转格式 PDF，PDF 46 页；PDF SHA-256 `58489daf6c045778835c217e1fc8a3cf35cafff1f9d62222c08c7a4657c2a4a8` | 海底地形、海岸、海水运动与资源条件的概念交叉核对；原始许可未核验 |
| `marine-resources-reference-2017` | 海赛参考知识点：海洋资源 | DOC，元数据标示 13 页；SHA-256 `41537b6493e5994f0d68151cef92e7693a1819b856782ccccbf1a48afe5d533` | 渔业、盐业、海洋能源、海底资源与开发边界的概念交叉核对；原始许可未核验 |
| `marine-environment-reference-2023` | 海赛参考知识点：环境保护 | DOC，元数据标示 5 页；SHA-256 `396a58ee22a580c09b0e238abab586fb598cbbef84a2e09559e325947864e837` | 海洋污染、富营养化、滨海湿地与环境承载力的概念交叉核对；原始许可未核验 |
| `marine-disaster-reference-2017` | 海赛参考知识点：防灾减灾 | DOC，元数据标示 31 页；SHA-256 `b8519b09bb9b8c00447bd2c2a1e4a6fa40a74eb13907558602f1f63cf01edd23` | 风暴潮、海冰、海啸、海岸灾害和防御链的概念交叉核对；原始许可未核验 |

## 本轮继续吸收的来源

| Source ID | 来源 | 文件范围 | 用途与证据边界 |
|---|---|---|---|
| `local-geography-worktree-2026-06` | 本地历史高中地理知识模块（其他工作树） | `lghui-round542-proof-depth/high_school_geology`；知识结构清单 SHA-256 `5cf04f0b0fbfc96798d20e2ec8db31d96772ce159d3eb663e4ff0c5bf18cdcb7` | 用户自有历史内容的专题结构与方法框架；不复制 HTML 正文、题库、图表或页面版式 |
| `exam-zhejiang-four-schools-2026-03-geography` | 浙江四校（含精诚联盟）高二下学期 3 月阶段检测 | 2026-03 PDF，7 页；SHA-256 `4e47fa894358a9c7e20bf3e2c3d833a60a45a8572f565d4de10131d3d31224cd` | 人口、气候舒适度、土地退化、GIS、植被和区域农业题型方法；只引用页码，不公开题面 |
| `exam-harbin-no3-2026-04-geography` | 哈尔滨市第三中学高二 4 月月考 | 2026-04 PDF，8 页；SHA-256 `6be1b38b12ba0a98c804b27ec7bedf69e1f34c9dc736886866eee9a916b91571` | 农业轮作、智能农业、交通工程、地方时、生态与区域发展题型方法；只引用页码，不公开题面 |
| `exam-shenyang-huimin-2026-04-geography` | 沈阳市回民中学高二下学 4 月月考 | 2026-04 PDF，6 页；SHA-256 `3a3675d992a51e1f6a56ad571e7298f261c057058d91e7789747c2f5c57bb53c` | 冻土、荒漠化、农田水利、极地科考和流域生态补偿题型方法；只引用页码，不公开题面 |
| `marine-ecology-reference-2017` | 海赛参考知识点：海洋生态 | DOCX；转换为 PDF 后 4 页供内部页码核验；SHA-256 `fd882c35c9c10f38c71f45e93625ce97292d4461fe35efd32eaa091059bb697c` | 海洋生态系统、赤潮、滨海生境和生态服务的概念交叉核对；原始许可未核验 |
| `marine-chemistry-reference-2017` | 海赛参考知识点：海洋化学 | DOCX；转换为 PDF 后 15 页供内部页码核验；SHA-256 `8f26b59d69ba69be788da310b0964b31602fbffb17a44ba89a29814e8479c212` | 水质指标、盐度、海冰和海洋酸化的概念交叉核对；原始许可未核验 |
| `marine-survey-reference-2017` | 海赛参考知识点：海洋调查 | DOCX；转换为 PDF 后 10 页供内部页码核验；SHA-256 `21201584dc8ee96f327489481ac022b8d11acbc1c58494f7caab8fe8727e5d6f` | 海流、温盐、潮位、平台观测和空间数据获取的概念交叉核对；原始许可未核验 |
| `marine-island-reference-2017` | 海赛参考知识点：海岛管理 | DOCX；转换为 PDF 后 2 页供内部页码核验；SHA-256 `8d819a109d931c2a98a2d241ba7ad428bb5bfa46523d409325a5d2ebdada7dce` | 海岛资源、岸线利用、生态保护和空间管理的概念交叉核对；原始许可未核验 |
| `marine-weather-reference-2017` | 海赛参考知识点：海洋气象 | DOC；Word 元数据标示 5 页；SHA-256 `45e7c6c8dc4b7931882c9965aada7967ab087408b32eb8ecf1a7e97363c3e454` | 风场、波浪、海况和沿海预警的概念交叉核对；原始许可未核验 |

当前可读取的题库目录中，排除答案和解析文件、按 PDF/DOC/DOCX 且文件名含“地理”统计，有 58 份可用于继续筛选的试卷；更宽的文件名命中数还包括答案、解析和已抽取文本，不将它们直接当作独立来源。下一轮应继续做跨试卷去重和课程归属审查。

本轮重新扫描了 `Downloads/2024-2026高二（题库）` 的 2026 年 3—4 月目录，选择了其中具有可读取文本层的 3 份新试卷作为代表来源；其余扫描版、答案版或无法稳定定位页码的文件继续留在本地研究范围，不直接进入公开卡片。

## 本轮新增公开 GitHub 与网站来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `github-orange-geography-coach` | [uau9/orange-geography-coach](https://github.com/uau9/orange-geography-coach) | commit `0198f84c3552bf20df90124e1c18dc412f0cf0fd`；访问日期 2026-08-22 | 交互实验的课程组织与理想模型边界，补充地转偏向力、地方时、晨昏线、气压带、月相和潮汐方法；不复制题目、答案、解析、页面代码或资源；仓库未声明可复用许可证 |
| `github-shanghai-knowledge-cards` | [EricTwins/shanghai-knowledge-cards](https://github.com/EricTwins/shanghai-knowledge-cards) | commit `4f6575871b0ea4518450e6b32418b2bac5177f2b`；访问日期 2026-08-22 | 对照自然、人文、区域与资源环境卡片组织，补充乡村空间和地域文化方法；不复制卡片正文、年度考情、图件或版式；仓库未声明可复用许可证 |
| `github-ckgg-high-school-geography` | [nju-websoft/CKGG](https://github.com/nju-websoft/CKGG) / [Zenodo DOI](https://doi.org/10.5281/zenodo.4668711) | commit `1c8bf48b11d0864440ceccef95c81afae3d483c7`；访问日期 2026-08-22 | 参照知识图谱中的地理实体、空间关系和位置/气候/人口等属性组织，补充多源区域证据联读；不复制 RDF、数据转储、图片或代码；仓库页面未声明可复用许可证 |

本轮将 GitHub 项目当作研究与结构参照，不把第三方仓库的题库、答案、页面代码或年度考情直接并入本站。公开卡片均为重新组织的原创摘要，并保留教材页码作为学习者回查的主证据；外部仓库只作为方法来源或交叉核对来源。

## 本轮新增公开网站与 GitHub 来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `web-noaa-tides-education` | [NOAA Tides and Water Levels Education](https://oceanservice.noaa.gov/education/tutorial_tides/tides01_intro.html) | 页面访问日期 2026-08-22 | 用于核对潮汐长周期波、涨潮流、落潮流、潮差与河口水体交换的概念；只发布原创高中地理方法，不复制原文、动画或版式。 |
| `web-noaa-ocean-acidification` | [NOAA National Ocean Service：What is Ocean Acidification?](https://oceanservice.noaa.gov/facts/acidification.html) | 页面访问日期 2026-08-22 | 用于核对海洋吸收二氧化碳、pH、碳酸根、钙化生物与沿海食物系统的关系；只发布原创方法，不复制原文、视频或图片。 |
| `web-nasa-remote-sensing-earth-observatory` | [NASA Earth Observatory：Remote Sensing](https://science.nasa.gov/earth/earth-observatory/remote-sensing/) | 页面访问日期 2026-08-22 | 用于核对遥感、波段、像元、空间分辨率及主动/被动传感器的任务匹配；只发布原创遥感判读方法，不复制原文、图片或代码。 |
| `github-geospatial-data-analysis-cn` | [findyourmagic/geospatial-data-analysis-cn](https://github.com/findyourmagic/geospatial-data-analysis-cn) | commit `fbd8f4e1f7e169add8d2601f7636b68d3054c3f3`；访问日期 2026-08-22；BSD-3-Clause | 用于交叉核对矢量/栅格、空间关系、空间连接与地图可视化的高中 GIS 方法边界；不复制 notebook、数据、代码或图件。 |

本轮新增 16 条原创方法卡，分别覆盖大气水汽与降水、风化侵蚀、火山地震风险、人口转变、城乡联系、服务业与数字联系、季风降水、水量平衡、冰川冻土、潮流河口、区域规划、遥感分辨率、水安全、生物多样性、碳收支和海洋酸化。新增卡片均回到五册教材保留课程归属与页码证据；NOAA、NASA 与 GitHub 仅作为概念交叉核对来源，外部内容仍按 `citation-only` 边界处理。

盘点方法为 PDF 元数据检查、目录页文本抽取和章节页码人工核对。五册均有可读取文本层；当前发布数据使用章节页码范围作为证据定位，学习者仍应回到纸质或合法电子教材核对完整图表、定义和案例。

## geo-2026.08.22.6 新增公开来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `web-nasa-el-nino` | [NASA Science：El Niño](https://science.nasa.gov/earth/explore/el-nino/) | 页面访问日期 2026-08-22 | 核对赤道太平洋海温、信风、Walker 环流、上升流与全球天气联系；只发布原创 ENSO 方法，不复制原文、图片或视频。 |
| `web-nasa-gpm-water-cycle` | [NASA GPM：The Water Cycle](https://gpm.nasa.gov/education/water-cycle) | 页面访问日期 2026-08-22 | 核对蒸发、蒸腾、降水、径流、储存与降水观测的联系；只发布原创水循环方法，不复制教学材料。 |
| `web-esa-copernicus-earth-observation` | [ESA Copernicus](https://www.esa.int/Applications/Observing_the_Earth/Copernicus) | 页面访问日期 2026-08-22 | 核对 Sentinel 任务、陆地/海洋/大气监测、灾害响应与环境治理的多源证据；不复制图片、数据或版式。 |
| `web-fao-global-soil-partnership` | [FAO Global Soil Partnership](https://www.fao.org/global-soil-partnership/en/) | 页面访问日期 2026-08-22 | 核对土壤健康、侵蚀、盐碱化、土壤有机碳与粮食安全的治理联系；不复制原文或报告版式。 |
| `github-atlasgpt-secondary-geography` | [dayangac/AtlasGPT](https://github.com/dayangac/AtlasGPT) | commit `6f01f956ba5e803f29c32e2ec9e2ff8638bc9745`；访问日期 2026-08-22 | 参照提示生成地图与中学地理教育的结构，不复制代码、数据、地图或项目页面。 |
| `github-terrain-explorer-africa` | [educatres/terrain-explorer-africa](https://github.com/educatres/terrain-explorer-africa) | commit `129064bc3c73d30c94f0b3fb1374fe87ca1f7f08`；访问日期 2026-08-22 | 参照山脉、河流、湖泊、特殊地形、国家公园的空间组织，不复制数据、照片、代码或版式。 |
| `github-intro-gispro` | [giswqs/intro-gispro](https://github.com/giswqs/intro-gispro) | commit `d4de649fefff14046a818aa3a7a05623015de9ed`；访问日期 2026-08-22 | 交叉核对 GeoPandas 矢量、Rasterio 栅格、空间分析与开放地理数据处理边界，不复制代码、文字、图件或数据。 |

本轮 16 条卡片均保留至少一条五册教材页码证据和至少一条新增公开来源证据；公开仓库与网站只作为概念交叉核对或方法参照，发布层继续使用 `citation-only` 边界。不可读取的 `/Volumes/mac_2T` 目录仍未被声称已经吸收。

## geo-2026.08.23.18 新增公开来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `web-mee-2025-ecological-environment-bulletin` | [生态环境部：2025 中国生态环境状况公报](https://www.mee.gov.cn/hjzl/sthjzk/zghjzkgb/202606/P020260604583244574595.pdf) | 公报 PDF；访问日期 2026-08-23 | 核对环境质量、生态状况、污染治理与环境变化指标边界；只发布原创高中地理方法，不复制公报正文、图表或数据。 |
| `web-mee-2023-marine-ecological-environment-bulletin` | [生态环境部：2023 中国海洋生态环境状况公报](https://www.mee.gov.cn/hjzl/sthjzk/jagb/202405/P020240522601361012621.pdf) | 公报 PDF；访问日期 2026-08-23 | 核对近岸海域、海洋生态质量、污染压力与海洋治理证据；只发布原创方法，不复制公报正文、图表或数据。 |
| `web-mnr-natural-resources-bulletins` | [自然资源部：自然资源公报](https://www.mnr.gov.cn/sj/tjgb/) | 公报栏目；访问日期 2026-08-23 | 核对土地、海洋和自然资源统计的空间单元、年度比较与指标口径；不复制公报正文、图表或数据。 |
| `web-mnr-south-china-sea-island-ecosystem` | [自然资源部：西中南沙岛礁生态系统状况](https://www.mnr.gov.cn/dt/ywbb/202608/t20260815_2936356.html) | 新闻与公报说明页；访问日期 2026-08-23 | 核对岛礁生态监测、珊瑚礁与海草床、生态差异和分类保护；不复制正文、图片、图表或数据。 |
| `web-cma-meteorological-data` | [中国气象数据网](https://data.cma.cn/) | 国家气象科学数据中心入口；访问日期 2026-08-23 | 核对地面、海洋、卫星、气候标准值和实况产品的观测要素与时间尺度；不复制数据表或产品内容。 |
| `web-cma-satellite-remote-sensing` | [中国气象局：风云卫星遥感支撑地理观测](https://www.cma.gov.cn/2011xwzx/2011xqxxw/202402/t20240226_6086025.html) | 新闻页；访问日期 2026-08-23 | 核对卫星遥感、天气监测、地表观测与灾害服务的任务匹配；不复制正文、图片、图表或数据。 |
| `github-felix-high-school-geography` | [高中地理学习网站：自然、人文与世界地理知识索引](https://github.com/felixyu9722/high-school-geography) | commit `048db7e7c1156fe50e1ceb0fcc542a19f6f42712`；访问日期 2026-08-23 | 参照中文高中自然、人文、世界地理与考点复习的跨章节索引；不复制页面文字、题目、代码、图片或版式。 |
| `github-clck-shanghai-high-school-knowledge` | [上海高中课本知识整理](https://github.com/CLCK0622/Shanghai-High-School-Knowledge) | commit `2064cd3254bb3977defa4290f029da5b935ea622`；访问日期 2026-08-23 | 参照按教材版本组织知识、章节和案例回查的方式；不复制页面正文、图片、代码或版式。 |
| `github-zero2geoquest` | [02GeoQuest：QGIS 地理地图挑战与课堂探究工具](https://github.com/YusufEminoglu/zero2geoquest) | commit `ac44c990f34d6531a78c7ca030b2b646983d6da0`；访问日期 2026-08-23 | 参照地图定位、属性比较、距离估计、邻近分析和课堂任务设计；不复制代码、数据、图件或手册正文。 |

本轮新增 15 条原创 `citation-only` 方法卡，每门课程 3 条。所有卡片均保留至少一条五册人民教育出版社教材证据和至少一条新增来源证据；中国官方公报、数据入口和新闻页只用于指标与方法边界核对，GitHub 项目只用于知识组织或地理实践方法参照。

## geo-2026.08.23.19 新增公开来源

| Source ID | 来源 | 稳定版本 | 用途与证据边界 |
|---|---|---|---|
| `web-tianditu-national-geospatial-platform` | [国家地理信息公共服务平台：天地图](https://www.tianditu.gov.cn/) | 平台首页；访问日期 2026-08-23 | 核对图层、定位、比例尺、空间数据来源与区域表达边界；不复制地图瓦片、数据或页面版式。 |
| `web-nbs-national-statistical-yearbook` | [国家统计局：国家数据与统计年鉴入口](https://www.stats.gov.cn/sj/ndsj/) | 统计年鉴与年度数据入口；访问日期 2026-08-23 | 核对人口、城镇、产业、交通和资源环境指标的时间序列与统计口径；不复制统计表、图表或数据库内容。 |
| `web-nbs-2022-statistical-bulletin` | [国家统计局：2022年国民经济和社会发展统计公报](https://www.stats.gov.cn/sj/zxfb/202302/t20230228_1919011.html) | 统计公报；访问日期 2026-08-23 | 核对人口结构、城镇化、产业、交通和资源环境指标的综合阅读方式；不复制公报正文、图表或数据。 |
| `web-china-earthquake-data-center` | [国家地震科学数据中心](https://data.earthquake.cn/) | 数据中心入口；访问日期 2026-08-23 | 核对地震目录、危险性、空间分布和灾害风险数据的使用边界；不复制数据表、图件或产品内容。 |
| `web-national-forestry-grassland-administration` | [国家林业和草原局政府网](https://www.forestry.gov.cn/) | 政府信息入口；访问日期 2026-08-23 | 核对森林草原资源、生态修复、生物多样性与生态服务的治理证据链；不复制正文、图表或数据。 |
| `github-global-circulation-simulator` | [全球大气环流与东亚季风交互模拟器](https://github.com/Eason455/global-circulation-simulator) | commit `ff76608f10acf33a5eaca5fd0568b237f91efede`；访问日期 2026-08-23 | 参照太阳直射点、三圈环流、气压带风带、东亚季风与雨带移动的模型组织；不复制代码、题目、图件或页面文字。 |
| `github-satv-geography-tool` | [SATV：高中地理太阳高度角与时区换算可视化工具](https://github.com/jamekes355/SATV-Geography-Tool) | commit `706bc6916d6706ac43ebfa84682e66b7fc07d1f5`；访问日期 2026-08-23 | 参照太阳高度角、昼夜长短、晨昏线、地方时和区时的可视化核对方法；不复制代码、图件、题目或资源。 |

本轮新增 15 条原创 `citation-only` 方法卡，每门课程 3 条。所有卡片均保留至少一条五册人民教育出版社教材证据和至少一条新增来源证据；官方统计、地震、林草和地图平台只用于指标与空间证据边界核对，GitHub 项目只用于模型或可视化方法参照。

## 其他机器与同步目录

目标仓库历史构建脚本记录了两个其他机器来源根目录：

- `mac_2T/赠送：其他机构老师课程`
- `mac_2T/6—电子书与电子资料`

本次盘点时这两个 `/Volumes/mac_2T` 根目录在当前机器不可读取，因此没有把它们声明为已同步，也没有猜测其中存在的地理资料。下一轮若目录可用，必须先做文件名、大小、校验和与课程相关性比对，再把可发布内容转为原创摘要并补充 `sourceIds` 与页码证据。

当前机器另外发现的海洋学、上升流和海洋竞赛资料属于研究或竞赛知识库，不自动并入高中地理教材摘要。只有能够明确对应高中课程目标、且版权和证据定位通过审查的案例，才可作为后续 `citation-only` 来源单独加入。

本轮已纳入的海洋资料仍保持这一边界：只使用能够映射到高中地理的资源分类、洋流与生产力、污染治理、滨海湿地、海洋灾害和空间统筹方法；法律、军事、过度技术化的海洋知识和时效性事实继续留在研究状态。

## 质量门槛

- 每条摘要必须有唯一 ID、课程归属、至少两个关键词、至少一个来源和页码定位。
- 摘要使用原创表述，长度受 manifest contract test 限制；不得把教材连续段落直接复制到站点。
- 来源不明、只有标题没有正文证据、或无法确认发布边界的材料保持研究清单状态，不进入公共知识卡片。
- 同一概念来自多册教材时保留多个来源 ID，不通过文本相似度静默覆盖原证据。
