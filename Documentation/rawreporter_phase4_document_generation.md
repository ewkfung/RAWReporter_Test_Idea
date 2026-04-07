# RAWReporter — Phase 4: Document Generation
# Claude Code Instruction Set
# DOCX generation for all 5 report builder types

---

## CONTEXT

Read CLAUDE.md in full before starting anything.

Phase 5 is complete. This is Phase 4 — document generation.
The placeholder endpoint at POST /api/v1/reports/{id}/generate
returns a JSON stub. Replace it with real DOCX generation.

Core decisions locked in:
  - 5 DOCX base templates, one per report type
  - Admin uploads templates via a new Document Templates
    settings page
  - Approach B: base template provides styles only, python-docx
    builds all content programmatically
  - Cover page uses Word bookmarks for field injection
  - No upload = generation fails gracefully with clear error
  - TOC uses Word's built-in TOC field (user refreshes in Word)
  - Findings grouped by severity, count summary table before
    findings content
  - Body styles use standard Word style names (Heading 1,
    Heading 2, Heading 3, Normal, List Bullet)
  - Firm name is a platform-wide Admin setting injected via
    RAW_PREPARED_BY bookmark

Build in exact order below. Stop after each step and wait
for confirmation before proceeding.

---

## REQUIRED BOOKMARKS FOR TEMPLATE FILES

The Admin must insert these named bookmarks in their DOCX
cover page. Document this prominently on the settings page.

  RAW_REPORT_TITLE       Report title from report builder
  RAW_CLIENT_NAME        Client organisation name
  RAW_ENGAGEMENT_TYPE    Human-readable type e.g.
                           "Vulnerability Assessment"
  RAW_REPORT_DATE        Date of generation (auto)
  RAW_LEAD_CONSULTANT    Engagement lead name
  RAW_PREPARED_BY        Firm name from platform settings

Missing bookmarks are skipped silently — generation does
not fail if a bookmark is absent.

---

## ENGAGEMENT TYPE DISPLAY NAMES

Used for RAW_ENGAGEMENT_TYPE injection and document headers:

  vulnerability_assessment → "Vulnerability Assessment"
  pentest                  → "Penetration Testing"
  risk                     → "Risk Assessment"
  compliance_assessment    → "Compliance Assessment"
  gap_assessment           → "Security Gap Assessment"

---

## PART A — BACKEND

===================================================
STEP A1 — Install Dependencies
===================================================

Add to backend/pyproject.toml dependencies:
  python-docx>=1.1.2
  (already present — confirm it is installed)

No additional libraries. Do not add docxtpl — we are
using python-docx directly (Approach B).

===================================================
STEP A2 — Platform Settings Model
===================================================

File: backend/rawreporter/models/platform_setting.py

class PlatformSetting(Base, TimestampMixin):
  __tablename__ = "platform_settings"

  id: uuid PK
  key: str (unique, not null, indexed)
  value: text (nullable)
  updated_by: uuid FK → users.id (nullable)

Seed one row on startup in utils/seed_rbac.py
(add to the existing idempotent seed function):
  key = "firm_name"
  value = None  (Admin sets it via settings page)
  Use INSERT ... ON CONFLICT (key) DO NOTHING

Add to permissions seed:
  resource: "platform_setting"
  actions: "view", "edit"
  Admin role: view + edit
  All other roles: view only

Generate Alembic migration: add_platform_settings_table
Run and confirm before proceeding.

===================================================
STEP A3 — Document Template Model
===================================================

File: backend/rawreporter/models/document_template.py

class DocumentTemplate(Base, TimestampMixin):
  __tablename__ = "document_templates"

  id: uuid PK
  engagement_type: EngagementTypeEnum (unique, not null)
  original_filename: str (not null)
  file_path: str (not null)
  file_size_bytes: int (not null)
  uploaded_by: uuid FK → users.id (nullable)
  is_valid: bool (default True)
    (set False if validation finds issues — for future use)

  UniqueConstraint(engagement_type)

Template files stored at:
  backend/uploads/doc_templates/{engagement_type}.docx

Ensure this directory is created on app startup if it
does not exist. Add to the lifespan handler in main.py:
  os.makedirs("uploads/doc_templates", exist_ok=True)

Add to permissions seed:
  resource: "document_template"
  actions: "view", "upload", "delete"
  Admin role: all three
  All other roles: none (consultants cannot see or upload)

Generate Alembic migration: add_document_templates_table
Run and confirm before proceeding.

===================================================
STEP A4 — Document Template Endpoints
===================================================

File: backend/rawreporter/routers/document_templates.py

GET /api/v1/document-templates/
  Requires document_template:view
  Returns list of all DocumentTemplate rows.
  For each engagement type that has NO uploaded template,
  include it in the response with template=null so the
  frontend can show "not uploaded" state for all 5 types.
  Response shape:
  [
    {
      "engagement_type": "vulnerability_assessment",
      "display_name": "Vulnerability Assessment",
      "template": {
        "id": "...",
        "original_filename": "vuln_template.docx",
        "file_size_bytes": 45231,
        "uploaded_at": "...",
        "uploaded_by_name": "..."
      } | null
    },
    ...
  ]
  Always return all 5 engagement types regardless of
  whether a template exists for each.

POST /api/v1/document-templates/{engagement_type}
  Requires document_template:upload
  Accepts multipart/form-data with field "file"
  Validates:
    - File must be .docx (check content-type and extension)
    - File must be <= 20MB
    - Reject if not a valid ZIP (DOCX files are ZIP archives)
      Use zipfile.is_zipfile() to check
  On success:
    - Save file to uploads/doc_templates/{engagement_type}.docx
      (overwrites any existing file for this type)
    - Upsert DocumentTemplate row
    - Return updated DocumentTemplate
  On validation failure:
    - Return HTTP 422 with descriptive error message

DELETE /api/v1/document-templates/{engagement_type}
  Requires document_template:delete
  Deletes the file from disk
  Deletes the DocumentTemplate row
  Returns 204 No Content

GET /api/v1/platform-settings/
  Requires platform_setting:view
  Returns all PlatformSetting rows as key-value pairs:
  { "firm_name": "Acme Cybersecurity" }

PUT /api/v1/platform-settings/{key}
  Requires platform_setting:edit
  Body: { "value": "..." }
  Upserts the setting value
  Returns updated setting

Include both routers in main.py with prefix /api/v1.

===================================================
STEP A5 — generators/context_builder.py
===================================================

File: backend/rawreporter/generators/context_builder.py

async def build_report_context(
    report_id: UUID,
    session: AsyncSession
) -> dict:

Fetches all data needed for generation. Returns:

{
  "report": {
    "id": str,
    "title": str,
    "status": str,
    "generated_at": "2025-01-15T14:30:00"  (ISO, UTC)
  },
  "engagement": {
    "title": str,
    "type": str,                    (enum value)
    "type_display": str,            (human-readable)
    "start_date": str | null,       (formatted YYYY-MM-DD)
    "end_date": str | null,
    "completed_date": str | null,
    "lead_consultant": str | null,  (name from user record)
    "scope_description": str | null
  },
  "client": {
    "name": str,
    "industry": str | null,
    "vertical": str | null,
    "primary_contact": str | null,
    "contact_email": str | null
  },
  "firm_name": str | null,          (from platform_settings)
  "sections": [                     (visible only, ordered)
    {
      "position": int,
      "section_type": str,
      "title": str,
      "body_text": str | null,
      "is_findings_section": bool
    }
  ],
  "findings_summary": {
    "critical": int,
    "high": int,
    "medium": int,
    "low": int,
    "informational": int,
    "total": int
  },
  "findings_by_severity": {
    "critical": [ ...findings... ],
    "high": [ ...findings... ],
    "medium": [ ...findings... ],
    "low": [ ...findings... ],
    "informational": [ ...findings... ]
  }
}

Each finding in findings_by_severity:
{
  "title": str,
  "severity": str,
  "summary": str | null,
  "observation": str | null,
  "recommendation": str | null,
  "remediation_steps": str | null,       (null if disabled)
  "remediation_steps_enabled": bool,
  "cvss_score": float | null,
  "cvss_vector": str | null,
  "affected_systems": str | null,
  "is_placement_override": bool,
  "override_justification": str | null,
  "references": {
    "cve":          {"enabled": bool, "entries": [{"value":str,"url":str|null}]},
    "cwe":          {"enabled": bool, "entries": [...]},
    "cisa":         {"enabled": bool, "entries": [...]},
    "nist":         {"enabled": bool, "entries": [...]},
    "nvd":          {"enabled": bool, "entries": [...]},
    "manufacturer": {"enabled": bool, "entries": [...]}
  }
}

Rules:
  - Only include sections where is_visible = True
  - Order sections by position ASC
  - findings_by_severity only includes severities that
    have at least one finding (omit empty severity groups)
  - findings within each severity group ordered by
    position ASC (the order consultant set in builder)
  - For references: only include entries where
    ref_type_enabled = True AND entries exist for that type
  - remediation_steps is null in context if
    remediation_steps_enabled = False
  - lead_consultant: join to users table to get
    first_name + last_name from the engagement lead user

===================================================
STEP A6 — generators/template_loader.py
===================================================

File: backend/rawreporter/generators/template_loader.py

def get_template_path(
    engagement_type: str
) -> Path | None:
  Returns Path to the template file if it exists.
  Returns None if no file has been uploaded for this type.

  Template path pattern:
    uploads/doc_templates/{engagement_type}.docx

def load_template_document(
    engagement_type: str
) -> Document:
  Loads the .docx template using python-docx Document().
  Raises FileNotFoundError if template does not exist
  (caller converts this to a user-friendly 422 error).

def inject_cover_page_bookmarks(
    doc: Document,
    context: dict
) -> Document:
  Finds and fills named bookmarks in the document.

  Bookmark → value mapping:
    RAW_REPORT_TITLE     → context["report"]["title"]
    RAW_CLIENT_NAME      → context["client"]["name"]
    RAW_ENGAGEMENT_TYPE  → context["engagement"]["type_display"]
    RAW_REPORT_DATE      → today's date formatted as
                           "January 15, 2025"
    RAW_LEAD_CONSULTANT  → context["engagement"]["lead_consultant"]
                           or "" if None
    RAW_PREPARED_BY      → context["firm_name"] or ""

  Bookmark injection implementation:
    Word bookmarks are stored in the XML as:
      <w:bookmarkStart w:name="RAW_REPORT_TITLE" .../>
      [text runs between start and end]
      <w:bookmarkEnd .../>

    To inject a value:
      1. Find bookmarkStart elements by w:name attribute
      2. Find the parent paragraph of the bookmarkStart
      3. Clear all text runs in that paragraph that fall
         between bookmarkStart and bookmarkEnd
      4. Insert a new run with the replacement text,
         preserving the run properties (font, size) of
         the first existing run in that paragraph

    Use lxml directly for bookmark traversal:
      from lxml import etree
      WORD_NS = "http://schemas.openxmlformats.org/
                 wordprocessingml/2006/main"

    If a bookmark name is not found in the document:
      Log a warning and continue — do not raise an error.

  Returns the modified Document.

===================================================
STEP A7 — generators/docx_generator.py
===================================================

File: backend/rawreporter/generators/docx_generator.py

Main entry point:

async def generate_docx(
    report_id: UUID,
    session: AsyncSession
) -> bytes:

  1. Call validate_report_for_generation(report_id, session)
     Raises HTTP 422 if any findings block generation.

  2. Call build_report_context(report_id, session)
     Raises HTTP 404 if report not found.

  3. Get engagement_type from context["engagement"]["type"]

  4. Load template:
     template_path = get_template_path(engagement_type)
     If template_path is None or file does not exist:
       Raise HTTP 422:
       {
         "detail": "No document template uploaded for this
                    report type. An Admin must upload a
                    .docx template before reports can be
                    generated.",
         "engagement_type": engagement_type,
         "upload_path": "/settings/document-templates"
       }

  5. doc = load_template_document(engagement_type)

  6. doc = inject_cover_page_bookmarks(doc, context)

  7. Build body content — call build_document_body(doc, context)
     (see below)

  8. Save to buffer:
     buffer = BytesIO()
     doc.save(buffer)
     buffer.seek(0)
     return buffer.read()

---

def build_document_body(
    doc: Document,
    context: dict
) -> None:
  Appends all body content to the document after the
  cover page. The cover page is assumed to be everything
  already in the document before this function runs.

  Add a page break to separate cover from body:
    doc.add_page_break()

  Add Word TOC field:
    TOC is inserted as raw XML. Add a paragraph with this
    XML field code which Word renders as a TOC:
    <w:fldSimple w:instr=" TOC \o &quot;1-3&quot; \h \z \u ">
      <w:r><w:t>
        [Right-click and select "Update Field" to generate
        table of contents]
      </w:t></w:r>
    </w:fldSimple>
    Add a page break after the TOC paragraph.

  Render each section in order:
    For section in context["sections"]:

      If section["is_findings_section"]:
        Call render_findings_section(doc, context)
        Continue to next section

      If section["section_type"] == "report_title":
        Skip — title is already injected via bookmark.
        Continue to next section.

      Add Heading 1 paragraph: section["title"]
        doc.add_heading(section["title"], level=1)

      If section["body_text"] is not None and not empty:
        Add body text as Normal paragraphs.
        Split on "\n" and add each non-empty line as a
        separate paragraph with style "Normal":
          para = doc.add_paragraph(line)
          para.style = doc.styles["Normal"]
      Else:
        Add a single paragraph "[Section not completed]"
        in gray italic (set run font colour to #888888,
        italic=True)

      Add spacing paragraph between sections:
        doc.add_paragraph("")

---

def render_findings_section(
    doc: Document,
    context: dict
) -> None:
  Renders the complete findings section including the
  severity count summary table and all findings grouped
  by severity.

  1. Add Heading 1: "Findings"

  2. Add severity count summary table:
     Table with 2 columns, header row + one row per
     severity that has findings + total row.

     Header row: ["Severity", "Count"]
       Bold, shaded background (#4472C4 — standard Word
       blue, or the first row shade in the template if
       the table style supports it)

     Data rows (only include severities with count > 0):
       ["Critical", N]   — text colour #7c3aed (purple)
       ["High", N]       — text colour #dc2626 (red)
       ["Medium", N]     — text colour #d97706 (amber)
       ["Low", N]        — text colour #2563eb (blue)
       ["Informational", N] — text colour #6b7280 (gray)

     Total row: ["Total", N] — bold

     Set table style "Table Grid" (standard Word table
     style that exists in all documents).
     Set column widths: 3 inches for Severity,
     1.5 inches for Count.

  3. Add spacing paragraph after table.

  4. For each severity in order
     [critical, high, medium, low, informational]:
     If context["findings_by_severity"] has this key
     and list is non-empty:

       Add Heading 2 paragraph:
         "{Severity} Findings ({count})"
         e.g. "Critical Findings (3)"

       For each finding in that severity list:
         Call render_finding(doc, finding, doc)

---

def render_finding(
    doc: Document,
    finding: dict
) -> None:
  Renders one finding with all its sub-sections.

  Finding title line:
    Add Heading 2: finding["title"]
    On the same paragraph (after the title text), add
    a tab stop and the severity label in bold:
      "    CRITICAL" with run colour matching severity
    Implementation: after adding the heading paragraph,
    add an additional run to the same paragraph with
    the severity label. Use tab character to push it right.

  If finding["is_placement_override"] is True:
    Add a paragraph with amber background:
      "⚠  Placement Override — Severity: {severity}"
    Add paragraph: "Justification: {override_justification}"
    Both in italic, colour #d97706

  Add Heading 3: "Summary"
  Add Normal paragraph: finding["summary"]
    If None: "[No summary provided]" in gray italic

  Add Heading 3: "Observation"
  Add Normal paragraph: finding["observation"]
    If None or empty: "[No observation recorded]" in
    gray italic

  Add Heading 3: "Recommendation"
  Add Normal paragraph: finding["recommendation"]
    If None: "[No recommendation provided]" in gray italic

  If finding["remediation_steps_enabled"] and
     finding["remediation_steps"] is not None:
    Add Heading 3: "Remediation Steps"
    Add Normal paragraph: finding["remediation_steps"]

  If finding["cvss_score"] is not None:
    Add Normal paragraph:
      "CVSS Score: {cvss_score}"
    If finding["cvss_vector"] is also not None:
      Append " — {cvss_vector}" to same paragraph
    Make "CVSS Score:" label bold.

  If finding["affected_systems"] is not None:
    Add Heading 3: "Affected Systems"
    Add Normal paragraph: finding["affected_systems"]

  References block:
    ref_order = ["cve","cwe","cisa","nist","nvd","manufacturer"]
    ref_labels = {
      "cve": "CVE",
      "cwe": "CWE",
      "cisa": "CISA Advisory",
      "nist": "NIST Reference",
      "nvd": "NVD Entry",
      "manufacturer": "Manufacturer Advisory"
    }

    has_any_refs = False
    For ref_type in ref_order:
      ref = finding["references"][ref_type]
      If ref["enabled"] and len(ref["entries"]) > 0:
        has_any_refs = True

    If has_any_refs:
      Add Heading 3: "References"
      For ref_type in ref_order:
        ref = finding["references"][ref_type]
        If ref["enabled"] and len(ref["entries"]) > 0:
          For entry in ref["entries"]:
            para = doc.add_paragraph(style="List Bullet")
            label_run = para.add_run(
              ref_labels[ref_type] + ": "
            )
            label_run.bold = True
            value_run = para.add_run(entry["value"])
            If entry["url"] is not None:
              value_run = para.add_run(
                " — " + entry["url"]
              )

  Add a thin horizontal rule after each finding:
    Add a paragraph with bottom border:
      Use paragraph XML border:
      pPr > pBdr > bottom with w:val="single"
      w:sz="6" w:space="1" w:color="CCCCCC"
    This draws a light gray line separating findings.

===================================================
STEP A8 — Update reports router
===================================================

File: backend/rawreporter/routers/reports.py

Replace the placeholder generate endpoint:

POST /api/v1/reports/{report_id}/generate
  Requires report:generate permission (already exists)

  Call: docx_bytes = await generate_docx(report_id, session)

  Build filename:
    date_str = datetime.utcnow().strftime("%Y%m%d")
    title_slug = report.title.lower()
      .replace(" ", "_")
      [:40]  (truncate to 40 chars)
      re.sub(r"[^a-z0-9_]", "", title_slug)
    filename = f"{title_slug}_{date_str}.docx"

  Return StreamingResponse:
    content = iter([docx_bytes])
    media_type = "application/vnd.openxmlformats-
      officedocument.wordprocessingml.document"
    headers = {
      "Content-Disposition":
        f'attachment; filename="{filename}"',
      "Content-Length": str(len(docx_bytes))
    }

  On FileNotFoundError (no template):
    Return HTTP 422 with the error detail from
    generate_docx (already formatted correctly).

  On any other exception during generation:
    Log the full traceback.
    Return HTTP 500:
    {
      "detail": "Document generation failed. Check
                 server logs for details.",
      "report_id": str(report_id)
    }

===================================================
STEP A9 — Backend Tests
===================================================

File: tests/test_document_generation.py

Create or replace this file with:

  test_context_builder_report_not_found
    Call build_report_context with a random UUID
    Assert HTTP 404

  test_context_builder_correct_structure
    Create: client, engagement (vulnerability_assessment),
    report, seed sections, add 2 library findings to
    critical section, 1 to high section
    Call build_report_context
    Assert findings_summary["critical"] == 2
    Assert findings_summary["high"] == 1
    Assert findings_summary["total"] == 3
    Assert len(context["sections"]) == 9 (all visible)
    Assert context["client"]["name"] is correct
    Assert critical findings list has 2 items
    Assert findings ordered by position within severity

  test_context_excludes_invisible_sections
    Create report, set appendix is_visible = False
    Call build_report_context
    Assert appendix not in context["sections"]

  test_context_excludes_disabled_remediation_steps
    Create finding with remediation_steps_enabled = False
    Call build_report_context
    Assert that finding's remediation_steps is None
    in context

  test_context_excludes_disabled_references
    Create finding with ref_cve_enabled = False,
    add CVE entries to that finding
    Call build_report_context
    Assert cve entries not in references for that finding
    in context

  test_generate_fails_without_template
    Create a report (vulnerability_assessment type)
    Ensure no template file exists for this type
    Call generate_docx
    Assert HTTP 422 with "No document template" in detail

  test_generate_fails_with_blocking_finding
    Create report with a finding where
    is_placement_override = True and
    override_justification = None
    Upload a mock template (create a minimal valid .docx
    in the test and save it to the template path)
    Call generate_docx
    Assert HTTP 422 with finding title in blocking_findings

  test_generate_produces_valid_docx
    Create a complete report (all section types for
    vulnerability_assessment, 1 finding per severity,
    all references types with entries)
    Upload a minimal test template:
      Create a Document(), add one paragraph "Cover Page",
      save to uploads/doc_templates/
      vulnerability_assessment.docx
    Call generate_docx
    Assert return value is bytes, len > 0
    Open result with Document(BytesIO(result))
    Assert no exception raised
    Assert document has paragraphs (content was added)

  test_platform_setting_firm_name
    PUT /api/v1/platform-settings/firm_name
    Body: {"value": "Test Security Firm"}
    Assert 200
    GET /api/v1/platform-settings/
    Assert {"firm_name": "Test Security Firm"}

  test_document_template_upload_rejects_non_docx
    POST /api/v1/document-templates/vulnerability_assessment
    Upload a .txt file
    Assert HTTP 422

  test_document_template_upload_accepts_docx
    Create minimal Document(), save to BytesIO
    POST /api/v1/document-templates/vulnerability_assessment
    Upload the BytesIO content as .docx
    Assert 200
    Assert file exists at expected path

Run pytest after this step. All tests must pass before
proceeding to Part B.

---

## PART B — FRONTEND

===================================================
STEP B1 — Document Templates Settings Page
===================================================

File: src/pages/settings/DocumentTemplatesPage.tsx
Route: /settings/document-templates
Permission: Admin only — redirect to / if user lacks
  usePermission("document_template", "upload")

Add to Sidebar under Settings section:
  Document Templates   /settings/document-templates
  Only visible if usePermission("document_template","upload")

Add to src/api/documentTemplates.ts:
  getDocumentTemplates(): Promise<DocumentTemplateStatus[]>
    GET /api/v1/document-templates/

  uploadDocumentTemplate(
    engagementType: string,
    file: File
  ): Promise<DocumentTemplate>
    POST /api/v1/document-templates/{engagementType}
    multipart/form-data

  deleteDocumentTemplate(
    engagementType: string
  ): Promise<void>
    DELETE /api/v1/document-templates/{engagementType}

Add to src/api/platformSettings.ts:
  getPlatformSettings(): Promise<Record<string,string|null>>
    GET /api/v1/platform-settings/

  updatePlatformSetting(
    key: string,
    value: string
  ): Promise<void>
    PUT /api/v1/platform-settings/{key}

--- Page Layout ---

PageWrapper title="Document Templates"

Description (gray, 14px, below title):
  "Upload a .docx base template for each report type.
   The template provides the document's visual styling —
   cover page design, fonts, headers, and footers. Report
   content is generated automatically from the report builder."

--- Firm Name Setting ---

Card at top of page:
  Title: "Firm Name"
  Description: "Appears in the generated document cover
    page via the RAW_PREPARED_BY bookmark."
  Input field: pre-filled with current firm_name setting
  Auto-saves on blur (PUT /platform-settings/firm_name)
  Shows "Saved" indicator after successful save

--- Bookmark Reference Card ---

Collapsible card below firm name, collapsed by default:
  Title: "How to prepare your template" (with ▶ chevron)

  When expanded, shows two sections:

  Section 1 — "Required bookmarks":
    "Insert these named bookmarks in your cover page in
     Microsoft Word. Go to Insert → Bookmark, type the
     name exactly as shown, and click Add."

    Table with columns: Bookmark Name | Filled With
    Rows:
      RAW_REPORT_TITLE     | Report title from builder
      RAW_CLIENT_NAME      | Client organisation name
      RAW_ENGAGEMENT_TYPE  | e.g. "Vulnerability Assessment"
      RAW_REPORT_DATE      | Date of generation
      RAW_LEAD_CONSULTANT  | Engagement lead name
      RAW_PREPARED_BY      | Firm name (set above)

    Note in amber: "Missing bookmarks are skipped — the
    document still generates, that field is just left blank."

  Section 2 — "Style names":
    "The generator uses these standard Word style names
     for report content. Customise them in Word's Styles
     panel to match your branding."

    Table with columns: Style Name | Used For
    Rows:
      Heading 1    | Section titles
      Heading 2    | Finding titles
      Heading 3    | Finding sub-sections
      Normal       | Body text paragraphs
      List Bullet  | Reference entries

--- Template Upload Cards ---

Five cards in a vertical list, one per report type,
in this order:
  Vulnerability Assessment
  Penetration Testing
  Risk Assessment
  Compliance Assessment
  Security Gap Assessment

Each card:
  Left: report type name (bold) + engagement type tag (gray pill)

  If template IS uploaded:
    Green checkmark badge: "Template uploaded"
    Filename: original_filename (gray, 13px)
    File size: formatted (e.g. "44.2 KB")
    Uploaded: relative time + "by {uploader name}"
    Buttons:
      "Replace" — opens file picker, uploads new file,
                  replaces existing (same endpoint)
      "Remove"  — ConfirmModal then DELETE endpoint
                  On confirm: show empty state for this type

  If template is NOT uploaded:
    Amber warning badge: "No template uploaded"
    Gray italic text: "Reports cannot be generated for
      this type until a template is uploaded."
    Button: "Upload Template" — opens file picker,
      filters to .docx only (accept=".docx")
      On file select: immediately upload via POST endpoint
      Show upload progress spinner on the button
      On success: card updates to "uploaded" state
      On error: show error toast with API message

  File picker implementation:
    Use a hidden <input type="file" accept=".docx" />
    Trigger it with a button click
    On change: call uploadDocumentTemplate with the file
    Do NOT use a drag-drop zone — simple file picker only

===================================================
STEP B2 — Update Generate Report Button
===================================================

The generate button lives in:
  src/pages/ReportBuilder/components/ReportActionsPanel.tsx
  (or GenerateReportButton.tsx — check which is active
  per CLAUDE.md — use ReportActionsPanel)

Current behaviour: returns JSON stub, shows amber
"coming soon" message.

New behaviour:

async function handleGenerate() {
  setGenerating(true)
  setError(null)

  try {
    const response = await fetch(
      `/api/v1/reports/${reportId}/generate`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      }
    )

    if (!response.ok) {
      const errorData = await response.json()

      // Blocking findings (422 with blocking_findings)
      if (response.status === 422 &&
          errorData.blocking_findings) {
        setBlockingFindings(errorData.blocking_findings)
        setShowBlockedModal(true)
        return
      }

      // No template uploaded (422 with upload_path)
      if (response.status === 422 &&
          errorData.upload_path) {
        setError(
          "No document template has been uploaded for " +
          "this report type. An Admin must upload a " +
          "template at Settings → Document Templates " +
          "before reports can be generated."
        )
        return
      }

      // Generic error
      setError(
        errorData.detail ||
        "Document generation failed. Please try again."
      )
      return
    }

    // Success — trigger download
    const blob = await response.blob()
    const contentDisposition =
      response.headers.get("Content-Disposition") || ""
    const filenameMatch =
      contentDisposition.match(/filename="([^"]+)"/)
    const filename = filenameMatch
      ? filenameMatch[1]
      : "report.docx"

    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showToast("Report downloaded successfully", "success")

  } catch (err) {
    setError("Network error. Please check your connection.")
  } finally {
    setGenerating(false)
  }
}

UI states on the generate button:
  Default: "Generate Report" (primary button)
  Generating: spinner + "Generating..." (disabled)
  Error: show error message in red below the button,
         button returns to default state

Create GenerationBlockedModal component
(if not already built from Phase 5 planning):

File: src/pages/ReportBuilder/components/
      GenerationBlockedModal.tsx

Props:
  isOpen: bool
  onClose: () => void
  blockingFindings: Array<{id:string, title:string,
    section:string}>

Content:
  Title: "Report Cannot Be Generated"
  Subtitle in red: "The following findings have been
    placed in sections that don't match their severity
    rating and require a justification before the report
    can be exported:"
  List of blocking findings:
    Each shows finding title + section name
    No "Fix Now" link needed — consultant can close
    the modal and find the finding in the builder
  Footer: "Close" button

===================================================
STEP B3 — Add Routes and Sidebar Link
===================================================

File: src/App.tsx
Add: /settings/document-templates → DocumentTemplatesPage
     (ProtectedRoute, redirect to / if no
      document_template:upload permission)

File: src/components/layout/Sidebar.tsx
Add under Settings section:
  Document Templates  /settings/document-templates
  Only if usePermission("document_template", "upload")
  Position: above or below Users (your choice)

===================================================
STEP B4 — Update CLAUDE.md
===================================================

Update CLAUDE.md build status:

Move Phase 4 from "Not yet started" to "Completed":
  Phase 4 — Document generation                     ✓
    5-type DOCX generation (python-docx, Approach B)
    Bookmark-based cover page injection
    Severity count summary table
    Findings grouped by severity in position order
    Word TOC field (user refreshes in Word)
    document_templates table + upload/delete API
    platform_settings table (firm_name)
    DocumentTemplatesPage (/settings/document-templates)
    GenerationBlockedModal
    Generate button with download + error handling

Update Document generation section to reflect real
implementation (remove placeholder references).

Add to Lessons learned:
  "Document generation — Approach B (style-based)"
  "The uploaded .docx provides styles only. python-docx
   builds all body content programmatically using
   standard Word style names (Heading 1, Heading 2,
   Heading 3, Normal, List Bullet). Cover page fields
   are injected via named Word bookmarks. If a style
   name does not exist in the template, python-docx
   falls back to the document's default style."

===================================================
BUILD ORDER SUMMARY
===================================================

Backend first — all tests must pass before frontend:

  A1 → Confirm python-docx is installed
  A2 → PlatformSetting model + migration + seed
  A3 → DocumentTemplate model + migration
  A4 → Document template + platform setting endpoints
  A5 → generators/context_builder.py
  A6 → generators/template_loader.py
  A7 → generators/docx_generator.py
  A8 → Update reports router generate endpoint
  A9 → Backend tests (all must pass)

Frontend in order:

  B1 → DocumentTemplatesPage
  B2 → Update generate button + GenerationBlockedModal
  B3 → Routes + sidebar link
  B4 → Update CLAUDE.md

Stop after each step and wait for confirmation.

===================================================
VERIFICATION CHECKLIST
===================================================

BACKEND:
  □ Migrations apply cleanly
  □ platform_settings table exists with firm_name row
  □ document_templates table exists
  □ uploads/doc_templates/ directory created on startup
  □ All 10 pytest tests pass
  □ GET /api/v1/document-templates/ returns all 5 types
    even when none are uploaded (template: null)
  □ POST upload rejects .txt file with 422
  □ POST upload accepts .docx, saves file to disk
  □ DELETE removes file from disk and DB row
  □ GET /api/v1/platform-settings/ returns firm_name
  □ PUT /api/v1/platform-settings/firm_name updates value

DOCUMENT GENERATION — NO TEMPLATE:
  □ Click Generate on a report with no template uploaded
  □ API returns 422 with "No document template" message
  □ Frontend shows the no-template error message (not a
    crash, not a generic error)

DOCUMENT GENERATION — BLOCKING FINDINGS:
  □ Create a finding with is_placement_override=True
    and override_justification=None
  □ Upload a test template for that report type
  □ Click Generate
  □ GenerationBlockedModal appears listing the finding
  □ Close modal, add justification to the finding
  □ Click Generate again — proceeds to download

DOCUMENT GENERATION — SUCCESS:
  □ Create a complete report:
      Client: test client
      Engagement: vulnerability_assessment type
      Sections: all filled with text
      Findings: at least 1 Critical, 1 High, 1 Medium
      References: CVE entries on the Critical finding
      Observation filled on all findings
  □ Upload a real .docx template with bookmarks for
    RAW_REPORT_TITLE and RAW_CLIENT_NAME
  □ Set firm_name in platform settings
  □ Click Generate
  □ Browser downloads a .docx file
  □ Open in Word — no errors on open
  □ Cover page shows correct title and client name
    in the bookmark locations
  □ Body sections render in correct order for
    vulnerability_assessment type
  □ Severity count summary table appears before findings
  □ Findings appear grouped by severity
  □ Critical findings appear before High, High before
    Medium, etc.
  □ Finding with CVE references shows CVE section
  □ Finding with remediation_steps_enabled=False has
    no Remediation Steps section
  □ Empty sections show "[Section not completed]"
  □ TOC field shows update prompt in Word
  □ Right-clicking TOC and updating it populates
    section entries correctly

DOCUMENT TEMPLATES PAGE:
  □ Page accessible at /settings/document-templates
    for Admin, redirects to / for other roles
  □ Link visible in sidebar Settings section for Admin
  □ All 5 report types shown
  □ Unuploaded types show amber "No template" warning
  □ Uploaded types show green checkmark + filename
  □ Upload button opens file picker filtered to .docx
  □ Uploading a .docx updates the card to uploaded state
  □ Uploading again (Replace) overwrites the template
  □ Remove button shows confirm modal, removes template
  □ Firm name input saves on blur, shows Saved indicator
  □ Bookmark reference card expands/collapses correctly
  □ Bookmark table shows all 6 bookmarks with descriptions
  □ Style names table shows all 5 styles with descriptions
