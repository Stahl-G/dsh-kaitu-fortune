# 第三方代码与数据

## 代码

`dist/index.js`（宿主）和 `dist/client.js`（界面）由 esbuild 把依赖打成单个文件，打包时去掉了源码里的注释（含版权注释）。
实际打进去的每个包、版本、仓库和许可全文见 [`THIRD_PARTY_LICENSES.txt`](THIRD_PARTY_LICENSES.txt)。这份文件由 `scripts/build.mjs` 按 esbuild 实际用到的文件生成，不手工维护。
主要的包：

- taibu-core 3.6.0（MIT）：只用 npm 上的 core 包；taibu 仓库根目录的 Web、App 是 AGPL，没有使用。
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
本插件自己的代码仍按 MIT 发布，没有把 MPL 文件改成其他许可。

## 数据

| 文件 | 许可 | 来源 |
|---|---|---|
| `data/cities.json` | CC BY 4.0 | GeoNames cities15000 精简版，原样取自人生开图 `packages/core/data/cities.json`；<https://www.geonames.org/> |
| `data/tarot/*.jpg` | 公有领域（见下） | Rider–Waite–Smith 塔罗 1909 年初版扫描；逐张来源见 [`data/tarot/sources.json`](data/tarot/sources.json) |

### 塔罗图片

- **作品**：78 张牌由 Pamela Colman Smith 绘制，1909 年由 William Rider & Son 在伦敦出版。
  - 美国：1930 年前出版，已进入公有领域。
  - 英国和欧盟：作者 1951 年去世，按作者终身加 70 年，2022 年 1 月 1 日起进入公有领域。
  - 扫描件是对平面作品的忠实翻拍，不产生新的权利（美国 Bridgeman v. Corel；欧盟 DSM 指令第 14 条）。
- **原始文件**：`sources.json` 的 `original` 是每张图在 Wikimedia 上的文件名，`page` 是对应的文件页。
  - 小牌在 Wikimedia Commons 的「Rider-Waite tarot deck (Roses & Lilies)」分类下。
  - 部分大牌可能只在英文维基百科本地，不在 Commons。
- **本仓库的副本怎么来的**：取自 GitHub 仓库 mirror29/inalpha 的固定提交 `2e02c72`，78 张与该提交里的文件逐字节相同（2026-10-22 核对）。
  - 那个仓库用脚本从 Wikimedia 原图缩到 420 像素高。
  - 该仓库的代码是 AGPL-3.0，但公有领域图片的机械缩放不产生新的版权，AGPL 管不到这些图片。
- **还没做到的**：2026-10-22 从开发机连不上 Wikimedia，所以 `sources.json` 里的 `license`（文件页上的许可标注）还是空的，没有逐张在线核实。
  能连上时运行 `node scripts/fetch-tarot.mjs`：它直接从 Wikimedia 原图重新下载、缩放，并把文件页上的作者和许可标注写进 `sources.json`，之后就不再依赖这个镜像。
