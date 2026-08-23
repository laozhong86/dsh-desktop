#!/usr/bin/env node
/**
 * OmniMux 插件运维主入口（本仓库作日常开发/测试/同步/发布入口）。
 *
 * 真源脚本在 sibling 产品树 dsh-plugin/product/omnimux-dsh/scripts/；
 * 本文件只做路径解析与命令转发，让 Agent / 人类只在 fork 仓库操作。
 *
 * 用法（yarn 包装见 package.json omnimux:*）：
 *   node scripts/omnimux.mjs sync [插件...]
 *   node scripts/omnimux.mjs sync --skip-build omnimux-assets
 *   node scripts/omnimux.mjs dev start <name> <plugin>
 *   node scripts/omnimux.mjs dev stop|ls|rm|watch|unwatch ...
 *   node scripts/omnimux.mjs doctor
 *   node scripts/omnimux.mjs restart
 *   node scripts/omnimux.mjs stage
 *   node scripts/omnimux.mjs path
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const forkRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultProduct = join(homedir(), 'Desktop/Project/dsh-plugin/product/omnimux-dsh')
const productRoot = process.env.OMNIMUX_PRODUCT_DIR
  ? resolve(process.env.OMNIMUX_PRODUCT_DIR)
  : defaultProduct
const pluginsRoot = process.env.OMNIMUX_PLUGINS_DIR
  ? resolve(process.env.OMNIMUX_PLUGINS_DIR)
  : join(productRoot, 'plugins')

function die(msg) {
  process.stderr.write(`✗ ${msg}\n`)
  process.exit(1)
}

function requireProduct() {
  if (!existsSync(join(productRoot, 'scripts/sync-to-app.sh'))) {
    die(`产品树缺失或不完整: ${productRoot}\n  设置 OMNIMUX_PRODUCT_DIR 指向 dsh-plugin/product/omnimux-dsh`)
  }
}

function runBash(scriptRel, args) {
  requireProduct()
  const script = join(productRoot, scriptRel)
  const env = {
    ...process.env,
    OMNIMUX_PLUGINS_DIR: pluginsRoot,
  }
  const result = spawnSync('bash', [script, ...args], {
    cwd: productRoot,
    env,
    stdio: 'inherit',
  })
  process.exit(result.status === null ? 1 : result.status)
}

function runYarnWorkspace(scriptName, args = []) {
  const result = spawnSync('corepack', ['yarn', 'workspace', 'dsh-plugin-desktop', 'run', scriptName, ...args], {
    cwd: forkRoot,
    env: {
      ...process.env,
      OMNIMUX_PLUGINS_DIR: pluginsRoot,
    },
    stdio: 'inherit',
  })
  process.exit(result.status === null ? 1 : result.status)
}

function restartApp() {
  spawnSync('pkill', ['-f', 'OmniMux.app'], { stdio: 'ignore' })
  // give Electron a beat to release locks
  spawnSync('sleep', ['1'], { stdio: 'ignore' })
  const open = spawnSync('open', ['-a', 'OmniMux'], { stdio: 'inherit' })
  if (open.status !== 0) die('open -a OmniMux 失败（确认已安装 /Applications/OmniMux.app）')
  process.stdout.write('✓ 已请求重启 OmniMux（手动确认窗口是否起来）\n')
}

function printHelp() {
  process.stdout.write(`OmniMux 插件运维入口（fork → 产品树）

产品树: ${productRoot}
插件源: ${pluginsRoot}

命令:
  sync [插件...] [--skip-build]   build + 物化进生产 profile（不自动重启）
  restart                         手动重启 /Applications/OmniMux.app
  dev <start|stop|ls|rm|watch|unwatch> ...
                                  L2 预发布环境（含统一 watch）
  doctor                          三层环境合规自检
  stage                           物化进 preset/plugins（发布前）
  path                            打印产品树 / 插件路径

示例:
  yarn omnimux:sync omnimux-assets
  yarn omnimux:dev start assets-v2 omnimux-assets
  yarn omnimux:restart
  yarn omnimux:stage
`)
}

const [cmd, ...rest] = process.argv.slice(2)
if (!cmd || cmd === '-h' || cmd === '--help') {
  printHelp()
  process.exit(0)
}

switch (cmd) {
  case 'sync':
    runBash('scripts/sync-to-app.sh', rest)
    break
  case 'dev':
    runBash('scripts/dev-env.sh', rest)
    break
  case 'doctor':
    runBash('scripts/dev-doctor.sh', rest)
    break
  case 'restart':
    restartApp()
    break
  case 'stage':
    if (!process.env.OMNIMUX_PLUGINS_DIR) {
      process.env.OMNIMUX_PLUGINS_DIR = pluginsRoot
    }
    runYarnWorkspace('stage:preset', rest)
    break
  case 'path':
    requireProduct()
    process.stdout.write(`product: ${productRoot}\nplugins: ${pluginsRoot}\nfork:    ${forkRoot}\n`)
    break
  default:
    die(`未知命令: ${cmd}\n\n跑 yarn omnimux:help 看用法`)
}
