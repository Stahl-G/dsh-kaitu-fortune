# 第三方依赖

`dist/index.js` 由 esbuild 打包，下面这些包原样打进去，没有改动源码。

| 名称 | 版本 | 许可 | 仓库 |
|---|---|---|---|
| taibu-core（只用 core 包；taibu 仓库根目录的 Web、App 是 AGPL，没有使用） | 3.6.0 | MIT | https://github.com/hhszzzz/taibu |
| iztro | 2.5.4 | MIT | https://github.com/SylarLong/iztro |
| lunar-lite | 0.2.7 | MIT | https://github.com/SylarLong/lunar-lite |
| lunar-javascript | 1.7.7 | MIT | https://github.com/6tail/lunar-javascript |
| lunar-typescript | 1.8.6 | MIT | https://github.com/6tail/lunar-typescript |
| tyme4ts | 1.4.4 | MIT | https://github.com/6tail/tyme4ts |
| astronomy-engine | 2.1.19 | MIT | https://github.com/cosinekitty/astronomy |
| circular-natal-horoscope-js（含 moment、moment-timezone、tz-lookup） | 1.1.0 | Unlicense | https://github.com/0xStarcat/CircularNatalHoroscopeJS |
| taobi | 0.4.5 | MPL-2.0 | https://github.com/Taogram/taobi |
| tao_calendar | 0.4.3 | MPL-2.0 | https://www.npmjs.com/package/tao_calendar |
| tao_taichi.js | 0.0.5 | MPL-2.0 | https://github.com/Taogram/taichi |
| tao_name | 0.1.1 | MIT | https://www.npmjs.com/package/tao_name |
| julian.js | 2.0.0 | MIT | https://github.com/Taogram/julian.js |
| nutation.js | 0.4.1 | MIT | https://github.com/Taogram/nutation.js |
| solar_terms.js | 0.1.0 | MIT | https://github.com/Taogram/solar_terms.js |
| liuren-ts-lib | 1.9.0 | Apache-2.0 | https://github.com/look-fate/liuren-ts-lib |
| ajv | 8.17.1 | MIT | https://github.com/ajv-validator/ajv |
| fast-uri | 3.1.9 | BSD-3-Clause | https://github.com/fastify/fast-uri |
| fast-deep-equal | 3.1.3 | MIT | https://github.com/epoberezkin/fast-deep-equal |
| json-schema-traverse | 1.0.0 | MIT | https://github.com/epoberezkin/json-schema-traverse |
| i18next | 23.16.8 | MIT | https://github.com/i18next/i18next |
| dayjs | 1.11.23 | MIT | https://github.com/iamkun/dayjs |
| tz-lookup（按出生城市经纬度推时区） | 6.1.25 | CC0-1.0 | https://github.com/darkskyapp/tz-lookup |

界面（`dist/client.js`）另外打进了下面几个包，react 由 DSH 提供，不打包：

| 名称 | 版本 | 许可 | 来源 |
|---|---|---|---|
| react-iztro | 1.5.0 | MIT | https://github.com/SylarLong/react-iztro |
| iztro-hook | 1.3.4 | MIT | https://github.com/SylarLong/iztro-hook |
| iztro | 2.6.3 | MIT | https://github.com/SylarLong/iztro |
| lunar-lite | 0.2.8 | MIT | https://github.com/SylarLong/lunar-lite |
| classnames | 2.5.1 | MIT | https://github.com/JedWatson/classnames |
| @astrodraw/astrochart | 3.0.2 | MIT | https://github.com/AstroDraw/AstroChart |

MPL-2.0 的几个包原样使用、没有修改，源码在上面的仓库或 npm 上可以取得。
taibu-core 依赖的 pinyin 只有梅花易数字占用到，第一版不注册梅花，打包时换成了空模块，没有打进 dist。

## 数据

| 名称 | 许可 | 来源 |
|---|---|---|
| `data/cities.json`：GeoNames cities15000 精简版，原样取自人生开图 `packages/core/data/cities.json` | CC BY 4.0 | https://www.geonames.org/ |
| `data/tarot/*.jpg`：Rider–Waite–Smith 塔罗 1909 年初版（Pamela Colman Smith 绘）的扫描，缩到 250×420 | 公有领域 | Wikimedia Commons「Rider–Waite tarot deck (Roses & Lilies)」；本仓库取自 GitHub 上的镜像副本，逐张对照过是同一批扫描 |
