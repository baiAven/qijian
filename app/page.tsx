'use client';
import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDown,
  Building2,
  Search,
  Plus,
  CircleHelp,
  Network,
  HardDrive,
  Sun,
  Moon,
  Package,
  GitBranch,
  ShieldCheck,
  X,
  BookOpen,
  SlidersHorizontal,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useLocalData } from '@/lib/store';
import {
  companyBoard,
  sourceLabels,
  classify,
  relatedProducts,
  matches,
  safeUrl,
  boardNames,
  type Board,
  type Company,
  type Data,
  type Product,
} from '@/lib/model';
import { Contribute, type FormPreset } from '@/components/contribute';
import { SyncPanel } from '@/components/sync-panel';

export function Picker({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v !== null && onChange(v)}
      items={options}
    >
      <SelectTrigger className="filter-select" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Badge({ board }: { board: Board }) {
  return <span className={`tag ${board}`}>{boardNames[board]}</span>;
}
const briefName = (name: string) => name.replace(/^示例 · /, '');
export default function Home() {
  const { data, store } = useLocalData();
  const [board, setBoard] = useState('github');
  const [sourceList, setSourceList] = useState('all');
  const [visibleCount, setVisibleCount] = useState(24);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('all');
  const [industry, setIndustry] = useState('all');
  const [showDemo, setShowDemo] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [focusedProduct, setFocusedProduct] = useState<string>();
  const [form, setForm] = useState<FormPreset>();
  const [sync, setSync] = useState(false);
  const [info, setInfo] = useState<'rules' | 'repos'>();
  const [notice, setNotice] = useState('');
  const companies = useMemo(
    () => data.companies.filter((c) => showDemo || !c.demo),
    [data, showDemo],
  );
  const filtered = companies.filter(
    (c) =>
      (board === 'github'
        ? !!c.github?.some((s) => sourceList === 'all' || s.list === sourceList)
        : board === 'pending'
          ? ['pending', 'conflict'].includes(companyBoard(c.id, data))
          : companyBoard(c.id, data) === board) &&
      (city === 'all' || c.city.split('/').includes(city)) &&
      (industry === 'all' || c.industry === industry) &&
      matches(c, query, data),
  );
  const chosen = data.companies.find((c) => c.id === selected);
  const focused = data.products.find((p) => p.id === focusedProduct);
  const openCompany = (id: string, product?: string) => {
    setSelected(id);
    setFocusedProduct(product);
  };
  const toast = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(''), 4500);
  };
  const allProducts = data.products.filter((p) => showDemo || !p.demo);
  const allSupplies = data.supplies.filter((s) => showDemo || !s.demo);
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brandmark">
            <Building2 size={24} />
          </div>
          <span className="brandname">企见</span>
          <small>看见企业的另一面</small>
        </div>
        <div className="top-actions">
          <button className="btn quiet" onClick={() => setSync(true)}>
            <span
              className={`dot ${store?.peerState === '已连接' ? 'online' : ''}`}
            />
            <span className="desktop-text">
              {store?.peerState === '已连接' ? '设备已连接' : '本地副本'}
            </span>
            <Network size={17} />
          </button>
          <button
            className="btn primary"
            onClick={() => setForm({ kind: 'company' })}
          >
            <Plus />
            <span>补充信息</span>
          </button>
        </div>
      </header>
      <main className="workspace">
        <div className="intro">
          <div>
            <div className="eyebrow">COMMUNITY COMPANY ATLAS</div>
            <h1>好工作，值得被看见。</h1>
            <p>查企业工时，找相关产品，了解每一层供应商。</p>
          </div>
          <div className="intro-side">
            <CircleHelp size={14} /> GitHub 资料已导入 · 历史线索
          </div>
        </div>
        <div className="board-layout">
          <section aria-label="企业榜单">
            <Tabs value={board} onValueChange={(v) => setBoard(String(v))}>
              <TabsList className="board-tabs">
                <TabsTrigger
                  value="github"
                  className="board-tab"
                  data-board="github"
                >
                  <BookOpen />
                  <div className="tab-copy">
                    <div className="tab-title">
                      GitHub 企业库{' '}
                      <span className="tab-count">
                        {companies.filter((c) => c.github).length}
                      </span>
                    </div>
                    <div className="tab-sub">原始名单 · 保留来源</div>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="red" className="board-tab" data-board="red">
                  <Sun />
                  <div className="tab-copy">
                    <div className="tab-title">
                      企业红榜{' '}
                      <span className="tab-count">
                        {
                          companies.filter(
                            (c) => companyBoard(c.id, data) === 'red',
                          ).length
                        }
                      </span>
                    </div>
                    <div className="tab-sub">双休 · 不加班</div>
                  </div>
                </TabsTrigger>
                <TabsTrigger
                  value="black"
                  className="board-tab"
                  data-board="black"
                >
                  <Moon />
                  <div className="tab-copy">
                    <div className="tab-title">
                      企业黑榜{' '}
                      <span className="tab-count">
                        {
                          companies.filter(
                            (c) => companyBoard(c.id, data) === 'black',
                          ).length
                        }
                      </span>
                    </div>
                    <div className="tab-sub">无双休 · 12 小时两班倒</div>
                  </div>
                </TabsTrigger>
              </TabsList>
              <search>
                <form
                  className="searchbar"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <Search size={20} />
                  <input
                    aria-label="搜索公司、产品或供应商"
                    placeholder="搜索公司、产品或供应商，例如：键盘"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      type="button"
                      className="btn quiet"
                      aria-label="清空搜索"
                      onClick={() => setQuery('')}
                    >
                      <X />
                    </button>
                  )}
                  <button
                    className={`btn ${board === 'black' ? 'dark' : 'primary'}`}
                  >
                    搜索
                  </button>
                </form>
              </search>
              <div className="filters">
                <div className="filter-set">
                  <Picker
                    label="选择地区"
                    value={city}
                    onChange={setCity}
                    options={[
                      { value: 'all', label: '全部地区' },
                      ...Array.from(
                        new Set(companies.flatMap((c) => c.city.split('/'))),
                      ).map((c) => ({ value: c, label: c })),
                    ]}
                  />
                  <Picker
                    label="选择行业"
                    value={industry}
                    onChange={setIndustry}
                    options={[
                      { value: 'all', label: '全部行业' },
                      ...Array.from(
                        new Set(companies.map((c) => c.industry)),
                      ).map((c) => ({ value: c, label: c })),
                    ]}
                  />
                </div>
                <label
                  className="subtle"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                  }}
                >
                  <Switch
                    checked={showDemo}
                    onCheckedChange={setShowDemo}
                    aria-label="显示虚构示例"
                    size="sm"
                  />
                  显示示例
                </label>
              </div>
              {board === 'github' && (
                <div className="notice">
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      marginBottom: 9,
                    }}
                  >
                    <strong>原仓库名单视图</strong>
                    <Picker
                      value={sourceList}
                      onChange={setSourceList}
                      label="筛选 GitHub 名单"
                      options={[
                        { value: 'all', label: '全部来源' },
                        ...Object.entries(sourceLabels).map(
                          ([value, label]) => ({ value, label }),
                        ),
                      ]}
                    />
                  </div>
                  已合并 331
                  条来源记录。收录不等于当前工时已核验，源黑名单也不等于“12
                  小时两班倒”。导入日期：2026-09-08。
                </div>
              )}
              {store?.storageError && (
                <div role="alert" className="notice">
                  {store.storageError}
                </div>
              )}
              <div className="results-caption">
                <span>
                  <strong>{filtered.length}</strong> 家企业
                  {query && ` · 匹配「${query}」`}
                </span>
                <button
                  onClick={() =>
                    setBoard(board === 'pending' ? 'red' : 'pending')
                  }
                  style={{
                    border: 0,
                    background: 'none',
                    padding: 0,
                    color: '#788293',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <SlidersHorizontal size={13} />
                  {board === 'pending' ? '返回红榜' : '待补充 / 有分歧'} ·{' '}
                  {
                    companies.filter((c) =>
                      ['pending', 'conflict'].includes(
                        companyBoard(c.id, data),
                      ),
                    ).length
                  }
                </button>
              </div>
              {board === 'pending' && (
                <p className="notice">
                  这里保留未满足红黑榜条件或工时记录存在分歧的企业。
                </p>
              )}
              {(['github', 'red', 'black', 'pending'] as const).map((b) => (
                <TabsContent key={b} value={b}>
                  <div className="company-grid">
                    {filtered.slice(0, visibleCount).map((c) => (
                      <CompanyCard
                        key={c.id}
                        company={c}
                        data={data}
                        query={query}
                        onOpen={(p) => openCompany(c.id, p)}
                      />
                    ))}
                    {filtered.length === 0 && (
                      <div
                        className="empty-state"
                        style={{ gridColumn: '1/-1' }}
                      >
                        <Search size={27} style={{ margin: 'auto' }} />
                        <h3>
                          {companies.length
                            ? '暂时没有匹配的企业'
                            : '从你了解的第一家企业开始'}
                        </h3>
                        <p>
                          {companies.length
                            ? '试试其他关键词或榜单，也可以添加你了解的资料。'
                            : '示例已隐藏，你补充的企业会出现在这里。'}
                        </p>
                        <button
                          className="btn"
                          onClick={() => {
                            setQuery('');
                            setCity('all');
                            setIndustry('all');
                          }}
                        >
                          清空筛选
                        </button>
                      </div>
                    )}
                    <button
                      className="add-card"
                      onClick={() => setForm({ kind: 'company' })}
                    >
                      <span className="add-symbol">
                        <Plus size={24} />
                      </span>
                      <strong>你了解的企业，还不在这里？</strong>
                      <p>补充一条信息，让更多人看见。</p>
                      <span className="text-link" style={{ margin: 0 }}>
                        添加企业 <ArrowRight />
                      </span>
                    </button>
                  </div>
                  {filtered.length > visibleCount && (
                    <button
                      className="btn"
                      style={{ width: '100%', marginTop: 18 }}
                      onClick={() => setVisibleCount((n) => n + 24)}
                    >
                      继续显示 · 已显示{' '}
                      {Math.min(visibleCount, filtered.length)} /{' '}
                      {filtered.length} 家
                    </button>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </section>
          <aside className="side-column">
            <section className="side-panel stats-panel">
              <h2>
                <Network />
                大家一起，让信息更完整
              </h2>
              <p>当前设备上的资料</p>
              <div className="stat-grid">
                <div>
                  <strong>{companies.length}</strong>
                  <span>家企业</span>
                </div>
                <div>
                  <strong>{allProducts.length}</strong>
                  <span>件产品</span>
                </div>
                <div>
                  <strong>{allSupplies.length}</strong>
                  <span>条供应关系</span>
                </div>
              </div>
              <div className="side-line" />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: '#7d8693',
                }}
              >
                <HardDrive size={14} />
                {store?.ready ? '保存在本机浏览器' : '正在打开本地资料'}
                <span className="dot" style={{ marginLeft: 'auto' }} />
              </div>
              <button className="text-link" onClick={() => setSync(true)}>
                连接另一台设备 <ArrowUpRight />
              </button>
            </section>
            <section className="side-panel">
              <h2>
                <ShieldCheck />
                榜单怎么看
              </h2>
              <div className="rule">
                <i />
                <div>
                  <strong>红榜：每周双休，不加班</strong>
                  依据所记录部门与时间段。
                </div>
              </div>
              <div className="rule">
                <i className="black" />
                <div>
                  <strong>黑榜：无双休，12 小时两班倒</strong>
                  三个条件同时满足才归入。
                </div>
              </div>
              <div className="side-line" />
              <p>
                用户记录均为待核验线索。品牌与供应商分别标记，工时表现不互相继承。
              </p>
              <button className="text-link" onClick={() => setInfo('rules')}>
                了解记录与分类规则 <ArrowUpRight />
              </button>
            </section>
            <section className="side-panel relations-panel">
              <h2>
                <GitBranch />
                从产品，看见供应链
              </h2>
              <p>品牌的背后，还有制造它的人。</p>
              <div className="flow-preview">
                <div className="flow-box">一件产品</div>
                <ArrowDown />
                <div className="flow-branches">
                  <div className="flow-box">
                    品牌企业 <span style={{ color: '#c32b3b' }}>●</span>
                  </div>
                  <div className="flow-box">
                    供应商 <span style={{ color: '#495465' }}>●</span>
                  </div>
                </div>
              </div>
              <button
                className="text-link"
                onClick={() => {
                  const p = allProducts[0];
                  if (p) openCompany(p.companyId, p.id);
                  else setForm({ kind: 'product' });
                }}
              >
                查看产品与供应商 <ArrowRight />
              </button>
            </section>
            <p className="source-note">
              一起记录，一起校正。
              <br />
              连接设备前，请确认你信任对方。
              <br />
              <button
                className="text-link"
                onClick={() => setInfo('repos')}
                style={{ color: '#818b98', marginTop: 10 }}
              >
                <BookOpen size={13} /> 开源项目与技术说明
              </button>
            </p>
          </aside>
        </div>
        <footer className="page-footer">
          <span>企见 QIJIAN · 每一份信息，都来自共同维护。</span>
          <span>
            <HardDrive size={13} />
            本地保存 · 手动连接同步 · 示例不代表真实企业
          </span>
        </footer>
      </main>
      <Sheet
        open={!!chosen}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(undefined);
            setFocusedProduct(undefined);
          }
        }}
      >
        <SheetContent className="details-sheet">
          {chosen && (
            <>
              <div>
                <div className="eyebrow">COMPANY PROFILE</div>
                <SheetTitle className="details-title">{chosen.name}</SheetTitle>
                <SheetDescription>
                  {chosen.city} · {chosen.industry} · {chosen.intro}
                </SheetDescription>
                <div className="tags" style={{ marginTop: 17 }}>
                  <Badge board={companyBoard(chosen.id, data)} />
                  <span className="tag">
                    {chosen.demo ? '虚构示例' : '社区线索 · 待核验'}
                  </span>
                </div>
              </div>
              {chosen.github && (
                <div className="detail-section">
                  <h3>GitHub 原始名单记录</h3>
                  <p className="subtle" style={{ marginBottom: 14 }}>
                    以下描述的是原仓库的历史收录，不是本应用对当前工时的认证。导入未补造产品、行业或供应关系。
                  </p>
                  {chosen.github.map((g, i) => (
                    <div className="report" key={g.url + i}>
                      <div className="report-top">
                        <strong>{sourceLabels[g.list]}</strong>
                        <span className={`tag ${g.kind}`}>
                          历史收录 · 待核验
                        </span>
                      </div>
                      <p>适用地区：{g.city}</p>
                      <p>来源记录日期：{g.recordDate}</p>
                      {g.scheduleTags.length > 0 && (
                        <p>
                          原记录提及：{g.scheduleTags.join(' / ')}（未独立核验）
                        </p>
                      )}
                      <p className="meta">
                        名单文件更新：{g.updatedAt} · 导入：{g.importedAt}
                      </p>
                      <a href={safeUrl(g.url)} target="_blank" rel="noreferrer">
                        查看原始记录与证据 ↗
                      </a>
                    </div>
                  ))}
                </div>
              )}
              <div className="detail-section">
                <h3>
                  工时记录 <span className="subtle">/ 以部门为单位</span>
                </h3>
                {data.reports
                  .filter((r) => r.companyId === chosen.id)
                  .map((r) => (
                    <div className="report" key={r.id}>
                      <div className="report-top">
                        <strong>{r.scope}</strong>
                        <Badge board={classify(r)} />
                      </div>
                      <div className="tags">
                        <span className="tag">每周休 {r.daysOff} 天</span>
                        <span className="tag">每天 {r.hours} 小时</span>
                        <span className="tag">
                          {r.shifts === 'two'
                            ? '两班倒'
                            : r.shifts === 'day'
                              ? '白班'
                              : '其他班次'}
                        </span>
                        <span className="tag">
                          {r.overtime === 'none'
                            ? '不加班'
                            : r.overtime === 'often'
                              ? '经常加班'
                              : '偶尔加班'}
                        </span>
                      </div>
                      <p>{r.note}</p>
                      {safeUrl(r.source) && (
                        <a
                          href={safeUrl(r.source)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          查看来源 ↗
                        </a>
                      )}
                      <p className="meta">
                        记录日期 {r.date} ·{' '}
                        {r.demo ? '虚构演示' : `提交者自填：${r.author}`} ·{' '}
                        {r.demo ? '示例资料' : '未经独立核验'}
                      </p>
                    </div>
                  ))}
                {!data.reports.some((r) => r.companyId === chosen.id) && (
                  <p className="subtle">尚未补充工时资料。</p>
                )}
                <button
                  className="btn detail-add"
                  onClick={() =>
                    setForm({ kind: 'report', companyId: chosen.id })
                  }
                >
                  <Plus />
                  补充工时 / 更正线索
                </button>
              </div>
              <div className="detail-section">
                <h3>产品与供应商</h3>
                <p
                  className="subtle"
                  style={{ marginBottom: 16, fontSize: 13 }}
                >
                  供应商标签独立判断；未列出的环节不代表不存在。
                </p>
                {(focused ? [focused] : relatedProducts(chosen.id, data)).map(
                  (p) => (
                    <ProductBlock
                      key={p.id}
                      product={p}
                      data={data}
                      onCompany={openCompany}
                      onAdd={() => setForm({ kind: 'supply', productId: p.id })}
                    />
                  ),
                )}
                {relatedProducts(chosen.id, data).length === 0 && !focused && (
                  <p className="subtle" style={{ marginBottom: 15 }}>
                    还没有产品信息，欢迎补充。
                  </p>
                )}
                {focused && (
                  <button
                    className="text-link"
                    onClick={() => setFocusedProduct(undefined)}
                  >
                    查看该企业的全部关联产品 <ArrowRight />
                  </button>
                )}
                <button
                  className="btn detail-add"
                  style={{ marginTop: 15 }}
                  onClick={() =>
                    setForm({ kind: 'product', companyId: chosen.id })
                  }
                >
                  <Plus />
                  补充产品
                </button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      {form && (
        <Contribute
          open={true}
          preset={form}
          data={data}
          store={store}
          onClose={() => setForm(undefined)}
          onSaved={() => {
            setForm(undefined);
            toast('信息已加入本地副本，可通过设备直连或备份文件合并。');
          }}
        />
      )}
      <SyncPanel open={sync} onClose={() => setSync(false)} store={store} />
      <Dialog
        open={!!info}
        onOpenChange={(open) => !open && setInfo(undefined)}
      >
        <DialogContent className="modal">
          <DialogTitle>
            {info === 'rules'
              ? '共同维护，也保留不同的声音'
              : '这个试验版，基于什么？'}
          </DialogTitle>
          <DialogDescription>
            {info === 'rules'
              ? '每一条记录都有适用范围，榜单只是查阅线索的入口。'
              : 'GitHub 调研 · 2026 年 9 月 7 日'}
          </DialogDescription>
          {info === 'rules' ? (
            <div className="guide-list">
              <div>
                <h3>按条件归类，保留原始记录</h3>
                <p>
                  红榜：每周休息至少 2 天且不加班。黑榜：每周休息不足 2
                  天、每日至少 12
                  小时、两班倒同时满足。其他情况保留为待补充；同一企业出现不同分类时进入“有分歧”。这些是产品的分类规则，不是法律认定。
                </p>
              </div>
              <div>
                <h3>地点、部门、日期缺一不可</h3>
                <p>
                  总部与工厂、研发与产线可能完全不同。记录只描述所填部门和时间，不代表整家公司，也不保证现在仍然适用。
                </p>
              </div>
              <div>
                <h3>线索可以补充，事实需要核验</h3>
                <p>
                  用户提交的记录不会获得“已核验”认证。请写清来源和具体观察，不填写个人姓名、联系方式或未经脱敏的员工资料。可以追加更正记录，旧记录继续保留。
                </p>
              </div>
              <div>
                <h3>供应关系和工时分别记录</h3>
                <p>
                  企业上红榜，不代表其供应商都上红榜；供应商上黑榜，也不自动改变品牌企业的分类。供应关系需要独立的来源说明。
                </p>
              </div>
            </div>
          ) : (
            <div>
              <a
                className="repo-row"
                href="https://github.com/yjs/yjs"
                target="_blank"
                rel="noreferrer"
              >
                <strong>Yjs + y-indexeddb</strong>
                <p>实际使用：协作数据合并与浏览器本地持久保存。</p>
                <span>MIT · 已集成 ↗</span>
              </a>
              <a
                className="repo-row"
                href="https://github.com/996icu/996.ICU"
                target="_blank"
                rel="noreferrer"
              >
                <strong>996.ICU / 955.WLB</strong>
                <p>
                  借鉴企业工时名单的结构；企业库已导入原名单，保留历史来源，未视为当前已核验结论。
                </p>
                <span>原始名单来源 ↗</span>
              </a>
              <a
                className="repo-row"
                href="https://github.com/openfoodfacts/openfoodfacts-server"
                target="_blank"
                rel="noreferrer"
              >
                <strong>Open Food Facts</strong>
                <p>参考众包产品与来源记录的组织方式，未使用其服务器代码。</p>
                <span>产品库参考 ↗</span>
              </a>
              <div className="guide-list" style={{ marginTop: 18 }}>
                <div>
                  <h3>数据留在设备，直连时互相合并</h3>
                  <p>
                    此版使用 WebRTC
                    手动交换连接码，不设中心业务数据库。启用跨网络连接时会使用
                    Google STUN 服务帮助建立连接；未配置 TURN
                    中继，因此部分网络无法直连，可用文件合并。
                  </p>
                </div>
                <div>
                  <h3>这是小规模试验，还不是公共网络</h3>
                  <p>
                    网页页面需要托管；关闭网页后设备不会持续服务。当前没有公共节点发现、账户签名、反刷审核或全网搜索，搜索范围限于本机已有资料。同步会把你的全部本地贡献交给对方，仅与信任的设备连接。
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {notice && <output className="status-banner">{notice}</output>}
    </>
  );
}
function CompanyCard({
  company: c,
  data,
  query,
  onOpen,
}: {
  company: Company;
  data: Data;
  query: string;
  onOpen: (id?: string) => void;
}) {
  const b = companyBoard(c.id, data);
  const r = data.reports.filter((r) => r.companyId === c.id);
  const products = relatedProducts(c.id, data);
  const supplierIds = Array.from(
    new Set(
      data.supplies
        .filter((s) => products.some((p) => p.id === s.productId))
        .map((s) => s.supplierId),
    ),
  );
  return (
    <article className="company-card">
      <div className="company-top">
        <div className="company-heading">
          <div className={`company-avatar ${b === 'black' ? 'black' : ''}`}>
            {briefName(c.name)[0]}
          </div>
          <div>
            <h3>{briefName(c.name)}</h3>
            <div className="meta">
              {c.city} · {c.industry} {c.demo ? '· 虚构示例' : ''}
            </div>
          </div>
          <button
            className="card-arrow"
            aria-label={`查看${c.name}`}
            onClick={() => onOpen()}
          >
            <ArrowUpRight />
          </button>
        </div>
        <div className="tags">
          {c.github &&
            Array.from(new Set(c.github.map((g) => g.list))).map((list) => (
              <span
                className={`tag ${list === 'black' ? 'black' : 'red'}`}
                key={list}
              >
                {sourceLabels[list]} · 历史
              </span>
            ))}
          {b === 'red' ? (
            <>
              <span className="tag red">
                <Sun size={12} />
                每周至少休两天
              </span>
              <span className="tag red">不加班</span>
            </>
          ) : b === 'black' ? (
            <>
              <span className="tag black">无双休</span>
              <span className="tag black">12 小时两班倒</span>
            </>
          ) : (
            <Badge board={b} />
          )}
        </div>
        <p className="company-desc">{c.intro}</p>
        {query && (
          <span className="query-badge">企业 / 关联产品 / 供应商匹配</span>
        )}
      </div>
      <div className="product-strip">
        <div className="product-label">
          <Package />
          关联产品{' '}
          <span style={{ marginLeft: 'auto' }}>{products.length} 件</span>
        </div>
        {products.slice(0, 2).map((p) => (
          <button
            key={p.id}
            className="product-link"
            onClick={() => onOpen(p.id)}
          >
            <span>{p.name}</span>
            <ArrowUpRight />
          </button>
        ))}
        {!products.length && (
          <button
            className="product-link"
            onClick={() => onOpen()}
            style={{ color: '#9aa1ac' }}
          >
            暂无产品 · 去补充 <Plus />
          </button>
        )}
      </div>
      <div className="company-footer">
        <span>
          {c.demo
            ? '演示记录'
            : c.github
              ? `${c.github.length} 条 GitHub 来源`
              : `${r.length} 条待核验记录`}
        </span>
        <button
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            border: 0,
            padding: 0,
            background: 'none',
            fontSize: 12,
            color: '#838c99',
          }}
          onClick={() => onOpen()}
        >
          <div className="supplier-dots">
            {supplierIds.slice(0, 4).map((id) => (
              <i key={id} className={`tiny-dot ${companyBoard(id, data)}`} />
            ))}
          </div>
          {supplierIds.length} 家供应商 <ArrowRight size={12} />
        </button>
      </div>
    </article>
  );
}
function ProductBlock({
  product: p,
  data,
  onCompany,
  onAdd,
}: {
  product: Product;
  data: Data;
  onCompany: (id: string) => void;
  onAdd: () => void;
}) {
  const brand = data.companies.find((c) => c.id === p.companyId);
  const supplies = data.supplies.filter((s) => s.productId === p.id);
  return (
    <div className="product-block">
      <div className="product-title">
        <h4>{p.name}</h4>
        <Package size={20} color="#9099a6" />
      </div>
      <p className="subtle" style={{ fontSize: 12, marginTop: 4 }}>
        {p.category} · {p.demo ? '虚构示例' : '待核验产品线索'}
      </p>
      {brand && (
        <button className="product-link" onClick={() => onCompany(brand.id)}>
          品牌：{briefName(brand.name)}{' '}
          <Badge board={companyBoard(brand.id, data)} />
        </button>
      )}
      <p className="subtle" style={{ fontSize: 12 }}>
        {p.note}
      </p>
      {safeUrl(p.source) && (
        <a
          className="text-link"
          style={{ marginTop: 5 }}
          href={safeUrl(p.source)}
          target="_blank"
          rel="noreferrer"
        >
          产品来源 ↗
        </a>
      )}
      <div className="supplier-list">
        {supplies.map((s) => {
          const c = data.companies.find((c) => c.id === s.supplierId);
          return (
            <div className="supplier-item" key={s.id}>
              <div className="row">
                <button onClick={() => c && onCompany(c.id)}>
                  {c ? briefName(c.name) : '企业资料待补充'}
                </button>
                <Badge board={c ? companyBoard(c.id, data) : 'pending'} />
              </div>
              <p>
                供应：{s.component} · {s.demo ? '虚构关系' : '待核验关系'} ·{' '}
                {s.date}
              </p>
              <p>{s.note}</p>
              {safeUrl(s.source) && (
                <a
                  className="text-link"
                  style={{ marginTop: 3 }}
                  href={safeUrl(s.source)}
                  target="_blank"
                  rel="noreferrer"
                >
                  关系来源 ↗
                </a>
              )}
            </div>
          );
        })}
      </div>
      {!supplies.length && (
        <p className="subtle" style={{ fontSize: 13, marginTop: 13 }}>
          尚无供应商资料，不代表供应链没有风险。
        </p>
      )}
      <button className="text-link" onClick={onAdd}>
        <Plus size={14} />
        补充供应商关系
      </button>
    </div>
  );
}
