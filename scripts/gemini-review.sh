#!/usr/bin/env bash
# Ad-hoc second-opinion review: pipe context (diff, file, or question) to
# Gemini 3.1 Pro Preview and print its analysis.
#
# Usage:
#   scripts/gemini-review.sh "Question or instruction"
#   git diff main | scripts/gemini-review.sh "Review this diff for security issues"
#   cat src/lib/foo.ts | scripts/gemini-review.sh "Spot bugs in this module"
#
# Requires: `gemini` CLI installed and authenticated.
# Driver = Claude Opus 4.7 (in your Claude Code session). This script is the
# bridge for fetching a third cold-eyes opinion at decision points.

set -euo pipefail

if [ "$#" -lt 1 ]; then
  cat <<'EOF' >&2
gemini-review.sh — second-opinion review via Gemini 3.1 Pro Preview

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

# gemini -p takes prompt as an arg but also appends stdin. Empty -p plus stdin
# keeps long prompts off argv (argv has OS size limits).
# --approval-mode plan forces read-only; gemini will not edit files.
printf '%s' "$PROMPT" | gemini \
  -p "" \
  -m gemini-3.1-pro-preview \
  --approval-mode plan
