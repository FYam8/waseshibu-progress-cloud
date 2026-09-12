import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base=fs.readFileSync(new URL('../src/indexV2.js',import.meta.url),'utf8');
const hardening=fs.readFileSync(new URL('../src/indexV3.js',import.meta.url),'utf8');
const dashboardWorker=fs.readFileSync(new URL('../src/indexV4.js',import.meta.url),'utf8');
const platformWorker=fs.readFileSync(new URL('../src/indexV5.js',import.meta.url),'utf8');
const platformConfig=fs.readFileSync(new URL('../src/platformConfig.js',import.meta.url),'utf8');
const dashboardUi=fs.readFileSync(new URL('../src/dashboard.js',import.meta.url),'utf8');
const source=`${base}\n${hardening}\n${dashboardWorker}\n${platformWorker}`;
const config=fs.readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');

test('worker exposes registration, sync and admin safety paths',()=>{
  for(const p of ['/v1/register-anonymous','/v1/enroll','/v1/events/batch','/v1/progress/snapshot','/v1/admin/registrations/revoke','/v1/admin/registrations/classify']) assert.match(source,new RegExp(p.replaceAll('/','\\/')));
  assert.match(source,/collection_disabled/);
});

test('shared platform accepts exactly the five subject app ids',()=>{
  for(const id of ['kokugo','math','english','listening','vocab'])assert.match(platformConfig,new RegExp(`${id}:`));
  assert.match(platformWorker,/APP_ID_SET\.has\(appId\)/);
  assert.match(platformWorker,/app_not_allowed/);
  assert.doesNotMatch(platformConfig,/science|social/);
});

test('shared payloads remain privacy allowlisted',()=>{
  assert.match(platformWorker,/EVENT_FIELDS/);
  assert.match(platformWorker,/SNAPSHOT_FIELDS/);
  assert.match(platformWorker,/payload_field_not_allowed/);
  assert.match(platformWorker,/invalid_payload_field/);
  assert.doesNotMatch(platformWorker,/acceptedAnswers|passageText|rawAnswer|answerText/);
});

test('kokugo backward compatibility remains in place',()=>{
  assert.match(base,/APP_ID='kokugo'/);
  assert.match(platformConfig,/kokugo/);
  assert.match(platformWorker,/baseWorker\.fetch/);
  assert.match(platformWorker,/BaseHouseholdProgress/);
});

test('anonymous registrations and unclassified traffic remain bounded',()=>{
  assert.match(source,/anonymous_registration_limited/);
  assert.match(source,/event_rate_limited/);
  assert.match(source,/retryable:true/);
  assert.match(source,/UNCLASSIFIED_DAILY_EVENT_BUDGET/);
  assert.match(source,/UNCLASSIFIED_TOTAL_EVENT_CAP/);
  assert.match(source,/unclassified_event_budget_limited/);
});

test('event quota checks and inserts stay in one Durable Object turn',()=>{
  const start=hardening.indexOf("url.pathname==='/internal/events'");
  const end=hardening.indexOf("url.pathname==='/internal/admin/summary'");
  const branch=hardening.slice(start,end);
  assert.ok(start>=0 && end>start);
  assert.doesNotMatch(branch,/super\.fetch\(request\)/);
  assert.match(branch,/INSERT INTO events/);
  assert.match(branch,/pendingByIdentity/);
});

test('admin dashboard is Access-protected and never exposes ADMIN_SECRET',()=>{
  assert.match(dashboardWorker,/cf-access-jwt-assertion/i);
  assert.match(dashboardWorker,/RSASSA-PKCS1-v1_5/);
  assert.match(dashboardWorker,/ACCESS_TEAM_DOMAIN/);
  assert.match(dashboardWorker,/ACCESS_AUD/);
  assert.match(dashboardWorker,/dashboard_not_configured/);
  assert.doesNotMatch(dashboardUi,/ADMIN_SECRET|x-admin-secret/i);
});

test('dashboard aggregates each subject independently and safely shows empty subjects',()=>{
  assert.match(platformWorker,/Object\.fromEntries\(APP_IDS\.map/);
  assert.match(platformWorker,/row\.app_id/);
  assert.match(platformWorker,/recordCount\+\+/);
  assert.match(platformWorker,/platform:'WaseShibu Progress Platform'/);
  for(const label of ['国語','数学','英語','リスニング','英単語'])assert.match(platformConfig,new RegExp(label));
  assert.match(dashboardUi,/WaseShibu Progress Admin/);
  assert.match(dashboardUi,/まだCloud同期していない教科は0件表示/);
});

test('formal progress remains production-only and revoked credentials cannot upload',()=>{
  assert.match(platformWorker,/WHERE r\.status='production'/);
  assert.match(hardening,/registration\.revoked_at/);
  assert.match(base,/if\(!r\|\|r\.revoked_at\)return json\(\{ok:false,code:'unauthorized'\},401\)/);
});

test('Durable Object schema is reused without destructive migration',()=>{
  assert.match(config,/indexV5\.js/);
  assert.match(config,/HouseholdProgress/);
  assert.match(config,/new_sqlite_classes/);
  assert.match(config,/ALLOWED_ORIGINS/);
  assert.doesNotMatch(platformWorker,/DROP TABLE|DELETE FROM registrations|DELETE FROM events|DELETE FROM snapshots/);
});
