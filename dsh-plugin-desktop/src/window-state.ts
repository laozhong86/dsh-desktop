/** Persistent window state management with multi-monitor safety and debounce writing. */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { BrowserWindow, Rectangle, screen as ElectronScreen } from 'electron'
import type { DesktopWindowConfig } from './runtime.ts'

export interface PersistedWindowState {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized?: boolean
  isFullScreen?: boolean
  displayBounds?: Rectangle
}

export interface ScreenLike {
  getAllDisplays(): Array<{ workArea: Rectangle; bounds: Rectangle }>
  getPrimaryDisplay(): { workArea: Rectangle; bounds: Rectangle }
}

/** Calculate overlapping area between two rectangles. */
export function calculateOverlapArea(a: Rectangle, b: Rectangle): number {
  const overlapX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const overlapY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return overlapX * overlapY
}

/**
 * Validate and clamp saved window bounds against active screen displays.
 * If the saved window is outside all active displays or too small, fall back to safe bounds.
 */
export function validateWindowState(
  saved: Partial<PersistedWindowState> | undefined,
  screenApi: ScreenLike,
  defaults: DesktopWindowConfig,
): PersistedWindowState {
  const primary = screenApi.getPrimaryDisplay()
  const defaultWidth = Math.min(Math.max(defaults.width, defaults.minWidth), primary.workArea.width)
  const defaultHeight = Math.min(Math.max(defaults.height, defaults.minHeight), primary.workArea.height)

  if (!saved || typeof saved !== 'object') {
    return {
      width: defaultWidth,
      height: defaultHeight,
      isMaximized: false,
      isFullScreen: false,
    }
  }

  const width = typeof saved.width === 'number' && Number.isFinite(saved.width)
    ? Math.max(defaults.minWidth, Math.min(saved.width, 10_000))
    : defaultWidth
  const height = typeof saved.height === 'number' && Number.isFinite(saved.height)
    ? Math.max(defaults.minHeight, Math.min(saved.height, 10_000))
    : defaultHeight

  const candidate: PersistedWindowState = {
    width,
    height,
    isMaximized: Boolean(saved.isMaximized),
    isFullScreen: Boolean(saved.isFullScreen),
  }

  if (typeof saved.x === 'number' && typeof saved.y === 'number' && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
    const windowRect: Rectangle = { x: saved.x, y: saved.y, width, height }
    const displays = screenApi.getAllDisplays()
    // Check if the window overlaps with any active display's workArea by at least 100x100 pixels (or the full area if smaller)
    const minRequiredOverlap = Math.min(100 * 100, width * height * 0.2)
    const isVisible = displays.some(display => calculateOverlapArea(windowRect, display.workArea) >= minRequiredOverlap)

    if (isVisible) {
      candidate.x = saved.x
      candidate.y = saved.y
    }
  }

  return candidate
}

/** Load window state from a file safely. */
export function loadWindowState(
  filePath: string,
  screenApi: ScreenLike,
  defaults: DesktopWindowConfig,
): PersistedWindowState {
  try {
    const raw = readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<PersistedWindowState>
    return validateWindowState(parsed, screenApi, defaults)
  } catch {
    return validateWindowState(undefined, screenApi, defaults)
  }
}

/** Save window state to a file safely. */
export function saveWindowState(filePath: string, state: PersistedWindowState): void {
  try {
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8')
  } catch {
    // Fail-safe: persistence failure should never crash the app.
  }
}

export interface WindowStateTrackerOptions {
  window: BrowserWindow
  filePath: string
  screenApi: ScreenLike
  debounceMs?: number
}

/** Attach listeners to track and save BrowserWindow state. */
export function attachWindowStateTracker(options: WindowStateTrackerOptions): () => void {
  const { window, filePath, screenApi, debounceMs = 400 } = options
  let timer: NodeJS.Timeout | undefined
  let normalBounds: Rectangle = window.getBounds()

  const captureState = (): PersistedWindowState => {
    const isMaximized = window.isMaximized()
    const isFullScreen = window.isFullScreen()

    if (!isMaximized && !isFullScreen && !window.isMinimized()) {
      normalBounds = window.getBounds()
    }

    return {
      x: normalBounds.x,
      y: normalBounds.y,
      width: normalBounds.width,
      height: normalBounds.height,
      isMaximized,
      isFullScreen,
    }
  }

  const flush = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    if (!window.isDestroyed()) {
      saveWindowState(filePath, captureState())
    }
  }

  const scheduleSave = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      flush()
    }, debounceMs)
  }

  const onResize = (): void => { scheduleSave() }
  const onMove = (): void => { scheduleSave() }
  const onClose = (): void => { flush() }

  window.on('resize', onResize)
  window.on('move', onMove)
  window.on('close', onClose)

  return () => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    window.off('resize', onResize)
    window.off('move', onMove)
    window.off('close', onClose)
  }
}
