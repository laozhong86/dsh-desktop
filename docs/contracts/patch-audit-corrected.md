# 补丁审计：修正版（以官方 patches 为基准）

> 审计日期：2026-10-26（修正版）
> **本文件取代此前两份审计结论**：`patch-audit-next-shell.md` 与 `patch-nature-audit.md`
> 两份旧报告的核心判断已被推翻，保留仅作过程记录，**不应作为决策依据**

---

## 0. 推翻旧结论的关键事实

上游仓库 `anywhere-labs/deepseek-harness-desktop` **自己也维护一整套 `patches/` 目录**（共 188 个文件，覆盖多个运行时版本）。

我们 `patches/` 下的 32 个补丁，**31 个与上游逐字节完全一致**。

这意味着：**这些补丁不是我们造的，是官方发布的**。此前"上游没有该函数 → 是我们的真实缺陷修复"的判断方法**从根上就是错的**——上游通过补丁机制修，不直接改 vendor 包，所以 vendor tgz 里当然找不到。

---

## 1. 全量比对结果

| 结果 | 数量 | 说明 |
| --- | --- | --- |
| **与上游完全一致** | 31 | 官方补丁，我们只是继承 |
| **我们自己的** | 1 | `dsh-client-ui-settings-account` |
| 合计 | 32 | — |

逐字节一致的 31 个：

```
@electron__osx-sign@1.3.3.patch              dsh-host-directory-picker-browse
app-builder-lib@26.15.7.patch                dsh-host-open-in-app
dsh-app-boot                                 dsh-plugin-manager
dsh-client-modules                           dsh-plugin-package-inventory-deepseek
dsh-client-ui-conversation                   dsh-ptc-runtime-node
dsh-client-ui-directory-picker-browse        dsh-sandbox-windows-acl
dsh-client-ui-plugin-manager                 dsh-subprocess-local
dsh-client-ui-primitives                     dsh-web-app
dsh-client-ui-settings-general               dsh
dsh-client-ui-settings-shell                 fs-ext@2.1.1
dsh-client-ui-sidebar                        node-pty@1.2.0-beta.15
dsh-experimental-computer-use-cua-driver-native   open@11.0.1
dsh-experimental-inspector                   open@11.0.4
dsh-fs-local                                 pi-ai@1.1.0
dsh-hmr                                      pnpm@11.28.5
                                             vscode-ripgrep@1.18.0
```

（均为 `@0.2.1-rc.3` 版本，工具链补丁除外）

---

## 2. 唯一属于我们的补丁

### `dsh-client-ui-settings-account@0.2.1-rc.3.patch`

| 项 | 我们 | 上游 |
| --- | --- | --- |
| 新增行 | 262 | 101 |
| 差异处 | 254 处 | — |

**上游补丁做什么**：桌面首次启动引导（`DesktopOnboardingNavigation`、`data-desktop-onboarding-surface`）。

**我们额外加什么**：OmniMux 账户桥（23 行含 `omnimux` 关键字）
- `window.__omnimuxAuth` 全局
- `/omnimux/auth/status`、`/omnimux/avatar` 等 HTTP 端点
- 侧边栏显示 OmniMux 身份而非官方 DeepSeek 账户

**判定**：这是**真实的产品身份需求**，不是重复造轮子。但它叠加在官方补丁之上，属于"官方补丁 + 我们的增量"的复合体。

**风险**：每次上游更新这个补丁，我们都必须手工重做增量。这是**唯一真实的补丁维护成本**。

---

## 3. 对前两份报告的具体更正

| 旧结论 | 事实 | 更正 |
| --- | --- | --- |
| `dsh-fs-local` 是我们的真实缺陷修复 | 与上游完全一致；上游 issue #1419 已由 PR #1426 以补丁形式修复 | 官方修复，非我们的 |
| `dsh-sandbox-windows-acl` 是我们新增的 `grantWriteOnce` | 与上游完全一致 | 官方补丁 |
| `dsh-web-app` 是我们手写环境清理、应撤销 | 与上游完全一致 | 官方补丁，不应撤销 |
| `dsh-experimental-inspector` 是我们的个性化需求 | 与上游完全一致 | 官方补丁 |
| 3 个补丁"官方已解决可撤销"（A 类） | 与上游完全一致，是官方当前方案 | **不可撤销** |
| 补丁债较重、需重构 | 只有 1 个补丁需要维护 | **补丁债极轻** |

---

## 4. 修正后的真实结论

### 4.1 补丁债几乎不存在

32 个补丁里 31 个是官方维护的。我们跟随上游升级时，只需**整批替换**即可，不构成维护负担。

**唯一需要人工维护的**：`settings-account` 里那 23 行 OmniMux 账户桥。

### 4.2 品牌化整合的实际工作量大幅降低

原判断"需要重构 4 个身份类补丁"不成立。实际只有 **1 个补丁的增量部分**需要处理。

### 4.3 与 Next 壳的关系

由于补丁是官方发布的，且 Next 壳本身也依赖这些被补丁的包，**补丁在 Next 下天然成立**——它们就是官方为 Next 准备的。

不存在"补丁与 Next 冲突"的问题。

### 4.4 对"官方方案优先"的重新理解

这条原则在本仓库的落地方式不是"撤销我们的补丁"，而是：

- **31 个官方补丁**：跟随上游，不自行修改
- **1 个我们的增量**：优先评估能否改为通过官方扩展点（slot）注入，而非直接改官方包

---

## 5. 下一步

1. **确认 `settings-account` 增量能否改为 slot 注入**：这是唯一有实际收益的优化。
2. **建立补丁同步机制**：升级运行时版本时，整批拉取上游对应版本的 `patches/`，再叠加我们那 23 行。
3. **品牌化整合**：工作量比原估计小很多，可优先启动。

---

## 6. 审计方法反思

前两份报告的错误根源：**只看了 vendor 包，没看上游仓库本身**。

教训：判断"某个修复是不是我们的"之前，必须先确认**上游是否通过补丁机制实现**，而不是假设"vendor 包里没有 = 上游没做"。
