import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker=fs.readFileSync(new URL('../src/indexV6.js',import.meta.url),'utf8');

test('from-now production does not formalize cumulative current-state rows',()=>{
  assert.match(worker,/function isCurrentStateRow/);
  assert.match(worker,/if\(reg\.production_from&&isCurrentStateRow\(row\)\)continue/);
  assert.match(worker,/if\(reg\.production_from!=null\)continue/);
});

test('device view still applies current state regardless of formal boundary',()=>{
  assert.match(worker,/for\(const device of data\.devices\|\|\[\]\)/);
  assert.match(worker,/applyCurrentState\(app,currentRows\(latest,device\.registrationId,app\.appId\)\)/);
});
