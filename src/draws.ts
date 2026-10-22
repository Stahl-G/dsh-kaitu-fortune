import { randomBytes, randomInt } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** 一次抽牌或起卦：存下送进引擎的完整输入，重放时原样再算一遍。 */
export interface Draw {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  createdAt: string;
}

export const tarotSeed = () => randomBytes(16).toString("hex");

/** 三钱法摇六次：正面记 3、反面记 2，每爻得 6（老阴）到 9（老阳），自初爻起。 */
export const coinYao = () =>
  Array.from({ length: 6 }, () => [0, 1, 2].reduce((sum) => sum + (randomInt(2) ? 3 : 2), 0));

export function saveDraw(dir: string, tool: string, input: Record<string, unknown>): Draw {
  const createdAt = new Date().toISOString();
  const draw = { id: `${createdAt.slice(0, 10)}-${randomBytes(4).toString("hex")}`, tool, input, createdAt };
  mkdirSync(join(dir, "draws"), { recursive: true });
  writeFileSync(join(dir, "draws", `${draw.id}.json`), JSON.stringify(draw, null, 2));
  return draw;
}

export function readDraw(dir: string, id: string): Draw {
  if (!/^\d{4}-\d{2}-\d{2}-[0-9a-f]{8}$/.test(id)) throw new Error("没有这条抽牌记录");
  return JSON.parse(readFileSync(join(dir, "draws", `${id}.json`), "utf8")) as Draw;
}

/** 存了多少条抽牌、起卦记录（界面上的“我的资料”和删除前的说明用）。 */
export const countDraws = (dir: string) =>
  existsSync(join(dir, "draws"))
    ? readdirSync(join(dir, "draws")).filter((name) => name.endsWith(".json")).length
    : 0;
