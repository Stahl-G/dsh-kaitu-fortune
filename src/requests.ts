import { readFileSync } from "node:fs";
import { executeTool, renderToolResult } from "taibu-core/mcp";
import {
  type Birth,
  type BirthInput,
  chartArgs,
  deleteAll,
  pickCandidate,
  readBirth,
  saveBirth,
} from "./birth.js";
import { searchCities } from "./cities.js";
import { countDraws } from "./draws.js";
import { type Readings, type Subject, countReadings } from "./reading.js";
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

async function birthOf(dir: string, args: Args) {
  const birth = await readBirth(dir);
  if (!birth) throw new Error("先填出生信息");
  const candidate = typeof args.candidate === "number" ? birth.candidates?.[args.candidate] : undefined;
  return { birth, args: chartArgs(birth, candidate?.at) };
}

async function chinese(args: ReturnType<typeof chartArgs>) {
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
  return {
    bazi,
    dayun,
    ziwei,
    almanac: renderToolResult("almanac", almanac, {}).structuredContent,
  };
}

export async function handle(
  dir: string,
  operation: string,
  args: Args,
  readings?: Readings,
): Promise<unknown> {
  switch (operation) {
    case "state":
      return {
        birth: (await readBirth(dir)) ?? null,
        stored: { dir, draws: countDraws(dir), readings: countReadings(dir) },
      };
    case "cities":
      return searchCities(String(args.query ?? ""));
    case "saveBirth":
      return saveBirth(dir, args.birth as BirthInput);
    case "pickCandidate":
      return pickCandidate(dir, typeof args.candidate === "number" ? args.candidate : null);
    case "deleteAll":
      readings?.cancelAll();
      deleteAll(dir);
      return { deleted: true };
    case "almanac":
      return renderToolResult(
        "almanac",
        await executeTool("almanac", { date: today(), timezone: zone() }),
        {},
      ).structuredContent;
    case "chinese": {
      return chinese((await birthOf(dir, args)).args);
    }
    case "astro": {
      const { args: chart } = await birthOf(dir, args);
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
    case "startReading":
      return readings?.start(args.subject as Subject, args.drawId as string | undefined);
    case "readings":
      return readings?.list(args.subject as Subject | undefined) ?? [];
    case "deleteReading":
      readings?.remove(String(args.id));
      return { deleted: true };
    default:
      throw new Error(`未知操作：${operation}`);
  }
}
