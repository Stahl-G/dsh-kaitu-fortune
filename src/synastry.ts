import { executeTool } from "taibu-core/mcp";

interface Factor {
  key: string;
  label: string;
  category: string;
  sign: { label: string };
  position: { decimal: number };
}
interface Chart {
  chartMeta: { aspectOrbs: Record<string, number> };
  natal: { bodies: Factor[]; angles: Factor[] };
}

const ASPECTS = [
  ["conjunction", "合相", 0],
  ["opposition", "对冲", 180],
  ["trine", "三分", 120],
  ["square", "四分", 90],
  ["sextile", "六合", 60],
] as const;

/** taibu 只算单人盘：分别排两张本命盘，再按 taibu 同一套容许度算两人之间的相位。 */
export async function synastry(a: Record<string, unknown>, b: Record<string, unknown>) {
  const [left, right] = (await Promise.all([executeTool("astrology", a), executeTool("astrology", b)])) as [
    Chart,
    Chart,
  ];
  const orbs = left.chartMeta.aspectOrbs;
  const factors = (chart: Chart) => [...chart.natal.bodies, ...chart.natal.angles];
  const aspects = [];
  for (const from of factors(left))
    for (const to of factors(right)) {
      const raw = Math.abs(from.position.decimal - to.position.decimal) % 360;
      const angle = raw > 180 ? 360 - raw : raw;
      for (const [type, label, target] of ASPECTS) {
        const orb = Math.abs(angle - target);
        if (orb <= (orbs[type] ?? 0))
          aspects.push({
            type,
            label,
            from: { key: from.key, label: from.label, sign: from.sign.label },
            to: { key: to.key, label: to.label, sign: to.sign.label },
            orb: Number(orb.toFixed(4)),
            actualAngle: Number(angle.toFixed(4)),
          });
      }
    }
  aspects.sort((x, y) => x.orb - y.orb);
  return { aspectOrbs: orbs, a: left.natal, b: right.natal, aspects };
}
