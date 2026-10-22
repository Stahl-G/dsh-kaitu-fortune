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

MPL-2.0 的几个包原样使用、没有修改，源码在上面的仓库或 npm 上可以取得。
taibu-core 依赖的 pinyin 只有梅花易数字占用到，第一版不注册梅花，打包时换成了空模块，没有打进 dist。
