import { expect, test } from "vitest";
import { type MBTIQuestion, calculateResult } from "../src/vendor/taibu-mbti.js";

test("两端分数为 1 和 7 时，显示比例互补，不会舍入成 101%", () => {
  const question: MBTIQuestion = {
    question: "Q",
    choice_a: { value: "E", text: "A" },
    choice_b: { value: "I", text: "B" },
  };
  const result = calculateResult(
    [question, question, question, question],
    [
      { questionIndex: 0, likertValue: 3 },
      { questionIndex: 1, likertValue: 7 },
      { questionIndex: 2, likertValue: 7 },
      { questionIndex: 3, likertValue: 5 },
    ],
  );
  expect(result.scores.E).toBe(1);
  expect(result.scores.I).toBe(7);
  expect(result.percentages.EI).toEqual({ E: 13, I: 87 });
});
