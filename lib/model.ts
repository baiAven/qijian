import githubCompanies from '../data/github-companies.json';
export type Board = 'red' | 'black' | 'pending' | 'conflict';
export type GithubSource = {
  repository: string;
  list: string;
  kind: string;
  city: string;
  recordDate: string;
  updatedAt: string;
  importedAt: string;
  url: string;
  revision: string;
  scheduleTags: string[];
};
export const sourceLabels: Record<string, string> = {
  '955': '955.WLB 白名单',
  white: '996.ICU 白名单',
  black: '996.ICU 黑名单',
};
export type Company = {
  id: string;
  name: string;
  city: string;
  industry: string;
  intro: string;
  github?: GithubSource[];
  demo?: boolean;
};
export type Evidence = {
  id: string;
  source: string;
  date: string;
  note: string;
  author: string;
  demo?: boolean;
};
export type Report = Evidence & {
  companyId: string;
  scope: string;
  daysOff: number;
  hours: number;
  overtime: 'none' | 'sometimes' | 'often';
  shifts: 'day' | 'two' | 'other';
};
export type Product = Evidence & {
  name: string;
  companyId: string;
  category: string;
};
export type Supply = Evidence & {
  productId: string;
  supplierId: string;
  component: string;
};
export type Data = {
  companies: Company[];
  reports: Report[];
  products: Product[];
  supplies: Supply[];
};
export const boardNames: Record<Board, string> = {
  red: '红榜',
  black: '黑榜',
  pending: '待补充',
  conflict: '记录有分歧',
};
export function classify(r: Report): Board {
  if (r.daysOff >= 2 && r.overtime === 'none') return 'red';
  if (r.daysOff < 2 && r.hours >= 12 && r.shifts === 'two') return 'black';
  return 'pending';
}
export function companyBoard(id: string, data: Data): Board {
  const categories = new Set(
    data.reports.filter((r) => r.companyId === id).map(classify),
  );
  if (categories.size > 1) return 'conflict';
  return [...categories][0] || 'pending';
}
export function relatedProducts(id: string, d: Data) {
  const supplyIds = new Set(
    d.supplies.filter((s) => s.supplierId === id).map((s) => s.productId),
  );
  return d.products.filter((p) => p.companyId === id || supplyIds.has(p.id));
}
export function matches(c: Company, q: string, d: Data): boolean {
  const products = relatedProducts(c.id, d);
  const suppliers = d.supplies.filter((s) =>
    products.some((p) => p.id === s.productId),
  );
  const text = [
    c.name,
    c.city,
    c.industry,
    ...(c.github || []).flatMap((s) => [
      sourceLabels[s.list],
      s.city,
      ...s.scheduleTags,
    ]),
    ...products.map((p) => p.name + ' ' + p.category),
    ...suppliers.map(
      (s) =>
        s.component +
        ' ' +
        (d.companies.find((c) => c.id === s.supplierId)?.name || ''),
    ),
  ]
    .join(' ')
    .toLocaleLowerCase();
  return q
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .every((term) => text.includes(term));
}
export function safeUrl(value: string) {
  try {
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
}
const base = {
  date: '2026-09-01',
  source: '',
  note: '虚构示例，仅用于体验产品功能，不对应真实企业。',
  author: '演示资料',
  demo: true,
};
export const seed: Data = {
  companies: [
    {
      id: 'demo-c1',
      name: '示例 · 星屿科技',
      city: '上海',
      industry: '消费电子',
      intro: '智能办公设备与桌面配件',
      demo: true,
    },
    {
      id: 'demo-c2',
      name: '示例 · 白昼生活',
      city: '杭州',
      industry: '生活用品',
      intro: '日常家居与可重复使用的生活用品',
      demo: true,
    },
    {
      id: 'demo-c3',
      name: '示例 · 远山材料',
      city: '苏州',
      industry: '材料制造',
      intro: '再生材料与低碳包装解决方案',
      demo: true,
    },
    {
      id: 'demo-c4',
      name: '示例 · 砾石精密',
      city: '东莞',
      industry: '零件制造',
      intro: '消费电子外壳与精密结构件',
      demo: true,
    },
    {
      id: 'demo-c5',
      name: '示例 · 长川电源',
      city: '深圳',
      industry: '消费电子',
      intro: '电源模块与充电设备制造',
      demo: true,
    },
    {
      id: 'demo-c6',
      name: '示例 · 灰港包装',
      city: '宁波',
      industry: '包装印刷',
      intro: '纸制包装与印刷加工',
      demo: true,
    },
    {
      id: 'demo-c7',
      name: '示例 · 青禾织造',
      city: '嘉兴',
      industry: '纺织制造',
      intro: '家用纺织面料与成品制造',
      demo: true,
    },
  ],
  reports: Array.from(
    { length: 6 },
    (_, i) =>
      ({
        ...base,
        id: `demo-r${i + 1}`,
        companyId: `demo-c${i + 1}`,
        scope: i < 3 ? '总部 · 产品与设计部' : '生产基地 · 一线装配',
        daysOff: i < 3 ? 2 : 1,
        hours: i < 3 ? 8 : 12,
        overtime: i < 3 ? 'none' : 'often',
        shifts: i < 3 ? 'day' : 'two',
      }) as Report,
  ),
  products: [
    {
      ...base,
      id: 'demo-p1',
      name: 'Flow 无线键盘',
      companyId: 'demo-c1',
      category: '办公数码',
    },
    {
      ...base,
      id: 'demo-p2',
      name: 'Orbit 桌面充电站',
      companyId: 'demo-c1',
      category: '办公数码',
    },
    {
      ...base,
      id: 'demo-p3',
      name: 'Loop 随行杯',
      companyId: 'demo-c2',
      category: '日用家居',
    },
    {
      ...base,
      id: 'demo-p4',
      name: 'Cloud 棉织毛巾',
      companyId: 'demo-c2',
      category: '日用家居',
    },
    {
      ...base,
      id: 'demo-p5',
      name: 'Eco 再生包装纸',
      companyId: 'demo-c3',
      category: '包装材料',
    },
  ],
  supplies: [
    {
      ...base,
      id: 'demo-s1',
      productId: 'demo-p1',
      supplierId: 'demo-c4',
      component: '铝合金外壳',
    },
    {
      ...base,
      id: 'demo-s2',
      productId: 'demo-p1',
      supplierId: 'demo-c3',
      component: '再生纸包装',
    },
    {
      ...base,
      id: 'demo-s3',
      productId: 'demo-p2',
      supplierId: 'demo-c5',
      component: '电源模块',
    },
    {
      ...base,
      id: 'demo-s4',
      productId: 'demo-p2',
      supplierId: 'demo-c4',
      component: '结构件',
    },
    {
      ...base,
      id: 'demo-s5',
      productId: 'demo-p3',
      supplierId: 'demo-c3',
      component: '再生包装',
    },
    {
      ...base,
      id: 'demo-s6',
      productId: 'demo-p4',
      supplierId: 'demo-c7',
      component: '棉织面料',
    },
    {
      ...base,
      id: 'demo-s7',
      productId: 'demo-p4',
      supplierId: 'demo-c6',
      component: '外包装',
    },
  ],
};

// Bundled factual source index is read-only; contributions remain in the existing local document.
seed.companies.push(...githubCompanies);
