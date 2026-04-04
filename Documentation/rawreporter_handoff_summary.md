# RAWReporter — Project Handoff Summary
# Paste this at the start of a new Claude conversation to resume where you left off.

---

## WHO I AM AND WHAT WE ARE BUILDING

I am an OT Cybersecurity Consultant with a background providing assessments
to clients in Oil & Gas, Power Generation, Manufacturing, Distribution,
Pharmaceutical, Chemical, and Refining verticals.

We are building RAWReporter — a cybersecurity assessment reporting platform
for OT/IT consulting firms. It generates professional DOCX reports from
structured findings data. Consultants use it to document penetration tests,
gap assessments, vulnerability assessments, tabletop exercises, TSA directive
assessments, and compliance assessments.

The platform is being built solo using Claude and Claude Code.
You are my ruthless mentor. Stress test my ideas. If something is wrong,
tell me why. Get everything to the point where it is bulletproof.

---

## REFERENCE DOCUMENTS

I have the following files already built and saved. Ask me to share any of
them if you need to reference them:

  CLAUDE.md                                      — full project context for
                                                   Claude Code, read this first
  cybersec_reporting_data_model_v3.drawio        — ERD in draw.io format
  rawreporter_project_structure.md               — full directory layout,
                                                   stack decisions, build order
  rawreporter_rbac_library_redesign.md           — RBAC + library redesign
                                                   instruction for Claude Code
  rawreporter_dashboard_clients_engagements      — Dashboard, Clients,
    _reports.md                                    Engagements, Reports pages
                                                   instruction for Claude Code

---

## TECH STACK

Backend:   Python 3.12, FastAPI, SQLAlchemy 2.0 async, Alembic, PostgreSQL 16
Auth:      FastAPI-Users with JWT
Docs:      python-docx + Jinja2 (Phase 4 — deferred)
Frontend:  React 18, TypeScript, Vite, dnd-kit, Axios, React Query, Zustand
Local dev: Docker Compose
Editor:    VS Code

---

## DATABASE — CORE TABLES

clients
engagements
reports
report_sections
findings
finding_references
evidence
library_findings
library_finding_references
roles
permissions
role_permissions
user_roles
users (FastAPI-Users)

Key schema decisions locked in:
- All PKs are UUIDs
- severity_default copied from library at import, never changed per-report
- severity_override is nullable, set per-report by consultant
- severity_effective = severity_override ?? severity_default
- is_placement_override = True when finding sits in a section whose
  severity_filter does not match severity_effective
- override_justification required when is_placement_override = True
- Report generation blocked if any finding has is_placement_override = True
  and override_justification is NULL or empty
- library_findings has is_archived, archived_at, archived_by fields
- Archived findings hidden from standard library list, visible only at
  GET /library/archived
- report_sections has section_type enum and severity_filter field
- FINDING_REFERENCE child table handles multi-value CVE/CWE/CISA/NIST/
  NVD/Manufacturer references (not array columns)

Default 10 report sections seeded on report creation:
  1  executive_summary    no severity filter  visible
  2  findings_summary     no severity filter  visible
  3  crown_jewel          no severity filter  visible (body text only, MVP)
  4  critical_findings    critical            visible
  5  high_findings        high                visible
  6  medium_findings      medium              visible
  7  low_findings         low                 visible
  8  informational        informational       visible
  9  closing              no severity filter  visible
  10 appendix             no severity filter  hidden by default

---

## RBAC SYSTEM

Four built-in roles (is_system_role = True):
  admin      — full access including user management and library management
  lead       — create/edit engagements, reports, findings, view library
  consultant — create/edit/delete findings, edit report sections, generate
  view_only  — read everything, change nothing

First registered user automatically receives Admin role.
All subsequent users default to View Only.
Only Admin can create users, assign roles, manage library findings.

Permission format: "resource:action"
Backend: require_permission("resource", "action") dependency
Frontend: usePermission("resource", "action") hook → hide buttons entirely
          when user lacks permission, never just disable them

---

## WORKFLOW — HOW FINDINGS GET INTO REPORTS

1. Admin creates library findings (master templates)
2. Consultant opens a report in the Report Builder
3. Inside a severity section, clicks "+ Add Findings from Library"
4. LibrarySelectModal opens, pre-filtered to section severity
5. Consultant selects findings (single or bulk) and clicks Add
6. Findings are copied from library into the report section
7. Library original is never modified by report-level changes

The Library page (/library) is a management page only — Admin creates,
edits, archives, and deletes findings there. Consultants browse it but
add findings only from within the report builder.

There is NO standalone Findings page in the navigation.
Findings only exist within reports and are accessed through the builder.

---

## PAGE STRUCTURE AND NAVIGATION

Sidebar:
  Dashboard         /
  Clients           /clients
  Engagements       /engagements
  Reports           /reports
  Library           /library
  Settings > Users  /settings/users  (Admin only)

Page behaviours:
  /clients       — collapsed row list, expand to see contact info +
                   engagements for that client. One row open at a time.
                   Supports ?expand={id} URL param.
  /engagements   — collapsed row list, expand to see scope, dates, lead,
                   reports for that engagement. Manage dropdown on each row.
                   Supports ?expand={id} URL param.
  /reports       — flat list (no expand). Clicking a row or "Open Builder"
                   navigates directly to /reports/{id}/build.
                   No separate report detail page.
  /library       — collapsed row list, Admin sees Manage dropdown
                   (Edit, Archive, Delete). All roles can browse.
  /library/archive — Admin only. Archived findings with Restore button.
  /reports/:id/build — Full-screen Report Builder. Custom topbar. No sidebar.
  /settings/users   — Admin only. User list with role assignment.

---

## VISUAL STYLE

Polished SaaS. Light mode only (dark mode deferred).
No external component library — all components built from scratch.
Inter font from Google Fonts.
CSS custom properties in src/styles/globals.css.

Severity colours:
  critical  #7c3aed  purple
  high      #dc2626  red
  medium    #d97706  amber
  low       #2563eb  blue
  info      #6b7280  gray

Role badge colours:
  admin      purple
  lead       blue
  consultant teal
  view_only  gray

Collapsed row list pattern used across Clients, Engagements, Library:
  White card, subtle shadow, rounded corners
  Chevron shows expand/collapse state
  Left border colour indicates status or severity
  Only one row expanded at a time (except Library)
  Lazy load child data on first expand

---

## CURRENT BUILD STATUS

Completed:
  Phase 1 — Models + Alembic migrations                       ✓
  Phase 2 — API skeleton (all CRUD routes)                    ✓
  Phase 3 — Business logic (services)                         ✓
  Phase 4 — Document generation                               DEFERRED
  Phase 5 Step 1-4 — Frontend scaffold + Auth                 ✓
  RBAC backend (A1-A8)                                        ✓
  Library redesign + user management frontend (B1-B9)         ✓
  Dashboard, Clients, Engagements, Reports pages              IN PROGRESS

Not yet started:
  Phase 5 Steps 9-12:
    Step 9  — Report Builder (static layout, no drag yet)
    Step 10 — dnd-kit drag and drop (sections + findings)
    Step 11 — SeverityOverrideModal + GenerationBlockedModal
    Step 12 — Polish (loading states, error states, toasts)
  Phase 4 — Document generation (after Phase 5 complete)

---

## WHAT TO WORK ON NEXT

The immediate next task depends on where the Dashboard/Clients/
Engagements/Reports pages are in the browser. If those are complete
and verified, the next task is:

Phase 5 Step 9 — Report Builder (static layout first, no drag and drop yet)

The Report Builder instruction is in the original Phase 5 Claude Code
prompt. The relevant section starts at "STEP 9 — Report Builder"
in that prompt. Key points:

  - Full-screen page at /reports/:id/build
  - Two-panel layout: Library Panel (320px left) + Report Canvas (rest)
  - Both panels scroll independently
  - Custom topbar: report title (inline editable), audience badge,
    breadcrumb, Generate Report button
  - Build static layout first — sections and findings render,
    FindingFormModal works, severity changes work, generate button
    shows pending modal
  - Do NOT add dnd-kit until Step 9 is confirmed working
  - dnd-kit comes in Step 10

For the Report Builder, the "Add Findings" button inside each severity
section opens LibrarySelectModal (already built in B6) — not the old
AddToReportModal pattern. Make sure Claude Code uses the correct component.

---

## KEY RULES TO ENFORCE WITH CLAUDE CODE

1. Read CLAUDE.md before starting every session
2. All enums import from utils/enums.py — never redefine inline
3. Business logic stays in services/ — routers stay thin
4. Document generation stays in generators/
5. All SQLAlchemy is async — never sync
6. All PKs are UUIDs
7. Permission checks use require_permission dependency (backend)
   and usePermission hook (frontend)
8. Hide buttons for permission reasons — never just disable them
9. seed_rbac is idempotent — use ON CONFLICT DO NOTHING
10. No raw Axios calls outside src/api/ files
11. Findings are added to reports via LibrarySelectModal inside
    the report builder — NOT from the Library page
12. There is no standalone Findings page
13. Stop after each step and wait for confirmation before proceeding
14. Do not let Claude Code run too far ahead — one step at a time

---

## DEFERRED FEATURES (do not build yet)

  Crown Jewel Analysis table (CROWN_JEWEL, CROWN_JEWEL_FINDING)
    — deferred post-MVP. The crown_jewel section renders as body
      text only for now.
  Questionnaire engine
    — library_findings.questionnaire_trigger field exists as a
      string array, engine deferred post-MVP
  Custom roles with granular permission builder UI
    — four hardcoded roles for now, custom roles post-MVP
  Dark mode
    — light mode only for now
  PDF output
    — DOCX only for now
  Client read-only portal
    — post-MVP
  Multi-tenancy / firm isolation
    — post-MVP
  SSO / SAML
    — post-MVP
  Collaborative editing
    — post-MVP
  Metrics dashboard
    — post-MVP

---

## HOW TO RESUME

1. Paste this entire document into a new Claude conversation
2. Tell Claude which step you are on or what you just completed
3. Share CLAUDE.md if Claude needs to reference the full project context
4. Share the relevant instruction .md file if you are starting a new
   build step
5. Start each Claude Code session by telling it:
   "Read CLAUDE.md before starting. We are on [step]. Here is what
   was completed last session: [brief summary]. Continue from here."
