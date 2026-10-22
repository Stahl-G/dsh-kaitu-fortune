import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WorkspaceTypertGenerator } from "@deepseek-ai/dsh-typert-generator";
import { build } from "esbuild";
import { transform } from "lightningcss";

const root = fileURLToPath(new URL("..", import.meta.url));
const modules = resolve(root, "node_modules");

// Typert 从源码里的 @Remote 生成宿主注册表和前端调用桩。在临时目录里搭一个
// 只含本插件和两个 SDK 声明包的工作区给生成器分析，不需要 DSH 源码。
const analysis = mkdtempSync(join(tmpdir(), "fortune-typert-"));
try {
  const pkg = resolve(analysis, "packages/kaitu-fortune");
  const sdk = ["dsh-typert-protocol", "dsh-typert-registry"];
  mkdirSync(resolve(pkg, "lib"), { recursive: true });
  cpSync(resolve(root, "src"), resolve(pkg, "src"), {
    recursive: true,
    filter: (path) => !path.includes("/client"),
  });
  // 生成器按 exports 找源码入口（lib/x.js 对应 src/x.ts）；临时目录里没有 dist，入口指到源码。
  const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const { "./client": _client, ...exports } = manifest.exports;
  manifest.exports = { ...exports, ".": "./lib/index.js" };
  writeFileSync(resolve(pkg, "package.json"), JSON.stringify(manifest));
  writeFileSync(resolve(pkg, "lib/typert.host.d.ts"), "export declare const TYPERT: unknown;\n");
  symlinkSync(modules, resolve(pkg, "node_modules"));
  for (const name of sdk) {
    const dir = resolve(analysis, "packages", name);
    cpSync(resolve(modules, `@deepseek-ai/${name}/lib/types`), resolve(dir, "src"), { recursive: true });
    writeFileSync(
      resolve(dir, "package.json"),
      JSON.stringify({ name: `@deepseek-ai/${name}`, exports: { ".": "./src/index.d.ts" } }),
    );
    symlinkSync(modules, resolve(dir, "node_modules"));
  }
  const options = JSON.parse(readFileSync(resolve(root, "tsconfig.json"), "utf8"));
  options.compilerOptions.noEmit = false;
  options.compilerOptions.declaration = true;
  options.compilerOptions.paths = Object.fromEntries(
    sdk.map((name) => [`@deepseek-ai/${name}`, [resolve(analysis, "packages", name, "src/index.d.ts")]]),
  );
  writeFileSync(
    resolve(analysis, "tsconfig.base.json"),
    JSON.stringify({ compilerOptions: options.compilerOptions }),
  );
  symlinkSync(modules, resolve(analysis, "node_modules"));
  for (const dir of [pkg, ...sdk.map((name) => resolve(analysis, "packages", name))])
    writeFileSync(
      resolve(dir, "tsconfig.json"),
      JSON.stringify({
        extends: "../../tsconfig.base.json",
        include: ["src/**/*.ts"],
        exclude: ["src/client"],
      }),
    );
  writeFileSync(
    resolve(analysis, "tsconfig.host.json"),
    JSON.stringify({
      extends: "./tsconfig.base.json",
      files: [],
      references: [{ path: "packages/kaitu-fortune" }, ...sdk.map((name) => ({ path: `packages/${name}` }))],
    }),
  );
  for (const artifact of new WorkspaceTypertGenerator(analysis).generate(["kaitu-fortune"], ["host"])) {
    mkdirSync(resolve(root, "lib"), { recursive: true });
    writeFileSync(resolve(root, "lib/typert.host.js"), artifact.js);
    writeFileSync(resolve(root, "lib/typert.host.d.ts"), artifact.dts);
    if (artifact.remote) {
      writeFileSync(resolve(root, "lib/typert.remote-client.js"), artifact.remote.js);
      writeFileSync(resolve(root, "lib/typert.remote-client.d.ts"), artifact.remote.dts);
    }
  }
} finally {
  rmSync(analysis, { recursive: true, force: true });
}

// 宿主：taibu-core 和它的依赖全部打进 dist，装插件时不用再装依赖，卸载也不留依赖。
await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  external: ["@deepseek-ai/cordis", "@deepseek-ai/dsh-typert-protocol"],
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

// 前端：React 由 DSH 提供；*.module.css 和 react-iztro 的样式收进一段字符串，随插件挂载、卸载。
const css = [];
const client = await build({
  entryPoints: ["src/client/index.tsx"],
  bundle: true,
  platform: "browser",
  format: "cjs",
  jsx: "automatic",
  write: false,
  target: "es2022",
  minify: true,
  legalComments: "none",
  external: ["react", "react/*", "@deepseek-ai/cordis"],
  plugins: [
    {
      name: "css",
      setup(b) {
        b.onLoad({ filter: /\.css$/ }, ({ path }) => {
          const module = path.endsWith(".module.css");
          const result = transform({
            filename: path,
            code: readFileSync(path),
            minify: true,
            cssModules: module ? { pattern: "kf_[local]_[hash]" } : false,
          });
          css.push(result.code.toString());
          const names = module
            ? Object.fromEntries(Object.entries(result.exports).map(([k, v]) => [k, v.name]))
            : {};
          return {
            contents: `export default ${JSON.stringify(names)}`,
            loader: "js",
            resolveDir: dirname(path),
          };
        });
      },
    },
  ],
  banner: {
    js: `window.__ModuleLoader__.load({id:"kaitu-fortune",factory:(require)=>{var module={exports:{}};var exports=module.exports;`,
  },
  footer: { js: "return module.exports;}});" },
});
writeFileSync(
  "dist/client.js",
  client.outputFiles[0].text.replace(
    "var exports=module.exports;",
    `var exports=module.exports;window.__kaituFortuneStyles=${JSON.stringify(css.join("\n"))};`,
  ),
);
