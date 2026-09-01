# OmniMux 安装包下载页规范

本文档是 **对外下载入口** 的产品与工程契约。官网 / 帮助中心 / 发版说明若展示安装包下载，必须遵守本规范。

相关真源：

- 发版与 CDN：[`release-sop.md`](./release-sop.md)
- Windows 官网 unsigned 策略：[`windows-website-distribution.md`](./windows-website-distribution.md)
- 付费签名（暂停）：[`windows-trusted-signing-sop.md`](./windows-trusted-signing-sop.md)

---

## 1. 唯一官方下载宿主

| 用途 | URL |
|---|---|
| CDN 根 | `https://dl.omnimux.ai/` |
| Windows 最新 | `https://dl.omnimux.ai/releases/latest/OmniMux-Setup.exe` |
| Windows 最新（显式 x64） | `https://dl.omnimux.ai/releases/latest/OmniMux-x64-Setup.exe` |
| macOS 最新（Universal） | `https://dl.omnimux.ai/releases/latest/OmniMux-universal.dmg` |
| macOS 最新（别名） | `https://dl.omnimux.ai/releases/latest/OmniMux-mac.dmg` |
| 版本钉死（Windows） | `https://dl.omnimux.ai/releases/v<version>/OmniMux-<version>-x64-Setup.exe` |
| 版本钉死（macOS） | `https://dl.omnimux.ai/releases/v<version>/OmniMux-<version>-universal.dmg` |

禁止作为**主下载按钮**的目标：

- ❌ `dshdesktop.cn` 或其它历史品牌下载站（除非明确标注归档）
- ❌ Microsoft Store 产品页（当前 Windows 商店通道暂停）
- ❌ 未经验证的镜像站、网盘、第三方聚合页
- ❌ 直接链到 CI artifact（14 天临时）

GitHub Releases 可作为**次要镜像**，但主 CTA 必须指向 `dl.omnimux.ai`。

---

## 2. 下载页最低信息架构

页面至少包含以下区块（顺序可微调，内容不可缺）：

1. **产品名 + 一句话定位**
2. **主下载按钮（按平台）**
   - macOS → Universal DMG
   - Windows → x64 NSIS Setup
3. **版本号**（与当前 `latest/` 一致，例如 `2.0.4`）
4. **系统要求**（见 §4）
5. **安装提示**
   - macOS：Gatekeeper / 拖入 Applications（若包已公证则写「可直接打开」；未公证则写明确绕过步骤）
   - Windows：SmartScreen / 未知发布者（见 §5，文案真源在 `windows-website-distribution.md`）
6. **完整性校验（推荐）**：SHA256（每个主安装包一行）
7. **问题反馈入口**：Issue / 支持渠道

可选：

- 历史版本列表（链到 `releases/vX.Y.Z/`）
- 兼容别名说明（`DSH-Desktop-*`）
- 静默安装：`Setup.exe /S`

---

## 3. 按钮与链接文案（建议）

### 简体中文

- 主按钮 macOS：`下载 macOS 版（Universal）`
- 主按钮 Windows：`下载 Windows 版（x64 安装包）`
- 次要：`查看历史版本` / `校验 SHA256`

### English

- macOS CTA: `Download for macOS (Universal)`
- Windows CTA: `Download for Windows (x64 Installer)`
- Secondary: `Previous releases` / `Verify SHA256`

---

## 4. 系统要求（默认声明）

| 平台 | 要求 |
|---|---|
| macOS | macOS 12+；Apple Silicon 与 Intel 均可使用 Universal DMG |
| Windows | Windows 10/11 **x64**；当前官网包为 unsigned NSIS |

不要在下载页承诺：

- Microsoft Store 一键安装（通道暂停）
- 「无 SmartScreen 警告」（unsigned 政策下不可承诺）
- Linux 正式安装包（尚未作为官网主产物）

---

## 5. Windows SmartScreen 文案（必须出现在 Windows 下载旁）

完整中英双语以 [`windows-website-distribution.md`](./windows-website-distribution.md) 为准。下载页最短摘要：

> 若 Windows 提示「已保护你的电脑」：点击 **更多信息** → **仍要运行**。请仅从 `https://dl.omnimux.ai/` 下载。

---

## 6. Agent / 工程约束

1. 改下载入口、用户指南、FAQ、官网文案时，**主链必须是 `dl.omnimux.ai`**。
2. 发新版本后：先 `dist:r2-sync` + `dist:r2-verify`，再改下载页版本号 / SHA256。
3. 未付费启用 Authenticode 前，不得把「已签名 / 商店可装」写进下载页。
4. 本规范与 `AGENTS.md` Release 段交叉引用；冲突时以本文件 + `release-sop.md` 为准。
