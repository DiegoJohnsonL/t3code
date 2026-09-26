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
        fixedHeader={
          <SidebarGroup className="z-[1]">
            <span className="-mt-1 flex h-8 items-center px-2 text-sm font-medium text-sidebar-foreground">
              Background
            </span>
          </SidebarGroup>
        }
      >
        <SidebarGroup>
          <BackgroundStudioPanel />
        </SidebarGroup>
      </SidebarContent>
      <SidebarChromeFooter />
    </>
  );
}
