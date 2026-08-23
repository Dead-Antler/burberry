# Repository automation. Application commands live in package.json scripts;
# this file is for things that act on the GitHub repo itself.

.DEFAULT_GOAL := help
.PHONY: help repo-settings repo-settings-diff repo-settings-show

help: ## List available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-22s\033[0m %s\n", $$1, $$2}'

repo-settings: ## Apply repo settings + main branch ruleset (idempotent)
	@./scripts/repo-settings.sh

repo-settings-diff: ## Preview what repo-settings would apply, changing nothing
	@DRY_RUN=1 ./scripts/repo-settings.sh

repo-settings-show: ## Print the ruleset currently live on GitHub
	@gh api repos/$$(gh repo view --json nameWithOwner -q .nameWithOwner)/rulesets \
		--jq '.[] | select(.name=="Protection") | .id' \
		| xargs -I{} gh api repos/$$(gh repo view --json nameWithOwner -q .nameWithOwner)/rulesets/{}
