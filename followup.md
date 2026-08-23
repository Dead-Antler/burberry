## Post-merge follow-up

Remaining manual steps. Delete this file once all boxes are ticked.

- [x] Install the **Renovate** GitHub App on the repo.
      *Unverified:* no Dependency Dashboard issue exists yet. With
      `renovate.json` committed, Renovate skips onboarding and opens the
      dashboard on its first run — and the config restricts runs to
      `before 5am on monday` (Australia/Sydney), so nothing appears until
      then. Confirm the App is actually installed under
      Settings → GitHub Apps rather than assuming.

- [ ] **Create the release-please GitHub App** and set two repo secrets:
      - `RELEASE_PLEASE_CLIENT_ID` — the App's Client ID (`Iv23li...`),
        not the numeric App ID.
      - `RELEASE_PLEASE_PRIVATE_KEY` — a generated private key, full PEM
        including the BEGIN/END lines.

      The App needs **Contents: read & write** and **Pull requests: read &
      write**, and must be installed on this repo. Until then the Release
      Please workflow fails on every push to `main`.

      A scoped App token is used rather than `GITHUB_TOKEN` because commits
      pushed with `GITHUB_TOKEN` do not trigger downstream workflows — the
      release PR would never get CI, CodeQL or Security statuses, and the
      required checks would block it permanently.

- [ ] Set `SNYK_TOKEN` if you want Snyk release-gate scans. Optional — the
      job self-skips without it, which is why it is not a required check.

- [x] Apply repository settings and the `main` ruleset via `make repo-settings`.

      ```bash
      make repo-settings-diff   # preview, changes nothing
      make repo-settings        # apply (idempotent)
      make repo-settings-show   # print the live ruleset
      ```

      Enforced on `main`: squash-only merges, PR required (0 approvals, so
      Renovate auto-merge still works), no force-push, no deletion, and four
      required checks — `test`, `Analyze (javascript-typescript)`,
      `actionlint (workflows)`, `zizmor (workflow security)`. Admin bypass is
      `pull_request`, not `always`.

- [ ] Delete stale merged branches (all are ancestors of `main`, so nothing
      is lost). `delete_branch_on_merge` is now on, so this is one-off:

      ```bash
      for b in 15-results-should-replay-automatically add-dependabot \
               chore/harden-pipeline-and-release-flow fix-badges-events \
               fix-dependabot-updates issue/8-include-version-number \
               issue/reorder-matches-in-event; do
        git push origin --delete "$b"
      done
      ```

- [ ] Promote `bun audit` to a required check once it is green. Today it
      reports 35 high advisories: 32 from dev-only chains (eslint's
      `minimatch`, the shadcn CLI's MCP/hono tree) that never reach the
      runtime artifact, plus `postcss` ×2 and `sharp`, which are pinned by
      Next's own dependency ranges. Add the check to `REQUIRED_CHECKS` in
      `scripts/repo-settings.sh` and re-run `make repo-settings`.

- [x] PR titles follow Conventional Commits (`feat:`, `fix:`, `chore:`) — the
      title becomes the squash commit subject and drives release-please.
