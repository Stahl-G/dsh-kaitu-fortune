import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chartArgs, readBirth } from "./birth.js";
import { readDraw } from "./draws.js";
import { compute } from "./tools.js";

/** DSH 的模型服务（dsh-llm）里本插件用到的部分：准备一次调用，再流式拿回答。 */
export interface Chunk {
  type: string;
  text?: string;
  reason?: { kind: string; failure?: { message: string } };
}
export interface Llm {
  prepareCall(
    config: Route & { maxTokens?: number },
    signal?: AbortSignal,
  ): Promise<{ config: object; stream(options: object): AsyncIterable<Chunk> }>;
}
/** 用户在 DSH 里选的默认模型（dsh-agent-default-model 的 currentSelection）。 */
export interface Route {
  provider: string;
  model: string;
  reasoningEffort?: string;
}
export interface Model {
  llm: Llm;
  route(): Route;
}

export type Subject = "chinese" | "astro" | "tarot";
export interface Reading {
  id: string;
  kind: "blind" | "context";
  blindId?: string;
  subject: Subject;
  /** 塔罗是哪次抽牌。 */
  drawId?: string;
  createdAt: string;
  model: Route;
  /** 实际发给模型的全部内容，回看时可以核对里面有什么、没有什么。 */
  request: { system: string; user: string };
  text: string;
  status: "running" | "done" | "failed";
  error?: string;
}

const LABEL: Record<Subject, string> = {
  chinese: "八字和紫微斗数",
  astro: "西洋本命星盘",
  tarot: "塔罗抽牌",
};

export const SYSTEM = `你在「命理与星象」插件里做一次盲读：只看下面给出的计算结果，不知道这个人的任何其他情况。
这些结果由本机排盘引擎算出，是你唯一的事实依据。

用这三个小标题分三段写：
## 计算事实
只复述结果里已有的干支、星曜、宫位、星座相位或牌面，不补、不改，也不自己推算新的数据。
## 传统解读
按这门术数的传统说法解释上面的事实，每一点说明依据的是哪一项。
## 可以想想的问题
3 到 5 个帮助自我反思的问题。

边界：
- 页面已标明传统文化与自我反思参考，回答里不再添加免责文案。
- 不做医疗、投资、法律判断。涉及健康、钱、官司时，只说可以从哪些角度想。
- 不说宿命或吓人的话（例如「必有大灾」），用「可能的倾向」「值得留意的地方」这类说法。

用简体中文，全文 1000 字以内。`;

/** 交给模型的计算结果：和 DSH 里模型调工具拿到的结构化 JSON 相同。 */
async function facts(dir: string, subject: Subject, drawId?: string) {
  if (subject === "tarot") {
    const draw = readDraw(dir, String(drawId));
    const question = typeof draw.input.question === "string" ? `问题：${draw.input.question}\n` : "";
    return `${question}${JSON.stringify(await compute(draw.tool, draw.input))}`;
  }
  const birth = readBirth(dir);
  if (!birth) throw new Error("先填出生信息");
  // 时辰不确定时按用户挑定的那一种；还没挑会在这里报错
  const chart = chartArgs(birth);
  if (subject === "astro") {
    const { gender: _gender, ...input } = chart;
    return JSON.stringify(await compute("astrology", input));
  }
  const { latitude: _latitude, ...input } = chart;
  const [bazi, dayun, ziwei] = await Promise.all([
    compute("bazi", input),
    compute("bazi_dayun", input),
    compute("ziwei", input),
  ]);
  return JSON.stringify({ 八字: bazi, 大运: dayun, 紫微斗数: ziwei });
}

const folder = (dir: string) => join(dir, "readings");
const file = (dir: string, id: string) => {
  if (!/^\d{4}-\d{2}-\d{2}-[0-9a-f]{8}$/.test(id)) throw new Error("没有这条解读");
  return join(folder(dir), `${id}.json`);
};

/**
 * 解读在后台跑：开始后立刻返回，回答边生成边推给正在看的页面；换了标签页也不打断，
 * 跑完（或失败）才写进插件目录。
 */
export class Readings {
  private readonly running = new Map<
    string,
    { reading: Reading; controller: AbortController; listeners: Set<() => void> }
  >();
  private readonly preparing = new Set<AbortController>();
  model?: Model;

  constructor(private readonly dir: string) {}

  async start(subject: Subject, drawId?: string): Promise<Reading> {
    if (!this.model) throw new Error("DSH 里还没有可用的模型，先在设置里选一个模型");
    const controller = new AbortController();
    this.preparing.add(controller);
    let input: string;
    try {
      input = await facts(this.dir, subject, drawId);
      controller.signal.throwIfAborted();
    } finally {
      this.preparing.delete(controller);
    }
    return this.launch(
      subject,
      { system: SYSTEM, user: `这是${LABEL[subject]}的计算结果（JSON）：\n${input}` },
      { kind: "blind", ...(subject === "tarot" ? { drawId: String(drawId) } : {}) },
      controller,
    );
  }

  private launch(
    subject: Subject,
    request: Reading["request"],
    source: Pick<Reading, "kind" | "blindId" | "drawId">,
    controller = new AbortController(),
  ): Reading {
    if (!this.model) throw new Error("DSH 里还没有可用的模型，先在设置里选一个模型");
    const { llm } = this.model;
    const route = this.model.route();
    const createdAt = new Date().toISOString();
    const reading: Reading = {
      id: `${createdAt.slice(0, 10)}-${randomBytes(4).toString("hex")}`,
      ...source,
      subject,
      createdAt,
      model: route,
      request,
      text: "",
      status: "running",
    };
    const job = { reading, controller, listeners: new Set<() => void>() };
    this.running.set(reading.id, job);
    const notify = () => {
      for (const listener of job.listeners) listener();
    };
    void (async () => {
      try {
        const call = await llm.prepareCall(route, controller.signal);
        controller.signal.throwIfAborted();
        const stream = call.stream({
          ...call.config,
          system: reading.request.system,
          messages: [{ role: "user", content: [{ type: "text", text: reading.request.user }] }],
        });
        for await (const chunk of stream) {
          controller.signal.throwIfAborted();
          if (chunk.type === "text-delta" && chunk.text) {
            reading.text += chunk.text;
            notify();
          } else if (chunk.type === "finish" && chunk.reason?.failure) {
            throw new Error(chunk.reason.failure.message);
          }
        }
        controller.signal.throwIfAborted();
        reading.status = "done";
      } catch (error) {
        if (controller.signal.aborted) return;
        reading.status = "failed";
        reading.error = error instanceof Error ? error.message : String(error);
      }
      mkdirSync(folder(this.dir), { recursive: true });
      writeFileSync(file(this.dir, reading.id), JSON.stringify(reading, null, 2));
      this.running.delete(reading.id);
      notify();
    })();
    return reading;
  }

  /** 这条解读到目前为止的全文；还在生成时每多一段就再给一次，结束后停。 */
  async *watch(id: string): AsyncGenerator<Reading> {
    const job = this.running.get(id);
    if (!job) {
      yield this.read(id);
      return;
    }
    let wake = () => {};
    const listener = () => wake();
    job.listeners.add(listener);
    try {
      while (true) {
        const changed = new Promise<void>((resolve) => {
          wake = resolve;
        });
        yield { ...job.reading };
        if (job.reading.status !== "running") return;
        await changed;
      }
    } finally {
      job.listeners.delete(listener);
    }
  }

  read(id: string): Reading {
    return this.running.get(id)?.reading ?? (JSON.parse(readFileSync(file(this.dir, id), "utf8")) as Reading);
  }

  /** 回看列表：新的在前，正在生成的也列进来。 */
  list(subject?: Subject): Reading[] {
    const saved = existsSync(folder(this.dir))
      ? readdirSync(folder(this.dir))
          .filter((name) => name.endsWith(".json"))
          .map((name) => JSON.parse(readFileSync(join(folder(this.dir), name), "utf8")) as Reading)
      : [];
    return [...saved, ...[...this.running.values()].map((job) => job.reading)]
      .filter((reading) => !subject || reading.subject === subject)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  remove(id: string) {
    const job = this.running.get(id);
    if (job) {
      job.controller.abort();
      job.reading.status = "failed";
      job.reading.error = "解读已取消";
      job.reading.text = "";
      job.reading.request = { system: "", user: "" };
      this.running.delete(id);
      for (const listener of job.listeners) listener();
    }
    rmSync(file(this.dir, id), { force: true });
  }

  /** 清理前终止准备和生成中的调用；即使模型忽略取消继续返回，也不再存档。 */
  cancelAll() {
    for (const controller of this.preparing) controller.abort();
    for (const id of this.running.keys()) this.remove(id);
  }
}

export const countReadings = (dir: string) =>
  existsSync(folder(dir)) ? readdirSync(folder(dir)).filter((name) => name.endsWith(".json")).length : 0;
