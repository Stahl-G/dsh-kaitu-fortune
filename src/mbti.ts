import { randomInt, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  type Dimension,
  type LikertValue,
  type MBTIQuestion,
  type TestResult,
  calculateResult,
} from "./vendor/taibu-mbti.js";

export const MBTI_VERSION = "taibu-f885fd1-fortune-1";
const raw = JSON.parse(
  readFileSync(new URL("../data/mbti/taibu-questions.json", import.meta.url), "utf8"),
) as MBTIQuestion[];
// 保留上游题号。73 的选项串题，75 把不同维度配成一题，核实原题前不计入测试。
export const mbtiQuestions = raw
  .map((q, index) => ({ id: index + 1, ...q }))
  .filter((q) => q.id !== 73 && q.id !== 75);
export const mbtiPairs = [
  ["E", "I"],
  ["S", "N"],
  ["T", "F"],
  ["J", "P"],
] as const;
export type MbtiResult = Omit<TestResult, "type"> & { type: string };
export interface MbtiSession {
  id: string;
  version: string;
  mode: "quick" | "full";
  questionIds: number[];
  answers: Record<number, LikertValue>;
  createdAt: string;
}
export interface MbtiRecord {
  id: string;
  source: "test" | "manual";
  type: string;
  createdAt: string;
  session?: MbtiSession;
  result?: MbtiResult;
}
interface Store {
  session: MbtiSession | null;
  records: MbtiRecord[];
}
const path = (dir: string) => join(dir, "mbti.json");
export function readMbti(dir: string): Store {
  return existsSync(path(dir)) ? JSON.parse(readFileSync(path(dir), "utf8")) : { session: null, records: [] };
}
function save(dir: string, state: Store) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path(dir), JSON.stringify(state, null, 2));
}
export function mbtiState(dir: string) {
  const state = readMbti(dir);
  const session = state.session;
  const questions = session
    ? session.questionIds.map(
        (id) => mbtiQuestions.find((q) => q.id === id) as (typeof mbtiQuestions)[number],
      )
    : [];
  return {
    ...state,
    questions,
    next: questions.find((q) => session?.answers[q.id] === undefined) ?? null,
    answered: session ? Object.keys(session.answers).length : 0,
    total: questions.length,
  };
}
export type MbtiState = ReturnType<typeof mbtiState>;

/** 使用上游七档权重，平分的轴明确保留 X，不替用户选一边。 */
export function scoreMbti(questionIds: number[], answers: Record<number, LikertValue>): MbtiResult {
  const questions = questionIds.map(
    (id) => mbtiQuestions.find((q) => q.id === id) as (typeof mbtiQuestions)[number],
  );
  const result = calculateResult(
    questions,
    questionIds.map((id, questionIndex) => ({
      questionIndex,
      likertValue: answers[id] as LikertValue,
    })),
  );
  const type = mbtiPairs
    .map(([a, b]) =>
      result.scores[a] === result.scores[b] ? "X" : result.scores[a] > result.scores[b] ? a : b,
    )
    .join("");
  return { ...result, type };
}
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("state") }),
  z.object({ action: z.literal("start"), mode: z.enum(["quick", "full"]) }),
  z.object({
    action: z.literal("answer"),
    sessionId: z.string(),
    questionId: z.number().int(),
    value: z.number().int().min(1).max(7),
  }),
  z.object({ action: z.literal("finish"), sessionId: z.string() }),
  z.object({
    action: z.literal("manual"),
    type: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[EI][SN][TF][JP]$/),
  }),
  z.object({ action: z.literal("delete"), id: z.string() }),
]);
export function mbtiAction(dir: string, input: unknown) {
  const args = inputSchema.parse(input);
  if (args.action === "state") return mbtiState(dir);
  const state = readMbti(dir);
  if (args.action === "start") {
    if (state.session) throw new Error("还有未完成的测试，可以继续或放弃后重测");
    let questions = mbtiQuestions;
    if (args.mode === "quick") {
      questions = mbtiPairs.flatMap((pair) => {
        const pool = mbtiQuestions.filter((q) => (pair as readonly Dimension[]).includes(q.choice_a.value));
        for (let i = pool.length - 1; i > 0; i--) {
          const j = randomInt(i + 1);
          [pool[i], pool[j]] = [pool[j] as (typeof pool)[number], pool[i] as (typeof pool)[number]];
        }
        return pool.slice(0, 7);
      });
    }
    state.session = {
      id: randomUUID(),
      version: MBTI_VERSION,
      mode: args.mode,
      questionIds: questions.map((q) => q.id),
      answers: {},
      createdAt: new Date().toISOString(),
    };
  } else if (args.action === "answer" || args.action === "finish") {
    const session = state.session;
    if (!session || session.id !== args.sessionId) throw new Error("这次测试已经结束，请刷新查看");
    if (args.action === "answer") {
      if (!session.questionIds.includes(args.questionId)) throw new Error("题目不属于这次测试");
      session.answers[args.questionId] = args.value as LikertValue;
    } else {
      if (session.questionIds.some((id) => session.answers[id] === undefined))
        throw new Error("请先答完所有题目");
      const result = scoreMbti(session.questionIds, session.answers);
      state.records.unshift({
        id: session.id,
        source: "test",
        type: result.type,
        result,
        session,
        createdAt: new Date().toISOString(),
      });
      state.session = null;
    }
  } else if (args.action === "manual") {
    state.records.unshift({
      id: randomUUID(),
      source: "manual",
      type: args.type,
      createdAt: new Date().toISOString(),
    });
  } else {
    if (state.session?.id === args.id) state.session = null;
    state.records = state.records.filter((record) => record.id !== args.id);
  }
  save(dir, state);
  return mbtiState(dir);
}
