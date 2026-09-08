import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { LocalStore, toBase64, validEntry } from '../lib/store';
import {
  classify,
  companyBoard,
  matches,
  seed,
  safeUrl,
  type Company,
  type Report,
} from '../lib/model';
const company = (id: string): Company => ({
  id,
  name: '测试企业 ' + id,
  city: '苏州',
  industry: '制造',
  intro: '用于自动验证',
});
const report = (id: string, companyId: string): Report => ({
  id,
  companyId,
  scope: '苏州工厂 · 装配',
  daysOff: 2,
  hours: 8,
  overtime: 'none',
  shifts: 'day',
  source: 'https://example.com/evidence',
  date: '2026-09-01',
  note: '自动测试记录',
  author: '测试',
});
const create = async (name: string) => {
  const s = new LocalStore(name + crypto.randomUUID());
  await s.persistence!.whenSynced;
  return s;
};
const backup = (doc: Y.Doc) =>
  JSON.stringify({
    format: 'qijian-backup',
    version: 1,
    update: toBase64(Y.encodeStateAsUpdate(doc)),
  });
void test('red and black rules use independent conditions; incomplete patterns stay pending', () => {
  const r = report('r', 'c');
  assert.equal(classify(r), 'red');
  assert.equal(
    classify({ ...r, daysOff: 1, hours: 12, shifts: 'two', overtime: 'often' }),
    'black',
  );
  assert.equal(
    classify({ ...r, daysOff: 1, hours: 11, shifts: 'two' }),
    'pending',
  );
  assert.equal(
    classify({ ...r, daysOff: 1, hours: 12, shifts: 'day' }),
    'pending',
  );
  assert.equal(classify({ ...r, overtime: 'sometimes' }), 'pending');
});
void test('keyword searches span product and supplier without inheriting supplier classification', () => {
  const brand = seed.companies[0];
  assert.equal(matches(brand, '键盘', seed), true);
  assert.equal(matches(brand, '砾石', seed), true);
  assert.equal(matches(seed.companies[3], '键盘', seed), true);
  assert.equal(matches(brand, '不存在', seed), false);
  assert.equal(companyBoard(brand.id, seed), 'red');
  assert.equal(companyBoard(seed.companies[3].id, seed), 'black');
});
void test('independent offline additions converge; repeated imports are idempotent', async () => {
  const a = await create('offline-a'),
    b = await create('offline-b');
  try {
    a.addCompany(company('a'), report('ar', 'a'));
    b.addCompany(company('b'), report('br', 'b'));
    const originalA = a.export(),
      originalB = b.export();
    a.import(originalB);
    b.import(originalA);
    a.import(b.export());
    a.import(b.export());
    assert.deepEqual(
      a
        .snapshot()
        .companies.map((c) => c.id)
        .sort(),
      b
        .snapshot()
        .companies.map((c) => c.id)
        .sort(),
    );
    assert.equal(a.snapshot().companies.length, seed.companies.length + 2);
    assert.equal(a.snapshot().reports.length, seed.reports.length + 2);
  } finally {
    await a.dispose();
    await b.dispose();
  }
});
void test('conflicting work reports are preserved and expose disagreement', async () => {
  const a = await create('conflict-a'),
    b = await create('conflict-b');
  try {
    a.add('companies', company('shared'));
    b.import(a.export());
    a.add('reports', report('positive', 'shared'));
    b.add('reports', {
      ...report('negative', 'shared'),
      daysOff: 1,
      hours: 12,
      shifts: 'two',
      overtime: 'often',
    });
    a.import(b.export());
    b.import(a.export());
    assert.equal(companyBoard('shared', a.snapshot()), 'conflict');
    assert.equal(
      a.snapshot().reports.filter((r) => r.companyId === 'shared').length,
      2,
    );
    assert.equal(companyBoard('shared', b.snapshot()), 'conflict');
  } finally {
    await a.dispose();
    await b.dispose();
  }
});
void test('product and supplier graph survives export/import together', async () => {
  const a = await create('graph-a'),
    b = await create('graph-b');
  try {
    a.add('companies', company('maker'));
    a.add('companies', company('supplier'));
    const ev = report('e', 'maker');
    a.add('products', {
      id: 'product',
      name: '测试键盘',
      category: '数码',
      companyId: 'maker',
      source: ev.source,
      date: ev.date,
      note: ev.note,
      author: ev.author,
    });
    a.add('supplies', {
      id: 'edge',
      productId: 'product',
      supplierId: 'supplier',
      component: '外壳',
      source: ev.source,
      date: ev.date,
      note: ev.note,
      author: ev.author,
    });
    b.import(a.export());
    assert.equal(
      b.snapshot().supplies.find((s) => s.id === 'edge')?.supplierId,
      'supplier',
    );
    assert.equal(matches(company('supplier'), '测试键盘', b.snapshot()), true);
  } finally {
    await a.dispose();
    await b.dispose();
  }
});
void test('unsafe URLs, invalid records, and dangling references are rejected atomically', async () => {
  assert.equal(safeUrl('javascript:alert(1)'), undefined);
  assert.equal(
    validEntry('reports', { ...report('x', 'c'), hours: -12 }),
    false,
  );
  const a = await create('invalid');
  try {
    const before = a.export();
    const evil = new Y.Doc();
    evil
      .getMap('products')
      .set('bad', {
        id: 'bad',
        companyId: 'missing',
        name: 'bad',
        category: 'x',
        source: '',
        date: '2026-09-01',
        note: 'test',
        author: 'x',
      });
    assert.throws(() => a.import(backup(evil)), /不存在/);
    assert.equal(Y.encodeStateAsUpdate(a.doc).length, fromBackupLength(before));
    assert.throws(() => a.import('{"format":"other"}'), /企见/);
    assert.throws(() => a.import('x'.repeat(1600000)), /过大/);
    evil.destroy();
  } finally {
    await a.dispose();
  }
});
function fromBackupLength(s: string) {
  return Buffer.from(JSON.parse(s).update, 'base64').length;
}
void test('remote changes cannot erase or replace existing evidence', async () => {
  const a = await create('immutable-a'),
    b = await create('immutable-b');
  try {
    a.add('companies', company('saved'));
    b.import(a.export());
    b.doc.getMap('companies').delete('saved');
    assert.throws(() => a.import(b.export()), /修改或删除/);
    assert.equal(
      a.snapshot().companies.some((c) => c.id === 'saved'),
      true,
    );
  } finally {
    await a.dispose();
    await b.dispose();
  }
});
void test('IndexedDB restores data after a store closes and reopens', async () => {
  const db = 'persist-' + crypto.randomUUID();
  const a = new LocalStore(db);
  await a.persistence!.whenSynced;
  a.add('companies', company('persistent'));
  await a.dispose();
  const b = new LocalStore(db);
  try {
    await b.persistence!.whenSynced;
    assert.equal(
      b.snapshot().companies.some((c) => c.id === 'persistent'),
      true,
    );
  } finally {
    await b.dispose();
  }
});
void test('same-origin tabs exchange updates automatically', async () => {
  const db = 'tabs-' + crypto.randomUUID();
  const a = new LocalStore(db),
    b = new LocalStore(db);
  try {
    await Promise.all([a.persistence!.whenSynced, b.persistence!.whenSynced]);
    const received = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('tab sync timeout')),
        3000,
      );
      b.listeners.add(() => {
        if (b.doc.getMap('companies').has('tab-company')) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    a.add('companies', company('tab-company'));
    await received;
    assert.equal(
      b.snapshot().companies.some((c) => c.id === 'tab-company'),
      true,
    );
  } finally {
    await a.dispose();
    await b.dispose();
  }
});
