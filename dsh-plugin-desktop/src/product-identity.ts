/** OmniMux stable identity, aligned with electron-builder. */
export const DESKTOP_PRODUCT_IDENTITY = Object.freeze({
  releaseChannel: 'stable' as const,
  packageName: 'dsh-plugin-desktop',
  productName: 'OmniMux',
  appId: 'ai.omnimux.desktop',
})
export const DESKTOP_PACKAGE_NAME = DESKTOP_PRODUCT_IDENTITY.packageName
export const DESKTOP_PRODUCT_NAME = DESKTOP_PRODUCT_IDENTITY.productName
export const DESKTOP_APP_ID = DESKTOP_PRODUCT_IDENTITY.appId
export const DESKTOP_RELEASE_CHANNEL = DESKTOP_PRODUCT_IDENTITY.releaseChannel

/** Desktop is launcher-owned and cannot be installed as a Profile plugin. */
export const DESKTOP_PACKAGE_NAMES: ReadonlySet<string> = new Set([DESKTOP_PACKAGE_NAME])
