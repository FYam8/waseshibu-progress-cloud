# School profile extraction — first upstream change

## Status and scope

This PR is the first WaseShibu-owned step toward an isolated Rikkyo deployment.
It is not a completed shared platform release, a production deployment, or a
Rikkyo consumer pin. Main and all production resources are unchanged.

Baseline WaseShibu Progress Cloud main: `7a3f6285ec5c2ead7006994fb839198736333bdc`.

The shared Worker layers now read school configuration through
`src/deploymentProfile.js`. WaseShibu's profile owns app definitions, legacy
app ID, branding, years, target labels, new-device prefix, default origin,
Worker/object identity and Access audience. Authentication logic, quotas,
payload allowlists, registration handling, event revisions and all SQL remain
unchanged. Existing env overrides retain their original behavior. The build
check requires the versioned deployment config to match the profile.

`shared-manifest.json` hashes the shared JS modules. A future consumer must
vendor those modules from an immutable, production-verified upstream commit,
check its lock's repository and full SHA, and verify all manifest hashes.
Consumers supply their own deployment adapter/profile and wrangler config;
they must not modify the vendored shared code. No consumer lock is issued yet.

## Verified baseline observations (2026-10-02)

- Public WaseShibu `/health`: HTTP 200, five expected apps.
- Unauthenticated `/admin`: HTTP 302 to the configured Access team.
- Exact baseline main CI: success.
- Kokugo source is private `FYam8/waseshibu-source`, main
  `3b244d7abd2f53acfa335ef55a40229d6a7ae263`.
- Kokugo published repo is `FYam8/waseshibu-pages`, main
  `33688157f3959c03b6ab6357728567d87d9c6f41`; its deployment commit explicitly
  names the above source SHA. `waseshibu-kokugo` is empty.
- Rikkyo main SHAs: English `d29492a190d9b83d2e67dd5b23ce115f01fd94d2`,
  math `ea2cf573c34f2ec5c1fa7e9046656b282d669b2b`,
  kokugo `f263c49a506b863159cad19d6b486bc0ce268761`,
  vocabulary `778ca0ede5471393514aab9e02689a2ec7422b36`.
- `FYam8/rikkyo-uk-progress-cloud` returned 404 through the current connection;
  this does not prove absence under every possible account/access scope.
- Cloudflare dashboard is blocked in the available cloud browser by a security
  verification loop. No authenticated resource inventory, Access policy
  inspection, Worker source/version comparison or production-data comparison
  has been performed. Public health is not proof of an exact deployed SHA.

## Validation for this PR

- Existing static regressions plus generated-dashboard SHA parity against the
  baseline. Only equivalent quote serialization of the year-app Set is normalized.
- Target projection behavior, including all 60/70/75 labels, unknown/inherited
  property names, mixed targets, record counts and zero-count reset semantics.
- Deployment identity consistency and shared-file hash verification.
- Wrangler production bundle dry-run.
- Isolated local Worker runtime: public health, missing admin auth denied,
  registration, accepted/duplicate events, unknown app rejected, prohibited raw
  payload keys rejected, snapshot, production/ignored classification and revoke.
- These checks are not the requested full browser regression or CLEAN 1/CLEAN 2.

## Required next upstream work (before a Rikkyo consumer)

1. Add generic exam identity/summary contract support (`examId`, session and
   bounded progress counts) and school-configured projections/rendering.
   Keep official score and reference accuracy distinct. `FY26B HOLDOUT` must
   follow each subject's actual policy, not a blanket school assumption.
2. Extract a common transport from the WaseShibu English source, with shared
   credential lifecycle/outbox/deadletter and school-owned state projection.
   Preserve current WaseShibu registrations and storage. Integrate and test
   WaseShibu clients first; do not introduce a Rikkyo-only fork.
3. Test four-tab concurrent registration, offline/retry, malformed/partial server
   replies, ignored/revoked states, duplicate/revision handling and all resets,
   imports and exports. Keep cloud credentials out of portable learner backups.
4. Preserve the legacy Rikkyo kokugo registration/pending seed/outbox/seen state.
   Before copying credentials, verify their endpoint identity; never move a
   WaseShibu credential. Create the shared seed transactionally. Keep the legacy
   DB intact and record migration completion only after verified writes. If the
   destination already has a different registration, preserve both and surface
   the conflict; never silently overwrite either credential or Cloud history.
5. Complete WaseShibu browser regression and two consecutive CLEAN rounds,
   merge verified exact main, deploy and verify production, then pin that commit.
6. Only then create the separate Rikkyo Worker/DO/Access application and connect
   kokugo -> math -> English -> vocabulary. Validate no cross-school namespace,
   credentials or app identity. Rikkyo must not use WaseShibu Access audience.

## Retry finding correction

An initial static review of old layers suggested that `event_rate_limited`
could be put in deadletter. The active V3 DO layer returns HTTP 429 with
`retryable:true`, which current clients retain for retry. No production defect
was reproduced. Do not treat the older V2 rejection branch alone as evidence of
an active failure; test the full request chain before any retry change.

## Release gate

No WaseShibu data migration, DO identity change, SQL schema change, local learner
state write, Rikkyo integration, main merge or production deployment is included.
Actual Cloudflare account access remains necessary to finish the original task.
