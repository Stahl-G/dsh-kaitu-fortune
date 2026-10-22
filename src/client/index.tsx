import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-api-remotes/client";
import type { MainPanelId } from "@deepseek-ai/dsh-client-ui-layout/client";
import type {} from "@deepseek-ai/dsh-client-ui-renderer/client";
import type {} from "@deepseek-ai/dsh-client-ui-sidebar/client";
import contribution from "../../lib/typert.remote-client.js";
import { FortunePage, type Request } from "./App.js";

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
      ctx.slots.inject("main", () =>
        ctx.slots.register({ name: "main", key: panel, inject: () => ({ request }) }, FortunePage),
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
