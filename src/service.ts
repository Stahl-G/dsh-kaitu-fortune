import type { Context } from "@deepseek-ai/cordis";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import type { Readings } from "./reading.js";
import { handle } from "./requests.js";

declare module "@deepseek-ai/cordis" {
  interface Context {
    kaituFortune: FortuneService;
  }
}

/** 界面的入口：操作名加 JSON 参数，返回 JSON；解读另走一条流，边生成边推。 */
export class FortuneService extends TypertRemoteService {
  constructor(
    ctx: Context,
    private readonly dir: string,
    private readonly readings: Readings,
  ) {
    super(ctx, "kaituFortune");
  }
  @Remote("request")
  async request(operation: string, input: string): Promise<string> {
    return JSON.stringify(await handle(this.dir, operation, JSON.parse(input), this.readings));
  }
  /** 一条解读到目前为止的全文（JSON），还在生成时每多一段推一次。 */
  @Remote({ name: "watchReading", mode: "stream" })
  async *watchReading(id: string): AsyncIterable<string> {
    for await (const reading of this.readings.watch(id)) yield JSON.stringify(reading);
  }
}
