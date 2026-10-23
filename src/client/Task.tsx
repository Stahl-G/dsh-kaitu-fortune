import { createContext, useContext, useState } from "react";
import type { Propose } from "../tasks.js";
import css from "./Fortune.module.css";

export const TaskContext = createContext<Propose | undefined>(undefined);

export function ReadingTask({ readingId }: { readingId: string }) {
  const propose = useContext(TaskContext);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState("");
  const [error, setError] = useState("");
  if (!propose) return null;
  return (
    <div className={css.panel}>
      <div className={css.actions}>
        <button type="button" className={css.button} onClick={() => setEditing(!editing)}>
          放进今天
        </button>
        {receipt && <output className={css.small}>{receipt}</output>}
      </div>
      {editing && (
        <form
          className={css.panel}
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              await propose(title, readingId, due);
              setReceipt("已放到今天的 AI 建议，采纳后才成为待办");
              setEditing(false);
              setTitle("");
              setDue("");
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            确认一句具体行动
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="把解读中的行动写成一句可以执行的话"
            />
          </label>
          <label>
            日期（可不填）
            <input type="date" value={due} onChange={(event) => setDue(event.target.value)} />
          </label>
          {error && (
            <p role="alert" className={css.notice}>
              {error}
            </p>
          )}
          <div className={css.actions}>
            <button type="submit" className={`${css.button} ${css.primary}`} disabled={busy || !title.trim()}>
              {busy ? "正在提交…" : "提交为待采纳建议"}
            </button>
            <button type="button" className={css.button} onClick={() => setEditing(false)}>
              取消
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
