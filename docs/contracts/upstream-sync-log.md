# upstream-sync 决策日志

> 追加式，新条目置顶。格式见 `upstream-sync.md` 合同。无日志的 merge 不算完成。

---

## 2026-08-22 · 例行同步（49 提交，含 2 项 C 级老板确认）

- **上游范围**：`d457d79029..6201080cfa`（49 提交；dsh rc.8→0.1.1-rc.2 运行时升级与补丁迁移、native UI 恢复/建 Profile 窗口、desktop settings、市场/通知、打包修复、Windows 终端恢复）
- **冲突**：3 文件 —— `dsh-plugin-desktop/package.json`（4 处）、`dsh-plugin-desktop/tests/package.spec.ts`（1 处）、`yarn.lock`
- **解法**：
  - 🟡 B 级（模板）：
    - build 链：保 `generate-mac-app-icon-omnimux.mjs`/`generate-tray-icons-omnimux.mjs`，并入上游 `vite build --config vite.native-ui.config.ts`；typecheck 跟随上游（+native-ui tsc）
    - 依赖：`@deepseek-ai/dsh*` 全部取上游 0.1.1-rc.2（与本仓 10:24 已升级的 dsh-credentials rc.2 一致）
    - devDeps：并集 —— 保 `@electron/rebuild` + 上游 `@fontsource-variable/inter`、`@tailwindcss/vite`
    - nsis 块与 spec 断言：品牌保 OmniMux（shortcutName/artifactName），功能跟随上游（`useZip:false`）
    - `yarn.lock`：取上游后由 `yarn install` 重算
  - 🟠 C 级·老板确认：
    1. build 链结构性冲突（上游新增 vite native-ui 构建）→ 老板选择「合并两条链」：品牌脚本 + vite native-ui 一并进入产品
    2. `deepseek-harness` 子模块 pin 变更（rc.8 `141eb6fe` → rc.2 `b150a551b8d`）→ 老板确认跟进；单独提交 `421572af93`（merge 初版误留 rc.8，已修正）
- **分级记录**：A 级 44 项自动合并；B 级 2 项（package.json 模板解 + spec/yarn.lock）；C 级 2 项老板确认；D 级 0
- **验证**：`yarn build`（含 vite native-ui）exit 0；typecheck exit 0；vitest **77 files / 757 passed | 4 skipped**
- **决策人**：老板确认
- **提交**：`70941c89af`（merge）+ `421572af93`（submodule pin）+ 本条日志

---
## 2026-08-21 · 例行同步（11 提交）

- **上游范围**：`8eaefb3149..d457d79029`（11 提交，含 rc.7→rc.8 依赖升级、macOS native menu 本地化）
- **冲突**：仅 1 处 —— `dsh-plugin-desktop/package.json` 的 `version` + `description`（上游升 2.0.2 + DSH 品牌描述 vs 我们的 OmniMux 描述）
- **解法**：🟡 B 级模板 —— version 取上游 `2.0.2`，description 保 OmniMux 文案
- **分级记录**：A 级 10 项自动合并；B 级 1 项按模板解；C 级 0；D 级 0
- **验证**：merge 后测试 2 项失败（依赖 rc.8 未装 + lib 未重编）→ `yarn install` + 干净 env `build` 后 **36 passed | 1 skipped 全绿**；typecheck exit 0
- **决策人**：agent 自主（贾维斯会话）
- **提交**：`a099217f8c`（merge）+ `2d26cbe400`（lockfile/gitignore）

## 2026-08-21 · 大合并（191 提交，fork 落地前置）

- **上游范围**：fork 基点之后 191 提交（8 月中旬 → 8-21 上午）
- **冲突**：3 处，全部在预期薄改点 —— `main.ts` 的 appId 行、`profile-manager.ts` 的 DEFAULT_PROFILE_NAME、`update-checker.ts` 的 feed URL
- **解法**：🟡 B 级 —— 全部保 OmniMux 值（appId=`ai.omnimux.desktop`、profile=`omnimux`、feed 保持禁用态占位）
- **分级记录**：A 级 188 项；B 级 3 项；C 级 0；D 级 0
- **验证**：typecheck exit 0；seed 端到端验证通过（rm -rf 临时 DSH_HOME → 8 bundles + 235 deps 重建）
- **决策人**：agent 自主（贾维斯会话）
- **提交**：`c3e9348300`（merge，后续经历史重建对应 `8eaefb3149` 基点）

---

### 追加新条目的模板

```markdown
## YYYY-MM-DD · 同步类型（N 提交）

- **上游范围**：`SHA..SHA`
- **冲突**：逐项列出
- **解法**：分级 + 逐项处理
- **分级记录**：A/B/C/D 各几项，C 级谁确认
- **验证**：typecheck/test/CI 真实输出
- **决策人**：agent 自主 / 老板确认
- **提交**：commit SHA
```
