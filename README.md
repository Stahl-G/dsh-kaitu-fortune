# Fortune telling / 命理与星象

给 DeepSeek Harness 和[人生开图](https://github.com/Stahl-G/rensheng-kaitu)用的插件，把中式命理、西洋星盘和塔罗放在一起。

分两步：

1. **盲读**：只看出生信息和抽到的牌，AI 读不到你的任何开图资料，先给一份解读。
2. **结合近况**：你点一下，AI 再读你勾选给它的开图资料，给综合建议。

第一版包含八字（含大运）、紫微（含流年）、每日黄历、六爻、塔罗、西洋本命盘与合盘。全部计算由 [taibu-core](https://www.npmjs.com/package/taibu-core) 完成，插件只做 DSH 适配和界面。

出生信息只存在本机，不写进开图工作区，可以一键删除。算出来的内容不写进开图的目标、记忆和今天页。

> 传统文化与自我反思参考，不是预测。

## 状态

开发中，尚未发布。

## 许可

代码 MIT。第三方依赖与素材见 `THIRD_PARTY_NOTICES.md`。
