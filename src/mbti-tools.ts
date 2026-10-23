import { mbtiAction } from "./mbti.js";
import type { FortuneTool } from "./tools.js";

export function mbtiTool(dir: string): FortuneTool {
  return {
    name: "fortune_mbti",
    description:
      "MBTI 本机测试，与插件页面共用进度。state 查看下一题和历史，start 开始 quick/full，answer 记录用户对两端描述的 1–7 回答，finish 答完后计分，manual 保存用户自己填写的类型，delete 删除指定记录或未完成测试。只记录用户的回答，AI 推测不要代填问卷或冒充用户填写。X 表示该轴平分。",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["state", "start", "answer", "finish", "manual", "delete"] },
        mode: { type: "string", enum: ["quick", "full"] },
        sessionId: { type: "string" },
        questionId: { type: "integer" },
        value: {
          type: "integer",
          minimum: 1,
          maximum: 7,
          description:
            "1 完全倾向 choice_a，2 较倾向 A，3 稍倾向 A，4 中立，5 稍倾向 B，6 较倾向 B，7 完全倾向 choice_b",
        },
        type: { type: "string", description: "用户自己提供的四字母类型" },
        id: { type: "string" },
      },
      required: ["action"],
    },
    async run(args) {
      const { session, next, answered, total, records } = mbtiAction(dir, args);
      return {
        sessionId: session?.id,
        mode: session?.mode,
        next,
        answered,
        total,
        records: records.map(({ session: _answers, ...record }) => record),
      };
    },
  };
}
