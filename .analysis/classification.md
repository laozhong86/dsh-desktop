# Issue #3778 phase 1 — conflict classification

- merge base: `63e160ab43`
- ours (fork/omnimux): `dca12ebdd2`
- theirs (origin/master): `092e2ecef7`
- unmerged paths: **235**

## Bucket totals

| bucket | count |
| --- | --- |
| A | 104 |
| B | 68 |
| C | 63 |
| D | 0 |

## By group x bucket

| group | bucket | count |
| --- | --- | --- |
| dsh-community-market | B | 18 |
| dsh-plugin-desktop | A | 20 |
| dsh-plugin-desktop | B | 41 |
| dsh-plugin-desktop | C | 7 |
| dsh-plugin-desktop-beta | C | 51 |
| patches | A | 25 |
| patches | B | 2 |
| root/docs | A | 3 |
| root/docs | B | 5 |
| root/docs | C | 3 |
| scripts | B | 2 |
| scripts | C | 2 |
| vendor/dsh-runtime | A | 56 |

## Per-path

| code | bucket | path | reason |
| --- | --- | --- | --- |
| UU | A | `.agents/notes/implemented/architecture/2026-08-21-omnimux-ecosystem-map.i18n.yaml` | false rename pairing of bilingual hash sidecars |
| DU | A | `_deprecated/dsh-0.1.5-rc.2/dsh-settings-legacy-compat.spec.ts` | upstream _deprecated archive; the fork does not carry it |
| DU | A | `dsh-plugin-desktop/src/profile-selection-window.ts` | upstream source evolution, no fork delta at this path |
| UU | A | `dsh-plugin-desktop/tests/client-desktop-settings.spec.ts` | upstream test evolution (no brand assertion on our side) |
| DU | A | `dsh-plugin-desktop/tests/client-desktop-update-settings.spec.ts` | upstream test evolution (no brand assertion on our side) |
| UD | A | `dsh-plugin-desktop/tests/client-directory-picker-browse-patch.spec.ts` | upstream test evolution (no brand assertion on our side) |
| UU | A | `dsh-plugin-desktop/tests/client-environment.spec.ts` | upstream test evolution (no brand assertion on our side) |
| UD | A | `dsh-plugin-desktop/tests/desktop-network.spec.ts` | upstream test evolution (no brand assertion on our side) |
| UU | A | `dsh-plugin-desktop/tests/desktop-runtime-environment.spec.ts` | upstream test evolution (no brand assertion on our side) |
| UU | A | `dsh-plugin-desktop/tests/electron-runtime.spec.ts` | upstream test evolution (no brand assertion on our side) |
| UD | A | `dsh-plugin-desktop/tests/host-launch-environment.spec.ts` | upstream test evolution (no brand assertion on our side) |
| UD | A | `dsh-plugin-desktop/tests/main-window-state.spec.ts` | upstream test evolution (no brand assertion on our side) |
| UD | A | `dsh-plugin-desktop/tests/market-pnpm-integration.spec.ts` | upstream test evolution (no brand assertion on our side) |
| UU | A | `dsh-plugin-desktop/tests/notifications.spec.ts` | upstream test evolution (no brand assertion on our side) |
| DU | A | `dsh-plugin-desktop/tests/preset-resolution.spec.ts` | upstream test evolution (no brand assertion on our side) |
| UU | A | `dsh-plugin-desktop/tests/recovery-plugin-uninstall.spec.ts` | upstream test evolution (no brand assertion on our side) |
| UU | A | `dsh-plugin-desktop/tests/request-inventory-resolution.spec.ts` | upstream test evolution (no brand assertion on our side) |
| UU | A | `dsh-plugin-desktop/tests/setup-wizard-copy.spec.ts` | upstream test evolution (no brand assertion on our side) |
| UU | A | `dsh-plugin-desktop/tests/updates.spec.ts` | upstream test evolution (no brand assertion on our side) |
| UU | A | `dsh-plugin-desktop/tests/webserver.spec.ts` | upstream test evolution (no brand assertion on our side) |
| UD | A | `dsh-plugin-desktop/tests/windows-nsis-ab.spec.ts` | upstream test evolution (no brand assertion on our side) |
| UU | A | `dsh-plugin-desktop/tests/windows-pwsh-sandbox.spec.ts` | upstream test evolution (no brand assertion on our side) |
| DU | A | `patches/dsh-agent-presets@0.1.5-rc.2.patch` | deleted by us (superseded rc), updated upstream; keep deleted |
| DD | A | `patches/dsh-client-modules@0.1.5-rc.1.patch` | upstream-only patch for a superseded rc; the fork prunes it |
| UA | A | `patches/dsh-client-modules@0.1.5-rc.2.patch` | upstream-only patch for a superseded rc; the fork prunes it |
| AA | A | `patches/dsh-client-modules@0.2.1-rc.3.patch` | both sides added the identical active-rc patch (byte-identical) |
| DD | A | `patches/dsh-client-ui-directory-picker-browse@0.1.5-rc.1.patch` | upstream-only patch for a superseded rc; the fork prunes it |
| UA | A | `patches/dsh-client-ui-directory-picker-browse@0.1.5-rc.2.patch` | upstream-only patch for a superseded rc; the fork prunes it |
| DD | A | `patches/dsh-client-ui-primitives@0.1.5-rc.1.patch` | upstream-only patch for a superseded rc; the fork prunes it |
| UA | A | `patches/dsh-client-ui-primitives@0.1.5-rc.2.patch` | upstream-only patch for a superseded rc; the fork prunes it |
| AA | A | `patches/dsh-client-ui-primitives@0.2.1-rc.3.patch` | both sides added the identical active-rc patch (byte-identical) |
| DD | A | `patches/dsh-client-ui-settings-general@0.1.5-rc.1.patch` | upstream-only patch for a superseded rc; the fork prunes it |
| UA | A | `patches/dsh-client-ui-settings-general@0.1.5-rc.2.patch` | upstream-only patch for a superseded rc; the fork prunes it |
| AA | A | `patches/dsh-client-ui-settings-general@0.2.1-rc.3.patch` | both sides added the identical active-rc patch (byte-identical) |
| DD | A | `patches/dsh-host-directory-picker-browse@0.1.5-rc.1.patch` | upstream-only patch for a superseded rc; the fork prunes it |
| UA | A | `patches/dsh-host-directory-picker-browse@0.1.5-rc.2.patch` | upstream-only patch for a superseded rc; the fork prunes it |
| AA | A | `patches/dsh-host-directory-picker-browse@0.2.1-rc.3.patch` | both sides added the identical active-rc patch (byte-identical) |
| DD | A | `patches/dsh-plugin-package-inventory-deepseek@0.1.5-rc.1.patch` | upstream-only patch for a superseded rc; the fork prunes it |
| UA | A | `patches/dsh-plugin-package-inventory-deepseek@0.1.5-rc.2.patch` | upstream-only patch for a superseded rc; the fork prunes it |
| AA | A | `patches/dsh-plugin-package-inventory-deepseek@0.2.1-rc.3.patch` | both sides added the identical active-rc patch (byte-identical) |
| DU | A | `patches/dsh-settings@0.1.5-rc.2.patch` | deleted by us (superseded rc), updated upstream; keep deleted |
| DU | A | `patches/dsh-subprocess-local@0.1.5-rc.2.patch` | deleted by us (superseded rc), updated upstream; keep deleted |
| DD | A | `patches/dsh-web-app@0.1.5-rc.1.patch` | upstream-only patch for a superseded rc; the fork prunes it |
| UA | A | `patches/dsh-web-app@0.1.5-rc.2.patch` | upstream-only patch for a superseded rc; the fork prunes it |
| AA | A | `patches/dsh-web-app@0.2.1-rc.3.patch` | both sides added the identical active-rc patch (byte-identical) |
| DU | A | `patches/dsh-win32-process@0.1.5-rc.2.patch` | deleted by us (superseded rc), updated upstream; keep deleted |
| DU | A | `patches/dsh@0.1.5-rc.2.patch` | deleted by us (superseded rc), updated upstream; keep deleted |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-agent-loop-testkit-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-agent-presets-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-anonymous-user-id-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-api-gateway-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-api-remotes-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-api-session-controller-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-api-workspace-controller-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-atomic-write-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-brand-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-chunked-list-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-client-connection-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-client-file-upload-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-client-hmr-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-client-store-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-client-ui-dockkit-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-client-ui-renderer-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-client-ui-settings-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-cmdline-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-code-runtime-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-code-runtime-worker-thread-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-command-compact-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-commands-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-cordis-client-runner-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-cordis-host-runner-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-file-reference-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-fs-local-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-goal-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-headless-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-host-directory-picker-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-host-open-in-app-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-launch-environment-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-llm-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-output-retention-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-persona-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-repeat-tool-reminder-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-schedule-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-scope-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-session-format-v0-to-v1-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-session-persistence-jsonl-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-session-projection-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-session-telemetry-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-session-title-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-skill-badge-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-storage-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-storage-domain-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-storage-sqlite-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-tool-cordis-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-tools-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-typert-generator-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-typert-protocol-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-typert-registry-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-util-time-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-web-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-web-search-perplexity-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| DU | A | `vendor/dsh-runtime/0.1.5-rc.2/deepseek-ai-dsh-win32-process-0.1.5-rc.2.tgz` | old runtime vendor dir kept upstream, pruned by the fork (established policy) |
| UU | A | `yarn.lock` | regenerated by `corepack yarn install` |
| UU | B | `.gitignore` | union: upstream next/beta build dirs + our preset/worktree ignores |
| UU | B | `AGENTS.md` | keep both; append upstream's Next/variant bullets |
| UU | B | `PRIVACY.i18n.yaml` | bilingual hash sidecar; regenerate |
| UU | B | `README.i18n.yaml` | bilingual hash sidecar; regenerate |
| UU | B | `README.md` | docs merge: upstream sponsor table + our brand |
| UU | B | `dsh-community-market/docs/install-and-uninstall.i18n.yaml` | market refactor: follow upstream, keep our settings-persistence delta |
| UU | B | `dsh-community-market/package.json` | deps: schemastery bump + dropped upstream deps |
| UU | B | `dsh-community-market/src/catalog/source-store.ts` | market refactor: follow upstream, keep our settings-persistence delta |
| UU | B | `dsh-community-market/src/client/MarketSettingsTab.tsx` | market refactor: follow upstream, keep our settings-persistence delta |
| UU | B | `dsh-community-market/src/host/routes.ts` | market refactor: follow upstream, keep our settings-persistence delta |
| UU | B | `dsh-community-market/src/index.ts` | market refactor: follow upstream, keep our settings-persistence delta |
| UU | B | `dsh-community-market/src/install/github.ts` | market refactor: follow upstream, keep our settings-persistence delta |
| UU | B | `dsh-community-market/src/install/service.ts` | market refactor: follow upstream, keep our settings-persistence delta |
| UD | B | `dsh-community-market/tests/client-index.spec.ts` | market refactor: follow upstream, keep our settings-persistence delta |
| UD | B | `dsh-community-market/tests/client-launcher.spec.tsx` | market refactor: follow upstream, keep our settings-persistence delta |
| UU | B | `dsh-community-market/tests/client-overlay.spec.tsx` | market refactor: follow upstream, keep our settings-persistence delta |
| UU | B | `dsh-community-market/tests/host-routes.spec.ts` | market refactor: follow upstream, keep our settings-persistence delta |
| UD | B | `dsh-community-market/tests/market-host-lifecycle.spec.ts` | market refactor: follow upstream, keep our settings-persistence delta |
| UU | B | `dsh-community-market/tests/market-install.spec.ts` | market refactor: follow upstream, keep our settings-persistence delta |
| UU | B | `dsh-community-market/tests/market-runtime.spec.ts` | market refactor: follow upstream, keep our settings-persistence delta |
| UD | B | `dsh-community-market/tests/market-settings-persistence.spec.ts` | market refactor: follow upstream, keep our settings-persistence delta — BOUNDARY: owned by teammate #3776 — record only, do not resolve |
| UU | B | `dsh-community-market/tests/setup.tsx` | market refactor: follow upstream, keep our settings-persistence delta |
| UD | B | `dsh-community-market/tests/source-store.spec.ts` | market refactor: follow upstream, keep our settings-persistence delta |
| UU | B | `dsh-plugin-desktop/README.i18n.yaml` | docs: brand + upstream content |
| UU | B | `dsh-plugin-desktop/README.md` | docs: brand + upstream content |
| UU | B | `dsh-plugin-desktop/README.zh.md` | docs: brand + upstream content |
| UU | B | `dsh-plugin-desktop/build/app-icon-mac.png` | brand icon asset |
| UU | B | `dsh-plugin-desktop/build/app-icon.png` | brand icon asset |
| UD | B | `dsh-plugin-desktop/scripts/build-windows-nsis-ab.ts` | build/verify script chain: keep ours + absorb upstream flags |
| DU | B | `dsh-plugin-desktop/scripts/package-linux.ts` | build/verify script chain: keep ours + absorb upstream flags |
| UU | B | `dsh-plugin-desktop/scripts/verify-mac-smoke.ts` | build/verify script chain: keep ours + absorb upstream flags |
| UU | B | `dsh-plugin-desktop/scripts/verify-packaged-runtime.ts` | build/verify script chain: keep ours + absorb upstream flags |
| UU | B | `dsh-plugin-desktop/scripts/verify-profile-boot.mjs` | build/verify script chain: keep ours + absorb upstream flags |
| UU | B | `dsh-plugin-desktop/src/bin.ts` | CLI help string: keep `omnimux`, adopt upstream's `[folder]` |
| UU | B | `dsh-plugin-desktop/src/client/AdvancedFrame.tsx` | settings/layout UI: follow upstream rename, keep our narrow-screen + titlebar deltas |
| UU | B | `dsh-plugin-desktop/src/client/DesktopSettingsSection.tsx` | settings/layout UI: follow upstream rename, keep our narrow-screen + titlebar deltas |
| UU | B | `dsh-plugin-desktop/src/client/desktop-settings.ts` | settings/layout UI: follow upstream rename, keep our narrow-screen + titlebar deltas |
| UU | B | `dsh-plugin-desktop/src/client/extended-styles.ts` | settings/layout UI: follow upstream rename, keep our narrow-screen + titlebar deltas |
| UU | B | `dsh-plugin-desktop/src/client/index.ts` | settings/layout UI: follow upstream rename, keep our narrow-screen + titlebar deltas |
| UU | B | `dsh-plugin-desktop/src/client/layout-state.ts` | settings/layout UI: follow upstream rename, keep our narrow-screen + titlebar deltas |
| UU | B | `dsh-plugin-desktop/src/client/styles.ts` | settings/layout UI: follow upstream rename, keep our narrow-screen + titlebar deltas |
| UU | B | `dsh-plugin-desktop/src/electron-runtime.ts` | mechanical + next-transition-notice wiring |
| UU | B | `dsh-plugin-desktop/src/host-bootstrap.ts` | mechanical |
| UU | B | `dsh-plugin-desktop/src/host-process-entry.ts` | mechanical |
| UU | B | `dsh-plugin-desktop/src/native-dialog-copy.ts` | copy |
| DU | B | `dsh-plugin-desktop/src/native-ui/profile-selector/App.tsx` | setup-wizard / profile-selector UI copy |
| UU | B | `dsh-plugin-desktop/src/native-ui/setup-wizard/App.tsx` | setup-wizard / profile-selector UI copy |
| UU | B | `dsh-plugin-desktop/src/notifications.ts` | mechanical |
| UU | B | `dsh-plugin-desktop/src/packaged-runtime-smoke.ts` | mechanical |
| UU | B | `dsh-plugin-desktop/src/preload.ts` | mechanical |
| UU | B | `dsh-plugin-desktop/src/setup-wizard-contract.ts` | setup wizard contract/settings/copy |
| UU | B | `dsh-plugin-desktop/src/setup-wizard-settings.ts` | setup wizard contract/settings/copy |
| UU | B | `dsh-plugin-desktop/src/update-lifecycle.ts` | mechanical (channel plumbing) |
| UU | B | `dsh-plugin-desktop/src/windows-pwsh-sandbox.ts` | mechanical |
| UU | B | `dsh-plugin-desktop/tests/bin.spec.ts` | test carries a fork brand/port assertion -> keep our value, follow upstream structure |
| UD | B | `dsh-plugin-desktop/tests/installer-messages.spec.ts` | test carries a fork brand/port assertion -> keep our value, follow upstream structure |
| UU | B | `dsh-plugin-desktop/tests/package.spec.ts` | test carries a fork brand/port assertion -> keep our value, follow upstream structure — BOUNDARY: owned by teammate #3776 — record only, do not resolve |
| UU | B | `dsh-plugin-desktop/tests/plugin.spec.ts` | test carries a fork brand/port assertion -> keep our value, follow upstream structure |
| UU | B | `dsh-plugin-desktop/tests/profile.spec.ts` | test carries a fork brand/port assertion -> keep our value, follow upstream structure |
| UU | B | `dsh-plugin-desktop/tests/verify-mac-smoke.spec.ts` | test carries a fork brand/port assertion -> keep our value, follow upstream structure |
| UU | B | `dsh-plugin-desktop/tests/verify-packaged-runtime.spec.ts` | test carries a fork brand/port assertion -> keep our value, follow upstream structure |
| UU | B | `dsh-plugin-desktop/tests/verify-win-portable.spec.ts` | test carries a fork brand/port assertion -> keep our value, follow upstream structure |
| UU | B | `dsh-plugin-desktop/tsconfig.json` | mechanical union |
| UU | B | `dsh-plugin-desktop/tsconfig.tests.client.json` | mechanical union |
| AA | B | `patches/dsh-client-ui-directory-picker-browse@0.2.1-rc.3.patch` | active-rc patch content differs -> rebase the fork patch |
| AA | B | `patches/open@11.0.4.patch` | active-rc patch content differs -> rebase the fork patch |
| UU | B | `scripts/prepare-agents-anywhere-release.mjs` | single-package vs upstream AA_WORKSPACES |
| UU | B | `scripts/sync-vendored-runtime.mjs` | drop beta/other-channel branch (2026-09-12 decision) |
| UU | C | `.github/workflows/ci.yml` | packaging matrix moved to beta only; dsh-plugin-desktop dropped from CI; adds desktop-linux + Next Playwright gates |
| DU | C | `dsh-plugin-desktop-beta/README.i18n.yaml` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/README.md` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/README.zh.md` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/THIRD_PARTY_NOTICES.md` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/build/app-icon-mac.png` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/build/app-icon.png` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/build/installer.nsh` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/cordis.patch.yml` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/docs/plugin-services.md` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/docs/plugin-services.zh.md` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/package.json` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/scripts/verify-mac-release.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/scripts/verify-mac-smoke.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/scripts/verify-win-installer.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/client/DesktopSettingsSection.tsx` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/client/desktop-settings-styles.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/client/directory-picker.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/client/index.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/client/styles.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/desktop-browser-access.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/desktop-cli.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/desktop-terminal.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/diagnostics.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/host-process.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/lan-https-certificate.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/lan-https-ingress.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/lan-https-runtime.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/main.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/native-ui/vite-env.d.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/notifications.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/pnpm-policy.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/profiles.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/renderer-recovery.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/updates.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/webserver.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/src/window-material.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/tests/client-directory-picker.spec.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/tests/desktop-cli.spec.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/tests/desktop-terminal.spec.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/tests/diagnostics.spec.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/tests/host-process.spec.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/tests/lan-https-certificate.spec.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/tests/notifications.spec.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/tests/package.spec.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/tests/profiles.spec.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/tests/renderer-recovery.spec.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/tests/updates.spec.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/tsconfig.json` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/tsdown.config.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/vite.native-ui.config.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| DU | C | `dsh-plugin-desktop-beta/vitest.config.ts` | upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files |
| UU | C | `dsh-plugin-desktop/package.json` | brand/version(B) + asar smartUnpack->false, electron 43->44, dshmarket 1.38.1->1.70.1, pnpm 11.8->11.28 (C) |
| UU | C | `dsh-plugin-desktop/src/index.ts` | plugin inject surface + settings port creation reworked (inject gains 'settings'; createDesktopSettingsPort/watchUiThemeSource/watchPlatformLogin) |
| UU | C | `dsh-plugin-desktop/src/main.ts` | startup flow reordered by upstream (Setup Wizard rework, launchWorkspace hand-off, primary runtime, profileBoot, analytics call sites) |
| UU | C | `dsh-plugin-desktop/src/product-identity.ts` | identity table gains homeDirectoryName + beta packageName; beta identity is a C-level decision (2026-09-12) |
| UU | C | `dsh-plugin-desktop/src/profile.ts` | settings-row / preset-registry / upstream-analytics-row mechanism reworked |
| UU | C | `dsh-plugin-desktop/src/update-checker.ts` | release-channel mechanism: ours stable-only vs upstream stable|beta|next |
| UU | C | `dsh-plugin-desktop/src/update-download.ts` | artifact naming + version admission now channel-aware (DSH-NEXT / DSH-Desktop-Beta) |
| UU | C | `package.json` | workspaces/check/CI semantics: adopt dsh-desktop-next (+beta?) workspace, upstream drops dsh-plugin-desktop from `check` |
| DU | C | `scripts/verify-desktop-variants.mjs` | new next<->beta byte-parity gate (sync:beta-to-next / sync:next-to-beta) that the fork has no equivalent of |
| UU | C | `scripts/verify-layout.mjs` | hard-asserts the 5-workspace list incl. beta+next and next's upstream-reference pin |
| UU | C | `upstream.json` | reintroduces a beta channel, reversing the 2026-09-12 C-level single-stable decision |
