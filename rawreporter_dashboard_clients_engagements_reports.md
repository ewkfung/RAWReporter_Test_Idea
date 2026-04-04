# RAWReporter — Dashboard, Clients, Engagements, Reports
# Claude Code Instruction Set
# Implement after RBAC + Library redesign is complete (A1-A8, B1-B9)

---

## CONTEXT

RBAC, library redesign, and user management are complete.
Auth is working. Permissions are enforced on the backend and
the usePermission hook is available on the frontend.

Now build the Dashboard, Clients, Engagements, and Reports pages.
Follow the exact order below. Stop after each step and wait for
confirmation before proceeding.

All pages use the existing component library from src/components/ui/.
Apply usePermission checks to every action button as you build.
Never show a button the current user's role cannot use.

---

## VISUAL PATTERN — COLLAPSED ROW LIST

Clients, Engagements, and Reports all use the same collapsed
row list pattern established in the Library page.

Rules for this pattern:
  - Each row is a card with a white background, subtle shadow,
    and rounded corners (--radius-md)
  - Collapsed state shows key summary info in a single horizontal row
  - Clicking anywhere on the row (or the chevron) expands it
  - Expanded state shows additional detail below the summary row
    within the same card — no navigation away from the page
  - A thin left border colour indicates status or type
  - Rows are separated by 8px gap, not a table
  - Filter bar sits above the list — search input on the left,
    filter pills or dropdowns on the right
  - Empty state is centered, friendly, no raw "no data" text

---

===================================================
STEP 1 — Dashboard
===================================================

File: src/pages/dashboard/DashboardPage.tsx

PageWrapper title="Dashboard"

--- Summary Cards Row ---

Four cards in a horizontal row. Use the existing Card component
with hoverable=false. Each card is equal width. On narrow
screens stack to 2x2 grid.

Card 1 — Total Clients
  Icon: simple building SVG (inline, no library)
  Large number: total client count fetched from
    GET /api/v1/clients/ (count from response length or
    a dedicated count endpoint if one exists)
  Label: "Clients"
  Card left border: --color-primary (blue)

Card 2 — Active Engagements
  Icon: simple clipboard SVG
  Large number: count of engagements where
    status = "active" or "in_review"
  Label: "Active Engagements"
  Card left border: --color-success (green)

Card 3 — Reports In Progress
  Icon: simple document SVG
  Large number: count of reports where
    status = "draft" or "in_review"
  Label: "Reports In Progress"
  Card left border: --color-warning (amber)

Card 4 — Library Findings
  Icon: simple book SVG
  Large number: count of library findings where
    is_archived = False
  Label: "Library Findings"
  Card left border: --color-primary (blue)

All four counts are fetched in parallel using React Query.
Show a Spinner inside each card while loading.
Show "—" if fetch fails — do not crash the dashboard.

--- Quick Access Section ---

Below the summary cards, two columns side by side.
Column headers use a small uppercase label style
(11px, --color-gray-500, letter-spacing 0.05em).

Left column — "Recent Engagements"
  Fetch last 5 engagements ordered by updated_at DESC
  Each item is a compact row:
    Left: status badge + engagement title (bold, truncated
          to 1 line)
    Right: client name in gray + type pill
    Full row is clickable → navigates to /engagements
      with that engagement expanded (pass engagement id
      as a URL param: /engagements?expand={id})
  Hover: subtle background highlight, cursor pointer
  Empty state: "No engagements yet.
    Create your first engagement to get started."
    Show "+ New Engagement" link if
    usePermission("engagement", "create")

Right column — "Reports In Progress"
  Fetch last 5 reports where status = "draft" or "in_review"
  ordered by updated_at DESC
  Each item is a compact row:
    Left: audience badge (Technical | Executive) + report
          title (bold, truncated to 1 line)
    Right: status badge + engagement name in gray
    Full row is clickable → navigates directly to
      /reports/{id}/build (the report builder)
  Hover: subtle background highlight, cursor pointer
  Empty state: "No reports in progress."

Data fetching:
  Use React Query for all four summary card counts and
  both quick access lists.
  All requests fire in parallel — use useQueries or
  multiple useQuery calls.
  Cache time: 2 minutes (staleTime: 120000)
  Do not block the page render on any single request.

===================================================
STEP 2 — Clients Page
===================================================

File: src/pages/clients/ClientsPage.tsx
Route: /clients

PageWrapper title="Clients"

Top action bar (right side):
  "+ New Client" button
  Only render if usePermission("client", "create")
  Clicking opens ClientFormModal in create mode

--- Filter Bar ---

Horizontal bar below the page title:
  Left: Search input — filters client list by name
        in real time (debounced 300ms, client-side filter
        on already-fetched data)
  Right: Sort by dropdown:
    Name (A-Z) | Name (Z-A) | Recently Updated

--- Clients List ---

Vertical list of ClientRow components.
Fetch all clients on mount: GET /api/v1/clients/
Apply search filter and sort client-side after fetch.

Each ClientRow has two states: collapsed and expanded.

COLLAPSED STATE (always visible):
  Single horizontal row inside a white card:
    Left: chevron icon (▶ collapsed, ▼ expanded)
    Client name (bold, 16px)
    Industry tag (gray pill)
    Vertical tag (gray pill, slightly different shade
                  to distinguish from industry)
    Right side:
      Manage dropdown button (three dots or "Manage" label)
      Only render if usePermission("client", "edit"):
        Dropdown options:
          Edit → opens ClientFormModal in edit mode
          Delete → opens ConfirmModal (destructive)
                   only render if
                   usePermission("client", "delete")

EXPANDED STATE (shown below the collapsed row within
the same card, smooth CSS transition):

  Two sections inside the expanded area:

  Section A — Client Information
    Label: "CLIENT INFORMATION" (uppercase, small, gray)
    Display these fields in a clean two-column grid:
      Primary Contact: {primary_contact}
      Contact Email:   {contact_email} (clickable mailto link)
      Industry:        {industry}
      Vertical:        {vertical}
      Client Since:    {created_at formatted as Month DD, YYYY}

  Section B — Engagements
    Label: "ENGAGEMENTS" (uppercase, small, gray)
    Below label: list of engagements for this client
    Fetch: GET /api/v1/engagements/?client_id={id}
           only fetched when the row is first expanded
           (lazy load — not on initial page load)
    Show Spinner while loading engagements.

    Each engagement shown as a compact sub-row:
      Status badge | Engagement title | Type pill |
      Date range (start – end) | "Open" button →
      navigates to /engagements?expand={engagement_id}

    If no engagements:
      "No engagements for this client yet."
      Show "+ New Engagement" link if
      usePermission("engagement", "create")
      Clicking pre-fills the client_id in EngagementFormModal

    Below engagements list:
      "+ New Engagement" button (small, secondary style)
      Only if usePermission("engagement", "create")
      Opens EngagementFormModal with client_id pre-filled

  Divider line between Section A and Section B.

Only one client row can be expanded at a time.
Expanding a new row collapses the previously expanded one.
Exception: if the URL contains ?expand={id}, that client
row opens expanded on page load.

--- ClientFormModal ---

File: src/components/clients/ClientFormModal.tsx
Used for both create and edit.

Props:
  isOpen: bool
  onClose: () => void
  client?: Client  (undefined = create mode)
  onSuccess: (client: Client) => void

Fields:
  name (Input, required)
  industry (Input, required)
  vertical (Input, required)
  primary_contact (Input)
  contact_email (Input, type="email")

Footer: Cancel | Save
On save:
  Create: POST /api/v1/clients/
  Edit:   PATCH /api/v1/clients/{id}
On success:
  Call onSuccess with the returned client
  Invalidate React Query cache for clients list
  Show toast: "Client saved" / "Client updated"
  Close modal

--- Delete Client ---

Use existing ConfirmModal.
On confirm: DELETE /api/v1/clients/{id}
On success:
  Remove client from list (optimistic update or refetch)
  Show toast: "Client deleted"
  If the deleted client's row was expanded, collapse it

===================================================
STEP 3 — Engagements Page
===================================================

File: src/pages/engagements/EngagementsPage.tsx
Route: /engagements

PageWrapper title="Engagements"

Top action bar:
  "+ New Engagement" button
  Only if usePermission("engagement", "create")
  Opens EngagementFormModal in create mode

--- Filter Bar ---

Left:  Search input — filters by engagement title or
       client name (debounced 300ms, client-side)
Right:
  Status filter dropdown:
    All | Scoping | Active | In Review | Delivered | Closed
  Type filter dropdown:
    All | Pentest | Gap Assessment | Vulnerability Assessment |
    Tabletop | TSA Directive | Compliance Assessment
  Sort by: Last Updated | Start Date | Name (A-Z)

--- Engagements List ---

Fetch all engagements: GET /api/v1/engagements/
Apply filters and sort client-side.

If URL contains ?expand={id}, that engagement row opens
expanded on load. Used when navigating from the Dashboard
or from the Client page.

Each EngagementRow has collapsed and expanded states.

COLLAPSED STATE:
  Single horizontal row inside a white card.
  Left border colour indicates status:
    scoping   → --color-gray-300
    active    → --color-success (green)
    in_review → --color-warning (amber)
    delivered → --color-primary (blue)
    closed    → --color-gray-200

  Row contents left to right:
    Chevron (▶/▼)
    Engagement title (bold, truncated 1 line, max 40% width)
    Client name (gray, truncated, linked — clicking client
                 name navigates to /clients?expand={client_id})
    Type pill (colored by type):
      pentest              → red pill
      gap_assessment       → purple pill
      vulnerability_assessment → orange pill
      tabletop             → teal pill
      tsa_directive        → blue pill
      compliance_assessment → gray pill
    Status badge
    Last updated (relative time: "2 days ago", "Just now")
    Right: Manage dropdown button
      Only if usePermission("engagement", "edit"):
        Edit → opens EngagementFormModal pre-filled
        Change Status → opens StatusChangeModal
        Delete → ConfirmModal, only if
                 usePermission("engagement", "delete")

EXPANDED STATE:
  Two sections inside the expanded card:

  Section A — Engagement Details
    Label: "ENGAGEMENT DETAILS"
    Two-column grid:
      Lead Consultant: {engagement_lead}
      Start Date:      {start_date formatted}
      End Date:        {end_date formatted} or "TBD"
      Type:            {type display name}
      Status:          {status badge}
    Full width below grid:
      Scope Description label + paragraph text
      (If empty: "No scope description provided.")

  Section B — Reports
    Label: "REPORTS"
    Fetch: GET /api/v1/reports/?engagement_id={id}
           lazy — only fetched on first expand

    Each report shown as a compact sub-row:
      Audience badge (Technical | Executive)
      Report title (bold)
      Status badge
      Last updated (relative time)
      "Open Builder" button → navigates to
        /reports/{id}/build

    If no reports:
      "No reports for this engagement yet."
      Show "+ New Report" if usePermission("report","create")

    Below reports list:
      "+ New Report" button (small, secondary)
      Only if usePermission("report", "create")
      Opens ReportFormModal with engagement_id pre-filled
      On report created: redirect to /reports/{id}/build

Only one engagement row expanded at a time.

--- EngagementFormModal ---

File: src/components/engagements/EngagementFormModal.tsx

Props:
  isOpen: bool
  onClose: () => void
  engagement?: Engagement  (undefined = create mode)
  defaultClientId?: string  (pre-fills client select)
  onSuccess: (engagement: Engagement) => void

Fields:
  client_id (Select — searchable dropdown of all clients,
             required, pre-filled if defaultClientId passed)
  title (Input, required)
  type (Select):
    Pentest | Gap Assessment | Vulnerability Assessment |
    Tabletop Exercise | TSA Directive | Compliance Assessment
  status (Select):
    Scoping | Active | In Review | Delivered | Closed
  engagement_lead (Input)
  start_date (Input type="date")
  end_date (Input type="date")
  scope_description (Textarea)

Footer: Cancel | Save
On save:
  Create: POST /api/v1/engagements/
  Edit:   PATCH /api/v1/engagements/{id}
On success:
  Invalidate engagements list cache
  Show toast: "Engagement created" / "Engagement updated"
  Call onSuccess
  Close modal

--- StatusChangeModal ---

File: src/components/engagements/StatusChangeModal.tsx
A lightweight modal specifically for changing engagement status.
Shows current status and a Select for the new status.
On confirm: PATCH /api/v1/engagements/{id} with new status
Show toast: "Status updated to [new status]"

===================================================
STEP 4 — Reports Page
===================================================

File: src/pages/reports/ReportsPage.tsx
Route: /reports

PageWrapper title="Reports"

Note: This page is a flat list of all reports across all
engagements. It is a quick-access view. Reports are also
visible inside each engagement on the Engagements page.
Clicking any report on this page goes directly to the
Report Builder — there is no separate report detail page.

Top action bar:
  No "New Report" button here — reports are created from
  within an engagement. If the user tries to create a report
  without an engagement context it cannot be done correctly.
  Instead show a subtle info note on the right:
  "To create a report, open an engagement and add a report
   from there." (gray text, 13px, no icon needed)

--- Filter Bar ---

Left:  Search input — filters by report title or
       engagement name (debounced 300ms, client-side)
Right:
  Status filter:
    All | Draft | In Review | Final
  Audience filter:
    All | Technical | Executive
  Sort by: Last Updated | Title (A-Z)

--- Reports List ---

Fetch all reports: GET /api/v1/reports/
Apply filters and sort client-side.

Each ReportRow is a collapsed row card.
Unlike Clients and Engagements, Reports rows do NOT expand.
They are single-height rows that navigate on click.

REPORT ROW:
  White card, single horizontal row.
  Left border colour by status:
    draft     → --color-gray-300
    in_review → --color-warning (amber)
    final     → --color-success (green)

  Row contents left to right:
    Audience badge:
      Technical → blue pill
      Executive → purple pill
    Report title (bold, truncated 1 line)
    Engagement name (gray, truncated, 13px)
    Client name (gray, 13px, lighter than engagement)
    Status badge
    Last updated (relative time: "3 hours ago")
    Right: "Open Builder" button (primary, small)
           → navigates to /reports/{id}/build
           Manage dropdown (three dots):
             Only if usePermission("report", "edit"):
               Rename → inline edit of title or small modal
             Only if usePermission("report", "delete"):
               Delete → ConfirmModal (destructive)

  Clicking anywhere on the row (except the manage dropdown)
  navigates to /reports/{id}/build

  No expand/collapse on this page — clicking navigates away.

--- Delete Report ---

ConfirmModal with message:
  "Deleting this report will permanently remove all findings,
   sections, and evidence attached to it. This cannot be undone."
On confirm: DELETE /api/v1/reports/{id}
On success:
  Remove from list
  Show toast: "Report deleted"

--- Empty States ---

If no reports match filters:
  "No reports match your search."

If no reports exist at all:
  "No reports yet. Create a report from within an engagement
   to get started."
  Link: "Go to Engagements →" → /engagements

--- ReportFormModal ---

File: src/components/reports/ReportFormModal.tsx
Used when creating a report from within an engagement row
on the Engagements page. Not triggered from the Reports page.

Props:
  isOpen: bool
  onClose: () => void
  engagementId: string  (always pre-filled, required)
  onSuccess: (report: Report) => void

Fields:
  title (Input, required)
  audience (Select):
    Technical | Executive

Footer: Cancel | Create Report
On save: POST /api/v1/reports/ with engagement_id
On success:
  Show toast: "Report created"
  Call onSuccess with new report
  Navigate to /reports/{id}/build

===================================================
STEP 5 — Update Routing in App.tsx
===================================================

Ensure these routes exist and point to the correct pages:

  /                   → DashboardPage
  /clients            → ClientsPage
  /engagements        → EngagementsPage
  /reports            → ReportsPage
  /reports/:id/build  → ReportBuilderPage (already exists,
                        full-screen, no AppLayout)

All routes except /login and /register are wrapped in
ProtectedRoute → AppLayout.
ReportBuilderPage uses its own full-screen layout —
do not wrap in AppLayout.

Update the Sidebar to ensure active link highlighting
works correctly for all four new routes.

===================================================
STEP 6 — Update CLAUDE.md Build Status
===================================================

At the end of CLAUDE.md update the build status section:

  Phase 5 Steps 5-9 (Dashboard, Clients,             ✓
    Engagements, Reports, routing)

  In progress:
    Phase 5 Steps 10-12 (Report Builder dnd-kit,
    override modals, polish)

===================================================
SHARED COMPONENT NOTES
===================================================

Relative time formatting:
  Create or update src/utils/formatting.ts with a
  formatRelativeTime(date: string | Date): string function:
    < 1 minute ago  → "Just now"
    1-59 minutes    → "N minutes ago"
    1-23 hours      → "N hours ago"
    1-6 days        → "N days ago"
    7+ days         → formatted date "Jan 15, 2025"
  Used on Dashboard quick access, Engagements list,
  Reports list.

Status badge colours:
  Reuse the existing Badge component. Map statuses:
  Engagements:
    scoping    → neutral (gray)
    active     → success (green)
    in_review  → warning (amber)
    delivered  → info (blue)
    closed     → neutral (gray)
  Reports:
    draft      → neutral (gray)
    in_review  → warning (amber)
    final      → success (green)

Type pill colours (Engagements):
  pentest                  → red
  gap_assessment           → purple
  vulnerability_assessment → amber/orange
  tabletop                 → teal
  tsa_directive            → blue
  compliance_assessment    → gray

Lazy loading for expanded sections:
  On Clients page: fetch engagements for a client only
    when that client row is first expanded.
    Cache the result in React Query with key:
    ["engagements", "by-client", clientId]
  On Engagements page: fetch reports for an engagement
    only when that row is first expanded.
    Cache with key: ["reports", "by-engagement", engagementId]
  This avoids loading all engagements and reports on page
  load when the user may only care about one or two.

URL-driven expand state:
  Both /clients and /engagements support ?expand={id}
  Read the query param on mount using useSearchParams.
  If present, open that row expanded automatically.
  Clear the param from the URL after expanding (replace
  history entry, do not push) so the back button works
  correctly.

===================================================
BUILD ORDER SUMMARY
===================================================

  Step 1 → Dashboard (summary cards + quick access)
  Step 2 → Clients page + ClientFormModal
  Step 3 → Engagements page + EngagementFormModal
           + StatusChangeModal
  Step 4 → Reports page + ReportFormModal
  Step 5 → Routing updates in App.tsx
  Step 6 → Update CLAUDE.md build status

Stop after each step and wait for confirmation.
Do not start the next step until the current one
is verified working in the browser.

===================================================
VERIFICATION CHECKLIST
===================================================

Complete this checklist in the browser before calling
this instruction done.

DASHBOARD:
  □ All 4 summary cards show correct counts
  □ Cards show spinner while loading, "—" on error
  □ Recent Engagements shows last 5, clicking navigates
    to /engagements?expand={id} and expands that row
  □ Reports In Progress shows last 5, clicking opens
    report builder directly
  □ Empty states show on both quick access columns
    when no data exists

CLIENTS:
  □ All clients listed in collapsed state
  □ Search filters by client name in real time
  □ Sort by name and recently updated works
  □ Expanding a client shows contact info + engagements
  □ Engagements lazy load on first expand (check network tab)
  □ Expanding one client collapses the previously open one
  □ /clients?expand={id} opens that client expanded on load
  □ As Admin: Manage dropdown shows Edit and Delete
  □ As Consultant: Manage dropdown hidden entirely
  □ Create client works, client appears in list
  □ Edit client pre-fills all fields correctly
  □ Delete client shows confirm modal, removes from list
  □ "+ New Engagement" inside expanded client pre-fills
    client in engagement form

ENGAGEMENTS:
  □ All engagements listed with correct left border colour
    per status
  □ Search filters by title and client name
  □ Status and type filters work correctly
  □ Collapsed row shows: title, client name (linked),
    type pill, status badge, last updated, manage button
  □ Clicking client name navigates to
    /clients?expand={client_id}
  □ Expanding shows scope, lead, dates, reports
  □ Reports lazy load on first expand
  □ /engagements?expand={id} opens that row on load
  □ Manage dropdown: Edit, Change Status, Delete
    (each hidden if role lacks permission)
  □ StatusChangeModal updates status, badge refreshes
  □ "+ New Report" inside expanded engagement opens
    ReportFormModal with engagement pre-filled
  □ Creating report redirects to report builder

REPORTS:
  □ All reports listed as single-height rows
  □ Left border colour matches status
  □ Audience badge (Technical/Executive) visible
  □ Clicking row or "Open Builder" goes to report builder
  □ Search, status filter, audience filter all work
  □ Sort by last updated and title works
  □ Manage dropdown: Rename, Delete
    (hidden if role lacks permission)
  □ Delete shows warning about permanent data loss
  □ Info note visible explaining reports are created
    from engagements
  □ Empty state shows link to /engagements

PERMISSIONS:
  □ As View Only: no create/edit/delete buttons visible
    on any of the four pages
  □ As Consultant: can see all data, no client or
    engagement management buttons, no report delete
  □ As Lead: can create/edit clients and engagements,
    cannot delete clients or engagements
  □ As Admin: full access to all buttons on all pages
