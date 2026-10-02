import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SCHOOL_PROFILE } from '../src/deploymentProfile.js';

// Execute the existing projection functions without instantiating a Durable Object.
const source=fs.readFileSync(new URL('../src/indexV6.js',import.meta.url),'utf8');
const projection=source.slice(source.indexOf('function applyCurrentState('),source.indexOf('export default baseWorker;'));
const {applyCurrentState,mergeFormalState}=new Function('SCHOOL_PROFILE',projection+';return {applyCurrentState,mergeFormalState};')(SCHOOL_PROFILE);
const summary=kind=>[{source_record_id:'state:summary',occurred_at:'2026-10-02T10:00:00.000Z',payload:{total:3,kind,lastLearningAt:'2026-10-01T10:00:00.000Z'}}];

test('all existing targets override stale baseline labels without changing learning timestamps',()=>{
  for(const goal of [60,70,75]){
    const app={progressLabel:'stale'};
    applyCurrentState(app,summary(`target-${goal}`));
    assert.equal(app.progressLabel,`目標 ${goal}点`);
    assert.equal(app.lastLearningAt,'2026-10-01T10:00:00.000Z');
    assert.equal(app.recordCount,3);
  }
});
test('unknown target values cannot read inherited object properties',()=>{
  for(const kind of ['target-99','constructor','toString','__proto__','']){
    const app={progressLabel:'baseline'};
    applyCurrentState(app,summary(kind));
    assert.equal(app.progressLabel,'baseline');
  }
});
test('different production targets retain the existing mixed-target label',()=>{
  const a={recordCount:3,progressLabel:'目標 60点',years:{'2024':'done'}};
  const b={recordCount:4,progressLabel:'目標 70点',years:{'2025':'started'}};
  mergeFormalState(a,b);
  assert.equal(a.progressLabel,'端末ごとに目標が異なります');
  assert.equal(a.recordCount,7);
  assert.deepEqual(a.years,{'2024':'done','2025':'started'});
});
test('zero-count current state clears last-learning time, preserving reset semantics',()=>{
  const app={lastLearningAt:'2026-10-01T10:00:00.000Z'};
  applyCurrentState(app,[{...summary('target-60')[0],payload:{total:0,kind:'target-60'}}]);
  assert.equal(app.lastLearningAt,null);
  assert.equal(app.recordCount,0);
});
