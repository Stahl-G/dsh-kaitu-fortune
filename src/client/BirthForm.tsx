import { useEffect, useState } from "react";
import type { Birth, BirthInput } from "../birth.js";
import type { City } from "../cities.js";
import type { Request } from "./App.js";
import css from "./Fortune.module.css";

const pad = (value: number) => String(value).padStart(2, "0");

export function BirthForm({
  request,
  birth,
  onSaved,
  onCancel,
}: {
  request: Request;
  birth: Birth | null;
  onSaved: (birth: Birth) => void;
  onCancel?: () => void;
}) {
  const [calendar, setCalendar] = useState(birth?.calendar ?? "solar");
  const [year, setYear] = useState(birth ? String(birth.year) : "");
  const [month, setMonth] = useState(birth ? String(birth.month) : "");
  const [day, setDay] = useState(birth ? String(birth.day) : "");
  const [leapMonth, setLeapMonth] = useState(birth?.leapMonth ?? false);
  const [exact, setExact] = useState(birth ? "hour" in birth.time : true);
  const [time, setTime] = useState(
    birth && "hour" in birth.time ? `${pad(birth.time.hour)}:${pad(birth.time.minute)}` : "",
  );
  const [from, setFrom] = useState(birth && "from" in birth.time ? birth.time.from : "");
  const [to, setTo] = useState(birth && "to" in birth.time ? birth.time.to : "");
  const [gender, setGender] = useState(birth?.gender ?? "female");
  const [city, setCity] = useState<City | null>(birth?.city ?? null);
  const [query, setQuery] = useState(birth?.city.zh ?? "");
  const [matches, setMatches] = useState<City[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (city && query === city.zh) return setMatches([]);
    if (!query.trim()) return setMatches([]);
    let active = true;
    void request<City[]>("cities", { query }).then((found) => active && setMatches(found));
    return () => {
      active = false;
    };
  }, [query, city, request]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!city) return setError("从列表里选一个出生城市");
    const [hour, minute] = time.split(":").map(Number) as [number, number];
    const input: BirthInput = {
      calendar,
      year: Number(year),
      month: Number(month),
      day: Number(day),
      leapMonth: calendar === "lunar" ? leapMonth : undefined,
      time: exact ? { hour, minute } : { from, to },
      gender,
      cityId: city.geonameid,
    };
    setSaving(true);
    setError("");
    try {
      onSaved(await request<Birth>("saveBirth", { birth: input }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={`${css.card} ${css.form}`} onSubmit={submit} aria-busy={saving}>
      <div className={css.heading}>
        <h2>出生信息</h2>
        <span>只存在这台电脑上，不进开图资料，也不同步</span>
      </div>
      <div className={css.choices} aria-label="历法">
        <button type="button" aria-pressed={calendar === "solar"} onClick={() => setCalendar("solar")}>
          公历
        </button>
        <button type="button" aria-pressed={calendar === "lunar"} onClick={() => setCalendar("lunar")}>
          农历
        </button>
      </div>
      <div className={css.fields}>
        <label>
          {calendar === "lunar" ? "农历年" : "出生年"}
          <input
            type="number"
            required
            min={1900}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </label>
        <label>
          月
          <input
            type="number"
            required
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <label>
          日
          <input
            type="number"
            required
            min={1}
            max={31}
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        {exact ? (
          <label>
            出生时间
            <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        ) : (
          <>
            <label>
              大约从
              <input type="time" required value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              到
              <input type="time" required value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </>
        )}
        <label>
          性别
          <select value={gender} onChange={(e) => setGender(e.target.value as Birth["gender"])}>
            <option value="female">女</option>
            <option value="male">男</option>
          </select>
        </label>
        <label>
          出生城市
          <input
            required
            value={query}
            placeholder="例如 上海、Chengdu"
            onChange={(e) => {
              setQuery(e.target.value);
              setCity(null);
            }}
          />
          {matches.length > 0 && (
            <div className={css.suggest}>
              {matches.map((item) => (
                <button
                  key={item.geonameid}
                  type="button"
                  onClick={() => {
                    setCity(item);
                    setQuery(item.zh);
                  }}
                >
                  <span>{item.zh}</span>
                  <span className={css.small}>
                    {item.name} · {item.country}
                  </span>
                </button>
              ))}
            </div>
          )}
        </label>
      </div>
      <div className={css.row}>
        {calendar === "lunar" && (
          <label className={css.check}>
            <input type="checkbox" checked={leapMonth} onChange={(e) => setLeapMonth(e.target.checked)} />
            闰月
          </label>
        )}
        <label className={css.check}>
          <input type="checkbox" checked={!exact} onChange={(e) => setExact(!e.target.checked)} />
          不确定具体时间，只记得大概范围
        </label>
      </div>
      {!exact && (
        <p className={css.small}>保存时会把范围里每种可能的时辰都排出来，你再挑一个；不会默认成子时。</p>
      )}
      {error && (
        <p className={css.notice} role="alert">
          {error}
        </p>
      )}
      <div className={css.actions}>
        <button type="submit" className={`${css.button} ${css.primary}`} disabled={saving}>
          {saving ? (exact ? "正在保存…" : "正在比较可能的时辰…") : "保存"}
        </button>
        {onCancel && (
          <button type="button" className={css.button} onClick={onCancel} disabled={saving}>
            取消
          </button>
        )}
      </div>
    </form>
  );
}
