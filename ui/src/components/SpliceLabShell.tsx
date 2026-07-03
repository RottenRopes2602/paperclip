import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { cn } from "@/lib/utils";

export function SpliceLabShell() {
  const location = useLocation();
  const { setBreadcrumbs } = useBreadcrumbs();
  const isEntrance = location.pathname === "/splice";
  const isWorkspaceRoom = location.pathname.startsWith("/splice/workspace-room/");

  useEffect(() => {
    if (isWorkspaceRoom) return;
    const current = isEntrance
      ? "Entrance"
      : "Workspace Map";
    setBreadcrumbs([
      { label: current },
      { label: "Splice Lab" },
    ]);
  }, [isEntrance, isWorkspaceRoom, location.pathname, setBreadcrumbs]);

  if (isWorkspaceRoom) {
    return (
      <div className="h-dvh overflow-hidden bg-background text-foreground">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to Main Content
      </a>
      <div className="flex min-h-0 flex-1">
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            "min-w-0 flex-1 overflow-auto outline-none",
            isEntrance ? "p-4 md:p-8" : "p-4 md:p-6",
          )}
        >
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
