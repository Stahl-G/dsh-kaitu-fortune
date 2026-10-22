import { readFileSync } from "node:fs";
import { build } from "esbuild";

// taibu-core 和它的依赖全部打进 dist，装插件时不用再装依赖，卸载也不留依赖。
await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  external: ["@deepseek-ai/cordis"],
  legalComments: "none",
  plugins: [
    {
      // taibu 的星盘用 createRequire 动态加载这个 CJS 包，esbuild 看不到，改成静态 import 才能打进来。
      name: "static-horoscope",
      setup(b) {
        b.onLoad({ filter: /taibu-core\/dist\/domains\/astrology\/calculate\.js$/ }, ({ path }) => ({
          contents: readFileSync(path, "utf8").replace(
            "const horoscopePackage = require('circular-natal-horoscope-js');",
            "import horoscopePackage from 'circular-natal-horoscope-js';",
          ),
          loader: "js",
        }));
      },
    },
    {
      // pinyin 字典 7 MB，只有梅花易数字占用到；第一版不注册梅花，换成空模块。
      name: "no-pinyin",
      setup(b) {
        b.onResolve({ filter: /^pinyin$/ }, () => ({ path: "pinyin", namespace: "empty" }));
        b.onLoad({ filter: /.*/, namespace: "empty" }, () => ({
          contents: 'export const pinyin = () => { throw new Error("梅花字占未启用"); };',
        }));
      },
    },
  ],
  banner: {
    js: 'import { createRequire as __fortuneRequire } from "node:module"; const require=__fortuneRequire(import.meta.url);',
  },
});
