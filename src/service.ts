import type { Context } from "@deepseek-ai/cordis";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { handle } from "./requests.js";

declare module "@deepseek-ai/cordis" {
  interface Context {
    kaituFortune: FortuneService;
  }
}

/** 界面的唯一入口：操作名加 JSON 参数，返回 JSON。 */
export class FortuneService extends TypertRemoteService {
  constructor(
    ctx: Context,
    private readonly dir: string,
  ) {
    super(ctx, "kaituFortune");
  }
  @Remote("request")
  async request(operation: string, input: string): Promise<string> {
    return JSON.stringify(await handle(this.dir, operation, JSON.parse(input)));
  }
}
