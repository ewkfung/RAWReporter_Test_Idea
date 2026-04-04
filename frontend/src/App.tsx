import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ToastContainer } from "./components/ui/Toast";
import { ErrorBoundary } from "./components/ErrorBoundary";

import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";

import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { ClientsPage } from "./pages/clients/ClientsPage";
import { ClientArchivePage } from "./pages/clients/ClientArchivePage";
import { EngagementsPage } from "./pages/engagements/EngagementsPage";
import { EngagementArchivePage } from "./pages/engagements/EngagementArchivePage";
import { ReportsPage } from "./pages/reports/ReportsPage";
import { ReportArchivePage } from "./pages/reports/ReportArchivePage";
import { ReportBuilder } from "./pages/ReportBuilder/ReportBuilder";
import { LibraryPage } from "./pages/library/LibraryPage";
import { LibraryArchivePage } from "./pages/library/LibraryArchivePage";
import { UsersPage } from "./pages/settings/UsersPage";

// Placeholder for pages not yet built
function ComingSoon({ name }: { name: string }) {
  return (
    <div style={{ padding: 40, color: "var(--color-gray-500)", fontSize: 14 }}>
      <strong style={{ color: "var(--color-gray-900)" }}>{name}</strong> — coming soon.
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* App */}
        <Route element={<AppLayout />}>
          <Route index element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
          <Route path="/clients"          element={<ErrorBoundary><ClientsPage /></ErrorBoundary>} />
          <Route path="/clients/archive"  element={<ErrorBoundary><ClientArchivePage /></ErrorBoundary>} />
          <Route path="/clients/:id"      element={<ComingSoon name="Client Detail" />} />
          <Route path="/engagements"          element={<ErrorBoundary><EngagementsPage /></ErrorBoundary>} />
          <Route path="/engagements/archive" element={<ErrorBoundary><EngagementArchivePage /></ErrorBoundary>} />
          <Route path="/engagements/:id"     element={<ComingSoon name="Engagement Detail" />} />
          <Route path="/reports"                    element={<ErrorBoundary><ReportsPage /></ErrorBoundary>} />
          <Route path="/reports/archive"           element={<ErrorBoundary><ReportArchivePage /></ErrorBoundary>} />
          <Route path="/reports/:reportId/build"   element={<ErrorBoundary><ReportBuilder /></ErrorBoundary>} />
          <Route path="/library"          element={<ErrorBoundary><LibraryPage /></ErrorBoundary>} />
          <Route path="/library/archive"  element={<ErrorBoundary><LibraryArchivePage /></ErrorBoundary>} />
          <Route path="/library/:id"      element={<ComingSoon name="Library Finding Detail" />} />
          <Route path="/settings/users"   element={<ErrorBoundary><UsersPage /></ErrorBoundary>} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}
