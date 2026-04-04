import React from "react";
import { Topbar, type Breadcrumb } from "./Topbar";
import { LayoutContext } from "./LayoutContext";
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "./Sidebar";

interface PageWrapperProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function PageWrapper({ title, breadcrumbs, actions, children }: PageWrapperProps) {
  const { sidebarCollapsed } = React.useContext(LayoutContext);
  const sidebarW = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <>
      <Topbar title={title} breadcrumbs={breadcrumbs ?? [{ label: title }]} />
      <main
        style={{
          marginLeft: sidebarW,
          marginTop: "var(--topbar-height)",
          minHeight: "calc(100vh - var(--topbar-height))",
          padding: "24px",
          transition: "margin-left 0.2s ease",
          minWidth: 0,
        }}
      >
        {actions && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              marginBottom: 20,
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {actions}
          </div>
        )}
        {children}
      </main>
    </>
  );
}
