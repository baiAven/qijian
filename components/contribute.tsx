'use client';
import { useState, type SyntheticEvent } from 'react';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  safeUrl,
  type Data,
  type Company,
  type Report,
  type Evidence,
} from '@/lib/model';
import type { LocalStore } from '@/lib/store';
export type FormPreset = {
  kind: 'company' | 'report' | 'product' | 'supply';
  companyId?: string;
  productId?: string;
};
function Choose({
  value,
  set,
  items,
  label,
}: {
  value: string;
  set: (s: string) => void;
  items: { value: string; label: string }[];
  label: string;
}) {
  const options = [{ value: '', label: '请选择' }, ...items];
  return (
    <Select value={value} onValueChange={(v) => set(v || '')} items={options}>
      <SelectTrigger aria-label={label}>
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
const pair = (a: string[]) => a.map((v) => ({ value: v, label: v }));
export function Contribute({
  open,
  preset,
  data,
  store,
  onClose,
  onSaved,
}: {
  open: boolean;
  preset?: FormPreset;
  data: Data;
  store?: LocalStore;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<FormPreset['kind']>(
    preset?.kind || 'company',
  );
  const [known, setKnown] = useState(true);
  const [companyId, setCompanyId] = useState(preset?.companyId || '');
  const [productId, setProductId] = useState(preset?.productId || '');
  const [supplierId, setSupplierId] = useState('');
  const [days, setDays] = useState('');
  const [overtime, setOvertime] = useState('');
  const [shifts, setShifts] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');

  const companies = data.companies.map((c) => ({ value: c.id, label: c.name }));
  const products = data.products.map((p) => ({ value: p.id, label: p.name }));
  const schedule = kind === 'report' || (kind === 'company' && known);
  function submit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (!store) {
      setError('本地资料尚未就绪，请稍候。');
      return;
    }
    try {
      const f = new FormData(e.currentTarget);
      const text = (k: string) => {
        const v = f.get(k);
        return typeof v === 'string' ? v.trim() : '';
      };
      const id = () => crypto.randomUUID();
      const source = text('source');
      const date = text('date');
      if (source && !safeUrl(source))
        throw new Error('来源链接需要以 https:// 或 http:// 开头。');
      if (date > new Date().toLocaleDateString('en-CA'))
        throw new Error('记录日期不能晚于今天。');
      if (kind !== 'company' && !companyId && kind !== 'supply')
        throw new Error('请选择对应企业。');
      if (schedule && (!days || !overtime || !shifts))
        throw new Error('请完整选择休息天数、加班情况和班次。');
      const inheritedDemo =
        kind === 'supply'
          ? data.products.find((p) => p.id === productId)?.demo ||
            data.companies.find((c) => c.id === supplierId)?.demo
          : data.companies.find((c) => c.id === companyId)?.demo;
      const evidence: Evidence = {
        id: id(),
        source,
        date,
        note: text('note'),
        author: text('author') || '未署名',
        demo: !!inheritedDemo,
      };
      const report: Report = {
        ...evidence,
        companyId,
        scope: text('scope'),
        daysOff: Number(days),
        hours: Number(text('hours')),
        overtime: overtime as Report['overtime'],
        shifts: shifts as Report['shifts'],
      };
      if (kind === 'company') {
        if (
          data.companies.some(
            (c) =>
              c.name
                .replace(/^示例 · /, '')
                .trim()
                .toLowerCase() === text('name').toLowerCase() &&
              c.city.split('/').includes(text('city')),
          )
        )
          throw new Error('该城市已有同名企业，请选择“工时记录”补充信息。');
        const c: Company = {
          id: id(),
          name: text('name'),
          city: text('city'),
          industry: text('industry'),
          intro: text('intro'),
        };
        if (known)
          store.addCompany(c, { ...report, companyId: c.id, demo: false });
        else store.add('companies', c);
      } else if (kind === 'report') {
        store.add('reports', report);
      } else if (kind === 'product') {
        if (!category) throw new Error('请选择产品类别。');
        store.add('products', {
          ...evidence,
          name: text('name'),
          companyId,
          category,
        });
      } else {
        if (!productId || !supplierId)
          throw new Error('请选择产品与供应商企业。');
        store.add('supplies', {
          ...evidence,
          productId,
          supplierId,
          component: text('component'),
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请检查资料。');
    }
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="modal">
        <DialogTitle>补充你了解的信息</DialogTitle>
        <DialogDescription>
          先保存在本机，连接设备后合并。所有新记录均为待核验线索。
        </DialogDescription>
        <Tabs
          className="form-tabs"
          value={kind}
          onValueChange={(v) => {
            setKind(v as FormPreset['kind']);
            setError('');
          }}
        >
          <TabsList style={{ width: '100%', height: 40 }}>
            {(
              [
                ['company', '企业'],
                ['report', '工时记录'],
                ['product', '产品'],
                ['supply', '供应关系'],
              ] as const
            ).map(([v, t]) => (
              <TabsTrigger key={v} value={v}>
                {t}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <form className="form-stack" onSubmit={submit}>
          {kind === 'company' ? (
            <>
              <label className="field">
                企业全称
                <input
                  name="name"
                  required
                  maxLength={100}
                  placeholder="请填写准确的企业名称"
                />
              </label>
              <div className="form-row">
                <label className="field">
                  所在城市
                  <input
                    name="city"
                    required
                    maxLength={40}
                    placeholder="例如：苏州"
                  />
                </label>
                <label className="field">
                  所属行业
                  <input
                    name="industry"
                    required
                    maxLength={40}
                    placeholder="例如：消费电子"
                  />
                </label>
              </div>
              <label className="field">
                主要业务
                <input
                  name="intro"
                  required
                  maxLength={200}
                  placeholder="企业生产或提供什么？"
                />
              </label>
              <label className="switch-line">
                我也了解该企业的工时情况
                <Switch
                  checked={known}
                  onCheckedChange={setKnown}
                  aria-label="添加工时记录"
                />
              </label>
              {!known && (
                <p className="notice">
                  企业将保留在“待补充”中，你可以先添加它的产品与供应关系。
                </p>
              )}
            </>
          ) : kind !== 'supply' ? (
            <label className="field">
              {kind === 'product' ? '品牌 / 产品所属企业' : '对应企业'}
              <Choose
                value={companyId}
                set={setCompanyId}
                items={companies}
                label="选择企业"
              />
            </label>
          ) : null}
          {schedule && (
            <>
              <label className="field">
                具体地点与部门 / 岗位
                <input
                  name="scope"
                  required
                  maxLength={200}
                  placeholder="例如：苏州工厂 · 装配线操作工"
                />
              </label>
              <div className="form-row">
                <label className="field">
                  每周休息天数
                  <Choose
                    value={days}
                    set={setDays}
                    items={Array.from({ length: 8 }, (_, i) => ({
                      value: String(i),
                      label: `${i} 天`,
                    }))}
                    label="每周休息天数"
                  />
                </label>
                <label className="field">
                  每天工作时长（小时）
                  <input
                    name="hours"
                    required
                    type="number"
                    min="0.5"
                    max="24"
                    step="0.5"
                    placeholder="例如：8 或 12"
                  />
                </label>
              </div>
              <div className="form-row">
                <label className="field">
                  加班情况
                  <Choose
                    value={overtime}
                    set={setOvertime}
                    items={[
                      { value: 'none', label: '不加班' },
                      { value: 'sometimes', label: '偶尔加班' },
                      { value: 'often', label: '经常加班' },
                    ]}
                    label="加班情况"
                  />
                </label>
                <label className="field">
                  工作班次
                  <Choose
                    value={shifts}
                    set={setShifts}
                    items={[
                      { value: 'day', label: '固定白班' },
                      { value: 'two', label: '两班倒' },
                      { value: 'other', label: '其他班次' },
                    ]}
                    label="工作班次"
                  />
                </label>
              </div>
            </>
          )}
          {kind === 'product' && (
            <>
              <label className="field">
                产品名称 / 型号
                <input
                  required
                  name="name"
                  maxLength={150}
                  placeholder="例如：某型号无线键盘"
                />
              </label>
              <label className="field">
                产品类别
                <Choose
                  value={category}
                  set={setCategory}
                  items={pair([
                    '办公数码',
                    '日用家居',
                    '食品饮料',
                    '服饰纺织',
                    '汽车交通',
                    '工业零件',
                    '包装材料',
                    '软件服务',
                    '其他',
                  ])}
                  label="产品类别"
                />
              </label>
            </>
          )}
          {kind === 'supply' && (
            <>
              <label className="field">
                关联产品
                <Choose
                  value={productId}
                  set={setProductId}
                  items={products}
                  label="关联产品"
                />
              </label>
              <label className="field">
                供应商企业
                <Choose
                  value={supplierId}
                  set={setSupplierId}
                  items={companies}
                  label="供应商企业"
                />
                <small>
                  列表中没有？先在“企业”页添加，工时未知也可以保存。
                </small>
              </label>
              <label className="field">
                供应的材料 / 零部件 / 服务
                <input
                  name="component"
                  required
                  maxLength={150}
                  placeholder="例如：电池、铝合金外壳、外包装"
                />
              </label>
            </>
          )}
          {(kind !== 'company' || known) && (
            <>
              <div className="form-row">
                <label className="field">
                  资料对应日期
                  <input
                    name="date"
                    type="date"
                    required
                    max={new Date().toLocaleDateString('en-CA')}
                  />
                </label>
                <label className="field">
                  署名（可选）
                  <input
                    name="author"
                    maxLength={40}
                    placeholder="昵称，不必填真实姓名"
                  />
                </label>
              </div>
              <label className="field">
                来源链接（可选）
                <input
                  name="source"
                  type="url"
                  maxLength={1500}
                  placeholder="https://…"
                />
              </label>
              <label className="field">
                来源说明与具体观察
                <textarea
                  name="note"
                  required
                  maxLength={1500}
                  placeholder={
                    kind === 'supply'
                      ? '请说明供应关系的依据，例如公开供应商名单、产品标签或亲身观察。'
                      : '请写清信息来自哪里、适用的时间范围及具体情况。'
                  }
                />
                <small>
                  没有链接时，请写清亲身观察或资料出处。勿填写个人隐私。
                </small>
              </label>
            </>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button type="button" className="btn" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn primary" disabled={!store}>
              <Plus size={16} />
              保存到本地副本
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
