# 第三方代码与数据

## 代码

`dist/index.js`（宿主）和 `dist/client.js`（界面）由 esbuild 把依赖打成单个文件，打包时去掉了源码里的注释（含版权注释）。
实际打进去的每个包、版本、仓库和许可全文见 [`THIRD_PARTY_LICENSES.txt`](THIRD_PARTY_LICENSES.txt)。这份文件由 `scripts/build.mjs` 按 esbuild 实际用到的文件生成，不手工维护。
npm 包里没带许可文件的，用 [`licenses/`](licenses/) 里从上游仓库对应版本照抄的原文（astronomy-engine 2.1.19，以及星盘库自带的 moment、moment-timezone）；上游也没有原文的（solar_terms.js、tao_taichi.js），清单里照实写明，只列 package.json 声明的许可，不按作者字段拼版权行。
主要的包：

- taibu-core 3.6.0（MIT）：用于排盘计算。MBTI 另外从上游 AGPL 模块抽取，见下文。
- 它依赖的 iztro、lunar-javascript、tyme4ts、astronomy-engine、circular-natal-horoscope-js、liuren-ts-lib 等。
- 界面用的 @astrodraw/astrochart。React 由 DSH 提供，不打包。

和上游相比，打包时做了这些改动：

- esbuild 把所有模块合进一个文件，改写了 import/export 和顶层变量名；界面代码另外压缩过。
- taibu-core 的 `domains/astrology/calculate.js` 原来用 `createRequire` 动态加载 circular-natal-horoscope-js。打包时把这一行改成静态 `import`，其余不变。
- taibu-core 依赖的 `pinyin`（约 7 MB 字典）只有梅花易数字占用到。第一版不注册梅花，打包时换成一个调用即报错的空模块，pinyin 没有打进 dist。
- circular-natal-horoscope-js 的 dist 是它自己用 webpack 预先打好的，里面带着 moment 2.24.0、moment-timezone 0.5.26 和 tz-lookup。这几个也列在 `THIRD_PARTY_LICENSES.txt` 里。

### MPL-2.0 的包

taobi 0.4.5、tao_calendar 0.4.3、tao_taichi.js 0.0.5 和 0.1.0（经 taibu-core 引入）是 MPL-2.0。
它们的文件内容没有改动，但和其他代码一起被 esbuild 合并、改写进了 `dist/index.js`。
按 MPL-2.0 第 3.2 条，这几个包在 npm 上发布的原文件随插件一起附在 [`third_party/mpl/`](third_party/mpl/)，许可全文在各自目录和 `THIRD_PARTY_LICENSES.txt` 里。
上游仓库：<https://github.com/Taogram/taobi>、<https://github.com/Taogram/taichi>、<https://www.npmjs.com/package/tao_calendar>。
MPL 文件继续按 MPL-2.0 提供，未改为其他许可。

## 数据

| 文件 | 许可 | 来源 |
|---|---|---|
| `data/cities.json` | CC BY 4.0 | GeoNames cities15000 精简版，原样取自人生开图 `packages/core/data/cities.json`；<https://www.geonames.org/> |
| `data/tarot/*.jpg` | Public domain（Wikimedia 文件页标注） | Rider–Waite–Smith 塔罗扫描；逐张来源见 [`data/tarot/sources.json`](data/tarot/sources.json) |

### 塔罗图片

78 张 Rider–Waite–Smith 牌面直接取自 Wikimedia Commons 原图，2026-10-22 逐张读取文件页的作者、许可标注与下载地址后重新下载。
所有文件页的 `LicenseShortName` 均为 `Public domain`；创作者等原始署名按文件页记录在 [`data/tarot/sources.json`](data/tarot/sources.json)。

- `page` 是对应的 Wikimedia 文件页，`download` 是本次使用的原图地址，`artist`、`license` 来自 MediaWiki 的 `imageinfo/extmetadata`。
- 用 macOS `sips` 缩到 420 像素高、JPEG 质量 85；`sha256` 对应随插件分发的缩小文件。
- 重新生成命令：`node scripts/fetch-tarot.mjs`。本版的图片不再取自 GitHub 镜像。

## 太卜 MBTI（AGPL-3.0-only）

Copyright (c) 2026 hhszzzz。抽取日期：2026-10-23。
固定来源提交：[f885fd1143a6cd4ca15c30ea946cf7e53a5c6a98](https://github.com/hhszzzz/taibu/tree/f885fd1143a6cd4ca15c30ea946cf7e53a5c6a98)。

- `src/vendor/taibu-mbti.ts`：来自 `src/lib/divination/mbti.ts` 的类型、七档权重及计分函数，整理格式并去掉浏览器加载和类型介绍；百分比只舍入一端，另一端取补数，修正两端合计可能为 101% 的问题。
- `data/mbti/taibu-questions.json`：来自 `public/mbti/questions/output.txt`，保留全部 93 道原题和顺序，仅调整 JSON 排版。
- 上游仓库将 `src/`、`public/` 列入 AGPL 范围，原文随插件附在 `licenses/AGPL-3.0-only`。题库文件未另外列出原始量表来源。

这些材料按上游声明保留，不标成 MIT。没有移植其网页、登录、Supabase 或云存档逻辑。
