import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { chartArgs, deleteAll, readBirth, saveBirth } from "../src/birth.js";
import { searchCities } from "../src/cities.js";
import { compute } from "../src/tools.js";

const dir = () => mkdtempSync(join(tmpdir(), "fortune-birth-"));
const shanghai = () => searchCities("上海")[0]?.geonameid as number;

test("城市从开图城市库里搜，“市”字可带可不带，时区按经纬度推", () => {
  const [city] = searchCities("北京市");
  expect(city).toMatchObject({ zh: "北京", country: "CN", timezone: "Asia/Shanghai" });
  expect(searchCities("new york")[0]?.timezone).toBe("America/New_York");
});

test("准确时间：保存后排盘参数带出生城市的经纬度和时区", async () => {
  const at = dir();
  const birth = await saveBirth(at, {
    calendar: "solar",
    year: 1990,
    month: 5,
    day: 15,
    time: { hour: 14, minute: 30 },
    gender: "male",
    cityId: shanghai(),
  });
  expect(readBirth(at)).toEqual(birth);
  const chart = (await compute("bazi", chartArgs(birth))) as { 四柱: { 干支: string }[] };
  expect(chart.四柱.map((pillar) => pillar.干支)).toEqual(["庚午", "辛巳", "庚辰", "癸未"]);
});

test("农历生日在保存时换算成公历", async () => {
  const birth = await saveBirth(dir(), {
    calendar: "lunar",
    year: 1990,
    month: 4,
    day: 21,
    time: { hour: 14, minute: 30 },
    gender: "female",
    cityId: shanghai(),
  });
  expect(birth.solar).toEqual({ year: 1990, month: 5, day: 15 });
});

test("时间不确定且跨午夜：列出每种可能的四柱和时段，不默认子时", async () => {
  const birth = await saveBirth(dir(), {
    calendar: "solar",
    year: 2000,
    month: 3,
    day: 10,
    time: { from: "22:30", to: "01:30" },
    gender: "female",
    cityId: shanghai(),
  });
  // 上海东经 121.47°，三月真太阳时比钟表慢约 4 分钟；子时被午夜分成晚子、早子两段，日柱不同。
  expect(
    birth.candidates?.map((candidate) => [candidate.pillars.join(" "), candidate.start, candidate.end]),
  ).toEqual([
    ["庚辰 己卯 丁卯 辛亥", "2000-03-10 21:04", "2000-03-10 23:04"],
    ["庚辰 己卯 丁卯 壬子", "2000-03-10 23:04", "2000-03-11 00:04"],
    ["庚辰 己卯 戊辰 壬子", "2000-03-11 00:04", "2000-03-11 01:04"],
    ["庚辰 己卯 戊辰 癸丑", "2000-03-11 01:04", "2000-03-11 03:04"],
  ]);
  // 多个候选时不替用户选
  expect(() => chartArgs(birth)).toThrow("不确定");
});

const uncertain = (day: number, from: string, to: string) =>
  saveBirth(dir(), {
    calendar: "solar",
    year: 2000,
    month: 3,
    day,
    time: { from, to },
    gender: "female",
    cityId: shanghai(),
  });
const spans = (birth: Awaited<ReturnType<typeof saveBirth>>) =>
  birth.candidates?.map((candidate) => [candidate.pillars[3], candidate.start, candidate.end]);

test("只有 5 分钟的范围跨过时辰交界，两种时辰都要列出", async () => {
  expect(spans(await uncertain(10, "23:00", "23:05"))).toEqual([
    ["辛亥", "2000-03-10 21:04", "2000-03-10 23:04"],
    ["壬子", "2000-03-10 23:04", "2000-03-11 00:04"],
  ]);
});

test("范围终点刚好落在交界上也算进去", async () => {
  expect(spans(await uncertain(10, "22:55", "23:04"))?.map(([hour]) => hour)).toEqual(["辛亥", "壬子"]);
});

test("跨午夜、末尾不足 10 分钟：00:00–00:06 跨日柱，01:00–01:06 跨到丑时", async () => {
  const midnight = await uncertain(10, "23:58", "00:06");
  expect(midnight.candidates?.map((candidate) => candidate.pillars.slice(2).join(" "))).toEqual([
    "丁卯 壬子",
    "戊辰 壬子",
  ]);
  expect(spans(await uncertain(11, "01:00", "01:06"))?.map(([hour]) => hour)).toEqual(["壬子", "癸丑"]);
});

test("范围在同一个时辰里只有一种可能时，直接用它排盘", async () => {
  const birth = await uncertain(10, "21:30", "22:30");
  expect(birth.candidates).toHaveLength(1);
  expect(chartArgs(birth)).toMatchObject({ birthHour: 21, birthMinute: 30 });
});

test("一键删除清掉出生信息和记录", async () => {
  const at = dir();
  await saveBirth(at, {
    calendar: "solar",
    year: 1990,
    month: 5,
    day: 15,
    time: { hour: 14, minute: 30 },
    gender: "male",
    cityId: shanghai(),
  });
  deleteAll(at);
  expect(readBirth(at)).toBeUndefined();
});
