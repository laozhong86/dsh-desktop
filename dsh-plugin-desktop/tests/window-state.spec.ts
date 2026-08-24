import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  calculateOverlapArea,
  validateWindowState,
  loadWindowState,
  saveWindowState,
  attachWindowStateTracker,
  type ScreenLike,
} from '../src/window-state.ts'
import type { DesktopWindowConfig } from '../src/runtime.ts'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('window-state management', () => {
  const defaultConfig: DesktopWindowConfig = {
    mode: 'compatibility',
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 640,
  }

  const mockScreen: ScreenLike = {
    getAllDisplays: () => [
      { workArea: { x: 0, y: 0, width: 1920, height: 1080 }, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
      { workArea: { x: 1920, y: 0, width: 2560, height: 1440 }, bounds: { x: 1920, y: 0, width: 2560, height: 1440 } },
    ],
    getPrimaryDisplay: () => ({
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    }),
  }

  describe('calculateOverlapArea', () => {
    it('calculates full containment and partial overlap correctly', () => {
      const a = { x: 0, y: 0, width: 100, height: 100 }
      const b = { x: 50, y: 50, width: 100, height: 100 }
      expect(calculateOverlapArea(a, b)).toBe(50 * 50)
    })

    it('returns 0 for disjoint rectangles', () => {
      const a = { x: 0, y: 0, width: 100, height: 100 }
      const b = { x: 200, y: 200, width: 100, height: 100 }
      expect(calculateOverlapArea(a, b)).toBe(0)
    })
  })

  describe('validateWindowState', () => {
    it('falls back to default config for empty or undefined state', () => {
      const result = validateWindowState(undefined, mockScreen, defaultConfig)
      expect(result).toEqual({
        width: 1280,
        height: 840,
        isMaximized: false,
        isFullScreen: false,
      })
    })

    it('preserves valid geometry inside active displays', () => {
      const saved = { x: 100, y: 100, width: 1400, height: 900, isMaximized: false }
      const result = validateWindowState(saved, mockScreen, defaultConfig)
      expect(result).toEqual({
        x: 100,
        y: 100,
        width: 1400,
        height: 900,
        isMaximized: false,
        isFullScreen: false,
      })
    })

    it('preserves coordinates on secondary monitor', () => {
      const saved = { x: 2000, y: 100, width: 1400, height: 900 }
      const result = validateWindowState(saved, mockScreen, defaultConfig)
      expect(result.x).toBe(2000)
      expect(result.y).toBe(100)
    })

    it('drops coordinates when window is outside all active monitors (e.g. disconnected display)', () => {
      const saved = { x: 6000, y: 3000, width: 1200, height: 800 }
      const result = validateWindowState(saved, mockScreen, defaultConfig)
      expect(result.x).toBeUndefined()
      expect(result.y).toBeUndefined()
      expect(result.width).toBe(1200)
      expect(result.height).toBe(800)
    })

    it('enforces minWidth and minHeight constraints', () => {
      const saved = { x: 50, y: 50, width: 400, height: 300 }
      const result = validateWindowState(saved, mockScreen, defaultConfig)
      expect(result.width).toBe(defaultConfig.minWidth)
      expect(result.height).toBe(defaultConfig.minHeight)
    })
  })

  describe('file storage and tracker', () => {
    let tempDir: string

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'dsh-window-state-test-'))
    })

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true })
    })

    it('saves and loads window state from file', () => {
      const filePath = join(tempDir, 'window-state.json')
      saveWindowState(filePath, {
        x: 150,
        y: 150,
        width: 1300,
        height: 850,
        isMaximized: true,
        isFullScreen: false,
      })

      const loaded = loadWindowState(filePath, mockScreen, defaultConfig)
      expect(loaded).toEqual({
        x: 150,
        y: 150,
        width: 1300,
        height: 850,
        isMaximized: true,
        isFullScreen: false,
      })
    })

    it('handles corrupted JSON gracefully', () => {
      const filePath = join(tempDir, 'corrupted.json')
      saveWindowState(filePath, { width: 1000, height: 700 } as any)
      // overwrite with corrupt content
      saveWindowState(filePath, 'not json' as any)

      const loaded = loadWindowState(filePath, mockScreen, defaultConfig)
      expect(loaded.width).toBe(defaultConfig.width)
      expect(loaded.height).toBe(defaultConfig.height)
    })

    it('tracks window resize and move events and flushes on close', () => {
      const filePath = join(tempDir, 'tracked.json')
      const handlers = new Map<string, () => void>()

      let bounds = { x: 100, y: 100, width: 1200, height: 800 }
      let maximized = false

      const fakeWindow: any = {
        isDestroyed: () => false,
        getBounds: () => bounds,
        isMaximized: () => maximized,
        isMinimized: () => false,
        isFullScreen: () => false,
        on: (event: string, fn: () => void) => { handlers.set(event, fn) },
        off: (event: string, fn: () => void) => { handlers.delete(event) },
      }

      const cleanup = attachWindowStateTracker({
        window: fakeWindow,
        filePath,
        screenApi: mockScreen,
        debounceMs: 50,
      })

      // Simulate window moving and resizing
      bounds = { x: 200, y: 250, width: 1400, height: 950 }
      handlers.get('resize')?.()
      handlers.get('move')?.()

      // Close should immediately flush
      handlers.get('close')?.()

      const raw = JSON.parse(readFileSync(filePath, 'utf8'))
      expect(raw.x).toBe(200)
      expect(raw.y).toBe(250)
      expect(raw.width).toBe(1400)
      expect(raw.height).toBe(950)

      cleanup()
    })
  })
})
