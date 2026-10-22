import { homedir } from "node:os";
import { join } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import type { TypertContribution } from "@deepseek-ai/dsh-typert-registry";
import { TYPERT } from "../lib/typert.host.js";
import { FortuneService } from "./service.js";
import { fortuneTools } from "./tools.js";

export const name = "kaitu-fortune";
export const inject = ["tools", "typert"];

interface Host {
  tools: { register(definition: object): () => void };
  typert: { register(contribution: TypertContribution): () => void };
}

/** 插件自己的本机目录：跟着 DSH 的 home 走（开图 App 是 ~/.kaitu-app），不进开图工作区。 */
export const dataDir = () => join(process.env.DSH_HOME?.trim() || join(homedir(), ".dsh"), "kaitu-fortune");

export function apply(ctx: Context) {
  const host = ctx as unknown as Host;
  new FortuneService(ctx, dataDir());
  ctx.effect(() => host.typert.register(TYPERT as TypertContribution));
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
