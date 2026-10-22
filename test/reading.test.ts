import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { saveBirth } from "../src/birth.js";
import { searchCities } from "../src/cities.js";
import { type Chunk, type Llm, type Reading, Readings } from "../src/reading.js";
import { handle } from "../src/requests.js";

const dir = () => mkdtempSync(join(tmpdir(), "fortune-reading-"));
const route = { provider: "deepseek", model: "deepseek-chat" };

/** DSH 模型服务的替身：记下收到的请求，按给定的分片流式回答；release 之前停在第一段之后。 */
function fakeLlm(chunks: Chunk[]) {
  const sent: object[] = [];
  const signals: (AbortSignal | undefined)[] = [];
  let release = () => {};
  let finish = () => {};
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const llm: Llm = {
    async prepareCall(config, signal) {
      signals.push(signal);
      return {
        config: { ...config, maxTokens: 8000 },
        async *stream(options) {
          try {
            sent.push(options);
            const [first, ...rest] = chunks;
            if (first) yield first;
            await gate;
            yield* rest;
          } finally {
            finish();
          }
        },
      };
    },
  };
  return { llm, sent, signals, release, finished };
}
const delta = (text: string) => ({ type: "text-delta", index: 0, text });
const all = async (stream: AsyncIterable<Reading>) => {
  const items: Reading[] = [];
  for await (const item of stream) items.push(item);
  return items;
};

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

test("盲读：只把排盘结果交给默认模型，边生成边推，跑完连同发出的全文存档；可以删", async () => {
  const at = await withBirth();
  const readings = new Readings(at);
  const { llm, sent, release } = fakeLlm([
    delta("## 计算事实\n"),
    delta("日主庚金。"),
    { type: "finish", reason: { kind: "stop" } },
  ]);
  readings.model = { llm, route: () => route };

  const started = (await handle(at, "startReading", { subject: "chinese" }, readings)) as { id: string };
  const seen: string[] = [];
  const watching = (async () => {
    for await (const reading of readings.watch(started.id)) seen.push(`${reading.status}:${reading.text}`);
  })();
  await new Promise((resolve) => setTimeout(resolve, 10));
  // 第一段已经推到页面，后面的还没来
  expect(seen.at(-1)).toBe("running:## 计算事实\n");
  release();
  await watching;
  expect(seen.at(-1)).toBe("done:## 计算事实\n日主庚金。");

  // 发给模型的只有提示词和这张盘的计算结果
  expect(sent).toHaveLength(1);
  const options = sent[0] as { system: string; messages: { role: string; content: { text: string }[] }[] };
  expect(options).toMatchObject({ provider: "deepseek", model: "deepseek-chat", maxTokens: 8000 });
  expect(options.messages).toHaveLength(1);
  const user = options.messages[0]?.content[0]?.text ?? "";
  expect(user).toMatch(/^这是八字和紫微斗数的计算结果/);
  expect(user).toContain("庚午");

  const [saved] = (await handle(at, "readings", { subject: "chinese" }, readings)) as {
    id: string;
    status: string;
    request: { user: string };
  }[];
  expect(saved).toMatchObject({ id: started.id, status: "done", request: { user } });
  expect(JSON.parse(readFileSync(join(at, "readings", `${started.id}.json`), "utf8")).text).toBe(
    "## 计算事实\n日主庚金。",
  );
  expect(await handle(at, "state", {})).toMatchObject({ stored: { readings: 1 } });

  await handle(at, "deleteReading", { id: started.id }, readings);
  expect(await handle(at, "readings", {}, readings)).toEqual([]);
  expect(await handle(at, "state", {})).toMatchObject({ stored: { readings: 0 } });
});

test("生成中删除全部资料会取消调用，模型迟到的回答不会重新建目录或恢复解读", async () => {
  const at = await withBirth();
  const readings = new Readings(at);
  // 替身故意忽略 signal，释放后还会继续返回内容。
  const fake = fakeLlm([delta("第一段"), delta("删除后到达的内容")]);
  readings.model = { llm: fake.llm, route: () => route };
  const started = await readings.start("chinese");
  const watching = readings.watch(started.id);
  await watching.next();
  await handle(at, "deleteAll", {}, readings);
  expect(fake.signals[0]?.aborted).toBe(true);
  expect(readings.list()).toEqual([]);
  expect(existsSync(at)).toBe(false);
  fake.release();
  await fake.finished;
  await all(watching);
  expect(existsSync(at)).toBe(false);
  expect(await handle(at, "readings", {}, readings)).toEqual([]);
  // 清理不会让插件失去再次生成和保存的能力。
  await saveBirth(at, {
    calendar: "solar",
    year: 1990,
    month: 5,
    day: 15,
    time: { hour: 14, minute: 30 },
    gender: "male",
    cityId: searchCities("上海")[0]?.geonameid as number,
  });
  const next = await readings.start("astro");
  await all(readings.watch(next.id));
  expect(readings.list().map((reading) => reading.id)).toEqual([next.id]);
});

test("排盘准备期间删除资料，尚未开始的模型调用不会发出", async () => {
  const at = await withBirth();
  const readings = new Readings(at);
  const fake = fakeLlm([delta("不会发送")]);
  readings.model = { llm: fake.llm, route: () => route };
  const pending = readings.start("chinese");
  await handle(at, "deleteAll", {}, readings);
  await expect(pending).rejects.toThrow();
  expect(fake.sent).toEqual([]);
  expect(readings.list()).toEqual([]);
  expect(existsSync(at)).toBe(false);
});

test("模型报错时存成没完成的一条，写明原因；没有模型服务时直接说明", async () => {
  const at = await withBirth();
  const readings = new Readings(at);
  await expect(readings.start("chinese")).rejects.toThrow("还没有可用的模型");

  const { llm, release } = fakeLlm([
    delta("## 计算"),
    { type: "finish", reason: { kind: "error", failure: { message: "请求太频繁" } } },
  ]);
  readings.model = { llm, route: () => route };
  const started = await readings.start("astro");
  release();
  const last = (await all(readings.watch(started.id))).at(-1);
  expect(last).toMatchObject({ status: "failed", error: "请求太频繁", text: "## 计算" });
  expect(readings.read(started.id)).toMatchObject({ status: "failed", subject: "astro" });
  expect(last?.request.user).toMatch(/^这是西洋本命星盘的计算结果/);
});

test("塔罗解读用这次抽到的牌和当时问的事；一键删除连解读一起清掉", async () => {
  const at = dir();
  const readings = new Readings(at);
  const { llm, sent, release } = fakeLlm([delta("好"), { type: "finish", reason: { kind: "stop" } }]);
  readings.model = { llm, route: () => route };
  const spread = (await handle(at, "tarot", { spreadType: "single", question: "换工作" })) as {
    drawId: string;
    cards: { card: { nameChinese: string } }[];
  };
  const started = await readings.start("tarot", spread.drawId);
  release();
  await all(readings.watch(started.id));
  const user = (sent[0] as { messages: { content: { text: string }[] }[] }).messages[0]?.content[0]?.text;
  expect(user).toMatch(/^这是塔罗抽牌的计算结果（JSON）：\n问题：换工作\n/);
  expect(user).toContain(spread.cards[0]?.card.nameChinese);
  expect(readings.list("tarot")[0]).toMatchObject({ drawId: spread.drawId, status: "done" });

  await handle(at, "deleteAll", {});
  expect(existsSync(join(at, "readings"))).toBe(false);
});

test("结合近况沿用选定盲读，实际发送原文同存；删除该解读不影响原盲读，删除全部清掉两者", async () => {
  const at = await withBirth();
  const readings = new Readings(at);
  const fake = fakeLlm([delta("合成解读")]);
  fake.release();
  readings.model = { llm: fake.llm, route: () => route };
  const blind = await readings.start("chinese");
  await all(readings.watch(blind.id));
  const context = "# 合成资料包\n\n## 正在推进的目标\n- 本周跑步两次";
  const contextual = (await handle(
    at,
    "contextReading",
    { blindId: blind.id, context },
    readings,
  )) as Reading;
  await all(readings.watch(contextual.id));
  const options = fake.sent[1] as { messages: { content: { text: string }[] }[]; tools?: unknown };
  const user = options.messages[0]?.content[0]?.text ?? "";
  expect(options.tools).toBeUndefined();
  expect(options.messages).toHaveLength(1);
  expect(user.endsWith(context)).toBe(true);
  expect(user).toContain(blind.request.user);
  expect(user).toContain(blind.text);
  expect(readings.read(contextual.id)).toMatchObject({
    kind: "context",
    blindId: blind.id,
    request: { user },
  });
  expect(JSON.parse(readFileSync(join(at, "readings", `${contextual.id}.json`), "utf8")).request.user).toBe(
    user,
  );
  await handle(at, "deleteReading", { id: contextual.id }, readings);
  expect(existsSync(join(at, "readings", `${contextual.id}.json`))).toBe(false);
  expect(readings.list().map((item) => item.id)).toEqual([blind.id]);
  readings.contextual(blind.id, context);
  await handle(at, "deleteAll", {}, readings);
  expect(existsSync(at)).toBe(false);
});
