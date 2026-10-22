import { useEffect, useState } from "react";
import type { Reading as Saved, Subject } from "../reading.js";
import type { Request, Watch } from "./App.js";
import css from "./Fortune.module.css";
import own from "./Reading.module.css";

const time = (iso: string) => new Date(iso).toLocaleString("zh-CN", { hour12: false }).slice(0, -3);

/** 回答是带「## 小标题」的纯文本：小标题单独成行，其余按空行分段。 */
function Body({ text }: { text: string }) {
  return (
    <div className={own.body}>
      {text.split(/\n{2,}|\n(?=## )/).map((block, index) =>
        block.startsWith("## ") ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: 段落只追加不重排
          <h3 key={index}>{block.slice(3).trim()}</h3>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: 段落只追加不重排
          <p key={index}>{block.trim()}</p>
        ),
      )}
    </div>
  );
}

/**
 * 盲读：把上面这张盘（或这次抽牌）的计算结果交给 DSH 的默认模型，不带开图资料。
 * 解读在插件后台跑，换标签页回来还在；每条连同发出去的全文一起存着，可以回看、删除。
 */
export function Reading({
  request,
  watch,
  subject,
  drawId,
  onSaved,
}: {
  request: Request;
  watch: Watch;
  subject: Subject;
  drawId?: string;
  onSaved: () => void;
}) {
  const [list, setList] = useState<Saved[]>([]);
  const [shown, setShown] = useState<Saved | null>(null);
  const [error, setError] = useState("");
  const mine = (reading: Saved) => subject !== "tarot" || reading.drawId === drawId;

  useEffect(() => {
    let active = true;
    void request<Saved[]>("readings", { subject }).then((value) => {
      if (!active) return;
      setList(value);
      setShown(value.find((reading) => subject !== "tarot" || reading.drawId === drawId) ?? null);
    });
    return () => {
      active = false;
    };
  }, [request, subject, drawId]);

  // 正在生成的那条：接上推送，跑完把列表里的这一条换成存档后的样子
  const running = shown?.status === "running" ? shown.id : null;
  useEffect(() => {
    if (!running) return;
    return watch(running, (reading) => {
      setShown(reading);
      setList((current) => current.map((item) => (item.id === reading.id ? reading : item)));
      if (reading.status !== "running") onSaved();
    });
  }, [running, watch, onSaved]);

  const start = async () => {
    setError("");
    try {
      const reading = await request<Saved>("startReading", { subject, drawId });
      setList((current) => [reading, ...current]);
      setShown(reading);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const remove = async (id: string) => {
    await request("deleteReading", { id });
    setList((current) => current.filter((item) => item.id !== id));
    if (shown?.id === id) setShown(null);
    onSaved();
  };
  const earlier = list.filter((reading) => mine(reading) && reading.id !== shown?.id);

  return (
    <section className={css.card} aria-labelledby={`fortune-reading-${subject}`}>
      <div className={css.heading}>
        <h2 id={`fortune-reading-${subject}`}>解读</h2>
        <span>只把上面的计算结果交给 DSH 的默认模型，不带开图里的任何资料</span>
      </div>
      {shown ? (
        <>
          <p className={css.small}>
            {time(shown.createdAt)} · {shown.model.model}
            {shown.status === "running" && " · 正在解读…"}
          </p>
          {shown.text ? (
            <Body text={shown.text} />
          ) : (
            shown.status === "running" && <p className={css.empty}>正在等模型回答…</p>
          )}
          {shown.status === "failed" && (
            <p className={css.notice} role="alert">
              没有解读完：{shown.error}
            </p>
          )}
          <details className={own.sent}>
            <summary>发给模型的全文</summary>
            <pre>{`${shown.request.system}\n\n${shown.request.user}`}</pre>
          </details>
        </>
      ) : (
        <p className={css.small}>还没有解读过。解读分三段：计算事实、传统解读、可以想想的问题。</p>
      )}
      {error && (
        <p className={css.notice} role="alert">
          {error}
        </p>
      )}
      <div className={css.actions}>
        <button
          type="button"
          className={`${css.button} ${css.primary}`}
          disabled={shown?.status === "running"}
          onClick={start}
        >
          {shown?.status === "running" ? "正在解读…" : shown ? "再解读一次" : "解读"}
        </button>
        {shown && shown.status !== "running" && (
          <button type="button" className={css.button} onClick={() => void remove(shown.id)}>
            删除这条
          </button>
        )}
      </div>
      {earlier.length > 0 && (
        <details className={own.earlier}>
          <summary>以前的解读（{earlier.length}）</summary>
          <ul>
            {earlier.map((reading) => (
              <li key={reading.id}>
                <button type="button" className={css.link} onClick={() => setShown(reading)}>
                  {time(reading.createdAt)} · {reading.model.model}
                  {reading.status === "failed" ? " · 没有完成" : ""}
                </button>
                <button type="button" className={css.link} onClick={() => void remove(reading.id)}>
                  删除
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
