import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-api-remotes/client";
import type { MainPanelId } from "@deepseek-ai/dsh-client-ui-layout/client";
import type {} from "@deepseek-ai/dsh-client-ui-renderer/client";
import type {} from "@deepseek-ai/dsh-client-ui-sidebar/client";
import contribution from "../../lib/typert.remote-client.js";
import { FortunePage, type Request, type Watch } from "./App.js";
import type { ConnectHandover, HandoverPack } from "./Handover.js";

export const inject = ["slots", "remote", "layout"];
const panel = "kaitu-fortune" as MainPanelId;
declare global {
  interface Window {
    __kaituFortuneStyles: string;
  }
}

export async function apply(ctx: Context) {
  const style = document.createElement("style");
  style.textContent = window.__kaituFortuneStyles;
  document.head.append(style);
  ctx.effect(() => () => style.remove());
  const unmount = await ctx.remote.$mount(contribution);
  ctx.effect(() => unmount);
  ctx.plugin({
    inject: ["slots", "remote.kaituFortune"],
    apply(ctx: Context) {
      const request: Request = async <T,>(operation: string, input: object = {}) => {
        const result = await ctx.remote.kaituFortune.request(operation, JSON.stringify(input));
        if (!result.ok) throw new Error(result.error.message);
        return JSON.parse(result.value) as T;
      };
      const watch: Watch = (id, onReading) => {
        const stream = ctx.remote.kaituFortune.watchReading(id);
        void (async () => {
          for await (const item of stream) onReading(JSON.parse(item));
        })().catch(() => {});
        return () => stream.dispose();
      };
      const connectHandover: ConnectHandover = (notify) => {
        const fiber = ctx.inject(["remote.kaitu"], (scope) => {
          const kaitu = scope.get("remote.kaitu") as {
            handoverPack(
              locale: string,
              includeFinance?: boolean,
            ): Promise<{ ok: true; value: HandoverPack } | { ok: false; error: { message: string } }>;
          };
          notify(async () => {
            let result: Awaited<ReturnType<typeof kaitu.handoverPack>>;
            try {
              result = await kaitu.handoverPack("zh-CN");
            } catch (error) {
              // 已发行 Kaitu App 的接口还有 includeFinance 参数，传 false 沿用其财务授权规则。
              if (
                !(error instanceof Error) ||
                !error.message.includes("kaitu/handoverPack expected 2 argument(s), got 1")
              )
                throw error;
              result = await kaitu.handoverPack("zh-CN", false);
            }
            if (!result.ok) throw new Error(result.error.message);
            return result.value;
          });
          scope.effect(() => () => notify());
        });
        return () => {
          void fiber.dispose();
        };
      };
      ctx.slots.inject("main", () =>
        ctx.slots.register(
          { name: "main", key: panel, inject: () => ({ request, watch, connectHandover }) },
          FortunePage,
        ),
      );
      ctx.slots.inject("sidebar.panellist", () =>
        ctx.slots.register(
          { name: "sidebar.panellist", id: panel, order: 26, label: () => "命理与星象" },
          () => <span aria-hidden="true">命</span>,
        ),
      );
    },
  });
}
