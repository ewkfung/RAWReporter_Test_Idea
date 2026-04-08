import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { LayoutContext } from "./LayoutContext";
import { ToastContainer } from "../ui/Toast";
import { InactivityWarningModal } from "../ui/InactivityWarningModal";
import { useAuthStore } from "../../store/authStore";
import { useInactivityTimer } from "../../hooks/useInactivityTimer";
import { useQuery } from "@tanstack/react-query";
import { getMe, fetchMyPermissions } from "../../api/auth";

const AUTO_COLLAPSE_BREAKPOINT = 900;

export function AppLayout() {
  const { token, setUser, setPermissions, logout } = useAuthStore();

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(
    () => window.innerWidth < AUTO_COLLAPSE_BREAKPOINT
  );

  // Auto-collapse/expand on resize
  React.useEffect(() => {
    const handler = () => {
      if (window.innerWidth < AUTO_COLLAPSE_BREAKPOINT) {
        setSidebarCollapsed(true);
      }
    };
    window.addEventListener("resize", handler, { passive: true });
    return () => window.removeEventListener("resize", handler);
  }, []);

  const toggleSidebar = () => setSidebarCollapsed((v) => !v);

  const { showWarning, secondsLeft, onStayActive } = useInactivityTimer();

  const { isError } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const [user, permissions] = await Promise.all([getMe(), fetchMyPermissions()]);
      setUser(user);
      setPermissions(permissions);
      return user;
    },
    enabled: !!token,
    retry: false,
  });

  if (isError) {
    logout();
    return null;
  }

  if (!token) return <Navigate to="/login" replace />;

  return (
    <LayoutContext.Provider value={{ sidebarCollapsed, toggleSidebar }}>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Outlet />
        </div>
        <ToastContainer />
        <InactivityWarningModal
          isOpen={showWarning}
          secondsLeft={secondsLeft}
          onStayActive={onStayActive}
        />
      </div>
    </LayoutContext.Provider>
  );
}
