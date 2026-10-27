#!/usr/bin/env python3
"""Issue #3778 phase 1 — classify the unmerged paths of origin/master -> fork/omnimux.

Read-only over the conflicted worktree. Emits classification.json + classification.md.
Bucket rules follow docs/contracts/upstream-sync.md (A/B/C/D).
"""
import json
import os
import subprocess
import sys
from collections import Counter, OrderedDict

WT = os.environ.get("OMNIMUX_WT", "")


def git(*args):
    return subprocess.run(["git", *args], cwd=WT, capture_output=True, text=True, check=True).stdout


def unmerged():
    out = git("status", "--porcelain")
    rows = []
    for line in out.splitlines():
        code, path = line[:2], line[3:]
        if code in {"DD", "AU", "UD", "UA", "DU", "AA", "UU"}:
            rows.append((code, path))
    return rows


# --- explicit rules (first match wins) -------------------------------------
BRAND_RE = ("OmniMux", "omnimux", "ai.omnimux", "44120", "45120")


def same_blob(path):
    a = git("rev-parse", f"HEAD:{path}").strip()
    b = git("rev-parse", f"origin/master:{path}").strip()
    return a == b


def has_brand_literal(path):
    full = os.path.join(WT, path)
    if not os.path.exists(full):
        return False
    with open(full, errors="ignore") as fh:
        text = fh.read()
    return any(token in text for token in BRAND_RE)


def bucket(code, path):
    # ---- C: structural / product decisions (contract §C) ----
    C_STRUCT = {
        "dsh-plugin-desktop/src/main.ts": "startup flow reordered by upstream (Setup Wizard rework, launchWorkspace hand-off, primary runtime, profileBoot, analytics call sites)",
        "dsh-plugin-desktop/src/index.ts": "plugin inject surface + settings port creation reworked (inject gains 'settings'; createDesktopSettingsPort/watchUiThemeSource/watchPlatformLogin)",
        "dsh-plugin-desktop/src/profile.ts": "settings-row / preset-registry / upstream-analytics-row mechanism reworked",
        "dsh-plugin-desktop/src/update-checker.ts": "release-channel mechanism: ours stable-only vs upstream stable|beta|next",
        "dsh-plugin-desktop/src/update-download.ts": "artifact naming + version admission now channel-aware (DSH-NEXT / DSH-Desktop-Beta)",
        "dsh-plugin-desktop/src/product-identity.ts": "identity table gains homeDirectoryName + beta packageName; beta identity is a C-level decision (2026-09-12)",
        "dsh-plugin-desktop/package.json": "brand/version(B) + asar smartUnpack->false, electron 43->44, dshmarket 1.38.1->1.70.1, pnpm 11.8->11.28 (C)",
        "package.json": "workspaces/check/CI semantics: adopt dsh-desktop-next (+beta?) workspace, upstream drops dsh-plugin-desktop from `check`",
        "upstream.json": "reintroduces a beta channel, reversing the 2026-09-12 C-level single-stable decision",
        "scripts/verify-layout.mjs": "hard-asserts the 5-workspace list incl. beta+next and next's upstream-reference pin",
        ".github/workflows/ci.yml": "packaging matrix moved to beta only; dsh-plugin-desktop dropped from CI; adds desktop-linux + Next Playwright gates",
    }
    if path in C_STRUCT:
        return "C", C_STRUCT[path]

    if path.startswith("dsh-plugin-desktop-beta/"):
        return "C", "upstream maintains the Beta variant package; fork dropped it in 2026-09-12 (C). 51 modify/delete + 219 new files"
    if path.startswith("dsh-desktop-next/"):
        return "C", "the Next shell package itself: introduction mode decision"
    if path in {"scripts/verify-desktop-variants.mjs"}:
        return "C", "new next<->beta byte-parity gate (sync:beta-to-next / sync:next-to-beta) that the fork has no equivalent of"
    if path == "dsh-plugin-desktop/src/desktop-plugins.ts":
        return "C", "IMMUTABLE_BUNDLES expansion (dshmarket, @agents-anywhere/dsh-bridge-next)"

    # ---- D: refused outright ----
    if path in {"LICENSE", "dsh-desktop-next/LICENSE.upstream"}:
        return "D", "license change"

    # ---- patches/: superseded-rc bookkeeping is mechanical, active-rc is not ----
    if path.startswith("patches/"):
        if code == "AA" and same_blob(path):
            return "A", "both sides added the identical active-rc patch (byte-identical)"
        if code in {"DD", "UA"}:
            return "A", "upstream-only patch for a superseded rc; the fork prunes it"
        if code == "DU":
            return "A", "deleted by us (superseded rc), updated upstream; keep deleted"
        return "B", "active-rc patch content differs -> rebase the fork patch"

    # ---- B: template resolution (brand / build chain / docs / deps) ----
    B_RULES = [
        ("AGENTS.md", "keep both; append upstream's Next/variant bullets"),
        ("README.md", "docs merge: upstream sponsor table + our brand"),
        ("README.i18n.yaml", "bilingual hash sidecar; regenerate"),
        ("PRIVACY.i18n.yaml", "bilingual hash sidecar; regenerate"),
        (".gitignore", "union: upstream next/beta build dirs + our preset/worktree ignores"),
        ("dsh-plugin-desktop/README", "docs: brand + upstream content"),
        ("dsh-plugin-desktop/src/bin.ts", "CLI help string: keep `omnimux`, adopt upstream's `[folder]`"),
        ("dsh-plugin-desktop/build/app-icon", "brand icon asset"),
        ("dsh-plugin-desktop/src/client/", "settings/layout UI: follow upstream rename, keep our narrow-screen + titlebar deltas"),
        ("dsh-plugin-desktop/src/native-ui/", "setup-wizard / profile-selector UI copy"),
        ("dsh-plugin-desktop/src/setup-wizard", "setup wizard contract/settings/copy"),
        ("dsh-plugin-desktop/src/notifications.ts", "mechanical"),
        ("dsh-plugin-desktop/src/host-bootstrap.ts", "mechanical"),
        ("dsh-plugin-desktop/src/electron-runtime.ts", "mechanical + next-transition-notice wiring"),
        ("dsh-plugin-desktop/src/preload.ts", "mechanical"),
        ("dsh-plugin-desktop/src/host-process-entry.ts", "mechanical"),
        ("dsh-plugin-desktop/src/native-dialog-copy.ts", "copy"),
        ("dsh-plugin-desktop/src/packaged-runtime-smoke.ts", "mechanical"),
        ("dsh-plugin-desktop/src/update-lifecycle.ts", "mechanical (channel plumbing)"),
        ("dsh-plugin-desktop/src/windows-pwsh-sandbox.ts", "mechanical"),
        ("dsh-plugin-desktop/scripts/", "build/verify script chain: keep ours + absorb upstream flags"),
        ("dsh-plugin-desktop/tsconfig", "mechanical union"),
        ("dsh-community-market/package.json", "deps: schemastery bump + dropped upstream deps"),
        ("dsh-community-market/", "market refactor: follow upstream, keep our settings-persistence delta"),
        ("scripts/sync-vendored-runtime.mjs", "drop beta/other-channel branch (2026-09-12 decision)"),
        ("scripts/prepare-agents-anywhere-release.mjs", "single-package vs upstream AA_WORKSPACES"),
        ("assets/", "brand assets"),
    ]
    for prefix, why in B_RULES:
        if path.startswith(prefix):
            return "B", why

    # ---- A: mechanical / upstream-only evolution / no product decision ----
    if path.startswith("vendor/dsh-runtime/"):
        return "A", "old runtime vendor dir kept upstream, pruned by the fork (established policy)"
    if path.startswith("_deprecated/"):
        return "A", "upstream _deprecated archive; the fork does not carry it"
    if path == "yarn.lock":
        return "A", "regenerated by `corepack yarn install`"
    if path.startswith(".agents/notes/"):
        return "A", "false rename pairing of bilingual hash sidecars"
    if path.startswith("dsh-plugin-desktop/tests/") and not has_brand_literal(path):
        return "A", "upstream test evolution (no brand assertion on our side)"
    if path.startswith("dsh-plugin-desktop/tests/"):
        return "B", "test carries a fork brand/port assertion -> keep our value, follow upstream structure"
    if path.startswith("dsh-plugin-desktop/src/"):
        return "A", "upstream source evolution, no fork delta at this path"
    return "A", "unclassified -> treated as mechanical (review)"


BOUNDARY = {
    "dsh-plugin-desktop/tests/package.spec.ts",
    "dsh-community-market/tests/market-settings-persistence.spec.ts",
}

rows = unmerged()
result = OrderedDict()
counts = Counter()
for code, path in rows:
    b, why = bucket(code, path)
    note = "BOUNDARY: owned by teammate #3776 — record only, do not resolve" if path in BOUNDARY else ""
    result[path] = {"code": code, "bucket": b, "why": why, "note": note}
    counts[b] += 1

by_group = Counter()
for path, r in result.items():
    if path.startswith("vendor/"):
        g = "vendor/dsh-runtime"
    elif path.startswith("dsh-plugin-desktop-beta/"):
        g = "dsh-plugin-desktop-beta"
    elif path.startswith("dsh-desktop-next/"):
        g = "dsh-desktop-next"
    elif path.startswith("dsh-plugin-desktop/"):
        g = "dsh-plugin-desktop"
    elif path.startswith("dsh-community-market/"):
        g = "dsh-community-market"
    elif path.startswith("patches/"):
        g = "patches"
    elif path.startswith("scripts/"):
        g = "scripts"
    else:
        g = "root/docs"
    by_group[(g, r["bucket"])] += 1

payload = {
    "merge_base": git("merge-base", "HEAD", "origin/master").strip(),
    "ours": git("rev-parse", "HEAD").strip(),
    "theirs": git("rev-parse", "origin/master").strip(),
    "unmerged_total": len(rows),
    "counts": dict(counts),
    "by_group": {f"{g}|{b}": n for (g, b), n in sorted(by_group.items())},
    "paths": result,
}
with open(f"{WT}/.analysis/classification.json", "w") as fh:
    json.dump(payload, fh, indent=2, ensure_ascii=False)

lines = [
    "# Issue #3778 phase 1 — conflict classification",
    "",
    f"- merge base: `{payload['merge_base'][:10]}`",
    f"- ours (fork/omnimux): `{payload['ours'][:10]}`",
    f"- theirs (origin/master): `{payload['theirs'][:10]}`",
    f"- unmerged paths: **{len(rows)}**",
    "",
    "## Bucket totals",
    "",
    "| bucket | count |",
    "| --- | --- |",
]
for b in "ABCD":
    lines.append(f"| {b} | {counts.get(b, 0)} |")
lines += ["", "## By group x bucket", "", "| group | bucket | count |", "| --- | --- | --- |"]
for (g, b), n in sorted(by_group.items()):
    lines.append(f"| {g} | {b} | {n} |")
lines += ["", "## Per-path", "", "| code | bucket | path | reason |", "| --- | --- | --- | --- |"]
for path, r in sorted(result.items(), key=lambda kv: (kv[1]["bucket"], kv[0])):
    why = r["why"] + (f" — {r['note']}" if r["note"] else "")
    lines.append(f"| {r['code']} | {r['bucket']} | `{path}` | {why} |")
with open(f"{WT}/.analysis/classification.md", "w") as fh:
    fh.write("\n".join(lines) + "\n")

print(json.dumps({"unmerged_total": len(rows), "counts": dict(counts), "by_group": payload["by_group"]}, indent=2))
