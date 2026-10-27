import { afterEach, expect, test, vi } from "vitest";
import { readTheme } from "../src/client/theme.js";

afterEach(() => vi.unstubAllGlobals());

function hostTheme(scheme: string, dark: boolean, systemDark: boolean) {
  const root = { colorScheme: scheme };
  const body = { dark };
  const media = { matches: systemDark };
  vi.stubGlobal("document", {
    documentElement: { style: root },
    body: { hasAttribute: () => body.dark },
  });
  vi.stubGlobal("matchMedia", () => media);
  return { root, body, media };
}

test("宿主固定浅色覆盖系统深色，跟随系统时采用宿主解析的变化", () => {
  const { root, body, media } = hostTheme("light", false, true);
  expect(readTheme()).toBe("light");
  root.colorScheme = "dark";
  body.dark = true;
  expect(readTheme()).toBe("dark");
  media.matches = false;
  root.colorScheme = "light";
  body.dark = false;
  expect(readTheme()).toBe("light");
});

test("宿主写出组合 color-scheme 时按宿主调色板，仅未写主题时跟随系统", () => {
  const { root, body, media } = hostTheme("light dark", false, true);
  expect(readTheme()).toBe("light");
  body.dark = true;
  media.matches = false;
  expect(readTheme()).toBe("dark");
  root.colorScheme = "";
  body.dark = false;
  expect(readTheme()).toBe("light");
  media.matches = true;
  expect(readTheme()).toBe("dark");
});
