const state = {
  data: null,
  provinceManifest: null,
  geographyData: null,
  geographyCourse: "",
  geographySourceFilter: "all",
  loadedProvince: "",
  provinceShardCache: new Map(),
  view: "overview",
  query: "",
  discipline: "",
  disciplineBrowse: "08",
  disciplineFamily: "",
  domain: "",
  recommendation: null,
  recommendationShortlist: { profileKey: "", items: [] },
  recommendationInvalidated: false,
  prefillProfile: null,
  renderedViews: new Set(),
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const RUNTIME_RELEASE_BASE = String(globalThis.__GAOKAO_RUNTIME_RELEASE_BASE__ || "./data/release-v3.275").replace(/\/+$/, "");

function runtimeAssetUrl(relativePath) {
  if (!RUNTIME_RELEASE_BASE) return `./data/${relativePath}`;
  const fileName = relativePath.split("/").at(-1);
  return `${RUNTIME_RELEASE_BASE}/${fileName}.gz`;
}

async function fetchRuntimeJson(relativePath, label) {
  const response = await fetch(runtimeAssetUrl(relativePath), { cache: "no-store" });
  if (!response.ok) throw new Error(`${label}载入失败（HTTP ${response.status}）`);
  if (!RUNTIME_RELEASE_BASE) return response.json();
  if (!response.body || typeof DecompressionStream !== "function") {
    throw new Error(`${label}需要支持 gzip 流解压的现代浏览器`);
  }
  return new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).json();
}

async function fetchGeographyKnowledge() {
  const response = await fetch("./data/geography/knowledge.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`高中地理资料载入失败（HTTP ${response.status}）`);
  return response.json();
}

function formatGeographyVersionDate(version) {
  const match = /^geo-(\d{4})\.(\d{1,2})\.(\d{1,2})(?:\.\d+)?$/.exec(String(version || ""));
  if (!match) return "";
  return `${Number(match[1])}/${Number(match[2])}/${Number(match[3])}`;
}

function renderFreshnessLabel(coreGeneratedAt, geographyVersion) {
  const coreLabel = `更新于 ${new Date(coreGeneratedAt).toLocaleString("zh-CN")}`;
  const geographyDate = formatGeographyVersionDate(geographyVersion);
  return geographyDate ? `${coreLabel} · 高中地理 ${geographyDate}` : coreLabel;
}

const CHILD_TYPES = ["稳健型", "均衡探索型", "冲刺型", "专业兴趣强", "城市资源型", "家庭预算敏感", "学术深造型", "就业导向型"];
const SUBJECT_TYPES = ["物理类", "历史类", "物理/理科", "历史/文科", "综合", "不确定"];
const RANK_LEVEL_LABELS = { undergraduate: "本科加分", vocational: "专科加分" };
const STRATEGIES = ["稳健", "均衡", "冲刺"];
const BUDGET_LEVELS = ["不敏感", "中等敏感", "高度敏感"];
const ELECTIVE_SUBJECTS = ["化学", "生物", "思想政治", "地理"];
const ALL_PROVINCES = [
  "北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "上海", "江苏",
  "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "广西",
  "海南", "重庆", "四川", "贵州", "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆",
];

const PROVINCE_SCORE_SCALES = {
  上海: 660,
  海南: 900,
};

const DEFAULT_PROFILE = {
  childType: "均衡探索型",
  score: "593",
  guangxiLocalScore: "",
  vocationalScore: "",
  rank: "",
  xizangRankSource: "",
  guangxiLocalRank: "",
  province: "江西",
  candidateCategory: "",
  subject: "物理/理科",
  electives: "化学 生物",
  disciplineFocus: "08",
  interest: "计算机 软件 数据 数字媒体 虚拟现实",
  cities: "南昌 武汉 长沙 重庆 西安 杭州",
  redLines: "不接受高学费中外合作，不接受明显冷门且无法转专业",
  budget: "中等敏感",
  strategy: "均衡",
  abilityProfile: "语文120 英语124 数学102 物理77 化学82 生物88；语英较强，数学物理中等，化生基础较稳。",
};

const RECOMMEND_PROFILE_STORAGE_KEY = "gaokao-zhiyuan-site:recommend-profile:v1";
const RECOMMEND_SHORTLIST_STORAGE_KEY = "gaokao-zhiyuan-site:recommend-shortlist:v1";
const SHORTLIST_MAX_ITEMS = 30;
const SHORTLIST_MAX_PROFILES = 8;

function loadSavedRecommendationProfile() {
  try {
    const raw = globalThis.localStorage?.getItem(RECOMMEND_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw);
    return profile && typeof profile === "object" && !Array.isArray(profile) ? profile : null;
  } catch {
    return null;
  }
}

function saveRecommendationProfile(profile) {
  try {
    if (profile && typeof profile === "object" && !Array.isArray(profile)) {
      globalThis.localStorage?.setItem(RECOMMEND_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    }
  } catch {
    // Local draft persistence is optional; private browsing and storage quotas must not block recommendations.
  }
}

function clearSavedRecommendationProfile() {
  try {
    globalThis.localStorage?.removeItem(RECOMMEND_PROFILE_STORAGE_KEY);
  } catch {
    // Ignore unavailable local storage so reset still restores the example profile.
  }
}

function shortlistProfileKey(profile) {
  return [
    profile?.province,
    profile?.candidateCategory,
    profile?.subject,
    profile?.electives,
    profile?.score,
    profile?.rankInput || profile?.rank,
    profile?.disciplineFocus,
    profile?.interest,
    profile?.cities,
    profile?.budget,
    profile?.strategy,
    profile?.redLines,
  ].map(normalizeText).join("|");
}

function normalizeShortlistItem(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const key = String(item.key || "").trim();
  if (!key) return null;
  return {
    key,
    schoolName: String(item.schoolName || "").trim(),
    majorName: String(item.majorName || "").trim(),
    tierLabel: String(item.tierLabel || "").trim(),
    readinessLabel: String(item.readinessLabel || "").trim(),
    sourceUrl: String(item.sourceUrl || "").trim(),
    sourceLabel: String(item.sourceLabel || "").trim(),
  };
}

function normalizeShortlistItems(items) {
  const unique = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const normalized = normalizeShortlistItem(item);
    if (!normalized || unique.has(normalized.key)) continue;
    unique.set(normalized.key, normalized);
    if (unique.size >= SHORTLIST_MAX_ITEMS) break;
  }
  return [...unique.values()];
}

function readRecommendationShortlistStore() {
  try {
    const raw = globalThis.localStorage?.getItem(RECOMMEND_SHORTLIST_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed.profiles && typeof parsed.profiles === "object" && !Array.isArray(parsed.profiles)
      ? parsed.profiles
      : {};
  } catch {
    return {};
  }
}

function writeRecommendationShortlistStore(profiles) {
  try {
    globalThis.localStorage?.setItem(RECOMMEND_SHORTLIST_STORAGE_KEY, JSON.stringify({
      version: 1,
      profiles,
    }));
  } catch {
    // Local shortlist persistence is optional and must never block recommendations.
  }
}

function loadRecommendationShortlist(profile) {
  const profileKey = shortlistProfileKey(profile);
  const profiles = readRecommendationShortlistStore();
  return normalizeShortlistItems(profiles[profileKey]);
}

function saveRecommendationShortlist(profile, items) {
  const profileKey = shortlistProfileKey(profile);
  const profiles = readRecommendationShortlistStore();
  profiles[profileKey] = normalizeShortlistItems(items);
  const profileKeys = Object.keys(profiles);
  while (profileKeys.length > SHORTLIST_MAX_PROFILES) {
    delete profiles[profileKeys.shift()];
  }
  writeRecommendationShortlistStore(profiles);
}

function clearRecommendationShortlist(profile) {
  const profiles = readRecommendationShortlistStore();
  delete profiles[shortlistProfileKey(profile)];
  if (Object.keys(profiles).length) {
    writeRecommendationShortlistStore(profiles);
  } else {
    try {
      globalThis.localStorage?.removeItem(RECOMMEND_SHORTLIST_STORAGE_KEY);
    } catch {
      // Ignore unavailable local storage so reset still works.
    }
  }
}

const DISCIPLINE_MAJOR_CATALOG = {
  "01": [
    { key: "philosophy", name: "哲学类", majors: ["哲学", "逻辑学", "宗教学", "伦理学"] },
  ],
  "02": [
    { key: "economics", name: "经济学类", majors: ["经济学", "经济统计学", "国民经济管理", "数字经济"] },
    { key: "finance-public", name: "财政学类", majors: ["财政学", "税收学", "国际税收"] },
    { key: "finance", name: "金融学类", majors: ["金融学", "金融工程", "保险学", "投资学", "金融科技"] },
    { key: "trade", name: "经济与贸易类", majors: ["国际经济与贸易", "贸易经济", "国际经济发展合作"] },
  ],
  "03": [
    { key: "law", name: "法学类", majors: ["法学", "知识产权", "信用风险管理与法律防控", "国际经贸规则"] },
    { key: "politics", name: "政治学类", majors: ["政治学与行政学", "国际政治", "外交学", "国际事务与国际关系"] },
    { key: "sociology", name: "社会学类", majors: ["社会学", "社会工作", "人类学", "女性学"] },
    { key: "marxism", name: "马克思主义理论类", majors: ["科学社会主义", "中国共产党历史", "思想政治教育", "马克思主义理论"] },
    { key: "public-security", name: "公安学类", majors: ["治安学", "侦查学", "边防管理", "公安情报学", "犯罪学"] },
  ],
  "04": [
    { key: "education", name: "教育学类", majors: ["教育学", "科学教育", "教育技术学", "学前教育", "小学教育", "特殊教育"] },
    { key: "sports", name: "体育学类", majors: ["体育教育", "运动训练", "社会体育指导与管理", "运动人体科学", "冰雪运动"] },
  ],
  "05": [
    { key: "chinese", name: "中国语言文学类", majors: ["汉语言文学", "汉语言", "汉语国际教育", "古典文献学", "秘书学"] },
    { key: "foreign-language", name: "外国语言文学类", majors: ["英语", "俄语", "德语", "法语", "西班牙语", "翻译", "商务英语"] },
    { key: "journalism", name: "新闻传播学类", majors: ["新闻学", "广播电视学", "广告学", "传播学", "网络与新媒体", "国际新闻与传播"] },
  ],
  "06": [
    { key: "history", name: "历史学类", majors: ["历史学", "世界史", "考古学", "文物与博物馆学", "文化遗产"] },
  ],
  "07": [
    { key: "mathematics", name: "数学类", majors: ["数学与应用数学", "信息与计算科学", "数理基础科学", "数据计算及应用"] },
    { key: "physics", name: "物理学类", majors: ["物理学", "应用物理学", "核物理", "声学", "量子信息科学"] },
    { key: "chemistry", name: "化学类", majors: ["化学", "应用化学", "化学生物学", "分子科学与工程", "能源化学"] },
    { key: "earth-space", name: "地球与空间科学", majors: ["天文学", "地理科学", "自然地理与资源环境", "大气科学", "海洋科学", "地球物理学", "地质学"] },
    { key: "biology", name: "生物科学类", majors: ["生物科学", "生物技术", "生物信息学", "生态学", "整合科学"] },
    { key: "psychology-statistics", name: "心理与统计", majors: ["心理学", "应用心理学", "统计学", "应用统计学"] },
  ],
  "08": [
    { key: "computer", name: "计算机类", majors: ["计算机科学与技术", "软件工程", "网络工程", "信息安全", "物联网工程", "数字媒体技术", "数据科学与大数据技术", "人工智能", "智能科学与技术", "虚拟现实技术"] },
    { key: "electronics", name: "电子信息类", majors: ["电子信息工程", "电子科学与技术", "通信工程", "微电子科学与工程", "光电信息科学与工程", "集成电路设计与集成系统"] },
    { key: "automation", name: "自动化类", majors: ["自动化", "机器人工程", "智能装备与系统", "工业智能"] },
    { key: "mechanical", name: "机械类", majors: ["机械工程", "机械设计制造及其自动化", "材料成型及控制工程", "车辆工程", "智能制造工程"] },
    { key: "civil-water", name: "土木水利与建筑", majors: ["土木工程", "建筑环境与能源应用工程", "给排水科学与工程", "水利水电工程", "测绘工程", "建筑学", "城乡规划"] },
    { key: "materials-energy", name: "材料与能源动力", majors: ["材料科学与工程", "高分子材料与工程", "新能源材料与器件", "能源与动力工程", "新能源科学与工程", "储能科学与工程"] },
    { key: "chemical-bio", name: "化工与生物工程", majors: ["化学工程与工艺", "制药工程", "资源循环科学与工程", "生物工程", "合成生物学"] },
    { key: "transport-aerospace", name: "交通海洋与航空航天", majors: ["交通运输", "交通工程", "航海技术", "船舶与海洋工程", "航空航天工程", "飞行器设计与工程"] },
    { key: "environment-safety", name: "环境安全与公安技术", majors: ["环境工程", "环境科学", "安全工程", "应急技术与管理", "刑事科学技术", "消防工程"] },
  ],
  "09": [
    { key: "plant", name: "植物生产类", majors: ["农学", "园艺", "植物保护", "植物科学与技术", "种子科学与工程", "智慧农业"] },
    { key: "nature", name: "自然保护与环境生态类", majors: ["农业资源与环境", "野生动物与自然保护区管理", "水土保持与荒漠化防治", "生物质科学与工程"] },
    { key: "animal", name: "动物生产与医学", majors: ["动物科学", "蚕学", "动物医学", "动物药学", "实验动物学", "兽医公共卫生"] },
    { key: "forestry-aquatic", name: "林学水产与草学", majors: ["林学", "园林", "森林保护", "水产养殖学", "海洋渔业科学与技术", "草业科学"] },
  ],
  "10": [
    { key: "basic-clinical", name: "基础与临床医学", majors: ["基础医学", "生物医学", "临床医学", "麻醉学", "医学影像学", "儿科学", "精神医学"] },
    { key: "stomatology-public", name: "口腔与公共卫生", majors: ["口腔医学", "预防医学", "食品卫生与营养学", "妇幼保健医学", "卫生监督"] },
    { key: "tcm", name: "中医学与中西医结合", majors: ["中医学", "针灸推拿学", "藏医学", "蒙医学", "中西医临床医学"] },
    { key: "pharmacy", name: "药学类", majors: ["药学", "药物制剂", "临床药学", "药事管理", "中药学", "中药资源与开发"] },
    { key: "medical-tech-nursing", name: "医学技术与护理", majors: ["医学检验技术", "医学影像技术", "康复治疗学", "智能医学工程", "护理学", "助产学"] },
  ],
  "11": [
    { key: "command", name: "指挥与作战方向", majors: ["作战指挥", "指挥信息系统工程", "侦察情报", "火力指挥与控制工程"] },
    { key: "military-tech", name: "军事技术方向", majors: ["武器系统与工程", "雷达工程", "导弹工程", "无人系统工程", "信息对抗技术"] },
    { key: "logistics", name: "后勤与保障方向", majors: ["军事设施工程", "国防工程及其智能化", "装备保障工程", "管理科学与工程"] },
  ],
  "12": [
    { key: "management-science", name: "管理科学与工程类", majors: ["管理科学", "信息管理与信息系统", "工程管理", "大数据管理与应用", "应急管理"] },
    { key: "business", name: "工商管理类", majors: ["工商管理", "市场营销", "会计学", "财务管理", "人力资源管理", "审计学", "资产评估"] },
    { key: "public-admin", name: "公共管理类", majors: ["公共事业管理", "行政管理", "劳动与社会保障", "土地资源管理", "健康服务与管理"] },
    { key: "logistics-ecommerce", name: "物流电商与工业工程", majors: ["物流管理", "供应链管理", "工业工程", "电子商务", "跨境电子商务"] },
    { key: "tourism-agri", name: "旅游与农林经济管理", majors: ["旅游管理", "酒店管理", "会展经济与管理", "农林经济管理", "农村区域发展"] },
  ],
  "13": [
    { key: "art-theory", name: "艺术学理论类", majors: ["艺术史论", "艺术管理", "非物质文化遗产保护"] },
    { key: "music-dance", name: "音乐与舞蹈学类", majors: ["音乐表演", "音乐学", "作曲与作曲技术理论", "舞蹈表演", "舞蹈学"] },
    { key: "drama-film", name: "戏剧与影视学类", majors: ["表演", "戏剧影视文学", "广播电视编导", "播音与主持艺术", "动画", "影视摄影与制作"] },
    { key: "fine-art", name: "美术学类", majors: ["美术学", "绘画", "雕塑", "摄影", "中国画", "实验艺术"] },
    { key: "design", name: "设计学类", majors: ["视觉传达设计", "环境设计", "产品设计", "服装与服饰设计", "数字媒体艺术", "艺术与科技"] },
  ],
  "14": [
    { key: "integrated-circuit", name: "集成电路科学与工程", majors: ["集成电路科学与工程相关方向"] },
    { key: "national-security", name: "国家安全学", majors: ["国家安全学相关方向"] },
    { key: "design-intelligence", name: "设计与智能交叉", majors: ["智能交互设计", "科技艺术", "数字人文相关方向"] },
    { key: "future-health", name: "未来健康与工程交叉", majors: ["生物医学工程交叉方向", "智能医学交叉方向", "健康数据科学相关方向"] },
  ],
};

const HIGH_TUITION_THRESHOLD = 30000;
const RANK_FIT_RATIO_THRESHOLDS = {
  safe: 0.82,
  steady: 0.94,
  borderline: 1.03,
  reach: 1.18,
};

const CANDIDATE_POOLS = [
  {
    id: "elite-platform",
    title: "985/211/双一流/C9 高平台院校池",
    stance: "冲刺/上探",
    bands: ["elite", "upper"],
    disciplines: ["07", "08", "10", "02", "12"],
    profiles: ["冲刺型", "学术深造型", "均衡探索型"],
    cities: ["北京", "上海", "南京", "武汉", "西安", "广州"],
    keywords: ["985", "211", "双一流", "C9", "学科评估", "博士点", "选择大学", "核心要素"],
    examples: ["双一流/985/211/C9 层次", "强学科平台", "高平台冲刺项"],
    risks: ["必须用当年本省位次和专业组核验可报边界", "不能只看学校光环，要确认专业和调剂可接受度"],
  },
  {
    id: "shanghai-city",
    title: "上海高校与长三角城市资源院校池",
    stance: "城市资源/就业实习",
    bands: ["elite", "upper", "middle"],
    disciplines: ["02", "08", "12", "05"],
    profiles: ["城市资源型", "就业导向型", "冲刺型", "均衡探索型"],
    cities: ["上海", "长三角", "苏州", "杭州"],
    keywords: ["上海高校", "上海", "城市", "实习", "就业", "金融", "国际商务", "会计"],
    examples: ["上海高校方向", "长三角产业与实习资源", "商科/工科城市平台"],
    risks: ["生活成本和竞争强度较高", "热门专业更需要位次安全边界"],
  },
  {
    id: "wuhan-city",
    title: "武汉高校与中部强区域院校池",
    stance: "稳妥平台/专业平衡",
    bands: ["upper", "middle", "foundation"],
    disciplines: ["07", "08", "10", "03", "12"],
    profiles: ["稳健型", "均衡探索型", "就业导向型", "专业兴趣强"],
    cities: ["武汉", "中部", "湖北", "省会"],
    keywords: ["武汉市的几所高校", "武汉", "二本三本", "城市", "大学", "专业大学与城市"],
    examples: ["武汉高校方向", "中部省会资源", "稳妥专业组合"],
    risks: ["要区分校区、批次和专业组层次", "二本三本材料需按当前政策口径复核"],
  },
  {
    id: "hongkong-macao",
    title: "港澳高校路径院校池",
    stance: "特殊机会/高成本",
    bands: ["elite", "upper", "middle"],
    disciplines: ["02", "08", "12", "05"],
    profiles: ["冲刺型", "城市资源型", "学术深造型"],
    cities: ["香港", "澳门", "港澳"],
    keywords: ["港澳", "港澳台院校", "港澳大学", "港大", "港澳学校专业汇总", "低分高就"],
    examples: ["港澳高校路径", "港澳学校专业汇总", "另辟蹊径读名校"],
    risks: ["学费和生活成本高，预算敏感家庭要谨慎", "申请规则、证书和培养地点必须逐项核验"],
    highCost: true,
  },
  {
    id: "science-research",
    title: "07 理学基础学科与深造院校池",
    stance: "基础学科/深造",
    bands: ["elite", "upper", "middle"],
    disciplines: ["07"],
    profiles: ["学术深造型", "专业兴趣强", "均衡探索型"],
    cities: ["北京", "上海", "武汉", "南京", "省会"],
    keywords: ["理学", "数学", "物理", "化学", "生物", "地质", "心理学", "深造"],
    examples: ["数学/物理/化学/生物方向", "地质/心理学资料方向", "基础学科深造路径"],
    risks: ["需要确认孩子是否愿意长期深造和承受基础课程", "理学不等同于所有理科可报专业"],
  },
  {
    id: "engineering-industry",
    title: "08 工学产业就业院校池",
    stance: "产业就业/工程实践",
    bands: ["elite", "upper", "middle", "foundation"],
    disciplines: ["08"],
    profiles: ["就业导向型", "专业兴趣强", "城市资源型", "均衡探索型"],
    cities: ["上海", "武汉", "长三角", "省会"],
    keywords: ["工学", "工科", "计算机", "机械", "土木", "建筑", "材料", "电力", "产业"],
    examples: ["计算机/机械/电气/土木/材料方向", "产业城市匹配", "工程实践路径"],
    risks: ["行业周期差异大，不能只按热门冷门判断", "要看归属学院、课程和实习资源"],
  },
  {
    id: "business-city",
    title: "经管商科城市平台院校池",
    stance: "商科证书/城市平台",
    bands: ["elite", "upper", "middle"],
    disciplines: ["02", "12"],
    profiles: ["就业导向型", "城市资源型", "专业兴趣强", "均衡探索型"],
    cities: ["上海", "武汉", "省会", "长三角"],
    keywords: ["经济", "金融", "会计", "审计", "财务管理", "国际商务", "商科", "证书"],
    examples: ["金融/经济学方向", "会计审计财务管理方向", "国际商务方向"],
    risks: ["商科更依赖城市、平台、实习和证书", "相近专业名称出口不同，需要看培养方案"],
  },
  {
    id: "teacher-stable",
    title: "师范/公费师范稳定路径院校池",
    stance: "稳定就业/协议路径",
    bands: ["upper", "middle", "foundation"],
    disciplines: ["04", "05"],
    profiles: ["稳健型", "就业导向型", "家庭预算敏感"],
    cities: ["吉林", "长春", "内蒙古", "省内", "省会"],
    keywords: ["师范", "公费师范", "教师", "教育", "吉林省师范", "长春", "内蒙古师范", "协议"],
    examples: ["吉林/长春师范院校方向", "内蒙古师范院校方向", "省属公费师范生路径"],
    risks: ["公费师范要核验协议、服务期和就业地域", "普通师范也要看学科平台和教师资格路径"],
  },
  {
    id: "medicine-police",
    title: "医学/军警强约束院校池",
    stance: "强约束/长周期",
    bands: ["elite", "upper", "middle"],
    disciplines: ["10", "03"],
    profiles: ["稳健型", "学术深造型", "就业导向型"],
    cities: ["省内", "省会"],
    keywords: ["医学", "本博连读", "军校", "警校", "体检", "体测", "政审", "规培"],
    examples: ["医学本博连读院校名单", "警校体检体测标准", "军校名单及体检标准"],
    risks: ["体检、政审、服务期和长学制是硬约束", "医学路径要看规培、医院资源和学习年限"],
  },
  {
    id: "vocational-dual",
    title: "高职双高/专升本技能路径院校池",
    stance: "职业技能/升学兜底",
    bands: ["middle", "foundation"],
    disciplines: ["08", "12"],
    profiles: ["稳健型", "就业导向型", "家庭预算敏感"],
    cities: ["省内", "省会", "区域"],
    keywords: ["专科", "高职", "职业教育", "双高", "专升本", "技能", "就业"],
    examples: ["高职专科方向", "双高技能路径", "专升本备选路径"],
    risks: ["高职专科应按职业路径评价，不要套本科排名逻辑", "需要核验升学通道和区域产业"],
  },
  {
    id: "regional-safe",
    title: "省内/区域稳妥院校池",
    stance: "稳妥保底/家庭可执行",
    bands: ["upper", "middle", "foundation"],
    disciplines: ["01", "02", "03", "04", "05", "07", "08", "10", "12"],
    profiles: ["稳健型", "家庭预算敏感", "均衡探索型"],
    cities: ["省内", "省会", "昆明", "吉林", "长春", "内蒙古", "武汉"],
    keywords: ["省", "区域", "昆明市的高校", "吉林", "长春", "内蒙古", "稳", "保", "兜底"],
    examples: ["省内稳妥高校方向", "昆明/吉林/长春/内蒙古区域材料", "可执行保底方案"],
    risks: ["保底项也必须是孩子愿意就读的学校和专业", "要核验调剂后最低可接受专业"],
  },
];

const SCHOOL_RECOMMENDATIONS = {
  "elite-platform": [
    { name: "中山大学", tags: ["985", "综合平台"], focus: "高平台综合院校，需核验目标专业最低位次。" },
    { name: "武汉大学", tags: ["985", "武汉"], focus: "高平台与城市资源并重，需看专业组和调剂范围。" },
    { name: "南开大学", tags: ["985", "综合平台"], focus: "适合高位段上探，先查同省近三年位次。" },
    { name: "厦门大学", tags: ["985", "综合平台"], focus: "适合平台优先型，注意专业冷热和校区。" },
  ],
  "shanghai-city": [
    { name: "上海交通大学", tags: ["上海", "高平台"], focus: "工科/医学/综合平台强，通常需高位次核验。" },
    { name: "同济大学", tags: ["上海", "工学"], focus: "工科和城市资源突出，需核验专业组分数。" },
    { name: "华东理工大学", tags: ["上海", "工学"], focus: "化工材料等方向可重点核验专业录取分。" },
    { name: "上海大学", tags: ["上海", "综合"], focus: "城市资源强，适合作为稳妥或备选核验。" },
  ],
  "wuhan-city": [
    { name: "华中科技大学", tags: ["武汉", "工学"], focus: "工科/医学强平台，需用专业组投档和专业分核验。" },
    { name: "武汉大学", tags: ["武汉", "综合"], focus: "综合平台强，适合高分段核验。" },
    { name: "武汉理工大学", tags: ["武汉", "工学"], focus: "工科产业方向明确，适合工程实践型学生核验。" },
    { name: "湖北大学", tags: ["武汉", "区域稳妥"], focus: "区域稳妥方向，需核验专业和分差。" },
  ],
  "hongkong-macao": [
    { name: "香港大学", tags: ["港澳", "高成本"], focus: "高平台国际化路径，费用和申请规则先核验。" },
    { name: "香港中文大学", tags: ["港澳", "计划内/申请"], focus: "需区分计划内招生和申请路径。" },
    { name: "香港科技大学", tags: ["港澳", "理工商"], focus: "理工商方向突出，先核验申请、语言和预算。" },
    { name: "澳门大学", tags: ["港澳", "预算核验"], focus: "可作为港澳路径备选，需核验费用和专业。" },
  ],
  "science-research": [
    { name: "中国科学技术大学", tags: ["理学", "高平台"], focus: "基础学科和深造导向强，需高位次核验。" },
    { name: "吉林大学", tags: ["理学", "综合"], focus: "法学/历史/基础学科资料中多次出现，需看目标专业分。" },
    { name: "云南大学", tags: ["区域", "理学"], focus: "区域与生态/地学等方向可核验。" },
  ],
  "engineering-industry": [
    { name: "上海交通大学", tags: ["工学", "上海"], focus: "高平台工程方向，先查专业组和专业最低位次。" },
    { name: "华中科技大学", tags: ["工学", "武汉"], focus: "工程和产业资源强，适合上探核验。" },
    { name: "武汉理工大学", tags: ["工学", "武汉"], focus: "工程实践和区域产业匹配度高。" },
    { name: "中北大学", tags: ["工学", "兵工特色"], focus: "资料中作为校名误判案例，适合核验特色专业。" },
  ],
  "business-city": [
    { name: "上海财经大学", tags: ["商科", "上海"], focus: "财经平台强，需核验专业录取分和城市成本。" },
    { name: "中南财经政法大学", tags: ["商科", "武汉"], focus: "经法商交叉平台，适合经管法方向核验。" },
    { name: "上海对外经贸大学", tags: ["商科", "上海"], focus: "外贸/商务方向城市匹配，需核验分数与语种要求。" },
  ],
  "teacher-stable": [
    { name: "华东师范大学", tags: ["师范", "985"], focus: "高平台师范，需核验专业分和公费/普通路径。" },
    { name: "东北师范大学", tags: ["师范", "211"], focus: "师范强校，适合稳定路径核验。" },
    { name: "吉林师范类院校", tags: ["区域师范"], focus: "资料有吉林/长春师范院校方向，适合省内就业核验。" },
    { name: "内蒙古师范大学", tags: ["区域师范"], focus: "区域师范方向，需看省份计划和服务地域。" },
  ],
  "medicine-police": [
    { name: "北京大学医学部", tags: ["医学", "高平台"], focus: "医学高平台，需极高位次和长学制核验。" },
    { name: "上海交通大学医学院", tags: ["医学", "上海"], focus: "临床医学强，需核验专业最低位次和学制。" },
    { name: "军校名单院校", tags: ["军校", "体检政审"], focus: "先核验体检、政审、服务期和招生计划。" },
    { name: "警校名单院校", tags: ["警校", "体测"], focus: "先核验体测、体检、政审和省份计划。" },
  ],
  "vocational-dual": [
    { name: "双高计划高职院校", tags: ["高职", "双高"], focus: "以专业群、区域产业和专升本通道核验。" },
    { name: "省内优质高职院校", tags: ["省内", "就业"], focus: "适合预算敏感和就业导向，需查专业就业和升学。" },
    { name: "职业教育本科/专升本路径", tags: ["升学"], focus: "作为兜底或技能路径继续核验。" },
  ],
  "regional-safe": [
    { name: "省内公办本科院校", tags: ["省内", "稳妥"], focus: "保底要先确认孩子愿读专业和调剂范围。" },
    { name: "昆明市高校方向", tags: ["昆明", "区域"], focus: "资料有昆明高校介绍，适合区域机会核验。" },
    { name: "湖北大学", tags: ["武汉", "区域"], focus: "资料有录取案例，需用本省分数表核验。" },
    { name: "云南大学", tags: ["区域", "综合"], focus: "区域综合平台，需看省份计划和专业分。" },
  ],
};

function fmtNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(value ?? 0);
}

function fmtBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function statusLabel(status) {
  const map = {
    "text-extracted": "正文已抽取",
    "ocr-extracted": "OCR已抽取",
    "asr-transcribed": "ASR已转写",
    "asr-partial-transcribed": "ASR部分转写",
    "audio-indexed-needs-transcript": "音频待转写",
    "image-indexed-needs-chinese-ocr": "图片待OCR",
    "pdf-indexed-needs-chinese-ocr": "PDF待OCR",
    "indexed-only": "仅索引",
    "text-empty-or-unreadable": "文本不足",
    "fallback-strings": "兜底抽取",
    "extract-error": "抽取失败",
  };
  return map[status] || status || "未知";
}

function sourceById(id) {
  return knowledgeSourceFiles().find((item) => item.id === id);
}

function knowledgeSourceFiles() {
  return (state.data?.sourceFiles || []).filter((item) => item && typeof item === "object" && !Array.isArray(item));
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseList(value) {
  return String(value ?? "")
    .split(/[\s,，、;；/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeElectiveSubject(value) {
  const text = normalizeText(value);
  if (/化学/.test(text)) return "化学";
  if (/生物/.test(text)) return "生物";
  if (/政治|思想政治/.test(text)) return "思想政治";
  if (/地理/.test(text)) return "地理";
  return "";
}

function selectedElectiveSubjects(profile) {
  return [...new Set(parseList(profile?.electives)
    .map(normalizeElectiveSubject)
    .filter(Boolean))];
}

function electiveRequirementForProfile(record, profile) {
  const requirement = String(record?.electiveRequirement || "").trim();
  if (!requirement || /不限|不提.*科目|无选科要求/.test(requirement)) {
    return { state: "not-required", text: "选科不限或未公开要求" };
  }
  const primaryRequired = [
    /物理/.test(requirement) ? "物理" : "",
    /历史/.test(requirement) ? "历史" : "",
  ].filter(Boolean);
  if (primaryRequired.length) {
    const selectedPrimary = normalizeSubject(profile?.subject);
    if (!selectedPrimary || selectedPrimary === "综合") {
      return { state: "needs-check", text: `未确认首选科目，无法核验“${requirement}”` };
    }
    if (!primaryRequired.includes(selectedPrimary)) {
      return { state: "unmatched", text: `不符合首选科目要求：${requirement}` };
    }
  }
  const required = [...new Set(ELECTIVE_SUBJECTS.filter((subject) =>
    subject === "思想政治" ? /思想政治|政治/.test(requirement) : requirement.includes(subject)
  ))];
  if (!required.length) {
    if (primaryRequired.length) {
      return { state: "matched", text: `符合首选科目要求：${requirement}` };
    }
    return { state: "needs-check", text: `选科要求“${requirement}”无法自动判定，需核验招生目录` };
  }
  const selected = selectedElectiveSubjects(profile);
  if (!selected.length) {
    return { state: "needs-check", text: `未填写再选科目，无法核验“${requirement}”` };
  }
  const requiresAll = /均须|全部.*选考|同时选考|2门科目.*均/.test(requirement);
  const allowsAny = /或|其中|任选|至少.*门|1门科目/.test(requirement);
  let matched;
  if (requiresAll) matched = required.every((subject) => selected.includes(subject));
  else if (allowsAny) matched = required.some((subject) => selected.includes(subject));
  else if (required.length === 1) matched = selected.includes(required[0]);
  else return { state: "needs-check", text: `选科要求“${requirement}”存在多科表述，需核验招生目录` };
  return matched
    ? { state: "matched", text: `符合选科要求：${requirement}` }
    : { state: "unmatched", text: `不符合选科要求：${requirement}` };
}

function electiveRequirementAllowsProfile(record, profile) {
  return electiveRequirementForProfile(record, profile).state !== "unmatched";
}

function isSelected(value, current) {
  return value === current ? "selected" : "";
}

function getProfileValue(profile, key) {
  return profile?.[key] ?? DEFAULT_PROFILE[key] ?? "";
}

function rankUsageOptionValue(option) {
  return `${option.usage}|${option.category || ""}|${option.level || ""}`;
}

function rankUsageProfileValue(profile) {
  const usage = profile?.rankUsage || "ordinary";
  const category = profile?.rankCategory || "";
  const level = profile?.rankLevelUsage || "";
  return `${usage}|${category}|${level}`;
}

const SPECIAL_RANK_USAGE_ORDER = {
  ordinary: 0,
  sports: 1,
  art: 2,
  "art-professional": 3,
  "art-cultural": 4,
  spring: 5,
};

function availableRankUsageOptions() {
  const options = new Map();
  const add = (option) => {
    const key = rankUsageOptionValue(option);
    if (!options.has(key)) options.set(key, option);
  };
  add({ usage: "ordinary", category: "", level: "", label: "普通类文化成绩" });
  for (const record of rankConversionRecords()) {
    if (!Object.prototype.hasOwnProperty.call(SPECIAL_RANK_USAGE_ORDER, record.rankUsage)) continue;
    if (record.rankUsage === "ordinary") continue;
    const category = record.rankCategory || (record.rankUsage === "sports" ? "体育类" : "");
    if (!category) continue;
    const level = record.rankLevelUsage || "";
    const levelText = level ? `（${RANK_LEVEL_LABELS[level] || record.rankLevelUsageLabel || level}）` : "";
    const baseLabel = record.rankUsageLabel
      ? String(record.rankUsageLabel).replace(/（(本科|专科)加分）$/, "")
      : `${category}成绩`;
    add({
      usage: record.rankUsage,
      category,
      level,
      label: `${baseLabel}${levelText}`,
    });
  }
  return [...options.values()].sort((a, b) => {
    return (SPECIAL_RANK_USAGE_ORDER[a.usage] ?? 9) - (SPECIAL_RANK_USAGE_ORDER[b.usage] ?? 9) ||
      String(a.category || "").localeCompare(String(b.category || ""), "zh-Hans-CN") ||
      String(a.level || "").localeCompare(String(b.level || ""), "zh-Hans-CN");
  });
}

function sourceSearchText(source) {
  return [
    source.title,
    source.relativePath,
    source.excerpt,
    source.domains.map((d) => d.label).join(" "),
    source.disciplines.map((d) => `${d.code} ${d.name}`).join(" "),
  ].join(" ").toLowerCase();
}

function sourceScore(source, keywords) {
  const title = normalizeText(source.title);
  const path = normalizeText(source.relativePath);
  const excerpt = normalizeText(source.excerpt);
  const labels = normalizeText([
    source.domains.map((d) => d.label).join(" "),
    source.disciplines.map((d) => `${d.code} ${d.name}`).join(" "),
  ].join(" "));
  let score = 0;
  const hits = [];
  for (const keyword of keywords) {
    const key = normalizeText(keyword);
    if (!key) continue;
    let matched = false;
    if (title.includes(key)) {
      score += 5;
      matched = true;
    }
    if (path.includes(key)) {
      score += 3;
      matched = true;
    }
    if (labels.includes(key)) {
      score += 3;
      matched = true;
    }
    if (excerpt.includes(key)) {
      score += 1;
      matched = true;
    }
    if (matched) hits.push(keyword);
  }
  return { score, hits };
}

function findEvidence(keywords, limit = 7) {
  return knowledgeSourceFiles()
    .map((source) => {
      const scored = sourceScore(source, keywords);
      return { source, score: scored.score, hits: scored.hits };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.source.textLength - a.source.textLength)
    .slice(0, limit);
}

function scoreScaleForProvince(province) {
  return PROVINCE_SCORE_SCALES[normalizeProvince(province)] || 750;
}

function scoreOnStandardScale(score, province) {
  const numericScore = Number(score) || 0;
  if (!numericScore) return 0;
  return numericScore * 750 / scoreScaleForProvince(province);
}

function classifyScoreBand(score, rank, province = "") {
  const numericScore = Number(score) || 0;
  const numericRank = Number(rank) || 0;
  const comparableScore = scoreOnStandardScale(numericScore, province);
  if (numericRank > 0 && numericRank <= 5000) {
    return { id: "elite", label: "高位段", order: 4, strategy: "优先看高平台、强学科和上限机会，同时保留稳妥专业兜底。" };
  }
  if (numericRank > 0 && numericRank <= 20000) {
    return { id: "upper", label: "上位段", order: 3, strategy: "适合在高平台、强区域城市和专业质量之间做平衡。" };
  }
  if (numericRank > 0 && numericRank <= 60000) {
    return { id: "middle", label: "中位段", order: 2, strategy: "优先看专业适配、城市资源、稳妥录取边界和可接受调剂。" };
  }
  if (numericRank > 0) {
    return { id: "foundation", label: "基础段", order: 1, strategy: "本科兜底、高职双高、专升本和技能就业路径要同步比较。" };
  }
  if (comparableScore > 0 && comparableScore < 300) {
    return { id: "foundation", label: "专科/技能段", order: 1, strategy: "优先看公办高职、双高专业群、专升本通道、区域产业和家庭可执行性。" };
  }
  if (comparableScore >= 650) {
    return { id: "elite", label: "高位段", order: 4, strategy: "优先看高平台、强学科和上限机会，同时保留稳妥专业兜底。" };
  }
  if (comparableScore >= 600) {
    return { id: "upper", label: "上位段", order: 3, strategy: "适合在高平台、强区域城市和专业质量之间做平衡。" };
  }
  if (comparableScore >= 540) {
    return { id: "middle", label: "中位段", order: 2, strategy: "优先看专业适配、城市资源、稳妥录取边界和可接受调剂。" };
  }
  return { id: "foundation", label: "基础段", order: 1, strategy: "本科兜底、高职双高、专升本和技能就业路径要同步比较。" };
}

function classifyProfileBand(profile) {
  const segmentStatus = ordinarySegmentStatus(profile);
  if (segmentStatus?.band === "first") {
    return { id: "foundation", label: "普通类第一段", order: 1, strategy: "第一段是考生分段边界，不是本科保证线；继续按位次、当年计划和具体院校专业投档线排序。" };
  }
  if (segmentStatus?.band === "second") {
    return { id: "foundation", label: "普通类第二段", order: 1, strategy: "同步比较第二段剩余本科计划、高职专科、专业层次、城市和专升本路径。" };
  }
  if (segmentStatus?.band === "below-second") {
    return { id: "foundation", label: "普通类第二段线以下", order: 1, strategy: "只作征求志愿扩围、高职单招、技能培养和复读再规划等路径调研。" };
  }
  if (isVocationalProfile(profile)) {
    return { id: "foundation", label: "专科/技能段", order: 1, strategy: "优先看公办高职、双高专业群、专升本通道、区域产业和家庭可执行性。" };
  }
  const band = classifyScoreBand(profile.score, usableRankForProfile(profile), profile.province);
  const bachelorLine = ordinaryBachelorControlLine(profile);
  if (band.label === "专科/技能段" && bachelorLine && Number(profile.score) >= bachelorLine.score) {
    const category = profile.candidateCategory ? `${profile.candidateCategory}` : "";
    return {
      id: "foundation",
      label: "本科控制线以上基础段",
      order: 1,
      strategy: `已达到${bachelorLine.year}年${profile.province || "本省"}${category}普通本科最低控制线${bachelorLine.score}分；控制线不是院校或专业录取线，仍需按正式位次、招生计划和投档线排序。`,
    };
  }
  return band;
}

function bandFit(candidate, band) {
  if (candidate.bands.includes(band.id)) return 92;
  const orderById = { foundation: 1, middle: 2, upper: 3, elite: 4 };
  const closest = Math.max(...candidate.bands.map((id) => orderById[id] || 0));
  const distance = Math.abs((orderById[band.id] || 0) - closest);
  return clamp(74 - distance * 18, 22, 78);
}

function hasStructuredAdmissionScores() {
  return (state.data?.admissionScoreLayer?.structuredRecords || 0) > 0;
}

function admissionRecords() {
  return state.data?.admissionScoreLayer?.records || [];
}

function rankConversionRecords() {
  return state.data?.admissionScoreLayer?.rankConversions || [];
}

function isControlLineRecord(record) {
  return record?.dataType === "control-line" || /control-line|控制线/.test(String(record?.sourceQuality || ""));
}

function isPlanRecord(record) {
  return record?.dataType === "admission-plan" || record?.planOnly === true;
}

function isVacancyPlanRecord(record) {
  const text = normalizeText([
    record?.planStage,
    record?.batch,
    record?.planRemark,
    record?.sourceQuality,
    record?.sourceId,
  ].join(" "));
  return record?.planStage === "征集志愿" ||
    record?.formalScoreScope === "vacancy-plan-only" ||
    /征集|补录|补充录取|剩余计划/.test(text);
}

function isSpecialPathRecord(record) {
  return record?.formalScoreScope === "special-path-only";
}

function planRestrictedEligibilityReason(record) {
  if (!isPlanRecord(record)) return "";
  if (isSpecialPathRecord(record)) return record?.specialPathReason || "特殊路径";

  const batch = String(record?.batch || "");
  const text = normalizeText([
    batch,
    record?.schoolName,
    record?.majorName,
    record?.majorGroup,
    ...(record?.schoolTags || []),
    record?.planRemark,
    record?.planRestrictionText,
  ].join(" "));

  if (/部队生源/.test(text)) return "部队生源计划";
  if (/对口高职/.test(text)) return "对口高职计划";
  if (/国家专项|地方专项|高校专项|边境专项/.test(batch)) return "专项计划";
  if (/预科/.test(batch)) return "预科计划";
  if (/提前.*(军校|艺体)|提前艺体/.test(batch)) return "提前军警或艺体计划";
  if (/提前录取/.test(batch)) return "提前录取计划";
  if (/定向就业|定向培养|公费师范|优师计划|免费师范|军士|飞行员/.test(text)) return "定向或资格计划";
  return "";
}

function isSchoolOfficialOnlyRecord(record) {
  return record?.formalScoreScope === "school-official-only";
}

function isThirdPartyAdmissionRecord(record) {
  return /third-party/.test(String(record?.sourceQuality || ""));
}

const CURRENT_PLAN_EVIDENCE_YEAR = 2026;
const RECENT_PLAN_EVIDENCE_YEARS = new Set([2025, 2026]);
let admissionPlanEvidenceIndexCache = { records: null, index: null };

function admissionPlanSchoolAliases(record) {
  return [
    record?.schoolCode ? `code:${normalizeAdmissionTrendTypography(record.schoolCode)}` : "",
    record?.schoolName ? `name:${normalizeAdmissionTrendTypography(record.schoolName)}` : "",
  ].filter(Boolean);
}

function admissionPlanMajorAliases(record) {
  return [
    record?.majorCode ? `code:${normalizeAdmissionTrendTypography(record.majorCode)}` : "",
    record?.majorName ? `name:${normalizeAdmissionTrendTypography(record.majorName)}` : "",
  ].filter(Boolean);
}

function admissionPlanEvidenceKeys(record) {
  const province = normalizeAdmissionTrendTypography(record?.province);
  const batch = admissionBatchRouteKey(record?.batch);
  const keys = [];
  for (const school of admissionPlanSchoolAliases(record)) {
    for (const major of admissionPlanMajorAliases(record)) {
      keys.push([province, school, major, batch].join("|"));
    }
  }
  return keys;
}

function admissionPlanIdentityKeys(record) {
  const province = normalizeAdmissionTrendTypography(record?.province);
  const keys = [];
  for (const school of admissionPlanSchoolAliases(record)) {
    for (const major of admissionPlanMajorAliases(record)) {
      keys.push([province, school, major].join("|"));
    }
  }
  return keys;
}

function isOrdinaryUndergraduatePlanRoute(route) {
  return /^(?:undergraduate-[123]|ordinary-initial)(?::|$)/.test(route);
}

function admissionPlanRouteCompatibility(plan, record) {
  const planRoute = admissionBatchRouteKey(plan?.batch);
  const admissionRoute = admissionBatchRouteKey(record?.batch);
  if (planRoute === admissionRoute) {
    return {
      kind: "exact-route",
      exact: true,
      planRoute,
      admissionRoute,
    };
  }
  if (!isOrdinaryUndergraduatePlanRoute(planRoute) || !isOrdinaryUndergraduatePlanRoute(admissionRoute)) {
    return null;
  }
  const planQualifier = admissionBatchQualifier(plan?.batch);
  const admissionQualifier = admissionBatchQualifier(record?.batch);
  if (planQualifier && admissionQualifier && planQualifier !== admissionQualifier) return null;
  return {
    kind: "ordinary-undergraduate-transition",
    exact: false,
    planRoute,
    admissionRoute,
  };
}

function admissionPlanOptionalRouteValue(record, fields) {
  for (const field of fields) {
    const value = normalizeAdmissionTrendTypography(record?.[field]);
    if (value) return value;
  }
  return "";
}

function admissionPlanOptionalRouteMatches(left, right, fields) {
  const leftValue = admissionPlanOptionalRouteValue(left, fields);
  const rightValue = admissionPlanOptionalRouteValue(right, fields);
  return !leftValue || !rightValue || leftValue === rightValue;
}

function admissionPlanRouteMatchesRecord(plan, record, profile) {
  if (!subjectMatchesRecord(plan, profile)) return false;
  if (!recordMatchesCandidateCategory(plan, profile)) return false;
  return admissionPlanOptionalRouteMatches(plan, record, ["admissionType"]) &&
    admissionPlanOptionalRouteMatches(plan, record, ["admissionSubtype"]) &&
    admissionPlanOptionalRouteMatches(plan, record, ["campus", "campusName", "schoolCampus"]) &&
    admissionPlanOptionalRouteMatches(plan, record, ["candidateCategory", "candidateClass"]);
}

function admissionPlanRequirementsAmbiguous(plans) {
  const fields = [
    (plan) => normalizeSubject(plan?.subjectType),
    (plan) => normalizeAdmissionTrendTypography(plan?.electiveRequirement),
    (plan) => admissionPlanOptionalRouteValue(plan, ["admissionType"]),
    (plan) => admissionPlanOptionalRouteValue(plan, ["admissionSubtype"]),
    (plan) => admissionPlanOptionalRouteValue(plan, ["campus", "campusName", "schoolCampus"]),
    (plan) => admissionPlanOptionalRouteValue(plan, ["candidateCategory", "candidateClass"]),
  ];
  return fields.some((read) =>
    new Set(plans.map(read).filter(Boolean)).size > 1
  );
}

function currentAdmissionPlanEvidenceIndex() {
  const records = admissionRecords();
  if (
    admissionPlanEvidenceIndexCache.records === records &&
    admissionPlanEvidenceIndexCache.strictIndex &&
    admissionPlanEvidenceIndexCache.identityIndex
  ) {
    return admissionPlanEvidenceIndexCache;
  }
  const strictIndex = new Map();
  const identityIndex = new Map();
  for (const record of records) {
    if (
      !isPlanRecord(record) ||
      !RECENT_PLAN_EVIDENCE_YEARS.has(Number(record.year)) ||
      isSpecialPathRecord(record) ||
      isVacancyPlanRecord(record) ||
      planRestrictedEligibilityReason(record) ||
      isThirdPartyAdmissionRecord(record)
    ) continue;
    for (const key of admissionPlanEvidenceKeys(record)) {
      if (!strictIndex.has(key)) strictIndex.set(key, []);
      strictIndex.get(key).push(record);
    }
    for (const key of admissionPlanIdentityKeys(record)) {
      if (!identityIndex.has(key)) identityIndex.set(key, []);
      identityIndex.get(key).push(record);
    }
  }
  admissionPlanEvidenceIndexCache = { records, strictIndex, identityIndex };
  return admissionPlanEvidenceIndexCache;
}

function currentPlanEvidenceForAdmissionRecord(record, profile) {
  if (!record || isPlanRecord(record)) return null;
  const indexes = currentAdmissionPlanEvidenceIndex();
  const collectMatches = (keys, index, expectedKind) => {
    const matches = [];
    const seen = new Set();
    for (const key of keys) {
      for (const plan of index.get(key) || []) {
        const identity = plan.id || `${key}|${plan.year}|${plan.subjectType}|${plan.electiveRequirement}`;
        const routeCompatibility = admissionPlanRouteCompatibility(plan, record);
        if (
          seen.has(identity) ||
          routeCompatibility?.kind !== expectedKind ||
          !admissionPlanRouteMatchesRecord(plan, record, profile)
        ) continue;
        seen.add(identity);
        matches.push({ plan, routeCompatibility });
      }
    }
    return matches;
  };
  const exactMatches = collectMatches(
    admissionPlanEvidenceKeys(record),
    indexes.strictIndex,
    "exact-route",
  );
  const matches = exactMatches.length
    ? exactMatches
    : collectMatches(
      admissionPlanIdentityKeys(record),
      indexes.identityIndex,
      "ordinary-undergraduate-transition",
    );
  if (!matches.length) return null;
  const latestYear = Math.max(...matches.map(({ plan }) => Number(plan.year) || 0));
  const latestMatches = matches.filter(({ plan }) => (Number(plan.year) || 0) === latestYear);
  const ambiguousPlanRequirements = admissionPlanRequirementsAmbiguous(
    latestMatches.map(({ plan }) => plan),
  );
  const selected = [...latestMatches].sort((left, right) =>
    (Number(right.plan.year) || 0) - (Number(left.plan.year) || 0) ||
    (Number(right.plan.planCount) || 0) - (Number(left.plan.planCount) || 0)
  )[0];
  const { plan, routeCompatibility } = selected;
  const year = Number(plan.year) || 0;
  const current = year === CURRENT_PLAN_EVIDENCE_YEAR;
  const routeTransition = !routeCompatibility.exact;
  const eligibility = ambiguousPlanRequirements
    ? {
      state: "needs-check",
      text: `${year}年同一院校专业存在多个选科或招生口径，不能自动判定`,
    }
    : electiveRequirementForProfile(plan, profile);
  const selectedPlanCount = Number(plan.planCount) || 0;
  const planCount = ambiguousPlanRequirements ? 0 : selectedPlanCount;
  const sourceLabel = /school/.test(String(plan.formalScoreScope || plan.sourceQuality || ""))
    ? "学校官网"
    : "考试院/官方招生指南";
  const label = ambiguousPlanRequirements
    ? `${year}计划多口径待核`
    : routeTransition
    ? current ? `${year}普通本科计划佐证` : `${year}普通本科曾招`
    : current ? `${year}计划在招` : `${year}计划曾招`;
  const rankingBonus = ambiguousPlanRequirements
    ? current ? 1 : 0
    : routeTransition
    ? current
      ? eligibility.state === "unmatched" ? 0 : eligibility.state === "needs-check" ? 2 : 5
      : 1
    : current
      ? eligibility.state === "needs-check" ? 3 : 8
      : 2;
  const planCountText = planCount ? `，计划${fmtNumber(planCount)}名` : "";
  const electiveText = plan.electiveRequirement ? `，选科要求${plan.electiveRequirement}` : "";
  const text = ambiguousPlanRequirements
    ? `${sourceLabel}${year}年计划中，同一院校专业存在多个选科或招生口径；只提示人工核验，不自动排除候选，也不把其中任一口径解释为录取概率`
    : routeTransition
    ? current
      ? `${sourceLabel}${year}年普通本科计划列有该校专业${planCountText}${electiveText}；历史录取批次“${record.batch || "未标注"}”与当年计划批次“${plan.batch || "未标注"}”口径不同，只作专业池佐证，不改变录取边界，选科冲突也只提示复核`
      : `${sourceLabel}${year}年普通本科计划曾列该校专业${planCountText}${electiveText}；历史录取与计划批次口径不同，只作近年曾招线索，${CURRENT_PLAN_EVIDENCE_YEAR}年计划仍须复核`
    : current
      ? `${sourceLabel}${year}年招生计划确认该校专业在${plan.province || profile.province}${plan.subjectType || profile.subject}${plan.batch || ""}列有计划${planCountText}${electiveText}；计划存在只证明当年专业池，不代表录取概率`
      : `${sourceLabel}${year}年招生计划曾列该校专业${planCountText}${electiveText}；这只是近年在招证据，${CURRENT_PLAN_EVIDENCE_YEAR}年计划仍须复核`;
  return {
    record: plan,
    year,
    current,
    exactRoute: routeCompatibility.exact,
    routeTransition,
    matchKind: routeCompatibility.kind,
    ambiguousPlanRequirements,
    label,
    planCount,
    eligibility,
    rankingBonus,
    text,
  };
}

function currentPlanAllowsProfile(record, profile) {
  const evidence = currentPlanEvidenceForAdmissionRecord(record, profile);
  return !(
    evidence?.current &&
    evidence.exactRoute &&
    !evidence.ambiguousPlanRequirements &&
    evidence.eligibility.state === "unmatched"
  );
}

function isIndependentCollegeRecord(record) {
  return (record?.schoolTags || []).some((tag) => /民办\/独立学院|独立学院/.test(String(tag)));
}

function isScoreDerivedRankRecord(record) {
  return record?.rankDerivedFromScore === true || record?.rankEvidenceScope === "score-derived-provincial-segment";
}

function rankScoreBasisLabel(record) {
  if (!isScoreDerivedRankRecord(record)) return "";
  if (record?.rankPolicyBonusIncluded === true) return "位次口径含政策加分";
  if (record?.rankPolicyBonusIncluded === false) return "位次口径不含政策加分";
  return "位次加分口径待核";
}

function isVocationalAdmissionRecord(record) {
  const batch = String(record?.batch || "");
  if (/本科/.test(batch)) return false;
  if (record?.dataType === "vocational-admission") return true;
  const levelText = `${batch} ${record?.educationLevel || ""} ${(record?.schoolTags || []).join(" ")}`;
  return /专科|高职|对口/.test(levelText);
}

function recordMatchesProfileEducationPath(record, profile, vocationalProfile = isVocationalProfile(profile)) {
  const segmentStatus = ordinarySegmentStatus(profile);
  if (["second", "below-second"].includes(segmentStatus?.band)) return true;
  const vocationalRecord = isVocationalAdmissionRecord(record);
  return vocationalProfile ? vocationalRecord : !vocationalRecord;
}

function normalizeSubject(value) {
  const text = normalizeText(value);
  if (!text || text === "不确定") return "";
  if (/物理|理科|理工/.test(text)) return "物理";
  if (/历史|文科|文史/.test(text)) return "历史";
  return text;
}

function normalizeProvince(value) {
  const text = String(value ?? "").trim().replace(/省|市|自治区|壮族|回族|维吾尔/g, "");
  return ALL_PROVINCES.find((province) => text.includes(province) || province.includes(text)) || text;
}

function subjectMatchesRecord(record, profile) {
  const profileSubject = normalizeSubject(profile.subject);
  const recordSubject = normalizeSubject(record.subjectType);
  if (!profileSubject || !recordSubject) return true;
  if (profileSubject === "综合") return true;
  if (recordSubject === "综合") return true;
  return recordSubject.includes(profileSubject) || profileSubject.includes(recordSubject);
}

function provinceMatchesRecord(record, profile) {
  const profileProvince = normalizeProvince(profile.province);
  const recordProvince = normalizeProvince(record.province);
  if (!profileProvince || !recordProvince) return true;
  return profileProvince === recordProvince;
}

function normalizeXizangCandidateCategory(value) {
  const text = normalizeText(value);
  if (!text) return "";
  if (text === "a类" || text === "a类考生") return "A类考生";
  if (text === "b类" || text === "b类考生" || text === "汉族" || text === "汉族考生") return "B类考生";
  return text;
}

function xizangCandidateCategoryMissing(profile) {
  return normalizeProvince(profile?.province) === "西藏" &&
    !normalizeXizangCandidateCategory(profile?.candidateCategory);
}

const XIZANG_OFFICIAL_RANK_SOURCE = "official-personal-query";

function xizangRankSourceUnconfirmed(profile) {
  if (normalizeProvince(profile?.province) !== "西藏") return false;
  const enteredRank = Number(profile?.rankInput || profile?.rank) || 0;
  return enteredRank > 0 && profile?.xizangRankSource !== XIZANG_OFFICIAL_RANK_SOURCE;
}

function usableRankForProfile(profile) {
  if (xizangRankSourceUnconfirmed(profile)) return 0;
  return Number(profile?.rank) || 0;
}

function recordMatchesCandidateCategory(record, profile) {
  const required = normalizeText(record?.candidateCategory || record?.candidateClass);
  if (!required) return true;
  const selected = normalizeText(profile?.candidateCategory);
  if (!selected) return false;
  if (normalizeProvince(record?.province || profile?.province) === "西藏") {
    return normalizeXizangCandidateCategory(required) === normalizeXizangCandidateCategory(selected);
  }
  return required.includes(selected) || selected.includes(required);
}

let profileAdmissionRecordsCache = { records: null, key: "", value: [] };
let profilePlanRecordsCache = { records: null, key: "", value: [] };

function profileRecordFilterKey(profile) {
  return [
    profile?.province,
    profile?.subject,
    profile?.candidateCategory,
    profile?.score,
    profile?.rank,
    profile?.rankInput,
    profile?.xizangRankSource,
    profile?.guangxiLocalScore,
    profile?.guangxiLocalRank,
    profile?.rankUsage,
    profile?.rankLevelUsage,
    profile?.electives,
    profile?.redLines,
  ].join("|");
}

function profileAdmissionRecords(profile) {
  const records = admissionRecords();
  const key = profileRecordFilterKey(profile);
  if (profileAdmissionRecordsCache.records === records && profileAdmissionRecordsCache.key === key) {
    return profileAdmissionRecordsCache.value;
  }
  const vocationalProfile = isVocationalProfile(profile);
  const value = records.filter((record) =>
    !isControlLineRecord(record) &&
    !isPlanRecord(record) &&
    !isSpecialPathRecord(record) &&
    recordMatchesProfileEducationPath(record, profile, vocationalProfile) &&
    !recordConflictsWithRedLines(record, profile) &&
    electiveRequirementAllowsProfile(record, profile) &&
    currentPlanAllowsProfile(record, profile) &&
    provinceMatchesRecord(record, profile) &&
    subjectMatchesRecord(record, profile) &&
    recordMatchesCandidateCategory(record, profile)
  );
  profileAdmissionRecordsCache = { records, key, value };
  return value;
}

function profilePlanRecords(profile) {
  const records = admissionRecords();
  const key = profileRecordFilterKey(profile);
  if (profilePlanRecordsCache.records === records && profilePlanRecordsCache.key === key) {
    return profilePlanRecordsCache.value;
  }
  const vocationalProfile = isVocationalProfile(profile);
  const value = records.filter((record) =>
    isPlanRecord(record) &&
    !isSpecialPathRecord(record) &&
    !planRestrictedEligibilityReason(record) &&
    recordMatchesProfileEducationPath(record, profile, vocationalProfile) &&
    !recordConflictsWithRedLines(record, profile) &&
    electiveRequirementAllowsProfile(record, profile) &&
    provinceMatchesRecord(record, profile) &&
    subjectMatchesRecord(record, profile) &&
    recordMatchesCandidateCategory(record, profile)
  );
  profilePlanRecordsCache = { records, key, value };
  return value;
}

function provinceReadinessForProfile(profile) {
  const province = normalizeProvince(profile.province);
  if (!province) return null;
  const layer = state.data?.admissionScoreLayer || {};
  return ((layer.provinceReadiness || layer.coverage?.provinceReadiness)?.rows || [])
    .find((row) => normalizeProvince(row.province) === province) || null;
}

function latestRecordYear(records) {
  let latest = 0;
  for (const record of records) latest = Math.max(latest, Number(record.year) || 0);
  return latest || null;
}

function currentChinaDate() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function shortDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? `${Number(match[2])}月${Number(match[3])}日` : String(value || "");
}

function scheduleStageForDate(schedule, today) {
  const rows = Array.isArray(schedule) ? schedule : [];
  const active = rows.find((row) => row.start <= today && today <= row.end);
  if (active) {
    return {
      state: "active",
      text: `${active.batch}进行中（${shortDate(active.start)}至${shortDate(active.end)}）`,
    };
  }
  const upcoming = rows.find((row) => today < row.start);
  if (upcoming) {
    return {
      state: "upcoming",
      text: `下一阶段为${upcoming.batch}（${shortDate(upcoming.start)}至${shortDate(upcoming.end)}）`,
    };
  }
  const completed = rows.filter((row) => row.end < today).at(-1);
  return completed
    ? { state: "completed", text: `日程所列批次已于${shortDate(completed.end)}结束，正式结果仍以考试院公告为准` }
    : null;
}

let admissionDataFreshnessCache = { records: null, ranks: null, key: "", value: null };

function admissionDataFreshness(profile, today = currentChinaDate()) {
  const allRecords = admissionRecords();
  const allRanks = rankConversionRecords();
  const cacheKey = `${profileRecordFilterKey(profile)}|${today}`;
  if (admissionDataFreshnessCache.records === allRecords && admissionDataFreshnessCache.ranks === allRanks && admissionDataFreshnessCache.key === cacheKey) {
    return admissionDataFreshnessCache.value;
  }
  const province = normalizeProvince(profile.province);
  const scopedRecords = allRecords.filter((record) =>
    provinceMatchesRecord(record, profile) && subjectMatchesRecord(record, profile)
  );
  const planRecords = scopedRecords.filter((record) => isPlanRecord(record) && !isSpecialPathRecord(record));
  const restrictedPlanRecords = planRecords.filter((record) => planRestrictedEligibilityReason(record));
  const ordinaryPlanRecords = planRecords.filter((record) => !planRestrictedEligibilityReason(record));
  const ordinaryAdmissions = scopedRecords.filter((record) =>
    !isPlanRecord(record) && !isControlLineRecord(record) && !isSpecialPathRecord(record)
  );
  const rankAlignmentBlockedAdmissions = ordinaryAdmissions.filter((record) =>
    record.rankAlignmentStatus === "blocked-score-basis-unresolved"
  );
  const categoryRestrictedAdmissions = ordinaryAdmissions.filter((record) =>
    (record.candidateCategory || record.candidateClass) && !recordMatchesCandidateCategory(record, profile)
  );
  const scopedRanks = allRanks.filter((record) =>
    provinceMatchesRecord(record, profile) && subjectMatchesRecord(record, profile)
  );
  const vacancyRecords = planRecords.filter(isVacancyPlanRecord);
  const latestPlanYear = latestRecordYear(planRecords);
  const latestAdmissionYear = latestRecordYear(ordinaryAdmissions);
  const latestRankYear = latestRecordYear(scopedRanks);
  const latestVacancyYear = latestRecordYear(vacancyRecords);
  const scheduleSource = (state.data?.admissionScoreLayer?.sourceNotes || [])
    .find((note) => normalizeProvince(note.province) === province && Array.isArray(note.schedule));
  const scheduleStage = scheduleSource ? scheduleStageForDate(scheduleSource.schedule, today) : null;
  const warnings = [];

  if (latestPlanYear && (!latestAdmissionYear || latestPlanYear > latestAdmissionYear)) {
    warnings.push(`${province}${latestPlanYear}年招生计划已发布，但普通录取数据${latestAdmissionYear ? `最新到${latestAdmissionYear}年` : "尚未闭合"}；当年计划不能替代投档/录取线。`);
  }
  if (restrictedPlanRecords.length) {
    warnings.push(`${province}当前范围内有${fmtNumber(restrictedPlanRecords.length)}条计划属于军警、专项、预科、艺体、定向、部队或对口等限定路径，未纳入普通自动推荐；需在确认资格后单独核验。`);
  }
  if (categoryRestrictedAdmissions.length) {
    warnings.push(profile.candidateCategory
      ? `${province}当前科类有${fmtNumber(categoryRestrictedAdmissions.length)}条记录属于其他A/B等考生类别，已按“${profile.candidateCategory}”排除。`
      : `${province}当前科类有${fmtNumber(categoryRestrictedAdmissions.length)}条记录要求A/B等考生类别；未确认对应类别时，这些记录不进入自动推荐。`);
  }
  if (province === "西藏" && xizangCandidateCategoryMissing(profile)) {
    warnings.push("西藏普通生源必须先确认A/B类：A类为区内世居两代（含两代）以上少数民族考生，B类为汉族及区外少数民族考生；未选择时结果只作调研。");
  }
  if (xizangRankSourceUnconfirmed(profile)) {
    warnings.push("已填写的西藏位次尚未确认为官方个人查询结果，系统已将其排除，不用于分段、院校比较或排序。");
  }
  if (!latestRankYear) {
    warnings.push(province === "西藏"
      ? "西藏已核验的官方公开渠道未提供可计算的一分一段表；系统不按分数编造位次，只有选择“西藏官方个人查询”来源后，手填位次才会用于比较。"
      : `${province}当前本地没有可计算的一分一段；未填写考试院正式位次时，系统不能给出位次安全边界。`);
  }
  if (rankAlignmentBlockedAdmissions.length) {
    warnings.push(`${province}有${fmtNumber(rankAlignmentBlockedAdmissions.length)}条录取分记录因政策加分口径未闭合，保留分数但不自动换算最低位次。`);
  }
  if (scheduleStage) {
    warnings.push(`${scheduleSource.year || ""}年考试院录取日程：${scheduleStage.text}。`);
  }
  if (latestVacancyYear) {
    warnings.push(`${latestVacancyYear}年征集志愿仅是各轮剩余计划快照，可用于识别历史补录机会，不能推断下一年一定征集或计算录取概率。`);
  }
  const value = {
    province,
    latestPlanYear,
    ordinaryPlanCount: ordinaryPlanRecords.length,
    restrictedPlanCount: restrictedPlanRecords.length,
    categoryRestrictedAdmissionCount: categoryRestrictedAdmissions.length,
    rankAlignmentBlockedAdmissionCount: rankAlignmentBlockedAdmissions.length,
    latestAdmissionYear,
    latestRankYear,
    latestVacancyYear,
    candidateCategoryRequired: province === "西藏",
    candidateCategoryMissing: xizangCandidateCategoryMissing(profile),
    scheduleSource,
    scheduleStage,
    warnings,
  };
  admissionDataFreshnessCache = { records: allRecords, ranks: allRanks, key: cacheKey, value };
  return value;
}

let admissionTrendIndexCache = null;

function normalizeAdmissionTrendTypography(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[·•‧∙・]/g, "·")
    .replace(/[‐‑‒–—―﹘﹣－]/g, "-")
    .replace(/[【〔〖［]/g, "[")
    .replace(/[】〕〗］]/g, "]")
    .replace(/[〈《]/g, "<")
    .replace(/[〉》]/g, ">");
}

function admissionTrendKey(record, canonicalTypography = true) {
  const route = admissionRouteFields(record, canonicalTypography);
  const clean = canonicalTypography ? normalizeAdmissionTrendTypography : normalizeText;
  return [
    record.province || "",
    record.subjectType || "",
    record.batch || "",
    record.schoolName || record.schoolCode || "",
    record.dataType || "",
    record.majorName || "",
    route.group,
    route.subtype,
    route.campus,
    route.tuition,
    route.elective,
    route.rankScope,
  ].map(clean).join("|");
}

function admissionTrendExactKey(record) {
  return admissionTrendKey(record, false);
}

function admissionTrendBoundarySignature(record) {
  return [
    Number(record?.minScore) || 0,
    Number(record?.minRankEnd || record?.minRank) || 0,
  ].join("|");
}

function admissionTrendCanonicalMergeSafe(records) {
  const exactKeys = new Set(records.map(admissionTrendExactKey));
  if (exactKeys.size < 2) return true;
  const boundariesByYear = new Map();
  for (const record of records) {
    const year = Number(record.year) || 0;
    if (!boundariesByYear.has(year)) boundariesByYear.set(year, new Set());
    boundariesByYear.get(year).add(admissionTrendBoundarySignature(record));
  }
  return [...boundariesByYear.values()].every((signatures) => signatures.size <= 1);
}

const GENERIC_ADMISSION_MAJOR_PATTERN = /^(院校投档线|院校专业组投档线|学校录取分数线|院校最低分|专业组投档线|投档线)$/;
const DISTINCT_ADMISSION_ROUTE_PATTERN = /中外|合作|国际|联合培养|境外|校区|医学院|专项|民族|预科|定向|单列|较高收费|高收费|护理|公费|优师/;

function admissionBatchQualifier(value) {
  const text = normalizeAdmissionTrendTypography(value);
  const sectionMatch = text.match(/[a-z](?:段|组|类)/)?.[0] || "";
  const bareSection = text.match(/批([a-z])(?:[（(]|$)/)?.[1] || "";
  const section = sectionMatch || (bareSection ? `${bareSection}段` : "");
  const subject = /(?:^|[（(])(文|理)(?:[）)]|$)/.exec(text)?.[1] || "";
  return [section, subject].filter(Boolean).join(":");
}

function admissionBatchRouteKey(value) {
  const text = normalizeAdmissionTrendTypography(value);
  if (!text) return "";
  const qualifier = admissionBatchQualifier(text);
  const append = (base) => qualifier ? `${base}:${qualifier}` : base;
  if (/征集|补录|补充录取|剩余计划/.test(text)) {
    const round = /第三轮|第3轮|第三次|第3次/.test(text) ? "3"
      : /第二轮|第2轮|第二次|第2次/.test(text) ? "2" : "1";
    const level = /专科|高职/.test(text) ? "vocational" : /本科/.test(text) ? "undergraduate" : "ordinary";
    return append(`vacancy:${level}:${round}`);
  }
  if (/提前/.test(text)) {
    const level = /专科|高职/.test(text) ? "vocational" : "undergraduate";
    const special = /国家|贫困/.test(text) ? ":national-special"
      : /地方/.test(text) ? ":local-special"
        : /高校/.test(text) ? ":school-special" : "";
    return append(`${level}-early${special}`);
  }
  if (/国家专项|贫困专项/.test(text)) return append("national-special");
  if (/地方专项/.test(text)) return append("local-special");
  if (/高校专项/.test(text)) return append("school-special");
  if (/农村专项/.test(text)) return append("rural-special");
  if (/专项/.test(text)) return append(`special:${text}`);
  if (/预科/.test(text)) return append(`preparatory:${text.replace(/[（(][文理][）)]/g, "")}`);
  if (/第三次志愿|第3次志愿/.test(text)) return append("ordinary-round-3");
  if (/第二次志愿|第2次志愿/.test(text)) return append("ordinary-round-2");
  if (/第二段|二段/.test(text)) return append("ordinary-segment-2");
  if (/第三段|三段/.test(text)) return append("ordinary-segment-3");
  if (/本科一批|本一|第一批本科/.test(text)) return append("undergraduate-1");
  if (/本科二批|本二|第二批本科/.test(text)) return append("undergraduate-2");
  if (/本科三批|本三|第三批本科/.test(text)) return append("undergraduate-3");
  if (/专科|高职/.test(text)) return append("vocational-regular");
  if (/第一段|一段|第一次志愿|第1次志愿|第一志愿|本科|普通类|常规批|综合改革/.test(text)) {
    return append("ordinary-initial");
  }
  return `other:${text}`;
}

function admissionOptionBaseIdentityKey(record, canonicalTypography = true) {
  const clean = canonicalTypography ? normalizeAdmissionTrendTypography : normalizeText;
  const majorIdentity = record.majorName || record.majorGroup || record.majorCode || "";
  return [
    record.province || "",
    record.subjectType || "",
    record.schoolName || record.schoolCode || "",
    majorIdentity,
    record.majorName ? "" : record.majorGroup || "",
    record.dataType || "",
  ].map(clean).join("|");
}

function isNamedMajorAdmissionRecord(record) {
  const majorName = normalizeText(record?.majorName || "");
  return ["major-admission", "vocational-admission"].includes(record?.dataType) &&
    Boolean(majorName) &&
    !GENERIC_ADMISSION_MAJOR_PATTERN.test(majorName);
}

function admissionRouteFields(record, canonicalTypography = false) {
  const clean = canonicalTypography ? normalizeAdmissionTrendTypography : normalizeText;
  return {
    batch: admissionBatchRouteKey(record?.batch),
    group: clean(record?.majorGroup || ""),
    subtype: clean(record?.admissionSubtype || ""),
    campus: clean(record?.campus || record?.campusName || record?.schoolCampus || ""),
    tuition: clean(record?.tuition || record?.tuitionFee || ""),
    elective: clean(record?.electiveRequirement || ""),
    majorCode: clean(record?.majorCode || ""),
    rankScope: clean(record?.rankInstitutionScope || ""),
  };
}

function admissionRouteIdentityKey(record, canonicalTypography = true) {
  const route = admissionRouteFields(record, canonicalTypography);
  return [
    admissionOptionBaseIdentityKey(record, canonicalTypography),
    route.batch,
    route.group,
    route.subtype,
    route.campus,
    route.tuition,
    route.elective,
    route.majorCode,
    route.rankScope,
  ].join("|");
}

function admissionRouteFieldsConflict(left, right, canonicalTypography = true) {
  const leftRoute = admissionRouteFields(left, canonicalTypography);
  const rightRoute = admissionRouteFields(right, canonicalTypography);
  if (leftRoute.batch !== rightRoute.batch) {
    if (leftRoute.batch && rightRoute.batch) return true;
    const presentBatch = leftRoute.batch || rightRoute.batch;
    if (presentBatch !== "ordinary-initial" || !sameYearAdmissionBoundary(left, right)) return true;
  }
  for (const field of ["subtype", "campus", "tuition", "elective", "majorCode", "rankScope"]) {
    const leftValue = leftRoute[field];
    const rightValue = rightRoute[field];
    if (leftValue && rightValue && leftValue !== rightValue) return true;
    if (!leftValue !== !rightValue) {
      const presentValue = leftValue || rightValue;
      if (
        ["campus", "tuition", "elective", "rankScope"].includes(field) ||
        DISTINCT_ADMISSION_ROUTE_PATTERN.test(presentValue)
      ) return true;
    }
  }
  return false;
}

function sameYearAdmissionBoundary(left, right) {
  if ((Number(left?.year) || 0) !== (Number(right?.year) || 0)) return false;
  const leftScore = Number(left?.minScore) || 0;
  const rightScore = Number(right?.minScore) || 0;
  const leftRank = Number(left?.minRankEnd || left?.minRank) || 0;
  const rightRank = Number(right?.minRankEnd || right?.minRank) || 0;
  if (leftScore && rightScore && leftScore !== rightScore) return false;
  if (leftRank && rightRank && leftRank !== rightRank) return false;
  return Boolean((leftScore && rightScore) || (leftRank && rightRank));
}

function admissionRecordsShareRouteCore(left, right, canonicalTypography) {
  if (
    admissionOptionBaseIdentityKey(left, canonicalTypography) !==
    admissionOptionBaseIdentityKey(right, canonicalTypography)
  ) return false;
  const leftRoute = admissionRouteFields(left, canonicalTypography);
  const rightRoute = admissionRouteFields(right, canonicalTypography);
  if (!isNamedMajorAdmissionRecord(left) || !isNamedMajorAdmissionRecord(right)) {
    return leftRoute.group === rightRoute.group &&
      !admissionRouteFieldsConflict(left, right, canonicalTypography);
  }
  if (leftRoute.group === rightRoute.group) {
    return !admissionRouteFieldsConflict(left, right, canonicalTypography);
  }
  if (leftRoute.group && rightRoute.group) return false;
  const namedGroup = leftRoute.group || rightRoute.group;
  if (DISTINCT_ADMISSION_ROUTE_PATTERN.test(namedGroup)) return false;
  return sameYearAdmissionBoundary(left, right) &&
    !admissionRouteFieldsConflict(left, right, canonicalTypography);
}

function admissionRecordsShareRoute(left, right) {
  if (!admissionRecordsShareRouteCore(left, right, true)) return false;
  const sameYear = (Number(left?.year) || 0) === (Number(right?.year) || 0);
  if (!sameYear || admissionRecordsShareRouteCore(left, right, false)) return true;
  return sameYearAdmissionBoundary(left, right);
}

function admissionRouteTags(record) {
  const tuition = Number(record?.tuition || record?.tuitionFee) || 0;
  return [...new Set([
    record?.batch || "",
    record?.majorGroup || "",
    record?.admissionSubtype || "",
    record?.campus || record?.campusName || record?.schoolCampus || "",
    tuition ? `学费${fmtNumber(tuition)}元/年` : "",
  ].filter(Boolean))];
}

function admissionEvidencePriority(record) {
  if (isThirdPartyAdmissionRecord(record)) return 0;
  if (isSchoolOfficialOnlyRecord(record)) return 2;
  if (/official/.test(String(record?.sourceQuality || ""))) return 3;
  return 1;
}

function admissionTrendIndex() {
  if (admissionTrendIndexCache) return admissionTrendIndexCache;
  admissionTrendIndexCache = new Map();
  for (const record of admissionRecords()) {
    if (!isNamedMajorAdmissionRecord(record) || isSpecialPathRecord(record)) continue;
    const key = admissionTrendKey(record);
    if (!admissionTrendIndexCache.has(key)) admissionTrendIndexCache.set(key, []);
    admissionTrendIndexCache.get(key).push(record);
  }
  for (const records of admissionTrendIndexCache.values()) {
    records.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
  }
  return admissionTrendIndexCache;
}

function trendYearsLabel(count) {
  if (count <= 2) return "近两年";
  if (count === 3) return "近三年";
  if (count === 4) return "近四年";
  return `近${count}年`;
}

function trendRecordLabel(count) {
  if (count <= 2) return "双年";
  if (count === 3) return "三年";
  if (count === 4) return "四年";
  return `${count}年`;
}

function preferredAdmissionTrendRecord(existing, candidate) {
  if (!existing) return candidate;
  const existingPriority = admissionEvidencePriority(existing);
  const candidatePriority = admissionEvidencePriority(candidate);
  if (candidatePriority !== existingPriority) {
    return candidatePriority > existingPriority ? candidate : existing;
  }
  const existingHasRank = Number(existing.minRankEnd || existing.minRank) > 0;
  const candidateHasRank = Number(candidate.minRankEnd || candidate.minRank) > 0;
  if (candidateHasRank !== existingHasRank) return candidateHasRank ? candidate : existing;
  return existing;
}

function admissionTrendSeries(records) {
  const seriesByYear = new Map();
  for (const record of records) {
    const year = Number(record.year) || 0;
    if (!year) continue;
    seriesByYear.set(year, preferredAdmissionTrendRecord(seriesByYear.get(year), record));
  }
  return [...seriesByYear.values()].sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
}

function comparableAdmissionTrendRecords(record) {
  if (!isNamedMajorAdmissionRecord(record) || isSpecialPathRecord(record)) return [];
  const indexedRecords = admissionTrendIndex().get(admissionTrendKey(record)) || [];
  return admissionTrendCanonicalMergeSafe(indexedRecords)
    ? indexedRecords
    : indexedRecords.filter((item) => admissionTrendExactKey(item) === admissionTrendExactKey(record));
}

function comparableAdmissionSafetyRecords(record) {
  return comparableAdmissionTrendRecords(record).filter((item) =>
    admissionRouteIdentityKey(record) === admissionRouteIdentityKey(item)
  );
}

function admissionEligibilityBasisKey(record) {
  return [
    record?.candidateCategory || record?.candidateClass || "",
    record?.rankUsage || "",
    record?.rankCategory || "",
    record?.rankLevelUsage || "",
  ].map(normalizeText).join("|");
}

function admissionRankBasisKey(record) {
  return [
    admissionEligibilityBasisKey(record),
    record?.rankMetric || "",
    record?.rankScoreBasis || "",
    record?.rankEvidenceScope || "",
    record?.rankDerivedFromScore === true ? "score-derived" : "native-or-unknown",
    record?.rankPolicyBonusIncluded === true
      ? "bonus-included"
      : record?.rankPolicyBonusIncluded === false
        ? "bonus-excluded"
        : "bonus-unknown",
  ].map(normalizeText).join("|");
}

function admissionScoreBasisKey(record) {
  return [
    admissionEligibilityBasisKey(record),
    record?.scoreMetric || "",
  ].map(normalizeText).join("|");
}

function conservativeAdmissionBoundary(values, metric) {
  const sorted = [...values].sort((left, right) =>
    metric === "rank" ? left - right : right - left);
  return sorted[sorted.length === 2 ? 0 : 1];
}

function admissionMultiyearSafetyBoundary(record, profile) {
  if (admissionEvidencePriority(record) < 2) return null;
  const series = admissionTrendSeries(
    comparableAdmissionSafetyRecords(record).filter((item) => admissionEvidencePriority(item) >= 2)
  ).slice(0, 6);
  if (series.length < 2 || Number(series[0].year) !== Number(record.year)) return null;
  if (series[0] !== record && series[0].id && record.id && series[0].id !== record.id) return null;

  const profileRank = profileRankForAdmissionRecord(record, profile);
  const currentRank = Number(record.minRankEnd || record.minRank) || 0;
  const currentScore = Number(record.minScore) || 0;
  let metric = "";
  let rows = [];
  if (profileRank > 0 && currentRank > 0) {
    const rankBasis = admissionRankBasisKey(record);
    rows = series.filter((item) =>
      Number(item.minRankEnd || item.minRank) > 0 &&
      admissionRankBasisKey(item) === rankBasis
    );
    if (rows.length >= 2) metric = "rank";
  }
  if (!metric && profileScoreForAdmissionRecord(record, profile) > 0 && currentScore > 0) {
    const scoreBasis = admissionScoreBasisKey(record);
    rows = series.filter((item) =>
      Number(item.minScore) > 0 &&
      admissionScoreBasisKey(item) === scoreBasis
    );
    if (rows.length >= 2) metric = "score";
  }
  if (!metric) return null;

  const values = rows.map((item) =>
    metric === "rank"
      ? Number(item.minRankEnd || item.minRank)
      : Number(item.minScore)
  );
  const latestBoundary = metric === "rank" ? currentRank : currentScore;
  const safetyBoundary = conservativeAdmissionBoundary(values, metric);
  const morePermissive = metric === "rank"
    ? latestBoundary > safetyBoundary
    : latestBoundary < safetyBoundary;
  if (!morePermissive) return null;

  const label = metric === "rank" ? "多年位次保护" : "多年分数保护";
  const boundaryText = metric === "rank"
    ? `${fmtNumber(safetyBoundary)}名`
    : `${safetyBoundary}分`;
  const valuesText = rows.map((item) =>
    metric === "rank"
      ? `${item.year}年${fmtNumber(Number(item.minRankEnd || item.minRank))}名`
      : `${item.year}年${Number(item.minScore)}分`
  ).join("、");
  return {
    metric,
    label,
    latestBoundary,
    safetyBoundary,
    years: rows.map((item) => Number(item.year)),
    boundaries: values,
    outlierDiscarded: rows.length >= 3 &&
      safetyBoundary !== (metric === "rank" ? Math.min(...values) : Math.max(...values)),
    text: `${trendYearsLabel(rows.length)}同路径官方边界为${valuesText}；按${boundaryText}保守复核，只降低乐观程度，不会抬高候选。`,
  };
}

function admissionTrendEvidence(records) {
  const thirdPartyYears = records.filter(isThirdPartyAdmissionRecord).map((record) => record.year);
  const unclassifiedYears = records
    .filter((record) => admissionEvidencePriority(record) === 1)
    .map((record) => record.year);
  if (thirdPartyYears.length) {
    return {
      bonus: 2,
      evidenceLabel: "趋势含待复核第三方",
      caution: `趋势中的${[...new Set(thirdPartyYears)].join("、")}年数据来自待复核第三方摘要，只作变化线索，不能据此推断录取概率。`,
    };
  }
  if (unclassifiedYears.length) {
    return {
      bonus: 3,
      evidenceLabel: "趋势来源待核",
      caution: `趋势中的${[...new Set(unclassifiedYears)].join("、")}年来源等级待核，只作变化线索。`,
    };
  }
  return { bonus: 5, evidenceLabel: "", caution: "" };
}

function withAdmissionTrendEvidence(records, trend) {
  return { ...trend, ...admissionTrendEvidence(records) };
}

function trendForRecord(record) {
  const records = comparableAdmissionTrendRecords(record);
  const series = admissionTrendSeries(records);
  if (series.length < 2) return null;
  const current = series.find((item) => Number(item.year) === Number(record.year)) || series[0];
  const previous = series.find((item) => item.year && item.year !== current.year);
  if (!previous) return null;
  const rankSeries = series.filter((item) => Number(item.minRankEnd) > 0);
  const currentRankItem = rankSeries.find((item) => item.id === current.id);
  const previousRankItem = rankSeries.find((item) => item.id !== current.id);
  if (rankSeries.length >= 2 && currentRankItem && previousRankItem) {
    const currentRank = Number(currentRankItem.minRankEnd) || 0;
    const previousRank = Number(previousRankItem.minRankEnd) || 0;
    if (currentRank && previousRank) {
      const visibleSeries = rankSeries.slice(0, 6);
      const gap = currentRank - previousRank;
      const direction = gap > 0 ? "位次放宽" : gap < 0 ? "位次收紧" : "位次持平";
      const values = visibleSeries.map((item) => Number(item.minRankEnd)).filter(Boolean);
      const label = trendYearsLabel(visibleSeries.length);
      const rangeText = visibleSeries.length >= 3
        ? `${label}位次区间${fmtNumber(Math.min(...values))}-${fmtNumber(Math.max(...values))}。`
        : "";
      const yearText = visibleSeries.map((item) => `${item.year}年${fmtNumber(Number(item.minRankEnd))}`).join("，");
      return withAdmissionTrendEvidence(visibleSeries, {
        label: `${label}专业位次`,
        text: `${yearText}；${currentRankItem.year}较${previousRankItem.year}${direction}${gap ? `${fmtNumber(Math.abs(gap))}名` : ""}。${rangeText}`,
      });
    }
  }
  const scoreSeries = series.filter((item) => Number(item.minScore) > 0);
  const currentScoreItem = scoreSeries.find((item) => item.id === current.id);
  const previousScoreItem = scoreSeries.find((item) => item.id !== current.id);
  if (scoreSeries.length >= 2 && currentScoreItem && previousScoreItem) {
    const currentScore = Number(currentScoreItem.minScore) || 0;
    const previousScore = Number(previousScoreItem.minScore) || 0;
    if (currentScore && previousScore) {
      const visibleSeries = scoreSeries.slice(0, 6);
      const gap = currentScore - previousScore;
      const direction = gap > 0 ? "最低分上升" : gap < 0 ? "最低分下降" : "最低分持平";
      const values = visibleSeries.map((item) => Number(item.minScore)).filter(Boolean);
      const label = trendYearsLabel(visibleSeries.length);
      const rangeText = visibleSeries.length >= 3
        ? `${label}最低分区间${Math.min(...values)}-${Math.max(...values)}分。`
        : "";
      const yearText = visibleSeries.map((item) => `${item.year}年${Number(item.minScore)}`).join("，");
      return withAdmissionTrendEvidence(visibleSeries, {
        label: `${label}专业分`,
        text: `${yearText}；${currentScoreItem.year}较${previousScoreItem.year}${direction}${gap ? `${Math.abs(gap)}分` : ""}。${rangeText}`,
      });
    }
  }
  return withAdmissionTrendEvidence(series.slice(0, 6), {
    label: `${trendYearsLabel(series.length)}专业分`,
    text: `已命中同省同科类同校同专业同招生路径${trendRecordLabel(series.length)}记录，仍需复核招生计划变化。`,
  });
}

function dedupeAdmissionOptions(options) {
  const selected = [];
  const indexesByBase = new Map();
  for (const option of options) {
    const baseKey = admissionOptionBaseIdentityKey(option.record);
    const indexes = indexesByBase.get(baseKey) || [];
    const existingIndex = indexes.find((index) => admissionRecordsShareRoute(selected[index].record, option.record));
    if (existingIndex === undefined) {
      indexes.push(selected.length);
      indexesByBase.set(baseKey, indexes);
      selected.push(option);
      continue;
    }
    const existing = selected[existingIndex];
    const optionYear = Number(option.record.year) || 0;
    const existingYear = Number(existing.record.year) || 0;
    const optionPriority = admissionEvidencePriority(option.record);
    const existingPriority = admissionEvidencePriority(existing.record);
    if (
      optionYear > existingYear ||
      (optionYear === existingYear && optionPriority > existingPriority) ||
      (optionYear === existingYear && optionPriority === existingPriority && option.record.minRankEnd && !existing.record.minRankEnd)
    ) {
      selected[existingIndex] = option;
    }
  }
  return selected;
}

function dedupeAdmissionRecords(records) {
  return dedupeAdmissionOptions(records.map((record) => ({ record }))).map((option) => option.record);
}

function dedupePlanOptions(options) {
  const map = new Map();
  for (const option of options) {
    const record = option.record;
    const key = [
      record.province || "",
      record.subjectType || "",
      record.batch || "",
      record.schoolCode || record.schoolName || "",
      record.majorCode || record.majorName || "",
      record.majorGroup || "",
      isVacancyPlanRecord(record) ? "vacancy" : "regular",
    ].join("|");
    const existing = map.get(key);
    if (!existing || (Number(option.record.year) || 0) > (Number(existing.record.year) || 0)) {
      map.set(key, option);
    }
  }
  return [...map.values()];
}

let ordinaryBachelorControlLineCache = { records: null, key: "", value: null };
let ordinaryVocationalControlLineCache = { records: null, key: "", value: null };
let limitedOrdinaryVocationalControlLineCache = { records: null, key: "", value: null };
let ordinarySegmentStatusCache = { records: null, key: "", value: null };

function ordinaryBachelorControlLine(profile) {
  const records = admissionRecords();
  const selectedCategory = normalizeText(profile?.candidateCategory);
  const key = `${normalizeProvince(profile?.province)}|${normalizeSubject(profile?.subject)}|${selectedCategory}`;
  if (ordinaryBachelorControlLineCache.records === records && ordinaryBachelorControlLineCache.key === key) {
    return ordinaryBachelorControlLineCache.value;
  }
  const rows = records.filter((record) => {
    if (!isControlLineRecord(record) || !provinceMatchesRecord(record, profile) || !subjectMatchesRecord(record, profile)) return false;
    if (isSpecialPathRecord(record)) return false;
    if (record.controlLineRouteKind === "ordinary-vocational-limited-school") return false;
    if (record.controlLineRouteKind === "segment") return false;
    const text = normalizeText(`${record.batch || ""} ${record.majorName || ""} ${(record.schoolTags || []).join(" ")}`);
    const ordinaryBachelorLine = (/本科/.test(text) || /普通类一段线/.test(text)) && !/艺术|艺体|体育|戏曲|军|警|资格|专业统考|职教|对口|部队|特殊类型/.test(text);
    if (!ordinaryBachelorLine || /专科|高职|二段线/.test(text)) return false;
    const recordCategory = normalizeText(record.candidateCategory || record.candidateClass || record.majorGroup);
    return !selectedCategory || !recordCategory || recordCategory.includes(selectedCategory) || selectedCategory.includes(recordCategory);
  });
  if (!rows.length) {
    ordinaryBachelorControlLineCache = { records, key, value: null };
    return null;
  }
  const latestYear = rows.reduce((latest, record) => Math.max(latest, Number(record.year) || 0), 0);
  const latestRows = rows.filter((record) => Number(record.year) === latestYear);
  const thresholdsByCategory = new Map();
  for (const record of latestRows) {
    const score = Number(record.minScore) || 0;
    if (!score) continue;
    const category = normalizeText(record.candidateCategory || record.candidateClass || record.majorGroup) || "ordinary";
    const current = thresholdsByCategory.get(category);
    if (!current || score < current.score) thresholdsByCategory.set(category, { score, record });
  }
  const thresholds = [...thresholdsByCategory.values()];
  if (!thresholds.length) {
    ordinaryBachelorControlLineCache = { records, key, value: null };
    return null;
  }
  const selected = thresholds.sort((left, right) => right.score - left.score)[0];
  const value = { score: selected.score, year: latestYear, record: selected.record };
  ordinaryBachelorControlLineCache = { records, key, value };
  return value;
}

function ordinaryVocationalControlLine(profile) {
  const records = admissionRecords();
  const selectedCategory = normalizeText(profile?.candidateCategory);
  const key = `${normalizeProvince(profile?.province)}|${normalizeSubject(profile?.subject)}|${selectedCategory}`;
  if (ordinaryVocationalControlLineCache.records === records && ordinaryVocationalControlLineCache.key === key) {
    return ordinaryVocationalControlLineCache.value;
  }
  const rows = records.filter((record) => {
    if (!isControlLineRecord(record) || !provinceMatchesRecord(record, profile) || !subjectMatchesRecord(record, profile)) return false;
    if (isSpecialPathRecord(record)) return false;
    if (record.controlLineRouteKind === "ordinary-vocational-limited-school") return false;
    const text = normalizeText(`${record.batch || ""} ${record.majorName || ""} ${(record.schoolTags || []).join(" ")}`);
    const ordinaryVocationalLine = /专科|高职|二段线/.test(text) && !/本科/.test(text) &&
      !/艺术|艺体|体育|戏曲|军|警|资格|专业统考|职教|对口|部队|特殊类型/.test(text);
    if (!ordinaryVocationalLine) return false;
    const recordCategory = normalizeText(record.candidateCategory || record.candidateClass || record.majorGroup);
    return !selectedCategory || !recordCategory || recordCategory.includes(selectedCategory) || selectedCategory.includes(recordCategory);
  });
  if (!rows.length) {
    ordinaryVocationalControlLineCache = { records, key, value: null };
    return null;
  }
  const latestYear = rows.reduce((latest, record) => Math.max(latest, Number(record.year) || 0), 0);
  const latestRows = rows.filter((record) => Number(record.year) === latestYear);
  const thresholdsByCategory = new Map();
  for (const record of latestRows) {
    const score = Number(record.minScore) || 0;
    if (!score) continue;
    const category = normalizeText(record.candidateCategory || record.candidateClass || record.majorGroup) || "ordinary";
    const current = thresholdsByCategory.get(category);
    if (!current || score < current.score) thresholdsByCategory.set(category, { score, record });
  }
  const thresholds = [...thresholdsByCategory.values()];
  if (!thresholds.length) {
    ordinaryVocationalControlLineCache = { records, key, value: null };
    return null;
  }
  const selected = thresholds.sort((left, right) => right.score - left.score)[0];
  const value = { score: selected.score, year: latestYear, record: selected.record };
  ordinaryVocationalControlLineCache = { records, key, value };
  return value;
}

function limitedOrdinaryVocationalControlLine(profile) {
  const records = admissionRecords();
  const selectedCategory = normalizeText(profile?.candidateCategory);
  const key = `${normalizeProvince(profile?.province)}|${normalizeSubject(profile?.subject)}|${selectedCategory}`;
  if (limitedOrdinaryVocationalControlLineCache.records === records && limitedOrdinaryVocationalControlLineCache.key === key) {
    return limitedOrdinaryVocationalControlLineCache.value;
  }
  const rows = records.filter((record) => {
    if (!isControlLineRecord(record) || !provinceMatchesRecord(record, profile) || !subjectMatchesRecord(record, profile)) return false;
    if (record.formalScoreScope !== "limited-school-control-line-only") return false;
    if (record.controlLineRouteKind !== "ordinary-vocational-limited-school") return false;
    const recordCategory = normalizeText(record.candidateCategory || record.candidateClass || record.majorGroup);
    return !selectedCategory || !recordCategory || recordCategory.includes(selectedCategory) || selectedCategory.includes(recordCategory);
  });
  if (!rows.length) {
    limitedOrdinaryVocationalControlLineCache = { records, key, value: null };
    return null;
  }
  const latestYear = rows.reduce((latest, record) => Math.max(latest, Number(record.year) || 0), 0);
  const latestRows = rows.filter((record) => Number(record.year) === latestYear && Number(record.minScore) > 0);
  if (!latestRows.length) {
    limitedOrdinaryVocationalControlLineCache = { records, key, value: null };
    return null;
  }
  const selected = latestRows.sort((left, right) => Number(right.minScore) - Number(left.minScore))[0];
  const value = { score: Number(selected.minScore), year: latestYear, record: selected };
  limitedOrdinaryVocationalControlLineCache = { records, key, value };
  return value;
}

function isBelowOrdinaryVocationalLine(profile) {
  return ordinaryVocationalQualificationStatus(profile).below;
}

function pendingOrdinaryVocationalControlSource(profile) {
  const province = normalizeProvince(profile?.province);
  if (!province || ordinaryVocationalControlLine(profile) || !isVocationalProfile(profile)) return null;
  const notes = state.data?.admissionScoreLayer?.sourceNotes || [];
  return [...notes].reverse().find((note) =>
    normalizeProvince(note?.province) === province &&
    note?.ordinaryVocationalStatus === "pending-official-release"
  ) || null;
}

function formatOfficialScheduleDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return String(value || "");
  const [, year, month, day, hour, minute] = match;
  return `${year}年${Number(month)}月${Number(day)}日${hour ? ` ${hour}:${minute}` : ""}`;
}

function pendingOrdinaryVocationalReviewDetails(source) {
  const review = source?.ordinaryVocationalReview || {};
  const milestones = Array.isArray(review.officialMilestones) ? review.officialMilestones : [];
  const primarySource = review.primarySource || {};
  return {
    checkedAt: review.checkedAt || source?.ordinaryVocationalCheckedAt || "",
    statusLabel: review.statusLabel || "官方尚未发布2026年普通高职专科通用控制线",
    publicationLabel: review.expectedPublicationAt
      ? `官方明确公布日期：${formatOfficialScheduleDate(review.expectedPublicationAt)}`
      : "控制线发布日期：官方尚未明确公布",
    milestoneLabels: milestones.map((item) => item?.label).filter(Boolean),
    reason: review.reason || source?.ordinaryVocationalReason || "当前不使用往年分数替代当年资格线。",
    scoreBasisNote: review.scoreBasisNote || "",
    sourceUrl: primarySource.url || milestones.find((item) => item?.sourceUrl)?.sourceUrl || source?.ordinaryVocationalScheduleUrl || source?.url || "",
    sourceTitle: primarySource.title || "查看官方日程或划线规则",
    noHistoricalSubstitution: review.noHistoricalSubstitution !== false,
  };
}

function renderPendingOrdinaryVocationalPanel(profile, source) {
  const review = pendingOrdinaryVocationalReviewDetails(source);
  const details = [
    `核验状态：${review.statusLabel}`,
    review.publicationLabel,
    ...review.milestoneLabels.map((label) => `官方节点：${label}`),
    review.scoreBasisNote,
  ].filter(Boolean);
  return `<section class="band admission-hit-panel">
    <h3>2026年普通专科控制线待发布</h3>
    <p>${esc(profile?.province || "本省")}2026年普通高职专科通用控制线尚待官方发布。当前只展示升学路径和专业认知调研，不生成可执行院校专业清单，也不把往年专科投档结果解释为今年已具备填报资格。</p>
    <ul class="pending-review-list">${details.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
    <p class="pending-review-reason">截至${esc(formatOfficialScheduleDate(review.checkedAt))}：${esc(review.reason)}${review.noHistoricalSubstitution ? " 不使用往年控制线、高职分类招生线或录取日程反推今年分数。" : ""}</p>
    ${review.sourceUrl ? `<a class="pending-review-link" href="${esc(review.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(review.sourceTitle)}</a>` : ""}
  </section>`;
}

function controlLineScoreComparison(line, profile) {
  if (!line) {
    return {
      status: "unavailable",
      below: false,
      score: null,
      label: "高考总分",
      basis: "gaokao-total",
      inferredUpperBound: false,
    };
  }
  const basis = String(line.record?.scoreBasis || "gaokao-total");
  if (basis === "chinese-math-foreign-450") {
    const rawVocationalScore = String(profile?.vocationalScore ?? "").trim();
    const vocationalScore = Number(rawVocationalScore);
    if (rawVocationalScore && Number.isFinite(vocationalScore) && vocationalScore >= 0) {
      return {
        status: "comparable",
        below: vocationalScore < line.score,
        score: vocationalScore,
        label: "语数外三科总分",
        basis,
        inferredUpperBound: false,
      };
    }
    const totalScore = Number(profile?.score);
    if (Number.isFinite(totalScore) && totalScore > 0 && totalScore < line.score) {
      return {
        status: "comparable",
        below: true,
        score: totalScore,
        label: "高考总分（可推定语数外三科总分不高于此分）",
        basis,
        inferredUpperBound: true,
      };
    }
    return {
      status: "missing",
      below: false,
      score: null,
      label: "语数外三科总分",
      basis,
      inferredUpperBound: false,
    };
  }
  const rawScore = String(profile?.score ?? "").trim();
  const score = Number(rawScore);
  const comparable = Boolean(rawScore) && Number.isFinite(score) && score > 0;
  return {
    status: comparable ? "comparable" : "missing",
    below: comparable && score < line.score,
    score: comparable ? score : null,
    label: "高考总分",
    basis,
    inferredUpperBound: false,
  };
}

function ordinaryVocationalQualificationStatus(profile) {
  const line = ordinaryVocationalControlLine(profile);
  const comparison = controlLineScoreComparison(line, profile);
  const limitedLine = limitedOrdinaryVocationalControlLine(profile);
  const limitedComparison = controlLineScoreComparison(limitedLine, profile);
  const pendingSource = pendingOrdinaryVocationalControlSource(profile);
  const relevant = Boolean(pendingSource || ((line || limitedLine) && (
    isVocationalProfile(profile) || line?.record?.controlLineRouteKind === "segment"
  )));
  const generalBelow = relevant && comparison.status === "comparable" && comparison.below;
  const limitedOnly = generalBelow && limitedComparison.status === "comparable" && !limitedComparison.below;
  return {
    line,
    comparison,
    limitedLine,
    limitedComparison,
    pendingSource,
    relevant,
    generalBelow,
    limitedOnly,
    below: generalBelow && !limitedOnly,
    unknown: relevant && comparison.status === "missing",
    pending: Boolean(pendingSource),
  };
}

function ordinarySegmentStatus(profile) {
  const records = admissionRecords();
  const score = Number(profile?.score);
  const key = `${normalizeProvince(profile?.province)}|${normalizeSubject(profile?.subject)}|${Number.isFinite(score) ? score : ""}`;
  if (ordinarySegmentStatusCache.records === records && ordinarySegmentStatusCache.key === key) {
    return ordinarySegmentStatusCache.value;
  }
  const rows = records.filter((record) =>
    isControlLineRecord(record) &&
    record.controlLineRouteKind === "segment" &&
    record.formalScoreScope === "control-line-only" &&
    provinceMatchesRecord(record, profile) &&
    subjectMatchesRecord(record, profile)
  );
  if (!rows.length) {
    ordinarySegmentStatusCache = { records, key, value: null };
    return null;
  }
  const latestYear = rows.reduce((latest, record) => Math.max(latest, Number(record.year) || 0), 0);
  const latestRows = rows.filter((record) => Number(record.year) === latestYear);
  const firstRecord = latestRows.find((record) => /第一段|一段线/.test(`${record.controlLineSection || ""} ${record.batch || ""}`));
  const secondRecord = latestRows.find((record) => /第二段|二段线/.test(`${record.controlLineSection || ""} ${record.batch || ""}`));
  const firstScore = Number(firstRecord?.minScore);
  const secondScore = Number(secondRecord?.minScore);
  if (!Number.isFinite(firstScore) || !Number.isFinite(secondScore) || firstScore <= secondScore) {
    ordinarySegmentStatusCache = { records, key, value: null };
    return null;
  }
  const band = Number.isFinite(score) && score > 0
    ? score >= firstScore ? "first" : score >= secondScore ? "second" : "below-second"
    : "unknown";
  const value = {
    year: latestYear,
    band,
    firstLine: { score: firstScore, year: latestYear, record: firstRecord },
    secondLine: { score: secondScore, year: latestYear, record: secondRecord },
  };
  ordinarySegmentStatusCache = { records, key, value };
  return value;
}

function controlLineDisplayLabel(line, fallback) {
  const kind = String(line?.record?.controlLineKind || "").trim();
  return /线|段/.test(kind) ? kind : fallback;
}

function isVocationalProfile(profile) {
  const rankUsageText = normalizeText(`${profile?.rankUsage || ""} ${profile?.rankLevelUsage || ""}`);
  if (/vocational|专科|高职/.test(rankUsageText)) return true;
  const score = Number(profile.score) || 0;
  if (!score) return false;
  if (ordinarySegmentStatus(profile)) return false;
  const bachelorLine = ordinaryBachelorControlLine(profile);
  if (bachelorLine) return score < bachelorLine.score;
  return scoreOnStandardScale(score, profile.province) < 300;
}

function candidatePoolsForProfile(profile) {
  const segmentStatus = ordinarySegmentStatus(profile);
  const vocationalQualification = ordinaryVocationalQualificationStatus(profile);
  if (vocationalQualification.below || vocationalQualification.limitedOnly) {
    return CANDIDATE_POOLS.filter((candidate) => ["vocational-dual", "regional-safe"].includes(candidate.id));
  }
  if (isVocationalProfile(profile) && !segmentStatus) {
    return CANDIDATE_POOLS.filter((candidate) => ["vocational-dual", "regional-safe"].includes(candidate.id));
  }
  const includeVocational = isVocationalProfile(profile) || ["second", "below-second"].includes(segmentStatus?.band);
  return CANDIDATE_POOLS.filter((candidate) => includeVocational || candidate.id !== "vocational-dual");
}

function scoreRangeForRecord(record) {
  const min = Number(record?.scoreRange?.min);
  const max = Number(record?.scoreRange?.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null;
  return { min, max };
}

function scoreCoveredByRecord(record, score) {
  const range = scoreRangeForRecord(record);
  if (range) return score >= range.min && score <= range.max;
  return Number(record.score) === score;
}

function scoreDistanceFromRecord(record, score) {
  const range = scoreRangeForRecord(record);
  if (range) {
    if (score >= range.min && score <= range.max) return 0;
    return Math.min(Math.abs(score - range.min), Math.abs(score - range.max));
  }
  return Math.abs((Number(record.score) || 0) - score);
}

function rankScoreText(record, requestedScore, covered) {
  const range = scoreRangeForRecord(record);
  if (range && covered) {
    if (range.min <= 0) return `${fmtNumber(range.max)}分及以下区间`;
    if (range.max >= 750) return `${fmtNumber(range.min)}分及以上区间`;
    return `${fmtNumber(range.min)}-${fmtNumber(range.max)}分区间`;
  }
  return covered ? `${requestedScore}分` : `最接近的${fmtNumber(record.score)}分`;
}

function recordEligibleForCandidate(record, candidate, profile) {
  const vocationalRecord = record.dataType === "vocational-admission";
  const segmentStatus = ordinarySegmentStatus(profile);
  if (["second", "below-second"].includes(segmentStatus?.band)) {
    return vocationalRecord
      ? ["vocational-dual", "regional-safe"].includes(candidate.id)
      : candidate.id !== "vocational-dual";
  }
  if (isVocationalProfile(profile)) {
    return vocationalRecord && ["vocational-dual", "regional-safe"].includes(candidate.id);
  }
  if (vocationalRecord) return isVocationalProfile(profile) && ["vocational-dual", "regional-safe"].includes(candidate.id);
  return true;
}

function preferredRankUsageForProfile(profile) {
  if (profile?.rankUsage && profile.rankUsage !== "ordinary") return profile.rankUsage;
  return isVocationalProfile(profile) ? "vocational" : "undergraduate";
}

function recordMatchesRankUsage(record, preferredRankUsage, rankCategory, rankLevelUsage) {
  const recordUsage = record.rankUsage || "undergraduate";
  if (preferredRankUsage === "vocational") {
    if (record.rankUsage && recordUsage !== "vocational") return false;
  } else if (recordUsage !== preferredRankUsage) {
    return false;
  }
  if (rankCategory && record.rankCategory !== rankCategory) return false;
  if (rankLevelUsage && (record.rankLevelUsage || "") !== rankLevelUsage) return false;
  if (!rankLevelUsage && Object.prototype.hasOwnProperty.call(SPECIAL_RANK_USAGE_ORDER, preferredRankUsage) && record.rankLevelUsage) return false;
  return true;
}

function profileScoreForInstitutionScope(profile, rankInstitutionScope = "") {
  if (rankInstitutionScope === "inside-guangxi") {
    return Number(profile?.guangxiLocalScore || profile?.score) || 0;
  }
  return Number(profile?.score) || 0;
}

function estimateRankFromScore(profile, rankInstitutionScope = "") {
  const activeInstitutionScope = rankInstitutionScope || (normalizeProvince(profile.province) === "广西" ? "outside-guangxi" : "");
  const score = profileScoreForInstitutionScope(profile, activeInstitutionScope);
  if (!score || !profile.province || !profile.subject || profile.subject === "不确定") return null;
  const pool = rankConversionRecords()
    .filter((record) =>
      record.rankEstimateUsable !== false &&
      provinceMatchesRecord(record, profile) &&
      subjectMatchesRecord(record, profile) &&
      (!activeInstitutionScope || record.rankInstitutionScope === activeInstitutionScope) &&
      Number.isFinite(Number(record.score)) &&
      Number.isFinite(Number(record.rankEnd))
    );
  if (!pool.length) return null;
  const latestYear = pool.reduce((latest, record) => Math.max(latest, Number(record.year) || 0), 0);
  const latestPoolRaw = pool.filter((record) => Number(record.year) === latestYear);
  const preferredRankUsage = preferredRankUsageForProfile(profile);
  const latestPool = latestPoolRaw.filter((record) => recordMatchesRankUsage(record, preferredRankUsage, profile.rankCategory || "", profile.rankLevelUsage || ""));
  const activeLatestPool = latestPool;
  if (!activeLatestPool.length) return null;
  const exact = activeLatestPool.find((record) => scoreCoveredByRecord(record, score));
  const coverageBounds = activeLatestPool.reduce((bounds, record) => {
    const range = scoreRangeForRecord(record);
    const min = range ? range.min : Number(record.score);
    const max = range ? range.max : Number(record.score);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return bounds;
    return {
      min: Math.min(bounds.min, min),
      max: Math.max(bounds.max, max),
    };
  }, { min: Infinity, max: -Infinity });
  if (!exact && (score < coverageBounds.min || score > coverageBounds.max)) return null;
  const nearest = exact || [...activeLatestPool].sort((a, b) =>
    scoreDistanceFromRecord(a, score) - scoreDistanceFromRecord(b, score) ||
    (Number(b.score) || 0) - (Number(a.score) || 0)
  )[0];
  if (!nearest) return null;
  const rank = Number(nearest.rankEnd) || 0;
  if (!rank) return null;
  const source = (state.data?.admissionScoreLayer?.sourceNotes || []).find((item) => item.id === nearest.sourceId);
  const province = nearest.province || profile.province;
  const subjectType = nearest.subjectType || profile.subject;
  const sameScoreCount = Number(nearest.sameRankScore) || 0;
  const matchedScoreRange = exact ? scoreRangeForRecord(nearest) : null;
  const matchedRange = Boolean(matchedScoreRange && matchedScoreRange.min !== matchedScoreRange.max);
  const scoreText = rankScoreText(nearest, score, Boolean(exact));
  const precisionText = exact ? (matchedRange ? "，为官方区间记录" : "") : "，不是精确同分位次";
  const sameScoreText = sameScoreCount ? `，${matchedRange ? "同区间" : "同分"}${fmtNumber(sameScoreCount)}人` : "";
  const rankUsageText = nearest.rankUsageLabel ? `（${nearest.rankUsageLabel}口径）` : "";
  const institutionScopeText = nearest.rankInstitutionScopeLabel ? `${nearest.rankInstitutionScopeLabel}、${nearest.scoreBonusScopeLabel || "对应加分"}口径` : "";
  return {
    rank,
    rankStart: Number(nearest.rankStart) || rank,
    rankEnd: rank,
    score: Number(nearest.score) || score,
    year: latestYear,
    province,
    subjectType,
    exact: Boolean(exact),
    rankInstitutionScope: nearest.rankInstitutionScope || "",
    rankInstitutionScopeLabel: nearest.rankInstitutionScopeLabel || "",
    scoreBonusScope: nearest.scoreBonusScope || "",
    scoreBonusScopeLabel: nearest.scoreBonusScopeLabel || "",
    sourceTitle: source?.title || "一分一段表",
    sourceUrl: source?.url || "",
    text: `未手填位次，已按${latestYear}年${province}${subjectType}${rankUsageText}${institutionScopeText}一分一档表${scoreText}估算位次约${fmtNumber(rank)}名${sameScoreText}${precisionText}。`,
  };
}

function admissionScoreStatus() {
  const layer = state.data?.admissionScoreLayer || {};
  return {
    available: hasStructuredAdmissionScores(),
    label: layer.statusLabel || "未接入结构化院校/专业录取分表",
    reason: layer.downgradeReason || "缺少结构化录取分数据，当前推荐只作为候选核验。",
  };
}

function recommendationValidationIssues(profile = {}) {
  const issues = [];
  const provinceInput = String(profile.province || "").trim();
  const province = normalizeProvince(provinceInput);
  if (!provinceInput) {
    issues.push({ fieldId: "provinceInput", message: "请填写考生所在省份" });
  } else if (!ALL_PROVINCES.includes(province)) {
    issues.push({ fieldId: "provinceInput", message: "请从省份列表中选择有效省份" });
  }

  const scoreInput = String(profile.score || "").trim();
  const score = Number(scoreInput);
  if (!scoreInput) {
    issues.push({ fieldId: "scoreInput", message: "请填写高考总分" });
  } else if (!Number.isFinite(score) || score < 0 || score > 1000) {
    issues.push({ fieldId: "scoreInput", message: "高考总分应在0至1000之间" });
  }

  const validateOptionalNumber = (value, fieldId, message, { min = 0, max = Infinity, integer = false } = {}) => {
    const input = String(value || "").trim();
    if (!input) return;
    const number = Number(input);
    const valid = Number.isFinite(number) && number >= min && number <= max && (!integer || Number.isInteger(number));
    if (!valid) issues.push({ fieldId, message });
  };

  validateOptionalNumber(profile.rank, "rankInput", "位次应为不小于1的整数", { min: 1, integer: true });
  if (province === "广西") {
    validateOptionalNumber(profile.guangxiLocalScore, "guangxiLocalScoreInput", "广西区内院校投档分应在0至750之间", { max: 750 });
    validateOptionalNumber(profile.guangxiLocalRank, "guangxiLocalRankInput", "广西区内院校位次应为不小于1的整数", { min: 1, integer: true });
  }
  if (province === "北京") {
    validateOptionalNumber(profile.vocationalScore, "vocationalScoreInput", "北京专科语数外三科总分应在0至450之间", { max: 450 });
  }
  return issues;
}

function profileFromForm() {
  const rankUsageParts = ($("#rankUsageInput")?.value || "ordinary||").split("|");
  const profile = {
    childType: $("#childType").value,
    score: $("#scoreInput").value.trim(),
    guangxiLocalScore: $("#guangxiLocalScoreInput")?.value.trim() || "",
    vocationalScore: $("#vocationalScoreInput")?.value.trim() || "",
    rank: $("#rankInput").value.trim(),
    rankInput: $("#rankInput").value.trim(),
    xizangRankSource: $("#xizangRankSourceInput")?.value || "",
    guangxiLocalRank: $("#guangxiLocalRankInput")?.value.trim() || "",
    guangxiLocalRankInput: $("#guangxiLocalRankInput")?.value.trim() || "",
    province: $("#provinceInput").value.trim(),
    subject: $("#subjectInput").value,
    candidateCategory: $("#candidateCategoryInput")?.value || "",
    rankUsage: rankUsageParts[0] === "ordinary" ? "" : rankUsageParts[0],
    rankCategory: rankUsageParts[1] || "",
    rankLevelUsage: rankUsageParts[2] || "",
    electives: $$(".elective-input:checked").map((input) => input.value).join(" "),
    disciplineFocus: $("#disciplineFocus").value,
    interest: $("#interestInput").value.trim(),
    cities: $("#cityInput").value.trim(),
    abilityProfile: $("#abilityProfileInput").value.trim(),
    redLines: $("#redLineInput").value.trim(),
    budget: $("#budgetInput").value,
    strategy: $("#strategyInput").value,
  };
  if (normalizeProvince(profile.province) !== "西藏") {
    profile.candidateCategory = "";
    profile.xizangRankSource = "";
  } else if (xizangRankSourceUnconfirmed(profile)) {
    profile.rank = "";
    profile.rankRejectedBySource = true;
  }
  if (normalizeProvince(profile.province) === "广西") {
    const outsideEstimate = profile.rank ? null : estimateRankFromScore(profile, "outside-guangxi");
    const localEstimate = profile.guangxiLocalRank ? null : estimateRankFromScore(profile, "inside-guangxi");
    profile.rankEstimatesByInstitutionScope = {};
    if (outsideEstimate) {
      profile.rank = String(outsideEstimate.rank);
      profile.estimatedRank = outsideEstimate.rank;
      profile.rankEstimate = outsideEstimate;
      profile.rankEstimatesByInstitutionScope["outside-guangxi"] = outsideEstimate;
    }
    if (localEstimate) {
      profile.guangxiLocalRank = String(localEstimate.rank);
      profile.rankEstimatesByInstitutionScope["inside-guangxi"] = localEstimate;
    }
    const estimateParts = [];
    if (outsideEstimate) estimateParts.push(`区外院校按全国性加分表约${fmtNumber(outsideEstimate.rank)}名`);
    if (localEstimate) estimateParts.push(`区内院校按最高加分表约${fmtNumber(localEstimate.rank)}名`);
    if (estimateParts.length) {
      const sourceEstimate = outsideEstimate || localEstimate;
      profile.rankEstimateText = `广西位次已按目标院校分开估算：${estimateParts.join("；")}。`;
      profile.rankEstimateSource = sourceEstimate.sourceTitle;
      profile.rankEstimateUrl = sourceEstimate.sourceUrl;
    }
  } else if (!profile.rank) {
    const estimate = estimateRankFromScore(profile);
    if (estimate) {
      profile.rank = String(estimate.rank);
      profile.estimatedRank = estimate.rank;
      profile.rankEstimate = estimate;
      profile.rankEstimateText = estimate.text;
      profile.rankEstimateSource = estimate.sourceTitle;
      profile.rankEstimateUrl = estimate.sourceUrl;
    }
  }
  return profile;
}

function recommendationDraftFromForm() {
  const profile = profileFromForm();
  const draft = {
    ...profile,
    rank: $("#rankInput")?.value.trim() || "",
    rankInput: $("#rankInput")?.value.trim() || "",
    guangxiLocalRank: $("#guangxiLocalRankInput")?.value.trim() || "",
    guangxiLocalRankInput: $("#guangxiLocalRankInput")?.value.trim() || "",
  };
  for (const key of [
    "estimatedRank",
    "rankEstimate",
    "rankEstimateText",
    "rankEstimateSource",
    "rankEstimateUrl",
    "rankEstimatesByInstitutionScope",
    "rankRejectedBySource",
  ]) delete draft[key];
  return draft;
}

function saveCurrentRecommendationDraft() {
  const draft = recommendationDraftFromForm();
  saveRecommendationProfile(draft);
  state.prefillProfile = draft;
  syncRecommendationDraftStatus("已保存本机草稿；仅保存在此浏览器。");
}

function recommendationDraftStatusText() {
  return state.prefillProfile
    ? "已载入本机草稿；修改会自动保存在本机浏览器。"
    : "当前使用示例资料；修改后会自动保存在本机浏览器。";
}

function syncRecommendationDraftStatus(message = "") {
  const status = $("#recommendDraftStatus");
  if (status) status.textContent = message || recommendationDraftStatusText();
}

function hasTextHit(text, keywords) {
  const normalized = normalizeText(text);
  return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
}

function recordSearchText(record) {
  return [
    record.schoolName,
    record.schoolCode,
    record.majorName,
    record.majorCode,
    record.majorGroup,
    record.batch,
    record.city,
    record.dataType,
    record.electiveRequirement,
    (record.schoolTags || []).join(" "),
    (record.disciplineCodes || []).join(" "),
    (record.cautions || []).join(" "),
    record.planCorrectionNote,
    record.planRestrictionText,
  ].join(" ");
}

function recordConflictsWithRedLines(record, profile) {
  const redLines = normalizeText(profile?.redLines);
  if (!redLines) return false;
  const recordText = normalizeText(recordSearchText(record));
  const tuitionText = String(record?.tuition ?? "").replace(/[^\d.]/g, "");
  const tuition = tuitionText ? Number(tuitionText) : NaN;
  const isCooperative = /中外合作|合作办学/.test(recordText);
  const isHighTuition = Number.isFinite(tuition) && tuition >= HIGH_TUITION_THRESHOLD;
  const isHighCostCooperativeRisk = isCooperative && (!Number.isFinite(tuition) || isHighTuition);
  const rejectsHighCostCooperative = /(不接受|拒绝|不要|排除)[^，,；;。]*高学费[^，,；;。]*中外合作|(不接受|拒绝|不要|排除)[^，,；;。]*中外合作[^，,；;。]*高学费/.test(redLines);
  const rejectsAnyCooperative = /不接受中外合作|拒绝中外合作|不要中外合作|排除中外合作/.test(redLines);
  const rejectsAnyHighTuition = /不接受高学费(?![^，,；;。]*中外合作)|拒绝高学费(?![^，,；;。]*中外合作)|不要高学费(?![^，,；;。]*中外合作)|排除高学费(?![^，,；;。]*中外合作)/.test(redLines);
  return (rejectsHighCostCooperative && isHighCostCooperativeRisk)
    || (rejectsAnyCooperative && isCooperative)
    || (rejectsAnyHighTuition && isHighTuition);
}

function candidateMatchesAdmissionRecord(candidate, record, profile) {
  const text = normalizeText(recordSearchText(record));
  const codes = record.disciplineCodes || [];
  const schoolText = normalizeText(`${record.schoolName || ""} ${record.city || ""} ${(record.schoolTags || []).join(" ")}`);
  const majorText = normalizeText(`${record.majorName || ""} ${record.majorGroup || ""}`);
  const scopeMatchers = {
    "elite-platform": () => !isIndependentCollegeRecord(record) && /985|211|双一流|C9/.test(schoolText),
    "shanghai-city": () => /上海|杭州|南京|苏州|宁波|无锡|常州/.test(schoolText),
    "wuhan-city": () => /武汉|湖北/.test(schoolText),
    "hongkong-macao": () => /香港|澳门|港澳/.test(schoolText),
    "science-research": () => codes.includes("07") || /数学|物理|化学|生物|地理科学|地质|心理学|统计学/.test(majorText),
    "engineering-industry": () => codes.includes("08") || /计算机|软件|数据|人工智能|电子|电气|自动化|机械|材料|土木|建筑|能源|交通|航空|海洋工程/.test(majorText),
    "business-city": () => codes.some((code) => ["02", "12"].includes(code)) || /经济|金融|财政|会计|审计|工商管理|市场营销|电子商务|国际商务/.test(majorText),
    "teacher-stable": () => /师范|教育/.test(`${schoolText} ${majorText}`),
    "medicine-police": () => codes.includes("10") || /医学|临床|口腔|药学|护理|公安|警察|侦查|治安/.test(`${schoolText} ${majorText}`),
    "vocational-dual": () => record.dataType === "vocational-admission" || /专科|高职|职业/.test(`${record.batch || ""} ${schoolText}`),
    "regional-safe": () => Boolean(record.province && (record.schoolName || record.majorName)),
  };
  const scopeMatcher = scopeMatchers[candidate.id];
  if (scopeMatcher && !scopeMatcher()) return false;
  if (["elite-platform", "shanghai-city", "wuhan-city", "hongkong-macao", "vocational-dual", "regional-safe"].includes(candidate.id)) return true;
  if (profile.disciplineFocus && codes.includes(profile.disciplineFocus)) return true;
  if (candidate.disciplines.some((code) => codes.includes(code))) return true;
  if (candidate.keywords.some((keyword) => text.includes(normalizeText(keyword)))) return true;
  if (candidate.cities.some((city) => text.includes(normalizeText(city)))) return true;
  if (candidate.id === "regional-safe" && record.province && record.city) return true;
  return false;
}

function isVocationalPlanRecord(record) {
  return /专科|高职|职业|对口/.test(`${record.batch || ""} ${record.sourceSubjectRaw || ""} ${record.schoolTags?.join(" ") || ""}`);
}

function planRecordMatchesBand(record, candidate, profile, band) {
  const vocationalPlan = isVocationalPlanRecord(record);
  const segmentStatus = ordinarySegmentStatus(profile);
  if (["second", "below-second"].includes(segmentStatus?.band)) {
    return vocationalPlan ? ["vocational-dual", "regional-safe"].includes(candidate.id) : candidate.id !== "vocational-dual";
  }
  if (!isVocationalProfile(profile) && vocationalPlan) return false;
  if (candidate.id === "vocational-dual") return vocationalPlan;
  if (isVocationalProfile(profile)) return vocationalPlan || candidate.id === "regional-safe";
  return true;
}

function planRoleForRecord(record) {
  const batch = String(record.batch || "");
  if (isVacancyPlanRecord(record)) return isVocationalPlanRecord(record) ? "专科征集" : "征集机会";
  if (/专科|高职|对口/.test(batch)) return "专科计划";
  if (/本科一批|国家专项|高校专项|提前录取本科一批/.test(batch)) return "本科计划";
  if (/本科二批|预科/.test(batch)) return "本科兜底";
  return "计划核验";
}

function eligibilityThresholdLabel(record) {
  const thresholds = record.eligibilityThresholds || {};
  return ["A", "B"]
    .filter((key) => Number(thresholds[key]) > 0)
    .map((key) => `${key}类不低于${thresholds[key]}分`)
    .join("、");
}

function vacancyEligibilityForProfile(record, profile) {
  const entries = Object.entries(record.eligibilityThresholds || {})
    .map(([category, threshold]) => [category, Number(threshold)])
    .filter(([, threshold]) => Number.isFinite(threshold) && threshold > 0)
    .sort(([left], [right]) => left.localeCompare(right));
  if (!entries.length) return { state: "not-applicable", text: "" };
  const score = Number(profile.score) || 0;
  const thresholdText = entries.map(([category, threshold]) => `${category}类${threshold}分`).join("、");
  if (!score) {
    return {
      state: "score-missing",
      text: `公告列有${thresholdText}资格门槛；未提供分数和A/B类别，不能判断是否具备填报资格。`,
    };
  }
  const passed = entries.filter(([, threshold]) => score >= threshold);
  if (!passed.length) {
    return {
      state: "below-all",
      text: `当前${score}分低于公告列出的全部资格门槛（${thresholdText}），不作为可报征集机会展示。`,
    };
  }
  if (passed.length < entries.length) {
    const failed = entries.filter((entry) => !passed.includes(entry));
    return {
      state: "class-dependent",
      text: `当前${score}分达到${passed.map(([category, threshold]) => `${category}类${threshold}分`).join("、")}门槛，但未达到${failed.map(([category, threshold]) => `${category}类${threshold}分`).join("、")}门槛；未确认A/B类别，不能判断是否具备填报资格。`,
    };
  }
  return {
    state: "meets-all",
    text: `当前${score}分不低于公告列出的${thresholdText}门槛；这仍只是资格初筛，必须再核验考生类别和公告条件。`,
  };
}

function buildPlanOptions(candidate, profile, band) {
  const interestWords = parseList(`${profile.interest} ${profile.abilityProfile}`);
  const cityPrefs = parseList(profile.cities);
  const records = profilePlanRecords(profile)
    .filter((record) => planRecordMatchesBand(record, candidate, profile, band))
    .filter((record) => vacancyEligibilityForProfile(record, profile).state !== "below-all")
    .filter((record) => candidateMatchesAdmissionRecord(candidate, record, profile) || candidate.id === "regional-safe")
    .map((record) => {
      const planCount = Number(record.planCount) || 0;
      const vacancyPlan = isVacancyPlanRecord(record);
      const eligibility = vacancyPlan
        ? vacancyEligibilityForProfile(record, profile)
        : { state: "not-applicable", text: "" };
      const eligibilityPending = ["class-dependent", "score-missing"].includes(eligibility.state);
      let optionScore = 42 + Math.min(planCount, 12);
      optionScore += majorInterestScore(record, profile);
      if (candidate.disciplines.some((code) => (record.disciplineCodes || []).includes(code))) optionScore += 18;
      if (cityPrefs.length && hasTextHit(`${record.city || ""} ${record.schoolName || ""}`, cityPrefs)) optionScore += 10;
      if (interestWords.length && hasTextHit(recordSearchText(record), interestWords)) optionScore += 10;
      if (eligibilityPending) optionScore -= 24;
      const tags = [
        record.city,
        record.batch,
        vacancyPlan ? "征集志愿" : "",
        vacancyPlan && record.vacancyRound ? `第${record.vacancyRound}号` : "",
        vacancyPlan && Number(record.vacancyRepeatCount) > 1 ? `跨${record.vacancyRepeatCount}轮出现` : "",
        vacancyPlan ? eligibilityThresholdLabel(record) : "",
        record.planCorrectionNote ? "官方计划更正" : "",
        planCount ? `${vacancyPlan ? "当轮剩余" : "计划"}${fmtNumber(planCount)}名` : "",
        record.electiveRequirement ? `选科${record.electiveRequirement}` : "",
        record.tuition ? `学费${record.tuition}` : "",
        record.majorGroup || "",
      ].filter(Boolean);
      const yearText = record.year ? `${record.year}年` : "当年";
      const planText = planCount ? `计划${fmtNumber(planCount)}名` : "计划数需复核";
      const correctionText = [record.planCorrectionNote, record.planRestrictionText].filter(Boolean).join("；");
      const vacancyRoundText = record.vacancyRound ? `第${record.vacancyRound}号公告` : "该轮公告";
      const repeatText = Number(record.vacancyRepeatCount) > 1
        ? `；同一院校专业在已导入公告中跨${record.vacancyRepeatCount}轮出现，这是历史补录/需求信号，不代表专业质量高低`
        : "";
      const eligibilityText = eligibility.text ? `；${eligibility.text.replace(/[。；]+$/, "")}` : "";
      const vacancyFocus = `${record.majorName || "招生专业"}：${yearText}${record.province || profile.province}${record.subjectType || profile.subject}${record.batch || ""}${vacancyRoundText}当轮剩余${planCount ? `${fmtNumber(planCount)}名` : "计划数需复核"}；这是历史时点快照，只用于识别补录信号，不是投档线、录取最低分、录取位次或下一年计划${repeatText}${eligibilityText}。`;
      const focusParts = [
        vacancyPlan ? vacancyFocus : `${record.majorName || "招生专业"}：${yearText}${record.province || profile.province}${record.subjectType || profile.subject}${record.batch || ""}${planText}；该项只说明官方招生计划和可报专业池，不能判断录取概率。`,
        correctionText,
      ].map((text) => String(text || "").trim().replace(/^[。；]+|[。；]+$/g, "")).filter(Boolean);
      return {
        name: record.schoolName,
        tags,
        focus: `${focusParts.join("；")}。`,
        role: eligibilityPending ? "资格待核验" : planRoleForRecord(record),
        optionScore,
        admissionFit: eligibilityPending
          ? { zone: "资格待核验", score: 30, text: "考生A/B类别未确认，当前分数不能形成可报结论" }
          : vacancyPlan
          ? { zone: "征集机会", score: 46, text: "历史剩余计划快照，不含录取最低分或位次" }
          : { zone: "计划核验", score: 46, text: "计划层候选，不含录取最低分或位次" },
        scoreStatus: eligibilityPending
          ? "征集资格待核验：不是可报结论或录取概率"
          : vacancyPlan
          ? "官方征集剩余计划：只作历史低需求/补录机会信号"
          : "官方计划层：需等投档/录取分闭合",
        record,
      };
    });
  const ranked = dedupePlanOptions(records)
    .sort((a, b) => b.optionScore - a.optionScore || (Number(b.record.planCount) || 0) - (Number(a.record.planCount) || 0));
  const selected = ranked.slice(0, 3);
  const bestVacancy = ranked.find((option) => isVacancyPlanRecord(option.record));
  if (bestVacancy && !selected.some((option) => isVacancyPlanRecord(option.record))) {
    if (selected.length < 3) selected.push(bestVacancy);
    else selected[selected.length - 1] = bestVacancy;
    selected.sort((a, b) => b.optionScore - a.optionScore || (Number(b.record.planCount) || 0) - (Number(a.record.planCount) || 0));
  }
  return selected;
}

function majorInterestScore(record, profile) {
  const text = normalizeText(recordSearchText(record));
  const majorText = normalizeText(record.majorName || "");
  const interestWords = parseList(`${profile.interest} ${profile.abilityProfile}`);
  let score = 0;
  for (const word of interestWords) {
    const normalizedWord = normalizeText(word);
    if (!normalizedWord) continue;
    if (text.includes(normalizedWord)) score += 8;
    if (majorText === normalizedWord) score += 24;
    else if (majorText.startsWith(normalizedWord)) score += 14;
  }
  if ((record.disciplineCodes || []).includes(profile.disciplineFocus)) score += 14;
  if (/语文|英语|表达|内容|媒体|数字媒体|虚拟现实|VR/i.test(profile.abilityProfile) && /虚拟现实|数字媒体|软件|数据|信息/.test(record.majorName || "")) score += 10;
  if (/数学102|物理77|数学中等|物理中等/.test(profile.abilityProfile) && /数学与应用数学|信息与计算科学|人工智能|电子信息|电气/.test(record.majorName || "")) score -= 8;
  if (/化学|生物|物化生|生物88|化学82/.test(profile.abilityProfile) && /智能医学|药学|医学检验|生物|制药|食品/.test(record.majorName || "")) score += 8;
  return score;
}

function admissionPreferenceScore(record, profile) {
  const cityPrefs = parseList(profile.cities);
  if (!cityPrefs.length) return 0;
  return hasTextHit(`${record.city || ""} ${record.schoolName || ""}`, cityPrefs) ? 24 : 0;
}

function admissionRecency(record, today = currentChinaDate()) {
  const recordYear = Number(record?.year) || 0;
  const referenceYear = Number(String(today || "").slice(0, 4)) || new Date().getFullYear();
  if (!recordYear) {
    return {
      age: null,
      fresh: false,
      penalty: 8,
      label: "年份待核",
      text: "来源年份缺失，已降低排序权重，必须核验当年招生计划和投档表",
    };
  }
  const age = Math.max(0, referenceYear - recordYear);
  if (age <= 1) {
    return {
      age,
      fresh: true,
      penalty: 0,
      label: age === 0 ? "当年" : "近1年",
      text: `${recordYear}年录取边界，时效性较好，仍须核验当年计划与专业组`,
    };
  }
  const penalty = age === 2 ? 6 : age === 3 ? 13 : Math.min(24, 13 + (age - 3) * 5);
  return {
    age,
    fresh: false,
    penalty,
    label: age === 2 ? "近2年" : `${age}年前`,
    text: `${recordYear}年历史录取边界，距当前${age}年，已降低排序权重，必须用当年计划和最新位次复核`,
  };
}

function profileRankForAdmissionRecord(record, profile) {
  if (record?.rankInstitutionScope === "inside-guangxi") {
    return Number(profile?.guangxiLocalRank) || usableRankForProfile(profile);
  }
  return usableRankForProfile(profile);
}

function profileScoreForAdmissionRecord(record, profile) {
  return profileScoreForInstitutionScope(profile, record?.rankInstitutionScope || "");
}

function singleYearAdmissionFit(record, profile, today = currentChinaDate()) {
  const rank = profileRankForAdmissionRecord(record, profile);
  const score = profileScoreForAdmissionRecord(record, profile);
  const minRankEnd = Number(record.minRankEnd) || 0;
  const minScore = Number(record.minScore) || 0;
  const institutionScopeLabel = record?.rankInstitutionScopeLabel ? `${record.rankInstitutionScopeLabel}` : "";
  const rankBoundaryLabel = isScoreDerivedRankRecord(record) ? "最低分换算位次" : "近年最低位次";
  const scopedRankBoundaryLabel = institutionScopeLabel && isScoreDerivedRankRecord(record) ? `${institutionScopeLabel}${rankBoundaryLabel}` : rankBoundaryLabel;
  const recency = admissionRecency(record, today);
  let fit;
  if (rank > 0 && minRankEnd > 0) {
    const gap = rank - minRankEnd;
    const ratio = rank / minRankEnd;
    const relativeGapPercent = Number((Math.abs(1 - ratio) * 100).toFixed(1));
    const relativeText = gap <= 0
      ? `位次比${scopedRankBoundaryLabel}靠前${fmtNumber(Math.abs(gap))}名（约${relativeGapPercent}%）`
      : `位次落后${scopedRankBoundaryLabel}约${fmtNumber(gap)}名（约${relativeGapPercent}%）`;
    if (ratio <= RANK_FIT_RATIO_THRESHOLDS.safe) fit = { zone: "稳", score: 94, text: relativeText };
    else if (ratio <= RANK_FIT_RATIO_THRESHOLDS.steady) fit = { zone: "稳妥", score: 86, text: relativeText };
    else if (ratio <= RANK_FIT_RATIO_THRESHOLDS.borderline) fit = { zone: "临界稳", score: 76, text: relativeText };
    else if (ratio <= RANK_FIT_RATIO_THRESHOLDS.reach) fit = { zone: "冲", score: 62, text: relativeText };
    else fit = { zone: "高冲", score: 42, text: relativeText };
  } else if (score > 0 && minScore > 0) {
    const gap = Number((score - minScore).toFixed(3));
    if (gap >= 18) fit = { zone: "分数稳", score: 84, text: `分数高出近年最低分${gap}分，缺位次需复核` };
    else if (gap >= 8) fit = { zone: "分数稳妥", score: 76, text: `分数高出近年最低分${gap}分，缺位次需复核` };
    else if (gap >= 0) fit = { zone: "分数临界", score: 66, text: `分数高出近年最低分${gap}分，缺位次需复核` };
    else if (gap >= -8) fit = { zone: "分数冲", score: 52, text: `分数低于近年最低分${Math.abs(gap)}分，缺位次需复核` };
    else fit = { zone: "分数高冲", score: 36, text: `分数低于近年最低分${Math.abs(gap)}分，缺位次需复核` };
  } else {
    fit = { zone: "待核验", score: 46, text: "缺少最低位次/最低分，不能判断可达性" };
  }
  return {
    ...fit,
    zone: recency.fresh ? fit.zone : `${recency.label}${fit.zone}`,
    score: Math.max(0, fit.score - recency.penalty),
    text: `${fit.text}；${recency.text}`,
    recency,
  };
}

function admissionFit(record, profile, today = currentChinaDate()) {
  const latestFit = singleYearAdmissionFit(record, profile, today);
  const safety = admissionMultiyearSafetyBoundary(record, profile);
  if (!safety) return latestFit;

  const safetyRecord = safety.metric === "rank"
    ? { ...record, minRankEnd: safety.safetyBoundary, minRank: safety.safetyBoundary }
    : { ...record, minScore: safety.safetyBoundary };
  const safetyFit = singleYearAdmissionFit(safetyRecord, profile, today);
  const applied = safetyFit.score < latestFit.score;
  const guardedScore = Math.min(latestFit.score, safetyFit.score);
  const guardedZone = applied ? `多年保护${safetyFit.zone}` : latestFit.zone;
  const guardText = applied
    ? `${safety.text}可达性由“${latestFit.zone}”降为“${guardedZone}”。`
    : `${safety.text}当前可达性等级不变。`;
  return {
    ...latestFit,
    zone: guardedZone,
    score: guardedScore,
    text: `${latestFit.text}；${guardText}`,
    historicalGuard: {
      ...safety,
      applied,
      scoreBefore: latestFit.score,
      scoreAfter: guardedScore,
      zoneBefore: latestFit.zone,
      zoneAfter: guardedZone,
      text: guardText,
    },
  };
}

function isLimitedAdmissionRecord(record) {
  const quality = String(record?.sourceQuality || "");
  return /rank-only|regular2/.test(quality) || isHubeiLimitedSchoolHistoricalAdmissionRecord(record);
}

function isHubeiLimitedSchoolHistoricalAdmissionRecord(record, profile = null) {
  const score = Number(record?.minScore);
  const profileScore = Number(profile?.score);
  return normalizeProvince(record?.province) === "湖北" &&
    record?.year === 2025 &&
    isVocationalAdmissionRecord(record) &&
    /^official-hubei-vocational-2025-(history|physics)$/.test(String(record?.sourceId || "")) &&
    /^C/.test(String(record?.schoolCode || "")) &&
    Number.isFinite(score) && score >= 150 && score < 200 &&
    (!profile || (Number.isFinite(profileScore) && score <= profileScore));
}

function qualificationFilteredAdmissionRecords(profile, records = profileAdmissionRecords(profile)) {
  const qualification = ordinaryVocationalQualificationStatus(profile);
  return qualification.limitedOnly
    ? records.filter((record) => isHubeiLimitedSchoolHistoricalAdmissionRecord(record, profile))
    : records;
}

function admissionRecordLimitWarning(record) {
  if (isThirdPartyAdmissionRecord(record)) {
    return "该录取最低分来自待复核第三方摘要，不是考试院或学校官网原表；即使位次由官方一分一段换算，也只能作为候选线索，可信度最高为B，不能直接形成可执行志愿。";
  }
  if (isSchoolOfficialOnlyRecord(record)) {
    if (isScoreDerivedRankRecord(record)) {
      return "该来源是学校官网单校专业最低分；所示位次由最低分对应省级一分一段表换算，不是学校录取考生中的真实最低位次。只能作为该校候选复核，不能单独推断录取概率。";
    }
    return "该来源是学校官网单校录取边界，不是省级考试院全量投档/录取表；只能作为该校候选复核，不能单独推断录取概率。";
  }
  if (isHubeiLimitedSchoolHistoricalAdmissionRecord(record)) {
    return "该记录是湖北2025年官方高职高专普通批中低于200分的本省院校专业组历史投档线，只用于核验2026年150-199分限定院校范围；不得外推为通用专科资格或今年录取概率。";
  }
  if (!isLimitedAdmissionRecord(record)) return "";
  if (String(record?.sourceQuality || "").includes("regular2")) {
    return "该来源是普通类常规批第2次志愿/剩余计划投档位次，不等同于首次投档或最终录取分。";
  }
  return "该来源只含最低位次，不含最低分，需结合一分一段和当年计划复核。";
}

function isProfessionalFilingRecord(record) {
  return /major-filing|ordinary-second-major-filing/.test(String(record?.sourceQuality || ""));
}

function admissionCautionText(record) {
  const cautions = record.cautions || [];
  const electiveCaution = cautions.find((text) => /未列选科要求|选科.*复核/.test(text));
  return [...new Set([
    admissionRecordLimitWarning(record),
    electiveCaution || cautions[0] || "需复核招生计划、专业组和章程。",
  ].filter(Boolean))].join(" ");
}

function buildAdmissionOptions(candidate, profile) {
  const records = qualificationFilteredAdmissionRecords(profile)
    .filter((record) => recordEligibleForCandidate(record, candidate, profile))
    .filter((record) => candidateMatchesAdmissionRecord(candidate, record, profile))
    .map((record) => {
      const fit = admissionFit(record, profile);
      const trend = trendForRecord(record);
      const planEvidence = currentPlanEvidenceForAdmissionRecord(record, profile);
      const optionScore = fit.score +
        majorInterestScore(record, profile) +
        admissionPreferenceScore(record, profile) +
        (trend?.bonus || 0) +
        (planEvidence?.rankingBonus || 0);
      const tags = [
        record.city,
        ...(record.schoolTags || []),
        record.minScore ? `最低分${record.minScore}` : "",
        record.admittedCount ? `招生数${record.admittedCount}` : "",
        record.rankRangeText ? `位次${record.rankRangeText}` : "",
        rankScoreBasisLabel(record),
        trend?.label || "",
        trend?.evidenceLabel || "",
        fit.historicalGuard?.label || "",
        planEvidence?.label || "",
        planEvidence?.planCount ? `计划${fmtNumber(planEvidence.planCount)}名` : "",
        planEvidence?.routeTransition ? "普通本科批次口径变更" : "",
        planEvidence?.ambiguousPlanRequirements ? "计划选科多口径待核" : "",
        planEvidence?.current && planEvidence.eligibility.state === "matched" ? "当前选科符合" : "",
        planEvidence?.current && planEvidence.eligibility.state === "not-required" ? "当前选科不限" : "",
        planEvidence?.current && planEvidence.eligibility.state === "needs-check" ? "当前选科待核" : "",
        planEvidence?.current && planEvidence.routeTransition &&
          planEvidence.eligibility.state === "unmatched" ? "当前选科冲突待核" : "",
        ...admissionRouteTags(record),
        record.electiveRequirement ? `选科${record.electiveRequirement}` : "",
        electiveRequirementForProfile(record, profile).state === "needs-check" ? "选科待核" : "",
      ].filter(Boolean);
      const focus = [
        `${record.majorName}：${fit.text}`,
        trend ? `${trend.text}${trend.caution}` : "",
        planEvidence?.text || "",
        admissionCautionText(record),
      ]
        .map((text) => String(text || "").trim().replace(/[。；]+$/g, ""))
        .filter(Boolean)
        .join("。");
      return {
        name: record.schoolName,
        tags,
        focus: `${focus}。`,
        role: fit.zone,
        optionScore,
        admissionFit: fit,
        planEvidence,
        scoreStatus: isHubeiLimitedSchoolHistoricalAdmissionRecord(record)
          ? "湖北限定院校2025历史投档线：只作2026资格范围核验"
          : isThirdPartyAdmissionRecord(record)
          ? record.minRankEnd
            ? "待复核第三方最低分及其一分一段换算位次：最高B级"
            : "待复核第三方最低分摘要：最高B级"
          : isSchoolOfficialOnlyRecord(record)
          ? record.minRankEnd
            ? isScoreDerivedRankRecord(record) ? "学校官网单校最低分及其一分一段换算位次：非校录取最低位次" : "学校官网单校最低分/位次：仅作候选复核"
            : "学校官网单校最低分：位次待补，仅作候选复核"
          : record.dataType === "vocational-admission"
          ? record.minRankEnd
            ? isLimitedAdmissionRecord(record) ? "已接入高职专科第2次志愿最低位次（无最低分）" : "已接入高职专科投档线和最低位次"
            : String(record.sourceQuality || "").includes("admission") ? "已接入高职专科录取最低分，位次待补" : "已接入高职专科投档线，位次待补"
          : String(record.sourceQuality || "").includes("filing")
            ? record.minRankEnd
              ? isProfessionalFilingRecord(record) ? "已接入普通类专业投档线和最低位次" : "已接入本科投档线和最低位次"
              : "已接入本科投档线，位次待补"
            : record.minRankEnd ? "已接入专业最低位次" : "已接入专业最低分，位次待补",
        record,
      };
    })
    .sort((a, b) => b.optionScore - a.optionScore || (b.record.minScore || 0) - (a.record.minScore || 0));
  return dedupeAdmissionOptions(records).slice(0, 5);
}

function buildSchoolOptions(candidate, profile, band) {
  const scoreStatus = admissionScoreStatus();
  const provinceReadiness = provinceReadinessForProfile(profile);
  const vocationalQualification = ordinaryVocationalQualificationStatus(profile);
  const limitedOnly = vocationalQualification.limitedOnly;
  const profileRecordCount = qualificationFilteredAdmissionRecords(profile).length;
  const belowVocationalLine = vocationalQualification.below;
  const vocationalQualificationUnknown = vocationalQualification.unknown;
  const vocationalLinePending = vocationalQualification.pending;
  const cityPrefs = parseList(profile.cities);
  const interestWords = parseList(profile.interest);
  const vocationalMode = isVocationalProfile(profile);
  const nonVocationalLowScoreCandidate = vocationalMode && !["vocational-dual", "regional-safe"].includes(candidate.id);
  const source = SCHOOL_RECOMMENDATIONS[candidate.id] || [];
  const ranked = source.map((school) => {
    const text = `${school.name} ${school.tags.join(" ")} ${school.focus}`;
    let score = 50;
    if (cityPrefs.length && hasTextHit(text, cityPrefs)) score += 16;
    if (interestWords.length && hasTextHit(text, interestWords)) score += 16;
    if (candidate.disciplines.includes(profile.disciplineFocus)) score += 10;
    if (candidate.profiles.includes(profile.childType)) score += 8;
    if (band.id === "elite" && /高平台|985|211/.test(text)) score += 8;
    if (profile.budget !== "不敏感" && /高成本|港澳|中外/.test(text)) score -= 16;
    return { ...school, optionScore: score };
  }).sort((a, b) => b.optionScore - a.optionScore);
  const roles = belowVocationalLine || vocationalQualificationUnknown || vocationalLinePending
    ? ["路径调研", "路径调研", "路径调研"]
    : nonVocationalLowScoreCandidate
    ? ["暂不推荐", "暂不推荐", "暂不推荐"]
    : scoreStatus.available ? ["首选", "稳妥", "备选"] : ["首选核验", "稳妥核验", "备选核验"];
  const genericScoreStatus = belowVocationalLine
    ? "低于普通高职专科控制线，仅保留为升学路径和专业认知调研"
    : vocationalQualificationUnknown
    ? "专科控制线使用另一成绩口径，补充分数前仅作资格与路径调研"
    : vocationalLinePending
    ? "本年度普通高职专科控制线待官方发布，仅作资格与路径调研"
    : nonVocationalLowScoreCandidate
    ? "300分以下不使用本科专业分作为录取依据，仅保留为远期认知"
    : scoreStatus.available
    ? profileRecordCount
      ? "本方向未命中已导入专业分，需继续补该方向数据"
      : `待导入${profile.province || "该省"}${profile.subject || ""}录取分后再判定可达性`
    : "待导入院校/专业录取分后再判定可达性";
  const genericOptions = ranked.slice(0, 3).map((school, index) => ({
    ...school,
    role: roles[index] || "备选核验",
    scoreStatus: genericScoreStatus,
  }));
  if (belowVocationalLine) {
    return [
      { name: "高职单招与分类考试政策", tags: ["资格与时间节点"], focus: "核对本省后续可用的单招、分类考试或征集政策，不把普通批院校当作可录取结果。", role: "路径调研", scoreStatus: genericScoreStatus },
      { name: "复读与下一年度重规划", tags: ["分数提升", "选科与专业重建"], focus: "结合单科短板、目标专业和家庭承受度评估复读，不用单次排序分替代家庭决策。", role: "路径调研", scoreStatus: genericScoreStatus },
      { name: "职业技能与就业衔接", tags: ["技能训练", "升学衔接"], focus: "核验正规办学资质、技能证书含金量、继续升学通道和真实就业去向。", role: "路径调研", scoreStatus: genericScoreStatus },
    ];
  }
  if (vocationalQualificationUnknown || vocationalLinePending) {
    return [
      {
        name: vocationalLinePending ? "2026普通高职专科资格线跟踪" : "专科资格成绩口径补充",
        tags: ["资格边界", vocationalLinePending ? "等待官方发布" : "补充成绩"],
        focus: vocationalLinePending
          ? "等待本省考试院发布2026普通高职专科控制线后重新计算，不把往年投档结果当作今年资格。"
          : "补充与专科控制线一致的成绩口径后重新计算，不用不可比总分判断今年资格。",
        role: "路径调研",
        scoreStatus: genericScoreStatus,
      },
      {
        name: "双高专业群与职业本科路径调研",
        tags: ["职业教育", "专业群", "升学衔接"],
        focus: "先按专业群、培养能力、区域产业和升学通道建立方向池；控制线或可比分数补齐前不列具体可报院校。",
        role: "路径调研",
        scoreStatus: genericScoreStatus,
      },
      {
        name: "专升本与就业衔接核验",
        tags: ["专升本", "技能培养", "就业去向"],
        focus: "核验正规办学资质、专升本政策、实训条件和真实就业去向，待资格边界明确后再落到院校专业。",
        role: "路径调研",
        scoreStatus: genericScoreStatus,
      },
    ];
  }
  const admissionOptions = buildAdmissionOptions(candidate, profile);
  if (limitedOnly) {
    if (admissionOptions.length) return admissionOptions;
    return [{
      name: "限定院校范围核验",
      tags: ["湖北2026", "150-199分", "非通用专科线"],
      focus: "当前方向没有命中可由官方历史投档证据确认的限定院校专业组；需按2026年招生计划逐校核对办学性质、举办地和专业组资格。",
      role: "资格核验",
      scoreStatus: "不生成通用院校候选，也不把外省学校纳入150分限定线",
    }];
  }
  const planOptions = buildPlanOptions(candidate, profile, band);
  const shouldSurfacePlans = planOptions.length && (
    !admissionOptions.length ||
    ["seed", "thin"].includes(provinceReadiness?.status) ||
    profileRecordCount < 20
  );
  const admissionLimit = shouldSurfacePlans ? 2 : 5;
  return [...admissionOptions.slice(0, admissionLimit), ...planOptions, ...genericOptions].slice(0, 5);
}

function scoreCandidate(candidate, profile, band) {
  const evidence = findEvidence(candidate.keywords);
  const scoreStatus = admissionScoreStatus();
  const vocationalQualification = ordinaryVocationalQualificationStatus(profile);
  const limitedOnly = vocationalQualification.limitedOnly;
  const profileRecords = qualificationFilteredAdmissionRecords(profile);
  const provinceReadiness = provinceReadinessForProfile(profile);
  const freshness = admissionDataFreshness(profile);
  const belowVocationalLine = vocationalQualification.below;
  const vocationalQualificationUnknown = vocationalQualification.unknown;
  const vocationalLinePending = vocationalQualification.pending;
  const vocationalLineComparison = vocationalQualification.comparison;
  const limitedVocationalLine = vocationalQualification.limitedLine;
  const limitedVocationalComparison = vocationalQualification.limitedComparison;
  const rawCandidateAdmissionRecords = profileRecords
    .filter((record) => recordEligibleForCandidate(record, candidate, profile))
    .filter((record) => candidateMatchesAdmissionRecord(candidate, record, profile));
  const candidateAdmissionRecords = dedupeAdmissionRecords(rawCandidateAdmissionRecords);
  const bestAdmission = belowVocationalLine || vocationalQualificationUnknown || vocationalLinePending ? null : candidateAdmissionRecords
    .map((record) => ({
      record,
      fit: admissionFit(record, profile),
      interest: majorInterestScore(record, profile),
      planEvidence: currentPlanEvidenceForAdmissionRecord(record, profile),
    }))
    .sort((a, b) =>
      (b.fit.score + b.interest + (b.planEvidence?.rankingBonus || 0)) -
      (a.fit.score + a.interest + (a.planEvidence?.rankingBonus || 0))
    )[0];
  const limitedAdmission = bestAdmission && isLimitedAdmissionRecord(bestAdmission.record);
  const schoolOfficialAdmission = bestAdmission && isSchoolOfficialOnlyRecord(bestAdmission.record);
  const thirdPartyAdmission = bestAdmission && isThirdPartyAdmissionRecord(bestAdmission.record);
  const staleAdmission = bestAdmission && !bestAdmission.fit.recency?.fresh;
  const multiyearGuard = bestAdmission?.fit?.historicalGuard || null;
  const currentPlanEvidence = bestAdmission?.planEvidence || null;
  const electivePendingRecords = candidateAdmissionRecords.filter((record) => electiveRequirementForProfile(record, profile).state === "needs-check");
  const redLines = parseList(profile.redLines);
  const cityPrefs = parseList(profile.cities);
  const interestWords = parseList(profile.interest);
  const vocationalMode = isVocationalProfile(profile);
  const bachelorLine = ordinaryBachelorControlLine(profile);
  const vocationalLine = vocationalQualification.line;
  const segmentStatus = ordinarySegmentStatus(profile);
  const bachelorLineLabel = controlLineDisplayLabel(bachelorLine, "普通本科最低控制线");
  const lowerLineLabel = controlLineDisplayLabel(vocationalLine, "普通高职专科最低控制线");
  const belowAllLineText = belowVocationalLine && limitedVocationalLine
    ? `，且低于限定院校线${limitedVocationalLine.score}分`
    : "";
  const segmentedLowerLine = vocationalLine?.record?.controlLineRouteKind === "segment";
  const candidateText = normalizeText([
    candidate.title,
    candidate.stance,
    candidate.examples.join(" "),
    candidate.keywords.join(" "),
    candidate.cities.join(" "),
  ].join(" "));
  const missingInputs = [];
  if (!profile.province) missingInputs.push("省份");
  if (!profile.subject || profile.subject === "不确定") missingInputs.push("科类/选科");
  if (!usableRankForProfile(profile)) missingInputs.push("位次");
  if (xizangCandidateCategoryMissing(profile)) missingInputs.push("西藏考生类别");
  if (vocationalQualificationUnknown) missingInputs.push("北京专科语数外三科总分");
  if (vocationalLinePending) missingInputs.push(`${profile.province || "本省"}2026年普通高职专科控制线`);

  const redLineText = normalizeText(redLines.join(" "));
  const redLineConflict = redLines.some((item) => candidateText.includes(normalizeText(item))) ||
    candidate.keywords.some((keyword) => redLineText.includes(normalizeText(keyword))) ||
    candidate.cities.some((city) => redLineText.includes(normalizeText(city)));

  let hardFit = 66;
  if (profile.province) hardFit += 8;
  if (profile.subject && profile.subject !== "不确定") hardFit += 8;
  if (usableRankForProfile(profile)) hardFit += 8;
  if (profile.disciplineFocus && candidate.disciplines.includes(profile.disciplineFocus)) hardFit += 10;
  if (vocationalMode && candidate.id === "vocational-dual") hardFit += 12;
  if (redLineConflict) hardFit -= 30;

  let scoreRank = bandFit(candidate, band);
  if (bestAdmission) {
    scoreRank = bestAdmission.fit.score >= 76
      ? Math.max(scoreRank, bestAdmission.fit.score)
      : Math.min(scoreRank, bestAdmission.fit.score);
  }
  else if (scoreStatus.available && profileRecords.length) scoreRank -= 6;
  if (vocationalMode && candidate.id === "vocational-dual") {
    scoreRank += bestAdmission && bestAdmission.fit.score < 62 ? 8 : 20;
  }
  if (profile.strategy === "冲刺" && candidate.stance.includes("冲刺")) scoreRank += 10;
  if (profile.strategy === "稳健" && /稳|保|兜底/.test(candidate.stance)) scoreRank += 12;
  if (profile.strategy === "均衡" && /平衡|稳妥|城市|专业/.test(candidate.stance)) scoreRank += 8;

  const interestMatched = interestWords.length && candidate.keywords.some((keyword) => hasTextHit(keyword, interestWords));
  let majorFit = 58;
  if (profile.disciplineFocus && candidate.disciplines.includes(profile.disciplineFocus)) majorFit += 28;
  if (candidate.profiles.includes(profile.childType)) majorFit += 18;
  if (interestMatched) majorFit += 14;
  if (bestAdmission) majorFit += Math.min(18, Math.max(0, bestAdmission.interest));
  if (vocationalMode && candidate.id === "vocational-dual") majorFit += 18;
  if (profile.childType === "家庭预算敏感" && candidate.highCost) majorFit -= 12;

  let cityBudget = 62;
  if (cityPrefs.length && candidate.cities.some((city) => hasTextHit(city, cityPrefs))) cityBudget += 24;
  if (!cityPrefs.length) cityBudget += 6;
  if (profile.budget === "高度敏感" && candidate.highCost) cityBudget -= 36;
  if (profile.budget === "中等敏感" && candidate.highCost) cityBudget -= 18;
  if (profile.childType === "城市资源型" && candidate.cities.length) cityBudget += 10;
  if (redLineConflict) cityBudget -= 14;

  const evidenceScore = clamp(42 + evidence.length * 8 + Math.min(candidate.keywords.length, 8) * 2);
  let riskPenalty = 0;
  if (redLineConflict) riskPenalty += 22;
  if (candidate.highCost && profile.budget !== "不敏感") riskPenalty += profile.budget === "高度敏感" ? 18 : 8;
  if (missingInputs.includes("位次")) riskPenalty += 8;
  if (missingInputs.includes("省份")) riskPenalty += 8;
  if (belowVocationalLine) riskPenalty += 18;
  if (limitedOnly) riskPenalty += 14;
  if (vocationalQualificationUnknown) riskPenalty += 14;
  if (vocationalLinePending) riskPenalty += 14;
  if (xizangCandidateCategoryMissing(profile)) riskPenalty += 18;
  if (xizangRankSourceUnconfirmed(profile)) riskPenalty += 6;
  if (vocationalMode && !["vocational-dual", "regional-safe"].includes(candidate.id)) riskPenalty += 18;
  if (scoreStatus.available && !profileRecords.length) riskPenalty += 10;
  if (bestAdmission && bestAdmission.fit.score < 62) riskPenalty += 16;
  else if (bestAdmission && bestAdmission.fit.score < 76) riskPenalty += 8;
  if (provinceReadiness?.status === "usable") riskPenalty += 3;
  if (provinceReadiness?.status === "seed") riskPenalty += 7;
  if (provinceReadiness?.status === "thin") riskPenalty += 12;
  if (candidate.id === "medicine-police" && !/医学|军|警|体检|稳定|深造/.test(`${profile.interest} ${profile.redLines} ${profile.childType}`)) riskPenalty += 6;

  const total = clamp(
    hardFit * 0.35 +
    scoreRank * 0.25 +
    majorFit * 0.2 +
    cityBudget * 0.1 +
    evidenceScore * 0.1 -
    riskPenalty,
    0,
    100
  );
  const officialDataDiscount =
    4 +
    (interestWords.length && !interestMatched ? 3 : 0) +
    (!candidate.profiles.includes(profile.childType) ? 2 : 0) +
    (candidate.highCost ? 2 : 0);
  let displayTotal = clamp(total - officialDataDiscount, 0, 96);
  if (vocationalMode && !["vocational-dual", "regional-safe"].includes(candidate.id)) {
    displayTotal = Math.min(displayTotal, 48);
  }
  if (belowVocationalLine) displayTotal = Math.min(displayTotal, 42);
  if (limitedOnly) displayTotal = Math.min(displayTotal, 58);
  if (vocationalQualificationUnknown) displayTotal = Math.min(displayTotal, 55);
  if (vocationalLinePending) displayTotal = Math.min(displayTotal, 55);
  if (xizangCandidateCategoryMissing(profile)) displayTotal = Math.min(displayTotal, 55);
  if (xizangRankSourceUnconfirmed(profile)) displayTotal = Math.min(displayTotal, 55);
  if (thirdPartyAdmission) displayTotal = Math.min(displayTotal, 72);
  if (bestAdmission && bestAdmission.fit.score < 62) {
    displayTotal = Math.min(displayTotal, 68);
  } else if (bestAdmission && bestAdmission.fit.score < 76) {
    displayTotal = Math.min(displayTotal, 76);
  }

  let confidence = "C";
  let confidenceReason = "探索性建议：需要补充更多输入或官方数据后再进入正式方案。";
  if (bestAdmission?.record?.minRankEnd && !limitedAdmission && !schoolOfficialAdmission && !thirdPartyAdmission && !staleAdmission && !missingInputs.length && evidence.length >= 4 && bestAdmission.fit.score >= 76 && total >= 76 && riskPenalty <= 12) {
    confidence = "A";
    confidenceReason = multiyearGuard
      ? "输入完整且已接入结构化录取分，并已按多年官方保守边界降低乐观程度；可进入院校/专业排序，最终仍需官方核验。"
      : "输入完整且已接入结构化录取分，可进入院校/专业分数排序；最终仍需官方核验。";
  } else if (bestAdmission && !thirdPartyAdmission && !missingInputs.length && evidence.length >= 4 && bestAdmission.fit.score >= 62 && total >= 68 && riskPenalty <= 16) {
    confidence = "A-";
    confidenceReason = limitedAdmission
      ? "输入完整且命中官方投档位次，但来源是第2次志愿或 rank-only 口径，只能作为强候选核验。"
      : schoolOfficialAdmission
        ? isScoreDerivedRankRecord(bestAdmission.record)
          ? "输入完整且命中学校官网单校最低分及其一分一段换算位次；该位次不是学校录取最低位次，也不是省级全量投档表，最高只作为 A- 强候选核验。"
          : "输入完整且命中学校官网单校最低分/位次，但它不是省级全量投档表，最高只作为 A- 强候选核验。"
        : staleAdmission
          ? `输入完整且命中${bestAdmission.fit.recency.label}历史录取边界，已按年份降低排序权重，最高只作为 A- 强候选核验。`
          : multiyearGuard
            ? "输入完整且有录取分数据支持，并已按多年官方保守边界降低乐观程度；目标专业仍需逐项核验。"
            : "输入完整且有录取分数据支持，但目标专业仍需逐项核验。";
  } else if (evidence.length >= 4 && total >= 62) {
    confidence = "B";
    confidenceReason = thirdPartyAdmission
      ? "当前最佳院校专业边界来自待复核第三方摘要；即使分数已连接官方一分一段，最高只作为B级候选线索，必须回考试院或学校官网原表确认。"
      : scoreStatus.available
      ? "本地证据可用，但存在关键输入缺口或风险项，适合作为候选继续核验。"
      : "缺少结构化院校/专业录取分，当前只能作为候选核验清单，不能判断录取概率。";
  }
  if (currentPlanEvidence?.current && ["A", "A-"].includes(confidence)) {
    const planQualification = currentPlanEvidence.eligibility.state === "unmatched"
      ? "批次口径已变且选科冲突待核"
      : currentPlanEvidence.eligibility.state === "needs-check"
        ? "选科仍待核验"
        : "当前科类与选科未发现冲突";
    const planEvidenceLabel = currentPlanEvidence.routeTransition
      ? "官方普通本科计划佐证"
      : "官方计划在招证据";
    confidenceReason = `${confidenceReason.replace(/[。；]+$/, "")}；最佳候选另有${currentPlanEvidence.year}年${planEvidenceLabel}（${planQualification}），但计划存在不等于录取概率。`;
  }
  if (belowVocationalLine) {
    confidence = "C";
    confidenceReason = `当前分数低于本省同科类${lowerLineLabel}，只能做升学路径探索，不能把院校清单解释为可录取结果。`;
  } else if (limitedOnly) {
    confidence = "C";
    confidenceReason = `当前分数只达到湖北2026年限定院校150分线，未达到普通高职高专200分通用线；候选仅作限定院校资格和历史投档核验。`;
  } else if (vocationalQualificationUnknown) {
    confidence = "C";
    confidenceReason = `本省普通专科线使用${vocationalLineComparison.label}，当前未提供该口径分数，不能确认普通专科批资格。`;
  } else if (vocationalLinePending) {
    confidence = "C";
    confidenceReason = `${profile.province || "本省"}2026年普通高职专科控制线尚待官方发布，当前不能确认普通专科批资格。`;
  } else if (xizangCandidateCategoryMissing(profile)) {
    confidence = "C";
    confidenceReason = "西藏A/B类决定控制线和可比录取记录；未确认考生类别时，当前结果只能作调研，不能形成可执行志愿单。";
  } else if (xizangRankSourceUnconfirmed(profile)) {
    confidence = "C";
    confidenceReason = "已填写的西藏位次未确认为官方个人查询结果，系统已排除该位次；确认来源前只能按分数和资格边界调研。";
  }

  const reasons = [
    `基本情况：${profile.childType}；当前策略：${profile.strategy}。以下按成绩、位次、专业偏好与证据质量排序。`,
    `分数/位次进入${band.label}：${band.strategy}`,
    belowVocationalLine
      ? `当前${vocationalLineComparison.label}${vocationalLineComparison.score}分低于${vocationalLine.year}年${profile.province || "本省"}${profile.subject || "普通类"}${lowerLineLabel}${vocationalLine.score}分${belowAllLineText}；${segmentedLowerLine ? "当前普通类分段资格尚未达到" : "普通批录取资格尚未达到"}，只能核验高职单招、技能培养、复读再规划及后续征集政策。`
      : limitedOnly
        ? `当前${limitedVocationalComparison.label}${limitedVocationalComparison.score}分达到${limitedVocationalLine.year}年湖北限定院校线${limitedVocationalLine.score}分，但低于普通高职高专通用线${vocationalLine.score}分；只可核验湖北省独立学院和民办高校、湖北省办在武汉市以外的高职院校。`
      : vocationalQualificationUnknown
        ? `${vocationalLine.year}年${profile.province || "本省"}${lowerLineLabel}${vocationalLine.score}分按${vocationalLineComparison.label}判断；当前只填写了高考总分，尚不能判断普通专科批资格。`
      : vocationalLinePending
        ? `${profile.province || "本省"}2026年普通高职专科控制线尚待官方发布；本科线以下只进入高职专科、双高专业群、专升本和就业路径调研，不能据此认定已具备今年普通专科批资格。`
      : segmentStatus?.band === "second"
        ? `当前${profile.score}分处于${segmentStatus.year}年${profile.province || "本省"}普通类第二段（${segmentStatus.secondLine.score}-${segmentStatus.firstLine.score - 1}分）；第二段仍可能包含剩余本科与高职专科计划，不能按“只能读专科”处理。`
        : segmentStatus?.band === "first"
          ? `当前分数已达到${segmentStatus.year}年${profile.province || "本省"}普通类第一段线${segmentStatus.firstLine.score}分；分段线不是具体院校专业投档线，仍须结合位次和当年计划。`
          : vocationalMode
            ? bachelorLine
              ? `当前${profile.score}分低于${bachelorLine.year}年${profile.province || "本省"}${profile.subject || "普通类"}${bachelorLineLabel}${bachelorLine.score}分，系统优先比较高职专科、双高专业群、专升本和就业路径。`
              : "当前分数进入专科/技能段，系统会优先比较高职专科、双高专业群、专升本和就业路径。"
            : bachelorLine && Number(profile.score) >= bachelorLine.score
              ? `当前${profile.score}分达到${bachelorLine.year}年${profile.province || "本省"}${profile.subject || "普通类"}${bachelorLineLabel}${bachelorLine.score}分，已进入普通本科批次资格边界；这不等于达到任何具体院校或专业投档线。`
            : "",
    candidate.profiles.includes(profile.childType)
      ? `该院校池适合${profile.childType}，与基本情况匹配。`
      : `该院校池不是最强匹配项，但可作为对照方案。`,
    profile.disciplineFocus && candidate.disciplines.includes(profile.disciplineFocus)
      ? `匹配当前专业门类偏好：${profile.disciplineFocus}。`
      : "专业门类匹配一般，需进一步看具体专业和培养方案。",
    scoreStatus.available
      ? belowVocationalLine
        ? "当前分数低于普通高职专科控制线，不据此用历史院校投档记录生成可执行建议。"
        : limitedOnly
        ? bestAdmission
          ? `命中湖北限定院校历史投档证据：${bestAdmission.record.schoolName}${bestAdmission.record.majorGroup ? `-${bestAdmission.record.majorGroup}` : ""}；仍须核对2026招生计划和院校资格。`
          : "当前只达到湖北限定院校线，本方向没有可由官方历史投档证据确认的限定院校专业组。"
        : vocationalQualificationUnknown
        ? "当前缺少与普通专科控制线同口径的分数，不据此用历史院校投档记录生成可执行建议。"
        : vocationalLinePending
        ? "本年度普通高职专科控制线尚待官方发布，不据此用历史院校投档记录生成可执行建议。"
        : bestAdmission
        ? thirdPartyAdmission
          ? `命中待复核第三方录取摘要：${bestAdmission.record.schoolName}${bestAdmission.record.majorName ? `-${bestAdmission.record.majorName}` : ""}，${bestAdmission.fit.zone}；只作为候选线索。`
          : `命中结构化录取数据：${bestAdmission.record.schoolName}${bestAdmission.record.majorName ? `-${bestAdmission.record.majorName}` : ""}，${bestAdmission.fit.zone}。`
        : "本方向暂未命中当前省份/科类的结构化录取记录，仍需导入更多院校/专业分。"
      : "尚未接入结构化院校/专业录取分，分数可达性必须人工查表核验。",
    currentPlanEvidence
      ? `${currentPlanEvidence.text}。`
      : bestAdmission
        ? "当前最佳录取候选尚未命中本地可严格对应的2025-2026官方计划；这表示计划证据待补，不表示该专业已经停招。"
        : "",
    cityPrefs.length && candidate.cities.some((city) => hasTextHit(city, cityPrefs))
      ? `匹配城市偏好：${candidate.cities.filter((city) => hasTextHit(city, cityPrefs)).join("、")}。`
      : "城市偏好没有强命中，排序主要来自专业/平台/证据。",
  ].filter(Boolean);

  const warnings = [
    ...(belowVocationalLine ? [`当前${vocationalLineComparison.label}低于${vocationalLine.year}年${lowerLineLabel}${vocationalLine.score}分${belowAllLineText}；下列院校和专业只能作为路径调研，不得视为普通批可录取名单。`] : []),
    ...(limitedOnly ? [`当前分数低于湖北2026普通高职高专通用线${vocationalLine.score}分；150分线仅适用于湖北省独立学院和民办高校、湖北省办在武汉市以外的高职院校，必须逐校核对2026招生计划。`] : []),
    ...(vocationalQualificationUnknown ? [`${profile.province || "本省"}普通专科线按${vocationalLineComparison.label}判断；请补充该分数后再生成可执行院校专业清单。`] : []),
    ...(vocationalLinePending ? [`${profile.province || "本省"}2026年普通高职专科控制线尚待官方发布；当前结果只作路径调研，发布后必须重新计算资格边界。`] : []),
    ...(xizangCandidateCategoryMissing(profile) ? ["西藏A/B类尚未确认：A类仅指区内世居两代（含两代）以上少数民族考生，B类指汉族及区外少数民族考生；控制线和单校记录不得跨类别混用。"] : []),
    ...(xizangRankSourceUnconfirmed(profile) ? ["西藏手填位次来源未确认：该位次已从模型输入中排除，不影响分段、院校匹配和排序。"] : []),
    ...(profile.rankEstimateText ? [`${profile.rankEstimateText}正式填报前必须回省考试院原表复核。`] : []),
    ...freshness.warnings,
    ...(vocationalMode && !["vocational-dual", "regional-safe"].includes(candidate.id) ? ["当前分数段不宜只按本科平台逻辑排序，应同步核验高职专科和专升本路径。"] : []),
    ...(!scoreStatus.available ? [scoreStatus.reason] : []),
    ...(scoreStatus.available && !profileRecords.length ? [`当前本地还没有导入${profile.province || "该省"}${profile.subject || ""}结构化录取记录，结果降级为全国候选。`] : []),
    ...(scoreStatus.available && profileRecords.length && !candidateAdmissionRecords.length ? ["当前方向没有命中已导入的本省同科类分数记录，建议继续补充该方向院校数据。"] : []),
    ...(bestAdmission && bestAdmission.fit.score < 62 ? ["当前最佳命中仍属于高冲区间，不能作为稳妥志愿使用。"] : []),
    ...(staleAdmission ? [bestAdmission.fit.recency.text] : []),
    ...(multiyearGuard ? [multiyearGuard.text] : []),
    ...(currentPlanEvidence?.current && currentPlanEvidence.eligibility.state === "needs-check"
      ? [`最佳录取候选命中${currentPlanEvidence.year}年官方计划，但${currentPlanEvidence.eligibility.text}；核验前不能形成正式志愿项。`]
      : []),
    ...(limitedAdmission ? [admissionRecordLimitWarning(bestAdmission.record)] : []),
    ...(thirdPartyAdmission ? [admissionRecordLimitWarning(bestAdmission.record)] : []),
    ...(schoolOfficialAdmission ? [admissionRecordLimitWarning(bestAdmission.record)] : []),
    ...(electivePendingRecords.length ? [`当前方向有${fmtNumber(electivePendingRecords.length)}条记录的再选科目要求待核验；填写“再选科目”后可缩小候选。`] : []),
    ...(provinceReadiness && provinceReadiness.status !== "strong" ? [`${provinceReadiness.province}数据成熟度为${provinceReadiness.statusLabel}（${provinceReadiness.readinessScore}分）：${provinceReadiness.recommendationUse}`] : []),
    ...candidate.risks,
    ...missingInputs.map((item) => `缺少${item}，结果可信度降低。`),
  ];
  if (redLineConflict) warnings.unshift("命中不可接受项，需要人工确认是否排除。");
  if (candidate.highCost && profile.budget !== "不敏感") warnings.unshift("该路径可能触发高成本风险，预算敏感家庭需谨慎。");

  return {
    ...candidate,
    total: Math.round(displayTotal),
    parts: {
      hardFit: Math.round(clamp(hardFit)),
      scoreRank: Math.round(clamp(scoreRank)),
      majorFit: Math.round(clamp(majorFit)),
      cityBudget: Math.round(clamp(cityBudget)),
      evidence: Math.round(clamp(evidenceScore)),
      riskPenalty,
    },
    evidence,
    schoolOptions: buildSchoolOptions(candidate, profile, band),
    scoreStatus,
    confidence,
    confidenceReason,
    reasons,
    warnings: [...new Set(warnings)].slice(0, 5),
  };
}

const APPLICATION_PLAN_TIERS = [
  { id: "priority", label: "优先核验", note: "历史录取边界相对有利；是否当年可报，仍以每项的当前计划状态为准。" },
  { id: "steady", label: "稳妥候选", note: "历史边界接近或有一定余量；计划待核的项目不能直接进入正式志愿单。" },
  { id: "reach", label: "冲刺候选", note: "历史边界偏紧，只作为孩子愿意承担风险且当前计划允许的上探项。" },
  { id: "review", label: "待复核数据候选", note: "最低分来自第三方摘要，只作检索线索；回考试院或学校官网原表确认前不得进入正式志愿单。" },
  { id: "plan", label: "计划与资格核验", note: "这是招生计划或历史征集线索，不是录取概率。" },
];

function applicationPlanTier(option) {
  if (!option?.record) return null;
  if (isPlanRecord(option.record)) return "plan";
  if (isHubeiLimitedSchoolHistoricalAdmissionRecord(option.record)) return "plan";
  if (isThirdPartyAdmissionRecord(option.record)) return "review";
  const fitScore = Number(option.admissionFit?.score) || 0;
  if (fitScore >= 82) return "priority";
  if (fitScore >= 68) return "steady";
  return "reach";
}

function applicationPlanKey(option) {
  const record = option.record || {};
  if (!isPlanRecord(record)) return admissionRouteIdentityKey(record);
  return [
    record.province || "",
    record.subjectType || "",
    record.batch || "",
    record.schoolName || record.schoolCode || option.name || "",
    record.majorName || record.majorGroup || record.majorCode || "",
    record.majorGroup || "",
    isVacancyPlanRecord(record) ? "vacancy" : "regular",
  ].map(normalizeText).join("|");
}

function applicationPlanOptionScore(option, result, tierIndex) {
  const recencyScore = option.admissionFit?.recency?.fresh ? 8 : 0;
  return (APPLICATION_PLAN_TIERS.length - tierIndex) * 1000 +
    (Number(option.optionScore) || 0) * 2 +
    (Number(result.total) || 0) +
    recencyScore;
}

function applicationPlanReadiness(option) {
  const record = option?.record;
  if (!record) {
    return {
      state: "unknown",
      label: "当前计划待核",
      text: "该项缺少可绑定的记录，不能进入正式志愿单。",
      confirmed: false,
      admissionOption: false,
    };
  }
  if (isPlanRecord(record)) {
    return {
      state: "plan-only",
      label: isVacancyPlanRecord(record) ? "历史征集计划" : "计划层候选",
      text: "该项只有计划证据，没有可比较的录取边界。",
      confirmed: false,
      admissionOption: false,
    };
  }

  const evidence = option.planEvidence;
  if (!evidence) {
    return {
      state: "current-plan-unmatched",
      label: "2026计划待核",
      text: "本地尚未命中可严格对应的2026官方计划；这不表示停招，但核验前不能进入正式志愿单。",
      confirmed: false,
      admissionOption: true,
    };
  }
  if (!evidence.current) {
    return {
      state: "near-year-only",
      label: `仅${evidence.year}计划佐证`,
      text: `当前只命中${evidence.year}年计划，2026年是否继续招生仍须核验。`,
      confirmed: false,
      admissionOption: true,
    };
  }
  if (evidence.ambiguousPlanRequirements) {
    return {
      state: "current-plan-ambiguous",
      label: "2026计划多口径待核",
      text: "2026年同一院校专业存在多个选科或招生口径，核验前不能进入正式志愿单。",
      confirmed: false,
      admissionOption: true,
    };
  }
  if (evidence.eligibility?.state === "unmatched") {
    return {
      state: "current-plan-conflict",
      label: "2026选科冲突待核",
      text: "历史录取批次与2026计划批次口径不同，且当前选科与计划要求冲突；只保留为人工复核项。",
      confirmed: false,
      admissionOption: true,
    };
  }
  if (evidence.eligibility?.state === "needs-check") {
    return {
      state: "current-plan-needs-check",
      label: "2026选科待核",
      text: "已命中2026官方计划，但选科或招生资格尚不能自动确认，核验前不能进入正式志愿单。",
      confirmed: false,
      admissionOption: true,
    };
  }
  return {
    state: "current-plan-confirmed",
    label: "2026计划已佐证",
    text: "已命中2026官方计划且当前科类、选科未发现冲突；这仍不代表录取概率。",
    confirmed: true,
    admissionOption: true,
  };
}

function buildApplicationPlan(results) {
  const selected = [];
  const planIndexes = new Map();
  const admissionIndexesByBase = new Map();
  for (const result of results || []) {
    for (const option of result.schoolOptions || []) {
      const tier = applicationPlanTier(option);
      if (!tier) continue;
      const tierIndex = APPLICATION_PLAN_TIERS.findIndex((item) => item.id === tier);
      const entry = {
        ...option,
        tier,
        tierIndex,
        matchingPools: [result.title],
        candidateScore: applicationPlanOptionScore(option, result, tierIndex),
      };
      const planRecord = isPlanRecord(option.record);
      const baseKey = planRecord
        ? applicationPlanKey(option)
        : admissionOptionBaseIdentityKey(option.record);
      const candidateIndexes = planRecord
        ? (planIndexes.has(baseKey) ? [planIndexes.get(baseKey)] : [])
        : (admissionIndexesByBase.get(baseKey) || []);
      const existingIndex = planRecord
        ? candidateIndexes[0]
        : candidateIndexes.find((index) => admissionRecordsShareRoute(selected[index].record, option.record));
      if (existingIndex === undefined) {
        const nextIndex = selected.length;
        selected.push(entry);
        if (planRecord) {
          planIndexes.set(baseKey, nextIndex);
        } else {
          candidateIndexes.push(nextIndex);
          admissionIndexesByBase.set(baseKey, candidateIndexes);
        }
        continue;
      }
      const previous = selected[existingIndex];
      previous.matchingPools = [...new Set([...previous.matchingPools, result.title])];
      const preferred = planRecord
        ? (entry.candidateScore > previous.candidateScore ? entry : previous)
        : dedupeAdmissionOptions([previous, entry])[0];
      const merged = {
        ...preferred,
        matchingPools: previous.matchingPools,
        candidateScore: Math.max(previous.candidateScore, entry.candidateScore),
      };
      merged.tier = applicationPlanTier(merged);
      merged.tierIndex = APPLICATION_PLAN_TIERS.findIndex((item) => item.id === merged.tier);
      selected[existingIndex] = merged;
    }
  }

  return APPLICATION_PLAN_TIERS.map((tier) => ({
    ...tier,
    options: selected
      .filter((option) => option.tier === tier.id)
      .sort((left, right) => right.candidateScore - left.candidateScore)
      .slice(0, tier.id === "plan" ? 3 : 5),
  })).filter((tier) => tier.options.length);
}

function applicationPlanDetail(option) {
  const record = option.record || {};
  const fit = option.admissionFit;
  const planReadiness = applicationPlanReadiness(option);
  const major = record.majorName || record.majorGroup || "专业方向待核验";
  const sourceLabel = isPlanRecord(record)
    ? "官方计划来源"
    : isHubeiLimitedSchoolHistoricalAdmissionRecord(record)
      ? "湖北限定院校历史投档来源"
      : isThirdPartyAdmissionRecord(record)
        ? "待复核第三方录取摘要"
        : isSchoolOfficialOnlyRecord(record)
          ? "学校官网录取来源"
          : "官方投档/录取来源";
  const sourceLimit = isPlanRecord(record)
    ? isVacancyPlanRecord(record)
      ? "历史征集剩余计划，只作补录信号。"
      : "官方招生计划，只说明可报专业池。"
    : admissionRecordLimitWarning(record);
  const fitText = fit?.text || option.focus || "需复核招生章程与当年计划。";
  const detailText = [fitText, sourceLimit, planReadiness.text]
    .map((text) => String(text || "").trim().replace(/[。；]+$/g, ""))
    .filter(Boolean)
    .join("；");
  return {
    major,
    text: `${detailText}。`,
    tags: [
      planReadiness.label,
      record.city,
      record.year ? `${record.year}年` : "",
      record.minScore ? `最低分${record.minScore}` : "",
      record.rankRangeText ? `位次${record.rankRangeText}` : "",
      rankScoreBasisLabel(record),
      fit?.recency?.label || "",
      fit?.historicalGuard?.label || "",
      ...admissionRouteTags(record),
      record.electiveRequirement ? `选科${record.electiveRequirement}` : "",
      electiveRequirementForProfile(record, state.recommendation?.profile || {}).state === "needs-check" ? "选科待核" : "",
      ...((option.matchingPools?.length || 0) > 1 ? [`命中${option.matchingPools.length}个方向`] : []),
    ].filter(Boolean),
    sourceUrl: record.sourceUrl || "",
    sourceLabel,
  };
}

function shortlistItemFromOption(option, tierLabel) {
  const record = option?.record || {};
  const detail = applicationPlanDetail(option);
  return normalizeShortlistItem({
    key: applicationPlanKey(option),
    schoolName: record.schoolName || option?.name || "院校待核验",
    majorName: detail.major,
    tierLabel,
    readinessLabel: applicationPlanReadiness(option).label,
    sourceUrl: detail.sourceUrl,
    sourceLabel: detail.sourceLabel,
  });
}

function toggleRecommendationShortlist(key) {
  const recommendation = state.recommendation;
  if (!recommendation || !key) return;
  const profileKey = shortlistProfileKey(recommendation.profile);
  const current = state.recommendationShortlist?.profileKey === profileKey
    ? state.recommendationShortlist.items
    : loadRecommendationShortlist(recommendation.profile);
  const items = [...current];
  const existingIndex = items.findIndex((item) => item.key === key);
  if (existingIndex >= 0) {
    items.splice(existingIndex, 1);
  } else {
    const option = buildApplicationPlan(recommendation.results)
      .flatMap((tier) => tier.options.map((candidate) => ({ candidate, tier })))
      .find(({ candidate }) => applicationPlanKey(candidate) === key);
    if (!option) return;
    items.push(shortlistItemFromOption(option.candidate, option.tier.label));
  }
  state.recommendationShortlist = { profileKey, items: normalizeShortlistItems(items) };
  saveRecommendationShortlist(recommendation.profile, state.recommendationShortlist.items);
}

function renderApplicationPlan(results) {
  const tiers = buildApplicationPlan(results);
  if (!tiers.length) return "";
  const planOptions = tiers.flatMap((tier) => tier.options);
  const planReadiness = planOptions.map((option) => applicationPlanReadiness(option));
  const admissionOptionCount = planReadiness.filter((item) => item.admissionOption).length;
  const currentPlanConfirmedCount = planReadiness.filter((item) => item.confirmed).length;
  const currentPlanPendingCount = admissionOptionCount - currentPlanConfirmedCount;
  const shortlistItems = state.recommendationShortlist?.items || [];
  const shortlistKeys = new Set(shortlistItems.map((item) => item.key));
  const limitedSchoolOnly = ordinaryVocationalQualificationStatus(state.recommendation?.profile || {}).limitedOnly &&
    planOptions.length > 0 && planOptions.every((option) => isHubeiLimitedSchoolHistoricalAdmissionRecord(option.record));
  const containsThirdParty = planOptions.some((option) => isThirdPartyAdmissionRecord(option.record));
  const planTitle = limitedSchoolOnly
    ? "限定院校资格核验清单"
    : containsThirdParty
      ? "院校专业核验清单"
      : "院校专业候选清单";
  const planDescription = limitedSchoolOnly
    ? "只汇总湖北2025官方投档表中可确认的本省低分专业组，用于核验2026限定院校范围；不是今年可录取名单。"
    : containsThirdParty
      ? `同一院校专业已合并；冲稳层只表示历史边界，第三方摘要和${currentPlanPendingCount}项当前计划未闭合记录均不能直接进入正式志愿单。`
      : `只汇总已命中的本省同科类结构化记录；冲稳层只表示历史边界，当前有${currentPlanConfirmedCount}/${admissionOptionCount}项命中2026计划且未发现科类、选科冲突。`;
  return `<section class="band application-plan">
    <div class="application-plan-head">
      <div>
        <h3>${esc(planTitle)}</h3>
        <p>${esc(planDescription)}</p>
        <p class="shortlist-note">核验清单只保存在本机浏览器，用于和家人讨论，不会上传个人信息。</p>
      </div>
      <div class="application-plan-actions">
        <span>${fmtNumber(currentPlanConfirmedCount)}/${fmtNumber(admissionOptionCount)} 当前计划已佐证</span>
        <span>${fmtNumber(shortlistItems.length)} 项已加入核验清单</span>
        ${shortlistItems.length ? `<button class="ghost-action shortlist-clear" id="clearRecommendationShortlist" type="button">清空清单</button>` : ""}
      </div>
    </div>
    <div class="application-plan-grid">
      ${tiers.map((tier) => `<section class="application-plan-group">
        <header><h4>${esc(tier.label)}</h4><span>${fmtNumber(tier.options.length)} 项</span></header>
        <p>${esc(tier.note)}</p>
        <div class="application-plan-list">
          ${tier.options.map((option) => {
            const detail = applicationPlanDetail(option);
            const shortlistKey = applicationPlanKey(option);
            const shortlisted = shortlistKeys.has(shortlistKey);
            return `<div class="application-plan-row">
              <div>
                <strong>${esc(option.name)} · ${esc(detail.major)}</strong>
                <p>${esc(detail.text)}</p>
                ${renderTags(detail.tags)}
                ${detail.sourceUrl ? `<a class="application-plan-source" href="${esc(detail.sourceUrl)}" target="_blank" rel="noreferrer">${esc(detail.sourceLabel)}</a>` : ""}
              </div>
              <div class="application-plan-row-actions">
                <span>${esc(option.role || tier.label)}</span>
                <button class="ghost-action shortlist-toggle" type="button" data-shortlist-key="${esc(shortlistKey)}" aria-pressed="${shortlisted}">${shortlisted ? "已加入核验清单" : "加入核验清单"}</button>
              </div>
            </div>`;
          }).join("")}
        </div>
      </section>`).join("")}
    </div>
  </section>`;
}

async function loadProvinceData(provinceValue) {
  const province = normalizeProvince(provinceValue);
  if (!province) throw new Error("请先选择考生所在省份");
  if (state.loadedProvince === province) return;
  const entry = state.provinceManifest?.shards?.[province];
  if (!entry) throw new Error(`暂未找到${province}运行分片，请重新构建全国数据索引`);
  let payload = state.provinceShardCache.get(province);
  if (!payload) {
    payload = await fetchRuntimeJson(`provinces/${entry.file}`, `${province}数据`);
    state.provinceShardCache.set(province, payload);
  }
  state.data.admissionScoreLayer.records = payload.records || [];
  state.data.admissionScoreLayer.rankConversions = payload.rankConversions || [];
  state.loadedProvince = province;
  admissionTrendIndexCache = null;
}

async function runRecommendation() {
  await loadProvinceData($("#provinceInput").value.trim());
  const profile = profileFromForm();
  const band = classifyProfileBand(profile);
  const results = candidatePoolsForProfile(profile)
    .map((candidate) => scoreCandidate(candidate, profile, band))
    .sort((a, b) => b.total - a.total || b.evidence.length - a.evidence.length)
    .slice(0, 8);
  state.recommendation = { profile, band, results, generatedAt: new Date().toISOString() };
  state.recommendationShortlist = {
    profileKey: shortlistProfileKey(profile),
    items: loadRecommendationShortlist(profile),
  };
  state.recommendationInvalidated = false;
  renderRecommend();
}

function filteredSources() {
  const query = state.query.trim().toLowerCase();
  return knowledgeSourceFiles().filter((source) => {
    const text = [
      source.title,
      source.relativePath,
      source.excerpt,
      source.domains.map((d) => d.label).join(" "),
      source.disciplines.map((d) => `${d.code}${d.name}`).join(" "),
    ].join(" ").toLowerCase();
    const queryOk = !query || text.includes(query);
    const disciplineOk = !state.discipline || source.disciplines.some((d) => d.code === state.discipline);
    const domainOk = !state.domain || source.domains.some((d) => d.id === state.domain);
    return queryOk && disciplineOk && domainOk;
  });
}

function hasActiveFilters() {
  const geographySourceFilterActive = state.view === "sources" && state.geographySourceFilter !== "all";
  return Boolean(state.query.trim() || state.discipline || state.domain || geographySourceFilterActive);
}

function filterStatusText() {
  const active = [];
  const query = state.query.trim();
  if (query) active.push(`检索“${query}”`);
  const discipline = state.data?.disciplines?.find((item) => item.code === state.discipline);
  if (discipline) {
    active.push(`门类“${discipline.code} ${discipline.name}”`);
  } else if (state.discipline) {
    active.push(`门类“${state.discipline}”`);
  }
  const domain = state.data?.domains?.find((item) => item.id === state.domain);
  if (domain) {
    active.push(`主题“${domain.label}”`);
  } else if (state.domain) {
    active.push(`主题“${state.domain}”`);
  }
  if (state.view === "sources" && state.geographySourceFilter === "public") active.push("地理来源“公开链接”");
  if (state.view === "sources" && state.geographySourceFilter === "local") active.push("地理来源“本地/教材”");
  if (!active.length) return "检索和筛选作用于资料库、专业门类和高中地理。";
  return `当前${active.join("、")}；结果作用于资料库、专业门类和高中地理。`;
}

function syncClearFiltersControl() {
  const button = $("#clearFilters");
  if (!button) return;
  button.hidden = !hasActiveFilters();
  const filterStatus = $("#filterStatus");
  if (filterStatus) filterStatus.textContent = filterStatusText();
}

function clearSearchFilters() {
  state.query = "";
  state.discipline = "";
  state.domain = "";
  state.geographySourceFilter = "all";
  state.disciplineBrowse = "08";
  state.disciplineFamily = "";
  $("#searchInput").value = "";
  $("#disciplineFilter").value = "";
  $("#domainFilter").value = "";
  for (const view of ["sources", "disciplines", "geography"]) {
    state.renderedViews.delete(view);
  }
  syncClearFiltersControl();
}

function renderMetric(label, value) {
  return `<div class="metric"><strong>${fmtNumber(value)}</strong><span>${esc(label)}</span></div>`;
}

function renderTags(items, css = "") {
  if (!items?.length) return "";
  return `<div class="tag-row">${items.map((item) => `<span class="tag ${css}">${esc(item)}</span>`).join("")}</div>`;
}

function sectionHead(title, text) {
  return `<div class="section-head"><div><h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ""}</div></div>`;
}

function renderOverview() {
  const data = state.data;
  const stats = data.extractionStats;
  const strategy = data.strategyFramework.slice(0, 6).map((item) => {
    const title = item.id === "five-axis" ? "五项排序依据" : item.title;
    const body = item.id === "five-axis"
      ? "每个志愿单元按分数位次安全边界、专业适配、院校平台、城市资源和风险限制五项比较，避免只按排名或热门做单点决策。"
      : item.body;
    return `<article class="item-card">
      <h3>${esc(title)}</h3>
      <p>${esc(body)}</p>
    </article>`;
  }).join("");
  const insights = data.experienceInsights.slice(0, 6).map((item) => {
    return `<article class="item-card">
      <h3>${esc(item.title)}</h3>
      <p>${esc(item.body)}</p>
    </article>`;
  }).join("");
  $("#view-overview").innerHTML = `
    ${sectionHead("填报总览")}
    <div class="metric-grid">
      ${renderMetric("资料文件", stats.totalFiles)}
      ${renderMetric("已抽取正文", stats.textExtractedFiles)}
      ${renderMetric("OCR抽取文件", stats.ocrExtractedFiles)}
      ${renderMetric("ASR完整转写", stats.asrTranscribedFiles)}
      ${renderMetric("整合轮次", data.rounds.length)}
    </div>
    <section class="band">
      <h3>填报重点</h3>
      <div class="grid-3">${strategy}</div>
    </section>
    <section class="band">
      <h3>经验与现状</h3>
      <div class="grid-3">${insights}</div>
    </section>
    <details class="detail-drawer">
      <summary>资料整理状态</summary>
      <div class="check-grid">${data.gaps.map((gap) => `<span>${esc(gap)}</span>`).join("")}</div>
    </details>
  `;
}

function renderDisciplines() {
  const query = state.query.trim().toLowerCase();
  const sources = knowledgeSourceFiles().filter((source) => {
    const text = [source.title, source.relativePath, source.excerpt, ...(source.domains || []).map((item) => item.label)].join(" ").toLowerCase();
    return (!query || text.includes(query)) && (!state.domain || (source.domains || []).some((item) => item.id === state.domain));
  });
  const selectedCode = state.discipline || state.disciplineBrowse || "08";
  const selected = state.data.disciplines.find((discipline) => discipline.code === selectedCode) || state.data.disciplines[0];
  const families = DISCIPLINE_MAJOR_CATALOG[selected.code] || [];
  const selectedFamily = families.find((family) => family.key === state.disciplineFamily) || families[0];
  const selectedSources = sources.filter((source) => source.disciplines.some((item) => item.code === selected.code));
  const cards = state.data.disciplines.map((discipline) => {
    const active = discipline.code === selected.code;
    return `<button class="discipline-tile ${active ? "active" : ""}" type="button" data-discipline-code="${esc(discipline.code)}" aria-pressed="${active}">
      <span>${esc(discipline.code)}</span>
      <strong>${esc(discipline.name)}</strong>
    </button>`;
  }).join("");

  $("#view-disciplines").innerHTML = `
    ${sectionHead("专业门类")}
    <div class="discipline-grid">${cards}</div>
    <section class="discipline-detail">
      <header>
        <div><span>${esc(selected.code)}</span><h3>${esc(selected.name)}</h3></div>
        <strong>${fmtNumber(selectedSources.length)} 条资料</strong>
      </header>
      <p>${esc(selected.guide)}</p>
      <div class="major-family-grid">
        ${families.map((family) => `<button class="major-family-btn ${family.key === selectedFamily?.key ? "active" : ""}" type="button" data-family-key="${esc(family.key)}">${esc(family.name)}</button>`).join("")}
      </div>
      ${selectedFamily ? `<div class="major-list">${selectedFamily.majors.map((major) => `<span>${esc(major)}</span>`).join("")}</div>` : ""}
      <div class="discipline-actions">
        <button class="primary-action" id="disciplineRecommend" type="button">按此方向推荐</button>
        ${state.discipline ? `<button class="ghost-action" id="clearDiscipline" type="button">查看全部门类</button>` : ""}
      </div>
      ${selected.code === "11" || selected.code === "14" ? `<p class="catalog-note">具体专业名称与招生资格以当年教育部目录和院校章程为准。</p>` : ""}
      ${selectedSources.length ? `<details class="detail-drawer compact"><summary>相关资料</summary><div class="source-title-list">${selectedSources.slice(0, 6).map((source) => `<span>${esc(source.title)}</span>`).join("")}</div></details>` : ""}
    </section>
  `;
  bindDisciplineEvents(selected, selectedFamily);
}

function bindDisciplineEvents(selected, selectedFamily) {
  $$('[data-discipline-code]').forEach((button) => {
    button.addEventListener("click", () => {
      state.discipline = button.dataset.disciplineCode;
      state.disciplineBrowse = button.dataset.disciplineCode;
      state.disciplineFamily = "";
      $("#disciplineFilter").value = state.discipline;
      renderDisciplines();
      renderSources();
    });
  });
  $$('[data-family-key]').forEach((button) => {
    button.addEventListener("click", () => {
      state.disciplineFamily = button.dataset.familyKey;
      renderDisciplines();
    });
  });
  $("#disciplineRecommend")?.addEventListener("click", () => {
    state.prefillProfile = {
      ...DEFAULT_PROFILE,
      disciplineFocus: selected.code,
      interest: selectedFamily?.majors?.join(" ") || selected.name,
    };
    state.recommendation = null;
    state.recommendationInvalidated = false;
    renderRecommend();
    updateView("recommend");
  });
  $("#clearDiscipline")?.addEventListener("click", () => {
    state.discipline = "";
    $("#disciplineFilter").value = "";
    renderDisciplines();
    renderSources();
  });
}

function renderRules() {
  const checklist = state.data.riskChecklist.map((item) => `<span>${esc(item.text)}</span>`).join("");

  const domains = state.data.domains.map((domain) => {
    const sources = knowledgeSourceFiles().filter((source) => (source.domains || []).some((item) => item.id === domain.id));
    return `<article class="item-card">
      <h3>${esc(domain.label)}</h3>
      <strong>${fmtNumber(sources.length)} 条资料</strong>
    </article>`;
  }).join("");

  $("#view-rules").innerHTML = `
    ${sectionHead("规则与风险")}
    <section class="band">
      <h3>填报前检查清单</h3>
      <div class="check-grid">${checklist}</div>
    </section>
    <section class="band">
      <h3>主题模块</h3>
      <div class="grid-2">${domains}</div>
    </section>
  `;
}

function geographySummaryMetrics(data) {
  const items = data?.items || [];
  return {
    courses: data?.courses?.length || 0,
    items: items.length,
    sources: data?.sources?.length || 0,
    authoredSummaries: items.filter((item) => item.licenseStatus === "authored-summary").length,
    citationOnlyItems: items.filter((item) => item.licenseStatus === "citation-only").length,
  };
}

function renderGeographySource(source) {
  const title = esc(source?.title || source?.id || "未命名来源");
  const revision = [
    source?.commitSha ? `commit ${source.commitSha}` : "",
    source?.accessedAt ? `访问 ${source.accessedAt}` : "",
  ].filter(Boolean).join(" · ");
  const label = revision ? `${title} · ${esc(revision)}` : title;
  if (source?.url) {
    return `<a class="geography-source-link" href="${esc(source.url)}" target="_blank" rel="noreferrer">${label}</a>`;
  }
  return `<span class="geography-source-local" title="本地索引或教材来源，无公开链接">${label}</span>`;
}

function renderGeographySourceDirectory(data) {
  const query = normalizeText(state.query);
  const querySources = (data?.sources || []).filter((source) => {
    if (!query) return true;
    return normalizeText([
      source.title,
      source.publisher,
      source.editionNote,
      source.licenseNote,
    ].join(" ")).includes(query);
  });
  if (!querySources.length) return "";
  const sourceFilter = ["all", "public", "local"].includes(state.geographySourceFilter)
    ? state.geographySourceFilter
    : "all";
  const sourceCounts = {
    all: querySources.length,
    public: querySources.filter((source) => source?.url).length,
    local: querySources.filter((source) => !source?.url).length,
  };
  const sources = querySources.filter((source) => (
    sourceFilter === "all" || (sourceFilter === "public" ? source?.url : !source?.url)
  ));
  const publicSourceCount = sources.filter((source) => source?.url).length;
  const localSourceCount = sources.length - publicSourceCount;
  const sourceSummary = [
    `${fmtNumber(sources.length)} 条来源`,
    `${fmtNumber(publicSourceCount)} 个公开链接`,
    `${fmtNumber(localSourceCount)} 个本地/教材`,
  ].join(" · ");
  const sourceFilterButtons = [
    ["all", "全部来源"],
    ["public", "公开链接"],
    ["local", "本地/教材"],
  ].map(([value, label]) => `<button class="geography-source-filter ${sourceFilter === value ? "active" : ""}" type="button" data-geography-source-filter="${value}" aria-pressed="${sourceFilter === value}">${label} · ${fmtNumber(sourceCounts[value])}</button>`).join("");
  const rows = sources.map((source) => {
    const title = esc(source?.title || source?.id || "未命名来源");
    const titleMarkup = source?.url
      ? `<a class="geography-directory-link" href="${esc(source.url)}" target="_blank" rel="noreferrer">${title}</a>`
      : `<span class="geography-directory-local" title="本地索引或教材来源，无公开链接">${title}</span>`;
    const metadata = [
      source?.publisher,
      source?.commitSha ? `commit ${source.commitSha}` : "",
      source?.accessedAt ? `访问 ${source.accessedAt}` : "",
    ].filter(Boolean).join(" · ");
    return `<article class="geography-directory-row">
      <div>
        <h4>${titleMarkup}</h4>
        ${metadata ? `<p>${esc(metadata)}</p>` : ""}
        ${source?.editionNote ? `<p>${esc(source.editionNote)}</p>` : ""}
      </div>
      <span class="status">${source?.url ? "公开链接" : "本地/教材"}</span>
    </article>`;
  }).join("");
  return `<section class="band geography-source-directory">
    <div class="data-summary-head">
      <div>
        <h3>高中地理来源目录</h3>
        <p>集中查看地理摘要使用的教材、本地资料与公开网页；公开来源保留访问日期或固定提交版本。</p>
        <div class="geography-directory-controls" role="group" aria-label="地理来源类型">${sourceFilterButtons}</div>
      </div>
      <span class="status">${sourceSummary}</span>
    </div>
    <div class="geography-directory-list">${rows || `<div class="empty-state"><p>当前来源类型筛选没有匹配项。</p></div>`}</div>
  </section>`;
}

function bindGeographySourceFilterEvents() {
  $$(".geography-source-filter").forEach((button) => {
    button.addEventListener("click", () => {
      state.geographySourceFilter = button.dataset.geographySourceFilter || "all";
      syncClearFiltersControl();
      renderView("sources", { force: true });
    });
  });
}

function renderGeography() {
  const data = state.geographyData;
  if (!data) {
    $("#view-geography").innerHTML = `<div class="empty-state"><h2>高中地理资料暂未载入</h2><p>请刷新页面后重试。</p></div>`;
    return;
  }

  const metrics = geographySummaryMetrics(data);
  const query = normalizeText(state.query);
  const courseMap = new Map(data.courses.map((course) => [course.id, course]));
  const visibleItems = data.items.filter((item) => {
    const courseOk = !state.geographyCourse || item.courseId === state.geographyCourse;
    const searchText = normalizeText([
      item.title,
      item.summary,
      ...(item.keywords || []),
      courseMap.get(item.courseId)?.name || "",
    ].join(" "));
    return courseOk && (!query || searchText.includes(query));
  });
  const courseButtons = [
    `<button class="geography-course-btn ${state.geographyCourse ? "" : "active"}" type="button" data-geography-course="">全部课程 · ${fmtNumber(metrics.items)}</button>`,
    ...data.courses.map((course) => {
      const count = data.items.filter((item) => item.courseId === course.id).length;
      return `<button class="geography-course-btn ${state.geographyCourse === course.id ? "active" : ""}" type="button" data-geography-course="${esc(course.id)}">${esc(course.name)} · ${fmtNumber(count)}</button>`;
    }),
  ].join("");
  const cards = visibleItems.map((item) => {
    const course = courseMap.get(item.courseId);
    const sources = item.sourceIds.map((sourceId) => {
      const source = data.sources.find((candidate) => candidate.id === sourceId);
      return source || { id: sourceId };
    });
    const evidence = item.evidence.map((entry) => {
      const source = data.sources.find((candidate) => candidate.id === entry.sourceId);
      return `${source?.title || entry.sourceId} · ${entry.locator}`;
    });
    return `<article class="geography-card">
      <header>
        <div>
          <span class="geography-course-label">${esc(course?.name || item.courseId)}</span>
          <h3>${esc(item.title)}</h3>
        </div>
        <span class="status">${esc(item.reviewStatus === "reviewed" ? "已复核摘要" : "待复核")}</span>
      </header>
      <p>${esc(item.summary)}</p>
      ${renderTags(item.keywords)}
      <details class="detail-drawer compact">
        <summary>教材证据与来源</summary>
        <div class="geography-evidence">
          ${evidence.map((entry) => `<span>${esc(entry)}</span>`).join("")}
        </div>
        <p class="geography-license">${esc(item.licenseStatus === "authored-summary" ? "本站为原创摘要；请回到教材原页核对完整定义、图表与案例。" : "本站仅提供来源索引，不复制原文。")}</p>
        <div class="geography-source-list" aria-label="来源列表">
          ${sources.map(renderGeographySource).join("")}
        </div>
      </details>
    </article>`;
  }).join("");

  $("#view-geography").innerHTML = `
    ${sectionHead("高中地理知识库", `${fmtNumber(visibleItems.length)} 条摘要`)}
    <section class="band geography-intro">
      <h3>按课程复习自然地理、人文地理与资源环境</h3>
      <p>${esc(data.description)}</p>
      <div class="geography-course-grid">${courseButtons}</div>
    </section>
    <section class="band geography-provenance" data-geography-version="${esc(data.version)}">
      <div class="data-summary-head">
        <div>
          <h3>资料边界与更新</h3>
          <p>资料版本 ${esc(data.version)} · 来源索引与原创摘要分开标识。</p>
        </div>
        <span class="status">${fmtNumber(metrics.sources)} 条来源</span>
      </div>
      <div class="metric-grid geography-metric-grid">
        ${renderMetric("课程", metrics.courses)}
        ${renderMetric("知识摘要", metrics.items)}
        ${renderMetric("原创摘要", metrics.authoredSummaries)}
        ${renderMetric("引文型方法卡", metrics.citationOnlyItems)}
      </div>
      <p class="geography-boundary-note">引文型方法卡只用于概念与题型交叉核对，不复制题面、答案或竞赛知识点清单；原始许可未核验的本地资料不提供公开链接。</p>
    </section>
    ${cards ? `<div class="geography-card-list">${cards}</div>` : `<div class="empty-state"><h2>没有匹配的地理摘要</h2><p>换一个关键词，或切换课程范围。</p></div>`}
  `;

  $$('[data-geography-course]').forEach((button) => {
    button.addEventListener("click", () => {
      state.geographyCourse = button.dataset.geographyCourse || "";
      renderGeography();
    });
  });
}

function renderScorePart(label, value) {
  return `<div class="score-part"><span>${esc(label)}</span><strong>${fmtNumber(value)}</strong></div>`;
}

function renderRecommendForm(profile) {
  const disciplineOptions = state.data.disciplines.map((discipline) => (
    `<option value="${esc(discipline.code)}" ${isSelected(discipline.code, getProfileValue(profile, "disciplineFocus"))}>${esc(`${discipline.code} ${discipline.name}`)}</option>`
  )).join("");
  const rankUsageOptions = availableRankUsageOptions().map((option) => {
    const value = rankUsageOptionValue(option);
    return `<option value="${esc(value)}" ${isSelected(value, rankUsageProfileValue(profile))}>${esc(option.label)}</option>`;
  }).join("");
  const rankFieldValue = profile && Object.prototype.hasOwnProperty.call(profile, "rankInput")
    ? profile.rankInput
    : getProfileValue(profile, "rank");
  const guangxiLocalRankFieldValue = profile && Object.prototype.hasOwnProperty.call(profile, "guangxiLocalRankInput")
    ? profile.guangxiLocalRankInput
    : getProfileValue(profile, "guangxiLocalRank");
  const showGuangxiScopeFields = normalizeProvince(getProfileValue(profile, "province")) === "广西";
  const showBeijingVocationalScore = normalizeProvince(getProfileValue(profile, "province")) === "北京";
  const showXizangCandidateCategory = normalizeProvince(getProfileValue(profile, "province")) === "西藏";
  const showXizangRankSource = showXizangCandidateCategory;
  return `<form id="recommendForm" class="recommend-form" aria-describedby="recommendStatus">
    <label>
      <span>考生类型</span>
      <select id="childType">
        ${CHILD_TYPES.map((item) => `<option value="${esc(item)}" ${isSelected(item, getProfileValue(profile, "childType"))}>${esc(item)}</option>`).join("")}
      </select>
    </label>
    <label>
      <span id="scoreFieldLabel">${showGuangxiScopeFields ? "区外院校投档分" : "分数"}</span>
      <input id="scoreInput" type="number" min="0" max="1000" value="${esc(getProfileValue(profile, "score"))}" />
    </label>
    <label id="guangxiLocalScoreField" ${showGuangxiScopeFields ? "" : "hidden"}>
      <span>区内院校投档分</span>
      <input id="guangxiLocalScoreInput" type="number" min="0" max="750" value="${esc(getProfileValue(profile, "guangxiLocalScore"))}" placeholder="未填则按区外分数" />
    </label>
    <label id="beijingVocationalScoreField" ${showBeijingVocationalScore ? "" : "hidden"}>
      <span>专科语数外三科总分</span>
      <input id="vocationalScoreInput" type="number" min="0" max="450" value="${esc(getProfileValue(profile, "vocationalScore"))}" placeholder="北京专科线使用" />
    </label>
    <label>
      <span id="rankFieldLabel">${showGuangxiScopeFields ? "区外院校位次" : showXizangRankSource ? "官方个人查询位次" : "位次"}</span>
      <input id="rankInput" type="number" min="1" value="${esc(rankFieldValue)}" />
    </label>
    <label id="xizangRankSourceField" ${showXizangRankSource ? "" : "hidden"}>
      <span>西藏位次来源</span>
      <select id="xizangRankSourceInput">
        <option value="" ${isSelected("", getProfileValue(profile, "xizangRankSource"))}>未确认，不进入排序</option>
        <option value="${XIZANG_OFFICIAL_RANK_SOURCE}" ${isSelected(XIZANG_OFFICIAL_RANK_SOURCE, getProfileValue(profile, "xizangRankSource"))}>西藏官方个人查询</option>
      </select>
    </label>
    <label id="guangxiLocalRankField" ${showGuangxiScopeFields ? "" : "hidden"}>
      <span>区内院校位次</span>
      <input id="guangxiLocalRankInput" type="number" min="1" value="${esc(guangxiLocalRankFieldValue)}" />
    </label>
    <label>
      <span>省份</span>
      <input id="provinceInput" type="text" list="provinceList" value="${esc(getProfileValue(profile, "province"))}" placeholder="例如：广东、山东、河南" />
      <datalist id="provinceList">
        ${ALL_PROVINCES.map((item) => `<option value="${esc(item)}"></option>`).join("")}
      </datalist>
    </label>
    <label>
      <span>科类/选科</span>
      <select id="subjectInput">
        ${SUBJECT_TYPES.map((item) => `<option value="${esc(item)}" ${isSelected(item, getProfileValue(profile, "subject"))}>${esc(item)}</option>`).join("")}
      </select>
    </label>
    <fieldset class="wide elective-fieldset">
      <legend>再选科目</legend>
      <div class="elective-options">
        ${ELECTIVE_SUBJECTS.map((subject) => `<label><input class="elective-input" type="checkbox" value="${esc(subject)}" ${selectedElectiveSubjects(profile).includes(subject) ? "checked" : ""} />${esc(subject)}</label>`).join("")}
      </div>
    </fieldset>
    <label id="xizangCandidateCategoryField" ${showXizangCandidateCategory ? "" : "hidden"}>
      <span>西藏考生类别</span>
      <select id="candidateCategoryInput">
        <option value="" ${isSelected("", getProfileValue(profile, "candidateCategory"))}>未选择</option>
        <option value="A类考生" ${isSelected("A类考生", getProfileValue(profile, "candidateCategory"))}>A类：区内世居两代以上少数民族</option>
        <option value="B类考生" ${isSelected("B类考生", getProfileValue(profile, "candidateCategory"))}>B类：汉族及区外少数民族</option>
      </select>
    </label>
    <label class="wide">
      <span>成绩口径</span>
      <select id="rankUsageInput">${rankUsageOptions}</select>
    </label>
    <label>
      <span>专业门类偏好</span>
      <select id="disciplineFocus">${disciplineOptions}</select>
    </label>
    <label>
      <span>兴趣关键词</span>
      <input id="interestInput" type="text" value="${esc(getProfileValue(profile, "interest"))}" placeholder="计算机、心理学、师范、金融..." />
    </label>
    <label>
      <span>城市偏好</span>
      <input id="cityInput" type="text" value="${esc(getProfileValue(profile, "cities"))}" placeholder="上海 武汉 省内 港澳..." />
    </label>
    <label class="wide">
      <span>学科画像/单科分</span>
      <textarea id="abilityProfileInput" rows="3" placeholder="例如：语文120 英语124 数学102 物理77 化学82 生物88；表达强，数学中等，想做技术但不想纯理论。">${esc(getProfileValue(profile, "abilityProfile"))}</textarea>
    </label>
    <label>
      <span>预算敏感度</span>
      <select id="budgetInput">
        ${BUDGET_LEVELS.map((item) => `<option value="${esc(item)}" ${isSelected(item, getProfileValue(profile, "budget"))}>${esc(item)}</option>`).join("")}
      </select>
    </label>
    <label>
      <span>策略</span>
      <select id="strategyInput">
        ${STRATEGIES.map((item) => `<option value="${esc(item)}" ${isSelected(item, getProfileValue(profile, "strategy"))}>${esc(item)}</option>`).join("")}
      </select>
    </label>
    <label class="wide">
      <span>不可接受项/红线</span>
      <textarea id="redLineInput" rows="3" placeholder="例如：不接受高学费、不接受远离省内、不接受调剂到冷门专业">${esc(getProfileValue(profile, "redLines"))}</textarea>
    </label>
    <div class="form-actions">
      <button class="primary-action" type="submit" aria-controls="recommendResultRegion">生成推荐</button>
      <button class="ghost-action" id="resetRecommend" type="button">清除草稿并恢复示例</button>
    </div>
    <p id="recommendStatus" class="form-status" role="status" aria-live="polite"></p>
    <p id="recommendDraftStatus" class="draft-status" role="status" aria-live="polite">${esc(recommendationDraftStatusText())}</p>
    <p class="form-hint">表单草稿仅保存在本机浏览器；清除后不会影响已发布数据。</p>
  </form>`;
}

function renderRankEstimateNotice(profile) {
  if (!profile?.rankEstimateText) return "";
  const sourceLink = profile.rankEstimateUrl
    ? `<a href="${esc(profile.rankEstimateUrl)}" target="_blank" rel="noreferrer">${esc(profile.rankEstimateSource || "来源")}</a>`
    : `<span>${esc(profile.rankEstimateSource || "一分一段来源")}</span>`;
  return `<div class="rank-estimate-note">
    <strong>位次估算</strong>
    <p>${esc(profile.rankEstimateText)} ${sourceLink}；正式填报前必须回省考试院原表复核。</p>
  </div>`;
}

function renderDataFreshnessPanel(profile, today = currentChinaDate()) {
  const freshness = admissionDataFreshness(profile, today);
  const facts = [
    `招生计划最新：${freshness.latestPlanYear || "未接入"}`,
    `普通录取数据最新：${freshness.latestAdmissionYear || "未闭合"}`,
    `一分一段最新：${freshness.latestRankYear || "未接入"}`,
    freshness.latestVacancyYear ? `征集快照最新：${freshness.latestVacancyYear}` : "",
  ].filter(Boolean);
  const scheduleLink = freshness.scheduleSource?.url
    ? `<a href="${esc(freshness.scheduleSource.url)}" target="_blank" rel="noreferrer">查看考试院转载日程</a>`
    : "";
  return `<section class="band data-freshness-panel">
    <h3>${esc(freshness.province || profile.province || "本省")}数据进度</h3>
    <div class="coverage-row compact">${facts.map((fact) => `<span>${esc(fact)}</span>`).join("")}</div>
    ${freshness.scheduleStage ? `<p class="freshness-stage">${esc(freshness.scheduleStage.text)} ${scheduleLink}</p>` : ""}
    ${freshness.warnings.length ? `<details class="detail-drawer compact"><summary>填报前核对</summary><div class="check-grid">${freshness.warnings.map((warning) => `<span>${esc(warning)}</span>`).join("")}</div></details>` : ""}
  </section>`;
}

function recommendationExportText(recommendation) {
  const profile = recommendation?.profile || {};
  const results = Array.isArray(recommendation?.results) ? recommendation.results : [];
  const shortlist = normalizeShortlistItems(recommendation?.shortlist);
  const value = (input, fallback = "未填写") => {
    const text = String(input ?? "").trim();
    return text || fallback;
  };
  const generatedAt = recommendation?.generatedAt
    ? new Date(recommendation.generatedAt).toLocaleString("zh-CN")
    : "本次页面生成";
  const lines = [
    "全国高考志愿填报｜院校专业候选核验清单",
    `生成时间：${generatedAt}`,
    `省份：${value(profile.province)}`,
    `科类/选科：${value(profile.subject)}`,
    `分数：${value(profile.score)}；位次：${value(profile.rank)}`,
    `策略：${value(profile.strategy)}`,
    `结果分段：${value(recommendation?.band?.label)}`,
    "",
    "重要说明：以下内容是历史边界、专业适配和当前证据的核验线索，不等于录取概率，也不是正式志愿单。请逐项回省考试院和高校官网核对当年计划、选科、批次、收费和招生资格。",
    "",
  ];
  if (!results.length) {
    lines.push("当前没有可复制的推荐结果，请先生成推荐。");
    return lines.join("\n");
  }
  results.forEach((result, index) => {
    const examples = Array.isArray(result.examples) && result.examples.length
      ? result.examples.join(" / ")
      : "请展开页面查看院校建议";
    const warnings = Array.isArray(result.warnings) && result.warnings.length
      ? result.warnings.slice(0, 3).join("；")
      : "请展开页面查看理由与风险";
    lines.push(`${index + 1}. ${value(result.title, "未命名方向")}（${value(result.stance, "候选")}，置信度${value(result.confidence, "C")}）`);
    lines.push(`   代表院校：${examples}`);
    lines.push(`   当前提醒：${warnings}`);
  });
  lines.push("");
  lines.push(`我的核验清单（${shortlist.length}项）`);
  if (!shortlist.length) {
    lines.push("   尚未选择候选项，可在页面的院校专业候选清单中加入。");
  } else {
    shortlist.forEach((item, index) => {
      const name = [value(item.schoolName, "院校待核"), value(item.majorName, "专业待核")].join(" · ");
      const labels = [item.tierLabel, item.readinessLabel].filter(Boolean).join("；");
      lines.push(`${index + 1}. ${name}${labels ? `（${labels}）` : ""}`);
      if (item.sourceUrl) lines.push(`   来源：${item.sourceUrl}`);
    });
  }
  return lines.join("\n");
}

async function copyTextToClipboard(text) {
  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy selection-based copy path.
  }
  if (typeof document === "undefined" || typeof document.execCommand !== "function") return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

function renderEvidenceLinks(evidence, css = "") {
  const seen = new Set();
  const sources = [];
  for (const entry of evidence || []) {
    const source = entry?.source;
    if (!source) continue;
    const key = source.url || source.title || "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    sources.push(source);
    if (sources.length >= 5) break;
  }
  if (!sources.length) return "";
  const safeCss = css ? ` ${esc(css)}` : "";
  return `<div class="tag-row evidence-link-row">${sources.map((source) => {
    const title = esc(source.title || "证据来源");
    return source.url
      ? `<a class="tag source-tag${safeCss}" href="${esc(source.url)}" target="_blank" rel="noreferrer">${title}</a>`
      : `<span class="tag source-tag local-source-tag${safeCss}" title="仅本机索引，无公开链接">本地资料：${title}</span>`;
  }).join("")}</div>`;
}

function renderRecommendationShortlist() {
  const items = state.recommendationShortlist?.items || [];
  if (!items.length) return "";
  return `<section class="band recommendation-shortlist" id="recommendationShortlistPanel">
    <div class="shortlist-panel-head">
      <div>
        <h3>我的核验清单</h3>
        <p>先把愿意继续核对的院校专业集中在这里，再逐项确认当年计划、专业组、选科、收费和招生章程。</p>
      </div>
      <strong>${fmtNumber(items.length)} 项</strong>
    </div>
    <div class="shortlist-panel-list">
      ${items.map((item) => `
        <article class="shortlist-panel-row">
          <div>
            <strong>${esc(item.schoolName || "院校待核")} · ${esc(item.majorName || "专业待核")}</strong>
            ${renderTags([item.tierLabel, item.readinessLabel].filter(Boolean))}
            ${item.sourceUrl ? `<a class="shortlist-panel-source" href="${esc(item.sourceUrl)}" target="_blank" rel="noreferrer">${esc(item.sourceLabel || "证据来源")}</a>` : ""}
          </div>
          <button class="ghost-action shortlist-panel-remove" type="button" data-shortlist-remove-key="${esc(item.key)}">移出清单</button>
        </article>
      `).join("")}
    </div>
  </section>`;
}

function renderRecommendationResults() {
  const rec = state.recommendation;
  if (!rec) {
    return `<div class="empty-state">
      <h2>${state.recommendationInvalidated ? "输入已变化，请重新生成推荐" : "填写成绩后生成候选清单"}</h2>
    </div>`;
  }

  const policy = state.data.modelPolicy || {};
  const resultCards = rec.results.map((item, index) => {
    const evidenceLinks = renderEvidenceLinks(item.evidence, item.confidence === "A-" ? "" : "warn");
    const schools = item.schoolOptions.map((school) => `
      <div class="school-option">
        <div>
          <strong>${esc(school.name)}</strong>
          <p>${esc(school.focus)}</p>
          ${renderTags(school.tags)}
        </div>
        <span>${esc(school.role)}</span>
        <em>${esc(school.scoreStatus)}</em>
      </div>
    `).join("");
    return `<article class="recommend-card">
      <header>
        <div>
          <p class="rank-label">推荐 ${index + 1} · ${esc(item.stance)}</p>
          <h3>${esc(item.title)}</h3>
          <p>${esc(item.examples.join(" / "))}</p>
        </div>
        <div class="score-badge">
          <strong>${fmtNumber(item.total)}</strong>
          <span>${esc(item.confidence)}</span>
        </div>
      </header>
      <div class="score-line"><span style="width:${item.total}%"></span></div>
      <div class="score-grid">
        ${renderScorePart("硬匹配", item.parts.hardFit)}
        ${renderScorePart("录取分位次", item.parts.scoreRank)}
        ${renderScorePart("专业适配", item.parts.majorFit)}
        ${renderScorePart("城市预算", item.parts.cityBudget)}
        ${renderScorePart("证据", item.parts.evidence)}
        ${renderScorePart("风险扣分", item.parts.riskPenalty)}
      </div>
      <section>
        <h4>院校建议</h4>
        <div class="school-option-list">${schools}</div>
      </section>
      <details class="detail-drawer compact">
        <summary>理由与风险</summary>
        <h4>推荐理由</h4>
        <ul>${item.reasons.slice(0, 3).map((reason) => `<li>${esc(reason)}</li>`).join("")}</ul>
        <h4>风险和排除条件</h4>
        <ul>${item.warnings.slice(0, 3).map((warning) => `<li>${esc(warning)}</li>`).join("")}</ul>
        <p class="confidence-text">${esc(item.confidenceReason)}</p>
        ${evidenceLinks}
      </details>
    </article>`;
  }).join("");

  const vocationalQualification = ordinaryVocationalQualificationStatus(rec.profile);
  const belowVocationalLine = vocationalQualification.below;
  const limitedOnly = vocationalQualification.limitedOnly;
  const vocationalQualificationUnknown = vocationalQualification.unknown;
  const vocationalLinePending = vocationalQualification.pending;
  const vocationalLine = vocationalQualification.line;
  const vocationalLineComparison = vocationalQualification.comparison;
  const belowLinePanel = belowVocationalLine ? `<section class="band admission-hit-panel">
    <h3>普通批资格线以下，仅作路径调研</h3>
    <p>当前${esc(vocationalLineComparison.label)}${esc(String(vocationalLineComparison.score))}分低于${esc(String(vocationalLine.year))}年${esc(rec.profile.province || "本省")}${esc(rec.profile.subject || "普通类")}${esc(controlLineDisplayLabel(vocationalLine, "普通高职专科最低控制线"))}${esc(String(vocationalLine.score))}分${vocationalQualification.limitedLine ? `，且低于限定院校线${esc(String(vocationalQualification.limitedLine.score))}分` : ""}。本页不生成可执行院校专业清单，也不展示低于控制线的历史投档命中；仅保留高职单招、技能培养、复读再规划、专业认知和后续征集政策调研。</p>
  </section>` : "";
  const limitedQualificationPanel = limitedOnly ? `<section class="band admission-hit-panel">
    <h3>仅达到湖北限定院校线</h3>
    <p>当前${esc(vocationalQualification.limitedComparison.label)}${esc(String(vocationalQualification.limitedComparison.score))}分达到湖北2026年限定院校线${esc(String(vocationalQualification.limitedLine.score))}分，但低于普通高职高专通用线${esc(String(vocationalLine.score))}分。150分线只适用于湖北省独立学院和民办高校、湖北省办在武汉市以外的高职院校；下方只显示由2025年湖北省招办官方投档表可确认的本省历史专业组，2026年院校资格、招生计划和专业组必须逐校复核。</p>
  </section>` : "";
  const unknownQualificationPanel = vocationalQualificationUnknown ? `<section class="band admission-hit-panel">
    <h3>专科资格分数口径待补充</h3>
    <p>${esc(rec.profile.province || "本省")}${esc(controlLineDisplayLabel(vocationalLine, "普通高职专科最低控制线"))}${esc(String(vocationalLine.score))}分按${esc(vocationalLineComparison.label)}判断。当前高考总分仍用于位次估算，但不能替代这一资格分数；补充后再生成可执行院校专业清单。</p>
  </section>` : "";
  const pendingQualificationPanel = vocationalLinePending
    ? renderPendingOrdinaryVocationalPanel(rec.profile, vocationalQualification.pendingSource)
    : "";

  return `<section class="recommend-results">
    <div class="model-summary">
      <div>
        <h3>${esc(rec.band.label)}推荐结果</h3>
        <p>${esc(rec.band.strategy)}</p>
        ${renderRankEstimateNotice(rec.profile)}
      </div>
      <div class="model-pill">数据 ${esc(String(policy.version || "v1").match(/v\d+(?:\.\d+)*/)?.[0] || "v1")}</div>
    </div>
    <div class="recommendation-actions">
      <button class="ghost-action" id="copyRecommendation" type="button">复制核验清单</button>
      <span id="copyRecommendationStatus" class="copy-status" role="status" aria-live="polite"></span>
    </div>
    ${renderDataFreshnessPanel(rec.profile)}
    ${renderRecommendationShortlist()}
    ${belowVocationalLine ? belowLinePanel : limitedOnly ? limitedQualificationPanel : vocationalQualificationUnknown ? unknownQualificationPanel : vocationalLinePending ? pendingQualificationPanel : renderAdmissionHitPanel(rec.profile)}
    ${belowVocationalLine || vocationalQualificationUnknown || vocationalLinePending ? "" : renderApplicationPlan(rec.results)}
    <div class="grid-2">${resultCards}</div>
    <details class="detail-drawer">
      <summary>官方复核清单</summary>
      <div class="check-grid">${(policy.officialChecks || state.data.riskChecklist.map((item) => item.text)).map((item) => `<span>${esc(item)}</span>`).join("")}</div>
    </details>
  </section>`;
}

function renderAdmissionScoreLayer() {
  const layer = state.data.admissionScoreLayer || {};
  const evidenceTags = (layer.availableEvidenceIds || []).map((id) => sourceById(id)?.title).filter(Boolean).slice(0, 6);
  const coverage = layer.coverage || {};
  const rankCoverage = layer.rankCoverage || {};
  const rankSourceCoverage = layer.rankSourceCoverage || {};
  const sourceNotes = layer.sourceNotes || [];
  const dataTypes = coverage.dataTypes || {};
  const trendCoverage = coverage.majorTrendCoverage || {};
  const provinceReadiness = layer.provinceReadiness || coverage.provinceReadiness || {};
  const provinceReadinessRows = provinceReadiness.rows || [];
  const weakestProvinces = provinceReadiness.weakest || [];
  const schoolTags = coverage.schools || [];
  const visibleSchoolTags = schoolTags.slice(0, 24);
  const hiddenSchoolTagCount = Math.max(0, schoolTags.length - visibleSchoolTags.length);
  const scoreRange = coverage.scoreRange;
  const rankScoreRange = rankCoverage.scoreRange;
  const lowBands = coverage.lowBands || {};
  const filingProvinces = [...new Set((layer.records || [])
    .filter((record) => record.dataType === "institution-admission" && String(record.sourceQuality || "").includes("filing"))
    .map((record) => record.province)
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const vocationalProvinces = (coverage.provinceBreakdown || [])
    .filter((item) => item.dataTypes?.["vocational-admission"])
    .map((item) => item.province);
  const planProvinces = (coverage.provinceBreakdown || [])
    .filter((item) => item.dataTypes?.["admission-plan"])
    .map((item) => item.province);
  const sourceCount = sourceNotes.length;
  const tables = (layer.requiredTables || []).map((table) => `
    <article class="score-data-card">
      <h4>${esc(table.title)}</h4>
      <p>${esc(table.purpose)}</p>
      ${renderTags(table.requiredColumns.slice(0, 8), "warn")}
    </article>
  `).join("");
  return `<section class="admission-layer">
    <div>
      <h3>录取分数据层</h3>
      <p>${esc(layer.currentFinding || "正在检查本地录取分数据。")}</p>
      <strong>${esc(layer.statusLabel || "未接入结构化院校/专业录取分表")}</strong>
      <div class="coverage-row">
        <span>记录 ${fmtNumber(coverage.records || 0)}</span>
        <span>省份 ${(coverage.provinces || []).join("、") || "待导入"}</span>
        <span>年份 ${(coverage.years || []).join("、") || "待导入"}</span>
        <span>院校 ${fmtNumber((coverage.schools || []).length)}</span>
      </div>
      <div class="coverage-row compact">
        <span>专业录取 ${fmtNumber(dataTypes["major-admission"] || 0)}</span>
        <span>院校投档 ${fmtNumber(dataTypes["institution-admission"] || 0)}</span>
        <span>专业组 ${fmtNumber(dataTypes["major-group-admission"] || 0)}</span>
        <span>高职专科 ${fmtNumber(dataTypes["vocational-admission"] || 0)}</span>
        <span>招生计划 ${fmtNumber(dataTypes["admission-plan"] || layer.admissionPlanRecords || 0)}</span>
        <span>批次线 ${fmtNumber(dataTypes["control-line"] || 0)}</span>
        <span>一分一段 ${fmtNumber(layer.rankConversionRecords || rankCoverage.records || 0)}</span>
        ${layer.admissionPlanCount ? `<span>计划数 ${fmtNumber(layer.admissionPlanCount)}</span>` : ""}
        <span>位次来源页 ${fmtNumber(rankSourceCoverage.sources || 0)}</span>
        <span>来源页 ${fmtNumber(sourceCount)}</span>
        ${scoreRange ? `<span>分数带 ${fmtNumber(scoreRange.min)}-${fmtNumber(scoreRange.max)}</span>` : ""}
        <span>城市 ${fmtNumber((coverage.cities || []).length)}</span>
      </div>
      ${rankSourceCoverage.sources ? `<div class="coverage-row compact">
        <span>可计算位次页 ${fmtNumber(rankSourceCoverage.parsedSources || 0)}</span>
        <span>待解析位次页 ${fmtNumber(rankSourceCoverage.queuedSources || 0)}</span>
        <span>图片位次页 ${fmtNumber(rankSourceCoverage.imageQueuedSources || 0)}</span>
        <span>位次来源年份 ${(rankSourceCoverage.years || []).join("、") || "待导入"}</span>
        <span>可计算省份 ${(rankSourceCoverage.parsedProvinces || []).join("、") || "待导入"}</span>
      </div>` : ""}
      ${(rankSourceCoverage.queuedProvinces || []).length ? `<div class="coverage-row compact">
        <span>已采待解析省份</span>
        ${(rankSourceCoverage.queuedProvinces || []).map((province) => `<span>${esc(province)}</span>`).join("")}
      </div>` : ""}
      <div class="coverage-row compact">
        <span>双年可比专业 ${fmtNumber(trendCoverage.comparableMajorPairs || 0)}</span>
        <span>双年可比位次 ${fmtNumber(trendCoverage.comparableMajorPairsWithRank || 0)}</span>
        <span>热点双年专业 ${fmtNumber(trendCoverage.comparableHotMajorPairs || 0)}</span>
        <span>三年可比专业 ${fmtNumber(trendCoverage.comparableMajorSeries3y || 0)}</span>
        <span>三年可比位次 ${fmtNumber(trendCoverage.comparableMajorSeries3yWithRank || 0)}</span>
        <span>热点三年专业 ${fmtNumber(trendCoverage.comparableHotMajorSeries3y || 0)}</span>
        <span>四年可比专业 ${fmtNumber(trendCoverage.comparableMajorSeries4y || 0)}</span>
        <span>四年可比位次 ${fmtNumber(trendCoverage.comparableMajorSeries4yWithRank || 0)}</span>
        <span>最长趋势 ${fmtNumber(trendCoverage.longestMajorSeriesYears || 0)}年</span>
        <span>趋势省份 ${fmtNumber((trendCoverage.provinces || []).length)}</span>
      </div>
      ${provinceReadinessRows.length ? `<div class="coverage-row compact">
        <span>强证据省份 ${fmtNumber(provinceReadiness.strong || 0)}</span>
        <span>可用省份 ${fmtNumber(provinceReadiness.usable || 0)}</span>
        <span>种子省份 ${fmtNumber(provinceReadiness.seed || 0)}</span>
        <span>待加厚省份 ${fmtNumber(provinceReadiness.thin || 0)}</span>
        <span>可估位省份 ${fmtNumber(provinceReadiness.rankReady || 0)}</span>
        <span>专科可用省份 ${fmtNumber(provinceReadiness.vocationalReady || 0)}</span>
        <span>三年趋势省份 ${fmtNumber(provinceReadiness.trend3yReady || 0)}</span>
        <span>四年趋势省份 ${fmtNumber(provinceReadiness.trend4yReady || 0)}</span>
      </div>` : ""}
      ${weakestProvinces.length ? `<div class="coverage-row compact">
        <span>优先补数省份</span>
        ${weakestProvinces.map((row) => `<span>${esc(row.province)} ${fmtNumber(row.readinessScore)} ${esc(row.statusLabel)}</span>`).join("")}
      </div>` : ""}
      ${provinceReadinessRows.length ? `<div class="source-chip-list province-readiness-list">
        ${provinceReadinessRows.map((row) => `<span title="${esc((row.missing || []).join("；") || row.recommendationUse || "")}">${esc(row.province)} ${fmtNumber(row.readinessScore)} ${esc(row.statusLabel)} · 专业${fmtNumber(row.majorRecords || 0)} · 位次${fmtNumber(row.majorWithRank || 0)} · 计划${fmtNumber(row.planRecords || 0)} · 趋势${fmtNumber(row.trend3y || 0)}/${fmtNumber(row.trend4y || 0)}</span>`).join("")}
      </div>` : ""}
      <div class="coverage-row compact">
        <span>250分以下 ${fmtNumber(lowBands.below250 || 0)}</span>
        <span>300分以下 ${fmtNumber(lowBands.below300 || 0)}</span>
        <span>500分以下 ${fmtNumber(lowBands.below500 || 0)}</span>
        <span>本科投档省份 ${filingProvinces.join("、") || "待导入"}</span>
        <span>专科省份 ${vocationalProvinces.join("、") || "待导入"}</span>
        <span>计划省份 ${planProvinces.join("、") || "待导入"}</span>
      </div>
      ${(rankCoverage.provinces || []).length ? `<div class="coverage-row compact">
        <span>位次省份 ${(rankCoverage.provinces || []).join("、")}</span>
        <span>位次年份 ${(rankCoverage.years || []).join("、")}</span>
        <span>位次科类 ${(rankCoverage.subjects || []).join("、")}</span>
        ${rankScoreRange ? `<span>一分一段分数 ${fmtNumber(rankScoreRange.min)}-${fmtNumber(rankScoreRange.max)}</span>` : ""}
      </div>` : ""}
      ${(coverage.schoolTags || []).length ? `<div class="coverage-row compact">
        ${(coverage.schoolTags || []).slice(0, 10).map((tag) => `<span>${esc(tag)}</span>`).join("")}
      </div>` : ""}
      ${visibleSchoolTags.length ? `<div class="source-chip-list school-sample-list">
        ${visibleSchoolTags.map((name) => `<span>${esc(name)}</span>`).join("")}
        ${hiddenSchoolTagCount ? `<span>另有 ${fmtNumber(hiddenSchoolTagCount)} 所院校已入库，推荐时按省份加载</span>` : ""}
      </div>` : ""}
      ${renderTags(evidenceTags)}
    </div>
    <div class="grid-3">${tables}</div>
    ${sourceNotes.length ? `<div class="score-source-list">
      ${sourceNotes.slice(0, 12).map((source) => `<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.title)} · ${esc(source.quality)}</a>`).join("")}
      ${sourceNotes.length > 12 ? `<span>另有 ${fmtNumber(sourceNotes.length - 12)} 个来源已入库，详见 data/admissions/sources。</span>` : ""}
    </div>` : ""}
  </section>`;
}

function renderAdmissionScoreSummary() {
  const layer = state.data.admissionScoreLayer || {};
  const coverage = layer.coverage || {};
  const sourceNotes = layer.sourceNotes || [];
  const provinceCount = (coverage.provinces || []).length || Object.keys(layer.provinceReadiness?.rows || {}).length || 31;
  const latestYears = (coverage.years || []).slice().sort((a, b) => Number(b) - Number(a)).slice(0, 3);
  return `<section class="band compact-admission-layer">
    <div class="data-summary-head">
      <div><h3>录取数据</h3><strong>全国数据分省加载</strong></div>
      <span>${latestYears.join(" / ") || "持续更新"}</span>
    </div>
    <div class="metric-grid data-metrics">
      ${renderMetric("录取与计划记录", coverage.records || layer.structuredRecords || 0)}
      ${renderMetric("覆盖省份", provinceCount)}
      ${renderMetric("一分一段", layer.rankConversionRecords || layer.rankCoverage?.records || 0)}
      ${renderMetric("官方来源", sourceNotes.length)}
    </div>
    <details class="detail-drawer compact">
      <summary>数据口径</summary>
      <p>${esc(layer.currentFinding || "按考生省份加载录取、计划和位次数据。")}</p>
      ${layer.downgradeReason ? `<p>${esc(layer.downgradeReason)}</p>` : ""}
      ${sourceNotes.length ? `<div class="score-source-list">${sourceNotes.slice(0, 6).map((source) => `<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.title)}</a>`).join("")}</div>` : ""}
    </details>
  </section>`;
}

function refreshRecommendationResults() {
  const region = $("#recommendResultRegion");
  if (!region) return;
  region.innerHTML = renderRecommendationResults();
  bindRecommendationResultEvents();
}

function bindRecommendationResultEvents() {
  const copyButton = $("#copyRecommendation");
  const copyStatus = $("#copyRecommendationStatus");
  copyButton?.addEventListener("click", async () => {
    copyButton.disabled = true;
    copyButton.setAttribute("aria-busy", "true");
    if (copyStatus) copyStatus.textContent = "正在准备核验清单…";
    const copied = await copyTextToClipboard(recommendationExportText({
      ...state.recommendation,
      shortlist: state.recommendationShortlist?.items || [],
    }));
    if (copyStatus) copyStatus.textContent = copied
      ? "已复制，可发给家人讨论。"
      : "复制失败，请手动选择页面内容。";
    copyButton.disabled = false;
    copyButton.removeAttribute("aria-busy");
  });
  $$("[data-shortlist-key]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleRecommendationShortlist(button.dataset.shortlistKey || "");
      refreshRecommendationResults();
    });
  });
  $$("[data-shortlist-remove-key]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleRecommendationShortlist(button.dataset.shortlistRemoveKey || "");
      refreshRecommendationResults();
    });
  });
  $("#clearRecommendationShortlist")?.addEventListener("click", () => {
    const profile = state.recommendation?.profile;
    if (!profile) return;
    clearRecommendationShortlist(profile);
    state.recommendationShortlist = { profileKey: shortlistProfileKey(profile), items: [] };
    refreshRecommendationResults();
  });
}

function bindRecommendEvents() {
  const form = $("#recommendForm");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    const status = $("#recommendStatus");
    form.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute("aria-invalid"));
    const validationIssues = recommendationValidationIssues(profileFromForm());
    if (validationIssues.length) {
      validationIssues.forEach(({ fieldId }) => $(`#${fieldId}`)?.setAttribute("aria-invalid", "true"));
      if (status) status.textContent = validationIssues.map((issue) => issue.message).join("；");
      $(`#${validationIssues[0].fieldId}`)?.focus();
      return;
    }
    saveCurrentRecommendationDraft();
    const originalLabel = submit?.textContent || "生成推荐";
    form.setAttribute("aria-busy", "true");
    if (submit) {
      submit.disabled = true;
      submit.textContent = "载入数据…";
      submit.setAttribute("aria-busy", "true");
    }
    if (status) status.textContent = "正在载入本省数据，请稍候…";
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await runRecommendation();
    } catch (error) {
      if (status) status.textContent = `载入失败：${error.message || "请检查输入后重试。"}`;
    } finally {
      form.removeAttribute("aria-busy");
      if (submit) {
        submit.disabled = false;
        submit.textContent = originalLabel;
        submit.removeAttribute("aria-busy");
      }
    }
  });
  const provinceInput = $("#provinceInput");
  const beijingVocationalScoreField = $("#beijingVocationalScoreField");
  const xizangCandidateCategoryField = $("#xizangCandidateCategoryField");
  const xizangRankSourceField = $("#xizangRankSourceField");
  const xizangRankSourceInput = $("#xizangRankSourceInput");
  const guangxiLocalScoreField = $("#guangxiLocalScoreField");
  const guangxiLocalRankField = $("#guangxiLocalRankField");
  const scoreFieldLabel = $("#scoreFieldLabel");
  const rankFieldLabel = $("#rankFieldLabel");
  const updateProvinceFields = () => {
    const province = normalizeProvince(provinceInput?.value || "");
    if (beijingVocationalScoreField) {
      beijingVocationalScoreField.hidden = province !== "北京";
    }
    if (xizangCandidateCategoryField) {
      xizangCandidateCategoryField.hidden = province !== "西藏";
    }
    if (xizangRankSourceField) {
      xizangRankSourceField.hidden = province !== "西藏";
    }
    if (province !== "西藏" && xizangRankSourceInput) {
      xizangRankSourceInput.value = "";
    }
    const showGuangxi = province === "广西";
    if (guangxiLocalScoreField) guangxiLocalScoreField.hidden = !showGuangxi;
    if (guangxiLocalRankField) guangxiLocalRankField.hidden = !showGuangxi;
    if (scoreFieldLabel) scoreFieldLabel.textContent = showGuangxi ? "区外院校投档分" : "分数";
    if (rankFieldLabel) rankFieldLabel.textContent = showGuangxi
      ? "区外院校位次"
      : province === "西藏" ? "官方个人查询位次" : "位次";
  };
  provinceInput?.addEventListener("input", updateProvinceFields);
  const attestationBoundInputIds = new Set([
    "scoreInput",
    "rankInput",
    "provinceInput",
    "subjectInput",
    "candidateCategoryInput",
    "rankUsageInput",
  ]);
  const handleRecommendationInputChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
    if (
      attestationBoundInputIds.has(target.id)
      && normalizeProvince(provinceInput?.value || "") === "西藏"
      && xizangRankSourceInput
    ) {
      xizangRankSourceInput.value = "";
    }
    if (handleRecommendationInputChange.draftTimer) clearTimeout(handleRecommendationInputChange.draftTimer);
    handleRecommendationInputChange.draftTimer = setTimeout(() => {
      handleRecommendationInputChange.draftTimer = null;
      saveCurrentRecommendationDraft();
    }, 250);
    invalidateRecommendationResults();
  };
  form.addEventListener("input", handleRecommendationInputChange);
  form.addEventListener("change", handleRecommendationInputChange);
  updateProvinceFields();
  $("#resetRecommend").addEventListener("click", () => {
    clearRecommendationShortlist(recommendationDraftFromForm());
    clearSavedRecommendationProfile();
    state.recommendation = null;
    state.recommendationShortlist = { profileKey: "", items: [] };
    state.recommendationInvalidated = false;
    state.prefillProfile = null;
    renderRecommend();
  });
  bindRecommendationResultEvents();
}

function invalidateRecommendationResults() {
  if (!state.recommendation) return false;
  state.recommendation = null;
  state.recommendationInvalidated = true;
  const region = $("#recommendResultRegion");
  if (region) region.innerHTML = renderRecommendationResults();
  return true;
}

function renderAdmissionHitPanel(profile) {
  const records = dedupeAdmissionOptions(profileAdmissionRecords(profile)
    .map((record) => {
      const fit = admissionFit(record, profile);
      return { record, fit, score: fit.score + majorInterestScore(record, profile) };
    })
    .sort((a, b) => b.score - a.score))
    .slice(0, 5);
  if (!records.length) {
    return `<section class="band admission-hit-panel">
      <h3>${esc(profile.province || "本省")}数据待补</h3>
      <p>当前按全国院校专业资料排序，不使用虚构录取概率。</p>
    </section>`;
  }
  return `<section class="band admission-hit-panel">
    <h3>已命中的本省同科类录取数据</h3>
    <div class="admission-hit-list">
      ${records.map(({ record, fit }) => `
        <div class="admission-hit">
          <strong>${esc(record.schoolName)} · ${esc(record.majorName || record.majorGroup || "专业组")}</strong>
          <span>${esc(fit.zone)}</span>
          <p>${esc(fit.text)}${record.minScore ? `；最低分${record.minScore}` : ""}${record.rankRangeText ? `；位次${record.rankRangeText}` : ""}${admissionRouteTags(record).length ? `；招生路径${esc(admissionRouteTags(record).join(" / "))}` : ""}</p>
        </div>
      `).join("")}
    </div>
  </section>`;
}

function renderRecommend() {
  const policy = state.data.modelPolicy || {
    name: "院校专业排序规则",
    formula: "排序分 = 35%硬匹配 + 25%分数位次策略 + 20%专业适配 + 10%城市预算 + 10%证据充分度 - 红线风险扣分",
    reliabilityDefinition: "公开权重、来源证据、置信度标签、排除理由和官方复核清单。",
    weights: [],
    confidenceRules: [],
  };
  const sourceTags = (policy.sourceIds || []).map((id) => sourceById(id)?.title).filter(Boolean).slice(0, 5);
  const profile = state.recommendation?.profile || state.prefillProfile || DEFAULT_PROFILE;
  $("#view-recommend").innerHTML = `
    ${sectionHead("院校专业推荐")}
    ${renderAdmissionScoreSummary()}
    <section class="band">
      <h3>成绩与偏好</h3>
      ${renderRecommendForm(profile)}
    </section>
    <div id="recommendResultRegion">${renderRecommendationResults()}</div>
    <details class="detail-drawer">
      <summary>排序口径</summary>
      <p>${esc(policy.reliabilityDefinition)}</p>
      <p class="formula">${esc(policy.formula)}</p>
      <div class="weight-list">${(policy.weights || []).map((item) => `<div><strong>${esc(item.label)}</strong><span>${Math.round(item.weight * 100)}%</span></div>`).join("")}</div>
      <div class="check-grid">${(policy.confidenceRules || []).map((item) => `<span>${esc(item)}</span>`).join("")}</div>
      ${renderTags(sourceTags)}
    </details>
  `;
  bindRecommendEvents();
}

function renderRounds() {
  const rounds = state.data.rounds.map((round) => `
    <article class="round-card">
      <header>
        <div>
          <h3>Round ${round.id} ${esc(round.title)}</h3>
          <p>${esc(round.purpose)}</p>
        </div>
        <span class="tag">${fmtNumber(round.coverage.totalFilesSeen)} 文件全量过表</span>
      </header>
      <ul>
        ${round.integratedNotes.map((note) => `<li>${esc(note)}</li>`).join("")}
      </ul>
      <div class="tag-row">
        <span class="tag">命中 ${fmtNumber(round.coverage.matchedFilesForLens)}</span>
        <span class="tag">正文 ${fmtNumber(round.coverage.textExtractedFiles)}</span>
        <span class="tag warn">索引-only ${fmtNumber(round.coverage.indexedOnlyFiles)}</span>
      </div>
    </article>`).join("");

  $("#view-rounds").innerHTML = `
    ${sectionHead("整合记录", `${state.data.rounds.length} 轮`)}
    <div class="round-list">${rounds}</div>
  `;
}

function renderAudioQueue() {
  const query = state.query.trim().toLowerCase();
  const queue = state.data.audioQueue;
  const seriesCards = queue.series.map((series) => {
    const items = series.items.filter((item) => {
      const text = [item.title, item.relativePath, item.priority, item.reason, item.domains.join(" "), item.disciplines.join(" ")].join(" ").toLowerCase();
      return !query || text.includes(query);
    });
    if (!items.length) return "";
    const pendingCount = series.items.filter((item) => item.processingStatus !== "asr-transcribed").length;
    const priorityTags = Object.entries(series.priorities)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([priority, count]) => `${priority} ${count}`);
    return `<article class="round-card">
      <header>
        <div>
          <h3>${esc(series.series)}</h3>
          <p>${fmtNumber(series.files)} 个音频 · ${fmtBytes(series.bytes)}</p>
        </div>
        <span class="tag ${pendingCount ? "warn" : ""}">${pendingCount ? `待 ASR ${pendingCount}` : "ASR完成"}</span>
      </header>
      ${renderTags(priorityTags)}
      <div class="source-list">
        ${items.slice(0, 18).map((item) => `
          <div class="source-row">
            <div>
              <h4>${esc(item.title)}</h4>
              <p>${esc(item.relativePath)}</p>
              ${renderTags([item.priority, item.reason, ...item.domains, ...item.disciplines, item.duplicateGroupSize > 1 ? `重复组 ${item.duplicateGroupSize}` : ""].filter(Boolean).slice(0, 8), item.priority === "P0" ? "risk" : "")}
            </div>
            <span class="status ${item.processingStatus === "audio-indexed-needs-transcript" ? "gap" : ""}">${esc(statusLabel(item.processingStatus))}</span>
            <span class="status">${esc(item.ext)} · ${fmtBytes(item.bytes)}</span>
          </div>
        `).join("")}
      </div>
    </article>`;
  }).filter(Boolean).join("");

  $("#view-audio").innerHTML = `
    ${sectionHead("音频资料")}
    <div class="metric-grid">
      ${renderMetric("音频文件", queue.totalFiles)}
      ${renderMetric("ASR完整转写", state.data.extractionStats.asrTranscribedFiles)}
      ${renderMetric("ASR部分转写", state.data.extractionStats.asrPartialFiles)}
      ${renderMetric("音频待转写", state.data.extractionStats.needsAudioTranscriptFiles)}
      ${renderMetric("音频体量 GiB", (queue.totalBytes / 1024 / 1024 / 1024).toFixed(2))}
      ${renderMetric("重复标题组", queue.duplicateGroups)}
      ${Object.entries(queue.priorityCounts).map(([priority, count]) => renderMetric(priority, count)).join("")}
    </div>
    <div class="round-list">${seriesCards || document.querySelector("#emptyTemplate").innerHTML}</div>
  `;
}

function renderSources() {
  const sources = filteredSources();
  const geographyDirectory = renderGeographySourceDirectory(state.geographyData);
  if (!sources.length && !geographyDirectory) {
    $("#view-sources").innerHTML = document.querySelector("#emptyTemplate").innerHTML;
    return;
  }
  const rows = sources.map((source) => {
    const hasGap = source.processingStatus.includes("needs") || source.processingStatus.includes("error") || source.textLength === 0;
    const disciplineTags = source.disciplines.map((item) => `${item.code} ${item.name}`).slice(0, 3);
    const domainTags = source.domains.map((item) => item.label).slice(0, 3);
    return `<article class="source-row">
      <div>
        <h4>${esc(source.title)}</h4>
        <p>${esc(source.relativePath)}</p>
        ${source.excerpt ? `<p>${esc(source.excerpt.slice(0, 180))}</p>` : ""}
        ${renderTags([...disciplineTags, ...domainTags].slice(0, 6))}
      </div>
      <span class="status ${hasGap ? "gap" : ""}">${esc(statusLabel(source.processingStatus))}</span>
      <span class="status">${esc(source.kind)} · ${fmtBytes(source.bytes)}${source.ocrPages ? ` · OCR ${fmtNumber(source.ocrPages)}页` : ""}</span>
    </article>`;
  }).join("");

  $("#view-sources").innerHTML = `
    ${sources.length ? `${sectionHead("资料库", `${fmtNumber(sources.length)} 条`)}<div class="source-list">${rows}</div>` : ""}
    ${geographyDirectory}
  `;
  bindGeographySourceFilterEvents();
}

function renderView(view, { force = false } = {}) {
  const renderers = {
    overview: renderOverview,
    recommend: renderRecommend,
    disciplines: renderDisciplines,
    geography: renderGeography,
    rules: renderRules,
    sources: renderSources,
  };
  const renderer = renderers[view];
  if (!renderer || (!force && state.renderedViews.has(view))) return;
  renderer();
  state.renderedViews.add(view);
}

function render() {
  renderView(state.view, { force: true });
}

function syncNavigationState(nextView) {
  $$(".nav-btn").forEach((btn) => {
    const active = btn.dataset.view === nextView;
    btn.classList.toggle("active", active);
    if (active) {
      btn.setAttribute("aria-current", "page");
    } else {
      btn.removeAttribute("aria-current");
    }
  });
}

function updateView(nextView) {
  renderView(nextView);
  state.view = nextView;
  syncNavigationState(nextView);
  $$(".view").forEach((view) => view.classList.remove("active-view"));
  $(`#view-${nextView}`).classList.add("active-view");
}

function bindEvents() {
  $$(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => updateView(btn.dataset.view));
  });
  $("#searchInput").addEventListener("input", (event) => {
    state.query = event.target.value;
    syncClearFiltersControl();
    if (state.view === "sources") renderView("sources", { force: true });
    if (state.view === "disciplines") renderView("disciplines", { force: true });
    if (state.view === "geography") renderView("geography", { force: true });
  });
  $("#disciplineFilter").addEventListener("change", (event) => {
    state.discipline = event.target.value;
    if (state.discipline) state.disciplineBrowse = state.discipline;
    state.disciplineFamily = "";
    syncClearFiltersControl();
    if (state.view === "sources") renderView("sources", { force: true });
    if (state.view === "disciplines") renderView("disciplines", { force: true });
  });
  $("#domainFilter").addEventListener("change", (event) => {
    state.domain = event.target.value;
    syncClearFiltersControl();
    if (state.view === "sources") renderView("sources", { force: true });
    if (state.view === "disciplines") renderView("disciplines", { force: true });
  });
  $("#clearFilters").addEventListener("click", () => {
    clearSearchFilters();
    if (["sources", "disciplines", "geography"].includes(state.view)) {
      renderView(state.view, { force: true });
    }
  });
  syncClearFiltersControl();
}

function populateFilters() {
  const disciplineFilter = $("#disciplineFilter");
  for (const discipline of state.data.disciplines) {
    const option = document.createElement("option");
    option.value = discipline.code;
    option.textContent = `${discipline.code} ${discipline.name}`;
    disciplineFilter.appendChild(option);
  }

  const domainFilter = $("#domainFilter");
  for (const domain of state.data.domains) {
    const option = document.createElement("option");
    option.value = domain.id;
    option.textContent = domain.label;
    domainFilter.appendChild(option);
  }
}

async function boot() {
  const [core, manifest, geography] = await Promise.all([
    fetchRuntimeJson("knowledge-core-lite.json", "核心知识"),
    fetchRuntimeJson("provinces/manifest.json", "省份索引"),
    fetchGeographyKnowledge(),
  ]);
  state.data = core;
  state.provinceManifest = manifest;
  state.geographyData = geography;
  state.prefillProfile = loadSavedRecommendationProfile();
  $("#generatedAt").textContent = renderFreshnessLabel(state.data.generatedAt, state.geographyData?.version);
  populateFilters();
  bindEvents();
  render();
}

boot().catch((error) => {
  document.body.innerHTML = `<div class="empty-state"><h2>数据载入失败</h2><p>${esc(error.message)}</p></div>`;
});
