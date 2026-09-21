/**
 * The background studio as a sidebar panel. The sidebar footer's Back button
 * closes it, so the panel itself carries no chrome beyond its heading.
 */
import { SidebarChromeFooter } from "../sidebar/SidebarChrome";
import { SidebarContent, SidebarGroup } from "../ui/sidebar";
import { BackgroundStudioPanel } from "./BackgroundStudioPanel";

export function BackgroundStudioSidebar() {
  return (
    <>
      <SidebarContent
        className="gap-0"
        fixedHeader={
          <SidebarGroup className="relative z-[1] p-[var(--sidebar-content-inset)] pt-1">
            <span className="flex h-8 items-center px-2 text-sm font-medium text-sidebar-foreground">
              Background
            </span>
          </SidebarGroup>
        }
      >
        <SidebarGroup className="pt-0">
          <BackgroundStudioPanel />
        </SidebarGroup>
      </SidebarContent>
      <SidebarChromeFooter />
    </>
  );
}
