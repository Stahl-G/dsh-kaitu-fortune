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

test("嵌入草稿仅接受指定父窗口的回执，拒绝后同一材料可重试", async () => {
  const listeners = new Set<(event: MessageEvent) => void>();
  const parent = { postMessage: vi.fn() };
  vi.stubGlobal("window", {
    parent,
    addEventListener: (_type: string, listener: (event: MessageEvent) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MessageEvent) => void) =>
      listeners.delete(listener),
  });
  try {
    const { embeddedChatDestination } = await import("../src/chat.js");
    const chat = embeddedChatDestination("#kaitu-embed=1&kaitu-parent=http%3A%2F%2F127.0.0.1%3A23456");
    if (!chat) throw new Error("Expected embedded destination");
    const first = chat.open("合成材料");
    const firstCall = parent.postMessage.mock.calls[0];
    if (!firstCall) throw new Error("Expected request");
    const [request, origin] = firstCall;
    expect(origin).toBe("http://127.0.0.1:23456");
    for (const listener of listeners)
      listener({
        source: {},
        origin,
        data: { type: "kaitu:open-ask-draft-result", id: request.id, accepted: true },
      } as unknown as MessageEvent);
    expect(listeners.size).toBe(1);
    for (const listener of [...listeners])
      listener({
        source: parent,
        origin,
        data: { type: "kaitu:open-ask-draft-result", id: request.id, accepted: false },
      } as unknown as MessageEvent);
    await expect(first).rejects.toThrow();
    const retry = chat.open("合成材料");
    expect(parent.postMessage.mock.calls[1]?.[0].id).toBe(request.id);
    for (const listener of [...listeners])
      listener({
        source: parent,
        origin,
        data: { type: "kaitu:open-ask-draft-result", id: request.id, accepted: true },
      } as unknown as MessageEvent);
    await expect(retry).resolves.toBeUndefined();
    expect(embeddedChatDestination("#kaitu-embed=1&kaitu-parent=https%3A%2F%2Fevil.example")).toBeUndefined();
  } finally {
    vi.unstubAllGlobals();
  }
});
