import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker=fs.readFileSync(new URL('../src/indexV9.js',import.meta.url),'utf8');
const dashboard=fs.readFileSync(new URL('../src/dashboard.js',import.meta.url),'utf8');

test('uses only Cloudflare connecting IP and validates the value',()=>{
  assert.match(worker,/request\.headers\.get\('cf-connecting-ip'\)/);
  assert.match(worker,/ip\.length>45/);
  assert.match(worker,/\^\[0-9a-f:\.\]\+\$/i);
  assert.doesNotMatch(worker,/x-forwarded-for|true-client-ip/i);
});

test('passes the validated IP only to internal Durable Object JSON requests',()=>{
  assert.match(worker,/typeof init\.body!==['"]string['"]/);
  assert.match(worker,/JSON\.parse\(init\.body\)/);
  assert.match(worker,/JSON\.stringify\(\{\.\.\.body,lastIp\}\)/);
});

test('stores the most recent IP without deleting learning data',()=>{
  assert.match(worker,/ALTER TABLE registrations ADD COLUMN last_ip TEXT/);
  assert.match(worker,/UPDATE registrations SET last_ip=\? WHERE id=\?/);
  assert.match(worker,/UPDATE registrations SET last_ip=\? WHERE credential_hash=\?/);
  assert.doesNotMatch(worker,/DROP TABLE|DELETE FROM registrations|DELETE FROM events|DELETE FROM snapshots/);
});

test('returns the last IP to the protected dashboard summary',()=>{
  assert.match(worker,/internal\/admin\/dashboard-summary/);
  assert.match(worker,/SELECT id,last_ip FROM registrations/);
  assert.match(worker,/device\.lastIp=/);
  assert.match(dashboard,/d\.lastIp\|\|['"]未取得['"]/);
  assert.match(dashboard,/最終アクセス.*IP.*Cloud学習記録/);
});
