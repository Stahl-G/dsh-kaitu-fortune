// Adapted from hhszzzz/taibu @ f885fd1143a6cd4ca15c30ea946cf7e53a5c6a98
// Copyright (c) 2026 hhszzzz. SPDX-License-Identifier: AGPL-3.0-only
// Extracted 2026-10-23: types and deterministic scoring. Browser loading/UI omitted.
// Modified percentage rounding so each opposite pair totals 100.
// MBTI 四个维度
export type Dimension = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";

// 16种人格类型
export type MBTIType =
  | "INTJ"
  | "INTP"
  | "ENTJ"
  | "ENTP"
  | "INFJ"
  | "INFP"
  | "ENFJ"
  | "ENFP"
  | "ISTJ"
  | "ISFJ"
  | "ESTJ"
  | "ESFJ"
  | "ISTP"
  | "ISFP"
  | "ESTP"
  | "ESFP";

// 问题选项
export interface MBTIChoice {
  value: Dimension;
  text: string;
}

// 问题
export interface MBTIQuestion {
  question: string;
  choice_a: MBTIChoice;
  choice_b: MBTIChoice;
}

// Likert 量表值 (1=强烈同意A, 4=中立, 7=强烈同意B)
export type LikertValue = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// 测试答案 (使用 Likert 量表)
export interface TestAnswer {
  questionIndex: number;
  likertValue: LikertValue; // 1-7 量表值
}

// 测试结果
export interface TestResult {
  type: MBTIType;
  scores: {
    E: number;
    I: number;
    S: number;
    N: number;
    T: number;
    F: number;
    J: number;
    P: number;
  };
  percentages: {
    EI: { E: number; I: number };
    SN: { S: number; N: number };
    TF: { T: number; F: number };
    JP: { J: number; P: number };
  };
}

/**
 * Likert 量表权重映射
 * 1 = 强烈同意 choice_a (+3)
 * 2 = 同意 choice_a (+2)
 * 3 = 略同意 choice_a (+1)
 * 4 = 中立 (0)
 * 5 = 略同意 choice_b (+1)
 * 6 = 同意 choice_b (+2)
 * 7 = 强烈同意 choice_b (+3)
 */
const LIKERT_WEIGHTS: Record<LikertValue, { a: number; b: number }> = {
  1: { a: 3, b: 0 },
  2: { a: 2, b: 0 },
  3: { a: 1, b: 0 },
  4: { a: 0, b: 0 },
  5: { a: 0, b: 1 },
  6: { a: 0, b: 2 },
  7: { a: 0, b: 3 },
};

/**
 * 计算测试结果 (使用 Likert 加权计分)
 */
export function calculateResult(questions: MBTIQuestion[], answers: TestAnswer[]): TestResult {
  // 初始化分数
  const scores = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };

  // 统计每个维度的加权分数
  for (const answer of answers) {
    const question = questions[answer.questionIndex];
    if (!question) continue;

    const weights = LIKERT_WEIGHTS[answer.likertValue];
    const dimA = question.choice_a.value as Dimension;
    const dimB = question.choice_b.value as Dimension;

    scores[dimA] += weights.a;
    scores[dimB] += weights.b;
  }

  // 确定每个维度的倾向
  const type = [
    scores.E >= scores.I ? "E" : "I",
    scores.S >= scores.N ? "S" : "N",
    scores.T >= scores.F ? "T" : "F",
    scores.J >= scores.P ? "J" : "P",
  ].join("") as MBTIType;

  // 计算百分比
  const calcPercent = (a: number, b: number) => {
    const total = a + b;
    if (total === 0) return { a: 50, b: 50 };
    const first = Math.round((a / total) * 100);
    return { a: first, b: 100 - first };
  };

  const eiPercent = calcPercent(scores.E, scores.I);
  const snPercent = calcPercent(scores.S, scores.N);
  const tfPercent = calcPercent(scores.T, scores.F);
  const jpPercent = calcPercent(scores.J, scores.P);

  return {
    type,
    scores,
    percentages: {
      EI: { E: eiPercent.a, I: eiPercent.b },
      SN: { S: snPercent.a, N: snPercent.b },
      TF: { T: tfPercent.a, F: tfPercent.b },
      JP: { J: jpPercent.a, P: jpPercent.b },
    },
  };
}
