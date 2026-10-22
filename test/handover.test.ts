import { expect, test } from "vitest";
import { composeRecent } from "../src/handover.js";

test("只组合用户选择的资料段，未选的人物不进入请求，取消全选没有可发送内容", () => {
  const pack = {
    header: "# 合成近况",
    footer: "资料包结尾",
    excluded: "接口排除说明",
    sections: [
      { id: "goals", title: "目标", lines: ["- 本周跑步两次"], defaultOn: true },
      { id: "people", title: "重要的人", lines: ["- 合成人物甲"], defaultOn: false },
    ],
  };
  expect(composeRecent(pack, ["goals"])).toBe("# 合成近况\n\n## 目标\n- 本周跑步两次\n\n资料包结尾");
  expect(composeRecent(pack, ["people"])).toBe("# 合成近况\n\n## 重要的人\n- 合成人物甲\n\n资料包结尾");
  expect(composeRecent(pack, [])).toBe("");
});
