# RAWReporter — Phase 5 Step 9: Report Builder

Read CLAUDE.md before starting.

We are building the Report Builder page at `/reports/:id/build`. This is where consultants compose assessment reports by editing section text, adding findings from the library, and organizing content.

**CRITICAL:** This step builds the static layout with text editing and finding management. Drag-and-drop comes in Step 10 with dnd-kit. For now, findings render in their severity sections, but they cannot be dragged.

---

## CONTEXT

The Report Builder is the core workspace of RAWReporter. Consultants access it from the Reports page by clicking a report row or "Open Builder" button. The page uses the standard sidebar navigation (left pane visible) with the working area on the right.

---

## REQUIREMENTS

### 1. ROUTING

Add route in `src/App.tsx`:

```tsx
<Route path="/reports/:reportId/build" element={<ReportBuilder />} />
```

### 2. ACCESS CONTROL

**All roles can access Report Builder for reports they have permission to view:**
- **Admin:** Can access any report (has `reports:read` permission)
- **Lead:** Can access reports for engagements they lead
- **Consultant:** Can access reports they've been assigned to (for MVP, all consultants can access all reports)
- **View Only:** Can view but cannot edit (all inputs are read-only)

Use `usePermission` hook to control edit capabilities:
- `reports:update` → can edit section text boxes
- `findings:create` → can add findings from library
- `findings:update` → can edit findings
- `findings:delete` → can delete findings

### 3. PAGE STRUCTURE — `/reports/:reportId/build`

Create `src/pages/ReportBuilder/ReportBuilder.tsx`:

**Layout:**
```
┌──────────┬────────────────────────────────────────────────┐
│ Sidebar  │ Report Builder Working Area                   │
│ (normal  │                                                │
│  nav)    │ ┌────────────────────────────────────────────┐ │
│          │ │ Report Title [editable text box]          │ │
│          │ └────────────────────────────────────────────┘ │
│          │                                                │
│          │ ┌────────────────────────────────────────────┐ │
│          │ │ Executive Summary [textarea]               │ │
│          │ └────────────────────────────────────────────┘ │
│          │                                                │
│          │ ┌────────────────────────────────────────────┐ │
│          │ │ Findings Review [textarea]                 │ │
│          │ └────────────────────────────────────────────┘ │
│          │                                                │
│          │ ┌────────────────────────────────────────────┐ │
│          │ │ Crown Jewel Analysis [textarea]            │ │
│          │ └────────────────────────────────────────────┘ │
│          │                                                │
│          │ ┌────────────────────────────────────────────┐ │
│          │ │ Findings Overview [chart/graph]            │ │
│          │ └────────────────────────────────────────────┘ │
│          │                                                │
│          │ ┌────────────────────────────────────────────┐ │
│          │ │ Findings                                   │ │
│          │ │ [+ Add Findings from Library]              │ │
│          │ │                                            │ │
│          │ │ Critical Findings                          │ │
│          │ │ ├─ Finding Card                            │ │
│          │ │ ├─ Finding Card                            │ │
│          │ │                                            │ │
│          │ │ High Findings                              │ │
│          │ │ ├─ Finding Card                            │ │
│          │ │                                            │ │
│          │ │ Medium Findings                            │ │
│          │ │ Low Findings                               │ │
│          │ │ Informational                              │ │
│          │ └────────────────────────────────────────────┘ │
│          │                                                │
│          │ ┌────────────────────────────────────────────┐ │
│          │ │ Conclusion [textarea]                      │ │
│          │ └────────────────────────────────────────────┘ │
│          │                                                │
│          │          [Generate Report] button              │
└──────────┴────────────────────────────────────────────────┘
```

**Component hierarchy:**
- `ReportBuilder` (main container)
  - `ReportTitleBox` (editable text input)
  - `SectionTextBox` (reusable component for Executive Summary, Findings Review, Crown Jewel, Conclusion)
  - `FindingsOverviewChart` (SVG chart showing severity counts)
  - `FindingsSection` (container for all severity sections)
    - `AddFindingsButton` (opens LibrarySelectModal)
    - `SeveritySection` (one per severity: Critical, High, Medium, Low, Informational)
      - `FindingCard` (one per finding in that severity)
  - `GenerateReportButton` (bottom of page)

---

## DATA FETCHING

### On page load, fetch:

1. **Report data:**
   ```
   GET /reports/:id
   Response: { id, engagement_id, report_type, audience, title, ... }
   ```

2. **All report sections (includes body_text for text boxes):**
   ```
   GET /reports/:id/sections
   Response: [
     { id, section_type: 'executive_summary', title, body_text, ... },
     { id, section_type: 'findings_summary', title, body_text, ... },
     { id, section_type: 'crown_jewel', title, body_text, ... },
     { id, section_type: 'critical_findings', severity_filter: 'critical', findings: [...] },
     { id, section_type: 'high_findings', severity_filter: 'high', findings: [...] },
     { id, section_type: 'medium_findings', severity_filter: 'medium', findings: [...] },
     { id, section_type: 'low_findings', severity_filter: 'low', findings: [...] },
     { id, section_type: 'informational', severity_filter: 'informational', findings: [...] },
     { id, section_type: 'closing', title, body_text, ... },
     { id, section_type: 'appendix', title, body_text, ... }
   ]
   ```

3. **All findings for this report (for the chart):**
   ```
   GET /reports/:id/findings
   Response: [ { id, title, severity_effective, ... }, ... ]
   ```

---

## COMPONENTS

### 1. REPORT TITLE BOX — `ReportTitleBox.tsx`

**Props:**
```tsx
interface ReportTitleBoxProps {
  reportId: string;
  initialTitle: string;
}
```

**Layout:**
- Large text input (text-2xl font-semibold)
- White background, border, rounded, padding 16px
- Full width
- Placeholder: "Report Title"

**Behavior:**
- Displays `report.title`
- On blur: `PATCH /reports/:id` with `{title: value}`
- Debounced 500ms
- Show "Saved" indicator on successful save

---

### 2. SECTION TEXT BOX — `SectionTextBox.tsx` (Reusable)

**Props:**
```tsx
interface SectionTextBoxProps {
  sectionId: string;
  sectionType: string; // e.g., 'executive_summary', 'crown_jewel', 'closing'
  title: string;        // Display title (e.g., "Executive Summary")
  initialBodyText: string;
  readOnly?: boolean;   // For View Only role
}
```

**Layout:**
- Card with header (section title, font-semibold text-lg)
- Textarea (min-height 200px, auto-expand on content, monospace or sans-serif)
- Border, rounded, padding 16px
- Show "Saved" checkmark indicator when save completes

**Behavior:**
- Displays `section.body_text` in textarea
- On blur: debounced 500ms → `PATCH /sections/:sectionId` with `{body_text: value}`
- If `readOnly === true`, textarea is disabled

**Used for:**
- Executive Summary (section_type: 'executive_summary')
- Findings Review (section_type: 'findings_summary')
- Crown Jewel Analysis (section_type: 'crown_jewel')
- Conclusion (section_type: 'closing')

---

### 3. FINDINGS OVERVIEW CHART — `FindingsOverviewChart.tsx`

**Props:**
```tsx
interface FindingsOverviewChartProps {
  findings: Finding[]; // All findings for this report
}
```

**Purpose:** Show a bar chart or pie chart with count of findings per severity.

**Data aggregation:**
```tsx
const severityCounts = {
  critical: findings.filter(f => f.severity_effective === 'critical').length,
  high: findings.filter(f => f.severity_effective === 'high').length,
  medium: findings.filter(f => f.severity_effective === 'medium').length,
  low: findings.filter(f => f.severity_effective === 'low').length,
  informational: findings.filter(f => f.severity_effective === 'informational').length,
};
```

**Rendering:**
- Use inline SVG (not a heavy chart library for MVP)
- Horizontal bar chart:
  - Y-axis: Severity labels (Critical, High, Medium, Low, Informational)
  - X-axis: Count (0 to max count)
  - Bars colored using severity color palette
- Dimensions: 600px wide × 300px tall
- White background, border, rounded, padding 16px
- Title: "Findings Overview"

**No export functionality yet** — Phase 4 will regenerate this chart in python-docx using the same data.

---

### 4. FINDINGS SECTION — `FindingsSection.tsx`

**Purpose:** Container for all severity sections and the "Add Findings" button.

**Layout:**
- White card, border, rounded, padding 24px
- Header: "Findings" (text-xl font-semibold)
- "+ Add Findings from Library" button (purple, top-right of header)
- Severity sections rendered in order:
  1. Critical Findings
  2. High Findings
  3. Medium Findings
  4. Low Findings
  5. Informational

**Behavior:**
- Clicking "+ Add Findings from Library" opens `LibrarySelectModal` (no severity filter — user can select from all severities)
- After findings are added, refetch sections to show new findings in their appropriate severity sections

---

### 5. SEVERITY SECTION — `SeveritySection.tsx`

**Props:**
```tsx
interface SeveritySectionProps {
  section: ReportSection; // The severity-filtered section (e.g., critical_findings)
  onEditFinding: (findingId: string) => void;
  onDeleteFinding: (findingId: string) => void;
}
```

**Layout:**
- Section header: severity name (e.g., "Critical Findings") + finding count badge (e.g., "3 findings")
- Left border: 4px solid, color based on severity (use severity color palette)
- Padding 16px
- Findings list (gap 12px between cards)
- If no findings: show empty state "No {severity} findings yet."

**Behavior:**
- Renders `FindingCard` for each finding in `section.findings`
- Findings are displayed in `display_order` ascending (no drag yet — that's Step 10)

---

### 6. FINDING CARD — `FindingCard.tsx`

**Props:**
```tsx
interface FindingCardProps {
  finding: Finding;
  onEdit: () => void;
  onDelete: () => void;
  readOnly?: boolean;
}
```

**Layout:**
- White card, border, rounded, padding 12px
- Top row: severity badge (shows `severity_effective`) + title (font-medium text-gray-900)
  - If `severity_override` is set, show small "Overridden" indicator (text-xs text-purple-600 or icon)
- Second row: description (text-sm text-gray-600, line-clamp-2)
- Third row: affected systems (text-xs text-gray-500, if present)
- Bottom row: [Edit] button (ghost) + [Delete] button (ghost, text-red-600)
  - If `readOnly === true`, hide buttons

**Behavior:**
- Edit button calls `onEdit()` → opens `FindingFormModal`
- Delete button calls `onDelete()` → shows confirmation modal, then `DELETE /findings/:id`

---

### 7. FINDING FORM MODAL — `FindingFormModal.tsx`

**Purpose:** Edit an existing finding's report-specific fields. This does NOT edit the library template — only the instance in this report.

**Props:**
```tsx
interface FindingFormModalProps {
  findingId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void; // Callback to refetch findings after save
}
```

**Fields:**
- Title (text input)
- Description (textarea, 4 rows)
- Recommendation (textarea, 4 rows)
- Severity Override (dropdown: null | Critical | High | Medium | Low | Informational)
  - Show current `severity_default` as read-only badge above dropdown
  - If user changes severity, show warning: "Changing severity may move this finding to a different section. Provide justification below."
- Override Justification (textarea, required if `severity_override` is set OR `is_placement_override === true`)
  - Show character count (min 20 characters)
- Affected Systems (textarea, 2 rows)
- Evidence (textarea, 2 rows — file upload deferred to post-MVP)

**Behavior:**
- On open: `GET /findings/:id` to load current values
- On Save: `PATCH /findings/:id` with updated fields
- Validation: if `severity_override` is set, `override_justification` must be at least 20 characters
- On save success: close modal, call `onSave()` callback to refetch findings, show toast "Finding updated"
- Cancel button discards changes

---

### 8. LIBRARY SELECT MODAL — Use Existing Component

**DO NOT rebuild this.** Import `LibrarySelectModal` from `src/components/modals/LibrarySelectModal.tsx` (built in Step B6).

**How it's used:**
- Opened when user clicks "+ Add Findings from Library" in `FindingsSection`
- Props: `{ reportId, isOpen, onClose, onFindingsAdded }`
- **Do NOT pass `sectionId` or `severityFilter`** — user can select findings of any severity
- User selects findings (checkbox multi-select)
- On "Add Selected": 
  - For each selected finding, determine target section based on finding's `severity_default`
  - Call `POST /reports/:reportId/sections/:sectionId/findings` with `{library_finding_ids: [...]}`
  - Backend copies findings from library into appropriate severity sections
- On close: call `onFindingsAdded()` callback to refetch all sections

**Backend route already exists:**
```
POST /reports/:reportId/sections/:sectionId/findings
Body: { library_finding_ids: ["uuid1", "uuid2", ...] }
```

You'll need to call this route multiple times (once per target severity section) if the user selects findings of different severities. Group selected findings by `severity_default`, then make one API call per group.

---

### 9. GENERATE REPORT BUTTON — Pending Modal

**Location:** Bottom of the Report Builder page, centered.

**Styling:** Primary button (purple), large, "Generate Report" text.

**Behavior:** On click, show a modal:

```
Title: "Report Generation"
Body: "Document generation will be implemented in Phase 4. For now, this button confirms that all findings have valid placements and justifications."

Validation check (run before showing modal):
- Query all findings in this report
- If any finding has `is_placement_override === true` AND `override_justification` is NULL or empty:
  - Show error modal: "Cannot generate report. Some findings have severity overrides without justification. Please edit these findings and provide justification."
  - List the finding titles that are blocking generation
  - Buttons: [Close] or [Go to First Issue] (scrolls to first invalid finding)

If all findings are valid:
- Show success modal: "All findings are valid. Document generation will create a DOCX report in Phase 4."
- Buttons: [Close]
```

Do NOT implement actual DOCX generation. That's Phase 4.

---

## API ROUTES TO USE

All routes already exist from Phase 3. Use these:

```
GET    /reports/:id                                → fetch report details
PATCH  /reports/:id                                → update report title
GET    /reports/:id/sections                       → fetch sections with nested findings
PATCH  /sections/:id                               → update section body_text
GET    /reports/:id/findings                       → fetch all findings (for chart)
POST   /reports/:reportId/sections/:sectionId/findings  → bulk add from library
GET    /findings/:id                               → fetch single finding for edit modal
PATCH  /findings/:id                               → update finding fields
DELETE /findings/:id                               → delete finding
GET    /library                                    → fetch all library findings (for LibrarySelectModal)
```

---

## STYLING RULES

- Use CSS custom properties from `src/styles/globals.css`
- Severity colors: critical=#7c3aed, high=#dc2626, medium=#d97706, low=#2563eb, info=#6b7280
- All cards: white bg, border, rounded-lg, shadow-sm
- Text boxes: border, rounded, padding 12px, focus ring (purple)
- Section headers: font-semibold text-lg text-gray-900
- Buttons: use existing button classes (primary, ghost, danger)
- Save indicators: small checkmark icon + "Saved" text (text-sm text-green-600), fade out after 2 seconds
- Working area: padding 24px, max-width 1200px, centered

---

## FILE STRUCTURE

Create the following files:

```
src/pages/ReportBuilder/
  ReportBuilder.tsx                    ← main page component
  components/
    ReportTitleBox.tsx                 ← report title input
    SectionTextBox.tsx                 ← reusable text editor for sections
    FindingsOverviewChart.tsx          ← SVG chart showing severity counts
    FindingsSection.tsx                ← container for all severity sections
    SeveritySection.tsx                ← single severity section (e.g., Critical)
    FindingCard.tsx                    ← individual finding card
    FindingFormModal.tsx               ← edit finding modal
    GenerateReportButton.tsx           ← bottom button with validation
    SaveIndicator.tsx                  ← reusable "Saved" checkmark component
```

---

## TESTING CHECKLIST

After implementation, verify:

1. ✓ Navigate to `/reports/:id/build` loads page with sidebar visible
2. ✓ Report Title box displays report.title, saves on blur
3. ✓ Executive Summary, Findings Review, Crown Jewel, Conclusion text boxes load section.body_text
4. ✓ Text boxes save on blur (debounced 500ms), show "Saved" indicator
5. ✓ Findings Overview Chart renders with correct severity counts
6. ✓ "+ Add Findings from Library" button opens LibrarySelectModal
7. ✓ Selecting findings from library adds them to appropriate severity sections
8. ✓ Severity sections render findings in order
9. ✓ FindingCard shows title, description, severity badge, Edit/Delete buttons
10. ✓ Edit button opens FindingFormModal with finding data pre-filled
11. ✓ FindingFormModal saves changes via PATCH, refetches findings
12. ✓ Severity Override dropdown works, requires justification
13. ✓ Delete button shows confirmation, deletes finding
14. ✓ Generate Report button validates findings, shows appropriate modal
15. ✓ View Only role sees all content but cannot edit (inputs are read-only, buttons hidden)

---

## STOP CONDITIONS

**STOP after completing this step.** Do NOT proceed to Step 10 (dnd-kit drag-and-drop) until I confirm Step 9 is working.

After you finish:
1. Commit changes
2. Test in browser
3. Report back with:
   - What you built
   - What's working
   - Any issues or decisions you made
   - Screenshots if possible

Wait for my confirmation before moving to Step 10.

---

Begin implementation now.
