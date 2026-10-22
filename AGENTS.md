# 开发约定

- 个人兴趣插件，轻量迭代。约定照 [rensheng-kaitu 的 AGENTS.md](https://github.com/Stahl-G/rensheng-kaitu/blob/main/AGENTS.md)。
- 计算全部交给 `taibu-core`，这里只写 DSH 适配；干支、星位、牌面只用引擎结果，不让模型补或改。
- 出生信息、抽牌记录、解读默认存在插件自己的本机目录，不写进开图工作区。用户主动继续讨论时，将计算结果与盲评带入 DSH／问问草稿；发送后的历史由该对话环境保存。
- 算出来的只是参考：不写进开图的目标、记忆和今天页；具体行动只能作为待采纳的 AI 建议。
- 不写防御性代码，不写免责式文案（只在页脚留一行），测试只测真实行为，测试用临时 HOME 和合成数据。
- 只用 taibu 的 core 包，不抄 taibu 仓库里 AGPL 的 Web/App 代码。
- 改发行代码后运行 `pnpm build`，提交 `dist` 供 GitHub 直接安装；验收截图只放 PR 描述，不提交进仓库。
- PR 净增代码超过约 400 行先拆。
