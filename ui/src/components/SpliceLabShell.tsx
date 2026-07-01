import { useEffect } from "react";
import { Beaker, DoorOpen, Globe2, type LucideIcon } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { cn } from "@/lib/utils";
import { SpliceSidebar } from "./SpliceSidebar";

function TopLink({ to, label, icon: Icon, end = false }: {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => cn(
        "inline-flex min-w-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
        isActive
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export function SpliceLabShell() {
  const location = useLocation();
  const { setBreadcrumbs } = useBreadcrumbs();
  const isEntrance = location.pathname === "/splice";

  useEffect(() => {
    const current = isEntrance
      ? "Entrance"
      : location.pathname.startsWith("/splice/workspace-room/")
        ? "Puzzle Testbed"
        : "Workspace Map";
    setBreadcrumbs([
      { label: current },
      { label: "Splice Lab" },
    ]);
  }, [isEntrance, location.pathname, setBreadcrumbs]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to Main Content
      </a>
      {!isEntrance ? (
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 md:hidden">
          <TopLink to="/splice" label="Entrance" icon={DoorOpen} end />
          <TopLink to="/splice/workspaces" label="Workspaces" icon={Globe2} />
          <TopLink to="/splice/workspace-room/puzzle-game" label="Puzzle Testbed" icon={Beaker} />
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        {!isEntrance ? (
          <div className="hidden h-full w-72 shrink-0 md:block">
            <SpliceSidebar />
          </div>
        ) : null}
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
