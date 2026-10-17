# Formant Product Requirements Document

**Version:** 0.1
**Status:** Draft for product-owner review
**Created:** 2026-10-09
**Product:** Formant (formerly Careerlyst)
**Source of truth:** This is the first consolidated PRD, derived from repository evidence. It is not an approved expansion of product scope. Only items marked **CONFIRMED DECISION** reflect an existing documented decision or mandatory project instruction. Other requirements retain their evidence classification and remain subject to review.

## 1. Purpose and evidence rules

This document consolidates product intent and requirements that can be traced to the repository. It distinguishes product decisions from observed implementation and from assumptions. It does not claim customer research, operational validation, or production certification that is not present in the repository.

Evidence classifications:

- **CONFIRMED DECISION** — explicitly recorded in `ai/decisions.md` or mandatory project rules in `ai/instructions.md`.
- **VERIFIED BEHAVIOR** — supported by inspected source, migration SQL, route configuration, or a test result. Source inspection alone does not certify live production behavior.
- **INFERRED** — a reasonable product interpretation of the project description or implementation, not an approved requirement.
- **OPEN QUESTION** — evidence is insufficient to settle the requirement or expected behavior.
- **KNOWN ISSUE** — a documented or source-supported defect, limitation, or risk.

Implementation-status labels are maintained separately in [`PRD_IMPLEMENTATION_AUDIT.md`](PRD_IMPLEMENTATION_AUDIT.md). Priorities are **Undecided** unless an existing source explicitly assigns them. Proposed acceptance criteria make requirements testable; they are not claimed as pre-existing approval.

## 2. Product overview and documented intent

The README describes Formant as a career development and professional-profile service platform intended to help professionals accelerate job searches and improve career positioning through tailored work. Its named service areas are Resume/CV, LinkedIn, GitHub, portfolio, cover letters, and interview preparation. The product includes a public marketing and service-discovery surface, account/onboarding flows, a client dashboard, and a staff operations workspace.

This is a repository-grounded product description, not evidence of market validation or an approved future roadmap. No PRD, customer research, business KPI specification, or complete acceptance-test specification was found in the repository.

## 3. Problem statement and user needs

### Documented facts

- The product presents tailored career services to prospective clients (`README.md`, `ai/current-state.md`).
- The client experience includes profile data, orders and delivery progress, messages, shared files, notifications, and account settings (`README.md`, `docs/PROJECT_STRUCTURE.md`, routes and page source).
- Staff need operational views for users, leads, orders/projects, services, messaging, files, reviews, notifications, and settings (`docs/PROJECT_STRUCTURE.md`, `src/main.jsx`).

### Assumptions and limitations

- That prospective clients need to complete a service purchase online is **INFERRED** from the service catalog and checkout UI. Current source intentionally prevents Supabase order creation until payment can be verified.
- That lead qualification is expected to feed a usable staff sales pipeline is described by `ai/known-issues.md`, but its record-of-truth and synchronization behavior are unresolved.
- No interview, survey, analytics, support-ticket, or usability-study evidence was found. User needs beyond the above are **OPEN QUESTION**.

## 4. Target users and roles

| User/role | Evidence and intended relationship | Confidence |
|---|---|---|
| Visitor / prospective client | Views public product and service information; may enter the assessment and account flows. | VERIFIED BEHAVIOR in routes; user motivation is INFERRED |
| Client | Authenticated service recipient using profile, orders, progress, messaging, files, notifications, and settings. | VERIFIED BEHAVIOR in routes/source; product description in README |
| Admin | Staff role with broad directory, service, order, and workspace access. | CONFIRMED role vocabulary; actual authorization varies by module |
| Expert | Staff role involved in delivery operations and messaging. | CONFIRMED role vocabulary; detailed responsibility boundaries partly inferred |
| Support | Staff role involved in client support and operational messaging. | CONFIRMED role vocabulary; detailed responsibility boundaries partly inferred |
| Finance | Staff role with financial/operational visibility; some workspace actions are read-only by source. | CONFIRMED role vocabulary; full permission matrix is OPEN QUESTION |

`public.user_roles` is the role source identified by project docs and migrations. User-facing permissions must not be inferred from role names alone; several modules implement different role-specific actions.

## 5. Product goals and success measures

### Documented goals

1. Help professionals accelerate their job search and improve career positioning through tailored career services. **VERIFIED product statement** in README/current-state docs.
2. Provide clients a place to manage service work and communicate with the team. **VERIFIED product statement** in README/current-state docs and supported by route/source structure.
3. Provide staff an operations workspace for managing clients and service delivery. **VERIFIED product statement** in project documentation and routes.

### Metrics

No approved measurable targets, analytics events, conversion targets, service-delivery SLAs, retention goals, satisfaction thresholds, or accessibility/performance budgets were found. The following are **OPEN QUESTIONS**, not requirements: assessment completion, service-selection conversion, paid-order conversion, time to first staff response, on-time delivery, client satisfaction, and repeat-service rate.

## 6. Scope

### Repository-supported product areas

- Public marketing, service discovery, service details, and pricing.
- Authentication and account recovery.
- Seven-step lead assessment and service-selection transition.
- Client profile, orders and roadmap, messages, files, payments page, notifications, and settings.
- Staff workspace and modules for users, leads, orders/projects, services, messaging, files, reviews, notifications, and settings.
- Supabase cloud mode and local demo-store mode as an architectural decision.

### Explicit constraints / currently unavailable capabilities

- **CONFIRMED DECISION:** Do not create a live order until a payment has been verified. The current database function fails closed; a payment gateway/webhook is not implemented in the inspected repository.
- **CONFIRMED DECISION:** Keep the local demo store and legacy Careerlyst identifiers backward-compatible; do not rename them without a migration strategy.
- **CONFIRMED DECISION:** Keep the Formant light-only design system and existing design tokens.
- **CONFIRMED SECURITY CONSTRAINT:** Do not expose a service-role secret, weaken RLS, or let clients mutate protected profile email/lead-qualification columns.

No broader explicit product exclusions were found. The current checkout block is a limitation, not evidence that purchasing is permanently out of scope.

## 7. Core user journeys

The entry and exit conditions below are reconstructed from route/source evidence. Where a business outcome is not explicit, it is marked inferred.

1. **Discover a service:** visitor opens public marketing/services, reviews a service and package, then may choose a next action. Entry: public route. Exit: service detail or service-selection route. Purchase is currently blocked in cloud mode.
2. **Create/sign into an account:** visitor signs up or logs in; auth/session handling directs the user according to account metadata/role. Entry: `/signup` or `/login`. Exit: authenticated client or staff destination. End-to-end behavior is not browser-verified in this audit.
3. **Qualify a lead:** visitor completes the seven-step assessment; draft data is user-scoped in local storage when applicable; completion writes assessment metadata when Supabase is configured and moves to `/service-selection`. Staff review is intended by the lead module, but ongoing metadata-to-profile synchronization is unresolved.
4. **Manage client profile:** authenticated client views and updates career/profile data and sees a profile-completion model. Entry: `/dashboard/profile`. Exit: saved profile or validation feedback. Protected identity/lead fields are excluded from editable update payloads by project rules.
5. **Follow service delivery:** client opens owned orders, views available client-safe progress, order-specific delivery context and project brief, then communicates or opens the relevant service. Entry: `/dashboard/orders`. Server-side ownership is enforced by the client roadmap RPC in migration source.
6. **Communicate and exchange files:** client and staff select an order conversation, send text/attachments, receive updates and manage eligible message actions. Entry: client/admin messages routes. Exact realtime and storage behavior remains unverified at runtime.
7. **Operate service delivery:** authorized staff review users, orders, project context, roadmap, messages, files, and other operational modules. Entry: `/admin/*`; role checks exist in several individual modules, but router-level gating is inconsistent.

## 8. Functional requirements

All priorities are **Undecided** unless otherwise noted. Criteria tagged **proposed** need product-owner acceptance. Source implementation status is not a production test result.

### Public site and service catalog

#### PUB-001 — Public product information
- **Requirement:** Present Formant’s product/service information and public pages using the existing Formant brand.
- **Outcome:** Visitors can understand the service offering and reach relevant public pages.
- **Evidence / confidence:** README, `src/main.jsx`, `src/pages/Home.jsx`, `src/pages/PublicPages.jsx`; VERIFIED BEHAVIOR from source.
- **Priority:** Undecided. **Dependencies:** routes, public content/assets.
- **Acceptance (proposed):** Each registered public route loads its intended page; links resolve; unavailable routes show an intentional not-found or fallback experience.
- **Current implementation:** Source present; runtime/content accuracy UNVERIFIED.

#### CAT-001 — Visible service discovery
- **Requirement:** Show active services intended for the public service page and allow navigation to service details.
- **Outcome:** Visitors can browse available offerings.
- **Evidence / confidence:** `PublicPages.jsx`, `ServiceSelection.jsx`, `ServiceDetail.jsx`; service queries filter `active` and `show_on_services_page`; VERIFIED BEHAVIOR from source.
- **Priority:** Undecided. **Dependencies:** `services`, `service_packages`, fallback catalog, service visibility policies.
- **Acceptance (proposed):** Hidden/inactive services are not offered publicly; visible services resolve to their correct detail page; load failures are presented without fabricated catalog data.
- **Current implementation:** Partly implemented in source; admin/public data parity and live behavior UNVERIFIED.

#### CAT-002 — Service detail and packages
- **Requirement:** Present service information, available active packages, and their price/currency.
- **Outcome:** Visitors can compare the available service package options.
- **Evidence / confidence:** `ServiceDetail.jsx` queries `service_packages` and renders package content; VERIFIED BEHAVIOR from source.
- **Priority:** Undecided. **Dependencies:** service/package schema and service catalog.
- **Acceptance (proposed):** Package name, description, active state, sort order, price, and currency match the authoritative record; unavailable services/packages have a clear state.
- **Current implementation:** Source present; runtime/database parity UNVERIFIED.

#### CHECK-001 — Online order placement
- **Requirement:** Allow a prospective client to place an order for a selected service/package after the agreed payment lifecycle completes.
- **Outcome:** A client can convert service selection into a real service order.
- **Evidence / confidence:** INFERRED from the commercial service catalog/checkout UI and the expected behavior recorded in `ai/known-issues.md`; no approved purchase lifecycle or provider decision was found.
- **Priority:** Undecided. **Dependencies:** product-owner decision on payment lifecycle, provider, webhook verification, order persistence and refunds.
- **Acceptance (proposed):** A successful verified payment results in exactly one correctly priced owned order and payment record; failed/unverified payment creates no paid/active order; retries are idempotent.
- **Current implementation:** MISSING in cloud mode; order creation is intentionally disabled. Whether this is a release requirement is OPEN QUESTION.

#### CHECK-002 — Fail closed before payment verification
- **Requirement:** Do not create a live order before payment has been verified server-side.
- **Outcome:** Prevent unpaid/unverified orders from entering delivery operations.
- **Evidence / confidence:** CONFIRMED DECISION in `ai/decisions.md` and `20260928184028_f05_service_visibility_and_order_safety.sql`.
- **Priority:** Undecided. **Dependencies:** backend order function and payment verification path.
- **Acceptance (proposed):** Invalid service/package/price/currency are rejected; when payment verification is unavailable, no order row is inserted.
- **Current implementation:** VERIFIED in the checked-in migration definition; production function state was not queried for this document.

### Authentication and onboarding

#### AUTH-001 — Account registration and sign-in
- **Requirement:** Support client/staff sign-up and password sign-in through Supabase Auth, with demo-mode behavior where configured.
- **Outcome:** Users can access their appropriate authenticated experience.
- **Evidence / confidence:** `Auth.jsx`, `Protected.jsx`, `supabase.js`, README; VERIFIED BEHAVIOR from source.
- **Priority:** Undecided. **Dependencies:** Supabase Auth, profile/role records, local demo store.
- **Acceptance (proposed):** Valid credentials reach the correct destination; invalid credentials receive actionable feedback; protected pages do not render before session resolution.
- **Current implementation:** Source present; authentication/session journeys UNVERIFIED in browser.

#### AUTH-002 — Account recovery, verification, and session preference
- **Requirement:** Provide password recovery/reset, email verification support, and the documented Remember Me behavior.
- **Outcome:** Users can recover access and control session persistence as described by the UI.
- **Evidence / confidence:** `Auth.jsx`, `ResendLink.jsx`, `supabase.js`; Remember Me is a CONFIRMED DECISION in `ai/decisions.md`.
- **Priority:** Undecided. **Dependencies:** Supabase Auth email configuration and redirect URLs.
- **Acceptance (proposed):** Reset/verification links complete the correct auth flow; resend cooldown is enforced; remember preference matches persistence after reload/tab close.
- **Current implementation:** Source present; email provider and full flow UNVERIFIED.

#### ASSESS-001 — Seven-step lead qualification
- **Requirement:** Ask the documented seven questions, calculate the existing score/status, retain an in-progress draft, and save completion using the current metadata contract.
- **Outcome:** Capture the prospective client’s stated needs and readiness.
- **Evidence / confidence:** `LeadAssessment.jsx`; seven question definitions and metadata persistence are VERIFIED in source. The existence of the assessment is documented in README/current-state.
- **Priority:** Undecided. **Dependencies:** assessment schema/version, Auth metadata, local draft storage.
- **Acceptance (proposed):** A draft resumes for the same user only; completion records its answers, score, status, timestamp, and version; completion moves to `/service-selection`.
- **Current implementation:** Source present; persistence and scoring accuracy not independently tested.

#### ASSESS-002 — Staff lead review
- **Requirement:** Staff can review and qualify completed assessments. This is stated as the expected outcome in the known-issues register, but the canonical lead record/source of truth is not decided.
- **Outcome:** Staff can act on qualified prospective clients.
- **Evidence / confidence:** KNOWN ISSUE in `ai/known-issues.md`; `LeadAssessment.jsx` writes Auth metadata while `AdminLeads.jsx` reads `profiles.lead_assessment`; a migration backfills existing metadata only.
- **Priority:** Undecided. **Dependencies:** product decision on source of truth and secure synchronization.
- **Acceptance (proposed):** A new assessment becomes visible to authorized staff with consistent answers/score/status and cannot be changed by client-side writes to protected fields.
- **Current implementation:** BROKEN for ongoing end-to-end synchronization according to source; production data behavior not runtime-verified.

### Client workspace

#### PROF-001 — Client career profile
- **Requirement:** Let a client view and update the documented personal/career profile fields, while keeping account email and lead-qualification fields protected.
- **Outcome:** Staff and service work can use current client context.
- **Evidence / confidence:** `Dashboard.jsx`, `profileRepository.js`, `profileCompletion.js`, profile migrations; protected-field rule is CONFIRMED in `ai/instructions.md`.
- **Priority:** Undecided. **Dependencies:** profiles source of truth, column permissions, Auth identity.
- **Acceptance (proposed):** Saved editable fields persist after reload; invalid fields are identified; email/lead fields cannot be edited through profile writes.
- **Current implementation:** Source/migrations present; live save and permissions UNVERIFIED here.

#### PROF-002 — Profile readiness indicator
- **Requirement:** Show completion based on the current shared readiness model.
- **Outcome:** Clients can identify core profile details still needed.
- **Evidence / confidence:** `profileCompletion.js` currently calculates from name, target role, and experience-or-education; VERIFIED BEHAVIOR from source. This differs from older “9-field completion” descriptions in `ai/current-state.md`.
- **Priority:** Undecided. **Dependencies:** profile data model.
- **Acceptance (proposed):** Dashboard and profile editor show the same percentage and missing fields for the same profile.
- **Current implementation:** Source has a shared 3-item model; product definition of “complete” is OPEN QUESTION.

#### PROF-003 — Profile identity email
- **Requirement:** Keep the profile’s displayed/read-only email consistent with the verified Auth identity where the product uses the profile email.
- **Outcome:** Clients and staff see a reliable contact identity.
- **Evidence / confidence:** KNOWN ISSUE in `ai/known-issues.md` reports newly created `profiles.email` values as `NULL` and records the expected Auth-email projection; no live trigger inspection was performed.
- **Priority:** Undecided. **Dependencies:** Auth user email and a secure profile-creation/synchronization path.
- **Acceptance (proposed):** For a newly registered account, the read-only profile/admin directory email matches the Auth email after profile creation and refresh; clients cannot directly change the protected value.
- **Current implementation:** UNVERIFIED; known issue report requires current live verification.

#### DASH-001 — Client overview
- **Requirement:** Provide an overview of active work, unread messages, files, profile readiness, and links to relevant dashboard tasks.
- **Outcome:** Clients can orient themselves in the workspace.
- **Evidence / confidence:** `Dashboard.jsx` and `/dashboard` route; VERIFIED BEHAVIOR from source.
- **Priority:** Undecided. **Dependencies:** profile, orders, messages/files state.
- **Acceptance (proposed):** Displayed counts match their underlying sources; empty/loading/error states do not fabricate activity.
- **Current implementation:** Source present; data freshness and cross-source consistency UNVERIFIED.

#### ORD-001 — Client orders and project brief
- **Requirement:** Show a client’s own orders, status, package/price, and project brief access; permit editing/submission of the brief where supported.
- **Outcome:** Clients can find their service work and provide required context.
- **Evidence / confidence:** `Dashboard.jsx` Orders component, orders query filters by signed-in user, `project_briefs` access; VERIFIED BEHAVIOR in source.
- **Priority:** Undecided. **Dependencies:** order ownership, project brief schema and permissions.
- **Acceptance (proposed):** Only owned orders are shown; brief reads/writes are associated with the selected owned order; order and brief errors are visible.
- **Current implementation:** Source present; live ownership and save flow UNVERIFIED.

#### ROAD-001 — Client-safe service roadmap
- **Requirement:** Show the existing service-specific stage, server-returned progress, and client-safe updates for owned orders.
- **Outcome:** Clients understand progress and what is current/next.
- **Evidence / confidence:** `get_my_order_roadmaps_v1` in `20261009100000_service_delivery_roadmaps.sql` filters orders by `auth.uid()` and returns client-facing fields; client Orders source calls it. VERIFIED BEHAVIOR from migration/source.
- **Priority:** Undecided. **Dependencies:** service workflow mappings, roadmap rows, authenticated client role.
- **Acceptance (proposed):** Progress matches RPC output; a client receives only owned orders; no internal notes/reasons are displayed; missing roadmaps do not create fake progress.
- **Current implementation:** Source and migration present; cross-user/security runtime verification is UNVERIFIED in this document.

#### MSG-001 — Client/staff order messaging
- **Requirement:** Provide order-scoped conversation between clients and authorized staff, with unread/read state and bounded history.
- **Outcome:** Client and operations team can coordinate service delivery.
- **Evidence / confidence:** client and admin messaging components, `messageRealtime.js`, migrations for summaries, page reads, and read receipts; VERIFIED BEHAVIOR from source/migration.
- **Priority:** Undecided. **Dependencies:** owned orders, message RPCs, RLS, Realtime configuration.
- **Acceptance (proposed):** Only authorized parties can read a thread; unread/read state is consistent; older history can be paged; disconnected/realtime errors remain understandable.
- **Current implementation:** Substantial source/migration implementation; live messaging and realtime behavior UNVERIFIED.

#### MSG-002 — Message actions and attachments
- **Requirement:** Support the existing sender edit/delete/reply behavior and message attachments where allowed by role/policy.
- **Outcome:** Users can correct, contextualize, or share conversation content.
- **Evidence / confidence:** `MessageActions.jsx`, client/admin message pages, `20261006190000_message_replies_edits_deletes.sql`; VERIFIED BEHAVIOR in source/migration.
- **Priority:** Undecided. **Dependencies:** message action RPCs, attachment storage, message authorization.
- **Acceptance (proposed):** Only permitted senders can edit/delete their own eligible messages; reply targets remain authorized; attachment upload/download/removal follows message ownership and staff permissions.
- **Current implementation:** Source/migration present; storage and cross-role runtime tests UNVERIFIED.

#### FILE-001 — Client deliverable/file access
- **Requirement:** List and open files shared through the client’s own project conversations.
- **Outcome:** Clients can access shared deliverables and attachments.
- **Evidence / confidence:** `Dashboard.jsx` Files and signed storage URLs; `list_client_message_attachments_v1` migration; VERIFIED BEHAVIOR from source/migration.
- **Priority:** Undecided. **Dependencies:** owned orders/messages, Storage bucket and policies.
- **Acceptance (proposed):** A client sees only their order attachments; valid files open through expiring signed URLs; missing or unauthorized files fail safely.
- **Current implementation:** Source/migration present; real storage access and ownership behavior UNVERIFIED.

#### PAY-001 — Client payment history
- **Requirement:** Make payment records available to the client in the Payments area.
- **Outcome:** Clients can review transaction/payment status.
- **Evidence / confidence:** README/current-state describe payment history; `Dashboard.jsx` Payments currently renders a fixed “No payments yet” state without a data query.
- **Priority:** Undecided. **Dependencies:** payment provider, `payments` records, ownership policies.
- **Acceptance (proposed):** Displayed payment entries match owned payment records and include authoritative state, amount, and date; empty state appears only when no records exist.
- **Current implementation:** MISSING in inspected client page source; production behavior not separately tested.

#### NOTIF-001 — Client notifications
- **Requirement:** Show user-scoped notifications, unread state, read actions, and relevant navigation where available.
- **Outcome:** Clients can find project/account updates.
- **Evidence / confidence:** `Dashboard.jsx` Notifications queries by `user_id`, subscribes to Realtime, and supports read updates; push modules exist. VERIFIED BEHAVIOR in source.
- **Priority:** Undecided. **Dependencies:** notifications schema/RLS, Realtime, push configuration.
- **Acceptance (proposed):** Only the signed-in user’s notifications appear; read status persists; action links remain within allowed routes; empty/error states distinguish configuration failures.
- **Current implementation:** Source present; live delivery, push, and persistence UNVERIFIED.

#### SET-001 — Client preferences and account security
- **Requirement:** Let clients manage the preferences/settings currently exposed, password change, and browser push subscription where supported.
- **Outcome:** Clients control account preferences and security actions.
- **Evidence / confidence:** `Dashboard.jsx` Settings, `pushNotifications.js`, Auth; theme is locked to light by confirmed decision.
- **Priority:** Undecided. **Dependencies:** Auth, user metadata, browser push support and VAPID config.
- **Acceptance (proposed):** Preferences persist and hydrate consistently; password change validates current/new password; push controls reflect browser permission/subscription state.
- **Current implementation:** Source present; live persistence/device behavior UNVERIFIED. Theme selection is intentionally light-only.

### Staff operations

#### ADMIN-001 — Staff directory and role clarity
- **Requirement:** Staff with authorized roles can inspect user directory identities, authoritative roles, join dates, and order activity.
- **Outcome:** Operations can identify clients/staff and understand account activity.
- **Evidence / confidence:** `Admin.jsx` `AdminUsersPage` uses `admin_list_directory_user_roles_v1` and `admin_list_directory_join_dates_v1`; migrations define restricted RPCs; role labels/counts derive from the role map.
- **Priority:** Undecided. **Dependencies:** profiles, role RPC, join-date RPC, orders.
- **Acceptance (proposed):** Role labels, filters, and counts agree with authoritative role rows; absent/unknown roles do not become clients; only staff can call directory RPCs.
- **Current implementation:** Source and migration files present; live RPC results/authorization UNVERIFIED here.

#### ADMIN-002 — Orders and project operations
- **Requirement:** Staff can inspect orders and carry out role-appropriate project/service-delivery operations.
- **Outcome:** Staff can coordinate client work.
- **Evidence / confidence:** `Admin.jsx`, `AdminProjects.jsx`, `AdminWorkspace.jsx`; workspace has server-side role checks, role-specific edit controls, client profile context, and roadmap RPCs; workspace migrations.
- **Priority:** Undecided. **Dependencies:** order ownership, staff roles, workspace records and roadmap templates.
- **Acceptance (proposed):** Staff see authorized orders; allowed roles can update only authorized project data; clients see only fields explicitly marked client-visible/shared.
- **Current implementation:** Broad source/migration present; live permissions and complete workflow UNVERIFIED.

#### ADMIN-003 — Service catalog administration
- **Requirement:** Authorized staff can maintain service information, prices, visibility, order acceptance, and package/catalog details where supported.
- **Outcome:** The public catalog reflects operational service settings.
- **Evidence / confidence:** `AdminServices.jsx`, F-05 migrations, public queries in `PublicPages.jsx`/`ServiceDetail.jsx`; VERIFIED BEHAVIOR in source.
- **Priority:** Undecided. **Dependencies:** `services`, `service_packages`, role-specific service policies.
- **Acceptance (proposed):** Public selection follows authoritative visibility/active fields; order acceptance is enforced at the backend; admin edits persist and are reflected in public pages.
- **Current implementation:** Service CRUD exists in source, but public packages use `service_packages` while Admin Services primarily edits `services`; parity is UNVERIFIED and a documented implementation mismatch.

#### ADMIN-004 — Lead review and qualification
- **Requirement:** Authorized staff can review completed assessment records and their score/status.
- **Outcome:** Staff can follow up with prospective clients.
- **Evidence / confidence:** `AdminLeads.jsx`, `LeadAssessment.jsx`, `ai/known-issues.md`; KNOWN ISSUE: current client writes Auth metadata while staff reads profiles, with a one-time migration backfill only.
- **Priority:** Undecided. **Dependencies:** product decision on lead source of truth and protected write path.
- **Acceptance (proposed):** Newly completed assessment appears once to authorized staff, with consistent answers/score/status and no client ability to alter staff qualification fields.
- **Current implementation:** BROKEN for ongoing flow based on source evidence; live data state UNVERIFIED.

#### ADMIN-005 — Staff messaging and client context
- **Requirement:** Staff can view/send order conversations and use supported moderation/management actions.
- **Outcome:** Operations staff can coordinate delivery with each client.
- **Evidence / confidence:** `Admin.jsx` AdminMessages, `AdminProjects.jsx`, messaging migrations; VERIFIED BEHAVIOR in source/migrations.
- **Priority:** Undecided. **Dependencies:** staff role matrix, order/message RPCs, Realtime, Storage.
- **Acceptance (proposed):** Staff access is role-controlled; conversation/order identity does not cross; read, reply, edit, delete, attachment actions follow the approved role matrix.
- **Current implementation:** Source/migration present; end-to-end permissions and realtime UNVERIFIED.

#### ADMIN-006 — Staff files, reviews, notifications, settings
- **Requirement:** Provide the listed staff operations modules with role-appropriate access and durable records.
- **Outcome:** Staff can manage files, review publication, notification broadcasts, and platform settings/audit history.
- **Evidence / confidence:** routes and source for AdminFiles, AdminReviews, AdminNotifications, AdminSettings; migrations/settings queries.
- **Priority:** Undecided. **Dependencies:** Storage, reviews/notifications/platform_settings/audit schemas, role policies.
- **Acceptance (proposed):** Each module’s reads and mutations are staff-authorized and auditable; errors are visible; client data remains isolated.
- **Current implementation:** Module source exists, but authorization, durability, notification delivery, and all mutation paths require runtime verification.

#### ADMIN-007 — Coupons module
- **Requirement:** No confirmed product behavior found; the route is currently a placeholder.
- **Outcome:** OPEN QUESTION.
- **Evidence / confidence:** `/admin/coupons` renders `AdminSimple`; no coupon data behavior in that component.
- **Priority:** Undecided. **Dependencies:** product decision, pricing/payment model.
- **Acceptance:** Not defined.
- **Current implementation:** MISSING as an operational module; whether it is in scope is OPEN QUESTION.

## 9. Roles, permissions, data visibility, and security requirements

| ID | Requirement | Evidence / confidence | Priority / dependencies | Proposed acceptance criteria |
|---|---|---|---|---|
| SEC-001 | Never expose service-role credentials in client code/builds. | CONFIRMED DECISION: `ai/instructions.md`. | Priority Undecided; frontend/build secret management. | Scan source/build output and deployment variables; only publishable/anon client key is shipped. |
| SEC-002 | Preserve RLS and database-enforced authorization; do not rely only on client-side role UI. | CONFIRMED DECISION: `ai/instructions.md`; RPC migrations use server-side checks. | Priority Undecided; Supabase policies/RPCs. | Cross-user and role tests deny unauthorized reads/writes, including direct RPC/API calls. |
| SEC-003 | Client profile writes must not modify protected email or lead qualification columns. | CONFIRMED DECISION: `ai/instructions.md`; profile repository payload is caller-provided and page builds editable payload. | Priority Undecided; column grants/profile save function. | Attempted client writes to protected columns are rejected and profile save never includes them. |
| SEC-004 | Staff roles are `admin`, `expert`, `support`, and `finance`; client role remains `client`. | CONFIRMED vocabulary in project instructions/migrations. | Priority Undecided; `user_roles` and role RPCs. | Role labels/permissions match the authoritative database role and explicit per-module policy. |
| SEC-005 | Staff authorization must be consistent across every `/admin/*` route and backend operation. | Confirmed security intent, but route source wraps most subroutes in `Protected`; individual modules apply their own checks inconsistently; `AdminSimple` is a placeholder. | Proposed high priority; staff role checks and routes. | A non-staff authenticated user cannot access any staff page or data by direct URL or direct API call. |
| SEC-006 | Client-visible delivery content excludes internal staff notes, internal transition reasons, and other clients’ data. | CONFIRMED security intent from roadmap and workspace migrations/source. | Priority Undecided; ownership checks and visibility flags. | Test each client against another client’s order, notes, tasks, goals, attachments, and roadmap. |

## 10. Service catalog and delivery workflow

- Public catalog source uses `services` visibility/active fields; detail views load active `service_packages` when configured. (Source evidence: `PublicPages.jsx`, `ServiceSelection.jsx`, `ServiceDetail.jsx`.)
- Staff service editing is centered on `services`; exact package editing/parity is not established by the inspected source. This is a data-contract/product decision to settle.
- Roadmaps are service-specific, ordered by configured workflow stages, and return a server-calculated percentage. The client RPC joins the caller’s owned orders; the staff workspace uses separate admin read/update RPCs. (Migration: `20261009100000_service_delivery_roadmaps.sql`.)
- Project tasks/goals/notes/session records have client-visible/shared versus internal controls in the workspace source and migrations. Permission semantics require live tests.
- Order creation must fail closed before an order is inserted unless payment verification is available. This is a confirmed safety decision. The live payment/order lifecycle is not implemented in the current source/migrations reviewed.

## 11. Non-functional requirements

| Area | Requirement / current evidence | Classification and unresolved detail |
|---|---|---|
| Accessibility | Use semantic controls, labels, focus behavior, and accessible state for interactive components. Existing project instructions require responsive/accessibility-minded implementation; source includes ARIA in some modules. | CONFIRMED general engineering expectation; WCAG conformance level and audit procedure OPEN QUESTION; no full accessibility audit verified. |
| Responsive design | Support mobile (375–430), tablet (768–1024), and desktop (1200–1440+) in development guidance. | CONFIRMED project instruction, not a complete per-route breakpoint spec. No whole-product viewport certification available here. |
| Performance | No response-time, bundle-size, Core Web Vitals, or latency SLO found. | OPEN QUESTION. |
| Reliability | Loading, error, and empty state patterns exist in code. No uptime, recovery, backup, or service-level targets found. | Source behavior VERIFIED in places; product thresholds OPEN QUESTION. |
| Privacy | User-scoped profile/orders/messages/files and protected profile fields are documented. No retention/deletion/export policy was found in the PRD sources reviewed. | Security constraints CONFIRMED; retention and privacy rights behavior OPEN QUESTION. |
| Security | Supabase Auth, RLS, staff role checks, and server-side RPC authorization are intended. | CONFIRMED direction; live policy posture not certified by source review alone. |
| Compatibility | README states Node LTS v18/v20/v22 and modern browser SPA stack. | Documented environment guidance; supported browser matrix OPEN QUESTION. |
| Theme/design | Strict light-only Formant theme and named CSS tokens are required. | CONFIRMED DECISION in `ai/instructions.md` and `ai/decisions.md`. |

## 12. Integrations, architecture constraints, and dependencies

- **Frontend:** React 19, React Router 7, Vite 7, native CSS; routes in `src/main.jsx`.
- **Backend:** Supabase Auth, Postgres/PostgREST, Storage, RPCs, and Realtime; current environment/project details in `ai/current-state.md` may be stale and are not revalidated here.
- **Hosting:** Vercel SPA rewrite in `vercel.json`; README describes GitHub push to `main` as deployment trigger. Deployment status is not part of this document’s verification.
- **Dual-state model:** Supabase cloud and `careerlyst_demo` local store are a CONFIRMED architecture decision. Source parity is not complete across every feature; some pages explicitly require Supabase.
- **Legacy identifiers:** Keep `careerlyst_*` local storage keys, metadata, RPC names, and project identifiers unless a backward-compatible approved migration exists (CONFIRMED DECISION).
- **Schema source of truth:** Migrations are incomplete relative to tables/functions the frontend queries, per `ai/known-issues.md`. `supabase-schema.sql` is not a complete reproducible production schema. No live schema inspection was performed for this PRD.

## 13. Known issues and product/technical risks

1. **Lead data path mismatch (high impact):** Assessment completion writes Auth metadata; admin lead list reads `profiles`; a migration backfills existing metadata but does not establish ongoing sync. `ai/known-issues.md` calls this open; source confirms the separate write/read paths.
2. **Live purchase/order placement unavailable:** service detail explicitly says order placement is paused; the database function raises before insert and authenticated execution is revoked. This is an intentional fail-closed safety behavior, but a major conversion capability limitation if online purchase is an approved goal.
3. **Inconsistent staff route gating:** route definitions use `Protected` for many staff paths while individual modules run different internal checks; a global staff-layout guard is not consistently applied. Backend policies still determine data access; the UI exposure impact needs dedicated verification.
4. **Payment history is a fixed empty screen:** `Dashboard.jsx` Payments renders “No payments yet” without loading payment records.
5. **Schema/migration drift:** known-issues report and source references show frontend use of tables/RPCs not fully represented by the checked-in schema/migrations; clean local reconstruction is uncertain.
6. **Service catalog/admin parity:** public service details read `service_packages`; Admin Services primarily edits `services`. Whether package authoring is complete and public ordering reflects staff edits needs verification.
7. **No automated test script or test files found:** `package.json` provides dev/build/preview only; manual and browser verification is not reproducible as a repository suite.
8. **Unverified live behavior:** no Supabase account, browser journey, cross-role access, payment, storage, or deployment tests were performed as part of drafting this PRD.
9. **Large global CSS and dual brand naming:** documented maintainability risks in `ai/known-issues.md`; these are engineering concerns, not independently approved product scope.

## 14. Open product-owner questions

1. Is successful online purchase a launch requirement, and which payment provider/currency/refund/dispute rules are in scope?
2. Is the desired model to require payment before order creation, create a pending order before payment, or another explicitly verified lifecycle?
3. What is the canonical source of truth for lead assessment data: Auth metadata, `profiles`, or a dedicated lead record? Which roles may view/export/contact leads?
4. What exact permissions distinguish admin, expert, support, and finance for each admin module and action?
5. Which services/packages are supported, what is their source of truth, and how should public packages map to staff administration?
6. Are coupons in scope? The current route is a placeholder.
7. What is the authoritative payment-history behavior and which provider fields must clients see?
8. What are the service delivery SLAs, stage update semantics, revision policy, cancellation/refund states, and client response expectations?
9. What measurable product outcomes and analytics events should be tracked, and what are their targets?
10. What accessibility conformance level, supported browsers/devices, performance targets, availability, backup, and retention requirements apply?
11. Should local demo mode cover every client and staff module, or is Supabase-only behavior acceptable for particular modules?
12. What client-facing review submission journey is intended? The repository has staff review moderation but does not settle submission policy.

## 15. Traceability matrix

| Requirement group | Primary source | Implementation evidence |
|---|---|---|
| Public pages/catalog | `README.md`, `ai/current-state.md`, `docs/PROJECT_STRUCTURE.md` | `src/main.jsx`, `Home.jsx`, `PublicPages.jsx`, `ServiceSelection.jsx`, `ServiceDetail.jsx`, `AdminServices.jsx` |
| Auth/session | `ai/instructions.md`, `ai/decisions.md` | `Auth.jsx`, `Protected.jsx`, `supabase.js`, `ResendLink.jsx` |
| Lead assessment | README/current-state; known issue #2 | `LeadAssessment.jsx`, `AdminLeads.jsx`, `20261007020000_profile_assessment_metadata_backfill.sql` |
| Profile | `ai/instructions.md`, known issues, profile migrations | `Dashboard.jsx`, `profileRepository.js`, `profileCompletion.js`, profile migrations |
| Orders/roadmaps/workspace | README/current-state and security instructions | `Dashboard.jsx`, `AdminWorkspace.jsx`, `AdminProjects.jsx`, workspace/roadmap migrations |
| Messaging/files | README/current-state and security instructions | client/admin messaging in `Dashboard.jsx`/`Admin.jsx`, `messageRealtime.js`, `MessageActions.jsx`, messaging migrations |
| Payments/checkout | `ai/decisions.md`, known issue #5 | `ServiceDetail.jsx`, payments page in `Dashboard.jsx`, F-05 migration |
| Staff modules/security | `docs/PROJECT_STRUCTURE.md`, `ai/instructions.md` | `main.jsx`, `Admin.jsx`, `AdminWorkspace.jsx`, `AdminServices.jsx`, `AdminReviews.jsx`, `AdminNotifications.jsx`, `AdminSettings.jsx` |
| NFR/architecture | `ai/instructions.md`, `ai/decisions.md`, README | `src/styles.css`, `vercel.json`, `supabase/`, `package.json` |

## 16. Glossary and decision history

- **Client:** Authenticated service recipient; role value `client`.
- **Staff:** Admin, expert, support, and finance roles; permissions vary by module.
- **Lead assessment:** Seven-step qualification questionnaire and its computed score/status.
- **Service package:** A purchasable tier associated with a service in `service_packages`.
- **Roadmap:** Service-specific stage sequence and server-returned progress for an order.
- **Client-visible/shared:** Content intended to be shown to the client; distinct from internal staff notes/reasons.
- **Dual-state:** Supabase cloud mode plus local demo-store fallback.
- **Legacy identifier:** Existing `careerlyst_*` technical identifiers retained after Formant rebrand.

Documented decisions preserved here: SPA with React/Vite; Supabase plus local demo store; Formant public brand with legacy identifiers; light-only design system; protected profile columns; lead assessment metadata storage; staff-only join-date RPC; order creation fails closed until payment verification; and the existing preloader/footer behaviors. The decision log itself labels some historical rationale as inferred; this PRD does not upgrade that rationale into approved product strategy.
