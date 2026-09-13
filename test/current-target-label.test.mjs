import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const currentStateWorker=fs.readFileSync(new URL('../src/indexV6.js',import.meta.url),'utf8');
const dashboard=fs.readFileSync(new URL('../src/dashboard.js',import.meta.url),'utf8');

test('current-state target overrides stale baseline progress label',()=>{
  assert.match(currentStateWorker,/\^target-\(60\|70\|75\)\$/);
  assert.match(currentStateWorker,/app\.progressLabel=`目標 \$\{target\[1\]\}点`/);
});

test('formal aggregate does not claim one target when production devices differ',()=>{
  assert.match(currentStateWorker,/target\.progressLabel!==part\.progressLabel/);
  assert.match(currentStateWorker,/\^目標 \(60\|70\|75\)点\$/);
  assert.match(currentStateWorker,/端末ごとに目標が異なります/);
});

test('dashboard explains that current-state summary counts take precedence',()=>{
  assert.match(dashboard,/現在状態を送る教科ではその要約件数を優先/);
  assert.match(dashboard,/Snapshotの集計値は加算しません/);
});
