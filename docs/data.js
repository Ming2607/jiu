/** 商品数据 — 价格可按实际调整 */
const CATEGORIES = [
  {
    id: 'daxueshi',
    name: '江南大学士',
    nameLines: ['江南', '大学士'],
    subtitle: '典藏系列',
  },
  {
    id: 'zhishanyun',
    name: '至善韵',
    subtitle: '匠心佳酿',
  },
  {
    id: 'zhongqiu',
    name: '中秋佳品',
    subtitle: '时令臻选',
  },
];

const PRODUCTS = [
  {
    id: 'dxs-01',
    categoryId: 'daxueshi',
    name: '江南大学士 · 典藏',
    desc: '52° 浓香型，礼盒装 500ml',
    detail:
      '典藏款，52°浓香型白酒，500ml 礼盒装。甄选优质高粱、小麦为原料，传承经典酿造工艺，酒体醇厚、绵甜爽净，余味悠长。包装采用典藏级礼盒设计，是宴请、礼赠的上佳之选。',
    image: 'images/dxs-01.jpg',
    pricing: {
      type: 'dual',
      bottle: { label: '单瓶', price: 168, unit: '瓶' },
      case: { label: '成箱', price: 888, unit: '箱', note: '6瓶/箱' },
    },
  },
  {
    id: 'dxs-02',
    categoryId: 'daxueshi',
    name: '江南大学士 · 经典',
    desc: '52° 浓香型，经典款 500ml',
    detail:
      '经典款，52°浓香型，500ml 标准装。口感醇和、入口绵柔，适合日常品鉴与聚会畅饮。藏青配色包装，大气稳重，体现江南文化气韵。',
    image: 'images/dxs-02.jpg',
    pricing: {
      type: 'dual',
      bottle: { label: '单瓶', price: 128, unit: '瓶' },
      case: { label: '成箱', price: 688, unit: '箱', note: '6瓶/箱' },
    },
  },
  {
    id: 'dxs-03',
    categoryId: 'daxueshi',
    name: '江南大学士 · 臻品',
    desc: '42° 浓香型，臻品款 500ml',
    detail:
      '臻品款，42°浓香型，500ml。低度化设计，更易入口，适合偏好柔和口感的消费者。精致礼盒包装，品质上乘，彰显品位。',
    image: 'images/dxs-03.jpg',
    pricing: {
      type: 'dual',
      bottle: { label: '单瓶', price: 198, unit: '瓶' },
      case: { label: '成箱', price: 1088, unit: '箱', note: '6瓶/箱' },
    },
  },
  {
    id: 'dxs-04',
    categoryId: 'daxueshi',
    name: '江南大学士 · 礼赠',
    desc: '52° 浓香型，节日礼赠装 500ml',
    detail:
      '礼赠款，52°浓香型，专为节日送礼打造。金红礼盒喜庆大气，附精美手提礼袋，是中秋、春节、宴席等场合的理想伴手礼。',
    image: 'images/dxs-04.jpg',
    pricing: {
      type: 'dual',
      bottle: { label: '单瓶', price: 158, unit: '瓶' },
      case: { label: '成箱', price: 828, unit: '箱', note: '6瓶/箱' },
    },
  },
  {
    id: 'zsy-01',
    categoryId: 'zhishanyun',
    name: '至善韵 · 陈年佳酿',
    desc: '53° 酱香型，匠心监制 500ml',
    detail:
      '至善韵陈年佳酿，53°酱香型，500ml。由资深酿酒师团队监制，采用一二九八七坤沙工艺，以高粱、小麦、水为原料，酱香突出、幽雅细腻。手工酿造，限量发行，极具收藏价值。',
    image: 'images/zsy-01.jpg',
    pricing: {
      type: 'single',
      price: 680,
      unit: '瓶',
    },
  },
  {
    id: 'zq-01',
    categoryId: 'zhongqiu',
    name: '无锡老字号 · 花雕熟醉蟹',
    desc: '传统花雕工艺，冷链配送，4只/盒',
    detail:
      '太湖明珠花雕熟醉蟹，选用优质大闸蟹，以传统花雕工艺熟醉而成，4只/盒。18道工序匠心标准化制作，蟹黄饱满、酒香馥郁。冷链配送，保证新鲜，是无锡地方特产与中秋时令的佳品。',
    image: 'images/zq-01.jpg',
    pricing: {
      type: 'single',
      price: 198,
      unit: '盒',
    },
  },
];
