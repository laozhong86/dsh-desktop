# upstream-sync 决策日志

> 追加式，新条目置顶。格式见 `upstream-sync.md` 合同。无日志的 merge 不算完成。

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
