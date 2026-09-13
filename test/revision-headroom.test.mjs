import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const platformWorker=fs.readFileSync(new URL('../src/indexV5.js',import.meta.url),'utf8');

test('long-lived current-state records are not capped at 1000 revisions',()=>{
  assert.match(platformWorker,/MAX_REVISION=10_000_000/);
  assert.match(platformWorker,/revision>MAX_REVISION/);
  assert.doesNotMatch(platformWorker,/revision>1000/);
});
