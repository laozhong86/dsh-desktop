/** Minimal context-isolated bridge for resolving operating-system drag payloads and window actions. */

import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { DESKTOP_FILE_PATH_BRIDGE } from './file-path-bridge-contract.ts'
import {
  DESKTOP_WINDOW_ACTION_BRIDGE,
  TITLEBAR_DOUBLE_CLICK_IPC_CHANNEL,
  type DesktopWindowActionBridge,
} from './window-actions-bridge-contract.ts'

contextBridge.exposeInMainWorld(DESKTOP_FILE_PATH_BRIDGE, {
  /** Resolve only genuine disk-backed Web File objects selected by the operator. */
  getPathForFile(file: File): string {
    return webUtils.getPathForFile(file)
  },
})

const windowActionBridge: DesktopWindowActionBridge = {
  handleTitleBarDoubleClick(): void {
    ipcRenderer.send(TITLEBAR_DOUBLE_CLICK_IPC_CHANNEL)
  },
}

contextBridge.exposeInMainWorld(DESKTOP_WINDOW_ACTION_BRIDGE, windowActionBridge)
