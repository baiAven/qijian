import test from 'node:test';
import assert from 'node:assert/strict';
import companies from '../data/github-companies.json';
import manifest from '../data/github-import-manifest.json';
import { companyBoard, matches, seed, safeUrl } from '../lib/model';
import { validEntry } from '../lib/store';
void test('all source rows are accounted for after exact-name deduplication', () => {
  assert.equal(companies.length, 318);
  assert.equal(new Set(companies.map((c) => c.id)).size, 318);
  const counts: Record<string, number> = {};
  for (const c of companies)
    for (const g of c.github) counts[g.list] = (counts[g.list] || 0) + 1;
  assert.deepEqual(counts, manifest.sourceRows);
  assert.equal(
    Object.values(counts).reduce((a, b) => a + b, 0),
    331,
  );
});
void test('imported source provenance is pinned, dated, and never converted into verified work reports', () => {
  for (const c of companies) {
    assert.equal(companyBoard(c.id, seed), 'pending');
    assert(!seed.reports.some((r) => r.companyId === c.id));
    for (const g of c.github) {
      assert(safeUrl(g.url));
      assert.match(g.revision, /^[a-f0-9]{40}$/);
      assert(g.url.includes('/blob/' + g.revision + '/'));
      assert.match(g.url, /#L\d+$/);
      assert.equal(g.importedAt, '2026-09-08');
      assert(g.recordDate);
    }
  }
});
void test('imported company names and individual listed cities are searchable', () => {
  const microsoft = companies.find((c) => c.name === 'Microsoft')!;
  assert(microsoft);
  assert(matches(microsoft, 'Microsoft 苏州', seed));
  assert(companies.some((c) => c.name === 'IBM'));
  assert(!companies.some((c) => c.name === '苏州科技城'));
});
void test('bundled source identities cannot be impersonated by local or remote custom records', () => {
  assert.equal(validEntry('companies', companies[0]), false);
  assert.equal(
    validEntry('companies', {
      id: 'custom',
      name: 'x',
      city: 'x',
      industry: 'x',
      intro: 'x',
      github: [],
    }),
    false,
  );
});
