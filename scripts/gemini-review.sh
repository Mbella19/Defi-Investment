#!/usr/bin/env bash
# Ad-hoc second-opinion review: pipe context (diff, file, or question) to
# Gemini 3.6 Flash (High) and print its analysis.
#
# Usage:
#   scripts/gemini-review.sh "Question or instruction"
#   git diff main | scripts/gemini-review.sh "Review this diff for security issues"
#   cat src/lib/foo.ts | scripts/gemini-review.sh "Spot bugs in this module"
#
# Requires: the `agy` CLI installed and authenticated (override with GEMINI_CLI_BIN).

set -euo pipefail

if [ "$#" -lt 1 ]; then
  cat <<'EOF' >&2
gemini-review.sh — second-opinion review via Gemini 3.6 Flash (High)

Usage:
  scripts/gemini-review.sh "your question or instruction"
  git diff | scripts/gemini-review.sh "Review this diff"
  cat file.ts | scripts/gemini-review.sh "Audit this for vulnerabilities"

Stdin (if piped) is appended to the prompt as a <context> block.
EOF
  exit 1
fi

INSTRUCTION="$1"

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

GEMINI_BIN="${GEMINI_CLI_BIN:-agy}"
GEMINI_MODEL_NAME="${GEMINI_CLI_MODEL:-gemini-3.6-flash-high}"

# agy 1.0 treats --print as a string flag and ignores stdin in print mode.
# The quoted argument is passed directly (no eval), so context cannot become
# shell syntax. `--mode plan` keeps the review read-only.
"$GEMINI_BIN" \
  --print="$PROMPT" \
  --model "$GEMINI_MODEL_NAME" \
  --effort high \
  --mode plan
