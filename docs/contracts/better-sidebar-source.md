# Better-sidebar source and preset build contract

OmniMux owns its desktop integration of the community sidebar in this repository. The source is upstream `omdsh-dev/DSH-better-sidebar`; the desktop keeps a pinned source revision and a versioned patch series. `preset/plugins/dsh-better-sidebar` is generated output.

## Accepted design

1. Acquire the immutable upstream source revision recorded with the patch series. Validate its identity before applying any patch.
2. Apply standard Git patches to source files. Check application first; missing files, changed context, and already-applied patches are errors.
3. Install locked build dependencies and run the upstream build and package entry points. Both client registration channels and the host entry must come from this build.
4. Install the resulting local package through the existing preset staging flow. Verify provenance against the installed candidate before publishing it.
5. A failed fetch, verification, patch, build, install, or artifact check stops staging. The existing preset may remain intact after a failure, but the command fails and cannot report it as a newly built preset.

Do not patch compiled JavaScript, read sidebar code from an installed profile, or select arbitrary sidebar versions through environment variables. Updates change the source pin and patch series together and repeat the build and behavior verification.

## Pinned release evidence

The starting release is npm `dsh-better-sidebar@0.14.0`. Its npm provenance statement identifies Git commit `6c891514b544b6e2da51fdab2eb3436cc02da246`, tag `v0.14.0`, and upstream workflow `.github/workflows/release.yml`. The release tarball SHA-256 is `ef430c13135495ba62f552a5b45704cfda6cc70a35ef4caf6f818a7a33c732e8`.

The entire published `src/` tree was compared byte for byte with that Git revision. The evidence and per-file hashes are in [the release comparison](../evidence/sidebar-source-pipeline/release-source-comparison.json); [decoded npm statements](../evidence/sidebar-source-pipeline/npm-provenance-statements.json) retain the registry-reported source and build reference. This comparison verifies source equality; it is not an independent cryptographic signature verification of the attestation.

## Behavior preserved

- Settings use the sidebar preference namespace directly, without importing the removed `settingsNamespace()` runtime helper.
- Layout CSS variables survive width and height state updates and are released on component unmount.
- Width and corner pointer release write the final clamped dimensions into the DOM before ending drag state. Version 0.14.0 already implements this with `commitDrag()`; the superseded string replacements for those handlers did not match that release and are not carried forward.

## Deterministic build inputs

The upstream frozen lockfile (SHA-256 `f8e2934ca6ba60682610ff64cacd4e1ea53317a385d1bd5ead8cd724dd95da64`) and `pnpm@11.8.0` define the build dependency graph. Checkout disables line-ending conversion in its own temporary repository. The upstream CSS bundler emits absolute virtual-module paths and its native CSS export map has nondeterministic key order, so the desktop patch series normalizes build paths and sorts CSS export keys. Rebuilding in two independent directories must produce the same packaged sidebar files. Runtime and platform metadata belong in provenance, outside any timestamped claim of byte equality.

This guarantee covers the rebuilt sidebar package. Product plugin source snapshots and the full preset runtime dependency graph retain their own materialization contracts; this pipeline does not claim that arbitrary product sources produce an identical complete desktop application.

## Entry points

- Source pin, build, and artifact validation: [`build-patched-sidebar.ts`](../../dsh-plugin-desktop/scripts/better-sidebar/build-patched-sidebar.ts).
- Reviewable source and build changes: [`0.14.0/omnimux.patch`](../../patches/dsh-better-sidebar/0.14.0/omnimux.patch).
- Existing packaging entry: `yarn omnimux:stage` / `stage-preset-profile.ts`. The stage accepts product source and preset destination options; it does not accept a sidebar package/version override.
- Opt-in clean-build verification: `node dsh-plugin-desktop/tests/better-sidebar/verify-pipeline.mjs` from the repository root. It uses disposable directories and public source/dependency downloads. `SIDEBAR_PIPELINE_REPORT` selects the report destination.
- Compiled-client browser and Electron verification: [harness instructions](../../dsh-plugin-desktop/tests/better-sidebar/browser/README.md). Always provide the final built source directory explicitly; its `lib/client.js` must match the verified package hash.

The source package's `build` script performs equivalent cleanup using Node filesystem APIs before its original TypeScript and tsdown steps. Corepack commands on Windows use an explicit command shell with fixed command tokens and a separate working directory, as required for [Windows command scripts in Node](https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows). A real Windows build remains a separate platform validation when only macOS is available.

The installed package includes `omnimux-build.json`: source revision, patch and lockfile hashes, exact pnpm and observed Node versions, and source/runtime file hashes. The builder compares packed source and runtime bytes with its actual build; staging compares every packed file with the installed candidate. A patch change during construction aborts the build. Lifecycle scripts are disabled for dependency installation and packing, so the explicit upstream `build` owns the compiled output.

## Upgrading the source pin

Fetch and inspect the proposed upstream revision, update the source/version/lock constants together, and regenerate the standard patch from that exact source. Preserve only changes the desktop still needs. Run the opt-in verifier and compiled-client behavior checks before reviewing the change. Do not repair a failed patch by skipping a hunk or editing `preset/plugins/`.

For the starting release, the [legacy effective delta](../evidence/sidebar-source-pipeline/legacy-effective-delta.txt) records what the removed string replacements actually changed in the published source and JavaScript. The migrated runtime behavior is bounded by that evidence; deterministic build and packaging metadata changes are separate from sidebar layout behavior.

## Ownership and verification boundaries

The desktop patch series is the reusable source-change entry point for later sidebar work. Product plugins continue to consume the public sidebar API. Changes to the pinned Harness submodule are outside this contract.

This migration does not implement the tab layout design in `omnimux-dsh` #620 or close #579/#620. Build and automated behavior checks are distinct from current desktop UI acceptance. Shared Dev activation, push, PR creation, and release remain separate actions requiring authorization.
