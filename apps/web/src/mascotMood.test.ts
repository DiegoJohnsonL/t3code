import { describe, expect, it } from "vite-plus/test";
import {
  EnvironmentId,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
  TurnId,
  type OrchestrationLatestTurn,
} from "@t3tools/contracts";

import { type MascotThread, resolveMascotMood } from "./mascotMood";
import { DEFAULT_INTERACTION_MODE, DEFAULT_RUNTIME_MODE } from "./types";

const NOW = Date.parse("2026-09-24T15:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

let nextId = 0;
function makeThread(overrides: Partial<MascotThread> = {}): MascotThread {
  nextId += 1;
  return {
    id: ThreadId.make(`thread-${nextId}`),
    environmentId: EnvironmentId.make("environment-local"),
    projectId: ProjectId.make("project-1"),
    title: "Thread",
    modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
    runtimeMode: DEFAULT_RUNTIME_MODE,
    interactionMode: DEFAULT_INTERACTION_MODE,
    branch: null,
    worktreePath: null,
    pullRequests: [],
    latestTurn: null,
    createdAt: minutesAgo(600),
    updatedAt: minutesAgo(600),
    archivedAt: null,
    settledOverride: null,
    settledAt: null,
    session: null,
    latestUserMessageAt: minutesAgo(30),
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    lastVisitedAt: minutesAgo(1),
    ...overrides,
  };
}

function turn(overrides: Partial<OrchestrationLatestTurn>): OrchestrationLatestTurn {
  return {
    turnId: TurnId.make("turn-1"),
    state: "completed",
    requestedAt: minutesAgo(30),
    startedAt: minutesAgo(30),
    completedAt: minutesAgo(20),
    assistantMessageId: null,
    ...overrides,
  };
}

const running = (startedMinutesAgo: number) =>
  makeThread({
    session: {
      threadId: ThreadId.make("thread-running"),
      status: "running",
      providerName: null,
      runtimeMode: DEFAULT_RUNTIME_MODE,
      activeTurnId: TurnId.make("turn-1"),
      lastError: null,
      updatedAt: minutesAgo(startedMinutesAgo),
    },
    latestTurn: turn({
      state: "running",
      startedAt: minutesAgo(startedMinutesAgo),
      completedAt: null,
    }),
  });

const mood = (...threads: MascotThread[]) => resolveMascotMood({ threads, nowMs: NOW });

describe("resolveMascotMood", () => {
  it("shows an unseen failure above everything else", () => {
    const failed = makeThread({
      latestTurn: turn({ state: "error", completedAt: minutesAgo(5) }),
      lastVisitedAt: minutesAgo(10),
    });
    expect(mood(failed, makeThread({ hasPendingUserInput: true }), running(1))).toBe("broke");
  });

  it("forgets a failure once the thread was visited after it", () => {
    const seen = makeThread({
      latestTurn: turn({ state: "error", completedAt: minutesAgo(5) }),
      lastVisitedAt: minutesAgo(1),
    });
    expect(mood(seen)).toBe("default");
  });

  it("waits on one question and turns urgent at three", () => {
    const asking = () => makeThread({ hasPendingApprovals: true });
    expect(mood(asking(), running(1))).toBe("waiting");
    expect(mood(asking(), asking(), asking())).toBe("urgent");
  });

  it("thinks while agents work and looks confused once one runs long", () => {
    expect(mood(running(5))).toBe("thinking");
    expect(mood(running(5), running(60))).toBe("confused");
  });

  it("gets excited about a finished turn the user has not opened", () => {
    expect(mood(makeThread({ latestTurn: turn({}), lastVisitedAt: minutesAgo(25) }))).toBe(
      "excited",
    );
  });

  it("celebrates ten threads finished today", () => {
    const done = Array.from({ length: 10 }, () => makeThread({ latestTurn: turn({}) }));
    expect(mood(...done)).toBe("celebrating");
  });

  it("gets bored after eight idle hours and grumpy after three days", () => {
    const idleFor = (minutes: number) =>
      makeThread({
        latestUserMessageAt: minutesAgo(minutes),
        latestTurn: turn({
          requestedAt: minutesAgo(minutes),
          startedAt: minutesAgo(minutes),
          completedAt: minutesAgo(minutes),
        }),
      });
    expect(mood(idleFor(9 * 60))).toBe("bored");
    expect(mood(idleFor(4 * 24 * 60))).toBe("grumpy");
  });

  it("sleeps when every thread is settled or snoozed", () => {
    expect(
      mood(
        makeThread({ settledOverride: "settled" }),
        makeThread({ snoozedUntil: minutesAgo(-60), snoozedAt: minutesAgo(10) }),
      ),
    ).toBe("sleeping");
  });

  it("ignores archived threads and starts at the everyday look", () => {
    expect(mood()).toBe("default");
    expect(mood(makeThread({ archivedAt: minutesAgo(1), hasPendingUserInput: true }))).toBe(
      "default",
    );
  });
});
