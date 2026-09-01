# Windows 官网分发契约（零额外签名费用）

本文档是 **当前有效** 的 Windows 公开发布契约。对外下载页的信息架构与主 CTA 规范见 [download-page-spec.md](./download-page-spec.md)。

## 决策（2026）

| 渠道 | 状态 | 说明 |
|---|---|---|
| **官网 / CDN（`dl.omnimux.ai`）** | **主路径** | 使用 `yarn dist:win` 产出的 **unsigned** x64 NSIS |
| **Microsoft Store Win32** | **暂停** | Policy 10.2.9 要求 Trusted Root Authenticode；在未付签名费前不再重提 |
| **Azure Trusted Signing / OV·EV** | **可选未来项** | 付费后才启用；实现骨架见 `windows-trusted-signing-sop.md`，**不得**当作当前发版默认 |

Partner Center 个人开发者一次性注册费 ≠ 代码签名费。商店拒审报告 `aebe26db-16c8-4aa4-abe8-62963eca5bba`（`Unsigned`）在零预算约束下的处理方式是：**停商店、保官网**。

---

## 发版命令

| 步骤 | 命令 | 说明 |
|---|---|---|
| 1 | `yarn omnimux:stage` | 物化 preset，防缺插件启动失败 |
| 2 | `node scripts/verify-version.mjs` | 根与 desktop 版本一致 |
| 3 | `yarn dist:win` | Windows x64 unsigned NSIS（官网包） |
| 4 | `yarn dist:r2-sync` | 上传 R2 / `dl.omnimux.ai` |
| 5 | `yarn dist:r2-verify` | CDN HEAD 巡检 |

禁止：

- ❌ 把 `yarn dist:win-release` 当作当前默认发版（需 Azure 付费凭据）
- ❌ 用 unsigned Package URL 再次提交 Microsoft Store
- ❌ 为“消 SmartScreen”去创建 Azure Trusted Signing Basic（$9.99/月），除非产品明确改回付费路线

---

## 用户侧：SmartScreen / 未知发布者说明（官网可复用文案）

未签名安装包在部分 Windows 机器上会出现 SmartScreen 或“未知发布者”。这是 **零签名费用分发的预期行为**，不是安装包损坏。

### 简体中文（下载页 / 帮助）

**Windows 提示“Windows 已保护你的电脑”或未知发布者时：**

1. 点击 **更多信息**
2. 再点击 **仍要运行**
3. 按安装向导完成安装（静默安装参数：`/S`）

请仅从官方地址下载：`https://dl.omnimux.ai/`  
如需校验完整性，请对照发布页提供的 SHA256。

### English (download page / help)

**If Windows SmartScreen shows “Windows protected your PC” or Unknown publisher:**

1. Click **More info**
2. Click **Run anyway**
3. Finish the installer (silent flag: `/S`)

Download only from `https://dl.omnimux.ai/`.  
Optionally verify the published SHA256 checksum.

---

## Agent 行为约束

1. 默认 Windows 公开发布 = 官网 unsigned + R2
2. 提到商店重提时，必须先确认用户愿意支付 Trusted Signing / OV·EV 费用
3. Azure Portal 若仍停在 “Create Artifact Signing Account”，**不要点 Create**（会产生月费资源）
