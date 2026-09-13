import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/indexV6.js',import.meta.url),'utf8');

test('revoked production registrations remain part of formal history',()=>{
  assert.match(source,/productionRegistrations=registrations\.filter\(reg=>String\(reg\.status\|\|''\)===['"]production['"]\)/);
  assert.doesNotMatch(source,/productionRegistrations=.*revoked_at|!reg\.revoked_at/);
  assert.match(source,/SELECT id,status,production_from,revoked_at FROM registrations/);
});

test('from-now boundary excludes earlier rows and cumulative current state',()=>{
  assert.match(source,/reg\.production_from&&String\(row\.occurred_at\)<String\(reg\.production_from\)/);
  assert.match(source,/reg\.production_from&&isCurrentStateRow\(row\)/);
  assert.match(source,/if\(reg\.production_from!=null\)continue/);
});

test('legacy and current-state registrations are merged independently',()=>{
  assert.match(source,/perRegistration=new Map/);
  assert.match(source,/applyCurrentState\(apps\[appId\],currentRows/);
  assert.match(source,/for\(const apps of perRegistration\.values\(\)\)/);
});

test('empty current state never renders epoch as learner activity',()=>{
  assert.match(source,/if\(total===0\)\{\s*app\.lastLearningAt=null/);
  assert.match(source,/Date\.parse\(reported\)>0/);
});

test('fix is non-destructive',()=>{
  assert.doesNotMatch(source,/DROP TABLE|DELETE FROM registrations|DELETE FROM events|DELETE FROM snapshots|storage\.deleteAll/);
});
