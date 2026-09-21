import { useLocation, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import {
  backgroundStudioChatPath,
  backgroundStudioNavAction,
  isBackgroundStudioDismissPath,
} from "~/customBackground/backgroundStudioNavigation";
import {
  closeBackgroundStudio,
  useBackgroundStudioOpen,
} from "~/customBackground/backgroundStudioStore";
import { useThemeEditorStore } from "../settings/themeEditorStore";

/**
 * The studio's cross-route behaviour, mounted above the router because the
 * background it edits is only visible on chat surfaces: opening it from
 * Settings walks back to the last thread, and navigating to a page that hides
 * the background closes it. The controls themselves live in the sidebar, which
 * is where `AppSidebarLayout` renders them.
 */
export function BackgroundStudioHost() {
  const open = useBackgroundStudioOpen();
  const themeSession = useThemeEditorStore((store) => store.session);
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const chatPath = useRouterState({
    select: (state) => backgroundStudioChatPath(state.matches),
  });
  const lastChat = useRef<string | null>(null);
  const wasOpen = useRef(false);
  const returning = useRef(false);
  const dismiss = isBackgroundStudioDismissPath(pathname);

  useEffect(() => {
    if (chatPath !== null) lastChat.current = chatPath;
    const action = backgroundStudioNavAction({
      open,
      wasOpen: wasOpen.current,
      returning: returning.current,
      pathname,
    });
    if (action === "return-to-chat") {
      returning.current = true;
      void navigate({ to: lastChat.current ?? "/" });
    } else if (action === "close") {
      returning.current = false;
      closeBackgroundStudio();
    } else if (open && !dismiss) {
      returning.current = false;
    }
    wasOpen.current = open;
  }, [chatPath, dismiss, navigate, open, pathname]);

  useEffect(() => {
    if (themeSession !== null) closeBackgroundStudio();
  }, [themeSession]);

  return null;
}
