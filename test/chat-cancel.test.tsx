import * as React from "react";
import { createElement } from "react";
import { type ReactTestRenderer, act, create } from "react-test-renderer";
import { afterEach, expect, test, vi } from "vitest";
import { FortunePage, type Request } from "../src/client/App.js";

vi.mock("../src/client/Astro.js", () => ({ Astro: () => null }));
vi.mock("../src/client/Chinese.js", () => ({ Chinese: () => null }));
vi.mock("../src/client/Tarot.js", () => ({ Tarot: () => null }));

afterEach(() => vi.unstubAllGlobals());
test("leaving while materials are prepared cancels handoff and preserves the MBTI draft", async () => {
  let resolveMaterials: (value: string) => void = () => {};
  const request = vi.fn(async (operation: string) => {
    if (operation === "state")
      return { birth: null, stored: { dir: "synthetic", draws: 0, readings: 0, mbti: 0, mbtiDraft: false } };
    if (operation === "mbti") return { questions: [], records: [], total: 0 };
    if (operation === "readings") return [];
    if (operation === "mbtiMaterials")
      return await new Promise<string>((resolve) => {
        resolveMaterials = resolve;
      });
    return {};
  });
  const open = vi.fn(async () => {});
  const connectChat = (notify: (value: { label: string; open: typeof open } | undefined) => void) => {
    notify({ label: "开新对话", open });
    return () => notify(undefined);
  };
  vi.stubGlobal("React", React);
  vi.stubGlobal("window", {
    location: { hash: "" },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("document", {
    documentElement: { style: { colorScheme: "light" } },
    body: { hasAttribute: () => false },
  });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal(
    "MutationObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  let root: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      root = create(
        createElement(FortunePage, { request: request as Request, watch: () => () => {}, connectChat }),
      );
    });
    const page = root?.root;
    if (!page) throw new Error("Page missing");
    const button = (label: string) => {
      const found = page.findAllByType("button").find((item) => item.children.includes(label));
      if (!found) throw new Error(`Missing ${label}`);
      return found;
    };
    await act(async () => {
      button("让 AI 猜").props.onClick();
    });
    const input = page.findByType("textarea");
    await act(async () => {
      input.props.onChange({ target: { value: "合成草稿" } });
    });
    const start = button("结合开图资料，开新对话");
    act(() => {
      start.props.onClick();
      start.props.onClick();
    });
    expect(request.mock.calls.filter(([operation]) => operation === "mbtiMaterials")).toHaveLength(1);
    await act(async () => {
      button("中式").props.onClick();
    });
    await act(async () => {
      resolveMaterials("合成材料");
    });
    expect(open).not.toHaveBeenCalled();
    await act(async () => {
      button("MBTI").props.onClick();
    });
    await act(async () => {
      button("让 AI 猜").props.onClick();
    });
    expect(page.findByType("textarea").props.value).toBe("合成草稿");
  } finally {
    if (root) act(() => root?.unmount());
  }
});
