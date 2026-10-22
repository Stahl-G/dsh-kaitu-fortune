import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { deleteAll, saveBirth } from "../src/birth.js";
import { searchCities } from "../src/cities.js";
import { type Chunk, type Llm, type Reading, Readings } from "../src/reading.js";
import { fortuneTools } from "../src/tools.js";

const route = { provider: "deepseek", model: "deepseek-chat" };
const delta = (text: string): Chunk => ({ type: "text-delta", text });
const all = async (stream: AsyncIterable<Reading>) => {
  const items: Reading[] = [];
  for await (const item of stream) items.push(item);
  return items;
};
function fake(chunks: Chunk[]) {
  const sent: object[] = [];
  const signals: (AbortSignal | undefined)[] = [];
  let release = () => {};
  let finish = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const llm: Llm = {
    async prepareCall(config, signal) {
      signals.push(signal);
      return {
        config,
        async *stream(options) {
          sent.push(options);
          try {
            if (chunks[0]) yield chunks[0];
            await gate;
            yield* chunks.slice(1);
          } finally {
            finish();
          }
        },
      };
    },
  };
  return { llm, sent, signals, release, finished };
}
const dir = () => mkdtempSync(join(tmpdir(), "fortune-reading-"));
async function withBirth() {
  const at = dir();
  await saveBirth(at, {
    calendar: "solar",
    year: 1990,
    month: 5,
    day: 15,
    time: { hour: 14, minute: 30 },
    gender: "male",
    cityId: searchCities("上海")[0]?.geonameid as number,
  });
  return at;
}

test("默认模型只收到排盘结果，边生成边推，完整请求和回答可回读并删除", async () => {
  const at = await withBirth();
  const readings = new Readings(at);
  const model = fake([delta("第一段"), delta("第二段")]);
  readings.model = { llm: model.llm, route: () => route };
  const started = await readings.start("chinese");
  const watching = readings.watch(started.id);
  let first = await watching.next();
  while (!first.done && !first.value.text) first = await watching.next();
  expect(first.value).toMatchObject({ status: "running", text: "第一段" });
  model.release();
  expect((await all(watching)).at(-1)).toMatchObject({ status: "done", text: "第一段第二段" });
  expect(model.sent[0]).not.toHaveProperty("tools");
  const messages = (model.sent[0] as { messages: { content: { text: string }[] }[] }).messages;
  expect(messages).toHaveLength(1);
  expect(messages[0]?.content[0]?.text).toContain("庚午");
  const saved = readings.read(started.id);
  expect(JSON.parse(readFileSync(join(at, "readings", `${started.id}.json`), "utf8"))).toEqual(saved);
  readings.remove(started.id);
  expect(readings.list()).toEqual([]);
});

test("没有模型时不启动；模型失败仍可回读原因和未完成的回答", async () => {
  const readings = new Readings(await withBirth());
  await expect(readings.start("astro")).rejects.toThrow();
  const model = fake([
    delta("已收到部分"),
    { type: "finish", reason: { kind: "error", failure: { message: "合成错误" } } },
  ]);
  readings.model = { llm: model.llm, route: () => route };
  const started = await readings.start("astro");
  model.release();
  await all(readings.watch(started.id));
  expect(readings.read(started.id)).toMatchObject({
    status: "failed",
    error: "合成错误",
    text: "已收到部分",
  });
});

test("删除会取消调用；即使模型继续返回，也不会重建资料；之后仍能重新生成", async () => {
  const at = await withBirth();
  const readings = new Readings(at);
  const model = fake([delta("第一段"), delta("迟到的内容")]);
  readings.model = { llm: model.llm, route: () => route };
  const started = await readings.start("chinese");
  const watching = readings.watch(started.id);
  await watching.next();
  readings.cancelAll();
  deleteAll(at);
  expect(model.signals[0]?.aborted).toBe(true);
  model.release();
  await model.finished;
  await all(watching);
  expect(readings.list()).toEqual([]);
  expect(existsSync(at)).toBe(false);
  const tarot = fortuneTools(at).find((tool) => tool.name === "fortune_tarot");
  const draw = (await tarot?.run({ spreadType: "single", question: "合成问题" })) as { drawId: string };
  const next = await readings.start("tarot", draw.drawId);
  await all(readings.watch(next.id));
  expect(readings.list().map((item) => item.id)).toEqual([next.id]);
  expect(readings.read(next.id).request.user).toContain("合成问题");
});

test("排盘准备时清理，尚未发出的模型请求不会再启动", async () => {
  const at = await withBirth();
  const readings = new Readings(at);
  const model = fake([delta("不会发出")]);
  readings.model = { llm: model.llm, route: () => route };
  const pending = readings.start("chinese");
  readings.cancelAll();
  deleteAll(at);
  await expect(pending).rejects.toThrow();
  expect(model.sent).toEqual([]);
  expect(readings.list()).toEqual([]);
  expect(existsSync(at)).toBe(false);
});
