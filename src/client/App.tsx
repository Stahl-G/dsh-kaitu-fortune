import { useCallback, useEffect, useState } from "react";
import type { Birth } from "../birth.js";
import type { ChatDestination, ConnectChat } from "../chat.js";
import type { Reading } from "../reading.js";
import type { ConnectTasks, Propose } from "../tasks.js";
import { Astro } from "./Astro.js";
import { BirthForm } from "./BirthForm.js";
import { ChatContext } from "./Chat.js";
import { Chinese } from "./Chinese.js";
import css from "./Fortune.module.css";
import { Mbti } from "./Mbti.js";
import { Tarot } from "./Tarot.js";
import { TaskContext } from "./Task.js";

export type Request = <T>(operation: string, input?: object) => Promise<T>;
/** 接上一条正在生成的解读，每多一段回调一次；返回值用来断开。 */
export type Watch = (id: string, onReading: (reading: Reading) => void) => () => void;
type Tab = "mbti" | "chinese" | "astro" | "tarot";
const TABS: [Tab, string][] = [
  ["mbti", "MBTI"],
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
  readings: number;
  mbti: number;
  mbtiDraft: boolean;
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

export function FortunePage({
  request,
  watch,
  connectChat,
  connectTasks,
}: {
  request: Request;
  watch: Watch;
  connectChat?: ConnectChat;
  connectTasks?: ConnectTasks;
}) {
  const [propose, setPropose] = useState<Propose>();
  useEffect(() => connectTasks?.((value) => setPropose(() => value)), [connectTasks]);
  const [chat, setChat] = useState<ChatDestination>();
  useEffect(() => connectChat?.(setChat), [connectChat]);
  const theme = useTheme();
  const embedded = new URLSearchParams(window.location.hash.slice(1)).get("kaitu-embed") === "1";
  const [tab, setTab] = useState<Tab>("mbti");
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
    if (!confirm("删除出生信息、抽牌记录、MBTI 答案和解读？删除后不能恢复。")) return;
    await request("deleteAll");
    setVersion((value) => value + 1);
    await load();
  };
  return (
    <ChatContext.Provider value={chat}>
      <TaskContext.Provider value={propose}>
        <div className={css.app} data-theme={theme} data-embed={embedded} lang="zh-CN">
          <main className={css.content} aria-busy={birth === undefined}>
            {!embedded && (
              <header className={css.pageTitle}>
                <h1>命理与星象</h1>
                <p>MBTI、中式命理、星盘与塔罗</p>
              </header>
            )}
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
              {tab !== "mbti" && birth && !editing && (
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
            {tab !== "mbti" &&
              (birth === undefined ? (
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
                birth && (
                  <p className={css.small}>{birthLine(birth)} · 只存在这台电脑上，不进开图资料，也不同步</p>
                )
              ))}
            <div
              key={version}
              className={css.panel}
              id="fortune-panel"
              role="tabpanel"
              aria-labelledby={`fortune-tab-${tab}`}
            >
              {tab === "mbti" && (
                <Mbti request={request} watch={watch} hasBirth={!!birth} onSaved={refreshStored} />
              )}
              {tab === "chinese" && (
                <Chinese
                  request={request}
                  watch={watch}
                  birth={birth ?? null}
                  candidate={candidate}
                  onCandidate={pick}
                  onSaved={refreshStored}
                />
              )}
              {tab === "astro" && (
                <Astro
                  request={request}
                  watch={watch}
                  birth={birth ?? null}
                  candidate={candidate}
                  theme={theme}
                  onSaved={refreshStored}
                />
              )}
              {tab === "tarot" && <Tarot request={request} watch={watch} onDrawn={refreshStored} />}
            </div>
            {stored && (
              <section className={css.card} aria-labelledby="fortune-stored">
                <div className={css.heading}>
                  <h2 id="fortune-stored">我的资料</h2>
                  <span>只在这台电脑上</span>
                </div>
                <p className={css.small}>
                  {birth ? "出生信息 1 份" : "没有出生信息"} · 抽牌、起卦记录 {stored.draws} 条 · 解读{" "}
                  {stored.readings} 条 · MBTI 记录 {stored.mbti} 条
                  {stored.mbtiDraft ? "（有未完成测试）" : ""} · 存放在 {stored.dir}
                </p>
                <p className={css.small}>
                  每条解读都连同当时发给模型的全文一起存着，包括盘面的计算结果，以及旧版「结合近况」当时带上的开图资料原文；删除单条解读或「删除我的资料」时一起删除。
                </p>
                <p className={css.small}>
                  MBTI 答案、类型和 AI
                  猜测也保存在插件目录。卸载插件不会删除资料；要清掉，请在卸载前点下面的按钮。
                </p>
                <p className={css.small}>
                  <a href="https://github.com/Stahl-G/dsh-kaitu-fortune" target="_blank" rel="noreferrer">
                    插件源码与许可
                  </a>
                </p>
                <div className={css.actions}>
                  <button
                    type="button"
                    className={css.button}
                    onClick={remove}
                    disabled={
                      !birth && !stored.draws && !stored.readings && !stored.mbti && !stored.mbtiDraft
                    }
                  >
                    删除我的资料
                  </button>
                </div>
              </section>
            )}
            <footer className={css.foot}>传统文化与自我反思参考</footer>
          </main>
        </div>
      </TaskContext.Provider>
    </ChatContext.Provider>
  );
}
