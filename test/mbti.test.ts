import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { mbtiTool } from "../src/mbti-tools.js";
import { mbtiAction, mbtiQuestions, readMbti, scoreMbti } from "../src/mbti.js";
import { handle } from "../src/requests.js";
const dirs: string[] = [];
const home = () => {
  const dir = mkdtempSync(join(tmpdir(), "fortune-mbti-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("UI and Agent share resumable answers, edits replace an answer and only complete tests become records", async () => {
  const dir = home();
  const state = mbtiAction(dir, { action: "start", mode: "quick" });
  const sessionId = state.session?.id;
  const ids = state.questions.map((q) => q.id);
  expect(new Set(ids).size).toBe(28);
  for (const pair of ["EI", "SN", "TF", "JP"]) {
    expect(state.questions.filter((q) => pair.includes(q.choice_a.value))).toHaveLength(7);
  }
  expect(
    mbtiQuestions.every((q) =>
      ["EI", "IE", "SN", "NS", "TF", "FT", "JP", "PJ"].includes(q.choice_a.value + q.choice_b.value),
    ),
  ).toBe(true);
  await mbtiTool(dir).run({ action: "answer", sessionId, questionId: ids[0], value: 1 });
  await handle(dir, "mbti", { action: "answer", sessionId, questionId: ids[0], value: 7 });
  expect(readMbti(dir).session?.answers[ids[0] as number]).toBe(7);
  expect(() => mbtiAction(dir, { action: "finish", sessionId })).toThrow();
  expect(() => mbtiAction(dir, { action: "answer", sessionId, questionId: ids[1], value: 8 })).toThrow();
  expect(() => mbtiAction(dir, { action: "answer", sessionId, questionId: 75, value: 4 })).toThrow();
  for (const questionId of ids) mbtiAction(dir, { action: "answer", sessionId, questionId, value: 4 });
  const finished = mbtiAction(dir, { action: "finish", sessionId });
  expect(finished.session).toBeNull();
  expect(finished.records[0]?.type).toBe("XXXX");
  expect(finished.records[0]?.session?.questionIds).toEqual(ids);
  expect(Object.keys(finished.records[0]?.session?.answers ?? {})).toHaveLength(28);
  expect(() => mbtiAction(dir, { action: "finish", sessionId })).toThrow();
});

test("upstream weights respect reversed poles and neutral axes stay undecided", () => {
  // Q1 的 A 是 J，Q2 的 B 是 J；两题方向相反但应累加到同一端。
  const scored = scoreMbti([1, 2, 3, 4], { 1: 1, 2: 7, 3: 7, 4: 7 });
  expect(scored.type).toBe("INXJ");
  expect(scored.scores).toEqual({ E: 0, I: 3, S: 0, N: 3, T: 0, F: 0, J: 6, P: 0 });
});

test("manual records have no invented questionnaire scores and delete flows remove answers too", async () => {
  const dir = home();
  let state = mbtiAction(dir, { action: "manual", type: " infp " });
  expect(state.records[0]).toMatchObject({ type: "INFP", source: "manual" });
  expect(state.records[0]?.result).toBeUndefined();
  expect(() => mbtiAction(dir, { action: "manual", type: "ABCD" })).toThrow();
  const manualId = state.records[0]?.id;
  state = mbtiAction(dir, { action: "start", mode: "full" });
  const id = state.session?.id;
  state = mbtiAction(dir, { action: "delete", id: manualId });
  expect(state.records).toEqual([]);
  expect(state.session?.id).toBe(id);
  await handle(dir, "deleteAll", {});
  expect(readMbti(dir)).toEqual({ session: null, records: [] });
});
