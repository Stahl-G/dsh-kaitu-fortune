import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
// 测打包后的 dist：确认装上就能用，不依赖 node_modules 里的 taibu-core。
import { apply, dataDir } from "../dist/index.js";

interface Registered {
  name: string;
  execute(args: unknown, exec: { signal: AbortSignal }): Promise<Record<string, unknown>>;
}
const tools = new Map<string, Registered>();
const disposers: (() => void)[] = [];
apply({
  effect: (fn: () => () => void) => disposers.push(fn()),
  tools: {
    register: (tool: Registered) => {
      tools.set(tool.name, tool);
      return () => tools.delete(tool.name);
    },
  },
} as never);
const call = (name: string, args: object) =>
  (tools.get(name) as Registered).execute(args, { signal: new AbortController().signal });
const birth = { birthYear: 1990, birthMonth: 5, birthDay: 15, birthHour: 14, birthMinute: 30 };

test("只注册第一版的几项，卸载时全部撤销", () => {
  expect([...tools.keys()].sort()).toEqual([
    "fortune_almanac",
    "fortune_astrology",
    "fortune_bazi",
    "fortune_bazi_dayun",
    "fortune_liuyao",
    "fortune_replay",
    "fortune_synastry",
    "fortune_tarot",
    "fortune_ziwei",
    "fortune_ziwei_horoscope",
  ]);
});

test("八字按经度做真太阳时，输出 taibu 的四柱", async () => {
  const chart = await call("fortune_bazi", { ...birth, gender: "male", longitude: 121.47 });
  expect(chart.基本信息).toMatchObject({ 日主: "庚", 真太阳时: { 钟表时间: "14:30", 真太阳时: "13:40" } });
  expect((chart.四柱 as { 干支: string }[]).map((pillar) => pillar.干支)).toEqual([
    "庚午",
    "辛巳",
    "庚辰",
    "癸未",
  ]);
});

test("塔罗每次随机抽，存档后按 drawId 重放结果一致", async () => {
  const first = await call("fortune_tarot", { spreadType: "celtic-cross" });
  const second = await call("fortune_tarot", { spreadType: "celtic-cross" });
  expect(first.drawId).not.toBe(second.drawId);
  expect(existsSync(join(dataDir(), "draws", `${first.drawId}.json`))).toBe(true);
  const replay = await call("fortune_replay", { drawId: first.drawId });
  expect(replay.牌阵展开).toEqual(first.牌阵展开);
  expect(first.计算规则).not.toEqual(second.计算规则);
});

test("六爻三钱随机起卦，重放得到同一卦", async () => {
  const cast = await call("fortune_liuyao", { question: "换工作", yongShenTargets: ["官鬼"] });
  const replay = await call("fortune_replay", { drawId: cast.drawId });
  expect(replay.卦盘).toEqual(cast.卦盘);
  expect(replay.六爻全盘).toEqual(cast.六爻全盘);
});

test("合盘：同一张盘和自己比，太阳合太阳", async () => {
  const person = { ...birth, latitude: 31.23, longitude: 121.47 };
  const result = (await call("fortune_synastry", { a: person, b: person })) as {
    aspects: { type: string; from: { key: string }; to: { key: string }; orb: number }[];
  };
  expect(result.aspects).toContainEqual(
    expect.objectContaining({ type: "conjunction", from: expect.objectContaining({ key: "sun" }), orb: 0 }),
  );
});

test("卸载后工具全部撤销", () => {
  for (const dispose of disposers) dispose();
  expect(tools.size).toBe(0);
});
