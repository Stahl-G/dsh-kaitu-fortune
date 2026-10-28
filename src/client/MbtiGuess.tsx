import { useContext, useEffect, useRef, useState } from "react";
import { mbtiChatDraft } from "../chat.js";
import type { Request, Watch } from "./App.js";
import { ChatContext } from "./Chat.js";
import css from "./Fortune.module.css";
import own from "./Mbti.module.css";
import { Reading } from "./Reading.js";

export function MbtiGuess({
  request,
  watch,
  hasBirth,
  onSaved,
}: {
  request: Request;
  watch: Watch;
  hasBirth: boolean;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState("");
  const [charts, setCharts] = useState<("chinese" | "astro")[]>([]);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const active = useRef(true);
  const openingRef = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const chat = useContext(ChatContext);
  const open = async () => {
    if (!chat || openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    setError("");
    try {
      const materials =
        description.trim() || charts.length
          ? await request<string>("mbtiMaterials", { description, charts })
          : "";
      if (active.current) await chat.open(mbtiChatDraft(materials));
    } catch (err) {
      if (active.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      openingRef.current = false;
      if (active.current) setOpening(false);
    }
  };
  return (
    <>
      <section className={css.card}>
        <div className={css.heading}>
          <h2>让 AI 认识你</h2>
          <span>描述自己的倾向，也可以参考命盘</span>
        </div>
        <label className={css.form}>
          我平时是怎样的
          <textarea
            className={own.description}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="例如：独处后更有精神；做决定先列利弊；旅行时喜欢留白……"
            rows={4}
          />
        </label>
        {hasBirth && (
          <div className={css.actions}>
            {(["chinese", "astro"] as const).map((subject) => (
              <label key={subject} className={own.check}>
                <input
                  type="checkbox"
                  checked={charts.includes(subject)}
                  onChange={(event) =>
                    setCharts((current) =>
                      event.target.checked
                        ? [...current, subject]
                        : current.filter((item) => item !== subject),
                    )
                  }
                />
                {subject === "chinese" ? "参考八字与紫微" : "参考星盘"}
              </label>
            ))}
          </div>
        )}
        {chat && (
          <div className={own.quiz}>
            <p className={css.small}>想结合开图完整资料？把所选材料带到新对话，补充问题后再发送。</p>
            <button type="button" className={css.button} disabled={opening} onClick={() => void open()}>
              {opening ? "正在打开…" : "结合开图资料，开新对话"}
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className={css.notice}>
            {error}
          </p>
        )}
      </section>
      <Reading
        request={request}
        watch={watch}
        subject="mbti"
        mbtiInput={{ description, charts }}
        onSaved={onSaved}
      />
    </>
  );
}
