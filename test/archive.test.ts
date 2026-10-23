import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { Readings } from "../src/reading.js";
import { handle } from "../src/requests.js";

test("旧综合解读回读包含近况原文，删单条和删全部都清除对应原文文件", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fortune-archive-"));
  mkdirSync(join(dir, "readings"));
  const readings = new Readings(dir);
  for (const id of ["2026-10-23-1234abcd", "2026-10-23-5678abcd"])
    writeFileSync(
      join(dir, "readings", `${id}.json`),
      JSON.stringify({
        id,
        kind: "context",
        subject: "chinese",
        createdAt: "2026-10-23T00:00:00Z",
        model: { provider: "fixture", model: "fixture" },
        status: "done",
        text: "合成综合解读",
        request: { system: "fixture", user: "【本次选择的近况原文】\n本周要完成青杉演示。" },
      }),
    );
  const rows = readings.list();
  expect(rows).toHaveLength(2);
  expect(rows[0]?.request.user).toContain("本周要完成青杉演示。");
  await handle(dir, "deleteReading", { id: "2026-10-23-1234abcd" }, readings);
  expect(existsSync(join(dir, "readings", "2026-10-23-1234abcd.json"))).toBe(false);
  expect(readings.list()).toHaveLength(1);
  await handle(dir, "deleteAll", {}, readings);
  expect(readings.list()).toEqual([]);
  expect(existsSync(join(dir, "readings")) ? readdirSync(join(dir, "readings")) : []).toEqual([]);
});
