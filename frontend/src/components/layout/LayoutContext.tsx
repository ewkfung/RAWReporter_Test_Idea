import React from "react";

interface LayoutContextValue {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const LayoutContext = React.createContext<LayoutContextValue>({
  sidebarCollapsed: false,
  toggleSidebar: () => {},
});
