# 2026-09-01 OmniMux Dev.app dsh@0.1.2-alpha.3 四屏证据

交付目标：fork worktree `agent/desktop-runtime-alpha3` 将 runtime 升到 `dsh@0.1.2-alpha.3`（SHA `dd6322d604`），只替换 `/Applications/OmniMux Dev.app`，开 PR 待验收，不合入。未碰 `/Applications/OmniMux.app`（仍为 2.0.3）。

## RC 交付块

```text
pin: dsh@0.1.2-alpha.3 SHA dd6322d604e00eec1ba5e0c8541159906a21094a
host: /Applications/OmniMux Dev.app 2.0.4 dsh-tools 0.1.2-alpha.3 (asar.unpacked)
script: pass
dsh-tools-copies: none
hard-deps: none
overlay-fixtures: match-host (WORDMARK/NAME match; FISH host=None because script reads DSH_SRC FishLogo.tsx not packaged client)
screens:
  empty-session: pass
  sidebar-brand: pass
  tool-call: pass
  desktop-no-open: pass
residual:
  - published dsh-better-sidebar still imports removed settingsNamespace(); staged copy is rewritten in stage-preset-profile.ts; seed-version 3→4
  - ~/.omnimux-dev/settings.yaml still has dsh-desktop.openBrowser: true from an older generation; this launch did not print "opening the default browser" and did not spawn Safari/Chrome
  - Dev.app build-info commit is 1a6a70f835 (packaged before util-time / sidebar-stage follow-ups). Those two commits are in the PR; live asar already contains dsh-util-time and a patched sidebar
  - tool-call UI screenshot still shows the blank composer (AX could not switch the visible session while DSH Desktop shared bounds). Proof is Host session jsonl: bash tool/call → ALPHA3_TOOL_OK /private/tmp → turn/end completed, no prepare crash
```

## 四屏

| 屏 | 文件 | 判定 |
|---|---|---|
| 空会话 | `empty-session.png` | OmniMux 品牌英雄；composer 无方标；菜单栏 OmniMux |
| 展开侧栏 | `sidebar-brand.png` | 左上角 OmniMux 标 + 名称，不是 DeepSeek 字标 |
| 工具调用 | `tool-call-session.jsonl` + `tool-call.png` | Host RPC `session/prompt` accepted；jsonl `tool/call` bash → `tool/result` `ALPHA3_TOOL_OK\n/private/tmp\n` `isError:false` → `turn/end` `completed`。无 `Cannot read properties of undefined (reading 'prepare')`。截图为同窗侧栏列出该会话 |
| 冷启动不弹系统浏览器 | Dev 日志 + Electron 窗口 | 进程 `/Applications/OmniMux Dev.app` 监听 `127.0.0.1:44120`；今日日志无 `dsh web: opening the default browser` |

## 关键运行时修复（相对 pin commit）

1. `@deepseek-ai/dsh-util-time` 升为 desktop 直接依赖，否则 asar 缺包，subagent / session-controller 无法 import。
2. 打包后 `dsh-better-sidebar` 仍调用 `settingsNamespace()` → Host plugin tree 失败。stage 脚本改写 staged `src/index.ts` / `lib/index.js`；seed-version bump 让已有 Dev profile 下次启动刷新副本。

## 环境

- Dev.app 2.0.4 / `ai.omnimux.desktop` / dsh 0.1.2-alpha.3 / submodule `dd6322d604`
- Prod.app 2.0.3 未改
- Host 端口 44120
- 会话 `session-679afcc4-955a-458b-8740-c8d4d0d1e56a` cwd `/tmp`
