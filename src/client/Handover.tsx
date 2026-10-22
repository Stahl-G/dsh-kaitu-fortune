import { createContext, useEffect, useState } from "react";
import css from "./Fortune.module.css";
import own from "./Reading.module.css";

import { type HandoverPack, type LoadHandover, composeRecent } from "../handover.js";
export type { ConnectHandover, HandoverPack, LoadHandover } from "../handover.js";
export const HandoverContext = createContext<LoadHandover | undefined>(undefined);

/** 只有用户打开选择器才取资料包，选定的分段原文会在发送前完整预览。 */
export function Handover({
  load,
  onSend,
  onCancel,
}: {
  load: LoadHandover;
  onSend: (text: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [pack, setPack] = useState<HandoverPack | null>(null);
  const [include, setInclude] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void load()
      .then((value) => {
        setPack(value);
        setInclude(
          value.sections
            .filter(
              (section) =>
                section.lines.length && section.defaultOn && !["people", "finance"].includes(section.id),
            )
            .map((section) => section.id),
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [load]);
  const text = pack ? composeRecent(pack, include) : "";
  return (
    <div className={own.context}>
      {!pack && !error && <p className={css.small}>正在整理近况…</p>}
      {pack && (
        <>
          <fieldset className={own.sections} disabled={busy}>
            <legend>这次带上哪些近况</legend>
            {pack.sections.map((section) => (
              <label key={section.id}>
                <input
                  type="checkbox"
                  checked={include.includes(section.id)}
                  disabled={!section.lines.length}
                  onChange={(event) =>
                    setInclude((current) =>
                      event.target.checked
                        ? [...current, section.id]
                        : current.filter((id) => id !== section.id),
                    )
                  }
                />
                {section.title} · {section.lines.length} 条
              </label>
            ))}
          </fieldset>
          <p className={css.small}>{pack.excluded}</p>
          <details className={own.sent} open>
            <summary>本次将发送的近况全文（{Array.from(text).length} 字符）</summary>
            <pre>{text || "还没有选择内容"}</pre>
          </details>
          <button
            type="button"
            className={`${css.button} ${css.primary}`}
            disabled={busy || !text}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await onSend(text);
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "正在开始解读…" : "带上这些近况解读"}
          </button>
        </>
      )}
      <button type="button" className={css.link} disabled={busy} onClick={onCancel}>
        取消
      </button>
      {error && (
        <p className={css.notice} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
