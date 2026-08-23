#!/usr/bin/env bash
#
# Applies repository settings and the `main` branch ruleset via the GitHub API.
#
# Idempotent: safe to re-run. The ruleset is matched by name and updated in
# place, so re-running never creates duplicates.
#
# Usage:
#   ./scripts/repo-settings.sh            # apply
#   DRY_RUN=1 ./scripts/repo-settings.sh  # print payloads, change nothing
#   REPO=owner/name ./scripts/repo-settings.sh
#
set -euo pipefail

RULESET_NAME="Protection"
DRY_RUN="${DRY_RUN:-0}"

# GitHub Actions' app id. Pinning the integration on each required check means
# only a status posted by Actions can satisfy it — a third-party app (or a
# token-authored commit status) cannot forge a green `test`.
ACTIONS_APP_ID=15368

# Checks that must pass before anything merges into main.
#
# Deliberately excluded:
#   - "Snyk"          — gated on SNYK_TOKEN. A required check that resolves to
#                       `skipped` blocks the PR forever.
#   - docker / release — `push`-only workflows; they never report on a PR.
#   - "bun audit"     — advisory until the dependency backlog is triaged. The
#                       eslint and shadcn CLI chains contribute ~37 high
#                       advisories that never reach the runtime artifact, and a
#                       permanently-red required check would block the very PRs
#                       that fix it. Re-add once `bun audit --audit-level=high`
#                       is green (likely with a few --ignore entries).
REQUIRED_CHECKS=(
  "test"
  "Analyze (javascript-typescript)"
  "actionlint (workflows)"
  "zizmor (workflow security)"
)

die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[33mwarn:\033[0m %s\n' "$*" >&2; }

command -v gh >/dev/null || die "gh CLI not found"
command -v jq >/dev/null || die "jq not found"
gh auth status >/dev/null 2>&1 || die "gh not authenticated — run: gh auth login"

REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
[ -n "$REPO" ] || die "could not determine repository"

DEFAULT_BRANCH=$(gh api "repos/$REPO" --jq .default_branch)
info "Repository:     $REPO"
info "Default branch: $DEFAULT_BRANCH"
[ "$DRY_RUN" = "1" ] && warn "DRY_RUN=1 — no changes will be made"

# --------------------------------------------------------------------------
# Preflight: GitHub accepts arbitrary check-name strings, so a typo becomes a
# check that never reports and silently blocks every PR. Warn on any name that
# has not actually been seen on the default branch.
# --------------------------------------------------------------------------
info "Verifying required check names have been observed on $DEFAULT_BRANCH..."
SEEN=$(gh api "repos/$REPO/commits/$DEFAULT_BRANCH/check-runs" --paginate \
         --jq '.check_runs[].name' 2>/dev/null | sort -u || true)

MISSING=0
for check in "${REQUIRED_CHECKS[@]}"; do
  if printf '%s\n' "$SEEN" | grep -qxF "$check"; then
    printf '    \033[32m✓\033[0m %s\n' "$check"
  else
    printf '    \033[33m?\033[0m %s  (not yet seen)\n' "$check"
    MISSING=1
  fi
done

if [ "$MISSING" = "1" ]; then
  warn "Some checks have never reported on $DEFAULT_BRANCH."
  warn "If the workflows have not merged yet this is expected — but any name"
  warn "that stays unreported will block all PRs. Set FORCE=1 to proceed."
  [ "${FORCE:-0}" = "1" ] || [ "$DRY_RUN" = "1" ] || die "aborting (set FORCE=1 to override)"
fi

# --------------------------------------------------------------------------
# Repository-level settings
#
# Squash-only: release-please derives versions from the squash commit subject,
# which GitHub takes from the PR title. Allowing merge commits would let a
# non-conforming subject through and desync the release.
# --------------------------------------------------------------------------
REPO_PAYLOAD=$(jq -n '{
  allow_auto_merge:            true,
  allow_squash_merge:          true,
  allow_merge_commit:          false,
  allow_rebase_merge:          false,
  allow_update_branch:         true,
  delete_branch_on_merge:      true,
  squash_merge_commit_title:   "PR_TITLE",
  squash_merge_commit_message: "PR_BODY",
  web_commit_signoff_required: false
}')

# --------------------------------------------------------------------------
# Ruleset
#
# required_approving_review_count is 0 on purpose. It still forces every change
# through a pull request (blocking direct pushes to main) while letting
# Renovate's auto-merge work — a bot cannot approve its own PR, so any non-zero
# count would strand every dependency PR. Enforcement comes from the required
# checks below.
#
# strict_required_status_checks_policy is false: requiring branches be up to
# date would force a rebase of every open Renovate PR on each merge.
#
# Admin bypass is "pull_request", not "always": an admin can merge a PR that
# checks are blocking, but cannot push straight to main. Note the value is
# singular — the API rejects "pull_requests" with a 422 "Bypass mode is
# invalid".
# --------------------------------------------------------------------------
CHECKS_JSON=$(printf '%s\n' "${REQUIRED_CHECKS[@]}" \
  | jq -R . | jq -s --argjson app "$ACTIONS_APP_ID" \
      'map({context: ., integration_id: $app})')

RULESET_PAYLOAD=$(jq -n \
  --arg name "$RULESET_NAME" \
  --argjson checks "$CHECKS_JSON" '{
  name: $name,
  target: "branch",
  enforcement: "active",
  conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
  bypass_actors: [
    { actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "pull_request" }
  ],
  rules: [
    { type: "deletion" },
    { type: "non_fast_forward" },
    { type: "pull_request",
      parameters: {
        required_approving_review_count:   0,
        dismiss_stale_reviews_on_push:     false,
        require_code_owner_review:         false,
        require_last_push_approval:        false,
        required_review_thread_resolution: false,
        allowed_merge_methods:             ["squash"],
        # GitHub defaults this to true. Left on, it demands an approval for
        # commits it cannot attribute to a GitHub account, which contradicts
        # required_approving_review_count: 0 and would strand bot PRs that
        # auto-merge. Set explicitly so the state does not depend on a default.
        require_extra_approval_for_unattributed_changes: false
      }
    },
    { type: "required_status_checks",
      parameters: {
        strict_required_status_checks_policy: false,
        do_not_enforce_on_create:             false,
        required_status_checks:               $checks
      }
    }
  ]
}')

if [ "$DRY_RUN" = "1" ]; then
  info "Repository settings payload:"; echo "$REPO_PAYLOAD" | jq .
  info "Ruleset payload:";             echo "$RULESET_PAYLOAD" | jq .
  EXISTING=$(gh api "repos/$REPO/rulesets" --jq \
    ".[] | select(.name==\"$RULESET_NAME\") | .id" 2>/dev/null | head -1 || true)
  [ -n "$EXISTING" ] && info "Would PUT ruleset $EXISTING" || info "Would POST a new ruleset"
  exit 0
fi

info "Applying repository settings..."
api_out=$(echo "$REPO_PAYLOAD" | gh api -X PATCH "repos/$REPO" --input - 2>&1) \
  || die "repository settings update failed: $api_out"
printf '    \033[32m✓\033[0m squash-only, auto-merge on, branches deleted on merge\n'

RULESET_ID=$(gh api "repos/$REPO/rulesets" --jq \
  ".[] | select(.name==\"$RULESET_NAME\") | .id" 2>/dev/null | head -1 || true)

if [ -n "$RULESET_ID" ]; then
  info "Updating existing ruleset '$RULESET_NAME' (id $RULESET_ID)..."
  api_out=$(echo "$RULESET_PAYLOAD" | gh api -X PUT "repos/$REPO/rulesets/$RULESET_ID" --input - 2>&1) \
    || die "ruleset update failed: $api_out"
else
  info "Creating ruleset '$RULESET_NAME'..."
  api_out=$(echo "$RULESET_PAYLOAD" | gh api -X POST "repos/$REPO/rulesets" --input - 2>&1) \
    || die "ruleset create failed: $api_out"
fi
printf '    \033[32m✓\033[0m %d required checks, PRs enforced, force-push and deletion blocked\n' \
  "${#REQUIRED_CHECKS[@]}"

info "Done."
