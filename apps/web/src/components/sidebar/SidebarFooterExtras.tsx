import { useAtomValue } from "@effect/atom-react";
import type { UnifiedSettings } from "@t3tools/contracts";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CoffeeIcon,
  ImageIcon,
  MoonIcon,
  SlidersHorizontalIcon,
} from "lucide-react";

import { openBackgroundStudio } from "~/customBackground/backgroundStudioStore";
import { stepBackgroundImage } from "~/customBackground/rotation";
import { useActiveBackground } from "~/customBackground/useActiveBackground";
import { usePrimarySettings, useUpdatePrimarySettings } from "../../hooks/useSettings";
import { usePrimaryEnvironmentId } from "../../state/environments";
import { serverEnvironment } from "../../state/server";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "../ui/menu";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

/** The custom nightly's own footer buttons, after upstream's utility items. */
export function SidebarFooterExtras() {
  return (
    <>
      <SidebarBackgroundMenu />
      <SidebarServeModeItem />
    </>
  );
}

function SidebarBackgroundMenu() {
  const active = useActiveBackground();
  const rotating = active?.source.kind === "image" && active.source.imageIds.length > 1;
  return (
    <SidebarMenuItem className="shrink-0">
      <Menu>
        <Tooltip>
          <TooltipTrigger
            render={
              <MenuTrigger render={<SidebarMenuButton aria-label="Background" size="icon" />}>
                <ImageIcon />
              </MenuTrigger>
            }
          />
          <TooltipPopup side="top">Background</TooltipPopup>
        </Tooltip>
        <MenuPopup side="top" align="start">
          <MenuItem disabled={!rotating} onClick={() => stepBackgroundImage(1)}>
            <ChevronRightIcon /> Next image
          </MenuItem>
          <MenuItem disabled={!rotating} onClick={() => stepBackgroundImage(-1)}>
            <ChevronLeftIcon /> Previous image
          </MenuItem>
          <MenuSeparator />
          <MenuItem onClick={openBackgroundStudio}>
            <SlidersHorizontalIcon /> Customize background
          </MenuItem>
        </MenuPopup>
      </Menu>
    </SidebarMenuItem>
  );
}

const selectServeMode = (settings: UnifiedSettings) => settings.serveMode;

/** Serve mode for this computer's server, which only acts on macOS. */
function SidebarServeModeItem() {
  const primaryConfig = useAtomValue(serverEnvironment.configValueAtom(usePrimaryEnvironmentId()));
  const serveMode = usePrimarySettings(selectServeMode);
  const updateSettings = useUpdatePrimarySettings();
  if (primaryConfig?.environment.platform.os !== "darwin") return null;
  const sleepsWithLidClosed =
    serveMode && primaryConfig.environment.capabilities.serveModeLidClosed === false;
  return (
    <SidebarMenuItem className="shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarMenuButton
              aria-label="Serve mode"
              aria-pressed={serveMode}
              isActive={serveMode}
              onClick={() => updateSettings({ serveMode: !serveMode })}
              size="icon"
            >
              {serveMode ? (
                <CoffeeIcon className={sleepsWithLidClosed ? "text-warning" : undefined} />
              ) : (
                <MoonIcon />
              )}
            </SidebarMenuButton>
          }
        />
        <TooltipPopup side="top">
          {sleepsWithLidClosed
            ? "Serve mode on, but closing the lid still sleeps this Mac. Run sudo scripts/serve-mode/install.sh to keep it running lid-closed."
            : serveMode
              ? "Serve mode on: this Mac stays awake for agents and your phone"
              : "Serve mode off: this Mac can sleep"}
        </TooltipPopup>
      </Tooltip>
    </SidebarMenuItem>
  );
}
