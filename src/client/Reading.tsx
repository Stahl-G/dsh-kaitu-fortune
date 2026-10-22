import { useContext, useEffect, useState } from "react";
import type { Reading as Saved, Subject } from "../reading.js";
import type { Request, Watch } from "./App.js";
import css from "./Fortune.module.css";
import { Handover, HandoverContext } from "./Handover.js";
import own from "./Reading.module.css";

const time = (iso: string) => new Date(iso).toLocaleString("zh-CN", { hour12: false }).slice(0, -3);

/** 回答是带「## 小标题」的纯文本：小标题单独成行，其余按空行分段。 */
function Body({ text }: { text: string }) {
  return (
    <div className={own.body}>
      {text.split(/\n{2,}|\n(?=## )/).flatMap((block, index) => {
        // 「## 小标题」那一行单独成标题，同一段里后面的文字照常是正文
        const [first = "", ...rest] = block.split("\n");
        const body = (first.startsWith("## ") ? rest.join("\n") : block).trim();
        return [
          // biome-ignore lint/suspicious/noArrayIndexKey: 段落只追加不重排
          first.startsWith("## ") && <h3 key={`h${index}`}>{first.slice(3).trim()}</h3>,
          // biome-ignore lint/suspicious/noArrayIndexKey: 段落只追加不重排
          body && <p key={`p${index}`}>{body}</p>,
        ];
      })}
    </div>
  );
}

/**
 * 先把计算结果交给默认模型盲读，完成后可以由用户选择资料包范围，再结合近况。
 * 解读在插件后台跑，换标签页回来还在；每条连同发出去的全文一起存着，可以回看、删除。
 */
export function Reading({
  request,
  watch,
  subject,
  drawId,
  onSaved,
  historyOnly = false,
}: {
  request: Request;
  watch: Watch;
  subject: Subject;
  drawId?: string;
  onSaved: () => void;
  historyOnly?: boolean;
}) {
  const [list, setList] = useState<Saved[]>([]);
  const [shown, setShown] = useState<Saved | null>(null);
  const [error, setError] = useState("");
  const loadHandover = useContext(HandoverContext);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    let active = true;
    void request<Saved[]>("readings", { subject }).then((value) => {
      if (!active) return;
      const matching =
        subject === "tarot"
          ? value.filter((reading) => (historyOnly ? reading.drawId !== drawId : reading.drawId === drawId))
          : value;
      setList(matching);
      setShown(matching[0] ?? null);
      onSaved();
    });
    return () => {
      active = false;
    };
  }, [request, subject, drawId, onSaved, historyOnly]);

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
    setChoosing(false);
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
  const contextual = async (context: string) => {
    const reading = await request<Saved>("contextReading", { blindId: shown?.id, context });
    setList((current) => [reading, ...current]);
    setShown(reading);
    setChoosing(false);
  };
  const earlier = list.filter((reading) => reading.id !== shown?.id);
  if (historyOnly && list.length === 0) return null;
  const heading = `fortune-reading-${subject}${historyOnly ? "-history" : ""}`;

  return (
    <section className={css.card} aria-labelledby={heading}>
      <div className={css.heading}>
        <h2 id={heading}>{historyOnly ? "历史塔罗解读" : "解读"}</h2>
        <span>
          {historyOnly
            ? "对应当时的抽牌，牌面与问题可在「发给模型的全文」回看"
            : "先只看计算结果做盲读，再由你选择是否结合近况"}
        </span>
      </div>
      {shown ? (
        <>
          <p className={css.small}>
            {time(shown.createdAt)} · {shown.kind === "context" ? "结合近况" : "盲读"} · {shown.model.model}
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
      {loadHandover && choosing && shown?.kind === "blind" && shown.status === "done" && (
        <Handover
          key={shown.id}
          load={loadHandover}
          onSend={contextual}
          onCancel={() => setChoosing(false)}
        />
      )}
      <div className={css.actions}>
        {!historyOnly && (
          <button
            type="button"
            className={`${css.button} ${css.primary}`}
            disabled={shown?.status === "running" || (subject === "tarot" && !drawId)}
            onClick={start}
          >
            {shown?.status === "running"
              ? "正在解读…"
              : subject === "tarot" && !drawId
                ? "先抽牌再解读"
                : shown
                  ? "再做一次盲读"
                  : "解读"}
          </button>
        )}
        {loadHandover && shown?.kind === "blind" && shown.status === "done" && !choosing && (
          <button type="button" className={css.button} onClick={() => setChoosing(true)}>
            结合我的近况
          </button>
        )}
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
                <button
                  type="button"
                  className={css.link}
                  onClick={() => {
                    setChoosing(false);
                    setShown(reading);
                  }}
                >
                  {time(reading.createdAt)} · {reading.kind === "context" ? "结合近况" : "盲读"} ·{" "}
                  {reading.model.model}
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
