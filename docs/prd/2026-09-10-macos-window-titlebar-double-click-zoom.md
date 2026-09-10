# PRD · macOS 桌面端顶栏双击缩放与无感窗口交互体验优化

| 文档版本 | 状态 | 拟定日期 | 目标版本 | 负责团队 |
| :--- | :--- | :--- | :--- | :--- |
| v1.0.0 | **Approved / Ready for Implementation** | 2026-09-10 | OmniMux Desktop >= 2.0.7 | 桌面端架构与用户体验组 |

---

## 一、 背景与现状痛点 (Background & Context)

### 1.1 历史演进与功能退化
- **历史功能**：在较早版本的 OmniMux 桌面端中，顶部存在一个独立的 Frame Titlebar 组件（36px 高度，位于视口最顶部），设置了 `-webkit-app-region: drag`。macOS 用户可以通过双击顶栏空白处自然触发系统级的窗口放大与还原（Zoom / Maximize）。
- **无框化重构 (commit `eb8843aac4`)**：为了追求沉浸式的无边框设计并将红绿灯与多标签页深度融入内容（内容贴顶 `top: 0`），移除了独立顶栏组件。
- **点击被吞与一刀切修复 (PR #27 与 PR #29)**：
  - 在引入 `dsh-better-sidebar` 多标签页插件后，顶栏承载了大量的操作控件（Tab 项、Tab 关闭按钮、新增按钮 `+`、右上角面板/分屏折叠控制群 `toggleCluster`、左侧收起侧边栏按钮等）。
  - 由于 Chromium / Electron 在 macOS Cocoa 层的原生缺陷（Chromium Issue #1354 / Electron Issue #37789），只要底层或父级被声明为 `-webkit-app-region: drag`，即使子元素被标记为 `no-drag`，鼠标点击依然会被底层的原生拖拽命中测试（Hit-testing）随机拦截吞掉，导致右上角面板按钮与收起按钮经常点不动。
  - 为彻底解决吞点击问题，PR #27 与 PR #29 采取了防御性的一刀切方案：将 `[class*="tabBar"]`、`[class*="tabBar"] *` 以及 `[class*="logoRow"]` 全量强制设置为 `-webkit-app-region: no-drag !important;`。
- **现状结论**：顶部的几乎所有区域全部变成了 `no-drag`。由于没有任何区域被 macOS 识别为窗口标题栏，macOS WindowServer 不再接收标题栏双击事件，**导致 macOS 用户习惯的双击顶栏放大/缩小窗口功能彻底失效**。

---

## 二、 问题定义与目标 (Problem & Goals)

### 2.1 核心矛盾
- **原生拖拽区（`-webkit-app-region: drag`）与 Web 交互控件的天然排斥**：
  在同一个垂直与水平带内，若既要保留 CSS 拖拽层，又要支持复杂交互按钮，Electron 底层很容易产生“按钮点不动”的严重恶性 Bug。
- **一刀切禁用导致核心操作系统交互断裂**：
  macOS 用户长期形成了“双击顶栏放大缩小窗口”的直觉肌肉记忆，失去该功能后造成严重的体验割裂感。

### 2.2 产品与设计目标
1. **零阻碍、零破坏（P0）**：
   - 保持顶栏所有交互按钮（Tab 切换、关闭、新建、右上角折叠按钮群、左侧收起按钮）100% 灵敏可用，严禁引入任何点击丢失或拖拽层穿透。
2. **100% 恢复双击缩放体验（P0）**：
   - 用户在顶栏任意非交互控件的空白区域（标签页右侧空白、标签页之间的缝隙、左侧红绿灯右侧空隙）双击，精准、平滑地切换窗口最大化与还原。
3. **完美对齐 macOS 原生系统偏好（P0）**：
   - 在 macOS 下，双击标题栏动作严格遵循用户的系统设置（`AppleActionOnDoubleClick`）：支持“缩放 (Zoom/Maximize)”、“最小化 (Minimize)”与“无操作 (None)”。
4. **跨平台体验自适应（P1）**：
   - Windows 与 Linux 环境下，双击顶栏空白处自适应切换最大化/还原。

---

## 三、 用户故事与使用场景 (User Stories & Scenarios)

| 编号 | 角色 | 场景 | 预期行为 |
| :--- | :--- | :--- | :--- |
| **US-01** | macOS 用户 | 处于默认窗口大小，在顶部多标签栏右侧的空白区域双击鼠标左键 | 窗口平滑放大至最大化（或跟随系统偏好缩放），顶栏布局保持完整。 |
| **US-02** | macOS 用户 | 处于最大化窗口状态，再次双击顶栏空白处 | 窗口恢复到最大化之前的原始尺寸和位置。 |
| **US-03** | 桌面端用户 | 快速双击某个 Tab 标签上的文字，或者快速连击新建标签页 `+` 按钮 / 右上角分屏折叠按钮 | 仅触发标签页激活或按钮点击动作，**绝不触发**窗口缩放。 |
| **US-04** | macOS 偏好定制用户 | 在 macOS 系统设置「桌面与程序坞」中将“双击窗口的标题栏以”修改为“最小化” | 双击顶栏空白处时，窗口立即平滑最小化至 Dock，行为与系统原生 App 一致。 |
| **US-05** | 全屏模式用户 | 窗口已经处于 macOS 原生全屏（Green Button Fullscreen / Space）状态 | 双击顶栏空白处静默忽略，防止与系统的 Space 全屏状态机冲突。 |

---

## 四、 详细功能规格与技术方案 (Technical Architecture & Specifications)

本方案采用业界顶级 Electron 应用（如 VS Code、Electron Fiddle、Mattermost）经过实践验证的黄金标准方案：**“纯净事件代理 + 语义化白名单过滤 + 系统偏好 IPC 联动”**。

### 4.1 架构分层
```
┌─────────────────────────────────────────────────────────────┐
│ 1. 渲染端 (Client / extended-shell.ts)                      │
│    - 全局委派监听 dblclick 事件 (限定 clientY <= 38px)       │
│    - 语义化过滤：closest(INTERACTIVE_SELECTORS) 立即放行    │
│    - 空白命中：调用 window.__DSH_DESKTOP_CHROME__.handleTitleBarDoubleClick()
└──────────────────────────────┬──────────────────────────────┘
                               │ ContextBridge IPC
┌──────────────────────────────▼──────────────────────────────┐
│ 2. 桥接层 (Preload / preload.ts)                             │
│    - 通过 contextBridge 安全暴露 handleTitleBarDoubleClick   │
│    - 发送 IPC 'dsh:titlebar-double-click' 到主进程          │
└──────────────────────────────┬──────────────────────────────┘
                               │ Electron IPC Channel
┌──────────────────────────────▼──────────────────────────────┐
│ 3. 主进程 (Main Process / electron-shell-generation.ts)     │
│    - 获取当前 BrowserWindow                                  │
│    - 若处于 isFullScreen() 则忽略                           │
│    - 若为 macOS：读取 systemPreferences.getUserDefault('AppleActionOnDoubleClick') │
│      * 'Minimize' -> window.minimize()                      │
│      * 'None'     -> noop                                   │
│      * 'Maximize' / default -> isMaximized() ? unmaximize() : maximize() │
│    - 若为 Windows/Linux：isMaximized() ? unmaximize() : maximize() │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 详细设计规范

#### 1. 交互元素过滤白名单规则（Renderer 端）
渲染端捕获 `dblclick` 时，执行命中测试：
```ts
const INTERACTIVE_SELECTORS = [
  'button',
  'input',
  'textarea',
  'select',
  'a',
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="dialog"]',
  '[class*="tab_"]',
  '[class*="tab "]',
  '[class*="tabActive"]',
  '[class*="tabClose"]',
  '[class*="tabBarPlus"]',
  '[class*="toggleCluster"]',
  '[class*="toggleButton"]',
  '[class*="bottomClose"]',
  '[class*="controls"]',
  '[contenteditable="true"]',
].join(',')
```
- 若 `event.target.closest(INTERACTIVE_SELECTORS)` 返回非空，直接 `return`，让常规 DOM 事件正常冒泡处理。
- 若处于模态弹窗或浮层开启状态（`document.querySelector('[aria-modal="true"]')` 处于激活），直接 `return`。

#### 2. 窗口顶栏双击的有效几何区域
- `clientY <= 38`（匹配当前桌面端在 macOS 上收起/展开状态下的统一 38px 顶栏高度带）。
- 超出该垂直范围的双击（如正文、会话区、代码块），绝不触发。

#### 3. macOS 原生偏好读取（Main Process 端）
在 macOS 上通过 `systemPreferences` 动态解析：
```ts
const action = systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string')
```
- **"Minimize"**：调用 `window.minimize()`
- **"None"**：保持现状，不执行任何窗口状态突变
- **"Maximize" 或其他缺省值**：
  ```ts
  if (window.isMaximized()) {
    window.unmaximize()
  } else {
    window.maximize()
  }
  ```

---

## 五、 异常与边界防御 (Edge Cases & Safety Defenses)

1. **窗口处于原生全屏状态（Fullscreen）**：
   - 当 `window.isFullScreen()` 为 `true` 时，忽略双击事件，避免破坏 macOS Spaces 全屏管理。
2. **双击过快 / 连续高频点击（Debounce / Throttling）**：
   - 增加 300ms 简单防抖，防止用户三次连击或抖动导致窗口在最大化与还原之间快速抽搐。
3. **销毁保护**：
   - 主进程在响应 IPC 消息前校验 `window && !window.isDestroyed()`。
4. **多窗口隔离**：
   - IPC 消息通过 `event.sender` 逆向查找精确对应的 `BrowserWindow.fromWebContents(event.sender)`，确保弹窗（Dialog/Wizard）与主窗口互不干扰。

---

## 六、 验收标准 (Acceptance Criteria)

- [ ] **AC-1：顶栏空白区双击缩放**：
  在标签栏右侧空白、标签与标签之间的空白、侧边栏红绿灯右侧空白处双击，窗口平滑地在最大化与还原之间切换。
- [ ] **AC-2：按钮交互完全不受干扰**：
  点击/双击标签页、关闭标签按钮、新建标签按钮 `+`、右上角面板切换按钮群 `toggleCluster`、左侧收起侧边栏按钮，功能响应 100% 正常，无任何吞点击现象。
- [ ] **AC-3：系统偏好对齐**：
  在 macOS「系统设置 - 桌面与程序坞 - 双击窗口的标题栏以」配置为“最小化”后，双击顶栏空白处窗口平滑最小化至 Dock。
- [ ] **AC-4：测试覆盖与门禁通过**：
  - 新增针对 Client 双击过滤逻辑的单元测试，涵盖空白命中与各类控件豁免。
  - 新增针对 Main 进程 IPC 处理的单测或状态校验。
  - `yarn workspace dsh-plugin-desktop typecheck` 与 `test` 100% 通过。
