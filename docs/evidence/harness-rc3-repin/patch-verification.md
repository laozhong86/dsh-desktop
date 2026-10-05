# Patch transplantability: 0.1.5-rc.1 -> 0.1.5-rc.3

Oracle: `patch -p1 --dry-run --forward --fuzz=0` (context-search semantics, fuzz disabled).
Cross-check recorded but not used as pass/fail: `git apply --check -p1` rejects zero-context hunks (`--unidiff-zero`), which patch(1), Yarn and pnpm all accept.

## Control (rc.1 patches vs rc.1 tarballs) — validates the oracle itself

patches 13/13 pass; hunks 40/40 pass

## Target (rc.1-named patches vs freshly built rc.3 tarballs)

| # | patch | package | hunks | hunks pass | git-apply hunks failed | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `dsh-agent-presets@0.1.5-rc.1.patch` | `@deepseek-ai/dsh-agent-presets` | 2 | 2/2 | 1 | **PASS** |
| 2 | `dsh-app-boot@0.1.5-rc.1.patch` | `@deepseek-ai/dsh-app-boot` | 5 | 5/5 | 0 | **PASS** |
| 3 | `dsh-client-modules@0.1.5-rc.1.patch` | `@deepseek-ai/dsh-client-modules` | 1 | 1/1 | 0 | **PASS** |
| 4 | `dsh-client-ui-directory-picker-browse@0.1.5-rc.1.patch` | `@deepseek-ai/dsh-client-ui-directory-picker-browse` | 13 | 13/13 | 0 | **PASS** |
| 5 | `dsh-client-ui-primitives@0.1.5-rc.1.patch` | `@deepseek-ai/dsh-client-ui-primitives` | 1 | 1/1 | 0 | **PASS** |
| 6 | `dsh-client-ui-settings-general@0.1.5-rc.1.patch` | `@deepseek-ai/dsh-client-ui-settings-general` | 2 | 2/2 | 0 | **PASS** |
| 7 | `dsh-host-directory-picker-browse@0.1.5-rc.1.patch` | `@deepseek-ai/dsh-host-directory-picker-browse` | 1 | 1/1 | 0 | **PASS** |
| 8 | `dsh-plugin-package-inventory-deepseek@0.1.5-rc.1.patch` | `@deepseek-ai/dsh-plugin-package-inventory-deepseek` | 1 | 1/1 | 0 | **PASS** |
| 9 | `dsh-settings@0.1.5-rc.1.patch` | `@deepseek-ai/dsh-settings` | 4 | 4/4 | 0 | **PASS** |
| 10 | `dsh-subprocess-local@0.1.5-rc.1.patch` | `@deepseek-ai/dsh-subprocess-local` | 1 | 1/1 | 0 | **PASS** |
| 11 | `dsh-web-app@0.1.5-rc.1.patch` | `@deepseek-ai/dsh-web-app` | 2 | 2/2 | 0 | **PASS** |
| 12 | `dsh-win32-process@0.1.5-rc.1.patch` | `@deepseek-ai/dsh-win32-process` | 2 | 2/2 | 0 | **PASS** |
| 13 | `dsh@0.1.5-rc.1.patch` | `@deepseek-ai/dsh` | 5 | 5/5 | 0 | **PASS** |

TOTAL: patches 13/13 pass; hunks 40/40 pass; repairs 0; failures 0.

## Non-DSH patches in `patches/` (NOT re-keyed, not part of the DSH runtime family)

- `app-builder-lib@26.15.7.patch`
- `fs-ext@2.1.1.patch`
- `open@11.0.1.patch`
- `pnpm@11.8.0.patch`
- `vscode-ripgrep@1.18.0.patch`

`patches/dsh-better-sidebar/<version>/omnimux.patch` is keyed by the better-sidebar package version, not by the DSH runtime version.
