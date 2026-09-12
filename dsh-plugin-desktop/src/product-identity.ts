/**
 * OmniMux edition identities.
 *
 * `stable` is the shipped OmniMux product. The second entry describes this
 * repo's development edition: the same npm package and binary identity, stamped
 * as `OmniMux Dev` by `scripts/stamp-dev-app.mjs`. Upstream's release-channel
 * enum only models `stable` and `beta`, so the development edition keeps the
 * `beta` slot to stay aligned with the updater and profile-checkpoint contracts.
 */
export const DESKTOP_RELEASE_IDENTITIES = Object.freeze({
  stable: Object.freeze({
    releaseChannel: 'stable' as const,
    packageName: 'dsh-plugin-desktop',
    productName: 'OmniMux',
    appId: 'ai.omnimux.desktop',
  }),
  beta: Object.freeze({
    releaseChannel: 'beta' as const,
    packageName: 'dsh-plugin-desktop',
    // Must match the Dev app's real userData directory (`<appData>/OmniMux-Dev`,
    // set in main.ts); cross-edition evidence is located through this name.
    productName: 'OmniMux-Dev',
    appId: 'ai.omnimux.desktop',
  }),
})

export type DesktopProductIdentity = typeof DESKTOP_RELEASE_IDENTITIES[keyof typeof DESKTOP_RELEASE_IDENTITIES]

/** OmniMux stable identity, aligned with electron-builder. */
export const DESKTOP_PRODUCT_IDENTITY = DESKTOP_RELEASE_IDENTITIES.stable
export const OTHER_DESKTOP_PRODUCT_IDENTITY = DESKTOP_RELEASE_IDENTITIES.beta
export const DESKTOP_PACKAGE_NAME = DESKTOP_PRODUCT_IDENTITY.packageName
export const BETA_DESKTOP_PACKAGE_NAME = OTHER_DESKTOP_PRODUCT_IDENTITY.packageName
export const DESKTOP_PRODUCT_NAME = DESKTOP_PRODUCT_IDENTITY.productName
export const DESKTOP_APP_ID = DESKTOP_PRODUCT_IDENTITY.appId
export const DESKTOP_RELEASE_CHANNEL = DESKTOP_PRODUCT_IDENTITY.releaseChannel

/** Both Desktop editions are launcher-owned, never Profile plugins. */
export const DESKTOP_PACKAGE_NAMES: ReadonlySet<string> = new Set([
  DESKTOP_PACKAGE_NAME,
  BETA_DESKTOP_PACKAGE_NAME,
])
