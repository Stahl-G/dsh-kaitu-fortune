import { useCallback, useEffect, useState } from "react";
import type { Birth } from "../birth.js";
import { Astro } from "./Astro.js";
import { BirthForm } from "./BirthForm.js";
import { Chinese } from "./Chinese.js";
import css from "./Fortune.module.css";
import { Tarot } from "./Tarot.js";

export type Request = <T>(operation: string, input?: object) => Promise<T>;
type Tab = "chinese" | "astro" | "tarot";
const TABS: [Tab, string][] = [
  ["chinese", "中式"],
  ["astro", "星象"],
  ["tarot", "塔罗"],
];

/** 跟开图页面一样：DSH 切深色时 body 上有 data-ds-dark-theme，否则看系统设置。 */
const read = () =>
  document.body.hasAttribute("data-ds-dark-theme") || matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
function useTheme() {
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setTheme(read());
    media.addEventListener("change", update);
    const observer = new MutationObserver(update);
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
    return () => {
      media.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);
  return theme;
}

interface Stored {
  dir: string;
  draws: number;
}

export const pad = (value: number) => String(value).padStart(2, "0");
export function birthLine(birth: Birth) {
  const date =
    birth.calendar === "lunar"
      ? `农历 ${birth.year} 年${birth.leapMonth ? "闰" : ""}${birth.month} 月 ${birth.day} 日`
      : `${birth.year} 年 ${birth.month} 月 ${birth.day} 日`;
  const time =
    "hour" in birth.time
      ? `${pad(birth.time.hour)}:${pad(birth.time.minute)}`
      : `大约 ${birth.time.from}–${birth.time.to}`;
  return `${date} ${time} · ${birth.city.zh} · ${birth.gender === "male" ? "男" : "女"}`;
}

export function FortunePage({ request }: { request: Request }) {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>("chinese");
  const [birth, setBirth] = useState<Birth | null | undefined>();
  const [editing, setEditing] = useState(false);
  const [stored, setStored] = useState<Stored | null>(null);
  // 删除资料后各面板重新开始，不留着已经删掉的抽牌结果
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const state = await request<{ birth: Birth | null; stored: Stored }>("state");
      setBirth(state.birth);
      setStored(state.stored);
      setEditing(!state.birth);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [request]);
  useEffect(() => {
    void load();
  }, [load]);
  // 抽完牌只更新“我的资料”里的条数，不动正在填的出生信息
  const refreshStored = useCallback(async () => {
    setStored((await request<{ stored: Stored }>("state")).stored);
  }, [request]);
  // 时辰不确定时用户挑的那一种，存在出生信息里；重开页面还在，改出生信息后要重新挑
  const candidate = birth?.picked ?? null;
  const pick = async (index: number | null) => {
    try {
      setBirth(await request<Birth>("pickCandidate", { candidate: index }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const remove = async () => {
    if (!confirm("删除出生信息、抽牌记录和解读？删除后不能恢复。")) return;
    await request("deleteAll");
    setVersion((value) => value + 1);
    await load();
  };
  return (
    <div className={css.app} data-theme={theme} lang="zh-CN">
      <main className={css.content} aria-busy={birth === undefined}>
        {/* 嵌在开图内容区里：没有自己的页头，标签和操作放一行，宽度跟着宿主走 */}
        <div className={css.toolbar}>
          <div className={css.tabs} role="tablist" aria-label="分类">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`fortune-tab-${key}`}
                aria-controls="fortune-panel"
                aria-selected={tab === key}
                tabIndex={tab === key ? 0 : -1}
                onClick={() => setTab(key)}
                onKeyDown={(event) => {
                  const index = TABS.findIndex(([name]) => name === tab);
                  const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
                  if (!step) return;
                  event.preventDefault();
                  const next = TABS[(index + step + TABS.length) % TABS.length]?.[0] ?? tab;
                  setTab(next);
                  document.getElementById(`fortune-tab-${next}`)?.focus();
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {birth && !editing && (
            <button type="button" className={css.button} onClick={() => setEditing(true)}>
              修改出生信息
            </button>
          )}
        </div>
        {error && (
          <p className={css.notice} role="alert">
            {error}
          </p>
        )}
        {birth === undefined ? (
          <p className={css.empty}>正在读取…</p>
        ) : editing ? (
          <BirthForm
            request={request}
            birth={birth}
            onSaved={(saved) => {
              setBirth(saved);
              setEditing(false);
            }}
            onCancel={birth ? () => setEditing(false) : undefined}
          />
        ) : (
          birth && <p className={css.small}>{birthLine(birth)} · 只存在这台电脑上，不进开图资料，也不同步</p>
        )}
        <div
          key={version}
          className={css.panel}
          id="fortune-panel"
          role="tabpanel"
          aria-labelledby={`fortune-tab-${tab}`}
        >
          {tab === "chinese" && (
            <Chinese request={request} birth={birth ?? null} candidate={candidate} onCandidate={pick} />
          )}
          {tab === "astro" && (
            <Astro request={request} birth={birth ?? null} candidate={candidate} theme={theme} />
          )}
          {tab === "tarot" && <Tarot request={request} onDrawn={refreshStored} />}
        </div>
        {stored && (
          <section className={css.card} aria-labelledby="fortune-stored">
            <div className={css.heading}>
              <h2 id="fortune-stored">我的资料</h2>
              <span>只在这台电脑上</span>
            </div>
            <p className={css.small}>
              {birth ? "出生信息 1 份" : "没有出生信息"} · 抽牌、起卦记录 {stored.draws} 条 · 存放在{" "}
              {stored.dir}
            </p>
            <p className={css.small}>卸载插件不会删除这些资料；要清掉，请在卸载前点下面的按钮。</p>
            <div className={css.actions}>
              <button
                type="button"
                className={css.button}
                onClick={remove}
                disabled={!birth && !stored.draws}
              >
                删除我的资料
              </button>
            </div>
          </section>
        )}
        <footer className={css.foot}>传统文化与自我反思参考，不是预测。</footer>
      </main>
    </div>
  );
}
