import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const worker = await readFile(new URL('../src/indexV8.js', import.meta.url), 'utf8');
const dashboard = await readFile(new URL('../src/dashboard.js', import.meta.url), 'utf8');
const wrangler = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8');

test('nickname storage is additive and does not alter learning-history keys', () => {
  assert.match(worker, /ALTER TABLE registrations ADD COLUMN nickname TEXT/);
  assert.match(worker, /UPDATE registrations SET nickname=\? WHERE id=\?/);
  assert.doesNotMatch(worker, /DELETE FROM events|DELETE FROM snapshots|UPDATE events SET|UPDATE snapshots SET/);
});

test('dashboard exposes nickname set/change/clear flow', () => {
  assert.match(dashboard, /Nickname設定/);
  assert.match(dashboard, /Nickname変更/);
  assert.match(dashboard, /\/admin\/api\/nickname/);
  assert.match(dashboard, /空欄で保存するとNicknameを解除/);
});

test('nickname worker is the configured entry point', () => {
  assert.match(wrangler, /"main": "src\/indexV8\.js"/);
});
