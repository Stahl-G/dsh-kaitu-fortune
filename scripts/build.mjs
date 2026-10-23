import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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
const host = await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  external: ["@deepseek-ai/cordis", "@deepseek-ai/dsh-typert-protocol"],
  legalComments: "none",
  metafile: true,
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

// 前端：React 由 DSH 提供；*.module.css 的样式收进一段字符串，随插件挂载、卸载。
// 样式文件是并行加载的，按路径记下，最后按固定顺序拼：公共的 Fortune.module.css 在前，各面板的在后
const css = new Map();
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
  metafile: true,
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
          css.set(path, result.code.toString());
          const names = module
            ? Object.fromEntries(
                Object.entries(result.exports)
                  .sort()
                  .map(([k, v]) => [k, v.name]),
              )
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
    `var exports=module.exports;window.__kaituFortuneStyles=${JSON.stringify(
      [...css]
        .sort(
          ([a], [b]) =>
            Number(!a.endsWith("/Fortune.module.css")) - Number(!b.endsWith("/Fortune.module.css")) ||
            a.localeCompare(b),
        )
        .map(([, code]) => code)
        .join("\n"),
    )};`,
  ),
);

// 打包时去掉了源码里的版权注释，所以按 esbuild 实际打进 dist 的文件把用到的包列出来，附上许可全文。
const manifestOf = (dir) =>
  existsSync(resolve(dir, "package.json"))
    ? JSON.parse(readFileSync(resolve(dir, "package.json"), "utf8"))
    : {};
const bundled = new Map();
for (const [where, { metafile }] of [
  ["dist/index.js", host],
  ["dist/client.js", client],
]) {
  for (const input of Object.keys(metafile.inputs)) {
    if (!input.includes("node_modules/")) continue;
    let dir = dirname(resolve(input));
    while (!manifestOf(dir).name) dir = dirname(dir);
    const entry = bundled.get(dir) ?? { manifest: manifestOf(dir), where: new Set() };
    entry.where.add(where);
    bundled.set(dir, entry);
  }
}
// 这个包的 dist 是它自己用 webpack 预先打好的，里面还带着下面两个库（tz-lookup 也在里面，许可同上面单列的 tz-lookup）
const EMBEDDED = {
  "circular-natal-horoscope-js": ["moment@2.24.0", "moment-timezone@0.5.26"],
};
// npm 包里没带许可文件时，用 licenses/ 里从上游仓库对应版本标签照抄的原文（文件名是 包名@版本）。
// 上游也没有原文的照实写明，不按作者字段自己拼。
const UPSTREAM = {
  "astronomy-engine@2.1.19": "https://github.com/cosinekitty/astronomy/blob/v2.1.19/LICENSE",
  "moment@2.24.0": "https://github.com/moment/moment/blob/2.24.0/LICENSE",
  "moment-timezone@0.5.26": "https://github.com/moment/moment-timezone/blob/0.5.26/LICENSE",
};
const upstream = (id) => readFileSync(resolve(root, "licenses", id), "utf8");
const licenseFile = (dir) => readdirSync(dir).find((name) => /^licen[cs]e/i.test(name));
const mplText = [...bundled.keys()]
  .filter((dir) => bundled.get(dir).manifest.license === "MPL-2.0" && licenseFile(dir))
  .map((dir) => readFileSync(resolve(dir, licenseFile(dir)), "utf8"))[0];
rmSync(resolve(root, "third_party"), { recursive: true, force: true });
const sections = [...bundled]
  .sort(([, a], [, b]) =>
    `${a.manifest.name}@${a.manifest.version}`.localeCompare(`${b.manifest.name}@${b.manifest.version}`),
  )
  .map(([dir, { manifest, where }]) => {
    const id = `${manifest.name}@${manifest.version}`;
    const file = licenseFile(dir);
    let text = file && readFileSync(resolve(dir, file), "utf8");
    let note = `许可原文取自包内 ${file}`;
    if (!file && UPSTREAM[id]) {
      text = upstream(id);
      note = `npm 包里没有许可文件，下面照抄上游仓库对应版本的原文：${UPSTREAM[id]}`;
    } else if (!file && manifest.license === "MPL-2.0") {
      text = mplText;
      note =
        "npm 包和上游仓库都没有附许可原文，package.json 声明为 MPL-2.0；下面是 MPL-2.0 的标准全文（与同批 taobi 包内的 LICENSE 相同），不是这个包自带的";
    } else if (!file) {
      text = "";
      note = `npm 包和上游仓库都没有附许可原文，package.json 声明为 ${manifest.license}`;
    }
    if (manifest.license === "MPL-2.0") {
      cpSync(dir, resolve(root, "third_party/mpl", id), { recursive: true });
      note += `；npm 发布的原文件附在 third_party/mpl/${id}/`;
    }
    const repository =
      typeof manifest.repository === "string" ? manifest.repository : manifest.repository?.url;
    return [
      `== ${id} (${manifest.license})`,
      `打进：${[...where].join("、")}`,
      repository && `仓库：${repository.replace(/^git\+/, "")}`,
      note,
      ...(text.trim() ? ["", text.trim()] : []),
      ...(EMBEDDED[manifest.name] ?? []).map(
        (inner) =>
          `\n\n== ${inner} (MIT)\n打进：随 ${id} 的 dist 一起\n下面照抄上游仓库对应版本的原文：${UPSTREAM[inner]}\n\n${upstream(inner).trim()}`,
      ),
    ]
      .filter((line) => line !== undefined)
      .join("\n");
  });
sections.push(
  `== 太卜 MBTI (AGPL-3.0-only)\nCopyright (c) 2026 hhszzzz\n来源与修改见 THIRD_PARTY_NOTICES.md\n\n${readFileSync(resolve(root, "licenses/AGPL-3.0-only"), "utf8")}`,
);
writeFileSync(
  resolve(root, "THIRD_PARTY_LICENSES.txt"),
  `本文件由 scripts/build.mjs 生成：列出实际打进 dist/index.js 和 dist/client.js 的第三方包及其许可全文。\n\n${sections.join("\n\n\n")}\n`,
);
