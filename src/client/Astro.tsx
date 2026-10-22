import { Chart } from "@astrodraw/astrochart";
import { useEffect, useId, useRef, useState } from "react";
import type { Birth } from "../birth.js";
import type { Request } from "./App.js";
import css from "./Fortune.module.css";

interface Placement {
  key: string;
  label: string;
  sign: { label: string };
  house?: number;
  position: { decimal: number; withinSign: string };
  retrograde?: boolean;
}
interface AstroData {
  natal: { bodies: Placement[]; angles: Placement[]; houses: { start: { decimal: number } }[] };
  majorAspects: {
    type: string;
    label: string;
    from: { label: string };
    to: { label: string };
    orb: number;
  }[];
}

const KEYS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const SIZE = 520;

/** AstroChart 把颜色写进 SVG 属性，读不到 CSS 变量；先从页面上算出开图当前的颜色再交给它。 */
function chartColors(element: HTMLElement) {
  const style = getComputedStyle(element);
  const read = (name: string) => style.getPropertyValue(name).trim();
  const ink = read("--ink2");
  const line = read("--line");
  const signs = [read("--me-tint"), read("--news-tint"), read("--explore-tint"), read("--health-tint")];
  return {
    COLOR_BACKGROUND: "transparent",
    POINTS_COLOR: read("--ink"),
    SIGNS_COLOR: ink,
    CIRCLE_COLOR: line,
    LINE_COLOR: line,
    CUSPS_FONT_COLOR: read("--muted"),
    SYMBOL_AXIS_FONT_COLOR: ink,
    // 火土风水四象循环，星座环用开图各领域的浅底色
    COLORS_SIGNS: Array.from({ length: 12 }, (_, index) => signs[index % 4] ?? ink),
    ASPECTS: {
      conjunction: { degree: 0, orbit: 8, color: "transparent" },
      square: { degree: 90, orbit: 7, color: read("--news") },
      trine: { degree: 120, orbit: 8, color: read("--health") },
      opposition: { degree: 180, orbit: 8, color: read("--me") },
      sextile: { degree: 60, orbit: 6, color: read("--explore") },
    },
  };
}

export function Astro({
  request,
  birth,
  candidate,
  theme,
}: {
  request: Request;
  birth: Birth | null;
  candidate: number | null;
  theme: string;
}) {
  const [data, setData] = useState<AstroData | null>(null);
  const [error, setError] = useState("");
  const holder = useRef<HTMLDivElement>(null);
  const id = `fortune-wheel-${useId().replace(/:/g, "")}`;
  const picked = (birth?.candidates?.length ?? 0) > 1 ? candidate : 0;

  useEffect(() => {
    if (!birth || picked === null) return setData(null);
    let active = true;
    void request<AstroData>("astro", { candidate: picked })
      .then((value) => active && setData(value))
      .catch((err: Error) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, [birth, picked, request]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 主题变化时要按新颜色重画
  useEffect(() => {
    const element = holder.current;
    if (!data || !element) return;
    element.replaceChildren();
    const planets = Object.fromEntries(
      data.natal.bodies
        .filter((body) => KEYS.includes(body.key))
        .map((body) => [
          body.key[0]?.toUpperCase() + body.key.slice(1),
          [body.position.decimal, body.retrograde ? -1 : 1],
        ]),
    );
    const cusps = data.natal.houses.map((house) => house.start.decimal);
    new Chart(id, SIZE, SIZE, chartColors(element)).radix({ planets, cusps }).aspects();
    element.querySelector("svg")?.setAttribute("viewBox", `0 0 ${SIZE} ${SIZE}`);
  }, [data, id, theme]);

  if (!birth) return <p className={css.empty}>填好出生信息后，这里会画出你的本命盘。</p>;
  if (picked === null)
    return <p className={css.empty}>出生时间不确定：先在「中式」里挑一个时辰，再看星盘。</p>;
  if (error)
    return (
      <p className={css.notice} role="alert">
        {error}
      </p>
    );
  if (!data) return <p className={css.empty}>正在排盘…</p>;
  const pick = (key: string) => [...data.natal.bodies, ...data.natal.angles].find((item) => item.key === key);
  const big3 = [pick("sun"), pick("moon"), pick("ascendant")].filter((item) => item !== undefined);

  return (
    <div className={css.grid2}>
      <section className={css.card}>
        <div className={css.heading}>
          <h2>本命盘</h2>
          <span>回归黄道 · Placidus 分宫</span>
        </div>
        <div className={css.wheel}>
          <div id={id} ref={holder} />
        </div>
      </section>
      <div className={css.panel}>
        <section className={css.card}>
          <div className={css.heading}>
            <h2>太阳、月亮、上升</h2>
          </div>
          <ul className={css.list}>
            {big3.map((item) => (
              <li key={item.key}>
                <span>{item.label}</span>
                <span>
                  {item.sign.label} {item.position.withinSign}
                  {item.house ? <span className={css.small}> · 第 {item.house} 宫</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className={css.card}>
          <div className={css.heading}>
            <h2>主要相位</h2>
            <span>按容许度从紧到松</span>
          </div>
          <ul className={css.list}>
            {[...data.majorAspects]
              .sort((a, b) => a.orb - b.orb)
              .slice(0, 12)
              .map((aspect) => (
                <li key={`${aspect.from.label}-${aspect.type}-${aspect.to.label}`}>
                  <span>
                    {aspect.from.label} {aspect.label} {aspect.to.label}
                  </span>
                  <span className={`${css.small} ${css.num}`}>{aspect.orb.toFixed(1)}°</span>
                </li>
              ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
