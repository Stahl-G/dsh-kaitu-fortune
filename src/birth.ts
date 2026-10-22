import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Lunar } from "lunar-javascript";
import { executeTool } from "taibu-core/mcp";
import { type City, cityById } from "./cities.js";

interface Moment {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}
export interface BirthInput {
  calendar: "solar" | "lunar";
  year: number;
  month: number;
  day: number;
  leapMonth?: boolean;
  /** 准确时间，或“不确定，大概几点到几点”（HH:MM，结束早于开始表示跨过午夜）。 */
  time: { hour: number; minute: number } | { from: string; to: string };
  gender: "male" | "female";
  cityId: number;
}
/** 时辰不确定时，范围内每一种可能的四柱，以及它对应的钟表时间段。 */
export interface Candidate {
  pillars: [string, string, string, string];
  start: string;
  end: string;
  at: Moment;
}
export interface Birth extends BirthInput {
  city: City;
  /** 公历出生日；农历输入在保存时换算好。 */
  solar: { year: number; month: number; day: number };
  candidates?: Candidate[];
  savedAt: string;
}

const file = (dir: string) => join(dir, "birth.json");

/** 交给 taibu 排盘的参数：公历日期、经纬度（真太阳时）和出生地时区都由插件给，不让模型去查。 */
export function chartArgs(birth: Birth, at?: Moment) {
  const time = at ?? ("hour" in birth.time ? { ...birth.solar, ...birth.time } : birth.candidates?.[0]?.at);
  if (!time) throw new Error("出生时间不确定，需要先选一个时辰");
  return {
    birthYear: time.year,
    birthMonth: time.month,
    birthDay: time.day,
    birthHour: time.hour,
    birthMinute: time.minute,
    gender: birth.gender,
    latitude: birth.city.lat,
    longitude: birth.city.lng,
    timezone: birth.city.timezone,
  };
}

const minutes = (hhmm: string) => {
  const [hour, minute] = hhmm.split(":").map(Number) as [number, number];
  return hour * 60 + minute;
};
const pad = (value: number) => String(value).padStart(2, "0");
const stamp = (at: Moment) => `${at.year}-${pad(at.month)}-${pad(at.day)} ${pad(at.hour)}:${pad(at.minute)}`;

interface Pillar {
  stem: string;
  branch: string;
}
interface Resolved {
  candidates: { timeWindow: { start: string; end: string } }[];
}

/** 每 10 分钟排一次四柱，按四柱分组；每组再用 bazi_pillars_resolve 反查出它在钟表上的准确起止。 */
async function candidates(birth: Omit<Birth, "candidates" | "savedAt">, from: string, to: string) {
  const start = minutes(from);
  const span = (minutes(to) - start + 1440) % 1440;
  const groups = new Map<string, Moment>();
  for (let offset = 0; offset <= span; offset += 10) {
    const date = new Date(
      Date.UTC(birth.solar.year, birth.solar.month - 1, birth.solar.day, 0, start + offset),
    );
    const at = {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
    };
    const chart = (await executeTool("bazi", {
      ...chartArgs(birth as Birth, at),
      latitude: undefined,
      disambiguation: "compatible",
    })) as { fourPillars: Record<"year" | "month" | "day" | "hour", Pillar> };
    const { year, month, day, hour } = chart.fourPillars;
    const key = [year, month, day, hour].map((pillar) => pillar.stem + pillar.branch).join(" ");
    if (!groups.has(key)) groups.set(key, at);
  }
  const result: Candidate[] = [];
  for (const [key, at] of groups) {
    const pillars = key.split(" ") as Candidate["pillars"];
    const resolved = (await executeTool("bazi_pillars_resolve", {
      yearPillar: pillars[0],
      monthPillar: pillars[1],
      dayPillar: pillars[2],
      hourPillar: pillars[3],
      startYear: at.year,
      endYear: at.year,
      longitude: birth.city.lng,
      timezone: birth.city.timezone,
      disambiguation: "compatible",
    })) as Resolved;
    const window = resolved.candidates
      .map((candidate) => candidate.timeWindow)
      .find((window) => window.start <= stamp(at) && stamp(at) < window.end);
    result.push({ pillars, start: window?.start ?? stamp(at), end: window?.end ?? stamp(at), at });
  }
  return result;
}

export async function saveBirth(dir: string, input: BirthInput): Promise<Birth> {
  const solar =
    input.calendar === "lunar"
      ? Lunar.fromYmd(input.year, input.leapMonth ? -input.month : input.month, input.day).getSolar()
      : undefined;
  const base = {
    ...input,
    city: cityById(input.cityId),
    solar: solar
      ? { year: solar.getYear(), month: solar.getMonth(), day: solar.getDay() }
      : { year: input.year, month: input.month, day: input.day },
  };
  const birth: Birth = {
    ...base,
    ...("from" in input.time ? { candidates: await candidates(base, input.time.from, input.time.to) } : {}),
    savedAt: new Date().toISOString(),
  };
  mkdirSync(dir, { recursive: true });
  writeFileSync(file(dir), JSON.stringify(birth, null, 2));
  return birth;
}

export const readBirth = (dir: string): Birth | undefined =>
  existsSync(file(dir)) ? (JSON.parse(readFileSync(file(dir), "utf8")) as Birth) : undefined;

/** 一键删除：出生信息、抽牌记录和解读都在这个目录里。 */
export const deleteAll = (dir: string) => rmSync(dir, { recursive: true, force: true });
