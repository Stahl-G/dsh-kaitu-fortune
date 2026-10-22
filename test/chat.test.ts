import type { Context } from "@deepseek-ai/cordis";
import { expect, test, vi } from "vitest";
import { openReadingSession } from "../src/chat.js";

test("新对话在指定的开图工作区创建，原文进入该会话输入框", async () => {
  const scope = {} as Context;
  const draft = "合成命盘 JSON\n合成盲评\n我想问的问题：";
  const setDraft = vi.fn();
  const services = {
    layout: { beginNavigation: () => new AbortController().signal },
    workspaces: { create: vi.fn(async () => ({ workspaceId: "fixture-workspace" })) },
    sessions: {
      create: vi.fn(async () => "fixture-new-session"),
      scope: vi.fn(() => scope),
    },
    uiWorkspace: { openSession: vi.fn() },
    conversation: { input: { for: vi.fn(() => ({ setDraft })) } },
  };
  await openReadingSession(services, "/tmp/fixture-kaitu", draft);
  expect(services.workspaces.create).toHaveBeenCalledWith({ path: "/tmp/fixture-kaitu" });
  expect(services.sessions.create).toHaveBeenCalledWith({ workspaceId: "fixture-workspace" });
  expect(services.uiWorkspace.openSession).toHaveBeenCalledWith("fixture-new-session");
  expect(services.conversation.input.for).toHaveBeenCalledWith(scope);
  expect(setDraft).toHaveBeenCalledWith(draft);
});
