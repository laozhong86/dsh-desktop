import { describe, expect, it } from 'vitest'
import { desktopNativeCopy } from '../src/native-dialog-copy.ts'
import { desktopProfileCreateCopy } from '../src/profile-create-copy.ts'
import { desktopRecoveryCopy } from '../src/recovery-copy.ts'
import { desktopRestartConfirmationCopy, desktopTrayLabel } from '../src/tray-locale.ts'

describe('Desktop product copy', () => {
  it.each(['en', 'zh'] as const)('reuses the Safe Mode confirmation in %s native menus', locale => {
    const copy = desktopRecoveryCopy(locale)
    expect(desktopTrayLabel(locale, 'enterSafeMode')).toBe(locale === 'zh' ? '进入安全模式…' : 'Enter Safe Mode…')
    expect(desktopRestartConfirmationCopy(locale, 'safe-mode')).toEqual({
      title: copy.confirmSafeMode,
      message: copy.confirmSafeModeMessage,
      detail: copy.confirmSafeModeBody,
      confirm: copy.confirmSafeModeAction,
      cancel: copy.cancel,
    })
  })

  it('uses Profile consistently for product-level configuration sets', () => {
    expect(desktopProfileCreateCopy('zh')).toMatchObject({
      title: '新建 Profile',
      label: 'Profile 名称',
      submit: '创建 Profile',
    })
    expect(desktopTrayLabel('zh', 'profile', 'work')).toBe('Profile：work')
    expect(desktopTrayLabel('zh', 'addProfile')).toBe('新建 Profile…')
  })

  it('separates Recovery Mode from checkpoint rollback', () => {
    const copy = desktopRecoveryCopy('zh')
    expect(copy.tabs.quick).toBe('快速恢复')
    expect(copy.tabs.diagnostics).toBe('诊断')
    expect(copy.tabs.rollback).toBe('回滚')
    expect(copy.rollbackCheckpoint).toBe('回滚到此槽位')
    expect(copy.back).toBe('返回')
    expect(copy.confirmRollbackBody('2026/8/25 10:00:00')).toContain('当前 Profile')
    expect(copy.confirmRollbackBody('2026/8/25 10:00:00')).toContain('settings.yaml')
    expect(copy.confirmRollbackBody('2026/8/25 10:00:00')).toContain('DSH home 补丁')
    expect(copy.safeModeBody).toContain('不读取默认的 ~/.dsh')
    expect(copy.safeModeBody).toContain('退出或重启安全模式后，下一次普通启动会自动删除')
    expect(copy.safeModeActiveBody).toBe('当前恢复流程已处于安全模式。你可以回滚或切换临时 Profile；重启后将退出安全模式。')
    expect(copy.safeModeNotificationBody).toContain('重启或退出后再普通启动')
    expect(copy.quickRecoveryBody).toBe('您可以先进入安全模式，使用独立环境排查问题；也可以考虑卸载异常插件，或者直接回滚至上一次正常启动前的配置，或切换到其他 Profile。修改后需要重启才能生效。')
    expect(copy.profileGuideBody).toBe('Profile 是一套 DSH 运行配置，决定启动时加载哪些插件，不同Profile的插件信息不共享；同一个 DSH Home 下的多个 Profile 仍共享会话和工作区数据。')
  })

  it('ships localized native update and failure dialogs', () => {
    const copy = desktopNativeCopy('zh')
    expect(copy.updateCheckFailedTitle).toBe('无法检查更新')
    expect(copy.terminalErrorTitle).toBe('无法打开 DSH 终端')
    expect(copy.diagnosticsErrorTitle).toBe('无法导出诊断信息')
    expect(copy.updateAvailableMessage('2.1.0')).toBe('DSH Desktop 2.1.0 已可用。')
  })

})
