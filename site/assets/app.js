const state = {
  data: null,
  provinceManifest: null,
  loadedProvince: "",
  provinceShardCache: new Map(),
  view: "overview",
  query: "",
  discipline: "",
  disciplineBrowse: "08",
  disciplineFamily: "",
  domain: "",
  recommendation: null,
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
  const required = [...new Set(ELECTIVE_SUBJECTS.filter((subject) =>
    subject === "思想政治" ? /思想政治|政治/.test(requirement) : requirement.includes(subject)
  ))];
  if (!required.length) {
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
  return classifyScoreBand(profile.score, profile.rank, profile.province);
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
  return record?.planStage === "征集志愿" || record?.formalScoreScope === "vacancy-plan-only";
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

function recordMatchesCandidateCategory(record, profile) {
  const required = normalizeText(record?.candidateCategory);
  if (!required) return true;
  const selected = normalizeText(profile?.candidateCategory);
  return Boolean(selected) && (required.includes(selected) || selected.includes(required));
}

let profileAdmissionRecordsCache = { records: null, key: "", value: [] };
let profilePlanRecordsCache = { records: null, key: "", value: [] };

function profileRecordFilterKey(profile) {
  return [
    profile?.province,
    profile?.subject,
    profile?.candidateCategory,
    profile?.score,
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
    record.candidateCategory && !recordMatchesCandidateCategory(record, profile)
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
  if (!latestRankYear) {
    warnings.push(`${province}当前本地没有可计算的一分一段；未填写考试院正式位次时，系统不能给出位次安全边界。`);
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
    scheduleSource,
    scheduleStage,
    warnings,
  };
  admissionDataFreshnessCache = { records: allRecords, ranks: allRanks, key: cacheKey, value };
  return value;
}

let admissionTrendIndexCache = null;

function admissionTrendKey(record) {
  return [
    record.province || "",
    record.subjectType || "",
    record.batch || "",
    record.schoolName || "",
    record.majorName || "",
    record.majorGroup || "",
  ].join("|");
}

function admissionTrendIndex() {
  if (admissionTrendIndexCache) return admissionTrendIndexCache;
  admissionTrendIndexCache = new Map();
  for (const record of admissionRecords()) {
    if (record.dataType !== "major-admission" || !record.majorName) continue;
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

function trendForRecord(record) {
  if (record.dataType !== "major-admission" || !record.majorName) return null;
  const records = admissionTrendIndex().get(admissionTrendKey(record)) || [];
  const seriesByYear = new Map();
  for (const item of records) {
    if (item.year && !seriesByYear.has(item.year)) seriesByYear.set(item.year, item);
  }
  const series = [...seriesByYear.values()].sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
  if (series.length < 2) return null;
  const current = series.find((item) => item.id === record.id) || series[0];
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
      return {
        label: `${label}专业位次`,
        text: `${yearText}；${currentRankItem.year}较${previousRankItem.year}${direction}${gap ? `${fmtNumber(Math.abs(gap))}名` : ""}。${rangeText}`,
      };
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
      return {
        label: `${label}专业分`,
        text: `${yearText}；${currentScoreItem.year}较${previousScoreItem.year}${direction}${gap ? `${Math.abs(gap)}分` : ""}。${rangeText}`,
      };
    }
  }
  return {
    label: `${trendYearsLabel(series.length)}专业分`,
    text: `已命中同省同科类同校同专业${trendRecordLabel(series.length)}记录，仍需复核招生计划变化。`,
  };
}

function dedupeAdmissionOptions(options) {
  const map = new Map();
  for (const option of options) {
    const key = admissionTrendKey(option.record);
    const existing = map.get(key);
    if (
      !existing ||
      (Number(option.record.year) || 0) > (Number(existing.record.year) || 0) ||
      (option.record.minRankEnd && !existing.record.minRankEnd)
    ) {
      map.set(key, option);
    }
  }
  return [...map.values()];
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

function profileFromForm() {
  const rankUsageParts = ($("#rankUsageInput")?.value || "ordinary||").split("|");
  const profile = {
    childType: $("#childType").value,
    score: $("#scoreInput").value.trim(),
    guangxiLocalScore: $("#guangxiLocalScoreInput")?.value.trim() || "",
    vocationalScore: $("#vocationalScoreInput")?.value.trim() || "",
    rank: $("#rankInput").value.trim(),
    rankInput: $("#rankInput").value.trim(),
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
    "elite-platform": () => /985|211|双一流|C9/.test(schoolText),
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
    return Number(profile?.guangxiLocalRank) || Number(profile?.rank) || 0;
  }
  return Number(profile?.rank) || 0;
}

function profileScoreForAdmissionRecord(record, profile) {
  return profileScoreForInstitutionScope(profile, record?.rankInstitutionScope || "");
}

function admissionFit(record, profile, today = currentChinaDate()) {
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
    if (gap <= -5000) fit = { zone: "稳", score: 94, text: `位次比${scopedRankBoundaryLabel}靠前${fmtNumber(Math.abs(gap))}名` };
    else if (gap <= -1500) fit = { zone: "稳妥", score: 86, text: `位次比${scopedRankBoundaryLabel}靠前${fmtNumber(Math.abs(gap))}名` };
    else if (gap <= 600) fit = { zone: "临界稳", score: 76, text: `位次接近${scopedRankBoundaryLabel}，差距${fmtNumber(Math.abs(gap))}名以内` };
    else if (gap <= 3500) fit = { zone: "冲", score: 62, text: `位次落后${scopedRankBoundaryLabel}约${fmtNumber(gap)}名` };
    else fit = { zone: "高冲", score: 42, text: `位次落后${scopedRankBoundaryLabel}约${fmtNumber(gap)}名` };
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
      const optionScore = fit.score + majorInterestScore(record, profile) + admissionPreferenceScore(record, profile) + (trend ? 5 : 0);
      const tags = [
        record.city,
        ...(record.schoolTags || []),
        record.minScore ? `最低分${record.minScore}` : "",
        record.admittedCount ? `招生数${record.admittedCount}` : "",
        record.rankRangeText ? `位次${record.rankRangeText}` : "",
        rankScoreBasisLabel(record),
        trend?.label || "",
        record.majorGroup || "",
        record.electiveRequirement ? `选科${record.electiveRequirement}` : "",
        electiveRequirementForProfile(record, profile).state === "needs-check" ? "选科待核" : "",
      ].filter(Boolean);
      return {
        name: record.schoolName,
        tags,
        focus: `${record.majorName}：${fit.text}。${trend ? `${trend.text}` : ""}${admissionCautionText(record)}`,
        role: fit.zone,
        optionScore,
        admissionFit: fit,
        scoreStatus: isHubeiLimitedSchoolHistoricalAdmissionRecord(record)
          ? "湖北限定院校2025历史投档线：只作2026资格范围核验"
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
  const candidateAdmissionRecords = profileRecords
    .filter((record) => recordEligibleForCandidate(record, candidate, profile))
    .filter((record) => candidateMatchesAdmissionRecord(candidate, record, profile));
  const bestAdmission = belowVocationalLine || vocationalQualificationUnknown || vocationalLinePending ? null : candidateAdmissionRecords
    .map((record) => ({ record, fit: admissionFit(record, profile), interest: majorInterestScore(record, profile) }))
    .sort((a, b) => (b.fit.score + b.interest) - (a.fit.score + a.interest))[0];
  const limitedAdmission = bestAdmission && isLimitedAdmissionRecord(bestAdmission.record);
  const schoolOfficialAdmission = bestAdmission && isSchoolOfficialOnlyRecord(bestAdmission.record);
  const staleAdmission = bestAdmission && !bestAdmission.fit.recency?.fresh;
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
  if (!profile.rank) missingInputs.push("位次");
  if (vocationalQualificationUnknown) missingInputs.push("北京专科语数外三科总分");
  if (vocationalLinePending) missingInputs.push(`${profile.province || "本省"}2026年普通高职专科控制线`);

  const redLineText = normalizeText(redLines.join(" "));
  const redLineConflict = redLines.some((item) => candidateText.includes(normalizeText(item))) ||
    candidate.keywords.some((keyword) => redLineText.includes(normalizeText(keyword))) ||
    candidate.cities.some((city) => redLineText.includes(normalizeText(city)));

  let hardFit = 66;
  if (profile.province) hardFit += 8;
  if (profile.subject && profile.subject !== "不确定") hardFit += 8;
  if (profile.rank) hardFit += 8;
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
  if (bestAdmission && bestAdmission.fit.score < 62) {
    displayTotal = Math.min(displayTotal, 68);
  } else if (bestAdmission && bestAdmission.fit.score < 76) {
    displayTotal = Math.min(displayTotal, 76);
  }

  let confidence = "C";
  let confidenceReason = "探索性建议：需要补充更多输入或官方数据后再进入正式方案。";
  if (bestAdmission?.record?.minRankEnd && !limitedAdmission && !schoolOfficialAdmission && !staleAdmission && !missingInputs.length && evidence.length >= 4 && bestAdmission.fit.score >= 76 && total >= 76 && riskPenalty <= 12) {
    confidence = "A";
    confidenceReason = "输入完整且已接入结构化录取分，可进入院校/专业分数排序；最终仍需官方核验。";
  } else if (bestAdmission && !missingInputs.length && evidence.length >= 4 && bestAdmission.fit.score >= 62 && total >= 68 && riskPenalty <= 16) {
    confidence = "A-";
    confidenceReason = limitedAdmission
      ? "输入完整且命中官方投档位次，但来源是第2次志愿或 rank-only 口径，只能作为强候选核验。"
      : schoolOfficialAdmission
        ? isScoreDerivedRankRecord(bestAdmission.record)
          ? "输入完整且命中学校官网单校最低分及其一分一段换算位次；该位次不是学校录取最低位次，也不是省级全量投档表，最高只作为 A- 强候选核验。"
          : "输入完整且命中学校官网单校最低分/位次，但它不是省级全量投档表，最高只作为 A- 强候选核验。"
        : staleAdmission
          ? `输入完整且命中${bestAdmission.fit.recency.label}历史录取边界，已按年份降低排序权重，最高只作为 A- 强候选核验。`
        : "输入完整且有录取分数据支持，但目标专业仍需逐项核验。";
  } else if (evidence.length >= 4 && total >= 62) {
    confidence = "B";
    confidenceReason = scoreStatus.available
      ? "本地证据可用，但存在关键输入缺口或风险项，适合作为候选继续核验。"
      : "缺少结构化院校/专业录取分，当前只能作为候选核验清单，不能判断录取概率。";
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
        ? `命中结构化录取数据：${bestAdmission.record.schoolName}${bestAdmission.record.majorName ? `-${bestAdmission.record.majorName}` : ""}，${bestAdmission.fit.zone}。`
        : "本方向暂未命中当前省份/科类的结构化录取记录，仍需导入更多院校/专业分。"
      : "尚未接入结构化院校/专业录取分，分数可达性必须人工查表核验。",
    cityPrefs.length && candidate.cities.some((city) => hasTextHit(city, cityPrefs))
      ? `匹配城市偏好：${candidate.cities.filter((city) => hasTextHit(city, cityPrefs)).join("、")}。`
      : "城市偏好没有强命中，排序主要来自专业/平台/证据。",
  ].filter(Boolean);

  const warnings = [
    ...(belowVocationalLine ? [`当前${vocationalLineComparison.label}低于${vocationalLine.year}年${lowerLineLabel}${vocationalLine.score}分${belowAllLineText}；下列院校和专业只能作为路径调研，不得视为普通批可录取名单。`] : []),
    ...(limitedOnly ? [`当前分数低于湖北2026普通高职高专通用线${vocationalLine.score}分；150分线仅适用于湖北省独立学院和民办高校、湖北省办在武汉市以外的高职院校，必须逐校核对2026招生计划。`] : []),
    ...(vocationalQualificationUnknown ? [`${profile.province || "本省"}普通专科线按${vocationalLineComparison.label}判断；请补充该分数后再生成可执行院校专业清单。`] : []),
    ...(vocationalLinePending ? [`${profile.province || "本省"}2026年普通高职专科控制线尚待官方发布；当前结果只作路径调研，发布后必须重新计算资格边界。`] : []),
    ...(profile.rankEstimateText ? [`${profile.rankEstimateText}正式填报前必须回省考试院原表复核。`] : []),
    ...freshness.warnings,
    ...(vocationalMode && !["vocational-dual", "regional-safe"].includes(candidate.id) ? ["当前分数段不宜只按本科平台逻辑排序，应同步核验高职专科和专升本路径。"] : []),
    ...(!scoreStatus.available ? [scoreStatus.reason] : []),
    ...(scoreStatus.available && !profileRecords.length ? [`当前本地还没有导入${profile.province || "该省"}${profile.subject || ""}结构化录取记录，结果降级为全国候选。`] : []),
    ...(scoreStatus.available && profileRecords.length && !candidateAdmissionRecords.length ? ["当前方向没有命中已导入的本省同科类分数记录，建议继续补充该方向院校数据。"] : []),
    ...(bestAdmission && bestAdmission.fit.score < 62 ? ["当前最佳命中仍属于高冲区间，不能作为稳妥志愿使用。"] : []),
    ...(staleAdmission ? [bestAdmission.fit.recency.text] : []),
    ...(limitedAdmission ? [admissionRecordLimitWarning(bestAdmission.record)] : []),
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
  { id: "priority", label: "优先核验", note: "录取边界相对有利，仍须逐项核验当年计划、专业组与调剂范围。" },
  { id: "steady", label: "稳妥候选", note: "与近年边界接近或有一定余量，适合与优先核验项搭配。" },
  { id: "reach", label: "冲刺候选", note: "当前边界偏紧，只作为孩子愿意承担风险的上探项。" },
  { id: "plan", label: "计划与资格核验", note: "这是招生计划或历史征集线索，不是录取概率。" },
];

function applicationPlanTier(option) {
  if (!option?.record) return null;
  if (isPlanRecord(option.record)) return "plan";
  if (isHubeiLimitedSchoolHistoricalAdmissionRecord(option.record)) return "plan";
  const fitScore = Number(option.admissionFit?.score) || 0;
  if (fitScore >= 82) return "priority";
  if (fitScore >= 68) return "steady";
  return "reach";
}

function applicationPlanKey(option) {
  const record = option.record || {};
  return record.id || [
    record.schoolName || option.name,
    record.majorName || record.majorGroup || "未区分专业",
    record.province,
    record.subjectType,
    record.dataType,
  ].join("|");
}

function applicationPlanOptionScore(option, result, tierIndex) {
  const recencyScore = option.admissionFit?.recency?.fresh ? 8 : 0;
  return (APPLICATION_PLAN_TIERS.length - tierIndex) * 1000 +
    (Number(option.optionScore) || 0) * 2 +
    (Number(result.total) || 0) +
    recencyScore;
}

function buildApplicationPlan(results) {
  const selected = new Map();
  for (const result of results || []) {
    for (const option of result.schoolOptions || []) {
      const tier = applicationPlanTier(option);
      if (!tier) continue;
      const tierIndex = APPLICATION_PLAN_TIERS.findIndex((item) => item.id === tier);
      const key = applicationPlanKey(option);
      const previous = selected.get(key);
      const entry = {
        ...option,
        tier,
        tierIndex,
        matchingPools: [result.title],
        candidateScore: applicationPlanOptionScore(option, result, tierIndex),
      };
      if (!previous) {
        selected.set(key, entry);
        continue;
      }
      previous.matchingPools = [...new Set([...previous.matchingPools, result.title])];
      if (entry.candidateScore > previous.candidateScore) {
        entry.matchingPools = previous.matchingPools;
        selected.set(key, entry);
      }
    }
  }

  return APPLICATION_PLAN_TIERS.map((tier) => ({
    ...tier,
    options: [...selected.values()]
      .filter((option) => option.tier === tier.id)
      .sort((left, right) => right.candidateScore - left.candidateScore)
      .slice(0, tier.id === "plan" ? 3 : 5),
  })).filter((tier) => tier.options.length);
}

function applicationPlanDetail(option) {
  const record = option.record || {};
  const fit = option.admissionFit;
  const major = record.majorName || record.majorGroup || "专业方向待核验";
  const sourceLabel = isPlanRecord(record)
    ? "官方计划来源"
    : isHubeiLimitedSchoolHistoricalAdmissionRecord(record)
      ? "湖北限定院校历史投档来源"
      : isSchoolOfficialOnlyRecord(record)
        ? "学校官网录取来源"
        : "官方投档/录取来源";
  const sourceLimit = isPlanRecord(record)
    ? isVacancyPlanRecord(record)
      ? "历史征集剩余计划，只作补录信号。"
      : "官方招生计划，只说明可报专业池。"
    : admissionRecordLimitWarning(record);
  const fitText = fit?.text || option.focus || "需复核招生章程与当年计划。";
  return {
    major,
    text: `${fitText}${sourceLimit || ""}`,
    tags: [
      record.city,
      record.year ? `${record.year}年` : "",
      record.minScore ? `最低分${record.minScore}` : "",
      record.rankRangeText ? `位次${record.rankRangeText}` : "",
      rankScoreBasisLabel(record),
      fit?.recency?.label || "",
      record.electiveRequirement ? `选科${record.electiveRequirement}` : "",
      electiveRequirementForProfile(record, state.recommendation?.profile || {}).state === "needs-check" ? "选科待核" : "",
      ...(option.matchingPools.length > 1 ? [`命中${option.matchingPools.length}个方向`] : []),
    ].filter(Boolean),
    sourceUrl: record.sourceUrl || "",
    sourceLabel,
  };
}

function renderApplicationPlan(results) {
  const tiers = buildApplicationPlan(results);
  if (!tiers.length) return "";
  const planOptions = tiers.flatMap((tier) => tier.options);
  const limitedSchoolOnly = ordinaryVocationalQualificationStatus(state.recommendation?.profile || {}).limitedOnly &&
    planOptions.length > 0 && planOptions.every((option) => isHubeiLimitedSchoolHistoricalAdmissionRecord(option.record));
  const planTitle = limitedSchoolOnly ? "限定院校资格核验清单" : "可执行院校专业清单";
  const planDescription = limitedSchoolOnly
    ? "只汇总湖北2025官方投档表中可确认的本省低分专业组，用于核验2026限定院校范围；不是今年可录取名单。"
    : "只汇总已命中的本省同科类结构化记录；同一院校专业会合并，计划类数据单独展示。";
  return `<section class="band application-plan">
    <div class="application-plan-head">
      <div>
        <h3>${esc(planTitle)}</h3>
        <p>${esc(planDescription)}</p>
      </div>
      <span>${fmtNumber(tiers.reduce((total, tier) => total + tier.options.length, 0))} 项</span>
    </div>
    <div class="application-plan-grid">
      ${tiers.map((tier) => `<section class="application-plan-group">
        <header><h4>${esc(tier.label)}</h4><span>${fmtNumber(tier.options.length)} 项</span></header>
        <p>${esc(tier.note)}</p>
        <div class="application-plan-list">
          ${tier.options.map((option) => {
            const detail = applicationPlanDetail(option);
            return `<div class="application-plan-row">
              <div>
                <strong>${esc(option.name)} · ${esc(detail.major)}</strong>
                <p>${esc(detail.text)}</p>
                ${renderTags(detail.tags)}
                ${detail.sourceUrl ? `<a class="application-plan-source" href="${esc(detail.sourceUrl)}" target="_blank" rel="noreferrer">${esc(detail.sourceLabel)}</a>` : ""}
              </div>
              <span>${esc(option.role || tier.label)}</span>
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
  return `<form id="recommendForm" class="recommend-form">
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
      <span id="rankFieldLabel">${showGuangxiScopeFields ? "区外院校位次" : "位次"}</span>
      <input id="rankInput" type="number" min="1" value="${esc(rankFieldValue)}" />
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
    <label>
      <span>西藏考生类别</span>
      <select id="candidateCategoryInput">
        <option value="" ${isSelected("", getProfileValue(profile, "candidateCategory"))}>未选择</option>
        <option value="A类考生" ${isSelected("A类考生", getProfileValue(profile, "candidateCategory"))}>A类考生</option>
        <option value="B类考生" ${isSelected("B类考生", getProfileValue(profile, "candidateCategory"))}>B类考生</option>
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
      <button class="primary-action" type="submit">生成推荐</button>
      <button class="ghost-action" id="resetRecommend" type="button">恢复示例</button>
    </div>
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

function renderDataFreshnessPanel(profile) {
  const freshness = admissionDataFreshness(profile);
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

function renderRecommendationResults() {
  const rec = state.recommendation;
  if (!rec) {
    return `<div class="empty-state">
      <h2>填写成绩后生成候选清单</h2>
    </div>`;
  }

  const policy = state.data.modelPolicy || {};
  const resultCards = rec.results.map((item, index) => {
    const evidenceTags = item.evidence.map((entry) => entry.source.title).slice(0, 5);
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
        ${renderTags(evidenceTags, item.confidence === "A-" ? "" : "warn")}
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
    ${renderDataFreshnessPanel(rec.profile)}
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

function bindRecommendEvents() {
  const form = $("#recommendForm");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    const originalLabel = submit?.textContent || "生成推荐";
    if (submit) {
      submit.disabled = true;
      submit.textContent = "载入数据…";
    }
    try {
      await runRecommendation();
    } catch (error) {
      window.alert(error.message || String(error));
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = originalLabel;
      }
    }
  });
  const provinceInput = $("#provinceInput");
  const beijingVocationalScoreField = $("#beijingVocationalScoreField");
  const guangxiLocalScoreField = $("#guangxiLocalScoreField");
  const guangxiLocalRankField = $("#guangxiLocalRankField");
  const scoreFieldLabel = $("#scoreFieldLabel");
  const rankFieldLabel = $("#rankFieldLabel");
  const updateProvinceFields = () => {
    const province = normalizeProvince(provinceInput?.value || "");
    if (beijingVocationalScoreField) {
      beijingVocationalScoreField.hidden = province !== "北京";
    }
    const showGuangxi = province === "广西";
    if (guangxiLocalScoreField) guangxiLocalScoreField.hidden = !showGuangxi;
    if (guangxiLocalRankField) guangxiLocalRankField.hidden = !showGuangxi;
    if (scoreFieldLabel) scoreFieldLabel.textContent = showGuangxi ? "区外院校投档分" : "分数";
    if (rankFieldLabel) rankFieldLabel.textContent = showGuangxi ? "区外院校位次" : "位次";
  };
  provinceInput?.addEventListener("input", updateProvinceFields);
  updateProvinceFields();
  $("#resetRecommend").addEventListener("click", () => {
    state.recommendation = null;
    state.prefillProfile = null;
    renderRecommend();
  });
}

function renderAdmissionHitPanel(profile) {
  const records = profileAdmissionRecords(profile)
    .map((record) => {
      const fit = admissionFit(record, profile);
      return { record, fit, score: fit.score + majorInterestScore(record, profile) };
    })
    .sort((a, b) => b.score - a.score)
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
          <p>${esc(fit.text)}${record.minScore ? `；最低分${record.minScore}` : ""}${record.rankRangeText ? `；位次${record.rankRangeText}` : ""}</p>
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
    ${renderRecommendationResults()}
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
  if (!sources.length) {
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
    ${sectionHead("资料库", `${fmtNumber(sources.length)} 条`)}
    <div class="source-list">${rows}</div>
  `;
}

function renderView(view, { force = false } = {}) {
  const renderers = {
    overview: renderOverview,
    recommend: renderRecommend,
    disciplines: renderDisciplines,
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

function updateView(nextView) {
  renderView(nextView);
  state.view = nextView;
  $$(".nav-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === nextView));
  $$(".view").forEach((view) => view.classList.remove("active-view"));
  $(`#view-${nextView}`).classList.add("active-view");
}

function bindEvents() {
  $$(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => updateView(btn.dataset.view));
  });
  $("#searchInput").addEventListener("input", (event) => {
    state.query = event.target.value;
    if (state.view === "sources") renderView("sources", { force: true });
    if (state.view === "disciplines") renderView("disciplines", { force: true });
  });
  $("#disciplineFilter").addEventListener("change", (event) => {
    state.discipline = event.target.value;
    if (state.discipline) state.disciplineBrowse = state.discipline;
    state.disciplineFamily = "";
    if (state.view === "sources") renderView("sources", { force: true });
    if (state.view === "disciplines") renderView("disciplines", { force: true });
  });
  $("#domainFilter").addEventListener("change", (event) => {
    state.domain = event.target.value;
    if (state.view === "sources") renderView("sources", { force: true });
    if (state.view === "disciplines") renderView("disciplines", { force: true });
  });
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
  const [core, manifest] = await Promise.all([
    fetchRuntimeJson("knowledge-core-lite.json", "核心知识"),
    fetchRuntimeJson("provinces/manifest.json", "省份索引"),
  ]);
  state.data = core;
  state.provinceManifest = manifest;
  $("#generatedAt").textContent = `更新于 ${new Date(state.data.generatedAt).toLocaleString("zh-CN")}`;
  populateFilters();
  bindEvents();
  render();
}

boot().catch((error) => {
  document.body.innerHTML = `<div class="empty-state"><h2>数据载入失败</h2><p>${esc(error.message)}</p></div>`;
});
