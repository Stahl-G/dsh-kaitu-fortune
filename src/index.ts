import { homedir } from "node:os";
import { join } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import { FortuneService } from "./service.js";
import { fortuneTools } from "./tools.js";

export const name = "kaitu-fortune";
export const inject = ["tools"];

interface Host {
  tools: { register(definition: object): () => void };
}

/** 插件自己的本机目录：跟着 DSH 的 home 走（开图 App 是 ~/.kaitu-app），不进开图工作区。 */
export const dataDir = () => join(process.env.DSH_HOME?.trim() || join(homedir(), ".dsh"), "kaitu-fortune");

export function apply(ctx: Context) {
  const host = ctx as unknown as Host;
  // 界面接口的登记由 DSH 的 typert-loader 按 package.json 的 ./typert 导出自动完成，这里只建服务。
  new FortuneService(ctx, dataDir());
  for (const tool of fortuneTools(dataDir()))
    ctx.effect(() =>
      host.tools.register({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        output: {
          schema: { type: "object", additionalProperties: true },
          render: (_args: unknown, value: unknown) => [{ type: "text", text: JSON.stringify(value) }],
        },
        async execute(args: unknown, exec: { signal: AbortSignal }) {
          exec.signal.throwIfAborted();
          return tool.run(args as Record<string, unknown>);
        },
      }),
    );
}
