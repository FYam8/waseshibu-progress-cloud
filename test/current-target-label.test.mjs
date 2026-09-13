import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const currentStateWorker=fs.readFileSync(new URL('../src/indexV6.js',import.meta.url),'utf8');

test('current-state target overrides stale baseline progress label',()=>{
  assert.match(currentStateWorker,/\^target-\(60\|70\|75\)\$/);
  assert.match(currentStateWorker,/app\.progressLabel=`目標 \$\{target\[1\]\}点`/);
});

test('formal aggregate does not claim one target when production devices differ',()=>{
  assert.match(currentStateWorker,/target\.progressLabel!==part\.progressLabel/);
  assert.match(currentStateWorker,/端末ごとに目標が異なります/);
});
