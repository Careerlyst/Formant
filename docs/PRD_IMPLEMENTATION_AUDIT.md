# Formant PRD Implementation Audit

**PRD baseline:** [`PRD.md`](PRD.md), version 0.1 Draft
**Audit date:** 2026-10-09
**Scope:** Repository source, documentation, and checked-in migrations. No production database, authenticated browser session, deployment, or live service was accessed for this audit.
**Files changed by this audit:** This audit document and `PRD.md` only.

## 1. Status and evidence interpretation

Statuses follow the PRD-creation brief:

- **VERIFIED COMPLETE** — the applicable requirement is supported by implementation evidence and all available verification in scope. This does not mean production certification.
- **PARTIALLY IMPLEMENTED** — some behavior exists, while an identified requirement path/gap remains.
- **MISSING** — the source does not implement the stated capability.
- **BROKEN** — source evidence shows the end-to-end path is inconsistent or intentionally cannot complete.
- **UNVERIFIED** — source exists, but sufficient behavior/permission/runtime evidence was not available.
- **NOT APPLICABLE** — requirement does not apply to the current product scope.

The repository has no test script and no unit, integration, or browser test files were found. The checks below are source/migration review, not end-to-end product verification. Several repository snapshots are dated 2026-10-01 and may be stale; source code and current migration files were preferred where they conflict.

## 2. Requirement-to-implementation audit

| ID | Requirement | Status | Evidence and remaining work |
|---|---|---|---|
| PUB-001 | Public product information and routes | UNVERIFIED | `src/main.jsx` registers public routes; `Home.jsx`, `PublicPages.jsx`, and `LegalPrivacy.jsx` contain page implementations. No browser journey/content validation performed. |
| CAT-001 | Publicly visible active service discovery | PARTIALLY IMPLEMENTED | `PublicPages.jsx` and `ServiceSelection.jsx` query active/show-on-page services; service detail has fallback logic. Validate live catalog, error fallback, aliases, and hidden/inactive behavior in a browser/database. |
| CAT-002 | Service details and active packages | PARTIALLY IMPLEMENTED | `ServiceDetail.jsx` queries `service_packages` for active package rows. `AdminServices.jsx` primarily edits `services`; end-to-end package authoring/public parity is not established. Validate all catalog IDs/data shapes. |
| CHECK-001 | Complete paid online order journey | MISSING (if accepted) | `ServiceDetail.jsx` explicitly pauses order placement; the checked-in `create_careerlyst_order` function raises before insert and authenticated execute is revoked. Purchase lifecycle remains a product-owner decision. |
| CHECK-002 | Fail closed until server-side payment verification | VERIFIED COMPLETE (migration source only) | `20260928184028_f05_service_visibility_and_order_safety.sql` validates service/package/price/currency, then raises before order insertion. Production function state was not checked. |
| AUTH-001 | Registration and sign-in | UNVERIFIED | `Auth.jsx` has Supabase sign-up/sign-in and demo flow; `Protected.jsx` resolves session before route access. No account-based browser tests were run. |
| AUTH-002 | Recovery, verification, Remember Me | UNVERIFIED | Source includes reset, resend, token handling, and preference logic; email provider/redirect behavior and session lifetime were not verified. |
| ASSESS-001 | Seven-step lead questionnaire and completion | UNVERIFIED | `LeadAssessment.jsx` defines seven questions, score/status logic, user-scoped drafts, metadata update and service-selection navigation. No completion/reload/scoring tests were run. |
| ASSESS-002 | Staff lead review of completed assessment | BROKEN | `LeadAssessment.jsx` writes Supabase Auth metadata; `AdminLeads.jsx` reads `profiles.lead_assessment`. Migration `20261007020000_profile_assessment_metadata_backfill.sql` is a one-time backfill, not ongoing synchronization. |
| PROF-001 | Client profile view/update with protected fields | UNVERIFIED | `Dashboard.jsx`, `profileRepository.js`, and profile migrations implement profile access; protected columns are excluded by the inspected save path/instructions. Live save, permission failures, and reload were not tested. |
| PROF-002 | Shared profile readiness indicator | PARTIALLY IMPLEMENTED | `profileCompletion.js` provides a common 3-item readiness model used by source. Older `ai/current-state.md` says 9 fields; the current product definition of “complete” is unresolved. |
| PROF-003 | Profile identity email | UNVERIFIED | `ai/known-issues.md` reports newly created `profiles.email` values as `NULL`; no live profile creation/trigger behavior was checked. Verify current data and the authoritative email projection before treating this as a confirmed production defect. |
| DASH-001 | Overview with meaningful current activity | PARTIALLY IMPLEMENTED | `Dashboard.jsx` reads orders from Supabase but unread message/file counts use local store state in the inspected code. Verify/count-source alignment and freshness. |
| ORD-001 | Client orders and project brief | UNVERIFIED | Orders query filters by signed-in user; brief reads/writes are present in `Dashboard.jsx`. Ownership, save, validation, and refresh behavior require authenticated tests. |
| ROAD-001 | Owned-order client-safe roadmap | UNVERIFIED | `get_my_order_roadmaps_v1` in migration source joins `orders` to `auth.uid()` and returns client titles/descriptions/progress. Need live cross-user, role, and display verification. |
| MSG-001 | Client/staff order conversations | UNVERIFIED | Client/admin pages and messaging migrations implement bounded thread reads, summaries, read receipts, and realtime subscriptions. No live message send/realtime/authorization test was run. |
| MSG-002 | Message replies, edits, deletion, attachments | UNVERIFIED | `MessageActions.jsx`, message components, and `20261006190000_message_replies_edits_deletes.sql` implement action paths. Verify role/sender restrictions, attachment cleanup, and storage policy at runtime. |
| FILE-001 | Client shared-file access | UNVERIFIED | Client files page lists message attachments from an ownership-scoped RPC and generates signed URLs. Real bucket access and cross-client denial were not tested. |
| PAY-001 | Client payment history | MISSING | `Dashboard.jsx` Payments renders a fixed “No payments yet” state; no query to payment records appears in this component. |
| NOTIF-001 | User-scoped notifications and read state | UNVERIFIED | Client Notifications queries by `user_id`, subscribes to inserts/updates, and updates `read_at`; live schema, RLS, and delivery were not verified. |
| SET-001 | Preferences, password change, push settings | PARTIALLY IMPLEMENTED | `Dashboard.jsx` has preference/password/push code. Theme is intentionally fixed to light. Verify settings persistence, real notification preference effect, password flow, and device push lifecycle. |
| ADMIN-001 | Staff user directory and roles/join dates | UNVERIFIED | `AdminUsersPage` uses the role and join-date RPCs and derives display/filter/count from mapped roles. RPC live ACL/result and counts were not rechecked in this audit. |
| ADMIN-002 | Staff order and project operations | PARTIALLY IMPLEMENTED | `AdminWorkspace.jsx` checks staff role and uses staff roadmap/workspace RPCs; `AdminProjects.jsx` also implements project operations. Full role matrix, all mutations, and production data integrity remain unverified. |
| ADMIN-003 | Staff service catalog administration | PARTIALLY IMPLEMENTED | `AdminServices.jsx` has service reads/mutations and staff check. Public package reads use `service_packages`; package CRUD/parity is not established. Verify effective production policies and public visibility behavior. |
| ADMIN-004 | Staff lead review | BROKEN | Same metadata/profile mismatch as ASSESS-002; see `AdminLeads.jsx` and migration backfill. Decide canonical source and implement/verify synchronization before claiming complete. |
| ADMIN-005 | Staff messaging and client context | UNVERIFIED | `AdminMessagesPage`, `AdminProjects.jsx`, and messaging migrations provide staff thread paths. Verify specific finance/support role restrictions and real-time behavior. |
| ADMIN-006 | Staff files/reviews/notifications/settings | UNVERIFIED | Module source exists (`Admin.jsx`, `AdminReviews.jsx`, `AdminNotifications.jsx`, `AdminSettings.jsx`). A rendered page does not prove persistence, delivery, authorization, or audit completeness; test each path. |
| ADMIN-007 | Coupon operations | MISSING | `/admin/coupons` renders `AdminSimple`; no coupon operation is implemented there. Whether coupons belong in scope is open. |
| SEC-001 | Keep service-role secret out of client | UNVERIFIED | Project instructions forbid exposure. This audit did not inspect secret-bearing `.env` values or scan the emitted bundle; no claim of secret scan is made. |
| SEC-002 | Backend-enforced authorization/RLS | UNVERIFIED | Several migrations define security-definer RPC checks and RLS-related changes; `supabase-schema.sql`/migrations are documented as incomplete. Production effective policies and grants require read-only live verification. |
| SEC-003 | Protect profile email/lead qualification fields | PARTIALLY IMPLEMENTED | Instructions and migrations protect columns; profile editor’s save path is designed around allowed values. Verify all update call sites and effective live grants. |
| SEC-004 | Authoritative role use | UNVERIFIED | Roles are represented in `user_roles`; several UI modules query it and directory roles use a narrow RPC. No live role mapping was checked. |
| SEC-005 | Consistent staff authorization on every admin route | PARTIALLY IMPLEMENTED | `/admin` uses `AdminGate`; many sub-routes are wrapped only by `Protected`. Some components self-check staff roles (`AdminWorkspace`, directory, services, reviews, etc.), but enforcement is not a single uniform router boundary; verify every route/data path. |
| SEC-006 | Client data isolation and visibility boundaries | UNVERIFIED | RPC/migration source includes order ownership and client-visible/shared filters. No adversarial two-client database/browser tests were run. |

## 3. Prioritized gaps and risk ranking

This ordering is **proposed**, not an approved product priority list. It reflects user impact, security/data integrity, and dependency order from the current evidence.

1. **Decide whether online purchase is required, then define its verified payment/order lifecycle.** The current failure-closed behavior is intentional and safe, but prevents a cloud customer from completing an inferred purchase journey. Do not weaken the safety gate before the provider, webhook verification, idempotency, and payment/order state machine are approved.
2. **Resolve assessment-to-lead visibility.** New assessment submissions and staff reads use different sources, leaving a documented broken end-to-end path. Decide the canonical record and secure write/sync mechanism before lead workflow improvements.
3. **Verify and standardize staff authorization.** Route definitions do not apply a common staff gate to all `/admin/*` pages, and per-page checks differ. Confirm role/action matrix and test direct URL plus direct API access before expanding staff functionality.
4. **Reconcile service and package administration with public catalog behavior.** Establish whether packages are managed as `service_packages` or another approved model and verify `active`, `show_on_services_page`, and `accept_orders` end-to-end.
5. **Verify the profile identity-email projection.** The repository records that new `profiles.email` values may be `NULL`; first inspect current profile-creation/sync behavior and live data, then decide whether a secure backend projection is required.
6. **Implement authoritative client payment history if required.** Current page cannot show payment records; dependency is the provider/payment lifecycle and client-safe data access.
7. **Close schema/migration reproducibility gaps.** Determine a reviewed schema baseline and ensure a clean local database can reproduce every table/RPC/policy the frontend requires, including the directory-role RPC dependency. This is an operational reliability dependency, not a user-facing feature.
8. **Add a repeatable verification suite.** No test infrastructure exists in `package.json` or repository file inventory. Prioritize coverage after product contracts and data paths are clarified.
9. **Clarify profile completion, service delivery SLAs, coupons, review submission, and notification preference semantics.** These are scope/definition gaps; avoid implementing assumptions.

## 4. Proposed implementation sequence

1. **Product decisions:** approve the open questions for payments/order state, lead source of truth, staff role matrix, service/package catalog, payment history, and success metrics. Confirm priorities and acceptance criteria.
2. **Security/data baseline:** read-only verify effective production schema, RPC ACLs, RLS, role records, and storage rules; reconcile migrations under a reviewed plan. No production mutation is implied by this audit.
3. **Critical journey contracts:** specify and verify auth -> assessment -> staff lead review; service discovery -> verified payment -> order; order -> roadmap/workspace -> client-visible delivery.
4. **Core implementation gaps:** resolve approved lead sync; complete the approved purchase path; harmonize service/package management; implement payment history if approved.
5. **Authorization assurance:** apply the approved staff access matrix consistently and add direct-route/API negative tests for client/unauthenticated users.
6. **Regression and NFR assurance:** introduce approved automated tests, then complete browser/device, accessibility, performance, privacy-retention, and recovery checks against owner-approved thresholds.
7. **Operational release:** only after review and explicit deployment authorization, stage and verify production changes. This PRD creation did not deploy anything.

## 5. Unverified evidence and limits

- No browser end-to-end tests or authenticated Supabase sessions were used for this audit.
- No production database metadata, data, RLS policy, RPC ACL, Storage policy, or deployment status was queried.
- Static migration files prove repository definitions, not that those exact versions are applied in production.
- `ai/current-state.md` is dated 2026-10-01 and includes status descriptions that conflict with current source or other docs; the implementation table favors inspected code and calls out the conflicts.
- No automated test script or test files were found. `npm run build` was not run as part of this document-only task.
- The exact effective permissions for all module actions, client retention/deletion rights, production notification delivery, checkout provider behavior, and all service workflows remain open.
