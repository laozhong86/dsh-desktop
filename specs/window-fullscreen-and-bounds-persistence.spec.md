# 规格说明书：桌面端窗口全屏与尺寸几何状态持久化记忆

## 一、 背景与用户痛点 (Background & Problem)
在之前的上游版本合并中，桌面主窗口持久化模块替换成了仅记录普通宽高坐标的简易版本。
导致的核心体验退化：
- 用户在全屏（Fullscreen）或最大化（Maximized）状态下关闭软件后，下次重新启动软件时，窗口被强制重置为缩小的普通窗口。
- 无法记忆关闭前的全屏或放大状态，严重破坏了用户的视觉连续性和沉浸式操作习惯。

## 二、 核心目标与验收准则 (Goals & Acceptance Criteria)
1. **全屏状态完整记忆**：
   - 当用户在全屏状态下关闭/退出应用，下次启动窗口自动恢复全屏（`isFullScreen: true`）。
2. **最大化状态完整记忆**：
   - 当用户在最大化（或 macOS Zoom）状态下关闭/退出应用，下次启动窗口自动恢复最大化（`isMaximized: true`）。
3. **缩小窗口状态完整记忆**：
   - 当用户在普通缩放窗口状态下关闭/退出应用，下次启动保持关闭前的尺寸与屏幕坐标，不出现突变。
4. **多显示器与越界安全防护**：
   - 当保存的坐标超出当前所有屏幕的工作区（例如断开外接显示器），自动退回主屏幕安全工作区居中显示，杜绝窗口掉到屏幕外不可见的故障。
5. **状态去重与平滑防抖**：
   - 窗口在拖拽、缩放、最大化切换时防抖写入状态（250ms debounce），关闭窗口或退出应用时立即无损刷盘（flush）。

## 三、 详细技术架构设计 (Technical Architecture)

### 3.1 状态数据结构扩展 (`main-window-state.ts`)
```ts
export interface MainWindowBounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly isMaximized?: boolean
  readonly isFullScreen?: boolean
}
```
- `isMaximized`: 布尔值，标识窗口是否处于最大化状态。
- `isFullScreen`: 布尔值，标识窗口是否处于全屏状态。
- `parseBounds`: 校验坐标与尺寸必须为安全整数，同时提取布尔类型的 `isMaximized` 与 `isFullScreen`。
- `sameMainWindowBounds`: 比较不仅包括 `x, y, width, height`，还严格比较 `isMaximized` 和 `isFullScreen` 状态，确保全屏或最大化切换时能够精准触发状态写入。

### 3.2 运行时状态采集与持久化 (`electron-shell-generation.ts`)
1. **状态捕获**：
   - 普通尺寸 `bounds` 取自 `window.getNormalBounds()`。
   - `isMaximized` 取自 `window.isMaximized()`。
   - `isFullScreen` 取自 `window.isFullScreen() || (restoreFullscreenOnShow ?? false)`。
2. **事件监听**：
   - 在已有的 `move` 和 `resize` 基础上，增加对 `maximize`、`unmaximize`、`enter-full-screen`、`leave-full-screen` 的监听，确保状态变化及时排队写入。
3. **安全关闭保存**：
   - 无论是调用红叉关闭还是全局应用退出（`isQuitting`），在触发关闭处理前无损执行 `persistWindowState()`。

### 3.3 窗口呈现与恢复机制 (`mount` 与 `show`)
1. 在窗口初始化 `BrowserWindow` 时，注入经过多显示器适配后的普通尺寸 `restoredBounds`。
2. 在窗口首次准备呈现（`show` / `revealStartupSurface` / `ready-to-show`）时：
   - 若 `persistedBounds.isFullScreen === true` 且当前尚未全屏，调用 `window.setFullScreen(true)`。
   - 否则若 `persistedBounds.isMaximized === true` 且当前尚未最大化，调用 `window.maximize()`。
   - 随后平滑呈现窗口并获得焦点。

## 四、 自动化测试与验证规范 (Test & Verification)
1. 单元测试覆盖：
   - `tests/main-window-state.spec.ts`：测试 `isMaximized` 和 `isFullScreen` 字段的正确存盘、解析、反序列化以及 `sameMainWindowBounds` 比对。
   - `tests/electron-runtime.spec.ts`：测试窗口创建时对全屏与最大化状态的还原调度，以及全屏/最大化事件触发时的状态更新与保存。
2. 类型与语法检查：
   - `yarn workspace dsh-plugin-desktop typecheck` 100% 绿灯。
   - 全套桌面端测试通过。
