# OmniMux managed Profile materialization

The OmniMux Profile has one persistent package-source contract:

- Every Desktop-owned package source is a physical directory under
  `<profile>/.materialize-snapshots/plugins/<package-name>`.
- The Dev Profile directory, its `profiles` collection, `.omnimux-dev`
  boundary, snapshot root, plugin root, and package scope directories must be
  physical directories. Symlinks at those boundaries fail closed.
- The Profile manifest declares it as
  `file:.materialize-snapshots/plugins/<package-name>`.
- A package may retain a staged relative local edge such as
  `file:../dsh-ui-kit`. `optionalDependencies` overrides a same-name
  `dependencies` edge, matching pnpm semantics. An effective optional local
  edge may be absent for a platform-excluded package; if its target directory
  exists, the source must still be complete and valid. Required and
  Desktop-owned package sources must always exist.
- `node_modules`, including pnpm's `.ignored` directory, is installed output
  and is never an input source or recovery fallback.
- The Profile build policy permits only the reviewed `node-pty@1.1.0`
  registry build and its exact canonical managed-file source. An explicit
  denial at the package name, reviewed version, or managed source is preserved
  and stops materialization before publication.
- Candidate preparation normalizes a package's standard string `bin` field to
  the equivalent command map before pnpm consumes the local directory. This
  candidate-only manifest normalization preserves the declared executable in
  installed output; a missing or escaping declared bin fails before publish.

## Startup

A fresh Profile validates the complete packaged preset and every existing
destination boundary before writing settings. It assembles initialization in a
same-filesystem candidate, publishes the retry fence before other initialized
entries, and atomically renames `package.json` last as the commit point. Any
interruption before that rename remains a fresh, retryable initialization; any
interruption after it sees the fence and runs packaged pnpm before the first
Profile composition. The fence is removed only after that install succeeds. If
the Profile already exists, startup validates the managed declarations and source
closure, applies the release-channel gate, and then reconciles the managed
sources and the Harness Home's skills against the packaged preset.

Legacy self-references and damaged managed sources stop startup before repair
writes. The diagnostic always points to the explicit rebuild command; startup
does not silently migrate them.

## Reconciliation

An existing Profile is reconciled with the packaged preset on startup, so an
upgraded installer can deliver a new plugin or skill to a Profile that already
exists. The Profile keeps a ledger, `.omnimux-managed.json`, recording the digest
this desktop last installed for each managed source and skill, together with the
digest of the packaged distribution record.

- A source whose bytes still match the ledger is this desktop's own copy. When
  the packaged preset ships different bytes, the source is replaced through a
  same-filesystem candidate and an atomic rename, with the previous copy restored
  if the rename fails, and the ledger records the new digest.
- A source whose bytes no longer match the ledger was changed by the user. It is
  left exactly as it is, and the ledger keeps the earlier digest, so the next
  upgrade recognises the same edit instead of adopting it as a new baseline.
- A source the ledger has never seen — every source of a Profile installed before
  the ledger existed — is handled according to the home it lives in. In the
  released product's home (`~/.omnimux`), where this desktop is the only writer,
  an unrecorded source that differs from the packaged copy is replaced, so an
  upgrade reaches an existing user on the first launch after they install it.
  Everywhere else — the development home, a custom `$DSH_HOME` — `omnimux:sync`
  and the explicit rebuild write managed sources too, so the first pass records a
  baseline rather than overwriting content that may be deliberate.
- A skill missing from the Harness Home is installed. That is how a newly packaged
  skill reaches an existing Profile.

The record digest keeps the steady state cheap: when the packaged record is
unchanged, reconciliation reads that one file and returns without hashing a tree.
A ledger that cannot be parsed, or that carries an invalid digest, stops startup
instead of silently re-baselining.

## Explicit Dev rebuild

The only public recovery entry is:

```sh
yarn omnimux:profile rebuild --target dev --app /absolute/path/to/frozen/OmniMux.app
```

The command accepts `--target dev` or `--target prod`. The supplied app is resolved to a
frozen physical path and provides the authoritative preset, bundled pnpm,
Electron executable, and ABI version. The operation:

1. validates complete candidate source coverage and all retained non-candidate
   dependency declarations before writing;
2. prefers every valid existing managed source, so a later synchronized copy is
   never silently downgraded, and fills only physically absent owned sources
   from the candidate preset; a present damaged source fails closed;
3. assembles a temporary Profile on the same filesystem while preserving the
   current manifest, workspace policy, lockfile input, Profile-local install
   configuration and its relative sidecars (for example `.npmrc`, CA files,
   and pnpm hooks), bundles, user configuration, and legal third-party registry
   dependencies; these sidecars are temporary candidate inputs and are not
   published over the active copies; the upstream-generated
   `.dsh-module-fallback` symlink projection is excluded and left untouched for
   startup to regenerate;
4. invokes the existing packaged `materializeProfile` path with a real pnpm
   install, obtains each package's effective file set from bundled pnpm
   `pack --dry-run --json` with lifecycle scripts disabled, then verifies those
   source bytes, installed package identity, and every declared runtime entry's
   Node resolution inside that Profile's `node_modules`;
5. renames the complete dependency graph (`package.json`, lockfile, workspace,
   managed sources, and `node_modules`) behind a full backup; and
6. restores that whole graph after any publish failure. If rollback itself
   fails, the error reports and retains the backup directory.

An install failure never publishes the temporary graph. This command does not
launch the graphical application, stop an existing process, replace an app, or
write the production `~/.omnimux` home.

After the Desktop prerequisite and product synchronizer have both merged, the
authorized combined delivery sequence is: build one frozen candidate, stop the
old Dev app in the sole-owner window, run the full rebuild, synchronize the
frozen product plugin set, replace the complete Dev app, then perform installed
startup and acceptance checks. Those shared-state steps are not part of a code
implementation task.
