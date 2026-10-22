import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeTool } from "taibu-core/mcp";
import { expect, test } from "vitest";
import { chartArgs, saveBirth } from "../src/birth.js";
import { searchCities } from "../src/cities.js";
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

test("紫微盘只排一次：页面拿到的整张盘就是后端 taibu 的结果，前端包里没有第二份排盘代码", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fortune-requests-"));
  const birth = await saveBirth(dir, {
    calendar: "solar",
    year: 2000,
    month: 3,
    day: 10,
    time: { hour: 23, minute: 30 },
    gender: "female",
    cityId: searchCities("上海")[0]?.geonameid as number,
  });
  const { latitude: _latitude, ...args } = chartArgs(birth);
  const page = (await handle(dir, "chinese", {})) as { ziwei: unknown };
  expect(page.ziwei).toEqual(await executeTool("ziwei", args));
  expect(page.ziwei).toMatchObject({ fiveElement: "土五局", palaces: expect.any(Array) });
  expect(readFileSync("dist/client.js", "utf8")).not.toMatch(/iztro|bySolar/);
});

test("晚上 11 点半出生：八字和紫微都从子时起换日，日柱一致", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fortune-requests-"));
  await saveBirth(dir, {
    calendar: "solar",
    year: 2000,
    month: 3,
    day: 10,
    time: { hour: 23, minute: 30 },
    gender: "female",
    cityId: searchCities("上海")[0]?.geonameid as number,
  });
  const page = (await handle(dir, "chinese", {})) as {
    bazi: { fourPillars: { day: { stem: string; branch: string } } };
    ziwei: { fourPillars: { day: { gan: string; zhi: string } } };
  };
  expect(page.bazi.fourPillars.day.stem + page.bazi.fourPillars.day.branch).toBe("戊辰");
  expect(page.ziwei.fourPillars.day.gan + page.ziwei.fourPillars.day.zhi).toBe("戊辰");
});
