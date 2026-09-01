# Windows Azure Trusted Signing SOP（Microsoft Store 10.2.9 修复）

> **状态：可选 / 暂停默认。**  
> 当前产品决策是 **官网 unsigned 分发**（见 [windows-website-distribution.md](./windows-website-distribution.md)），**不再默认走本 SOP**。  
> 仅当产品明确恢复 Microsoft Store，并接受 Azure Trusted Signing（或 OV/EV）**付费** 时，才按本文执行。

本文档是 OmniMux Win32 商店提审因 **Policy 10.2.9（未签名 EXE）** 被拒后的**付费**修复契约。启用后 Agent / 人工发版按本 SOP 完成：**签名 → 校验 → 替换 CDN → 重提 Partner Center**。

相关认证报告：

- Product：`OmniMux`
- Product ID：`18c7607a-4248-4706-b796-c104bbf2ed42`
- Report：`aebe26db-16c8-4aa4-abe8-62963eca5bba`
- 失败包：`https://dl.omnimux.ai/releases/v2.0.4/OmniMux-2.0.4-x64-Setup.exe`
- 失败原因：`Unsigned`（需 SHA256+，证书链须进入 Microsoft Trusted Root Program）

官方参考：

- [Microsoft Store Policy 10.2.9](https://go.microsoft.com/fwlink/?linkid=2262002)
- [electron-builder Windows / Azure Trusted Signing](https://www.electron.build/code-signing-win.html)
- [Azure EnvironmentCredential](https://learn.microsoft.com/en-us/dotnet/api/azure.identity.environmentcredential)

---

## 0. 结论与路线选择

| 路线 | 说明 | 本仓库决策 |
|---|---|---|
| **官网 unsigned（零额外签名费）** | `yarn dist:win` + R2；接受 SmartScreen | **当前默认** |
| A. Azure Trusted Signing 签 EXE/MSI | 云端签，无私钥落盘；**按月/按次计费**；符合 10.2.9 | **暂停**（付费后可选） |
| B. 传统 OV/EV Authenticode | OV 可 p12；EV 常需硬件 token；通常年费 | 付费备选 |
| C. 转 MSIX 由商店代签 | 需另建/迁移 MSIX 产品名 | 仅当明确切商店形态 |

当前仓库状态：

- `dsh-plugin-desktop/scripts/package-win.ts` **故意** `signExecutable=false`，并剥离 `WIN_CSC_*`（官网默认）
- `release-win.ts` / `verify-win-signature.ts` / `dist:win-release` **已落地**，但 **默认 CI/发版不走它们**
- electron-builder（本仓 `app-builder-lib`）已支持 `win.azureSignOptions`
- `.github/workflows/release.yml` Windows job 使用 `dist:win`（website unsigned）

---

## 1. Azure 侧开通清单（人工，阻塞项）

按顺序完成；任一项未完成都不得宣称“可签名”。

### 1.1 账号与订阅

1. 准备可访问 Azure 的账号（建议与 Partner Center 主体一致或可授权给同一人）
2. 开通/选择一个 Azure Subscription
3. 注册 Resource Provider：`Microsoft.CodeSigning`（Trusted Signing）

### 1.2 Identity Validation（个人/组织）

1. 在 Azure Portal 创建 **Trusted Signing Account**
2. 发起 **Identity Validation**
   - Individual：个人身份核验（可能要求政府证件 / 视频核验）
   - Organization：组织核验（D-U-N-S / 工商信息等）
3. 等待状态变为 **Completed** 后才能创建可用于公共时间戳的证书配置

> 注意：Identity Validation 常是最长阻塞项（数小时到数天）。未完成前不要改 CI 期望“立刻能签”。

### 1.3 Certificate Profile

创建 Certificate Profile，记录：

| 字段 | 用途 | 示例 |
|---|---|---|
| `codeSigningAccountName` | Trusted Signing Account 名 | `omnimux-signing` |
| `certificateProfileName` | Certificate Profile 名 | `omnimux-win-release` |
| `endpoint` | 区域 Endpoint（必须与资源同区域） | `https://eus.codesigning.azure.net` |
| `publisherName` | 证书主体/发布者名（须与签名结果一致） | `Twinspace` / 核验通过后的法定名 |

`endpoint` 必须与 Account/Profile 所在区域对齐；填错会导致签名失败。

### 1.4 认证（给构建机 / CI）

electron-builder 的 Azure 签名走 PowerShell `Invoke-TrustedSigning`，认证使用 **Azure EnvironmentCredential** 环境变量之一套：

**推荐（CI / 本机服务主体）**

```bash
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
```

或证书登录：

```bash
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_CERTIFICATE_PATH=...
# 可选：AZURE_CLIENT_CERTIFICATE_PASSWORD=...
```

该 Service Principal / Managed Identity 需要对 Trusted Signing Account 具备签名权限（通常为 Trusted Signing Certificate Profile Signer 角色）。

### 1.5 构建宿主约束

- Azure Trusted Signing via electron-builder **需要 Windows 宿主**（内部装 `TrustedSigning` PowerShell 模块并调用 `Invoke-TrustedSigning`）
- 本机若只有 macOS：用 GitHub Actions `windows-latest`，或一台 Windows x64 构建机

---

## 2. 仓库脚本改造清单（工程）

### 2.1 必须新增

| 文件 | 职责 |
|---|---|
| `dsh-plugin-desktop/scripts/windows-release-preflight.ts` | Trusted Signing 凭据门禁（缺项直接 throw） |
| `dsh-plugin-desktop/scripts/release-win.ts` | 正式签名发布入口（对称 `release-mac.ts`） |
| `dsh-plugin-desktop/scripts/verify-win-signature.ts` | 校验 Setup.exe / 主 EXE 已 Authenticode 签名 |
| `dsh-plugin-desktop/tests/windows-release-preflight.spec.ts` | 凭据完整性 / endpoint / 密钥剥离 |
| `dsh-plugin-desktop/tests/release-win.spec.ts` | 缺凭据拒绝、secret 不泄漏到 gate、builder 参数 |
| `dsh-plugin-desktop/tests/verify-win-signature.spec.ts` | Valid / NotSigned 分支 |

### 2.2 仓库落地状态（相对当前默认）

| 文件 | 状态 |
|---|---|
| `package-win.ts` / `dist:win` | ✅ 保留为 **官网默认 unsigned** 路径 |
| `dist:win-release` + `release-win.ts` + 验签/单测 | ✅ 已落地，**仅付费启用时使用** |
| `docs/contracts/release-sop.md` / `windows-website-distribution.md` / `AGENTS.md` | ✅ 默认官网优先；本 SOP 为可选 |
| `.github/workflows/release.yml` | ✅ Windows job 默认 `dist:win`；**不要**在未付费决策前改回强制 `dist:win-release` |

重新启用本 SOP 时：先完成 §1 Azure 付费资源，再把 release workflow 的 Windows job 切到 `dist:win-release` 并注入 secrets。

### 2.3 electron-builder 配置形状（目标）

在 `release-win.ts` 调用 builder 时注入（不要把密钥写进仓库 JSON）：

```ts
{
  win: {
    // 不要同时设置 signtoolOptions
    azureSignOptions: {
      publisherName: process.env.OMNIMUX_WIN_PUBLISHER_NAME!,
      endpoint: process.env.OMNIMUX_WIN_TRUSTED_SIGNING_ENDPOINT!,
      codeSigningAccountName: process.env.OMNIMUX_WIN_TRUSTED_SIGNING_ACCOUNT!,
      certificateProfileName: process.env.OMNIMUX_WIN_TRUSTED_SIGNING_PROFILE!,
      fileDigest: 'SHA256',
      timestampRfc3161: 'http://timestamp.acs.microsoft.com',
      timestampDigest: 'SHA256',
    },
  },
}
```

对应环境变量契约：

| Env | 必填 | 说明 |
|---|---|---|
| `AZURE_TENANT_ID` | 是 | Entra ID |
| `AZURE_CLIENT_ID` | 是 | App registration |
| `AZURE_CLIENT_SECRET` 或证书路径 | 是 | 二选一 |
| `OMNIMUX_WIN_TRUSTED_SIGNING_ENDPOINT` | 是 | 区域 endpoint |
| `OMNIMUX_WIN_TRUSTED_SIGNING_ACCOUNT` | 是 | Account name |
| `OMNIMUX_WIN_TRUSTED_SIGNING_PROFILE` | 是 | Profile name |
| `OMNIMUX_WIN_PUBLISHER_NAME` | 是 | 与证书 CN/发布者一致 |
| `OMNIMUX_WIN_SIGN` | 否 | `1` 时允许 package-win 走签名分支 |

### 2.4 `release-win.ts` 行为铁律

1. **缺任一必填 env → 直接 throw**（禁止静默回退到 unsigned）
2. 先跑现有 win package gate / `yarn omnimux:stage`
3. 产出 NSIS：`OmniMux-<version>-x64-Setup.exe`（及兼容别名若仍需要）
4. 调用 `verify-win-signature.ts`；失败则禁止上传 R2
5. 不在日志中打印 secret / client secret / 证书内容

### 2.5 验签命令（验收标准）

在 Windows 上至少满足：

```powershell
# 安装包与主程序都应有签名
Get-AuthenticodeSignature .\OmniMux-<version>-x64-Setup.exe | Format-List *
Get-AuthenticodeSignature .\win-unpacked\OmniMux.exe | Format-List *
```

通过标准：

- `Status = Valid`
- 哈希算法为 SHA256 或更高
- SignerCertificate 链可到受信任根（Microsoft Trusted Root Program 内 CA）

也可辅助：

```bash
osslsigncode verify -in OmniMux-<version>-x64-Setup.exe
```

---

## 3. 发版与重提 SOP（操作顺序）

### 3.1 构建签名包

```bash
# 1) 插件物化（铁律）
yarn omnimux:stage

# 2) 在 Windows x64 + Azure 凭据环境下
yarn dist:win-release
# 或：node dsh-plugin-desktop/scripts/release-win.ts
```

### 3.2 本地/CI 验签门禁

```bash
node dsh-plugin-desktop/scripts/verify-win-signature.ts \
  --setup dist/path/to/OmniMux-<version>-x64-Setup.exe
```

未通过 = 不得同步 CDN，不得改 Partner Center 包 URL。

### 3.3 同步 Cloudflare R2

优先发 **新补丁版本**（推荐 `2.0.5`），避免覆写已审失败的 `v2.0.4` 历史对象语义混乱：

```bash
yarn dist:r2-sync
yarn dist:r2-verify
```

目标 URL 示例：

- `https://dl.omnimux.ai/releases/v2.0.5/OmniMux-2.0.5-x64-Setup.exe`
- 同步更新 `releases/latest/*`

若必须原地替换 `v2.0.4`：仍需重新上传并验证 Content-Length / HEAD，且 Partner Center 包记录要重新 Save + 重跑 validation。

### 3.4 Partner Center 重提

1. Overview → 当前为 **草稿中 / 失败可修复** → **重新提交**
2. Packages：
   - Package URL 改为**已签名** CDN 地址
   - Arch：`x64`
   - Silent：`/S`
   - Success exit code：`0`
3. 点击保存后 **Run validation**
4. 确认 Code sign check 不再报 Unsigned
5. Store listing / Age ratings / Availability / Properties 无回归后 Submit

Certification notes 建议附一句：

> Resubmission addresses 10.2.9 by signing the NSIS installer and PE files with Azure Trusted Signing (SHA256 + Microsoft timestamp). Package URL: https://dl.omnimux.ai/releases/vX.Y.Z/OmniMux-X.Y.Z-x64-Setup.exe

---

## 4. 最小工期拆分

| 阶段 | Owner | 产出 | 依赖 |
|---|---|---|---|
| P0 Azure 开通 + Identity Validation | 账号持有人 | Account / Profile / endpoint / publisherName | Azure 订阅 |
| P1 仓库 `release-win.ts` + 验签脚本 | 工程 | 可在 Windows CI 签名的命令 | P0 字段 |
| P2 打出签名包并 R2 同步 | 工程 | 新版本 CDN URL | P1 |
| P3 Partner Center 重提 | 交付 | 再次进入 In review | P2 + validation |

---

## 5. 明确非目标 / 禁止事项

- ❌ 不要用自签证书或非 Trusted Root 链“应付”10.2.9
- ❌ 不要把 `AZURE_CLIENT_SECRET` / 证书私钥提交进仓库
- ❌ 不要在未验签通过时上传 `latest/`
- ❌ 不要为了躲签名去删 Win32 产品改 MSIX，除非明确切换路线 C
- ❌ `yarn dist:win`（unsigned smoke）不得被文档再描述为“可提审商店包”

---

## 6. 完成定义（DoD）

同时满足才算本 SOP 闭环：

1. Windows 构建产物 Authenticode `Valid` 且 SHA256+
2. CDN HEAD 校验通过，Partner Center Package URL 指向签名包
3. Package validation 的 Code sign check 通过或至少不再显示 `Unsigned`
4. 重新提交后 Overview 回到 **In review**（或 Published）
5. 本契约与 `release-sop.md` / `AGENTS.md` 已同步，不再把 unsigned `dist:win` 当作商店包
