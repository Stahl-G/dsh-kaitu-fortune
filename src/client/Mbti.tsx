import { useCallback, useEffect, useState } from "react";
import type { MbtiRecord, MbtiState } from "../mbti.js";
import type { Request } from "./App.js";
import css from "./Fortune.module.css";
import own from "./Mbti.module.css";

const levels = ["完全偏向左边", "偏向左边", "稍偏左边", "两边差不多", "稍偏右边", "偏向右边", "完全偏向右边"];
const names = { E: "外向", I: "内向", S: "实感", N: "直觉", T: "思考", F: "情感", J: "判断", P: "知觉" };
export function MbtiResultCard({ record }: { record: MbtiRecord }) {
  return (
    <div className={own.result}>
      <div className={css.row}>
        <strong className={own.type}>{record.type}</strong>
        <span className={css.chip}>{record.source === "manual" ? "自己填写" : "问卷测出"}</span>
        <span className={css.small}>
          {new Date(record.createdAt).toLocaleString("zh-CN", { hour12: false })}
        </span>
      </div>
      {record.type.includes("X") && <p className={css.small}>X 表示这一维的回答持平，倾向尚不明显。</p>}
      {record.result && (
        <div className={own.dimensions}>
          {Object.entries(record.result.percentages).map(([key, values]) => {
            const [left, right] = Object.entries(values) as [keyof typeof names, number][];
            if (!left || !right) return null;
            return (
              <div key={key} className={own.dimension}>
                <span>
                  {left[0]} {names[left[0]]} {left[1]}%
                </span>
                <meter aria-label={key} min={0} max={100} value={left[1]} />
                <span>
                  {right[1]}% {names[right[0]]} {right[0]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Mbti({ request, onSaved }: { request: Request; onSaved: () => void }) {
  const [state, setState] = useState<MbtiState>();
  const [mode, setMode] = useState<"test" | "manual">("test");
  const [index, setIndex] = useState(0);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const next = await request<MbtiState>("mbti", { action: "state" });
      setState(next);
      setIndex(
        Math.max(
          0,
          next.questions.findIndex((q) => q.id === next.next?.id),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [request]);
  useEffect(() => {
    void load();
    const focus = () => void load();
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [load]);
  const act = async (input: object, advance = false) => {
    setBusy(true);
    setError("");
    try {
      const next = await request<MbtiState>("mbti", input);
      setState(next);
      setIndex(
        advance
          ? index + 1 >= next.total && next.next
            ? next.questions.findIndex((q) => q.id === next.next?.id)
            : Math.min(index + 1, next.total - 1)
          : 0,
      );
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const session = state?.session;
  const question = state?.questions[index];
  return (
    <>
      <section className={css.card} aria-labelledby="mbti-title">
        <div className={css.heading}>
          <h2 id="mbti-title">认识自己的性格倾向</h2>
          <span>答题与结果保存在这台电脑上</span>
        </div>
        <div className={css.choices}>
          <button type="button" aria-pressed={mode === "test"} onClick={() => setMode("test")}>
            自己测
          </button>
          <button type="button" aria-pressed={mode === "manual"} onClick={() => setMode("manual")}>
            直接填写
          </button>
        </div>
        {error && (
          <p role="alert" className={css.notice}>
            {error}
          </p>
        )}
        {!state ? (
          <p className={css.empty}>正在读取…</p>
        ) : mode === "manual" ? (
          <form
            className={own.manual}
            onSubmit={(event) => {
              event.preventDefault();
              void act({ action: "manual", type: manual });
            }}
          >
            <label className={css.form}>
              我的 MBTI 类型
              <input
                value={manual}
                onChange={(event) => setManual(event.target.value.toUpperCase())}
                placeholder="例如 INFP"
                maxLength={4}
                pattern="[EI][SN][TF][JP]"
                required
              />
            </label>
            <button
              className={css.button}
              type="submit"
              disabled={busy || !/^[EI][SN][TF][JP]$/.test(manual)}
            >
              保存类型
            </button>
          </form>
        ) : session && question ? (
          <div className={own.quiz}>
            <div className={css.heading}>
              <h3>
                第 {index + 1} / {state.total} 题
              </h3>
              <output>已答 {state.answered} 题 · 已自动保存</output>
            </div>
            <progress aria-label="答题进度" value={state.answered} max={state.total} />
            <h3>{question.question}</h3>
            <div className={own.poles}>
              <p>{question.choice_a.text}</p>
              <p>{question.choice_b.text}</p>
            </div>
            <fieldset className={own.scale} aria-label="选择更符合你的倾向">
              {levels.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  className={css.button}
                  title={label}
                  aria-label={`${i + 1} · ${label}`}
                  aria-pressed={session.answers[question.id] === i + 1}
                  disabled={busy}
                  onClick={() =>
                    void act(
                      { action: "answer", sessionId: session.id, questionId: question.id, value: i + 1 },
                      true,
                    )
                  }
                >
                  {i + 1}
                </button>
              ))}
            </fieldset>
            <div className={own.poles}>
              <span>偏向左边</span>
              <span>偏向右边</span>
            </div>
            <div className={css.actions}>
              <button
                type="button"
                className={css.button}
                disabled={busy || index === 0}
                onClick={() => setIndex(index - 1)}
              >
                上一题
              </button>
              <button
                type="button"
                className={css.button}
                disabled={busy || index >= state.total - 1}
                onClick={() => setIndex(index + 1)}
              >
                下一题
              </button>
              <button
                type="button"
                className={`${css.button} ${css.primary}`}
                disabled={busy || state.answered !== state.total}
                onClick={() => void act({ action: "finish", sessionId: session.id })}
              >
                查看结果
              </button>
              <button
                type="button"
                className={css.button}
                disabled={busy}
                onClick={() => {
                  if (confirm("放弃这次未完成的测试？已经保存的结果会保留。"))
                    void act({ action: "delete", id: session.id });
                }}
              >
                放弃这次
              </button>
            </div>
          </div>
        ) : (
          <div className={own.quiz}>
            <p>选择更符合平时自己的倾向，中途离开后可以继续。</p>
            <div className={css.actions}>
              <button
                type="button"
                className={`${css.button} ${css.primary}`}
                disabled={busy}
                onClick={() => void act({ action: "start", mode: "quick" })}
              >
                简版 · 28 题
              </button>
              <button
                type="button"
                className={css.button}
                disabled={busy}
                onClick={() => void act({ action: "start", mode: "full" })}
              >
                完整版 · 91 题
              </button>
            </div>
          </div>
        )}
      </section>
      {!!state?.records.length && (
        <section className={css.card} aria-labelledby="mbti-records">
          <div className={css.heading}>
            <h2 id="mbti-records">我的性格记录</h2>
            <span>问卷测出与自己填写分别保留</span>
          </div>
          <div className={css.panel}>
            {state.records.map((record) => (
              <article key={record.id}>
                <MbtiResultCard record={record} />
                <div className={css.actions}>
                  {record.session && (
                    <details className={own.answers}>
                      <summary>查看当时的答案</summary>
                      <p>题库版本：{record.session.version}</p>
                      <p>
                        {Object.entries(record.session.answers)
                          .map(([id, value]) => `第 ${id} 题：${value}`)
                          .join(" · ")}
                      </p>
                    </details>
                  )}
                  <button
                    type="button"
                    className={css.button}
                    disabled={busy}
                    onClick={() => void act({ action: "delete", id: record.id })}
                  >
                    删除这条记录
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
