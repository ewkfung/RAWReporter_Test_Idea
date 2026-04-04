# RAWReporter — Path 2: Polish & Bug Fixes

Read CLAUDE.md before starting.

This document contains prioritized polish tasks to improve loading states, error handling, and user experience. Implement tasks in order: P0 (critical) → P1 (high) → P2 (optional).

**STOP after each task and wait for confirmation before proceeding to the next.**

---

## P0 — CRITICAL TASKS

These are foundational improvements that affect the entire application.

### P0.1 — Loading States (Global Pattern)

**Goal:** Show spinners/skeletons while data is loading so users know the app is working.

**What to implement:**

1. **Create reusable loading components:**
   - `<Spinner />` — inline spinner (small, 16px, for buttons)
   - `<PageLoader />` — full-page spinner (centered, 48px)
   - `<SkeletonCard />` — animated gray boxes matching card layout
   - `<SkeletonTable />` — animated rows for list pages

2. **Add loading states to all data-fetching pages:**
   - Dashboard: Show SkeletonCard while fetching metrics
   - Clients: Show SkeletonTable while fetching client list
   - Engagements: Show SkeletonTable while fetching engagement list
   - Reports: Show SkeletonTable while fetching report list
   - Library: Show SkeletonTable while fetching library findings
   - Report Builder: Show PageLoader while fetching report + sections

3. **Add loading states to all mutation buttons:**
   - "Create Client" button → show Spinner inside button, disable while creating
   - "Save" buttons in modals → show Spinner, disable button
   - "Delete" buttons → show Spinner after confirmation
   - "Add Findings from Library" → show Spinner while adding
   - All inline save operations (report title, section text boxes) → show small Spinner next to "Saved" indicator

**Implementation pattern (React Query):**

```tsx
const { data, isLoading, isError } = useQuery({
  queryKey: ['clients'],
  queryFn: fetchClients
});

if (isLoading) return <SkeletonTable rows={5} />;
if (isError) return <ErrorState message="Failed to load clients" />;

return <ClientList clients={data} />;
```

**Files to create:**
```
src/components/loading/
  Spinner.tsx
  PageLoader.tsx
  SkeletonCard.tsx
  SkeletonTable.tsx
```

**Estimated effort:** 4-6 hours

---

### P0.2 — Error Boundaries

**Goal:** Catch React component crashes and show a user-friendly error page instead of a white screen.

**What to implement:**

1. **Create ErrorBoundary component:**
   - Wraps around route components in App.tsx
   - Catches JavaScript errors in child components
   - Shows fallback UI: "Something went wrong" message + "Reload Page" button
   - Logs error to console for debugging

2. **Wrap each major route:**
   ```tsx
   <Route path="/clients" element={
     <ErrorBoundary>
       <ClientsPage />
     </ErrorBoundary>
   } />
   ```

3. **Add error fallback UI:**
   - Centered layout, icon (⚠️), heading "Something went wrong"
   - Subtitle: "An unexpected error occurred. Try refreshing the page."
   - Button: "Reload Page" (calls window.location.reload())
   - Button: "Go to Dashboard" (navigates to /)

**Implementation:**

```tsx
// src/components/ErrorBoundary.tsx
import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <h1>Something went wrong</h1>
            <p>An unexpected error occurred. Try refreshing the page.</p>
            <div className="error-actions">
              <button onClick={() => window.location.reload()}>
                Reload Page
              </button>
              <button onClick={() => window.location.href = '/'}>
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Files to create:**
```
src/components/ErrorBoundary.tsx
src/components/ErrorBoundary.css
```

**Files to modify:**
```
src/App.tsx (wrap all routes)
```

**Estimated effort:** 2 hours

---

### P0.3 — API Error Handling (User-Facing Messages)

**Goal:** When API calls fail, show clear error messages to users (not just console.error).

**What to implement:**

1. **Create ErrorState component:**
   - Red border card with error icon
   - Error message (props)
   - "Retry" button (optional callback)

2. **Add error states to all data-fetching pages:**
   ```tsx
   const { data, isLoading, isError, error } = useQuery({
     queryKey: ['clients'],
     queryFn: fetchClients
   });

   if (isLoading) return <SkeletonTable />;
   if (isError) return <ErrorState message="Failed to load clients. Please try again." onRetry={refetch} />;
   ```

3. **Add error toasts for mutation failures:**
   - When creating/updating/deleting fails, show toast with error message
   - Extract error message from API response (e.g., `error.response.data.detail`)
   - Fall back to generic message if error format is unexpected

**Files to create:**
```
src/components/ErrorState.tsx
```

**Files to modify:**
```
All pages with useQuery/useMutation (Dashboard, Clients, Engagements, Reports, Library, Report Builder)
```

**Estimated effort:** 3-4 hours

---

## P1 — HIGH PRIORITY TASKS

Complete these after all P0 tasks are verified working.

### P1.1 — Empty States

**Goal:** Show helpful messages when there's no data instead of blank screens.

**What to implement:**

1. **Create EmptyState component:**
   - Icon (props: icon name or custom SVG)
   - Heading (e.g., "No clients yet")
   - Description (e.g., "Create your first client to get started")
   - Action button (optional, e.g., "Create Client")

2. **Add empty states to all list pages:**
   - Clients page: "No clients yet. Create your first client to start building reports."
   - Engagements page: "No engagements yet. Create an engagement to organize your assessments."
   - Reports page: "No reports yet. Create a report within an engagement."
   - Library page: "No findings in library. Admins can create finding templates here."
   - Report Builder sections: "No {severity} findings yet. Add findings from the library."

**Files to create:**
```
src/components/EmptyState.tsx
```

**Files to modify:**
```
All list pages (Clients, Engagements, Reports, Library, Report Builder sections)
```

**Estimated effort:** 2-3 hours

---

### P1.2 — Form Validation (Inline Error Messages)

**Goal:** Show validation errors inline on form fields, not just blocking save.

**What to implement:**

1. **Add validation error display to all forms:**
   - Red border on invalid fields
   - Error message below field (text-sm text-red-600)
   - Show errors on blur OR on submit attempt

2. **Common validations:**
   - Required fields: "This field is required"
   - Email format: "Please enter a valid email address"
   - Min length: "Must be at least X characters"
   - Date range: "End date must be after start date"
   - Override justification: "Justification must be at least 20 characters"

3. **Forms to update:**
   - Client create/edit modal
   - Engagement create/edit modal
   - Report create modal
   - Library finding create/edit modal
   - Report Builder finding edit (expanded card)
   - User create/edit modal

**Implementation pattern:**

```tsx
const [errors, setErrors] = useState<Record<string, string>>({});

const validateField = (name: string, value: string) => {
  if (name === 'email' && !value.includes('@')) {
    setErrors(prev => ({ ...prev, email: 'Please enter a valid email' }));
  } else {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[name];
      return newErrors;
    });
  }
};

return (
  <div>
    <input
      name="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      onBlur={(e) => validateField('email', e.target.value)}
      className={errors.email ? 'border-red-500' : ''}
    />
    {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
  </div>
);
```

**Estimated effort:** 4-5 hours

---

### P1.3 — Permission Testing Across Roles

**Goal:** Verify that View Only, Consultant, and Lead roles see the correct UI and cannot perform unauthorized actions.

**What to test:**

1. **Create test users for each role:**
   ```sql
   -- View Only user
   INSERT INTO users (id, email, hashed_password, is_active, is_verified)
   VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'viewonly@test.com', 'hash', true, true);
   
   INSERT INTO user_roles (user_id, role_id)
   VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (SELECT id FROM roles WHERE name = 'view_only'));

   -- Consultant user
   INSERT INTO users (id, email, hashed_password, is_active, is_verified)
   VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'consultant@test.com', 'hash', true, true);
   
   INSERT INTO user_roles (user_id, role_id)
   VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', (SELECT id FROM roles WHERE name = 'consultant'));

   -- Lead user
   INSERT INTO users (id, email, hashed_password, is_active, is_verified)
   VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'lead@test.com', 'hash', true, true);
   
   INSERT INTO user_roles (user_id, role_id)
   VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', (SELECT id FROM roles WHERE name = 'lead'));
   ```

2. **Test each role's permissions:**
   - **View Only:** Can view all pages, cannot see Create/Edit/Delete buttons, Report Builder is read-only
   - **Consultant:** Can create/edit findings, cannot create clients/engagements/users
   - **Lead:** Can create/edit clients/engagements/reports, cannot manage library or users
   - **Admin:** Can do everything

3. **Fix any broken permission checks:**
   - Buttons showing when they shouldn't (use `usePermission` hook to hide)
   - API calls succeeding when they should fail (backend should reject with 403)
   - Navigation items visible when user lacks permission

**Estimated effort:** 3-4 hours (testing + fixes)

---

## P2 — OPTIONAL ENHANCEMENTS

These tasks are optional. Only implement if specifically requested. They can be deferred until after Path 3 (User Testing) and Path 1 (Document Generation).

### P2.1 — Keyboard Shortcuts

Add common shortcuts:
- `Ctrl/Cmd + S` → Save current form (if in a modal or editing)
- `Escape` → Close current modal
- `Ctrl/Cmd + K` → Focus search (if you add search later)

**Estimated effort:** 2 hours

---

### P2.2 — Unsaved Changes Warning

When user has unsaved changes in a form and tries to navigate away or close browser:
- Show confirmation: "You have unsaved changes. Are you sure you want to leave?"
- Use `window.onbeforeunload` for browser close
- Use React Router's navigation blocker for route changes

**Estimated effort:** 2-3 hours

---

### P2.3 — Optimistic Updates

For quick actions (like archiving a finding, changing report status), update UI immediately and revert if API call fails:

```tsx
const archiveMutation = useMutation({
  mutationFn: archiveFinding,
  onMutate: async (findingId) => {
    // Immediately update UI
    queryClient.setQueryData(['library'], (old) => 
      old.filter(f => f.id !== findingId)
    );
  },
  onError: (error, findingId, context) => {
    // Revert on failure
    queryClient.invalidateQueries(['library']);
  }
});
```

**Estimated effort:** 3-4 hours

---

## IMPLEMENTATION RULES

1. **Work through tasks in priority order:** P0.1 → P0.2 → P0.3 → P1.1 → P1.2 → P1.3 → P2 (optional)
2. **STOP after completing each task.** Do not proceed to the next task without confirmation.
3. **Test each implementation** before marking it complete.
4. **Use existing design system:** Match colors, fonts, spacing from globals.css and existing components.
5. **Follow React Query patterns:** Use isLoading, isError, and error states consistently.

---

## STOP CONDITIONS

After completing each task:
1. Commit your changes
2. Report what was implemented
3. Note any issues or decisions made
4. **Wait for confirmation before starting the next task**

Do NOT implement all tasks in one session. Stop after each and wait.
