import { useState } from "react";
import css from "./Fortune.module.css";
import own from "./Ziwei.module.css";

interface Star {
  name: string;
  brightness?: string;
  mutagen?: string;
}
interface Palace {
  name: string;
  heavenlyStem: string;
  earthlyBranch: string;
  isBodyPalace: boolean;
  changsheng12: string;
  boshi12: string;
  decadalRange: [number, number];
  majorStars: Star[];
  minorStars: Star[];
  adjStars: Star[];
  sanFangSiZheng: string[];
}
/** taibu `ziwei` 工具的原样输出：后端排一次盘，这里只负责画，不再自己排。 */
export interface ZiweiChart {
  lunarDate: string;
  fourPillars: Record<"year" | "month" | "day" | "hour", { gan: string; zhi: string }>;
  fiveElement: string;
  zodiac: string;
  time: string;
  lifeMasterStar: string;
  bodyMasterStar: string;
  palaces: Palace[];
  mutagenSummary: { mutagen: string; starName: string; palaceName: string }[];
  trueSolarTimeInfo: { trueSolarTime: string };
}

// 传统盘面：巳午未申在上，亥子丑寅在下，中间四格留给命盘信息
const PLACE: Record<string, [number, number]> = {
  巳: [1, 1],
  午: [1, 2],
  未: [1, 3],
  申: [1, 4],
  辰: [2, 1],
  酉: [2, 4],
  卯: [3, 1],
  戌: [3, 4],
  寅: [4, 1],
  丑: [4, 2],
  子: [4, 3],
  亥: [4, 4],
};
const MUTAGEN: Record<string, string | undefined> = { 禄: own.lu, 权: own.quan, 科: own.ke, 忌: own.ji };

function Stars({ stars, className }: { stars: Star[]; className?: string }) {
  return (
    <span className={className}>
      {stars.map((star) => (
        <span key={star.name}>
          {star.name}
          {star.brightness && <small>{star.brightness}</small>}
          {star.mutagen && <b className={MUTAGEN[star.mutagen]}>{star.mutagen}</b>}
        </span>
      ))}
    </span>
  );
}

export function Ziwei({ chart }: { chart: ZiweiChart }) {
  const [focus, setFocus] = useState<string | null>(null);
  const near = new Set(chart.palaces.find((palace) => palace.name === focus)?.sanFangSiZheng);
  const pillars = (["year", "month", "day", "hour"] as const).map(
    (key) => chart.fourPillars[key].gan + chart.fourPillars[key].zhi,
  );
  return (
    <div className={own.board}>
      {chart.palaces.map((palace) => {
        const [row, column] = PLACE[palace.earthlyBranch] ?? [0, 0];
        return (
          <button
            key={palace.name}
            type="button"
            className={`${own.palace} ${palace.name === focus ? own.focus : near.has(palace.name) ? own.near : ""}`}
            style={{ "--row": row, "--column": column } as React.CSSProperties}
            aria-pressed={palace.name === focus}
            onClick={() => setFocus(palace.name === focus ? null : palace.name)}
          >
            <Stars stars={palace.majorStars} className={own.major} />
            <Stars stars={palace.minorStars} className={own.minor} />
            <Stars stars={palace.adjStars} className={own.adj} />
            <span className={own.foot}>
              <span className={css.small}>
                {palace.changsheng12} · {palace.boshi12}
                <br />
                {palace.decadalRange[0]}–{palace.decadalRange[1]} 岁
              </span>
              <span className={own.name}>
                {palace.name}
                {palace.isBodyPalace && <small>身</small>}
                <small>
                  {palace.heavenlyStem}
                  {palace.earthlyBranch}
                </small>
              </span>
            </span>
          </button>
        );
      })}
      <div className={own.center}>
        <b>{chart.fiveElement}</b>
        <span>{pillars.join(" ")}</span>
        <span className={css.small}>
          {chart.lunarDate} {chart.time} · 真太阳时 {chart.trueSolarTimeInfo.trueSolarTime}
        </span>
        <span className={css.small}>
          命主 {chart.lifeMasterStar} · 身主 {chart.bodyMasterStar} · 属{chart.zodiac}
        </span>
        <span className={own.mutagens}>
          {chart.mutagenSummary.map((item) => (
            <span key={item.mutagen}>
              <b className={MUTAGEN[item.mutagen]}>{item.mutagen}</b>
              {item.starName}
              <small>{item.palaceName}</small>
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
