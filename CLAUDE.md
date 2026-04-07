# RAWReporter — Claude Code Project Context

---

## What this is

RAWReporter is a cybersecurity assessment reporting platform for OT/IT
consulting firms. It generates professional reports (DOCX) from structured
findings data. Target users are cybersecurity consultants doing penetration
tests, gap assessments, vulnerability assessments, tabletop exercises,
TSA directive assessments, and compliance assessments.

The platform is OT-focused. Findings map to frameworks including
IEC 62443, NERC CIP, TSA directives, and NIST SP 800-82. Severity
scoring is not purely CVSS — OT consequence (safety, production,
regulatory) matters.

---

## Stack

Backend:  Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic,
          PostgreSQL 16
Auth:     FastAPI-Users with JWT
Docs:     python-docx + Jinja2
Frontend: React 18, TypeScript, Vite, dnd-kit, Axios,
          React Query, Zustand
Local:    Docker Compose (db container only — backend and frontend
          run on the host machine, not in Docker)
Editor:   VS Code

---

## Project structure

rawreporter/
  backend/
    rawreporter/
      auth/           FastAPI-Users setup, user model, auth routes
      models/         SQLAlchemy ORM models (one file per table)
      schemas/        Pydantic v2 schemas (one file per domain)
      routers/        FastAPI routers — thin, no business logic
      services/       Business logic layer
      generators/     DOCX generation engine
      utils/          enums.py, exceptions.py, seed_rbac.py
    tests/
    uploads/
    alembic/
  frontend/
    src/
      api/            Axios functions (one file per domain)
                        auth.ts, library.ts, users.ts, client.ts
      components/
        ui/           Generic components (Button, Input, Modal,
                        Select, Toggle, Badge, Spinner, etc.)
        layout/       Sidebar, Topbar, PageWrapper, AppLayout,
                        LayoutContext (collapsible sidebar state)
        report/       SectionBlock, LibrarySelectModal
        library/      LibraryFindingRow, LibraryFindingFormModal
        users/        CreateUserModal, EditUserModal,
                        RoleSelectModal, ResetPasswordModal
      hooks/          usePermission.ts (usePermission, usePermissions)
      pages/
        auth/         LoginPage, RegisterPage
        library/      LibraryPage, LibraryArchivePage
        reports/      ReportsPage, ReportArchivePage
        ReportBuilder/ ReportBuilder.tsx + components/
                        TableOfContents, ReportTitleBox,
                        SectionTextBox, FindingsOverviewChart,
                        FindingsSection, SeveritySection,
                        FindingCard, ReportActionsPanel,
                        GenerateReportButton (superseded by
                        ReportActionsPanel — no longer used)
        settings/     UsersPage, AuditLogPage,
                        DefaultTemplatesPage
      store/          authStore (token, user, permissions[]),
                      reportBuilderStore (sections, findingsBySection,
                        addFindings, removeFinding, reset)
      types/          models.ts
      api/            (additional) templates.ts

---

## Non-negotiable architecture rules

1. All enums live in backend/rawreporter/utils/enums.py
   Never define enums inline in models or schemas.
   Always import from enums.py.

2. Business logic lives in services/ — routers must stay thin.
   No severity logic, section assignment, or validation in routers.
   Routers call service functions and return the result.

3. Document generation lives in generators/ — never in services/
   or routers/.

4. All SQLAlchemy models use async sessions.
   Never use sync SQLAlchemy.

5. All primary keys are UUIDs, never integers.

6. Permission checks use the require_permission dependency.
   Every protected route must declare its resource:action pair.
   No inline permission logic in route handlers.

7. Never define permissions or roles outside of:
   - models/role.py, models/permission.py,
     models/role_permission.py, models/user_role.py
   - utils/seed_rbac.py (the single source of truth for
     built-in role definitions)

8. The seed_rbac function is idempotent. Use INSERT ... ON
   CONFLICT DO NOTHING or existence checks. It runs on every
   app startup.

9. No raw Axios calls outside of src/api/ files on the frontend.

10. Permission-aware UI rule: hide buttons entirely when the
    user lacks permission. Never disable buttons for permission
    reasons — use usePermission() and conditionally render.

11. React hooks must never be called after an early return.
    Always call useQuery/useState/useEffect before any
    conditional return (guard redirects). Use `enabled: false`
    on useQuery to prevent fetching when the page should redirect.

12. FastAPI-Users get_users_router is NOT mounted. All user
    management routes live in routers/users.py. Do not re-add
    the FastAPI-Users user router — it conflicts with custom routes.

---

## Lessons learned

Decisions and patterns discovered during implementation that are not
obvious from the architecture rules alone. Read these before making
changes to reports, engagements, or the archive system.

### Document generation — Approach B (style-based)
The uploaded .docx provides styles only. python-docx builds all body
content programmatically using standard Word style names (Heading 1,
Heading 2, Heading 3, Normal, List Bullet). Cover page fields are
injected via named Word bookmarks. If a style name does not exist in
the template, python-docx falls back to the document's default style.
The generate endpoint returns StreamingResponse — the frontend uses
raw fetch() (not axios) to receive binary content and trigger a
browser download via URL.createObjectURL().

### Alembic migrations for Phase 4 (add_platform_settings_table, add_document_templates_table)
The document_templates table references engagementtypeenum with
create_type=False (the PG enum already exists from earlier migrations).
Platform settings uses a plain VARCHAR key (not an enum) so new keys
can be added without migrations.

### Reports — audience field was removed entirely
The original Report model had an `audience` (Technical / Executive) column.
This was a design mistake — it was removed in migration d4e5f6a1b2c3.
Do NOT re-add audience to reports, schemas, API calls, or UI.
If you see any reference to `audience` on a Report, it is stale.

### Report status enum — new values, old ones are gone
The old status values (draft / in_review / final) were replaced in
migration d4e5f6a1b2c3. The current values are:
  draft → review → editing → final_review → complete
The old values no longer exist in the database enum type.
Any code still referencing in_review or final on reports is stale.

### Reports have a nullable engagement_id (SET NULL, not CASCADE)
Reports are no longer hard-linked to an engagement. engagement_id is
nullable so a report can exist unlinked and be associated later.
The FK uses SET NULL on delete — if the parent engagement is deleted,
its reports are unlinked rather than cascade-deleted.
This was added in migration e5f6a1b2c3d4.

### The "Add Report" / "Unlink Report" flow on the Engagements page
Two ways to attach a report to an engagement:
  1. "+ New Report" (inside expanded engagement row) — creates a new
     report pre-linked to that engagement.
  2. "+ Add Report" (same location) — opens a picker showing only
     reports with engagement_id = NULL (GET /reports?unlinked=true).
     The user selects one or more; each is linked via POST /reports/{id}/link.
"Unlink Report" in the Manage dropdown opens a picker of that engagement's
linked reports. Selected reports are unlinked via POST /reports/{id}/unlink.
Unlinking does NOT delete the report or its findings.

### Changing a FK constraint requires drop-alter-recreate in Alembic
When the reports.engagement_id FK needed to change from CASCADE to SET NULL,
Alembic cannot modify the ondelete behaviour in-place. The correct sequence:
  1. op.drop_constraint (drop the existing FK by name)
  2. op.alter_column (change nullable if needed)
  3. op.create_foreign_key (re-add with the new ondelete value)
The FK constraint name in PostgreSQL follows the pattern:
  {table}_{column}_fkey  (e.g. reports_engagement_id_fkey)

### React Query staleTime: 0 for picker modals
The "Add Report" and "Unlink Report" modals fetch live data that must
reflect the current state (a report just linked should not still appear
in the unlinked picker). These queries use staleTime: 0 so they always
refetch when the modal opens. Standard page queries use staleTime: 120_000.

### Archive pattern is consistent across all major entities
Clients, Engagements, Reports, and Library Findings all use the same
soft-archive pattern:
  - is_archived: bool, archived_at: datetime on the model
  - POST /{id}/archive and POST /{id}/restore endpoints
  - GET /archived endpoint for the archive page
  - Archive pages at /{resource}/archive redirect if the user lacks
    the {resource}:archive permission
  - Query keys follow the pattern: ["{resource}-archived"]
  - Main list query filters WHERE is_archived = FALSE
Follow this pattern exactly for any new archivable entity.

### Customer dropdown drives the Engagement dropdown in ReportFormModal
In the Report create/edit form, selecting a Customer first filters the
Engagement dropdown to only that customer's engagements. If the customer
is changed and the previously selected engagement no longer belongs to the
new customer, the engagement selection is automatically cleared.
This prevents creating a report linked to an engagement from a different client.

### Dropdown menus inside card rows require overflow: visible
Any card row that contains a Manage dropdown must NOT have overflow: hidden
set on the card or its grid container. The dropdown menu uses
position: absolute and will be clipped otherwise. This is documented in
the Visual Style section and has caused bugs before.

### Reports page column layout uses CSS grid with named widths
The ReportsPage and ReportArchivePage column layouts use explicit
gridTemplateColumns with minmax() to keep columns proportional and readable
without scrunching. If columns are added or removed, the header row grid
definition and the data row grid definition must be kept in sync.

### report:archive permission was missing from seed_rbac — always verify parity
When the report archive feature was wired up, canArchive was always false
because "report:archive" was never defined in _PERMISSIONS in seed_rbac.py.
The backend archive endpoints existed and worked, but no role had the
permission so it was invisible in the UI.
Rule: every time a new resource:action pair is used in a require_permission()
call, it MUST also be added to _PERMISSIONS and assigned to the appropriate
roles in seed_rbac.py. Check parity between routers and seed_rbac whenever
a permission-gated feature silently does nothing.

### Finding fields must stay in sync across library and report findings
LibraryFinding and Finding are separate models (library is the master,
Finding is a copy-on-import). When a new text field is added to
LibraryFinding it must also be:
  1. Added to the Finding model + Alembic migration
  2. Added to FindingBase and FindingUpdate schemas
  3. Copied in library_service.py copy_library_finding_to_report()
  4. Added to the frontend Finding type (models.ts)
  5. Added to the updateFinding API call pick type (findings.ts)
  6. Shown in the Report Builder FindingCard expanded form
The observation field was missed in the initial report builder build and
required a full-stack addition (migration b8c9d0e1f2a3).

### FindingUpdate schema must cover all user-editable fields
The initial FindingUpdate schema only accepted severity_override and
override_justification. This meant the Report Builder could not save
title, summary, observation, recommendation, remediation steps, CVSS,
or ref_enabled flags. Expand FindingUpdate whenever a new field needs
to be editable from the report builder.

### References on findings use atomic replace, same as library
Finding references are replaced atomically via PUT /findings/{id}/references,
which deletes all existing rows and inserts the new set in one transaction.
This mirrors the library pattern (PUT /library/{id}/references).
Never PATCH individual reference rows — always replace the full set.

### body_text on report_sections — added in migration f6a1b2c3d4e5
ReportSection originally had no body_text column. It was added in
migration f6a1b2c3d4e5 (down_revision: e5f6a1b2c3d4).
The SectionTextBox component debounce-saves via PATCH /sections/{id}
with { body_text }. ReportSectionUpdate schema includes body_text.

### LibrarySelectModal targetSection is optional
The modal was originally required to have a targetSection (a specific
ReportSection to import into). It was made optional so it can be opened
from the top-level "Add Findings from Library" button in FindingsSection,
where findings auto-assign to the matching severity section. When
targetSection is absent, the severity filter defaults to "all" and
importLibraryFinding is called without a targetSectionId.

### Modal auto-focus on close button causes focus theft during typing
The Modal component originally had firstFocusRef attached to the close (X)
button, with focus() called in a useEffect that listed onClose as a
dependency. Because onClose is a new function reference on every parent
re-render (e.g. when canSave changes after typing the first character),
the effect re-ran and stole focus back to the X button mid-input.
Fix: removed the auto-focus entirely. The Escape key listener is preserved.
Do NOT auto-focus the close button in modals — it breaks form input.

### Collapsible sidebar — layout uses LayoutContext, not CSS variables
The sidebar width is dynamic (240px expanded, 56px collapsed) and cannot
use a static CSS variable. LayoutContext (src/components/layout/LayoutContext.tsx)
provides sidebarCollapsed state and toggleSidebar to all layout components.
Topbar uses it to set its left offset; PageWrapper uses it for margin-left.
Both animate with transition: "... 0.2s ease" to match the sidebar's own
width transition. The sidebar auto-collapses when window width < 900px on
resize (one-way: it doesn't auto-expand when the window grows again — the
user controls that manually). SIDEBAR_WIDTH (240) and SIDEBAR_COLLAPSED_WIDTH
(56) are exported constants from Sidebar.tsx — import them instead of
hardcoding pixel values in Topbar or PageWrapper.

### Report Builder layout is three-column
The Report Builder (/reports/:id/build) uses a three-column layout:
  Left  — TableOfContents (192px sticky, scroll-tracking nav)
  Center — main content (flex: 1, all sections and findings)
  Right  — ReportActionsPanel (192px sticky, status + export)
The ReportActionsPanel contains: Report Type (read-only display),
Status (clickable dropdown, saves via PATCH /reports/{id}),
and Export (Generate Report button + validation modal).
The status badge was removed from the breadcrumb bar — it lives
in the panel only.

### Report Builder uses position-ordered render loop — no hardcoded section lookups
ReportBuilder.tsx iterates sections sorted by position. Rendering rules:
  - severity_filter !== null → skip (rendered inside FindingsSection)
  - section_type === "report_title" → ReportTitleBox (with sectionId)
  - section_type === "findings" → FindingsOverviewChart + FindingsSection
  - else → SectionTextBox
Each section wrapper gets id="rb-section-{section.id}" for TOC scroll-tracking.
TableOfContents.tsx is now driven by the sections prop — no hardcoded ids.
Legacy reports (no report_title or findings section) are handled by fallback
blocks that render the old-style title box and findings section.

### engagement_id is optional when creating a new report
POST /api/v1/reports does not require engagement_id. Section seeding priority:
  1. If engagement_id provided → use engagement.types[0] to seed sections
  2. If no engagement but report.types[0] provided → use that type to seed
  3. If neither → create empty report with no sections
Tabletop and tsa_directive types are silently skipped (no builder defined).
Deleting an engagement sets reports.engagement_id to NULL (SET NULL on FK).
Do NOT add cascade="all, delete-orphan" to Engagement.reports — that would
cascade-delete reports when an engagement is deleted.

### report_default_templates — engagement_type stored as VARCHAR
The report_default_templates table stores engagement_type as VARCHAR(64),
not as a PostgreSQL enum, because engagement types are stored as JSONB
in the engagements table (no engagementtypeenum PostgreSQL type exists).
The sectiontypeenum PostgreSQL type IS used for the section_type column.
When creating Alembic migrations that reference sectiontypeenum, use
ENUM(name="sectiontypeenum", create_type=False) from sqlalchemy.dialects.postgresql
to avoid "type already exists" errors.

### ReportTitleBox saves to section body_text AND syncs report.title
When a sectionId is passed (new builder reports), ReportTitleBox calls
updateSection(sectionId, { body_text }) then updateReport(reportId, { title })
to keep the Reports page list display current. The section body_text is the
source of truth; report.title is a display copy. Both must be kept in sync.

### Expandable FindingCard is self-contained — no separate edit modal
Findings in the report builder expand inline on click. The expanded form
contains all editable fields (title, severity override, CVSS override,
justification, summary, observation, recommendation, remediation steps,
references). Save calls updateFinding + replaceFindingReferences then
collapses the card and calls onSaved() to trigger a refetch.
Delete is handled inside the card via a ConfirmModal + deleteFinding call,
then calls onDeleted() which calls removeFinding() from the store.
FindingFormModal is no longer used in the Report Builder — do not re-add it.
The wasExpandedRef pattern prevents form state from re-initialising while
the card is already open (only initialises on false → true transition).

---

## Database tables

Core:
  clients, engagements, reports, report_sections,
  findings, finding_references, evidence,
  library_findings, library_finding_references

RBAC:
  roles, permissions, role_permissions, user_roles

Auth:
  users (FastAPI-Users base + custom fields:
         username, first_name, last_name, created_at)

---

## RBAC system

Four built-in roles (is_system_role = True, cannot be deleted):
  admin       — full access to everything
  lead        — create/edit engagements, reports, findings,
                manage library view only
  consultant  — create/edit/delete findings, view library,
                edit report sections, generate reports
  view_only   — read everything, change nothing

First registered user automatically receives Admin role.
All subsequent users default to View Only until an Admin
changes their role.

Only Admin can manage users, assign roles, create/edit/
archive/delete library findings.

Permission format: "resource:action"
Resources: client, engagement, report, finding,
           library_finding, evidence, user,
           report_default_template, audit_log
Actions:   view, create, edit, delete, archive, restore,
           generate, move, upload, deactivate, assign_roles

report_default_template permissions:
  view  — all roles (view default templates)
  edit  — Admin only (edit default templates)

Frontend permission check pattern:
  const canDelete = usePermission("client", "delete")
  {canDelete && <Button>Delete</Button>}

Backend permission check pattern:
  user = Depends(require_permission("client", "delete"))

Permissions are loaded once per session in AppLayout on mount:
  GET /users/me/permissions → string[] → authStore.permissions[]
  usePermission(resource, action) reads from Zustand store.

---

## Library finding fields

The LibraryFinding model has these user-facing fields:
  title (required)
  severity (required)
  cvss_score_default (nullable float, toggled on/off in form)
  tags (JSONB string array)
  summary (required)
  observation (text — added to capture pentest observations)
  recommendation (text)
  remediation_steps (text)
  remediation_steps_enabled (bool toggle)
  ref_cve/cwe/cisa/nist/nvd/manufacturer_enabled (bool toggles)
  references (LibraryFindingReference rows, replaced atomically
              via PUT /library/{id}/references)

Fields retained in DB but NOT shown in the create/edit form
(preserved on edit, defaulted on create):
  vertical, is_ot_specific, framework_refs, questionnaire_trigger,
  description_technical, description_executive

References are saved atomically: PUT /library/{id}/references
replaces all reference rows in one transaction.

---

## Key business logic rules

FINDINGS SEVERITY:
  severity_effective = severity_override ?? severity_default
  severity_default is copied from library at import, never changed
  severity_override is set by consultant per-report, never affects
  the library original

SECTION AUTO-ASSIGNMENT:
  When a finding is imported from library with no target_section_id:
    section_id is auto-set to the section where
    severity_filter == severity_effective
  When target_section_id is provided:
    finding is placed in that section regardless of severity
    is_placement_override = True if severity doesn't match filter

MANUAL PLACEMENT OVERRIDE:
  When a finding is dragged to a section whose severity_filter
  does not match severity_effective:
    is_placement_override = True
    override_justification must be filled in
  When is_placement_override = True:
    Yellow left border on FindingCard
    Override badge shown
    SeverityOverrideModal opens immediately after drop

REPORT GENERATION BLOCK:
  Before generating DOCX, validate_report_for_generation runs.
  Blocks if any finding has:
    is_placement_override = True AND
    override_justification IS NULL or empty string
  Returns HTTP 422 listing blocking findings by title.

LIBRARY ARCHIVE:
  is_archived = True hides finding from GET /library/
  Archived findings only visible at GET /library/archived
  Only Admin can archive and restore.
  Archiving does not affect findings already copied into reports.

SECTION STRUCTURES (per builder type — seeded by seed_report_sections):
  engagement_id is now REQUIRED when creating a report. The engagement's
  types[0] determines which SECTION_STRUCTURES entry to use.
  Tabletop and tsa_directive → HTTP 422 (no builder defined).

  Each builder seeds text sections + a 'findings' container section.
  The findings container triggers seeding the 5 severity sub-sections
  at positions container_pos+1 through container_pos+5.

  Vulnerability Assessment (14 sections):
    1 report_title, 2 executive_summary, 3 crown_jewel,
    4 scope_and_methodology, 5 findings_summary,
    6 findings (container), 7-11 severity sub-sections,
    12 remediation_roadmap, 13 closing, 14 appendix

  Pentest (16 sections):
    1 report_title, 2 executive_summary,
    3 scope_and_rules_of_engagement, 4 methodology,
    5 findings_summary, 6 crown_jewel, 7 attack_path,
    8 findings (container), 9-13 severity sub-sections,
    14 remediation_roadmap, 15 closing, 16 appendix

  Risk Assessment (14 sections):
    1 report_title, 2 executive_summary,
    3 scope_and_methodology, 4 risk_assessment_approach,
    5 risk_assessment_result,
    6 findings (container), 7-11 severity sub-sections,
    12 remediation_roadmap, 13 closing, 14 appendix

  Compliance Assessment (14 sections):
    1 report_title, 2 executive_summary,
    3 compliance_framework_overview, 4 scope_and_methodology,
    5 compliance_maturity,
    6 findings (container), 7-11 severity sub-sections,
    12 remediation_roadmap, 13 closing, 14 appendix

  Security Gap Assessment (14 sections):
    1 report_title, 2 executive_summary,
    3 scope_and_methodology, 4 gap_analysis,
    5 findings_summary,
    6 findings (container), 7-11 severity sub-sections,
    12 remediation_roadmap, 13 closing, 14 appendix

  Severity sub-sections (always positions container+1 to container+5):
    critical_findings, high_findings, medium_findings,
    low_findings, informational

---

## Workflow: adding findings to a report

Consultants do NOT browse to the library page to add findings.
The correct workflow is:

  1. Consultant opens a report in the report builder
  2. Inside a severity section, clicks "+ Add Findings from Library"
  3. LibrarySelectModal opens — pre-filtered to section severity
  4. Consultant searches, selects findings, clicks Add
  5. POST /library/{id}/import with { report_id, target_section_id }
  6. If severity mismatch: amber warning shown before confirm,
     is_placement_override = True after import

The Library page (/library) is a management page only.
It is used to create, edit, archive, and delete library findings.
It is NOT used to directly add findings to reports.

---

## User management

Routes live in routers/users.py (custom, not FastAPI-Users):
  GET    /users/me                  — current user with roles
  PATCH  /users/me                  — update own profile
  GET    /users/me/permissions      — returns string[] for frontend
  GET    /users                     — list all users (user:view)
  POST   /users                     — create user (user:create)
  GET    /users/{id}                — get user (user:view)
  PATCH  /users/{id}                — edit user (user:edit)
                                      supports: email, username,
                                      first_name, last_name,
                                      is_active, password (hashed)
  DELETE /users/{id}                — delete user (user:delete)
                                      cannot delete own account
  POST   /users/{id}/assign-role    — replace role (user:assign_roles)
  DELETE /users/{id}/deactivate     — set is_active=False
  GET    /roles                     — list roles (user:view)

UserWithRolesRead schema includes: id, email, username,
  first_name, last_name, is_active, created_at, roles[]

---

## Navigation structure

Sidebar links (all authenticated users see these):
  Dashboard       /
  Clients         /clients
  Engagements     /engagements
  Reports         /reports
  Library         /library        (visible to all roles)

Settings section visibility:
  Visible if any of: user:view, audit_log:view,
                     report_default_template:edit
  Users           /settings/users       (user:view)
  Logs            /settings/audit-log   (audit_log:view)
  Templates       /settings/templates   (report_default_template:edit)

Routes:
  /login                    LoginPage (AuthLayout)
  /register                 RegisterPage (AuthLayout)
  /                         DashboardPage
  /clients                  ClientsPage
  /clients/archive          ClientArchivePage
  /clients/:id              ComingSoon
  /engagements              EngagementsPage
  /engagements/archive      EngagementArchivePage
  /engagements/:id          ComingSoon
  /reports                  ReportsPage
  /reports/archive          ReportArchivePage
                            (redirects if no report:archive)
  /reports/:id/build        ReportBuilder (inside AppLayout)
  /library                  LibraryPage (management view)
  /library/archive          LibraryArchivePage
                            (redirects if no library_finding:archive)
  /library/:id              ComingSoon
  /settings/users           UsersPage
                            (redirects to / if no user:view)
  /settings/audit-log       AuditLogPage
                            (redirects to / if no audit_log:view)
  /settings/templates       DefaultTemplatesPage
                            (redirects to / if no
                             report_default_template:view)

There is NO standalone /findings page.
Findings only exist within reports and are accessed
through the report builder.

---

## Alembic migrations (applied in order)

  357cc35ad234  initial_schema
  52f028138a49  add_user_table
  3aea562da73c  add_username_firstname_lastname_to_user
  edf65ab9e2a1  add_rbac_tables_and_library_archive
  29c0fc77c2fe  add_created_at_to_users
  a1b2c3d4e5f6  add_observation_to_library_findings
  b2c3d4e5f6a1  add_client_fields_and_archive
  c3d4e5f6a1b2  engagement_multi_type_and_archive
  d4e5f6a1b2c3  report_overhaul
  e5f6a1b2c3d4  reports_nullable_engagement
  f6a1b2c3d4e5  add_body_text_to_report_sections
  b8c9d0e1f2a3  add_observation_to_findings
  c1d2e3f4a5b6  add_audit_logs_table
  d2e3f4a5b6c7  engagement_lead_consultants_completed
  0c48e60f86c2  add_completed_to_engagement_status
  e1f2a3b4c5d6  report_end_date_completed_date
  f2a3b4c5d6e7  add_builder_enum_values
  a3b4c5d6e7f8  add_report_default_templates
  1c5c4eb6c776  add_platform_settings_table
  b3dde244ed76  add_document_templates_table

To run migrations: cd backend && python -m alembic upgrade head
The db container (rr-db) must be running on port 5432.
There is no docker-compose.yml — only the db runs in Docker.

---

## Document generation (Phase 4 — complete)

POST /api/v1/reports/{id}/generate returns a streaming
DOCX file download (StreamingResponse, application/vnd
.openxmlformats-officedocument.wordprocessingml.document).

Architecture (Approach B — style-based):
  - generators/context_builder.py builds the template context
    from report, engagement, client, findings, and platform
    settings (firm_name).
  - generators/template_loader.py loads the uploaded .docx
    base template and injects named bookmarks on the cover
    page (RAW_REPORT_TITLE, RAW_CLIENT_NAME, etc.).
  - generators/docx_generator.py produces DOCX bytes using
    python-docx. The template provides styles; all body
    content is appended programmatically.
  - Admin uploads per-type .docx templates at
    /settings/document-templates via the document_templates
    API. If no template is uploaded, generation returns 422.
  - platform_settings table stores firm_name (and future
    global settings). Admin edits it on the templates page.

Bookmark names for cover page templates:
  RAW_REPORT_TITLE, RAW_CLIENT_NAME, RAW_ENGAGEMENT_TYPE,
  RAW_REPORT_DATE, RAW_LEAD_CONSULTANT, RAW_PREPARED_BY

Word styles used for body content:
  Heading 1 (sections), Heading 2 (findings),
  Heading 3 (sub-sections), Normal (body text),
  List Bullet (references)

Generation blocks if any finding has:
  is_placement_override = True AND no override_justification
Blocked findings are returned in the 422 response as
  {"blocking_findings": [{id, title, section}]}

---

## Current build status

Completed:
  Phase 1 — Models + Alembic migrations          ✓
  Phase 2 — API skeleton (all CRUD routes)        ✓
  Phase 3 — Business logic (services)             ✓
  Phase 4 — Document generation                   ✓
    5-type DOCX generation (python-docx, Approach B)
    Bookmark-based cover page injection
    Severity count summary table
    Findings grouped by severity in position order
    Word TOC field (user refreshes in Word)
    platform_settings table (firm_name)
    document_templates table + upload/delete API
    GET/POST/DELETE /api/v1/document-templates/{type}
    GET/PUT /api/v1/platform-settings/{key}
    DocumentTemplatesPage (/settings/document-templates)
    GenerationBlockedModal
    Generate button with download + error handling
    11 backend tests (test_document_generation.py)
  Phase 5 Steps 1-4 — Frontend scaffold + Auth    ✓
  RBAC + Library redesign (Steps A1-A8, B1-B9)    ✓
  Phase 5 Steps 5-9 — Dashboard, Clients,         ✓
    Engagements, Reports, routing
  Report overhaul — audience removed, new fields  ✓
    (types, start_date, end_date, completed_date,
    is_archived), status enum updated (draft/review/
    editing/final_review/complete), archive/restore,
    report link/unlink to engagements,
    reports.engagement_id nullable (SET NULL)
  Engagement overhaul — engagement_lead_id,       ✓
    consultant_ids (JSONB), completed_date,
    completed status added to enum
  Phase 5 Step 9 — Report Builder                 ✓
    Three-column layout (TOC / content / actions)
    SectionTextBox (body_text, debounced save,
      collapse/expand, visibility toggle)
    ReportTitleBox (saves to section body_text +
      syncs report.title)
    FindingsOverviewChart (inline SVG)
    FindingsSection + SeveritySection
    FindingCard (expandable inline edit, self-
      contained save + delete)
    TableOfContents (sticky, scroll-tracking,
      dynamic from section list)
    ReportActionsPanel (report type display,
      status dropdown, date fields, generate button)
    observation field added full-stack
    FindingUpdate schema expanded
    PUT /findings/{id}/references endpoint added
    report:archive permission added to seed_rbac
    Collapsible responsive sidebar (LayoutContext)
    Modal focus-theft bug fixed
  Report Builder Redesign — 5 builder types       ✓
    (Steps A1-A5 backend, B1-B7 frontend)
    5 engagement-type builders with fixed section
    structures (vulnerability_assessment, pentest,
    risk, compliance_assessment, gap_assessment)
    report_default_templates table + API
    GET/PUT /api/v1/templates/{type}/{section}
    DefaultTemplatesPage (/settings/templates)
    ReportBuilder position-ordered render loop
    Engagement type badge in breadcrumb
    tabletop/tsa_directive hidden from UI (legacy)
    risk engagement type added
    engagement_id required on report create
    8 backend tests (test_report_builder.py)

In progress:
  Phase 5 Steps 10-12 — dnd-kit drag-to-reorder,
    override modals, final polish

Not yet started:
  (all phases complete)

---

## Visual style

Polished SaaS. Light mode only (dark mode deferred).
CSS custom properties defined in src/styles/globals.css.
No external component library — all components built from scratch.
Inter font loaded from Google Fonts.

Severity colours:
  critical    #7c3aed  purple
  high        #dc2626  red
  medium      #d97706  amber
  low         #2563eb  blue
  info        #6b7280  gray

Role badge colours:
  admin       purple  (critical variant)
  lead        blue
  consultant  teal    (success variant)
  view_only   gray    (neutral variant)

Dropdown menus (Manage buttons): position absolute, zIndex 200+,
  overflow visible on parent container — never use
  overflow:hidden on a container that has a dropdown child.

---

## Testing

Backend: pytest + pytest-asyncio
  Test database: rawreporter_test (separate from dev DB)
  All tests use session fixtures that rollback after each test
  session.commit is patched to session.flush in tests so that
  route handler writes stay within the rolled-back transaction.
  Run: cd backend && pytest tests/ -v

Frontend: manual browser verification per step

Key test files:
  tests/test_models.py         Model + relationship tests
  tests/test_rbac.py           Permission and role tests
  tests/test_document_generation.py  (Phase 4, not yet built)

---

## Environment

Local dev only (no production deployment yet).
Only the PostgreSQL database runs in Docker (container: rr-db).
Backend runs on host: cd backend && uvicorn rawreporter.main:app
  --reload --port 8000
Frontend runs on host: cd frontend && npm run dev  (port 5173)

DATABASE_URL: postgresql+asyncpg://rawreporter:rawreporter
              @localhost:5432/rawreporter
Test DB:      postgresql+asyncpg://rawreporter:rawreporter
              @localhost:5432/rawreporter_test
