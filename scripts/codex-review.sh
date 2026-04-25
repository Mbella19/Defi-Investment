#!/usr/bin/env bash
# Ad-hoc second-opinion review: pipe context (diff, file, or question) to
# Codex GPT-5.5 at xhigh reasoning effort and print its analysis.
#
# Usage:
#   scripts/codex-review.sh "Question or instruction"
#   git diff main | scripts/codex-review.sh "Review this diff for security issues"
#   cat src/lib/foo.ts | scripts/codex-review.sh "Spot bugs in this module"
#
# Requires: `codex` CLI installed and logged in (~/.codex/config.toml configured).
# Driver = Claude Opus 4.7 (in your Claude Code session). This script is the
# bridge for fetching a cold second opinion at decision points.

set -euo pipefail

if [ "$#" -lt 1 ]; then
  cat <<'EOF' >&2
codex-review.sh — second-opinion review via Codex GPT-5.5 (xhigh)

Usage:
  scripts/codex-review.sh "your question or instruction"
  git diff | scripts/codex-review.sh "Review this diff"
  cat file.ts | scripts/codex-review.sh "Audit this for vulnerabilities"

Stdin (if piped) is appended to the prompt as a <context> block.
EOF
  exit 1
fi

INSTRUCTION="$1"

# If stdin is piped, capture it; otherwise use empty context
if [ ! -t 0 ]; then
  CTX="$(cat)"
  PROMPT="${INSTRUCTION}

<context>
${CTX}
</context>

Review the context above against the instruction. Be specific — reference
file paths, line numbers, or function names when possible. Flag concrete
issues with concrete fixes; do not hedge."
else
  PROMPT="${INSTRUCTION}"
fi

OUT_DIR="$(mktemp -d -t codex-review-XXXXXX)"
trap 'rm -rf "$OUT_DIR"' EXIT
OUT_FILE="${OUT_DIR}/last.txt"

printf '%s' "$PROMPT" | codex exec \
  --sandbox read-only \
  --skip-git-repo-check \
  --color never \
  -o "$OUT_FILE" \
  - >/dev/null 2>&1

cat "$OUT_FILE"
