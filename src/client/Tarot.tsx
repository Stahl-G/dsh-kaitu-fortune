import { useState } from "react";
import type { Request } from "./App.js";
import css from "./Fortune.module.css";
import own from "./Tarot.module.css";

interface Drawn {
  position: string;
  card: { nameChinese: string; keywords: string[] };
  orientation: "upright" | "reversed";
  meaning: string;
  image: string;
}
interface Spread {
  drawId: string;
  spreadName: string;
  cards: Drawn[];
}

const SPREADS = [
  ["single", "单牌"],
  ["three-card", "过去 · 现在 · 未来"],
  ["decision", "两个选择"],
  ["celtic-cross", "凯尔特十字"],
] as const;

export function Tarot({ request }: { request: Request }) {
  const [spreadType, setSpreadType] = useState<string>("three-card");
  const [question, setQuestion] = useState("");
  const [spread, setSpread] = useState<Spread | null>(null);
  const [faces, setFaces] = useState<Record<number, string>>({});
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState("");

  const draw = async () => {
    setDrawing(true);
    setError("");
    setFaces({});
    try {
      setSpread(await request<Spread>("tarot", { spreadType, question: question.trim() || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDrawing(false);
    }
  };
  const reveal = async (index: number, image: string) => {
    if (faces[index]) return;
    const face = await request<string>("card", { image });
    setFaces((current) => ({ ...current, [index]: face }));
  };

  return (
    <>
      <section className={`${css.card} ${css.form}`}>
        <div className={css.heading}>
          <h2>抽牌</h2>
          <span>用系统随机数洗牌，每次抽到的牌都会存下来，可以回看</span>
        </div>
        <div className={css.choices} aria-label="牌阵">
          {SPREADS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={spreadType === key}
              onClick={() => setSpreadType(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          想问的事（可不填）
          <input value={question} maxLength={200} onChange={(e) => setQuestion(e.target.value)} />
        </label>
        <div className={css.actions}>
          <button type="button" className={`${css.button} ${css.primary}`} disabled={drawing} onClick={draw}>
            {drawing ? "正在洗牌…" : spread ? "重新抽" : "抽牌"}
          </button>
        </div>
      </section>
      {error && (
        <p className={css.notice} role="alert">
          {error}
        </p>
      )}
      {spread && (
        <section className={css.card}>
          <div className={css.heading}>
            <h2>{spread.spreadName}</h2>
            <span>点牌翻开</span>
          </div>
          <div className={own.table}>
            {spread.cards.map((item, index) => {
              const open = Boolean(faces[index]);
              return (
                <div key={`${spread.drawId}-${item.position}`} className={own.slot}>
                  <span className={css.small}>{item.position}</span>
                  <button
                    type="button"
                    className={own.flip}
                    aria-pressed={open}
                    aria-label={open ? item.card.nameChinese : `翻开「${item.position}」`}
                    onClick={() => void reveal(index, item.image)}
                  >
                    <div>
                      <span className={own.back} />
                      <span className={`${own.face} ${item.orientation === "reversed" ? own.reversed : ""}`}>
                        {open && <img src={faces[index]} alt="" />}
                      </span>
                    </div>
                  </button>
                  {open && (
                    <>
                      <b>
                        {item.card.nameChinese}
                        {item.orientation === "reversed" ? "（逆位）" : ""}
                      </b>
                      <span className={css.small}>{item.meaning.replace(/^[正逆]位：/, "")}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
