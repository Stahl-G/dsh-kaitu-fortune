import {
  type ListedToolDefinition,
  executeTool,
  listToolDefinitions,
  renderToolResult,
} from "taibu-core/mcp";
import { chartArgs, readBirth } from "./birth.js";
import { coinYao, readDraw, saveDraw, tarotSeed } from "./draws.js";
import { synastry } from "./synastry.js";

type Args = Record<string, unknown>;
type Schema = { type: "object"; properties: Record<string, unknown>; required?: string[] };
export interface FortuneTool {
  name: string;
  description: string;
  parameters: Schema;
  run(args: Args): Promise<unknown>;
}

const definitions = new Map(listToolDefinitions().map((tool) => [tool.name, tool]));
const def = (tool: string) => definitions.get(tool) as ListedToolDefinition;

/** taibu 的入参 schema，去掉引擎内部的随机参数；顶层 allOf/examples 留给 taibu 自己校验，不交给模型。 */
function schema(tool: string, drop: string[] = [], optional: string[] = []): Schema {
  const { properties, required = [] } = def(tool).inputSchema;
  return {
    type: "object",
    properties: Object.fromEntries(Object.entries(properties).filter(([key]) => !drop.includes(key))),
    required: required.filter((key) => !drop.includes(key) && !optional.includes(key)),
  };
}

const local = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

/** taibu 自带的结构化 JSON（和它的 MCP 输出一致），详略按 detailLevel。 */
export async function compute(tool: string, args: Args) {
  const raw = await executeTool(tool, args);
  return renderToolResult(tool, raw, { detailLevel: args.detailLevel as "default" })
    .structuredContent as object;
}

/** 随机结果由插件用系统安全随机数生成并存档，引擎只做确定性计算。界面用 raw，模型用结构化 JSON。 */
export async function cast(dir: string, tool: "tarot" | "liuyao", args: Args) {
  const input =
    tool === "tarot"
      ? { ...args, referenceYear: args.referenceYear ?? new Date().getFullYear(), seed: tarotSeed() }
      : {
          ...args,
          date: args.date ?? local(new Date()),
          timezone: args.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
          method: "coins",
          yaoValues: coinYao(),
        };
  const draw = saveDraw(dir, tool, input);
  return { draw, raw: await executeTool(tool, input) };
}

async function drawn(dir: string, tool: "tarot" | "liuyao", args: Args) {
  const { draw, raw } = await cast(dir, tool, args);
  return {
    drawId: draw.id,
    ...(renderToolResult(tool, raw, { detailLevel: args.detailLevel as "default" })
      .structuredContent as object),
  };
}

const BIRTH = [
  "birthYear",
  "birthMonth",
  "birthDay",
  "birthHour",
  "birthMinute",
  "latitude",
  "longitude",
  "timezone",
  "disambiguation",
];

export function fortuneTools(dir: string): FortuneTool[] {
  const plain = (tool: string): FortuneTool => ({
    name: `fortune_${tool}`,
    description: def(tool).description,
    parameters: schema(tool),
    run: (args) => compute(tool, args),
  });
  const astrology = def("astrology").inputSchema.properties;
  const person = {
    type: "object",
    properties: Object.fromEntries(BIRTH.map((key) => [key, astrology[key]])),
    required: ["birthYear", "birthMonth", "birthDay", "birthHour", "latitude", "longitude"],
  };
  return [
    plain("bazi"),
    plain("bazi_dayun"),
    plain("ziwei"),
    plain("ziwei_horoscope"),
    plain("almanac"),
    plain("astrology"),
    {
      name: "fortune_liuyao",
      description: `${def("liuyao").description}三钱由插件随机摇出并存档，返回 drawId 可重放。`,
      parameters: schema(
        "liuyao",
        ["method", "numbers", "yaoValues", "hexagramName", "changedHexagramName"],
        ["date"],
      ),
      run: (args) => drawn(dir, "liuyao", args),
    },
    {
      name: "fortune_tarot",
      description: `${def("tarot").description}牌由插件随机抽出并存档，返回 drawId 可重放。`,
      parameters: schema("tarot", ["seed", "seedScope"]),
      run: (args) => drawn(dir, "tarot", args),
    },
    {
      name: "fortune_synastry",
      description: "西洋合盘：分别排两人的本命盘，列出两人行星与上升、天顶之间的主要相位（容许度同本命盘）。",
      parameters: { type: "object", properties: { a: person, b: person }, required: ["a", "b"] },
      run: (args) => synastry(args.a as Args, args.b as Args),
    },
    {
      name: "fortune_my_birth",
      description:
        "读取用户在插件里填好的出生信息。chartArgs 可直接传给 fortune_bazi、fortune_ziwei、fortune_astrology 等（经纬度、时区已按出生城市给出）；时间不确定时 candidates 列出范围内每种可能的四柱和对应时段；有多种且用户已在页面上挑定时，picked 是那一种的下标，chartArgs 就按它给；还没挑时先请用户确认是哪一种，不要默认子时，也不要自己取第一个。",
      parameters: { type: "object", properties: {} },
      async run() {
        const birth = await readBirth(dir);
        if (!birth) return { saved: false };
        return {
          saved: true,
          calendar: birth.calendar,
          city: birth.city,
          // 只有一种可能或用户已挑定时直接给参数；否则由用户选，不替他取第一个
          chartArgs:
            (birth.candidates?.length ?? 0) > 1 && birth.picked === undefined ? undefined : chartArgs(birth),
          picked: birth.picked,
          candidates: birth.candidates?.map((candidate) => ({
            ...candidate,
            chartArgs: chartArgs(birth, candidate.at),
          })),
        };
      },
    },
    {
      name: "fortune_replay",
      description: "按 drawId 重放一次塔罗抽牌或六爻起卦，得到与当时完全相同的结果。",
      parameters: { type: "object", properties: { drawId: { type: "string" } }, required: ["drawId"] },
      async run(args) {
        const draw = readDraw(dir, String(args.drawId));
        return { drawId: draw.id, createdAt: draw.createdAt, ...(await compute(draw.tool, draw.input)) };
      },
    },
  ];
}
