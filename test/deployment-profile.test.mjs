import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { SCHOOL_PROFILE } from '../src/deploymentProfile.js';
import { APP_CONFIG, APP_IDS } from '../src/platformConfig.js';
import { ACCESS_CONFIG } from '../src/accessConfig.js';
import { dashboardHtml } from '../src/dashboard.js';

test('deployed WaseShibu identities and app order are preserved',()=>{
  assert.equal(SCHOOL_PROFILE.workerName,'waseshibu-progress-api');
  assert.equal(SCHOOL_PROFILE.objectName,'family-main');
  assert.equal(SCHOOL_PROFILE.deviceCodePrefix,'WS-');
  assert.equal(SCHOOL_PROFILE.legacyAppId,'kokugo');
  assert.equal(SCHOOL_PROFILE.bindingName,'PROGRESS');
  assert.equal(SCHOOL_PROFILE.className,'HouseholdProgress');
  assert.deepEqual(APP_IDS,['kokugo','math','english','listening','vocab']);
  assert.equal(APP_CONFIG,SCHOOL_PROFILE.apps);
  assert.equal(ACCESS_CONFIG,SCHOOL_PROFILE.access);
  for(const value of [SCHOOL_PROFILE,SCHOOL_PROFILE.apps,SCHOOL_PROFILE.access,SCHOOL_PROFILE.years,SCHOOL_PROFILE.targets,...Object.values(APP_CONFIG)])assert.ok(Object.isFrozen(value));
});
test('dashboard preserves legacy score labels and adds summary-only sections',()=>{
  const html=dashboardHtml('regression-nonce');
  const script=html.match(/<script nonce="regression-nonce">([\s\S]*?)<\/script>/)[1];
  new vm.Script(script);
  const prefix=script.slice(0,script.indexOf("$('devices').addEventListener"));
  const context=vm.createContext({document:{getElementById(){return {};}}});
  vm.runInContext(prefix,context);
  assert.equal(vm.runInContext("examText({year:'2024',score:70,maxScore:80,kind:'first-look'})",context),'2024年 70/80点（初見）');
  assert.equal(vm.runInContext("examText(null)",context),'—');
  assert.match(html,/今日の学習状況/);
  assert.match(html,/未実施の断定ではありません/);
  assert.match(html,/Cloudへ同期済みの履歴だけ/);
});
