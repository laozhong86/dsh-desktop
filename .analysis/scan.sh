#!/usr/bin/env bash
# Phase-1 merge triage scanner (read-only over the conflicted worktree).
set -uo pipefail
WT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WT"
B=$(git merge-base HEAD origin/master)

echo "### merge-base $B  ours $(git rev-parse --short HEAD)  theirs $(git rev-parse --short origin/master)"
echo

echo "### conflict hunks per unmerged file (text files only)"
git diff --name-only --diff-filter=U | while read -r f; do
  if [ -f "$f" ]; then
    n=$(grep -c '^<<<<<<<' "$f" 2>/dev/null || true)
    [ "${n:-0}" -gt 0 ] && printf '%4s  %s\n' "$n" "$f"
  fi
done | sort -rn
echo

echo "### unmerged paths with NO conflict markers (delete/modify, binary, rename)"
git diff --name-only --diff-filter=U | while read -r f; do
  if [ ! -f "$f" ]; then
    echo "  (absent) $f"
  elif ! grep -q '^<<<<<<<' "$f" 2>/dev/null; then
    echo "  (binary-or-side) $f"
  fi
done
