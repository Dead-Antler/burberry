# Changelog

## [0.2.1](https://github.com/Dead-Antler/burberry/compare/v0.2.0...v0.2.1) (2026-08-24)


### Bug Fixes

* **deps:** update dependency @libsql/client to v0.17.4 ([#94](https://github.com/Dead-Antler/burberry/issues/94)) ([1890bdd](https://github.com/Dead-Antler/burberry/commit/1890bdd7ce62a1acb5e1681cddb5a2c146420f34))
* **deps:** update dependency isomorphic-dompurify to v3 ([#90](https://github.com/Dead-Antler/burberry/issues/90)) ([a8f14a1](https://github.com/Dead-Antler/burberry/commit/a8f14a1461773b54141563b5964295b1f86295dd))

## [0.2.0](https://github.com/Dead-Antler/burberry/compare/v0.1.1...v0.2.0) (2026-08-23)


### ⚠ BREAKING CHANGES

* the container now runs as uid 1001 by default instead of starting as root. Deployments with a data volume owned by another uid must chown it to 1001 or add `--user 0:0` to keep the deprecated PUID/PGID root mode.

### Features

* run the container unprivileged by default ([#82](https://github.com/Dead-Antler/burberry/issues/82)) ([035ac09](https://github.com/Dead-Antler/burberry/commit/035ac09a41c7e7e2c42bd15024a7edb9787e5296))


### Bug Fixes

* tag releases by removing forced grouped release PR ([#78](https://github.com/Dead-Antler/burberry/issues/78)) ([8be6541](https://github.com/Dead-Antler/burberry/commit/8be65410d361234bd749f6fbc1e584b197f06231))

## [0.1.1](https://github.com/Dead-Antler/burberry/compare/v0.1.0...v0.1.1) (2026-08-23)


### Bug Fixes

* correct ruleset bypass_mode and surface API errors ([#75](https://github.com/Dead-Antler/burberry/issues/75)) ([3783a4f](https://github.com/Dead-Antler/burberry/commit/3783a4f071e3377af0b7380cda5493bf26ef9bea))
* use client-id for release-please app token ([#76](https://github.com/Dead-Antler/burberry/issues/76)) ([691ea28](https://github.com/Dead-Antler/burberry/commit/691ea280ab44176f4b1cc2130592d1ffc6ef874b))
