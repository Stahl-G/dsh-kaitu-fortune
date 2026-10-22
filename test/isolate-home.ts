import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 测试只碰临时目录，不碰真实的 DSH home 和出生资料。
const home = mkdtempSync(join(tmpdir(), "fortune-test-home-"));
process.env.HOME = home;
process.env.DSH_HOME = join(home, ".dsh");
