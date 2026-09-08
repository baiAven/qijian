'use client';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { useSyncExternalStore } from 'react';
import {
  seed,
  type Data,
  type Company,
  type Report,
  type Product,
  type Supply,
  safeUrl,
} from './model';
export type Entry = Company | Report | Product | Supply;
const kinds = ['companies', 'reports', 'products', 'supplies'] as const;
const DB = 'qijian-v1';
const MAX = 1024 * 1024;
export function toBase64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}
export function fromBase64(s: string) {
  if (s.length > MAX * 1.4) throw new Error('资料超过 1 MB，请拆分后重试。');
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
const isText = (x: unknown, max = 2000): x is string =>
  typeof x === 'string' && x.length <= max;
export function validEntry(kind: keyof Data, e: unknown): e is Entry {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
  const r = e as Record<string, unknown>;
  if (
    !isText(r.id, 100) ||
    !r.id ||
    r.id.startsWith('demo-') ||
    r.id.startsWith('gh-') ||
    r.github !== undefined ||
    (r.demo !== undefined && typeof r.demo !== 'boolean')
  )
    return false;
  if (kind === 'companies')
    return (
      ['name', 'city', 'industry', 'intro'].every((k) => isText(r[k], 500)) &&
      !!r.name
    );
  if (
    !['source', 'date', 'note', 'author'].every((k) => isText(r[k])) ||
    !r.note ||
    !/^\d{4}-\d{2}-\d{2}$/.test(String(r.date)) ||
    Number.isNaN(Date.parse(String(r.date))) ||
    (typeof r.source === 'string' && !!r.source && !safeUrl(r.source))
  )
    return false;
  if (kind === 'reports')
    return (
      isText(r.companyId, 100) &&
      isText(r.scope, 500) &&
      !!r.scope &&
      Number.isInteger(r.daysOff) &&
      Number(r.daysOff) >= 0 &&
      Number(r.daysOff) <= 7 &&
      typeof r.hours === 'number' &&
      r.hours > 0 &&
      r.hours <= 24 &&
      ['none', 'sometimes', 'often'].includes(String(r.overtime)) &&
      ['day', 'two', 'other'].includes(String(r.shifts))
    );
  if (kind === 'products')
    return (
      isText(r.companyId, 100) &&
      isText(r.name, 200) &&
      !!r.name &&
      isText(r.category, 200)
    );
  return (
    isText(r.productId, 100) &&
    isText(r.supplierId, 100) &&
    isText(r.component, 200) &&
    !!r.component
  );
}
export function validateDoc(doc: Y.Doc) {
  let count = 0;
  for (const kind of kinds) {
    for (const [id, value] of doc.getMap(kind).entries()) {
      if (
        ++count > 5000 ||
        !validEntry(kind, value) ||
        (value as Entry).id !== id
      )
        throw new Error('资料格式不正确或条目超过试验版限制。');
    }
  }
  const hasCompany = (id: string) =>
    doc.getMap('companies').has(id) || seed.companies.some((c) => c.id === id);
  const hasProduct = (id: string) =>
    doc.getMap('products').has(id) || seed.products.some((p) => p.id === id);
  for (const r of doc.getMap<Report>('reports').values())
    if (!hasCompany(r.companyId)) throw new Error('工时记录关联的企业不存在。');
  for (const p of doc.getMap<Product>('products').values())
    if (!hasCompany(p.companyId)) throw new Error('产品关联的企业不存在。');
  for (const s of doc.getMap<Supply>('supplies').values())
    if (!hasCompany(s.supplierId) || !hasProduct(s.productId))
      throw new Error('供应关系存在缺失的企业或产品。');
}
export class LocalStore {
  doc = new Y.Doc();
  persistence: IndexeddbPersistence | undefined;
  listeners = new Set<() => void>();
  channel: BroadcastChannel | undefined;
  revision = 0;
  ready = false;
  storageError = '';
  peerState = '未连接';
  peer: PeerLink | undefined;
  lastSync = '';
  constructor(name = DB) {
    this.doc.on('update', (u: Uint8Array, origin: unknown) => {
      this.notify();
      if (origin !== 'tab') this.channel?.postMessage(toBase64(u));
    });
    try {
      this.persistence = new IndexeddbPersistence(name, this.doc);
      this.persistence.whenSynced
        .then(() => {
          this.ready = true;
          this.notify();
        })
        .catch(() => {
          this.storageError = '本地存储不可用，请导出备份。';
          this.notify();
        });
    } catch {
      this.storageError = '浏览器不允许本地存储，请导出备份。';
    }
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(name);
      this.channel.onmessage = (e) => {
        try {
          if (e.data === 'hello')
            this.channel?.postMessage(
              toBase64(Y.encodeStateAsUpdate(this.doc)),
            );
          else this.apply(fromBase64(e.data), 'tab');
        } catch {
          /* Ignore invalid cross-tab messages. */
        }
      };
      this.channel.postMessage('hello');
    }
  }
  notify() {
    this.revision++;
    this.listeners.forEach((fn) => fn());
  }
  snapshot(): Data {
    return Object.fromEntries(
      kinds.map((k) => [
        k,
        [
          ...seed[k],
          ...Array.from(this.doc.getMap<Entry>(k).values()).filter((e) =>
            validEntry(k, e),
          ),
        ],
      ]),
    ) as unknown as Data;
  }
  add(kind: keyof Data, entry: Entry) {
    if (!validEntry(kind, entry))
      throw new Error('请检查必填资料、日期与来源链接。');
    this.doc.getMap<Entry>(kind).set(entry.id, entry);
  }
  addCompany(company: Company, report: Report) {
    if (!validEntry('companies', company) || !validEntry('reports', report))
      throw new Error('企业或工时资料格式不正确。');
    this.doc.transact(() => {
      this.add('companies', company);
      this.add('reports', report);
    });
  }
  apply(update: Uint8Array, origin: unknown) {
    if (update.length > MAX)
      throw new Error('资料超过 1 MB，无法在试验版中合并。');
    const temp = new Y.Doc();
    try {
      Y.applyUpdate(temp, Y.encodeStateAsUpdate(this.doc));
      Y.applyUpdate(temp, update);
      validateDoc(temp);
      for (const kind of kinds)
        for (const [id, value] of this.doc.getMap(kind).entries()) {
          if (
            JSON.stringify(temp.getMap(kind).get(id)) !== JSON.stringify(value)
          )
            throw new Error('合并资料试图修改或删除既有记录，请使用追加更正。');
        }
      if (Y.encodeStateAsUpdate(temp).length > MAX)
        throw new Error('合并后的资料超过 1 MB。');
      Y.applyUpdate(this.doc, update, origin);
      this.lastSync = new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      this.notify();
    } finally {
      temp.destroy();
    }
  }
  export() {
    return JSON.stringify(
      {
        format: 'qijian-backup',
        version: 1,
        createdAt: new Date().toISOString(),
        update: toBase64(Y.encodeStateAsUpdate(this.doc)),
      },
      null,
      2,
    );
  }
  import(text: string) {
    if (text.length > MAX * 1.5)
      throw new Error('文件过大，请选择 1 MB 以内的企见备份。');
    const data = JSON.parse(text);
    if (
      data.format !== 'qijian-backup' ||
      data.version !== 1 ||
      typeof data.update !== 'string'
    )
      throw new Error('请选择企见导出的备份文件。');
    this.apply(fromBase64(data.update), 'file');
  }
  connect(useStun: boolean) {
    this.peer?.close();
    this.peer = new PeerLink(this, useStun);
    return this.peer;
  }
  async dispose() {
    this.disconnect();
    this.channel?.close();
    await this.persistence?.destroy();
    this.doc.destroy();
  }
  disconnect() {
    this.peer?.close();
    this.peer = undefined;
    this.peerState = '未连接';
    this.notify();
  }
}
let instance: LocalStore | undefined;
export function getStore() {
  return (instance ??= new LocalStore());
}
const subscribe = (fn: () => void) => {
  const s = getStore();
  s.listeners.add(fn);
  return () => {
    s.listeners.delete(fn);
  };
};
export function useLocalData() {
  const revision = useSyncExternalStore(
    subscribe,
    () => getStore().revision,
    () => -1,
  );
  const store = revision < 0 ? undefined : getStore();
  return { data: store?.snapshot() || seed, store };
}

export class PeerLink {
  pc: RTCPeerConnection;
  dc: RTCDataChannel | undefined;
  private received: string[] = [];
  private size = 0;
  private expected = 0;
  private queue: string[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;
  private handler: (u: Uint8Array, origin: unknown) => void;
  constructor(
    private store: LocalStore,
    useStun: boolean,
  ) {
    if (typeof RTCPeerConnection === 'undefined')
      throw new Error('当前浏览器不支持设备直连，请使用文件合并。');
    this.pc = new RTCPeerConnection({
      iceServers: useStun ? [{ urls: 'stun:stun.l.google.com:19302' }] : [],
    });
    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      this.store.peerState =
        state === 'connected'
          ? '已连接'
          : state === 'failed'
            ? '连接失败，请用文件合并'
            : state === 'disconnected'
              ? '连接已中断'
              : state === 'closed'
                ? '未连接'
                : '连接中';
      this.store.notify();
    };
    this.pc.ondatachannel = (e) => this.attach(e.channel);
    this.handler = (u, origin) => {
      if (origin !== this && this.dc?.readyState === 'open') this.send(u);
    };
    this.store.doc.on('update', this.handler);
  }
  private attach(dc: RTCDataChannel) {
    this.dc = dc;
    dc.bufferedAmountLowThreshold = 65536;
    dc.onbufferedamountlow = () => this.flush();
    dc.onopen = () => {
      this.store.peerState = '已连接';
      this.store.notify();
      this.send(Y.encodeStateAsUpdate(this.store.doc));
    };
    dc.onclose = () => {
      this.store.peerState = '连接已断开';
      this.store.notify();
    };
    dc.onmessage = (e) => {
      try {
        if (typeof e.data !== 'string' || e.data.length > 20000)
          throw new Error('消息格式无效');
        if (e.data.startsWith('size:')) {
          const size = Number(e.data.slice(5));
          if (!Number.isInteger(size) || size < 0 || size > MAX * 1.4)
            throw new Error('资料过大');
          this.expected = size;
          this.received = [];
          this.size = 0;
          return;
        }
        if (e.data === 'end') {
          if (this.size !== this.expected) throw new Error('资料不完整');
          this.store.apply(fromBase64(this.received.join('')), this);
          this.received = [];
          this.size = 0;
          this.expected = 0;
          return;
        }
        this.size += e.data.length;
        if (!this.expected || this.size > this.expected)
          throw new Error('资料过大');
        this.received.push(e.data);
      } catch {
        this.close();
        this.store.peerState = '收到无效资料，连接已关闭';
        this.store.notify();
      }
    };
  }
  private send(u: Uint8Array) {
    const b64 = toBase64(u);
    if (b64.length > MAX * 1.4) return;
    this.queue.push('size:' + b64.length);
    for (let i = 0; i < b64.length; i += 12000)
      this.queue.push(b64.slice(i, i + 12000));
    this.queue.push('end');
    this.flush();
  }
  private flush() {
    while (
      this.queue.length &&
      this.dc?.readyState === 'open' &&
      this.dc.bufferedAmount < 131072
    )
      this.dc.send(this.queue.shift()!);
  }
  private gather() {
    return new Promise<void>((resolve, reject) => {
      if (this.pc.iceGatheringState === 'complete') return resolve();
      const done = () => {
        if (this.pc.iceGatheringState === 'complete') {
          clearTimeout(this.timer);
          this.pc.removeEventListener('icegatheringstatechange', done);
          resolve();
        }
      };
      this.pc.addEventListener('icegatheringstatechange', done);
      this.timer = setTimeout(() => {
        this.pc.removeEventListener('icegatheringstatechange', done);
        if (this.closed) reject(new Error('连接已取消'));
        else resolve();
      }, 10000);
    });
  }
  private async code() {
    await this.gather();
    if (this.closed || !this.pc.localDescription)
      throw new Error('连接已取消，请重试。');
    return JSON.stringify({
      app: 'qijian',
      v: 1,
      type: this.pc.localDescription.type,
      sdp: this.pc.localDescription.sdp,
    });
  }
  private parse(
    code: string,
    type: 'offer' | 'answer',
  ): RTCSessionDescriptionInit {
    if (code.length > 30000) throw new Error('连接码过长。');
    let d;
    try {
      d = JSON.parse(code);
    } catch {
      throw new Error('连接码格式不正确，请复制完整内容。');
    }
    if (
      d.app !== 'qijian' ||
      d.v !== 1 ||
      d.type !== type ||
      typeof d.sdp !== 'string'
    )
      throw new Error(
        type === 'offer'
          ? '请粘贴对方的邀请连接码。'
          : '请粘贴对方的回复连接码。',
      );
    return { type: d.type, sdp: d.sdp };
  }
  async offer() {
    this.store.peerState = '等待交换连接码';
    this.store.notify();
    this.attach(this.pc.createDataChannel('qijian-data', { ordered: true }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    return this.code();
  }
  async answer(code: string) {
    await this.pc.setRemoteDescription(this.parse(code, 'offer'));
    this.store.peerState = '等待对方确认';
    this.store.notify();
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    return this.code();
  }
  async finish(code: string) {
    await this.pc.setRemoteDescription(this.parse(code, 'answer'));
    this.store.peerState = '连接中';
    this.store.notify();
  }
  close() {
    this.closed = true;
    this.store.doc.off('update', this.handler);
    this.dc?.close();
    this.pc.close();
    this.queue = [];
  }
}
