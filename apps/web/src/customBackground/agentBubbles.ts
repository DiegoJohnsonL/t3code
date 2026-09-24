import type { AgentBubbleBlur, AgentBubbleOpacity } from "@t3tools/contracts";

export function applyAgentBubbleSurface(
  root: HTMLElement,
  { opacity, blur }: { opacity: AgentBubbleOpacity; blur: AgentBubbleBlur },
): void {
  root.style.setProperty("--agent-bubble-opacity", `${opacity}%`);
  root.style.setProperty("--agent-bubble-backdrop", blur === 0 ? "none" : `blur(${blur}px)`);
}
