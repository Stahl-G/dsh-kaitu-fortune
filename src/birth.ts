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
  /** 有多种可能时用户在页面上挑定的那一种（candidates 的下标）；没挑就没有这一项，改出生信息后清掉。 */
  picked?: number;
  savedAt: string;
}

const file = (dir: string) => join(dir, "birth.json");

/**
 * 交给 taibu 排盘的参数：公历日期、经纬度（真太阳时）和出生地时区都由插件给，不让模型去查。
 * 子时（真太阳时 23 点）起换日，日柱跟着换；紫微本来就这样排，八字、大运也统一成这样。
 */
export function chartArgs(birth: Birth, at?: Moment) {
  const chosen = birth.candidates?.[birth.candidates.length === 1 ? 0 : (birth.picked ?? -1)]?.at;
  const time = at ?? ("hour" in birth.time ? { ...birth.solar, ...birth.time } : chosen);
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
    dayBoundary: "zi" as const,
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
/** 出生日 0 点起算的钟表分钟数，换回年月日时分（只做日期进位，不涉及时区）。 */
function momentAt(day: Birth["solar"], minute: number): Moment {
  const date = new Date(Date.UTC(day.year, day.month - 1, day.day, 0, minute));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  };
}

/** 在 [low, high] 里找第一个让 test 成立的分钟；test 在区间里先假后真。 */
async function firstMinute(from: number, to: number, test: (minute: number) => Promise<boolean>) {
  let [low, high] = [from, to];
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (await test(middle)) high = middle;
    else low = middle + 1;
  }
  return low;
}

/**
 * 范围里每一种四柱和它在钟表上的完整时段。同一组四柱一天内不会重复出现，所以“是不是这组四柱”
 * 在时间轴上是一段连续区间，边界用二分查到分钟；一个时辰最长两小时，前后各找三小时一定够。
 * 按边界走而不是按固定间隔采样，短区间、跨午夜和末尾不足一段的都不会漏。
 */
async function candidates(birth: Omit<Birth, "candidates" | "savedAt">, from: string, to: string) {
  const first = minutes(from);
  const last = first + ((minutes(to) - first + 1440) % 1440);
  const cache = new Map<number, string>();
  const pillarsAt = async (minute: number) => {
    const known = cache.get(minute);
    if (known) return known;
    const chart = (await executeTool("bazi", {
      ...chartArgs(birth as Birth, momentAt(birth.solar, minute)),
      latitude: undefined,
      disambiguation: "compatible",
    })) as { fourPillars: Record<"year" | "month" | "day" | "hour", Pillar> };
    const { year, month, day, hour } = chart.fourPillars;
    const key = [year, month, day, hour].map((pillar) => pillar.stem + pillar.branch).join(" ");
    cache.set(minute, key);
    return key;
  };
  const result: Candidate[] = [];
  for (let minute = first; minute <= last; ) {
    const key = await pillarsAt(minute);
    const start = await firstMinute(minute - 180, minute, async (at) => (await pillarsAt(at)) === key);
    const end = await firstMinute(minute, minute + 180, async (at) => (await pillarsAt(at)) !== key);
    result.push({
      pillars: key.split(" ") as Candidate["pillars"],
      start: stamp(momentAt(birth.solar, start)),
      end: stamp(momentAt(birth.solar, end)),
      at: momentAt(birth.solar, minute),
    });
    minute = end;
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

/** 记下挑定的时辰；传 null 改回“还没挑”。 */
export function pickCandidate(dir: string, index: number | null): Birth {
  const birth = readBirth(dir);
  if (!birth) throw new Error("先填出生信息");
  if (index !== null && !birth.candidates?.[index]) throw new Error("没有这个时辰");
  const { picked: _picked, ...rest } = birth;
  const next: Birth = index === null ? rest : { ...rest, picked: index };
  writeFileSync(file(dir), JSON.stringify(next, null, 2));
  return next;
}

export const readBirth = (dir: string): Birth | undefined =>
  existsSync(file(dir)) ? (JSON.parse(readFileSync(file(dir), "utf8")) as Birth) : undefined;

/** 一键删除：出生信息、抽牌记录和解读都在这个目录里。 */
export const deleteAll = (dir: string) => rmSync(dir, { recursive: true, force: true });
