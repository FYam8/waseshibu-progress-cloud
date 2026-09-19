import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ACCESS_CONFIG } from '../src/accessConfig.js';

test('Cloudflare Access identifiers are versioned and canonical', () => {
  assert.equal(ACCESS_CONFIG.teamDomain, 'https://fyam8.cloudflareaccess.com');
  assert.equal(ACCESS_CONFIG.audience, 'a3aedeb57c70a1a92916bc9d6e642daa520319bcf77c876ace8e837df8cd0244');
  assert.ok(Object.isFrozen(ACCESS_CONFIG));
});

test('admin authentication cannot silently fall back to mutable Worker secrets', async () => {
  const source = await readFile(new URL('../src/indexV4.js', import.meta.url), 'utf8');
  assert.match(source, /ACCESS_CONFIG\.teamDomain/);
  assert.match(source, /ACCESS_CONFIG\.audience/);
  assert.doesNotMatch(source, /env\.ACCESS_TEAM_DOMAIN/);
  assert.doesNotMatch(source, /env\.ACCESS_AUD/);
  assert.match(source, /access_validation_failed/);
  assert.match(source, /dashboard_request_failed/);
});

test('dashboard presents actionable authentication errors', async () => {
  const source = await readFile(new URL('../src/dashboard.js', import.meta.url), 'utf8');
  assert.match(source, /access_required:'認証セッションが切れています/);
  assert.match(source, /access_invalid:'認証情報を確認できませんでした/);
  assert.match(source, /dashboard_error:'進捗データの集計に失敗しました/);
});
