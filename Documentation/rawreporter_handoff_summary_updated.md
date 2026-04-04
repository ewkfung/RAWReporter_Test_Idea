# RAWReporter — Project Handoff Summary (UPDATED)
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
  rawreporter_report_builder_step9.md            — Report Builder Step 9
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
3. Inside the Report Builder, clicks "+ Add Findings from Library"
4. LibrarySelectModal opens (no severity filter — user can select any severity)
5. Consultant selects findings (single or bulk) and clicks Add
6. Backend groups findings by severity_default and adds them to appropriate sections
7. Findings are copied from library into the report sections
8. Library original is never modified by report-level changes

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
  /reports/:id/build — Report Builder page. Standard sidebar navigation visible.
  /settings/users   — Admin only. User list with role assignment.

---

## REPORT BUILDER — DETAILED SPECIFICATION

### Access
- Route: `/reports/:id/build`
- Accessible from Reports page via clicking row or "Open Builder" button
- Standard sidebar navigation remains visible (left pane)
- Working area is on the right

### Layout Structure (Top to Bottom)

1. **Report Title Box**
   - Large editable text input showing report.title
   - Saves on blur (debounced 500ms) via PATCH /reports/:id
   - Shows "Saved" indicator on successful save

2. **Executive Summary**
   - Textarea editing report_sections.body_text where section_type='executive_summary'
   - Saves on blur (debounced 500ms) via PATCH /sections/:id
   - Min-height 200px, auto-expand

3. **Findings Review**
   - Textarea editing report_sections.body_text where section_type='findings_summary'
   - Same save behavior as Executive Summary

4. **Crown Jewel Analysis**
   - Textarea editing report_sections.body_text where section_type='crown_jewel'
   - Same save behavior as Executive Summary

5. **Findings Overview Chart**
   - SVG horizontal bar chart showing count per severity
   - Data: aggregate findings by severity_effective
   - Colors match severity palette
   - 600px × 300px
   - No export functionality (chart regenerated fresh in Phase 4 for Word docs)

6. **Findings Section**
   - Header: "Findings" + "+ Add Findings from Library" button (top-right)
   - Clicking button opens LibrarySelectModal (no severity filter)
   - Five severity subsections in order:
     - Critical Findings
     - High Findings
     - Medium Findings
     - Low Findings
     - Informational
   - Each subsection shows:
     - Section header with severity name + finding count badge
     - Left border (4px) in severity color
     - List of FindingCards
     - Empty state if no findings

7. **Conclusion**
   - Textarea editing report_sections.body_text where section_type='closing'
   - Same save behavior as Executive Summary

8. **Generate Report Button**
   - Primary button (purple), centered at bottom
   - On click: validates all findings for placement overrides + justifications
   - If validation fails: shows error modal listing findings without justification
   - If validation passes: shows pending modal (Phase 4 placeholder)
   - Does NOT generate actual DOCX yet (Phase 4)

### Finding Card Specification

**Display:**
- Severity badge (shows severity_effective)
- "Overridden" indicator if severity_override is set
- Title (font-medium)
- Description (line-clamp-2)
- Affected systems (if present)
- Edit button (ghost)
- Delete button (ghost, red text)

**Actions:**
- Edit → opens FindingFormModal
- Delete → confirmation modal → DELETE /findings/:id

### Finding Form Modal Specification

**Fields:**
- Title (text input)
- Description (textarea, 4 rows)
- Recommendation (textarea, 4 rows)
- Severity Override (dropdown: null | Critical | High | Medium | Low | Informational)
  - Shows severity_default as read-only badge
  - Warning if changed: "Changing severity may move this finding to a different section. Provide justification below."
- Override Justification (textarea, required if severity_override set or is_placement_override true)
  - Min 20 characters
  - Character count shown
- Affected Systems (textarea, 2 rows)
- Evidence (textarea, 2 rows — file upload post-MVP)

**Behavior:**
- Loads via GET /findings/:id
- Saves via PATCH /findings/:id
- Validation: severity_override requires justification ≥20 chars
- On save: refetch findings, close modal, show toast

### Library Select Modal

**DO NOT REBUILD** — use existing component from Step B6 at:
`src/components/modals/LibrarySelectModal.tsx`

**Usage:**
- Props: `{ reportId, isOpen, onClose, onFindingsAdded }`
- No severity filter passed (user can select any severity)
- Multi-select checkboxes
- On "Add Selected":
  - Group selected findings by severity_default
  - Make one POST call per target severity section
  - POST /reports/:reportId/sections/:sectionId/findings with {library_finding_ids: [...]}
- Backend copies findings from library to appropriate sections
- On close: callback refetches all sections

### Save Behavior — CONFIRMED

**All text inputs (Report Title, section textareas):**
- Save on blur event
- Debounced 500ms (wait in case user immediately refocuses)
- PATCH to appropriate endpoint (/reports/:id or /sections/:id)
- Show "Saved" checkmark indicator (fades after 2 seconds)
- No explicit "Save" button needed

### Drag-and-Drop — DEFERRED TO STEP 10

**Step 9 does NOT implement drag-and-drop.**
- Findings render in their sections based on severity_effective
- Display order uses display_order field (ascending)
- No dragging capability yet
- Step 10 will add dnd-kit with the following flow:
  - User drags finding from one severity section to another
  - Before drop completes, modal opens: "Justify severity change"
  - Modal shows old severity, new severity, requires justification textarea
  - Cancel → drop aborts, finding stays in original section
  - Confirm → PATCH /findings/:id with severity_override + justification
  - Finding moves to new section, shows "Overridden" indicator

### Permission Handling

**Use `usePermission` hook to control:**
- `reports:update` → can edit text boxes
- `findings:create` → can add findings from library
- `findings:update` → can edit findings
- `findings:delete` → can delete findings

**View Only role:**
- All textareas are read-only (disabled)
- All Edit/Delete buttons hidden (not just disabled)
- Can view everything, change nothing

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
  Dashboard, Clients, Engagements, Reports pages              ✓

Currently working on:
  Phase 5 Step 9 — Report Builder (static layout, no drag-and-drop)

Not yet started:
  Phase 5 Step 10 — dnd-kit drag and drop (sections + findings)
  Phase 5 Step 11 — SeverityOverrideModal + GenerationBlockedModal
  Phase 5 Step 12 — Polish (loading states, error states, toasts)
  Phase 4 — Document generation (after Phase 5 complete)

---

## WHAT TO WORK ON NEXT

**Current task:** Phase 5 Step 9 — Report Builder (static layout)

**Instruction file:** `/mnt/user-data/outputs/rawreporter_report_builder_step9.md`

**To start with Claude Code:**
```
Read /mnt/user-data/outputs/rawreporter_report_builder_step9.md and implement Phase 5 Step 9 as specified. Read CLAUDE.md first for full project context.
```

**After Step 9 is complete and verified:**
- Move to Phase 5 Step 10 — dnd-kit drag-and-drop implementation
- This will add the drag-to-change-severity feature with justification modal

---

## KEY ARCHITECTURAL DECISIONS MADE IN THIS SESSION

### 1. Admin Quick Access — DELETED
**Original proposal:** Quick access link in sidebar to a "default layout" Report Builder not associated with any report.

**Decision:** Feature deleted. Use one of these alternatives:
- Seed a test report in database, bookmark `/reports/{test-id}/build`
- Add `?preview=true` query param for dev-only mock data (if needed)

**Reasoning:** 
- Reports are engagement-scoped by design
- "Not associated with any report" has no clear data model
- Solves a development convenience problem, not a user problem
- Proper solution is post-MVP "Template Gallery" feature (documented below)

### 2. Section Text Content Storage — CONFIRMED
**Decision:** All section body text (Executive Summary, Crown Jewel, Conclusion, etc.) is stored in `report_sections.body_text`, NOT as new fields on the `reports` table.

**Why this is correct:**
- Maintains database normalization
- Preserves flexibility (reorder sections, hide/show, add new types)
- Avoids dual source of truth
- No schema migrations needed for new section types
- Easier to query across all sections

**Frontend implementation:**
- Each SectionTextBox component fetches the section where `section_type = 'executive_summary'` (or other type)
- Displays `section.body_text` in textarea
- Saves via PATCH /sections/:sectionId with {body_text: "..."}

### 3. Findings Overview Chart — Option A
**Decision:** Build simple SVG horizontal bar chart in Report Builder showing severity counts.

**Phase 4 behavior:** 
- python-docx generator will query the same data (finding counts by severity)
- Generate fresh chart in Word document
- Do NOT try to "export" the frontend SVG chart

**Reasoning:** Frontend chart and document chart are separate concerns, use same data source.

### 4. Drag-and-Drop Severity Changes — Option B with Justification Modal
**Decision:** Dragging a finding between severity sections is allowed, but triggers justification modal before drop completes.

**Flow (implemented in Step 10):**
1. User drags finding from High to Medium section
2. Before visual move, modal opens
3. Modal shows: old severity badge, new severity badge, justification textarea
4. Cancel → drop aborted, finding stays in original section
5. Confirm → PATCH /findings/:id with {severity_override: 'medium', override_justification: "..."}
6. Finding moves to Medium section, shows "Overridden" indicator

**Reasoning:** Enforces business rule that severity overrides require justification.

### 5. Autosave Strategy — Save-on-Blur
**Decision:** All text inputs save on blur event, debounced 500ms.

**Implementation:**
- User edits textarea, clicks away → onBlur fires
- Wait 500ms (in case they immediately refocus)
- PATCH to backend (/reports/:id or /sections/:id)
- Show "Saved" checkmark indicator (fades after 2 seconds)

**Not implemented:**
- Real-time autosave every N seconds (complex, requires conflict resolution)
- Explicit "Save" button (unnecessary with blur-save)

**Reasoning:** Simpler than timer-based autosave, safer than no autosave, avoids premature saves.

---

## DEFERRED FEATURES (do not build yet)

  Template Gallery (Post-MVP)
    — Allow Admins to create report templates not tied to engagements
    — Use for testing export formatting, creating reusable templates
    — Preview mode at /templates/:id/preview
    — Instantiate templates into real reports via dropdown on New Report form
    — Requires: Phase 4 complete, Report Builder stable
    — Priority: Low (post-MVP, after multi-tenancy and client portal)
    
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
15. Section body text (Executive Summary, Crown Jewel, Conclusion) is
    stored in report_sections.body_text — NOT in reports table fields
16. LibrarySelectModal (from Step B6) is reused — do not rebuild it
17. Save behavior is on-blur with 500ms debounce — not timer-based autosave
18. Step 9 does NOT include drag-and-drop — that's Step 10 with dnd-kit

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

---

## CONVERSATION SUMMARY — KEY DECISIONS

**Session date:** April 3, 2026

**What we discussed:**
1. Reviewed original handoff summary and Report Builder vision
2. Stress-tested initial Report Builder design proposal
3. Identified and fixed architectural flaws
4. Made 5 critical design decisions (documented above)
5. Created Phase 5 Step 9 instruction file

**Major corrections made:**
- Deleted Admin Quick Access feature (no clear data model or user value)
- Confirmed section text uses existing report_sections.body_text schema
- Chose SVG chart approach (regenerate in Phase 4, not export)
- Designed drag-and-drop with mandatory justification modal
- Specified save-on-blur strategy (simpler than real-time autosave)

**Files created:**
- `rawreporter_report_builder_step9.md` — full instruction for Claude Code

**Next steps:**
1. Run Claude Code with Step 9 instruction file
2. Test Report Builder in browser
3. Verify all components working (checklist in instruction file)
4. Report back with results
5. Move to Step 10 (dnd-kit drag-and-drop) after Step 9 confirmed

**Mentor stance maintained:** Ruthless stress-testing of ideas, no sugarcoating, explain *why* things are wrong, get to bulletproof solutions.
