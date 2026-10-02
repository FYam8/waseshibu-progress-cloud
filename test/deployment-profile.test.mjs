import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
test('generated dashboard is identical to main 7a3f628 except equivalent Set string quotes',()=>{
  // Baseline: dashboardHtml('regression-nonce') at 7a3f6285ec5c2ead7006994fb839198736333bdc.
  // Normalize only new Set(['kokugo','math','english']) to its JSON-quoted equivalent.
  const html=dashboardHtml('regression-nonce');
  assert.equal(createHash('sha256').update(html).digest('hex'),'f11b32e16f7b949897d60b48e1dbdf9626816262ae38e2deb7d9e3973d573bdd');
  const script=html.match(/<script nonce="regression-nonce">([\s\S]*?)<\/script>/)[1];
  new vm.Script(script); // Catch invalid script serialization, independent of Worker bundling.
});
