# RAWReporter — RBAC, Library Redesign & Navigation Update
# Claude Code Instruction Set
# Implement after Phase 5 Step 4 (auth working)

---

## CONTEXT

Auth is working. The following changes are required before
continuing with Phase 5 Steps 5-12:

1. RBAC system — roles, permissions, middleware
2. Library finding archive/restore functionality
3. Navigation restructure — remove standalone Findings page
4. Library page redesign — management view for Admin only
5. Report builder "Add Findings" workflow — library comes
   to the consultant from within the report
6. User management page — Admin only
7. Permission-aware UI — hide/show actions based on role

Build in the exact order below. Stop after each step
and wait for confirmation before proceeding.

---

## PART A — BACKEND

===================================================
STEP A1 — RBAC Schema + Migration
===================================================

Add these four tables to the database.
Create a new Alembic migration after all models are defined.

--- backend/rawreporter/models/role.py ---

class Role(Base, TimestampMixin):
  __tablename__ = "roles"

  id: uuid PK
  name: str (unique, not null)         # "admin", "lead",
                                        # "consultant", "view_only"
  display_name: str (not null)         # "Admin", "Lead", etc.
  description: str (nullable)
  is_system_role: bool (default True)  # system roles cannot
                                        # be deleted, only
                                        # custom roles can be
  is_active: bool (default True)

--- backend/rawreporter/models/permission.py ---

class Permission(Base):
  __tablename__ = "permissions"

  id: uuid PK
  resource: str (not null)   # "client", "engagement",
                              # "report", "finding",
                              # "library_finding", "evidence",
                              # "user"
  action: str (not null)     # "view", "create", "edit",
                              # "delete", "archive",
                              # "restore", "generate",
                              # "assign_roles"
  description: str (nullable)

  UniqueConstraint(resource, action)

--- backend/rawreporter/models/role_permission.py ---

class RolePermission(Base):
  __tablename__ = "role_permissions"

  id: uuid PK
  role_id: uuid FK → roles.id (cascade delete)
  permission_id: uuid FK → permissions.id (cascade delete)

  UniqueConstraint(role_id, permission_id)

--- backend/rawreporter/models/user_role.py ---

class UserRole(Base, TimestampMixin):
  __tablename__ = "user_roles"

  id: uuid PK
  user_id: uuid FK → users.id (cascade delete)
  role_id: uuid FK → roles.id (cascade delete)
  assigned_by: uuid FK → users.id (nullable)

  UniqueConstraint(user_id, role_id)

--- backend/rawreporter/models/library_finding.py ---

Add these three fields to the existing LibraryFinding model:
  is_archived: bool (default False, not null)
  archived_at: datetime (nullable)
  archived_by: uuid FK → users.id (nullable)

Generate a new Alembic migration covering all of the above.
Run the migration and confirm it applies cleanly.

===================================================
STEP A2 — Seed Built-in Roles and Permissions
===================================================

Create backend/rawreporter/utils/seed_rbac.py

This module exports one async function:
  seed_roles_and_permissions(session: AsyncSession) -> None

It must be idempotent — calling it multiple times must
produce the same result with no duplicates.

Seed these permissions (resource + action pairs):

  client:           view, create, edit, delete
  engagement:       view, create, edit, delete
  report:           view, create, edit, delete, generate
  finding:          view, create, edit, delete, move
  library_finding:  view, create, edit, delete,
                    archive, restore
  evidence:         view, upload, delete
  user:             view, create, edit, deactivate,
                    assign_roles

Seed these four roles with the permissions below.
Use is_system_role = True for all four.

ADMIN role — all permissions
LEAD role:
  client:view, client:create, client:edit
  engagement:view, engagement:create, engagement:edit
  report:view, report:create, report:edit, report:generate
  finding:view, finding:create, finding:edit,
  finding:delete, finding:move
  library_finding:view
  evidence:view, evidence:upload, evidence:delete

CONSULTANT role:
  client:view
  engagement:view
  report:view, report:edit, report:generate
  finding:view, finding:create, finding:edit,
  finding:delete, finding:move
  library_finding:view
  evidence:view, evidence:upload

VIEW_ONLY role:
  client:view
  engagement:view
  report:view
  finding:view
  library_finding:view
  evidence:view

Call seed_roles_and_permissions from the app lifespan
handler in main.py — runs on every startup, safe because
it is idempotent.

===================================================
STEP A3 — First User Becomes Admin
===================================================

In backend/rawreporter/auth/router.py, update the
register endpoint:

After a new user is successfully created:
  1. Count total users in the users table
  2. If this is the first user (count == 1 after insert):
     a. Fetch the Admin role by name = "admin"
     b. Create a UserRole row linking this user to Admin
     c. Log: "First user registered — Admin role assigned"
  3. If not the first user:
     a. Fetch the View Only role by name = "view_only"
     b. Create a UserRole row linking this user to View Only
     c. All subsequent users default to View Only until
        an Admin explicitly changes their role

===================================================
STEP A4 — Permission Dependency
===================================================

Create backend/rawreporter/dependencies.py
(replace the existing stub if one exists)

Implement:

async def get_current_user(
    token: str,
    session: AsyncSession
) -> User:
  Validates JWT, fetches and returns the current user.
  Raises HTTP 401 if token is invalid or user not found.

async def require_permission(
    resource: str,
    action: str
) -> Callable:
  Returns a FastAPI dependency function that:
    1. Gets the current user via get_current_user
    2. Loads all roles for this user via user_roles join
    3. Loads all permissions for those roles via
       role_permissions join
    4. Checks if any permission matches resource + action
    5. If yes: returns the current user
    6. If no: raises HTTP 403 with body:
       {
         "detail": "Permission denied",
         "required": "{resource}:{action}",
         "user_id": "{user.id}"
       }

Usage in routers:
  @router.delete("/{id}")
  async def delete_client(
      id: UUID,
      user = Depends(require_permission("client", "delete")),
      session: AsyncSession = Depends(get_db)
  ):

Also implement:

async def get_user_permissions(
    user_id: UUID,
    session: AsyncSession
) -> list[str]:
  Returns a list of "resource:action" strings for a user.
  Example: ["client:view", "client:create", "report:view"]
  Used by the frontend permissions endpoint.

===================================================
STEP A5 — Apply Permission Checks to All Routers
===================================================

Update every router to use require_permission.
Map each route to the correct resource:action pair:

routers/clients.py:
  GET    /           → client:view
  POST   /           → client:create
  GET    /{id}       → client:view
  PATCH  /{id}       → client:edit
  DELETE /{id}       → client:delete

routers/engagements.py:
  GET    /           → engagement:view
  POST   /           → engagement:create
  GET    /{id}       → engagement:view
  PATCH  /{id}       → engagement:edit
  DELETE /{id}       → engagement:delete

routers/reports.py:
  GET    /           → report:view
  POST   /           → report:create
  GET    /{id}       → report:view
  PATCH  /{id}       → report:edit
  DELETE /{id}       → report:delete
  POST   /{id}/generate → report:generate

routers/sections.py:
  GET    /           → report:view
  PATCH  /{id}       → report:edit

routers/findings.py:
  GET    /           → finding:view
  POST   /           → finding:create
  GET    /{id}       → finding:view
  PATCH  /{id}       → finding:edit
  PATCH  /{id}/severity  → finding:edit
  PATCH  /{id}/move      → finding:move
  PATCH  /{id}/reorder   → finding:move
  DELETE /{id}       → finding:delete

routers/library.py:
  GET    /           → library_finding:view
  POST   /           → library_finding:create
  GET    /{id}       → library_finding:view
  PATCH  /{id}       → library_finding:edit
  DELETE /{id}       → library_finding:delete
  POST   /{id}/archive   → library_finding:archive
  POST   /{id}/restore   → library_finding:restore
  POST   /{id}/import-to-report → finding:create
  GET    /archived   → library_finding:archive

routers/evidence.py:
  GET    /           → evidence:view
  POST   /           → evidence:upload
  DELETE /{id}       → evidence:delete

===================================================
STEP A6 — Archive/Restore Endpoints
===================================================

In routers/library.py add:

POST /api/v1/library/{id}/archive
  Requires library_finding:archive
  Sets is_archived = True, archived_at = now(),
  archived_by = current_user.id
  Returns updated LibraryFinding

POST /api/v1/library/{id}/restore
  Requires library_finding:restore
  Sets is_archived = False, archived_at = None,
  archived_by = None
  Returns updated LibraryFinding

GET /api/v1/library/archived
  Requires library_finding:archive (reuse archive permission
  as the gate for viewing the archive)
  Returns all LibraryFindings where is_archived = True
  Ordered by archived_at DESC

Update the existing GET /api/v1/library/ endpoint:
  Add filter: is_archived = False by default
  Archived findings never appear in the standard list

===================================================
STEP A7 — User Management Endpoints
===================================================

Create routers/users.py

All routes require user:view or higher as noted.

GET    /api/v1/users/
  Requires user:view
  Returns list of all users with their roles
  Each user: id, email, is_active, roles[], created_at

GET    /api/v1/users/{id}
  Requires user:view
  Returns single user with roles

POST   /api/v1/users/
  Requires user:create
  Creates a new user (Admin creating users directly,
  not self-registration)
  Body: email, password, role_id
  Assigns the specified role immediately

PATCH  /api/v1/users/{id}
  Requires user:edit
  Updatable fields: email, is_active

POST   /api/v1/users/{id}/assign-role
  Requires user:assign_roles
  Body: role_id
  Replaces the user's current role with the new role
  (one role per user for now — custom multi-role later)
  Creates new UserRole, removes existing UserRole

DELETE /api/v1/users/{id}/deactivate
  Requires user:deactivate
  Sets is_active = False on the user
  Does not delete the user or their data

GET    /api/v1/users/me/permissions
  No special permission required — any authenticated user
  Returns list of "resource:action" strings for the
  current user using get_user_permissions()
  Frontend uses this to know what to show/hide

GET    /api/v1/roles/
  Requires user:view
  Returns all roles with their permissions

Include routers/users.py in main.py with prefix /api/v1

===================================================
STEP A8 — Backend Tests
===================================================

Add to tests/test_rbac.py:

  test_first_user_gets_admin_role
    Register first user, verify UserRole exists with
    role.name == "admin"

  test_second_user_gets_view_only_role
    Register second user, verify role.name == "view_only"

  test_admin_can_delete_client
    Create client, call DELETE as admin user
    Assert 200

  test_consultant_cannot_delete_client
    Create client, call DELETE as consultant user
    Assert 403 with "Permission denied" detail

  test_consultant_can_delete_finding
    Create finding in a report, call DELETE as consultant
    Assert 200

  test_view_only_cannot_create_finding
    Call POST /findings as view_only user
    Assert 403

  test_archive_hides_from_library_list
    Create library finding, archive it
    Call GET /library/ — assert finding not in results
    Call GET /library/archived — assert finding in results

  test_restore_brings_back_to_library
    Archive finding, restore it
    Call GET /library/ — assert finding in results
    Call GET /library/archived — assert finding not in results

  test_permission_endpoint_returns_correct_list
    Call GET /users/me/permissions as consultant
    Assert list contains "finding:create"
    Assert list does not contain "client:delete"

Run pytest. All tests must pass before proceeding to Part B.

---

## PART B — FRONTEND

===================================================
STEP B1 — Permission Store and Hook
===================================================

Update src/store/authStore.ts:
  Add: permissions: string[]  (list of "resource:action")
  Add: setPermissions(permissions: string[]): void
  Update logout(): clears permissions too

Create src/hooks/usePermission.ts:
  import { useAuthStore } from "../store/authStore"

  export function usePermission(
    resource: string,
    action: string
  ): boolean {
    const permissions = useAuthStore(s => s.permissions)
    return permissions.includes(`${resource}:${action}`)
  }

  export function usePermissions(
    checks: Array<{resource: string, action: string}>
  ): Record<string, boolean> {
    const permissions = useAuthStore(s => s.permissions)
    return Object.fromEntries(
      checks.map(({ resource, action }) => [
        `${resource}:${action}`,
        permissions.includes(`${resource}:${action}`)
      ])
    )
  }

Update src/api/auth.ts:
  Add fetchMyPermissions(): Promise<string[]>
    Calls GET /api/v1/users/me/permissions
    Returns the list of permission strings

Update AppLayout.tsx:
  On mount, after confirming auth token exists:
    Call fetchMyPermissions()
    Store result in authStore via setPermissions()
  This runs once per session. Permissions are always
  fresh on page load.

===================================================
STEP B2 — Updated Navigation
===================================================

Update src/components/layout/Sidebar.tsx:

Remove:
  Findings link (this page no longer exists)

Keep:
  Dashboard      /
  Clients        /clients
  Engagements    /engagements
  Reports        /reports
  Library        /library

Add at bottom before user/logout section:
  Settings group (only visible if user has user:view):
    Users        /settings/users

Library link: visible to all roles (all can view)
Settings/Users link: only render if
  usePermission("user", "view") === true

===================================================
STEP B3 — Library Page Redesign
===================================================

Replace src/pages/library/LibraryPage.tsx entirely.

Layout:
  PageWrapper title="Findings Library"

  Top action bar (right side):
    "New Finding" button — only render if
      usePermission("library_finding", "create")
    "View Archive" button — only render if
      usePermission("library_finding", "archive")
      Links to /library/archive

  Filter bar below title:
    Search input (searches title and summary, debounced
    300ms)
    Severity filter pills:
      All | Critical | High | Medium | Low | Informational
    Sort by: Alphabetical (A-Z) | Severity (Critical first)

  Findings list — NOT a card grid, a vertical list of
  collapsed rows:

    Each row is a LibraryFindingRow component:
      Left: chevron expand/collapse icon
      Severity badge (colored pill)
      Title (bold)
      Vertical tag (gray pill)
      Right side (always visible):
        If usePermission("library_finding", "edit"):
          "Manage" dropdown button with three options:
            Edit → opens LibraryFindingFormModal
            Archive → opens ConfirmModal then calls
                      POST /library/{id}/archive
            Delete → opens ConfirmModal (destructive,
                     red confirm button) then calls
                     DELETE /library/{id}

      Expanded state (clicking row or chevron):
        Shows summary text (full, not truncated)
        Shows framework_refs as gray pills
        Shows is_ot_specific badge if true
        Shows reference types that have entries:
          e.g. "References: CVE · CWE · NIST"

  Note: There is NO "Add to Report" button on this page.
  Consultants add findings from within the report builder.
  This page is purely for viewing and managing the library.

  Empty state:
    If no findings match filters:
      "No findings match your search"
    If library is completely empty and user has create
    permission:
      "No findings in the library yet. Create the first one."
    If library is empty and user lacks create permission:
      "No findings in the library yet."

Create src/components/library/LibraryFindingRow.tsx
  The individual collapsible row component described above.

===================================================
STEP B4 — Library Archive Page
===================================================

Create src/pages/library/LibraryArchivePage.tsx

  Route: /library/archive
  Protected: redirect to /library if user lacks
    usePermission("library_finding", "archive")

  PageWrapper title="Archived Findings"
    Breadcrumb: Library → Archive

  Back link: ← Back to Library

  Same row layout as LibraryPage but:
    Each row right side shows:
      "Archived [date]" in gray text
      "Restore" button → calls POST /library/{id}/restore
                       → on success: remove from list,
                         show success toast
                         "Finding restored to library"
      "Delete Permanently" button → ConfirmModal
                                  → calls DELETE /library/{id}

  Empty state: "No archived findings."

===================================================
STEP B5 — Library Finding Form Modal
===================================================

Create src/components/library/LibraryFindingFormModal.tsx

Large modal (80vw, max 860px) for create and edit.

Two column layout:

Left column:
  title (Input, required)
  severity (Select — Critical/High/Medium/Low/Informational)
  cvss_score_default (Input, number, 0.0-10.0)
  vertical (Input)
  is_ot_specific (Toggle)
  tags (Input — type comma-separated values, display as
        removable pills below the input)
  framework_refs (same pill pattern as tags)
  questionnaire_trigger (same pill pattern)

Right column:
  summary (Textarea, required)
  description_technical (Textarea)
  description_executive (Textarea)
  recommendation (Textarea)
  remediation_steps (Textarea)
  remediation_steps_enabled (Toggle)

References section — full width below both columns:
  Section header: "References"
  For each of 6 ref types in order:
    CVE, CWE, CISA, NIST, NVD, Manufacturer

  Each ref type block:
    Row: [ref type label bold] [enable/disable Toggle]
    When toggle is ON:
      List of entry rows:
        [value Input] [URL Input optional] [✕ remove button]
      "+ Add CVE" button (or relevant type name)
    When toggle is OFF:
      Entire entry section is grayed out and non-interactive
      Existing entries are preserved but hidden

Footer:
  Cancel | Save (primary)
  Save is disabled while any required field is empty
  On save: POST /library/ for create, PATCH /library/{id}
           for edit
  References are saved as LibraryFindingReference rows:
    For each ref type, for each entry in the list,
    create/update a LibraryFindingReference with
    ref_type, value, url, position (index in list)
    Delete any LibraryFindingReference rows for this
    finding that are no longer in the form

===================================================
STEP B6 — Report Builder "Add Findings" Workflow
===================================================

This replaces the old AddToReportModal approach.
Findings are now added from within the report builder.

Update src/components/report/SectionBlock.tsx:

For severity sections (sections with a severity_filter):
  Add an "Add Findings" button at the bottom of the
  findings list within that section.
  Button label: "+ Add Findings from Library"
  Clicking this button opens LibrarySelectModal,
  passing:
    reportId: the current report ID
    targetSectionId: this section's ID
    severityFilter: this section's severity_filter
    (so the modal can pre-filter by severity)

Create src/components/report/LibrarySelectModal.tsx

This is the modal that opens when a consultant clicks
"Add Findings from Library" inside a section.

Props:
  isOpen: bool
  onClose: () => void
  reportId: string
  targetSectionId: string
  severityFilter: SeverityEnum | null
  onFindingsAdded: (findings: Finding[]) => void

Layout:
  Modal title: "Add Findings from Library"
  Subtitle: "Adding to: [section name]"

  Filter bar:
    Search input (debounced 300ms)
    Severity filter pills — pre-selected to match
    severityFilter prop, but user can change it
    to select from any severity

  Findings list — same collapsed row style as LibraryPage
  but with a checkbox on the left of each row.
  No Manage dropdown here — view only.

  Selection state:
    "Select All" checkbox in header
    Selected count shown: "3 findings selected"

  Severity mismatch warning:
    If any selected finding's severity does not match
    the section's severity_filter, show an amber
    banner above the footer:
      "1 selected finding has a different severity than
       this section. It will be flagged as a placement
       override and will require a justification before
       the report can be generated."

  Footer:
    Cancel
    "Add [N] Findings" button (disabled when N = 0)
    On confirm:
      For each selected finding:
        Call POST /api/v1/library/{id}/import-to-report
        with body { report_id, target_section_id }
      When all calls complete:
        Call onFindingsAdded with the new Finding objects
        Close the modal
        Show success toast:
          "3 findings added to Critical Findings"
      If any call fails:
        Show error toast with the failed finding title

Update src/store/reportBuilderStore.ts:
  Add addFindings(sectionId: string, findings: Finding[])
    Appends the new findings to findingsBySection[sectionId]

Update ReportBuilderPage or ReportCanvas to call
  reportBuilderStore.addFindings when onFindingsAdded fires

===================================================
STEP B7 — User Management Page
===================================================

Create src/pages/settings/UsersPage.tsx

Route: /settings/users
Protected: redirect to / if user lacks
  usePermission("user", "view")

PageWrapper title="User Management"
  Located under Settings in sidebar

Top action bar:
  "+ Invite User" button — only if
    usePermission("user", "create")
  Opens CreateUserModal

Users table columns:
  Email | Role | Status | Joined | Actions

Status badge:
  Active → green "Active"
  Inactive → gray "Inactive"

Role shown as the role display_name in a badge:
  Admin → purple
  Lead → blue
  Consultant → teal
  View Only → gray

Actions column (only render actions the current user
can perform):
  "Change Role" button → opens RoleSelectModal
    Only if usePermission("user", "assign_roles")
  "Deactivate" button → ConfirmModal then
    DELETE /api/v1/users/{id}/deactivate
    Only if usePermission("user", "deactivate")
    Do not show for the current logged-in user
    (cannot deactivate yourself)

Create src/components/users/CreateUserModal.tsx
  Fields: email (required), password (required),
          role (Select from available roles)
  On submit: POST /api/v1/users/
  On success: refresh user list, show toast
    "User created and assigned [role] role"

Create src/components/users/RoleSelectModal.tsx
  Shows user email as context
  Select dropdown of all available roles
  Current role pre-selected
  On confirm: POST /api/v1/users/{id}/assign-role
  On success: refresh user list, show toast
    "Role updated to [role display name]"

===================================================
STEP B8 — Permission-Aware UI Audit
===================================================

Go through every page and component built so far in
Phase 5 (Steps 1-4, auth + any other completed steps)
and apply usePermission checks to all action buttons.

Audit checklist — hide or disable these elements when
the user lacks the required permission:

Dashboard:
  No action buttons — no changes needed

Auth pages:
  No permission checks needed — unauthenticated context

For any page built in steps 5-12 that has not yet
been built, apply permission checks as you build them.
Do not wait until the end to add permissions.

Rule for all future components:
  Any button that creates, edits, deletes, archives,
  or generates must be wrapped:

  {usePermission("resource", "action") && (
    <Button>...</Button>
  )}

  Never disable buttons for permission reasons —
  hide them entirely. A consultant should not see
  a delete button that does nothing.

===================================================
STEP B9 — Update App.tsx Routing
===================================================

Add these routes to the existing router:

  /library/archive    → LibraryArchivePage
                        (ProtectedRoute — redirect if no
                         library_finding:archive permission)

  /settings/users     → UsersPage
                        (ProtectedRoute — redirect if no
                         user:view permission)

Update the Library route:
  /library            → LibraryPage (redesigned version)

Remove:
  Any route pointing to the old Findings page
  Any route pointing to the old AddToReportModal flow

===================================================
STEP B10 — Frontend Tests and Verification
===================================================

Manual verification checklist — test every item in the
browser before calling this instruction complete:

AUTH + ROLES:
  □ Register first user → confirm Admin role assigned
    (check /settings/users page)
  □ Register second user → confirm View Only role assigned
  □ Login as Admin → confirm all navigation items visible
    including Settings > Users
  □ Login as View Only → confirm Settings link hidden,
    no create/edit/delete buttons visible anywhere

LIBRARY PAGE:
  □ As Admin: Manage dropdown visible on each finding
    with Edit, Archive, Delete options
  □ As Consultant: No Manage dropdown visible
  □ Archive a finding → confirm it disappears from list
  □ Navigate to /library/archive → confirm archived
    finding appears
  □ Restore finding → confirm it returns to main list
  □ Create new finding with all fields including
    multiple CVE references and tags
  □ Edit finding → confirm all fields pre-populated
  □ Delete finding → confirm ConfirmModal appears,
    finding removed after confirm

ADD FINDINGS WORKFLOW:
  □ Open a report in the builder
  □ In a severity section, click "+ Add Findings from Library"
  □ Confirm LibrarySelectModal opens with severity
    pre-filtered to the section's severity
  □ Select 2-3 findings and click Add
  □ Confirm findings appear in the section
  □ Select a finding with mismatched severity (if available)
  □ Confirm amber warning banner appears in modal
  □ Add the mismatched finding
  □ Confirm it appears with yellow left border and
    Override badge in the section

USER MANAGEMENT:
  □ As Admin, navigate to /settings/users
  □ Create a new user with Consultant role
  □ Confirm user appears in list with Consultant badge
  □ Change their role to Lead
  □ Confirm role badge updates
  □ Deactivate the user
  □ Confirm status badge changes to Inactive
  □ As the deactivated user, attempt to login
  □ Confirm login is rejected

PERMISSIONS BOUNDARY TESTS:
  □ As Consultant, attempt to access /settings/users
    directly via URL → confirm redirect to /
  □ As Consultant, attempt to access /library/archive
    directly via URL → confirm redirect to /library
  □ As View Only, open a report → confirm no
    "Add Findings" button visible
  □ As View Only, open library → confirm no
    "New Finding" or "Manage" buttons visible

===================================================
BUILD ORDER SUMMARY
===================================================

Backend first, then frontend. Within backend, in order:

  A1 → RBAC schema + library archive fields + migration
  A2 → Seed roles and permissions
  A3 → First user becomes Admin logic
  A4 → Permission dependency
  A5 → Apply permission checks to all routers
  A6 → Archive/restore endpoints
  A7 → User management endpoints
  A8 → Backend tests (all must pass before frontend)

Frontend, in order:

  B1 → Permission store and hook
  B2 → Updated navigation
  B3 → Library page redesign
  B4 → Library archive page
  B5 → Library finding form modal
  B6 → Report builder Add Findings workflow
  B7 → User management page
  B8 → Permission-aware UI audit
  B9 → Routing updates
  B10 → Full verification checklist

Stop after each lettered step and wait for confirmation.
Do not proceed to frontend (Part B) until all backend
tests in A8 pass.

===================================================
AFTER THIS INSTRUCTION IS COMPLETE
===================================================

Resume Phase 5 from Step 5 (Dashboard) continuing
through Step 12 (Polish). Apply usePermission checks
to every action button as each page is built.
Do not audit for permissions at the end — build them
in from the start on every remaining page.
