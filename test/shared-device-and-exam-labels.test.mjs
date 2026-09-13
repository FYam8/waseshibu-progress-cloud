import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker=fs.readFileSync(new URL('../src/indexV7.js',import.meta.url),'utf8');
const dashboard=fs.readFileSync(new URL('../src/dashboard.js',import.meta.url),'utf8');

test('new device codes are subject-neutral while existing stored codes are untouched',()=>{
  assert.match(worker,/WS-/);
  assert.match(worker,/Existing device codes are preserved/);
  assert.doesNotMatch(worker,/UPDATE registrations SET device_code|DELETE FROM registrations|DROP TABLE/);
});

test('latest exam display keeps year and score validity context',()=>{
  assert.match(dashboard,/first-look':'初見/);
  assert.match(dashboard,/reference:'参考/);
  assert.match(dashboard,/String\(exam\.year\)\+'年 '/);
});

test('year cards use a consistent newest-to-oldest order',()=>{
  assert.match(dashboard,/const years=\[2026,2025,2024,2023,2022,2021,2020,2019\]/);
});
