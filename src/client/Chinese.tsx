import { useEffect, useState } from "react";
import type { Birth } from "../birth.js";
import type { Request, Watch } from "./App.js";
import own from "./Chinese.module.css";
import css from "./Fortune.module.css";
import { Reading } from "./Reading.js";
import { Ziwei, type ZiweiChart } from "./Ziwei.js";

interface Pillar {
  stem: string;
  branch: string;
  tenGod?: string;
  hiddenStems: { stem: string; tenGod: string }[];
  naYin: string;
}
interface Luck {
  startYear: number;
  startAge: number;
  ganZhi: string;
  tenGod: string;
}
type Almanac = {
  基础与个性化坐标: { 日期: string; 日干支: string };
  传统黄历基调: { 农历: string; 生肖: string; 冲煞: string };
  择日宜忌: { 宜: string[]; 忌: string[] };
};
interface ChineseData {
  bazi: {
    dayMaster: string;
    fourPillars: Record<"year" | "month" | "day" | "hour", Pillar>;
    trueSolarTimeInfo: { clockTime: string; trueSolarTime: string };
  };
  dayun: { startAgeDetail: string; list: Luck[] };
  ziwei: ZiweiChart;
  almanac: Almanac;
}

const ELEMENT: Record<string, string> = {};
for (const [chars, name] of [
  ["甲乙寅卯", "wood"],
  ["丙丁巳午", "fire"],
  ["戊己辰戌丑未", "earth"],
  ["庚辛申酉", "metal"],
  ["壬癸亥子", "water"],
] as const)
  for (const char of chars) ELEMENT[char] = name;
const tone = (char: string) => own[ELEMENT[char] ?? ""];
const PILLARS = [
  ["year", "年柱"],
  ["month", "月柱"],
  ["day", "日柱"],
  ["hour", "时柱"],
] as const;

export function Chinese({
  request,
  watch,
  birth,
  candidate,
  onCandidate,
  onSaved,
}: {
  request: Request;
  watch: Watch;
  birth: Birth | null;
  candidate: number | null;
  onCandidate: (index: number | null) => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<ChineseData | null>(null);
  const [almanac, setAlmanac] = useState<Almanac | null>(null);
  const [error, setError] = useState("");
  const candidates = birth?.candidates ?? [];
  const picked = candidates.length > 1 ? candidate : 0;

  useEffect(() => {
    let active = true;
    setError("");
    if (!birth || picked === null) {
      setData(null);
      void request<Almanac>("almanac").then((value) => active && setAlmanac(value));
    } else {
      void request<ChineseData>("chinese", { candidate: picked })
        .then((value) => {
          if (!active) return;
          setData(value);
          setAlmanac(value.almanac);
        })
        .catch((err: Error) => active && setError(err.message));
    }
    return () => {
      active = false;
    };
  }, [birth, picked, request]);
  const thisYear = new Date().getFullYear();

  return (
    <>
      {candidates.length > 1 && (
        <section className={css.card}>
          <div className={css.heading}>
            <h2>你给的时间范围里有 {candidates.length} 种可能</h2>
            <span>按真太阳时换算，选一个最像的；会记住，再点一次取消</span>
          </div>
          <div className={css.choices}>
            {candidates.map((item, index) => (
              <button
                key={`${item.start}-${item.pillars.join("")}`}
                type="button"
                aria-pressed={candidate === index}
                onClick={() => onCandidate(candidate === index ? null : index)}
              >
                {item.start}–{item.end} · {item.pillars[2]}日 {item.pillars[3]}时
              </button>
            ))}
          </div>
        </section>
      )}
      {error && (
        <p className={css.notice} role="alert">
          {error}
        </p>
      )}
      {!birth ? (
        <p className={css.empty}>填好出生信息后，这里会排出八字和紫微斗数。</p>
      ) : picked === null ? null : !data ? (
        <p className={css.empty}>正在排盘…</p>
      ) : (
        <>
          <section className={css.card}>
            <div className={css.heading}>
              <h2>八字</h2>
              <span>
                真太阳时 {data.bazi.trueSolarTimeInfo.trueSolarTime}（钟表{" "}
                {data.bazi.trueSolarTimeInfo.clockTime}）
              </span>
            </div>
            <div className={own.pillars}>
              {PILLARS.map(([key, label]) => {
                const pillar = data.bazi.fourPillars[key];
                return (
                  <div key={key} className={own.pillar}>
                    <span className={css.small}>{label}</span>
                    <span className={own.god}>{key === "day" ? "日主" : pillar.tenGod}</span>
                    <span className={`${own.glyph} ${tone(pillar.stem)}`}>{pillar.stem}</span>
                    <span className={`${own.glyph} ${tone(pillar.branch)}`}>{pillar.branch}</span>
                    <span className={own.hidden}>
                      {pillar.hiddenStems.map((hidden) => (
                        <span key={hidden.stem}>
                          <span className={tone(hidden.stem)}>{hidden.stem}</span>
                          {hidden.tenGod}
                        </span>
                      ))}
                    </span>
                    <span className={css.small}>{pillar.naYin}</span>
                  </div>
                );
              })}
            </div>
            <p className={own.legend}>
              <span className={own.wood}>木</span>
              <span className={own.fire}>火</span>
              <span className={own.earth}>土</span>
              <span className={own.metal}>金</span>
              <span className={own.water}>水</span>
            </p>
          </section>
          <section className={css.card}>
            <div className={css.heading}>
              <h2>大运</h2>
              <span>{data.dayun.startAgeDetail}</span>
            </div>
            <div className={own.luck}>
              {data.dayun.list.map((luck, index) => {
                const next = data.dayun.list[index + 1]?.startYear ?? luck.startYear + 10;
                return (
                  <div
                    key={luck.startYear}
                    className={luck.startYear <= thisYear && thisYear < next ? own.now : undefined}
                  >
                    <span>{luck.startAge} 岁</span>
                    <b>
                      <span className={tone(luck.ganZhi[0] ?? "")}>{luck.ganZhi[0]}</span>
                      <span className={tone(luck.ganZhi[1] ?? "")}>{luck.ganZhi[1]}</span>
                    </b>
                    <span>{luck.tenGod}</span>
                    <span className={css.small}>{luck.startYear}</span>
                  </div>
                );
              })}
            </div>
          </section>
          <section className={css.card}>
            <div className={css.heading}>
              <h2>紫微斗数</h2>
              <span>点宫位看三方四正</span>
            </div>
            <Ziwei chart={data.ziwei} />
          </section>
          <Reading request={request} watch={watch} subject="chinese" onSaved={onSaved} />
        </>
      )}
      {almanac && (
        <section className={css.card}>
          <div className={css.heading}>
            <h2>今日黄历</h2>
            <span>
              {almanac.传统黄历基调.农历} · {almanac.基础与个性化坐标.日干支}日
            </span>
          </div>
          <dl className={own.facts}>
            <div>
              <dt>宜</dt>
              <dd className={own.chips}>
                {almanac.择日宜忌.宜.map((item) => (
                  <span key={item} className={`${css.chip} ${own.good}`}>
                    {item}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt>忌</dt>
              <dd className={own.chips}>
                {almanac.择日宜忌.忌.map((item) => (
                  <span key={item} className={css.chip}>
                    {item}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt>冲煞</dt>
              <dd>{almanac.传统黄历基调.冲煞}</dd>
            </div>
          </dl>
        </section>
      )}
    </>
  );
}
