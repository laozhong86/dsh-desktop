# 桌面壳生命周期指标与数据外发规范 (Issue #87)

- **Issue**: laozhong86/omnimux-desktop-fork#87
- **分支**: `agent/issue-87-desktop-analytics`
- **模块**: `dsh-plugin-desktop`

## 1. 业务目标与价值

解决 OmniMux 桌面端应用维度的“数据盲区”问题：
1. **装机量统计**：准确记录真实设备全新安装并首次启动（`app-first-run`）；
2. **启动性能监测**：完整上报冷启动总耗时与八大子阶段流水耗时（`app-startup`）；
3. **日常在线时长**：在应用退出（或周期性心跳）时结算累计会话运行时长（`app-session`）；
4. **内部协同**：在 Host 进程启动时透传 `OMNIMUX_INSTALLATION_ID`，打通宿主与壳层匿名标识。

## 2. 接口契约与协议规范

### 2.1 端点与鉴权头
- **默认端点**: `https://analytics.omnimux.ai/api/send`
- **默认站点 ID**: `dee7cef3-7da5-4a5b-8cc2-6381418d0303`
- **环境覆盖变量**:
  - `OMNIMUX_ANALYTICS_ENDPOINT`
  - `OMNIMUX_ANALYTICS_WEBSITE_ID`
  - `OMNIMUX_ANALYTICS_DISABLED`（设为 `1` 或 `true` 时完全静默，不外发）
- **请求头 (Headers)**:
  - `Content-Type`: `application/json`
  - `User-Agent`: 标准桌面 Chrome/macOS UA（避免 Umami 服务端无 UA 静默丢弃）
  - `x-umami-website-id`: `<website-id>`
  - `x-umami-hostname`: `omnimux-desktop`

### 2.2 Wire 负载结构
```json
{
  "type": "event",
  "payload": {
    "website": "dee7cef3-7da5-4a5b-8cc2-6381418d0303",
    "hostname": "omnimux-desktop",
    "url": "omnimux://desktop",
    "name": "<event-name>",
    "data": {}
  }
}
```

### 2.3 核心事件规划

| 事件名 | 触发时机 | 负载关键字段 |
|---|---|---|
| `app-first-run` | 全新安装后首次拉起（仅一次） | `installationId`, `appVersion`, `platform`, `arch` |
| `app-startup` | 冷启动完成或启动失败时 | `totalDurationMs`, `rendererStatus`, `finalStage`, `appVersion`, `platform`, `arch`, `electronReadyMs`, `shellEnvironmentMs`, `runtimeBootstrapMs`, `profileSelectionMs`, `profileCompositionMs`, `hostBootMs`, `rendererStartupMs`, `healthCommitMs` |
| `app-session` | 应用退出时或每小时心跳 | `durationMs`, `cleanExit`, `appVersion`, `platform`, `arch` |

## 3. 验收标准与测试断言

- [ ] **A1 (匿名装机识别)**: `getOrCreateDesktopInstallationIdentity` 正确区分首次创建 (`isNew: true`) 与已有持久化 (`isNew: false`)；且不破坏原有权限（0600/0700）与原子写入保障。
- [ ] **A2 (首次启动防重)**: `reportFirstRun` 在同一设备上成功上报后原子落盘标记；即使重复调用也仅上报一次。
- [ ] **A3 (启动性能采集)**: `reportStartup` 能正确汇总总耗时和各个阶段耗时，各耗时字段转换为数值或未定义（不产生 NaN 或负数）。
- [ ] **A4 (退出会话时长)**: `reportSessionExit` 能够正确计算自启动以来的在线毫秒数并上报。
- [ ] **A5 (网络容错与超时)**: 当网络不可达、DNS 解析失败、超时或服务端返回 5xx/4xx 时，客户端完全静默捕获并丢弃，主进程不崩溃、不阻塞、不弹窗。
- [ ] **A6 (Host 进程环境变量透传)**: `serializeHostEnvironment` 包含 `OMNIMUX_INSTALLATION_ID`，并在 Host 启动时正确注入。
- [ ] **A7 (自动化测试)**: `vitest run` 涵盖 `desktop-analytics.spec.ts`、`desktop-installation-id.spec.ts`、`host-launch-environment.spec.ts` 且 100% 通过。
