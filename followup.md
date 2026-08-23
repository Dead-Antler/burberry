## Post-merge follow-up

1. Install the **Renovate** GitHub App on the repo. Its first run will open a
   "Configure Renovate" onboarding PR. (Done)
2. Set the `SNYK_TOKEN` repo secret if you want Snyk release-gate scans to
   actually run. Until then the Snyk job self-skips, which is why it is *not*
   in the required-checks list — a required check that resolves to `skipped`
   blocks every PR indefinitely.
3. Set `RELEASE_PLEASE_APP_ID` and `RELEASE_PLEASE_APP_PRIVATE_KEY` for the
   release-please workflow's scoped App token.
4. **After CI, CodeQL and Security have each run once on `main`** (so the check
   names exist in GitHub), run `make repo-settings` to apply repository
   settings and the `main` ruleset. This cannot happen before merge: the script
   refuses to require a check name it has never observed, because a name that
   never reports silently blocks all PRs.

   ```bash
   make repo-settings-diff   # preview, changes nothing
   make repo-settings        # apply (idempotent)
   make repo-settings-show   # print the live ruleset
   ```

   What it enforces on `main`: squash-only merges, PR required (0 approvals so
   Renovate auto-merge still works), no force-push, no deletion, and five
   required checks — `test`, `Analyze (javascript-typescript)`, `bun audit`,
   `actionlint (workflows)`, `zizmor (workflow security)`. Admin bypass is
   narrowed from `always` to `pull_requests`.
5. From this PR onward, PR titles need to follow Conventional Commits
   (`feat:`, `fix:`, `chore:`, etc.) — the title becomes the squash commit
   subject and drives release-please's version bumps.
