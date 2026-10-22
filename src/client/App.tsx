import { useCallback, useEffect, useState } from "react";
import type { Birth } from "../birth.js";
import { BirthForm } from "./BirthForm.js";
import css from "./Fortune.module.css";

export type Request = <T>(operation: string, input?: object) => Promise<T>;
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
  const [birth, setBirth] = useState<Birth | null | undefined>();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const state = await request<{ birth: Birth | null }>("state");
      setBirth(state.birth);
      setEditing(!state.birth);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [request]);
  useEffect(() => {
    void load();
  }, [load]);
  const remove = async () => {
    if (!confirm("删除出生信息、抽牌记录和解读？删除后不能恢复。")) return;
    await request("deleteAll");
    setBirth(null);
    setEditing(true);
  };
  return (
    <div className={css.app} data-theme={theme} lang="zh-CN">
      <main className={css.content} aria-busy={birth === undefined}>
        <header className={css.header}>
          <div>
            <h1>
              <span aria-hidden="true" />
              命理与星象
            </h1>
            <p>八字、紫微、黄历、星盘与塔罗，都在这台电脑上计算</p>
          </div>
          {birth && !editing && (
            <div className={css.actions}>
              <button type="button" className={css.button} onClick={() => setEditing(true)}>
                修改出生信息
              </button>
              <button type="button" className={css.button} onClick={remove}>
                删除我的资料
              </button>
            </div>
          )}
        </header>
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
        <footer className={css.foot}>传统文化与自我反思参考，不是预测。</footer>
      </main>
    </div>
  );
}
