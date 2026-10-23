import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-api-remotes/client";
import type { MainPanelId } from "@deepseek-ai/dsh-client-ui-layout/client";
import type {} from "@deepseek-ai/dsh-client-ui-renderer/client";
import type {} from "@deepseek-ai/dsh-client-ui-sidebar/client";
import contribution from "../../lib/typert.remote-client.js";
import {
  type ConnectChat,
  type SessionServices,
  nativeChatDestination,
  openReadingSession,
} from "../chat.js";
import { type ConnectTasks, taskProposer } from "../tasks.js";
import { FortunePage, type Request, type Watch } from "./App.js";

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
      const connectChat: ConnectChat = (notify) => {
        const native = nativeChatDestination(window.location.hash);
        if (native) {
          notify(native);
          return () => notify();
        }
        const fiber = ctx.inject(
          ["remote.kaitu", "sessions", "workspaces", "conversation", "uiWorkspace"],
          (scope) => {
            const kaitu = scope.get("remote.kaitu") as {
              workspacePath(): Promise<
                { ok: true; value: string } | { ok: false; error: { message: string } }
              >;
            };
            notify({
              label: "结合近况，开新对话",
              async open(draft) {
                const result = await kaitu.workspacePath();
                if (!result.ok) throw new Error(result.error.message);
                await openReadingSession(
                  {
                    workspaces: scope.get("workspaces"),
                    sessions: scope.get("sessions"),
                    uiWorkspace: scope.get("uiWorkspace"),
                    conversation: scope.get("conversation"),
                    layout: ctx.layout,
                  } as SessionServices,
                  result.value,
                  draft,
                );
              },
            });
            scope.effect(() => () => notify());
          },
        );
        return () => {
          void fiber.dispose();
        };
      };
      const connectTasks: ConnectTasks = (notify) => {
        const fiber = ctx.inject(["remote.kaitu"], (scope) => {
          notify(taskProposer(scope.get("remote.kaitu") as Parameters<typeof taskProposer>[0]));
          scope.effect(() => () => notify());
        });
        return () => {
          void fiber.dispose();
        };
      };
      ctx.slots.inject("main", () =>
        ctx.slots.register(
          { name: "main", key: panel, inject: () => ({ request, watch, connectChat, connectTasks }) },
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
