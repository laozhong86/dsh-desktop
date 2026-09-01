# OmniMux 桌面端构建、发布与 CDN 分发 SOP 规范

本文档定义 OmniMux 桌面客户端（macOS / Windows）从代码打包、版本门禁、Cloudflare R2 CDN 亚太存储分发的标准作业程序（SOP）。后续 Agent 在执行发版与构建任务时，必须严格遵守本契约。

**当前产品决策（Windows）**：以 **官网 CDN 直发** 为主；**Microsoft Store 暂停**，直至另行付费启用代码签名。详见 [windows-website-distribution.md](./windows-website-distribution.md)。

---

## 1. 跨平台产物架构规范

### 1.1 macOS 产物规范（Apple Silicon vs Intel）
- **通用二进制（Universal DMG - 推荐标准）**：
  - 文件命名：`OmniMux-<version>-universal.dmg`（兼容器名：`DSH.Desktop-<version>-universal.dmg`）
  - 内部架构：包含 `arm64`（Apple Silicon M1~M4 系列）和 `x86_64`（Intel）双架构 native 模块（sharp, koffi, ripgrep, node-pty）。
  - 优势：用户下载单一安装包即可在所有 Mac 机型上原生运行，无需区分机型，零决策成本。
- **单架构 DMG（可选）**：
  - `OmniMux-<version>-arm64.dmg`（仅 M 芯片，体积略小）
  - `OmniMux-<version>-x64.dmg`（仅 Intel 芯片）

### 1.2 Windows 产物规范
- **NSIS 安装包（x64 Installer - 官网主推）**：
  - 文件命名：`OmniMux-<version>-x64-Setup.exe`（兼容器名：`DSH-Desktop-<version>-x64-Setup.exe`）
  - 静默安装支持：支持 `/S` 参数无弹窗安装与自动更新，退出码为 `0` 表示成功。
  - **当前正式分发形态**：`yarn dist:win` 产出的 **unsigned** 安装包，经 R2/`dl.omnimux.ai` 官网下载。
  - **Microsoft Store**：暂停。Win32 商店包需 Authenticode（Policy 10.2.9）；付费签名路线见 `windows-trusted-signing-sop.md`，**不是**当前默认。

---

## 2. Cloudflare R2 亚太 CDN 存储与直链拓扑

所有发行版二进制资产均托管于 Cloudflare R2 亚太存储桶（亚太位置，国内与全球下载免出站流量费），并通过自定义域名 `https://dl.omnimux.ai` 全球 CDN 加速。

### 2.1 存储桶元数据
- **存储桶名称**：`omnimux-dist`
- **Account ID**：`861a8093c2f17a53b4f5a8375a347ff0`
- **绑定自定义域名**：`https://dl.omnimux.ai` (Zone: `omnimux.ai`, 证书与 SSL: 活跃)

### 2.2 存储路径标准拓扑
```
omnimux-dist (Bucket Root)
├── health.txt                                          # 监控与探活探针
├── releases/
│   ├── v<version>/                                     # 版本快照持久化目录
│   │   ├── OmniMux-<version>-x64-Setup.exe             # Windows 正式安装包（官网）
│   │   ├── OmniMux-<version>-universal.dmg             # macOS 通用 DMG
│   │   ├── DSH-Desktop-<version>-x64-Setup.exe         # Windows 兼容别名
│   │   └── DSH.Desktop-<version>-universal.dmg         # macOS 兼容别名
│   └── latest/                                         # 永久最新版本指针
│       ├── OmniMux-Setup.exe                           # Windows 最新安装包
│       ├── OmniMux-x64-Setup.exe                       # Windows x64 最新
│       ├── OmniMux-universal.dmg                       # macOS 通用最新
│       ├── OmniMux-mac.dmg                             # macOS 默认最新
│       ├── DSH-Desktop-Setup.exe                       # 兼容别名
│       └── DSH-Desktop.dmg                             # 兼容别名
```

---

## 3. Agent 发版命令速查表（CLI Matrix）

| 阶段 | 命令 | 说明 |
| :--- | :--- | :--- |
| **1. 前置物化** | `yarn omnimux:stage` | **强制铁律**：将所有在研插件物化到 preset 骨架，防止启动报错 |
| **2. 版本一致性** | `node scripts/verify-version.mjs` | 校验根 `package.json` 与 `dsh-plugin-desktop/package.json` 版本一致 |
| **3. macOS 打包** | `yarn dist:mac` / `yarn dist:mac-smoke` | 打包 Universal macOS DMG 镜像 |
| **4. Windows 官网包（当前默认）** | `yarn dist:win` | 打包 **unsigned** Windows x64 NSIS，用于官网 / R2 分发 |
| **4b. Windows 付费签名包（暂停默认）** | `yarn dist:win-release` | Azure Trusted Signing；仅当明确恢复商店/付费签名时使用，见 `windows-trusted-signing-sop.md` |
| **5. R2 产物同步** | `yarn dist:r2-sync` | 自动上传 `dist/` 产物至 R2 并建立 `latest/` 别名（带智能去重） |
| **6. CDN 巡检** | `yarn dist:r2-verify` | 自动化并发探测 `https://dl.omnimux.ai` 节点可用性与字节数 |
| **7. 桶清单查询** | `yarn dist:r2-list` | 查阅当前 R2 桶中的所有在线对象与文件大小 |

---

## 4. 分发渠道策略

### 4.1 官网（当前 Windows 主路径）
- Installer URL：`https://dl.omnimux.ai/releases/v<version>/OmniMux-<version>-x64-Setup.exe`
- 最新指针：`https://dl.omnimux.ai/releases/latest/OmniMux-Setup.exe`
- SmartScreen / 未知发布者文案：见 [windows-website-distribution.md](./windows-website-distribution.md)
- 下载页信息架构 / 主 CTA / 禁止链：见 [download-page-spec.md](./download-page-spec.md)

### 4.2 Microsoft Store（暂停）
- **开发者账号**：`laozhong86@gmail.com`（个人开发者资质认证已通过；一次性注册费 ≠ 代码签名费）
- **应用名称**：`OmniMux`
- **Product ID**：`18c7607a-4248-4706-b796-c104bbf2ed42`
- **状态**：**不要重提**。上次认证因 Policy 10.2.9 / `Unsigned` 失败（报告 `aebe26db-16c8-4aa4-abe8-62963eca5bba`）。
- 若未来恢复商店：必须先付费完成 Authenticode（Trusted Signing 或 OV/EV），再按 `windows-trusted-signing-sop.md` 签名后重提；**禁止**再用 unsigned `dist:win` 作为 Package URL。
