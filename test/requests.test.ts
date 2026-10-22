import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { handle } from "../src/requests.js";

test("没填出生信息也能抽塔罗，抽牌记录出现在“我的资料”里，并能删掉", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fortune-requests-"));
  expect(await handle(dir, "state", {})).toEqual({ birth: null, stored: { dir, draws: 0 } });
  const spread = (await handle(dir, "tarot", { spreadType: "three-card" })) as { cards: unknown[] };
  expect(spread.cards).toHaveLength(3);
  expect(await handle(dir, "state", {})).toMatchObject({ birth: null, stored: { draws: 1 } });
  await handle(dir, "deleteAll", {});
  expect(await handle(dir, "state", {})).toMatchObject({ stored: { draws: 0 } });
});
