import { useContext, useEffect, useState } from "react";
import { readingChatDraft } from "../chat.js";
import type { Reading as Saved, Subject } from "../reading.js";
import type { Request, Watch } from "./App.js";
import { ChatContext } from "./Chat.js";
import css from "./Fortune.module.css";
import own from "./Reading.module.css";
import { ReadingTask } from "./Task.js";

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
 * 先把计算结果交给默认模型盲读，完成后可以带入新对话草稿，继续结合近况讨论。
 * 解读在插件后台跑，换标签页回来还在；每条连同发出去的全文一起存着，可以回看、删除。
 */
export function Reading({
  request,
  watch,
  subject,
  drawId,
  onSaved,
  historyOnly = false,
  mbtiInput,
}: {
  request: Request;
  watch: Watch;
  subject: Subject;
  drawId?: string;
  onSaved: () => void;
  historyOnly?: boolean;
  mbtiInput?: { description: string; charts: ("chinese" | "astro")[] };
}) {
  const [list, setList] = useState<Saved[]>([]);
  const [shown, setShown] = useState<Saved | null>(null);
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const chat = useContext(ChatContext);
  const [opening, setOpening] = useState(false);

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
    setPreparing(true);
    setError("");
    try {
      const reading = await request<Saved>("startReading", { subject, drawId, ...mbtiInput });
      setList((current) => [reading, ...current]);
      setShown(reading);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreparing(false);
    }
  };
  const remove = async (id: string) => {
    await request("deleteReading", { id });
    setList((current) => current.filter((item) => item.id !== id));
    if (shown?.id === id) setShown(null);
    onSaved();
  };
  const continueChat = async () => {
    if (!chat || !shown) return;
    setOpening(true);
    setError("");
    try {
      await chat.open(readingChatDraft(shown));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOpening(false);
    }
  };
  const earlier = list.filter((reading) => reading.id !== shown?.id);
  if (historyOnly && list.length === 0) return null;
  const guessing = subject === "mbti";
  const kindLabel = (kind: Saved["kind"]) =>
    kind === "guess" ? "AI 猜测" : kind === "context" ? "结合近况" : "盲读";
  const heading = `fortune-reading-${subject}${historyOnly ? "-history" : ""}`;

  return (
    <section className={css.card} aria-labelledby={heading}>
      <div className={css.heading}>
        <h2 id={heading}>{guessing ? "AI 猜我的 MBTI" : historyOnly ? "历史塔罗解读" : "请 AI 解读"}</h2>
        <span>
          {guessing
            ? "只参考上面提供的材料，保留猜测依据"
            : historyOnly
              ? "对应当时的抽牌，牌面与问题可在「发给模型的全文」回看"
              : "先只看计算结果做盲评，之后可以开新对话，补充问题再发送"}
        </span>
      </div>
      {shown ? (
        <>
          <p className={css.small}>
            {time(shown.createdAt)} · {kindLabel(shown.kind)} · {shown.model.model}
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
        <p className={css.small}>
          {guessing
            ? "写下自己的习惯与倾向，或选择想参考的命盘。"
            : "还没有解读过。解读分三段：计算事实、传统解读、可以想想的问题。"}
        </p>
      )}
      {error && (
        <p className={css.notice} role="alert">
          {error}
        </p>
      )}
      <div className={css.actions}>
        {!historyOnly && (
          <button
            type="button"
            className={`${css.button} ${css.primary}`}
            disabled={
              preparing ||
              shown?.status === "running" ||
              (subject === "tarot" && !drawId) ||
              (guessing && !mbtiInput?.description.trim() && !mbtiInput?.charts.length)
            }
            onClick={start}
          >
            {preparing
              ? "正在准备材料…"
              : shown?.status === "running"
                ? "正在解读…"
                : guessing
                  ? shown
                    ? "重新猜一次"
                    : "请 AI 猜一下"
                  : subject === "tarot" && !drawId
                    ? "先抽牌再解读"
                    : shown
                      ? "再做一次盲读"
                      : "请 AI 解读"}
          </button>
        )}
        {chat && shown && (shown.kind === "blind" || shown.kind === "guess") && shown.status === "done" && (
          <button type="button" className={css.button} disabled={opening} onClick={continueChat}>
            {opening ? "正在打开新对话…" : chat.label}
          </button>
        )}
        {shown && shown.status !== "running" && (
          <button type="button" className={css.button} onClick={() => void remove(shown.id)}>
            删除这条
          </button>
        )}
      </div>
      {shown?.status === "done" && <ReadingTask key={shown.id} readingId={shown.id} />}
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
                    setShown(reading);
                  }}
                >
                  {time(reading.createdAt)} · {kindLabel(reading.kind)} · {reading.model.model}
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
