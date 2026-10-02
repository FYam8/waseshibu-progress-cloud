import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProgressFields, applyProgressSummary, mergeProgressSummary } from '../src/progressContract.js';
import { createProgressFormatter } from '../src/dashboardFormatting.js';
import { SCHOOL_PROFILE } from '../src/deploymentProfile.js';
const profile={apps:{reading:{supportsYears:true}},exams:[{id:'2024-A',label:'2024 A',year:2024,session:'A'},{id:'2024-B',label:'2024 B',year:2024,session:'B'}]};
const payload={progressVersion:2,examId:'2024-A',year:'2024',session:'A',correct:23,total:30,referenceAccuracy:77,examStatus:'done'};
const check=p=>validateProgressFields(p,profile,'reading');
test('v1 remains valid and v2 preserves separate exam identity and reference accuracy',()=>{
  assert.equal(validateProgressFields({year:'2024',score:70},SCHOOL_PROFILE,'english').ok,true);
  assert.equal(check(payload).ok,true);
  for(const patch of [{progressVersion:1},{examId:'2024-X'},{year:'2025'},{session:'B'},{referenceAccuracy:90},{correct:31},{total:0},{score:77},{rawVersion:2,weaknessCount:-1},{reviewDue:1.5},{foundationMastered:4,foundationTotal:3}])assert.equal(check({...payload,...patch}).ok,false,JSON.stringify(patch));
  assert.equal(validateProgressFields(payload,SCHOOL_PROFILE,'english').code,'exam_not_allowed');
});
test('v2 state does not merge A and B or leak sync timestamp into last learning',()=>{
  const app={appId:'reading',lastLearningAt:'2026-10-01T12:00:00Z'};
  applyProgressSummary(app,[
    {source_record_id:'state:exam:2024-A',payload},
    {source_record_id:'state:exam:2024-B',payload:{progressVersion:2,examId:'2024-B',examStatus:'holdout'}},
    {source_record_id:'state:summary',payload:{progressVersion:2,weaknessCount:3,retentionPending:2}},
    {source_record_id:'state:latest-exam',occurred_at:'2026-10-01T12:00:00Z',payload:{...payload,completed:true}},
  ],profile);
  assert.equal(app.exams['2024-A'].status,'done');assert.equal(app.exams['2024-B'].status,'holdout');
  assert.equal(app.latestExam.score,undefined);assert.equal(app.latestExam.correct,23);
  assert.deepEqual(app.progressMetrics,{weaknessCount:3,retentionPending:2});
  assert.equal(app.lastLearningAt,'2026-10-01T12:00:00Z');
  const aggregate={};mergeProgressSummary(aggregate,app);assert.equal(aggregate.exams['2024-B'].status,'holdout');
});
test('reference results cannot look like official points and zero denominators are unknown',()=>{
  const fmt=createProgressFormatter(profile.exams);
  assert.equal(fmt.referenceExam(payload),'2024 A 23 / 30問・参考正答率 77%');
  assert.equal(fmt.referenceExam({...payload,total:0}),'—');
  assert.doesNotMatch(fmt.referenceExam(payload),/点/);
  const html=fmt.extra({exams:{'2024-A':{status:'done'},'2024-B':{status:'holdout'}}});
  assert.match(html,/2024 A/);assert.match(html,/2024 B/);assert.match(html,/HOLDOUT/);
});
test('today distinguishes missing sync, past learning, future clocks and same-day learning',()=>{
  const fmt=createProgressFormatter([]),now=new Date(2026,9,2,18,0);
  assert.equal(fmt.today(new Date(2026,9,2,10,0).toISOString(),now),'✅ 今日');
  assert.equal(fmt.today(new Date(2026,9,1,23,59).toISOString(),now),'今日の記録なし');
  assert.equal(fmt.today(null,now),'未同期');
  assert.equal(fmt.today(null,now,{hasSyncedProgress:true,hasLearningRecords:true}),'学習日時不明');
  assert.equal(fmt.today(null,now,{hasSyncedProgress:true,hasLearningRecords:false}),'今日の記録なし');
  assert.equal(fmt.today('1970-01-01T00:00:00.000Z',now,{recordCount:2}),'学習日時不明');
  assert.equal(fmt.today(new Date(2026,9,3).toISOString(),now),'学習日時を確認');
});

test('WaseShibu legacy English summaries show metrics without rewriting saved records',()=>{
  const rows=[{source_record_id:'state:weakness',payload:{total:7,correct:3}},{source_record_id:'state:retention',payload:{total:2}},{source_record_id:'state:drill',payload:{total:9}}];
  const original=JSON.stringify(rows),app={appId:'english'};
  applyProgressSummary(app,rows,SCHOOL_PROFILE);
  assert.deepEqual(app.progressMetrics,{weaknessCount:4,masteredCount:3,retentionPending:2,practiceCount:9});
  assert.equal(JSON.stringify(rows),original);
});
