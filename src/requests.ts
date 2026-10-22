import { readFileSync } from "node:fs";
import { executeTool, renderToolResult } from "taibu-core/mcp";
import { type Birth, type BirthInput, chartArgs, deleteAll, readBirth, saveBirth } from "./birth.js";
import { searchCities } from "./cities.js";
import { countDraws } from "./draws.js";
import { cast } from "./tools.js";

type Args = Record<string, unknown>;

const RANKS = [
  "Ace",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Page",
  "Knight",
  "Queen",
  "King",
];
const MAJORS = [
  "The Fool",
  "The Magician",
  "The High Priestess",
  "The Empress",
  "The Emperor",
  "The Hierophant",
  "The Lovers",
  "The Chariot",
  "Strength",
  "The Hermit",
  "Wheel of Fortune",
  "Justice",
  "The Hanged Man",
  "Death",
  "Temperance",
  "The Devil",
  "The Tower",
  "The Star",
  "The Moon",
  "The Sun",
  "Judgement",
  "The World",
];
/** taibu 的牌名对应到 1909 原版扫描的文件名（Waite 的顺序：8 力量、11 正义）。 */
export function cardImage(name: string) {
  const major = MAJORS.indexOf(name);
  if (major >= 0) return `major-${String(major).padStart(2, "0")}`;
  const [rank, , suit] = name.split(" ");
  return `${suit?.toLowerCase()}-${String(RANKS.indexOf(rank ?? "") + 1).padStart(2, "0")}`;
}

const today = () => new Date().toLocaleDateString("sv");
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function birthOf(dir: string, args: Args) {
  const birth = readBirth(dir);
  if (!birth) throw new Error("先填出生信息");
  const candidate = typeof args.candidate === "number" ? birth.candidates?.[args.candidate] : undefined;
  return { birth, args: chartArgs(birth, candidate?.at) };
}

async function chinese(birth: Birth, args: ReturnType<typeof chartArgs>) {
  const { latitude: _latitude, ...chart } = args;
  const [bazi, dayun, ziwei, almanac] = await Promise.all([
    executeTool("bazi", chart),
    executeTool("bazi_dayun", chart),
    executeTool("ziwei", chart),
    executeTool("almanac", {
      ...chart,
      gender: undefined,
      longitude: undefined,
      date: today(),
      timezone: zone(),
    }),
  ]);
  const solar = (ziwei as { trueSolarTimeInfo: { trueTimeIndex: number; dayOffset: number } })
    .trueSolarTimeInfo;
  const day = new Date(Date.UTC(args.birthYear, args.birthMonth - 1, args.birthDay + solar.dayOffset));
  return {
    bazi,
    dayun,
    // react-iztro 自己用 iztro 排盘：给它按真太阳时校正过的公历日期和时辰序号，和 taibu 的口径一致。
    ziwei: {
      birthday: `${day.getUTCFullYear()}-${day.getUTCMonth() + 1}-${day.getUTCDate()}`,
      birthTime: solar.trueTimeIndex,
      gender: birth.gender === "male" ? "男" : "女",
      chart: ziwei,
    },
    almanac: renderToolResult("almanac", almanac, {}).structuredContent,
  };
}

export async function handle(dir: string, operation: string, args: Args): Promise<unknown> {
  switch (operation) {
    case "state":
      return { birth: readBirth(dir) ?? null, stored: { dir, draws: countDraws(dir) } };
    case "cities":
      return searchCities(String(args.query ?? ""));
    case "saveBirth":
      return saveBirth(dir, args.birth as BirthInput);
    case "deleteAll":
      deleteAll(dir);
      return { deleted: true };
    case "almanac":
      return renderToolResult(
        "almanac",
        await executeTool("almanac", { date: today(), timezone: zone() }),
        {},
      ).structuredContent;
    case "chinese": {
      const { birth, args: chart } = birthOf(dir, args);
      return chinese(birth, chart);
    }
    case "astro": {
      const { args: chart } = birthOf(dir, args);
      const { gender: _gender, ...input } = chart;
      return executeTool("astrology", input);
    }
    case "tarot": {
      const { draw, raw } = await cast(dir, "tarot", {
        spreadType: args.spreadType,
        question: args.question,
      });
      const result = raw as { spreadName: string; cards: { card: { name: string } }[] };
      return {
        drawId: draw.id,
        ...result,
        cards: result.cards.map((item) => ({ ...item, image: cardImage(item.card.name) })),
      };
    }
    case "card": {
      const name = String(args.image);
      if (!/^(major|wands|cups|swords|pentacles)-\d{2}$/.test(name)) throw new Error("没有这张牌");
      const data = readFileSync(new URL(`../data/tarot/${name}.jpg`, import.meta.url)).toString("base64");
      return `data:image/jpeg;base64,${data}`;
    }
    default:
      throw new Error(`未知操作：${operation}`);
  }
}
