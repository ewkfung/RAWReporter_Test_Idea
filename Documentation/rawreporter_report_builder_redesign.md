# RAWReporter — Report Builder Redesign
# Claude Code Instruction Set
# Five Assessment-Type Builders + Default Text Management Page

---

## CONTEXT

This instruction redesigns the Report Builder and related backend
logic. Read CLAUDE.md before starting anything.

The core change: the engagement type now dictates which report
builder is used. There are five builders, each with a fixed
section structure. Sections are not reorderable — order is fixed
per builder type.

Everything related to Findings stays exactly as built:
  - Five severity sub-sections (Critical, High, Medium, Low, Info)
  - LibrarySelectModal workflow
  - Finding cards, FindingFormModal, SeverityOverrideModal
  - is_placement_override logic
  Do NOT touch any of this.

Build in the exact order below. Stop after each step and wait
for confirmation before proceeding.

---

## SECTION STRUCTURES (source of truth)

VULNERABILITY (engagement type: vulnerability_assessment)
  Position 1:  report_title              Text box
  Position 2:  executive_summary         Text box
  Position 3:  crown_jewel               Text box
  Position 4:  scope_and_methodology     Text box
  Position 5:  findings_summary          Text box
  Position 6:  findings                  Findings (severity sub-sections)
  Position 7:  remediation_roadmap       Text box
  Position 8:  closing                   Text box
  Position 9:  appendix                  Text box

PENETRATION TESTING (engagement type: pentest)
  Position 1:  report_title                      Text box
  Position 2:  executive_summary                 Text box
  Position 3:  scope_and_rules_of_engagement     Text box
  Position 4:  methodology                       Text box
  Position 5:  attack_path                       Text box
  Position 6:  findings_summary                  Text box
  Position 7:  findings                          Findings
  Position 8:  closing                           Text box
  Position 9:  appendix                          Text box

RISK (engagement type: risk)
  Position 1:  report_title                Text box
  Position 2:  executive_summary           Text box
  Position 3:  crown_jewel                 Text box
  Position 4:  scope_and_methodology       Text box
  Position 5:  risk_assessment_approach    Text box
  Position 6:  risk_assessment_result      Text box
  Position 7:  findings_summary            Text box
  Position 8:  findings                    Findings
  Position 9:  closing                     Text box
  Position 10: appendix                    Text box

COMPLIANCE (engagement type: compliance_assessment)
  Position 1:  report_title                    Text box
  Position 2:  executive_summary               Text box
  Position 3:  crown_jewel                     Text box
  Position 4:  scope_and_methodology           Text box
  Position 5:  compliance_framework_overview   Text box
  Position 6:  findings_summary                Text box
  Position 7:  findings                        Findings
  Position 8:  compliance_maturity             Text box
  Position 9:  remediation_roadmap             Text box
  Position 10: closing                         Text box
  Position 11: appendix                        Text box

SECURITY GAP (engagement type: gap_assessment)
  Position 1:  report_title            Text box
  Position 2:  executive_summary       Text box
  Position 3:  crown_jewel             Text box
  Position 4:  scope_and_methodology   Text box
  Position 5:  gap_analysis            Text box
  Position 6:  findings_summary        Text box
  Position 7:  findings                Findings
  Position 8:  remediation_roadmap     Text box
  Position 9:  closing                 Text box
  Position 10: appendix                Text box

---

## PART A — BACKEND

===================================================
STEP A1 — Update Enums
===================================================

File: backend/rawreporter/utils/enums.py

Add to EngagementTypeEnum:
  risk = "risk"

Remove from EngagementTypeEnum (keep the values in the
enum so existing DB data is not broken, but mark them
as legacy — they will be hidden from the UI):
  Do NOT remove tabletop or tsa_directive from the enum.
  Add a comment: # legacy — hidden from UI, no builder yet
  The enum values stay to preserve DB integrity.

Add to SectionTypeEnum — add ALL of these new values:
  report_title = "report_title"
  scope_and_methodology = "scope_and_methodology"
  scope_and_rules_of_engagement = "scope_and_rules_of_engagement"
  methodology = "methodology"
  attack_path = "attack_path"
  risk_assessment_approach = "risk_assessment_approach"
  risk_assessment_result = "risk_assessment_result"
  compliance_framework_overview = "compliance_framework_overview"
  compliance_maturity = "compliance_maturity"
  gap_analysis = "gap_analysis"
  remediation_roadmap = "remediation_roadmap"

Keep all existing SectionTypeEnum values intact.
The findings section type already exists — do not add it again.

Generate a new Alembic migration to update the PostgreSQL
enum types for EngagementTypeEnum and SectionTypeEnum.
Run the migration and confirm it applies cleanly before
proceeding.

===================================================
STEP A2 — report_default_templates Table
===================================================

File: backend/rawreporter/models/report_default_template.py

class ReportDefaultTemplate(Base, TimestampMixin):
  __tablename__ = "report_default_templates"

  id: uuid PK
  engagement_type: EngagementTypeEnum (not null)
  section_type: SectionTypeEnum (not null)
  default_body: text (nullable)
  updated_by: uuid FK → users.id (nullable)

  UniqueConstraint(engagement_type, section_type)

This table stores one row per engagement_type + section_type
combination. When a new report is created, the system looks
up the matching default_body for each section and pre-populates
it. If no row exists for a combination, the section body
starts as None (empty).

Add the model to backend/rawreporter/models/__init__.py
Generate a new Alembic migration for this table.
Run and confirm before proceeding.

===================================================
STEP A3 — Update report_service.py seed_report_sections
===================================================

File: backend/rawreporter/services/report_service.py

Replace the current seed_report_sections function with a
new version that branches by engagement type.

async def seed_report_sections(
    report_id: UUID,
    engagement_type: EngagementTypeEnum,
    session: AsyncSession
) -> list[ReportSection]:

  1. Look up the section list for this engagement_type
     using the SECTION_STRUCTURES mapping below.
     Raise HTTP 422 if engagement_type has no mapping
     (covers tabletop and tsa_directive).

  2. For each section in the list, fetch the default body:
     SELECT default_body FROM report_default_templates
     WHERE engagement_type = {engagement_type}
     AND section_type = {section_type}
     If no row exists: default_body = None

  3. Create a ReportSection for each entry:
       report_id = report_id
       section_type = section_type from mapping
       title = display name from mapping (see below)
       body = default_body fetched in step 2
       position = position from mapping
       is_visible = True for all sections
       severity_filter = set only for the findings section
         (keep existing logic: findings section contains
          five severity sub-sections handled by the frontend)

  4. Return the created sections.

SECTION_STRUCTURES mapping (use this exact structure):

SECTION_STRUCTURES = {
  EngagementTypeEnum.vulnerability_assessment: [
    (1,  SectionTypeEnum.report_title,          "Report Title"),
    (2,  SectionTypeEnum.executive_summary,     "Executive Summary"),
    (3,  SectionTypeEnum.crown_jewel,           "Crown Jewel Analysis"),
    (4,  SectionTypeEnum.scope_and_methodology, "Scope and Methodology"),
    (5,  SectionTypeEnum.findings_summary,      "Findings Summary"),
    (6,  SectionTypeEnum.findings,              "Findings"),
    (7,  SectionTypeEnum.remediation_roadmap,   "Remediation Roadmap"),
    (8,  SectionTypeEnum.closing,               "Closing"),
    (9,  SectionTypeEnum.appendix,              "Appendix"),
  ],
  EngagementTypeEnum.pentest: [
    (1,  SectionTypeEnum.report_title,                   "Report Title"),
    (2,  SectionTypeEnum.executive_summary,              "Executive Summary"),
    (3,  SectionTypeEnum.scope_and_rules_of_engagement,  "Scope and Rules of Engagement"),
    (4,  SectionTypeEnum.methodology,                    "Methodology"),
    (5,  SectionTypeEnum.attack_path,                    "Attack Path"),
    (6,  SectionTypeEnum.findings_summary,               "Findings Summary"),
    (7,  SectionTypeEnum.findings,                       "Findings"),
    (8,  SectionTypeEnum.closing,                        "Closing"),
    (9,  SectionTypeEnum.appendix,                       "Appendix"),
  ],
  EngagementTypeEnum.risk: [
    (1,  SectionTypeEnum.report_title,             "Report Title"),
    (2,  SectionTypeEnum.executive_summary,        "Executive Summary"),
    (3,  SectionTypeEnum.crown_jewel,              "Crown Jewel Analysis"),
    (4,  SectionTypeEnum.scope_and_methodology,    "Scope and Methodology"),
    (5,  SectionTypeEnum.risk_assessment_approach, "Risk Assessment Approach"),
    (6,  SectionTypeEnum.risk_assessment_result,   "Risk Assessment Result"),
    (7,  SectionTypeEnum.findings_summary,         "Findings Summary"),
    (8,  SectionTypeEnum.findings,                 "Findings"),
    (9,  SectionTypeEnum.closing,                  "Closing"),
    (10, SectionTypeEnum.appendix,                 "Appendix"),
  ],
  EngagementTypeEnum.compliance_assessment: [
    (1,  SectionTypeEnum.report_title,                  "Report Title"),
    (2,  SectionTypeEnum.executive_summary,             "Executive Summary"),
    (3,  SectionTypeEnum.crown_jewel,                   "Crown Jewel Analysis"),
    (4,  SectionTypeEnum.scope_and_methodology,         "Scope and Methodology"),
    (5,  SectionTypeEnum.compliance_framework_overview, "Compliance Framework Overview"),
    (6,  SectionTypeEnum.findings_summary,              "Findings Summary"),
    (7,  SectionTypeEnum.findings,                      "Findings"),
    (8,  SectionTypeEnum.compliance_maturity,           "Compliance Maturity"),
    (9,  SectionTypeEnum.remediation_roadmap,           "Remediation Roadmap"),
    (10, SectionTypeEnum.closing,                       "Closing"),
    (11, SectionTypeEnum.appendix,                      "Appendix"),
  ],
  EngagementTypeEnum.gap_assessment: [
    (1,  SectionTypeEnum.report_title,          "Report Title"),
    (2,  SectionTypeEnum.executive_summary,     "Executive Summary"),
    (3,  SectionTypeEnum.crown_jewel,           "Crown Jewel Analysis"),
    (4,  SectionTypeEnum.scope_and_methodology, "Scope and Methodology"),
    (5,  SectionTypeEnum.gap_analysis,          "Gap Analysis"),
    (6,  SectionTypeEnum.findings_summary,      "Findings Summary"),
    (7,  SectionTypeEnum.findings,              "Findings"),
    (8,  SectionTypeEnum.remediation_roadmap,   "Remediation Roadmap"),
    (9,  SectionTypeEnum.closing,               "Closing"),
    (10, SectionTypeEnum.appendix,              "Appendix"),
  ],
}

Update the reports router to pass engagement_type to
seed_report_sections. The engagement_type must be fetched
from the engagement record when creating the report.

===================================================
STEP A4 — Default Template Endpoints
===================================================

Create: backend/rawreporter/routers/templates.py

All routes require the report_default_template:edit
permission (see permission note below).

GET /api/v1/templates/
  Returns all ReportDefaultTemplate rows.
  Group by engagement_type in the response:
  {
    "vulnerability_assessment": [
      {"section_type": "executive_summary",
       "title": "Executive Summary",
       "default_body": "...",
       "updated_at": "..."},
      ...
    ],
    "pentest": [...],
    ...
  }
  Only include engagement types that have builders
  (exclude tabletop, tsa_directive).

GET /api/v1/templates/{engagement_type}
  Returns all template rows for a specific engagement_type.
  Returns sections in position order matching
  SECTION_STRUCTURES for that type.
  For sections with no saved template row yet, return
  the section with default_body = null.
  This means the response always has the complete section
  list for the builder type, whether or not defaults
  are saved.

PUT /api/v1/templates/{engagement_type}/{section_type}
  Upsert — create if not exists, update if exists.
  Body: { "default_body": "..." }
  Sets updated_by = current user id.
  Returns the updated ReportDefaultTemplate.
  Requires report_default_template:edit permission.

Add report_default_template as a new resource in the
permissions system:
  Add to seed_rbac.py:
    resource: "report_default_template"
    actions: "view", "edit"
  Admin role gets both view and edit.
  All other roles get view only.
  Re-run seed (idempotent — safe to add new permissions).

Include templates router in main.py with prefix /api/v1.

===================================================
STEP A5 — Backend Tests
===================================================

Add to tests/test_report_builder.py:

  test_vulnerability_report_seeds_correct_sections
    Create engagement with type=vulnerability_assessment
    Create report for that engagement
    Fetch sections for the report
    Assert exactly 9 sections in correct order
    Assert section types match SECTION_STRUCTURES exactly
    Assert findings section exists at position 6

  test_pentest_report_seeds_correct_sections
    Same pattern — 9 sections, pentest structure

  test_risk_report_seeds_correct_sections
    10 sections, risk structure

  test_compliance_report_seeds_correct_sections
    11 sections, compliance structure

  test_gap_report_seeds_correct_sections
    10 sections, gap_assessment structure

  test_default_body_populates_on_report_creation
    Create a ReportDefaultTemplate row:
      engagement_type = vulnerability_assessment
      section_type = executive_summary
      default_body = "This report presents..."
    Create a vulnerability report
    Fetch sections
    Assert executive_summary section body ==
      "This report presents..."

  test_section_with_no_default_starts_empty
    Create vulnerability report with no template rows saved
    Fetch sections
    Assert all section bodies are None

  test_tabletop_engagement_cannot_create_report
    Create engagement with type=tabletop
    Attempt to create report
    Assert HTTP 422 returned

  test_template_upsert
    PUT /templates/vulnerability_assessment/executive_summary
    Assert row created
    PUT again with different text
    Assert row updated, not duplicated

Run pytest. All tests must pass before proceeding to Part B.

---

## PART B — FRONTEND

===================================================
STEP B1 — Update Engagement Form
===================================================

File: src/components/engagements/EngagementFormModal.tsx

Update the type Select dropdown to show only these options:
  Vulnerability Assessment  → vulnerability_assessment
  Penetration Testing       → pentest
  Risk Assessment           → risk
  Compliance Assessment     → compliance_assessment
  Security Gap Assessment   → gap_assessment

Remove from the dropdown (do not remove from the enum,
just exclude from the options list):
  Tabletop Exercise         (tabletop)
  TSA Directive             (tsa_directive)

If an existing engagement has type tabletop or tsa_directive,
display it as a read-only badge in the form — do not allow
changing it to a builder type or back. Show a note:
  "This engagement type does not have a report builder yet."

===================================================
STEP B2 — Report Builder Page Refactor
===================================================

File: src/pages/reports/ReportBuilderPage.tsx

The Report Builder must detect the engagement type from
the report and render the correct section structure.

On mount:
  1. Fetch the report by ID: GET /api/v1/reports/{id}
  2. Fetch the engagement by engagement_id from the report
  3. Determine builder type from engagement.type
  4. Fetch sections: GET /api/v1/reports/{id}/sections
     (sections are already seeded correctly by the backend)
  5. Load everything into reportBuilderStore

The builder layout stays the same:
  Left panel (320px): Library Panel
  Main panel: Report Canvas

The topbar shows:
  Report title (from report_title section body, not the
  report.title field — see note below)
  Builder type badge: "Vulnerability" | "Penetration Testing" |
    "Risk" | "Compliance" | "Security Gap"
  Engagement name → Client name breadcrumb
  Generate Report button (right)

NOTE on Report Title:
  report_title is now a section with a text box, not just
  the report.title field. The topbar should display the
  content of the report_title section body as the working
  title. If the report_title section body is empty, fall
  back to report.title. When the consultant edits the
  Report Title section, the topbar updates reactively.

===================================================
STEP B3 — Report Canvas Component
===================================================

File: src/components/report/ReportCanvas.tsx

REMOVE drag-and-drop reordering of sections entirely.
Sections are fixed in the order returned by the API.
Remove DndContext and SortableContext from section-level
drag and drop. Keep finding-level drag and drop within
and across severity sub-sections — that is unchanged.

Remove the drag handle from SectionBlock headers.
Sections cannot be moved.

Render sections in the order returned from the API
(already sorted by position on the backend).

===================================================
STEP B4 — SectionBlock Component
===================================================

File: src/components/report/SectionBlock.tsx

Each section renders differently based on section_type.

TEXT BOX SECTIONS (all sections except findings):
  Header row:
    Section title (bold, from section.title)
    Collapse/expand chevron (right side)
    Visibility toggle — eye icon, calls PATCH section
      is_visible update (Admin and Lead only —
      usePermission("report", "edit"))
    No drag handle (sections are not reorderable)

  Expanded body:
    Rich text area (Textarea component) for section body
    Auto-saves on blur (PATCH /api/v1/sections/{id}
    with updated body)
    Shows character count below textarea (optional but useful)
    Placeholder text when empty:
      "[Click to add {section title} content]"
      Use gray italic styling for placeholder

  Collapsed state:
    Shows first 120 characters of body text in gray
    If body is empty: shows "[Empty]" in gray italic

FINDINGS SECTION (section_type = "findings"):
  This section renders exactly as currently built.
  Five severity sub-sections (Critical, High, Medium,
  Low, Informational) with FindingCard components.
  "+ Add Findings from Library" button opens
  LibrarySelectModal.
  Do NOT change any of this logic.

REPORT TITLE SECTION (section_type = "report_title"):
  Render as a large prominent text input, not a textarea.
  Single line, larger font (20px, bold).
  No collapse/collapse — always visible, no chevron.
  No visibility toggle — Report Title is always visible.
  Auto-saves on blur.
  Placeholder: "Enter report title..."
  This feeds the topbar title display reactively.

===================================================
STEP B5 — Default Text Management Page
===================================================

File: src/pages/settings/DefaultTemplatesPage.tsx
Route: /settings/templates
Permission: Admin only — redirect to / if user lacks
  usePermission("report_default_template", "edit")

Add to Sidebar under Settings section (below Users):
  Default Templates   /settings/templates
  Only visible if usePermission("report_default_template",
  "edit")

--- Page Layout ---

PageWrapper title="Default Report Templates"

Description text below title (gray, 14px):
  "Set default text for each section type. When a new report
   is created, these defaults pre-populate the relevant
   sections. Consultants can edit the text after the report
   is created."

--- Builder Type Selector ---

Horizontal tab bar with five tabs:
  Vulnerability | Penetration Testing | Risk |
  Compliance | Security Gap

Active tab is underlined in --color-primary.
Clicking a tab loads that builder's section list.
Default: first tab (Vulnerability) active on page load.

--- Section List for Active Builder ---

When a tab is selected, fetch:
  GET /api/v1/templates/{engagement_type}

This returns the complete ordered section list for that
builder type with any saved default_body values.

Render each section as an editable block in order:

  Section header:
    Section title (bold)
    Section type tag (gray pill, smaller text)
    "Saved" indicator — shows green checkmark + "Saved"
    text for 3 seconds after a successful save, then fades

  Section body:
    Textarea component, full width
    Pre-filled with default_body if a saved value exists
    Placeholder when empty:
      "No default text set. Leave blank to start
       reports with an empty section."
    Auto-saves on blur:
      PUT /api/v1/templates/{engagement_type}/{section_type}
      Body: { "default_body": textarea value }
      On success: show "Saved" indicator on that section
      On error: show error toast "Failed to save template"

  FINDINGS section:
    Render as a non-editable info block instead of a textarea:
    Gray background, italic text:
      "Findings are selected from the findings library
       when building a report. No default text applies."
    No save button, no textarea.

  REPORT TITLE section:
    Render as a single-line Input instead of Textarea.
    Placeholder: "No default report title set."
    Same auto-save on blur behavior.

--- Unsaved Changes Warning ---

If the user navigates away from the page with unsaved
changes in any textarea, show a browser confirm dialog:
  "You have unsaved changes. Are you sure you want to leave?"
Use the beforeunload event for this.
Since we auto-save on blur this should rarely trigger,
but it is a safety net.

===================================================
STEP B6 — Update Routing
===================================================

File: src/App.tsx

Add route:
  /settings/templates → DefaultTemplatesPage
  (ProtectedRoute, redirect to / if no
   report_default_template:edit permission)

Update Sidebar to include the new link under Settings.

No other routing changes needed.

===================================================
STEP B7 — Update CLAUDE.md
===================================================

Update the build status section in CLAUDE.md:

Add to completed:
  Report Builder redesign — 5 assessment-type builders  ✓
  Default text management page                          ✓

Update the section structures documentation to reflect
the five builder types instead of the generic 10-section
structure.

Update the deferred features list — remove "generic report
builder" references, note that section reordering has been
intentionally removed (sections are fixed per builder type).

Add to the enums section:
  EngagementTypeEnum now includes: risk
  tabletop and tsa_directive are legacy — kept in enum
  for DB integrity, hidden from UI

===================================================
BUILD ORDER SUMMARY
===================================================

Backend first — all tests must pass before frontend:

  A1 → Update enums + Alembic migration
  A2 → report_default_templates table + migration
  A3 → seed_report_sections refactor
  A4 → Default template endpoints + permissions seed
  A5 → Backend tests (all must pass)

Frontend in order:

  B1 → Engagement form — remove tabletop/TSA from dropdown,
        add risk option
  B2 → Report Builder page — detect builder type from
        engagement type
  B3 → Report Canvas — remove section-level drag and drop
  B4 → SectionBlock — text box sections, findings section
        unchanged, report title special handling
  B5 → Default Templates management page
  B6 → Routing updates
  B7 → Update CLAUDE.md

Stop after each step and wait for confirmation.
Do not proceed to the next step until the current one
is verified working.

===================================================
VERIFICATION CHECKLIST
===================================================

Run through every item before calling this instruction done.

BACKEND:
  □ Alembic migrations apply cleanly with no errors
  □ risk appears as valid engagement type
  □ All new section types exist in the enum
  □ All 5 pytest seeding tests pass
  □ Default body test passes — template pre-populates section
  □ Empty body test passes — no template = None body
  □ Tabletop engagement cannot create a report (422)
  □ Template upsert test passes

ENGAGEMENT FORM:
  □ Dropdown shows exactly 5 options (no tabletop, no TSA)
  □ Risk Assessment is selectable and saves correctly
  □ Existing tabletop/TSA engagements show read-only badge
    with "no report builder yet" note

REPORT BUILDER — SECTION STRUCTURE:
  □ Create vulnerability engagement + report → 9 sections
    in correct order, crown_jewel present, no attack_path
  □ Create pentest engagement + report → 9 sections,
    scope_and_rules_of_engagement present, no crown_jewel
  □ Create risk engagement + report → 10 sections,
    risk_assessment_approach and risk_assessment_result
    present
  □ Create compliance engagement + report → 11 sections,
    compliance_framework_overview and compliance_maturity
    present
  □ Create gap engagement + report → 10 sections,
    gap_analysis present, no attack_path

REPORT BUILDER — UI BEHAVIOUR:
  □ Builder type badge shows correct label in topbar
  □ Report Title section renders as large single-line input
  □ Editing Report Title updates topbar reactively
  □ Text box sections have textarea with auto-save on blur
  □ "Saved" indicator appears after successful save
  □ Collapsed sections show first 120 chars of body
  □ Empty sections show "[Empty]" in gray italic
  □ No drag handles visible on section headers
  □ Sections cannot be reordered
  □ Findings section renders exactly as before — severity
    sub-sections, add findings button, finding cards all work
  □ LibrarySelectModal still opens from findings section
  □ Finding drag within and across severity sub-sections works

DEFAULT TEMPLATES PAGE:
  □ Page accessible at /settings/templates for Admin
  □ Redirects to / for non-Admin users
  □ Link visible in sidebar Settings section for Admin only
  □ Five tabs render correctly
  □ Switching tabs loads the correct section list
  □ Findings section renders as non-editable info block
  □ Report Title renders as single-line Input
  □ All other sections render as Textarea
  □ Typing in a textarea and tabbing away triggers auto-save
  □ "Saved" indicator appears after save
  □ Saved defaults pre-populate sections when creating a
    new report of that type
  □ Changing defaults does NOT affect reports already created
  □ Empty template = empty section body on new report
