# Agent Note: OmniMux desktop ecosystem map

Status: implemented

English | [中文](2026-08-21-omnimux-ecosystem-map.zh.md)

## What this note is

This note is the canonical map of how this repository — the OmniMux desktop (`omnimux-desktop-fork`) — sits inside the wider OmniMux project ecosystem. It exists so that any agent working in this workspace can discover the sibling repositories, what each one owns, and how data flows between them, without re-deriving the topology from scratch. Read it before touching plugin packaging, upstream pins, gateway-facing behavior, or anything that crosses repository boundaries.

## Ecosystem at a glance

| Layer | Repository | Location | Role |
| --- | --- | --- | --- |
| Official core | `deepseek-ai/deepseek-harness` | a sibling `deepseek-harness` checkout (clean clone, tracks upstream, currently `0.1.0-rc.8`) | Canonical DeepSeek Harness source used for tracking and comparison |
| Official desktop | `anywhere-labs/deepseek-harness-desktop` | this repository's `origin` remote | Upstream desktop project this fork is based on |
| Desktop fork | `laozhong86/omnimux-desktop-fork` | this repository (current workspace, v2.0.1) | The OmniMux-branded desktop product |
| Plugin development | local `dsh-plugin` workspace | the sibling `dsh-plugin` checkout | Where OmniMux DSH plugins are developed before shipping into the desktop preset |
| Gateway | `laozhong86/OmniMux` (fork of `QuantumNous/new-api`) | the sibling `OmniMux` checkout | Go gateway (Gin + GORM) running production on a VPS (blue-green) at `omnimux.ai` |

## Repository anatomy

This repository owns three workspace members plus one pinned upstream:

- `deepseek-harness/` — pinned upstream Git submodule at commit `99f6f02fecdb7dff40c3fbc9470f5907c29f74ca` (source `0.1.0-rc.7`), recorded in [`upstream.json`](../../../../upstream.json). Treat as read-only; an upstream update is a dedicated commit that changes only the gitlink and metadata.
- `dsh-plugin-desktop/` — the desktop product itself: Cordis Host and Client faces, Electron bootstrap, packaging, and release tests. Its `preset/plugins/` directory ships the OmniMux plugin family (`omnimux`, `omnimux-accounts`, `omnimux-assets`, `omnimux-gallery`, `omnimux-workflow`, plus `dsh-better-sidebar`).
- `dsh-community-fabric/` — community interoperability RFC scaffold. Documentation-only; must not declare loadable DSH or package entry points.
- `dsh-community-market/` — community plugin market shell. Complete and built into the desktop under Settings > Plugins (Plugin market tab).

## Data flow

```
OmniMux Go gateway (VPS, business logic: accounts, billing, video)
   ^ API calls over OMNIMUX_BASE_URL
OmniMux desktop (this repo: pinned rc.7 runtime + preset omnimux plugins + built-in market)
   ^ plugin sync (currently 0.1.1)
dsh-plugin/product/omnimux-dsh (plugin monorepo: omnimux hub + dsh-drama verticals)
```

- Desktop omnimux plugins talk to the gateway through `OMNIMUX_BASE_URL`. Only the cloud gateway encapsulates paid business logic; live paths require the official key and report `needs-omnimux`.
- Plugin source of truth is `dsh-plugin/product/omnimux-dsh` (a pnpm monorepo with `consume-not-fork` as its explicit principle — it consumes the official Harness plugin ecosystem, never forks it). The `omnimux` plugin (0.1.1) matches the desktop preset copy (0.1.1). `dsh-drama` (short-drama vertical) and `omnimux-market` exist in the plugin repo but are not yet in the desktop preset, so they are not shipped in the packaged desktop.

## Version and freshness facts

- Submodule pin is `0.1.0-rc.7`; official upstream has moved to `0.1.0-rc.8` (visible in the clean clone at a sibling `deepseek-harness` checkout). An upstream pin update is an open, standalone task and must stay separate from desktop behavior commits.
- `OmniMux/electron/` inside the gateway repo is the legacy desktop wrapper (wraps the Go binary); it is unrelated to this DSH-based desktop. Do not confuse the two.

## Guidance for agents

- Day-to-day plugin develop / browser QA / sync-to-app / release ops run from **this repository** via `yarn omnimux:*` (see root `AGENTS.md`). Source edits still land in `dsh-plugin/product/omnimux-dsh`.
- To push a daily iteration into the installed App: `yarn omnimux:sync <plugin>` then `yarn omnimux:restart` (does **not** re-package). To change what ships inside a new install package: `yarn omnimux:stage` then `package:dir` / `dist:*`.
- To compare against or adopt newer upstream behavior: consult the clean clone a sibling `deepseek-harness` checkout, then propose a dedicated submodule pin update.
- To touch gateway-facing behavior (billing, video generation, account flows): the contract lives in the gateway repo and the `dsh-plugin` docs (`docs/contracts/hub.md`, `docs/decisions/2026-08-16-harness-consume-not-fork.md`).
- This map documents local absolute paths; on a different machine, locate siblings by repository identity rather than by path.

## Alternatives considered

**Keep the topology implicit in each repository's own AGENTS.md.** Each repo describes only its own internals, so no single place explains how desktop, plugins, and gateway relate; agents re-derive the map each time. The dedicated ecosystem note gives one discoverable, authoritative entry point referenced from this repository's AGENTS.md.
