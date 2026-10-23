import { expect, test, vi } from "vitest";
import { taskProposer } from "../src/tasks.js";

test("只提交确认的行动与来源，未指定日期不添加 due，旧宿主不提供入口", async () => {
  expect(taskProposer({})).toBeUndefined();
  const proposeTask = vi.fn(async () => ({ ok: true as const, value: { id: "suggestion" } }));
  const propose = taskProposer({ proposeTask });
  await propose?.("  做一次演示排练  ", "reading-id");
  expect(proposeTask).toHaveBeenLastCalledWith({ title: "做一次演示排练", source: "reading-id" });
  await propose?.("做一次演示排练", "reading-id", "2026-10-25");
  expect(proposeTask).toHaveBeenLastCalledWith({
    title: "做一次演示排练",
    source: "reading-id",
    due: "2026-10-25",
  });
});
