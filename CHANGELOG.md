# [2.8.0](https://github.com/igor-siergiej/tandra/compare/v2.7.0...v2.8.0) (2026-10-24)


### Features

* **web:** one-time notice before the voice-input mic first opens ([#306](https://github.com/igor-siergiej/tandra/issues/306)) ([5fef423](https://github.com/igor-siergiej/tandra/commit/5fef4236c1d7b18b64376b40df119e81f56aed99))

# [2.7.0](https://github.com/igor-siergiej/tandra/compare/v2.6.3...v2.7.0) (2026-10-24)


### Features

* **web:** link the privacy notice from sign-in, register, Settings and What's new ([#304](https://github.com/igor-siergiej/tandra/issues/304)) ([9d3cce5](https://github.com/igor-siergiej/tandra/commit/9d3cce5ffeb80478d19b91ef27b9fdb16a1ed367))

## [2.6.3](https://github.com/igor-siergiej/tandra/compare/v2.6.2...v2.6.3) (2026-10-24)


### Performance Improvements

* faster e2e suite (prebuilt bundle, 100ms polling, no spinner exit wait) ([#300](https://github.com/igor-siergiej/tandra/issues/300)) ([d1241e1](https://github.com/igor-siergiej/tandra/commit/d1241e134f28c83368271d2b8ccc4986df0b1c41)), closes [microsoft/playwright#26837](https://github.com/microsoft/playwright/issues/26837)

## [2.6.2](https://github.com/igor-siergiej/tandra/compare/v2.6.1...v2.6.2) (2026-10-24)


### Bug Fixes

* **api:** give Wikibooks recipes their id as public slug ([#302](https://github.com/igor-siergiej/tandra/issues/302)) ([712f93f](https://github.com/igor-siergiej/tandra/commit/712f93fd3f8ed7f9aa8ae9004b397e5e68e61c5a))

## [2.6.1](https://github.com/igor-siergiej/tandra/compare/v2.6.0...v2.6.1) (2026-10-24)


### Bug Fixes

* **web:** self-host Montserrat and drop Google Fonts from CSP ([#301](https://github.com/igor-siergiej/tandra/issues/301)) ([5ae8ba1](https://github.com/igor-siergiej/tandra/commit/5ae8ba1136060df509e84e4539d4303d6f12d76e))

# [2.6.0](https://github.com/igor-siergiej/tandra/compare/v2.5.0...v2.6.0) (2026-10-24)


### Features

* **qa:** make the repo's quality gates actually gate ([#299](https://github.com/igor-siergiej/tandra/issues/299)) ([7ab4e6a](https://github.com/igor-siergiej/tandra/commit/7ab4e6a3dc709fafa4ba5f7bc69201ef8f56cec3))

# [2.5.0](https://github.com/igor-siergiej/tandra/compare/v2.4.0...v2.5.0) (2026-10-24)


### Features

* **web:** blank-content heatmap previews and privacy-safe guest funnel analytics ([#296](https://github.com/igor-siergiej/tandra/issues/296)) ([59f68ec](https://github.com/igor-siergiej/tandra/commit/59f68ec11d66daf06b6f122e3fcce9c2de0c45fb))

# [2.4.0](https://github.com/igor-siergiej/tandra/compare/v2.3.2...v2.4.0) (2026-10-23)


### Features

* **api:** log new user registrations ([#295](https://github.com/igor-siergiej/tandra/issues/295)) ([34a3ac5](https://github.com/igor-siergiej/tandra/commit/34a3ac5a295aacb3a19ffc2911c130e9307e31ad))

## [2.3.2](https://github.com/igor-siergiej/tandra/compare/v2.3.1...v2.3.2) (2026-10-23)


### Bug Fixes

* **web:** hide the browser's blue clear button on search-type fields ([#294](https://github.com/igor-siergiej/tandra/issues/294)) ([96c3aa5](https://github.com/igor-siergiej/tandra/commit/96c3aa5fd7cd191b19fe49f26560709fa3fdcae5))

## [2.3.1](https://github.com/igor-siergiej/tandra/compare/v2.3.0...v2.3.1) (2026-10-23)


### Bug Fixes

* **web:** new todos start private instead of shared with every friend ([#293](https://github.com/igor-siergiej/tandra/issues/293)) ([6e012a5](https://github.com/igor-siergiej/tandra/commit/6e012a5d48f3928770bf54329b5068f2229188c3)), closes [#289](https://github.com/igor-siergiej/tandra/issues/289) [#289](https://github.com/igor-siergiej/tandra/issues/289)

# [2.3.0](https://github.com/igor-siergiej/tandra/compare/v2.2.3...v2.3.0) (2026-10-23)


### Features

* **web:** guests get a plain checklist instead of item images ([#292](https://github.com/igor-siergiej/tandra/issues/292)) ([07d4909](https://github.com/igor-siergiej/tandra/commit/07d49095ce91d8b85d2f3b50799c31fd16bbcf21))

## [2.2.3](https://github.com/igor-siergiej/tandra/compare/v2.2.2...v2.2.3) (2026-10-23)


### Bug Fixes

* **web:** actually send the security headers from nginx ([#291](https://github.com/igor-siergiej/tandra/issues/291)) ([a2c09c5](https://github.com/igor-siergiej/tandra/commit/a2c09c5c1b31f51d5cc964d5055ae6446445220d)), closes [#118](https://github.com/igor-siergiej/tandra/issues/118)

## [2.2.2](https://github.com/igor-siergiej/tandra/compare/v2.2.1...v2.2.2) (2026-10-23)


### Bug Fixes

* **api:** resolve the signed-in user on the item image route ([#290](https://github.com/igor-siergiej/tandra/issues/290)) ([222e31b](https://github.com/igor-siergiej/tandra/commit/222e31b349c47892ceb6f3b8366ae4f767930bdd)), closes [#271](https://github.com/igor-siergiej/tandra/issues/271)

## [2.2.1](https://github.com/igor-siergiej/tandra/compare/v2.2.0...v2.2.1) (2026-10-22)


### Bug Fixes

* **web:** keep todos private when no friends are selected ([#289](https://github.com/igor-siergiej/tandra/issues/289)) ([e18ade1](https://github.com/igor-siergiej/tandra/commit/e18ade1a51206670ce32d0836fdb1a691fe53115))

# [2.2.0](https://github.com/igor-siergiej/tandra/compare/v2.1.0...v2.2.0) (2026-10-22)


### Features

* **web:** hand-drawn check-off strike on items and todos ([#288](https://github.com/igor-siergiej/tandra/issues/288)) ([d2907da](https://github.com/igor-siergiej/tandra/commit/d2907da2db327aa6e2140a7a333c24587a114b27))

# [2.1.0](https://github.com/igor-siergiej/tandra/compare/v2.0.2...v2.1.0) (2026-10-22)


### Features

* **web:** load Umami's heatmap recorder; stop sending usernames ([#287](https://github.com/igor-siergiej/tandra/issues/287)) ([5fbd8b9](https://github.com/igor-siergiej/tandra/commit/5fbd8b9619ca8dd000165b027bc9d610a0b4a65f)), closes [#138](https://github.com/igor-siergiej/tandra/issues/138)

## [2.0.2](https://github.com/igor-siergiej/tandra/compare/v2.0.1...v2.0.2) (2026-10-22)


### Bug Fixes

* **web:** analytics tracker records events and loads same-origin ([#285](https://github.com/igor-siergiej/tandra/issues/285)) ([ef7888d](https://github.com/igor-siergiej/tandra/commit/ef7888d94ae6278b362bf841790243f11489e129)), closes [#138](https://github.com/igor-siergiej/tandra/issues/138)

## [2.0.1](https://github.com/igor-siergiej/tandra/compare/v2.0.0...v2.0.1) (2026-10-22)


### Bug Fixes

* **web:** finish Google sign-in when the app resumes on the login page ([#284](https://github.com/igor-siergiej/tandra/issues/284)) ([f19de06](https://github.com/igor-siergiej/tandra/commit/f19de063078f3e414c1e7342e76ddb49da2995f0))

# [2.0.0](https://github.com/igor-siergiej/tandra/compare/v1.115.0...v2.0.0) (2026-10-21)


* chore!: rename Shoppingo to Tandra ([#283](https://github.com/igor-siergiej/tandra/issues/283)) ([c22fff1](https://github.com/igor-siergiej/tandra/commit/c22fff1429fc0750091dc79e4d1930ec1a64ed91))


### BREAKING CHANGES

* Prometheus metric names, Docker image tags
(igurusama/imapps:tandra-{api,web}-*), workspace package names and
browser storage keys change; data stored on the device under the old keys
is no longer read. The old shoppingo*.imapps.uk hosts are no longer served.

Release-Notes: Shoppingo is now Tandra. Settings saved on this device, like guest lists, start fresh.

# [1.115.0](https://github.com/igor-siergiej/shoppingo/compare/v1.114.0...v1.115.0) (2026-10-21)


### Features

* **web:** sign in with Google ([#281](https://github.com/igor-siergiej/shoppingo/issues/281)) ([c492fa5](https://github.com/igor-siergiej/shoppingo/commit/c492fa55dec66d6e436a7a07b4640c71e7f95961)), closes [#146](https://github.com/igor-siergiej/shoppingo/issues/146)

# [1.114.0](https://github.com/igor-siergiej/shoppingo/compare/v1.113.1...v1.114.0) (2026-10-21)


### Features

* **web:** sign in with shoppingo's own accounts ([#279](https://github.com/igor-siergiej/shoppingo/issues/279)) ([ccb9c50](https://github.com/igor-siergiej/shoppingo/commit/ccb9c50c08e37a55f071f45e073c5b0ba1014049)), closes [#145](https://github.com/igor-siergiej/shoppingo/issues/145) [#146](https://github.com/igor-siergiej/shoppingo/issues/146)

## [1.113.1](https://github.com/igor-siergiej/shoppingo/compare/v1.113.0...v1.113.1) (2026-10-21)


### Bug Fixes

* **web:** only accept usernames the sign-in server accepts ([#280](https://github.com/igor-siergiej/shoppingo/issues/280)) ([b508db8](https://github.com/igor-siergiej/shoppingo/commit/b508db88a32fc9785dd5295786a80024f944fd58)), closes [#145](https://github.com/igor-siergiej/shoppingo/issues/145)

# [1.113.0](https://github.com/igor-siergiej/shoppingo/compare/v1.112.0...v1.113.0) (2026-10-21)


### Features

* show the Tandra name across the app ([#277](https://github.com/igor-siergiej/shoppingo/issues/277)) ([752e585](https://github.com/igor-siergiej/shoppingo/commit/752e58540148093eeb234d004c810b9f7bd40151))

# [1.112.0](https://github.com/igor-siergiej/shoppingo/compare/v1.111.0...v1.112.0) (2026-10-21)


### Features

* **scripts:** kivo user import and admin password reset ([#276](https://github.com/igor-siergiej/shoppingo/issues/276)) ([d551799](https://github.com/igor-siergiej/shoppingo/commit/d5517999e60c41396d9274172500a522a6427315)), closes [#142](https://github.com/igor-siergiej/shoppingo/issues/142)

# [1.111.0](https://github.com/igor-siergiej/shoppingo/compare/v1.110.0...v1.111.0) (2026-10-21)


### Features

* **web:** serve the app from app.tandra.uk ([#274](https://github.com/igor-siergiej/shoppingo/issues/274)) ([6623fee](https://github.com/igor-siergiej/shoppingo/commit/6623feeb002f4c7eb44143af34b3d1e496696498)), closes [#270](https://github.com/igor-siergiej/shoppingo/issues/270)

# [1.110.0](https://github.com/igor-siergiej/shoppingo/compare/v1.109.0...v1.110.0) (2026-10-21)


### Features

* **api:** embed Better Auth next to kivo verification ([#271](https://github.com/igor-siergiej/shoppingo/issues/271)) ([f033b40](https://github.com/igor-siergiej/shoppingo/commit/f033b40bf9c913f9ae2ec91fc8eee10838fe4dbe)), closes [#147](https://github.com/igor-siergiej/shoppingo/issues/147) [#139](https://github.com/igor-siergiej/shoppingo/issues/139) [#142](https://github.com/igor-siergiej/shoppingo/issues/142)

# [1.109.0](https://github.com/igor-siergiej/shoppingo/compare/v1.108.1...v1.109.0) (2026-10-20)


### Features

* move the app to tandra.uk ([#270](https://github.com/igor-siergiej/shoppingo/issues/270)) ([ebe5fef](https://github.com/igor-siergiej/shoppingo/commit/ebe5fefa1ebd29d4b4234c780a66edb6f34d9161))

## [1.108.1](https://github.com/igor-siergiej/shoppingo/compare/v1.108.0...v1.108.1) (2026-10-20)


### Bug Fixes

* **web:** show the "Shoppingo has moved" banner inside the old installed app ([#269](https://github.com/igor-siergiej/shoppingo/issues/269)) ([004918d](https://github.com/igor-siergiej/shoppingo/commit/004918d528c7b5ad234af57c1957534bb1570787))

# [1.108.0](https://github.com/igor-siergiej/shoppingo/compare/v1.107.3...v1.108.0) (2026-10-20)


### Features

* **web:** show the "Shoppingo has moved" banner to users forwarded from the old address ([#263](https://github.com/igor-siergiej/shoppingo/issues/263)) ([a5c0221](https://github.com/igor-siergiej/shoppingo/commit/a5c0221a26cc55cdd5d2a34903acab73cd3fb93d)), closes [shoppingo-site#6](https://github.com/shoppingo-site/issues/6)

## [1.107.3](https://github.com/igor-siergiej/shoppingo/compare/v1.107.2...v1.107.3) (2026-10-20)


### Bug Fixes

* **web:** quick taps on the meal plan portions stepper no longer lose an increment ([#264](https://github.com/igor-siergiej/shoppingo/issues/264)) ([54a76e5](https://github.com/igor-siergiej/shoppingo/commit/54a76e580dad0db7fce417dd028efc23d23887cb))

## [1.107.2](https://github.com/igor-siergiej/shoppingo/compare/v1.107.1...v1.107.2) (2026-10-20)


### Bug Fixes

* **web:** guest mode uses the real lists and items pages ([#268](https://github.com/igor-siergiej/shoppingo/issues/268)) ([b65d53d](https://github.com/igor-siergiej/shoppingo/commit/b65d53d94faf5f491492e69f07145f865a92acfa))

## [1.107.1](https://github.com/igor-siergiej/shoppingo/compare/v1.107.0...v1.107.1) (2026-10-19)


### Bug Fixes

* move the app host to shoppingo-app.imapps.uk ([#261](https://github.com/igor-siergiej/shoppingo/issues/261)) ([46a6a08](https://github.com/igor-siergiej/shoppingo/commit/46a6a081e7d2738925f7d29ee57afbbb28327fe1)), closes [#82](https://github.com/igor-siergiej/shoppingo/issues/82)

# [1.107.0](https://github.com/igor-siergiej/shoppingo/compare/v1.106.4...v1.107.0) (2026-10-18)


### Features

* **web:** mark returning users so shoppingo.imapps.uk opens the app ([#260](https://github.com/igor-siergiej/shoppingo/issues/260)) ([5ee7713](https://github.com/igor-siergiej/shoppingo/commit/5ee771352a7db4acd3c89dd51ced4899cf86efae)), closes [#82](https://github.com/igor-siergiej/shoppingo/issues/82) [#5](https://github.com/igor-siergiej/shoppingo/issues/5)

## [1.106.4](https://github.com/igor-siergiej/shoppingo/compare/v1.106.3...v1.106.4) (2026-10-18)


### Bug Fixes

* **web:** keep the access token in memory on Firefox too ([#258](https://github.com/igor-siergiej/shoppingo/issues/258)) ([fa22678](https://github.com/igor-siergiej/shoppingo/commit/fa22678a5a0326e005e96a3cbd6d3a03bff2dbb3))

## [1.106.3](https://github.com/igor-siergiej/shoppingo/compare/v1.106.2...v1.106.3) (2026-10-18)


### Bug Fixes

* **api:** serve uploaded recipe covers with private cache control ([#257](https://github.com/igor-siergiej/shoppingo/issues/257)) ([a223ec8](https://github.com/igor-siergiej/shoppingo/commit/a223ec895083fe939723c57eeaecb93849866586))

## [1.106.2](https://github.com/igor-siergiej/shoppingo/compare/v1.106.1...v1.106.2) (2026-10-18)


### Bug Fixes

* **web:** load uploaded recipe covers with a fresh token ([#256](https://github.com/igor-siergiej/shoppingo/issues/256)) ([8118830](https://github.com/igor-siergiej/shoppingo/commit/8118830cc36a5e577847f90336604943f3f45e1d))

## [1.106.1](https://github.com/igor-siergiej/shoppingo/compare/v1.106.0...v1.106.1) (2026-10-18)


### Bug Fixes

* **web:** guest lists survive reloads, renames and partial sign-up failures ([#255](https://github.com/igor-siergiej/shoppingo/issues/255)) ([2b88d09](https://github.com/igor-siergiej/shoppingo/commit/2b88d0907701808c442bc7b998711b93cada8e6b)), closes [#253](https://github.com/igor-siergiej/shoppingo/issues/253)

# [1.106.0](https://github.com/igor-siergiej/shoppingo/compare/v1.105.1...v1.106.0) (2026-10-18)


### Features

* **web:** guest mode — try the app without an account ([#253](https://github.com/igor-siergiej/shoppingo/issues/253)) ([af49b37](https://github.com/igor-siergiej/shoppingo/commit/af49b37b7b57b39200ce7bd02e0982270068b28e))

## [1.105.1](https://github.com/igor-siergiej/shoppingo/compare/v1.105.0...v1.105.1) (2026-10-18)


### Bug Fixes

* **web:** render RouteChangeTracker inside the router ([#254](https://github.com/igor-siergiej/shoppingo/issues/254)) ([442e7c6](https://github.com/igor-siergiej/shoppingo/commit/442e7c6e423f72b9e969eab74e7c4b116c8c755d)), closes [#252](https://github.com/igor-siergiej/shoppingo/issues/252)

# [1.105.0](https://github.com/igor-siergiej/shoppingo/compare/v1.104.0...v1.105.0) (2026-10-18)


### Features

* **web:** add Umami analytics module + the seven core events ([#252](https://github.com/igor-siergiej/shoppingo/issues/252)) ([54d435a](https://github.com/igor-siergiej/shoppingo/commit/54d435a125094cda1941fdae53727a23e3863bea)), closes [#72](https://github.com/igor-siergiej/shoppingo/issues/72) [#73](https://github.com/igor-siergiej/shoppingo/issues/73)

# [1.104.0](https://github.com/igor-siergiej/shoppingo/compare/v1.103.0...v1.104.0) (2026-10-17)


### Features

* **api:** list-invite share links for unauthenticated users ([#250](https://github.com/igor-siergiej/shoppingo/issues/250)) ([8847871](https://github.com/igor-siergiej/shoppingo/commit/88478710fdc2b80c33c1cdf42a11cb1a4972682e)), closes [#241](https://github.com/igor-siergiej/shoppingo/issues/241)

# [1.103.0](https://github.com/igor-siergiej/shoppingo/compare/v1.102.0...v1.103.0) (2026-10-17)


### Features

* **api:** AI features fail clean without FAL_KEY ([d3af21b](https://github.com/igor-siergiej/shoppingo/commit/d3af21b98ee148479d529e554dd8f20d06ac902a))

# [1.102.0](https://github.com/igor-siergiej/shoppingo/compare/v1.101.0...v1.102.0) (2026-10-17)


### Features

* **dev:** one-command dev stack with shared mock-kivo ([#248](https://github.com/igor-siergiej/shoppingo/issues/248)) ([82d10e6](https://github.com/igor-siergiej/shoppingo/commit/82d10e639ac0f52bf4e4b34a61e98bfa0534dd96))

# [1.101.0](https://github.com/igor-siergiej/shoppingo/compare/v1.100.0...v1.101.0) (2026-10-17)


### Features

* **dev:** one-command dev stack with shared mock-kivo ([#246](https://github.com/igor-siergiej/shoppingo/issues/246)) ([0a5eba4](https://github.com/igor-siergiej/shoppingo/commit/0a5eba489b166f1c06d60401a3084202d242f6f6))

# [1.100.0](https://github.com/igor-siergiej/shoppingo/compare/v1.99.0...v1.100.0) (2026-10-16)


### Features

* **api:** public read-only /api/public/discover/* with slugs ([#241](https://github.com/igor-siergiej/shoppingo/issues/241)) ([2b010b9](https://github.com/igor-siergiej/shoppingo/commit/2b010b916722cb925d477bb8d2b69d99f85fed4d))

# [1.99.0](https://github.com/igor-siergiej/shoppingo/compare/v1.98.0...v1.99.0) (2026-10-16)


### Features

* **security:** drop DOM storage for access token in shoppingo web ([95d63e0](https://github.com/igor-siergiej/shoppingo/commit/95d63e0d6b7503cb9945595a404db34ccecd25e1))
* **security:** gate kivo /users behind X-Service-Token, enforce AUTH_URL https ([1c27ce9](https://github.com/igor-siergiej/shoppingo/commit/1c27ce988cdd94155cafd6ea1b71b18216c463b7))
* **security:** patch DOM storage so access token never lands in localStorage ([d66d6fc](https://github.com/igor-siergiej/shoppingo/commit/d66d6fc28254d3721d02ee7ec83911a199a62498))

# [1.98.0](https://github.com/igor-siergiej/shoppingo/compare/v1.97.2...v1.98.0) (2026-10-16)


### Features

* **selfhost:** docker-compose for web + api + mongo + minio + kivo ([#234](https://github.com/igor-siergiej/shoppingo/issues/234)) ([2450a7d](https://github.com/igor-siergiej/shoppingo/commit/2450a7d8cedcf5529af33cf4601abfd4660da49e)), closes [#232](https://github.com/igor-siergiej/shoppingo/issues/232)

## [1.97.2](https://github.com/igor-siergiej/shoppingo/compare/v1.97.1...v1.97.2) (2026-10-16)


### Bug Fixes

* **web:** make nginx listen on 3000 to match Traefik/dokploy routing ([#232](https://github.com/igor-siergiej/shoppingo/issues/232)) ([ebcf3f8](https://github.com/igor-siergiej/shoppingo/commit/ebcf3f8e57dca227863b8e3993739c4cc07125ed))

## [1.97.1](https://github.com/igor-siergiej/shoppingo/compare/v1.97.0...v1.97.1) (2026-10-16)


### Bug Fixes

* **web:** use packages/web/nginx.conf in prod and honour E2E_BASE_URL ([#231](https://github.com/igor-siergiej/shoppingo/issues/231)) ([a398b37](https://github.com/igor-siergiej/shoppingo/commit/a398b376cd1cbcc812c1356287bd3683ba401db2))

# [1.97.0](https://github.com/igor-siergiej/shoppingo/compare/v1.96.0...v1.97.0) (2026-10-14)


### Features

* **api:** generate item icons on a plain white background ([#228](https://github.com/igor-siergiej/shoppingo/issues/228)) ([25dbbde](https://github.com/igor-siergiej/shoppingo/commit/25dbbded3bf1c9eaa6704dab674507aa351198d3))

# [1.96.0](https://github.com/igor-siergiej/shoppingo/compare/v1.95.5...v1.96.0) (2026-10-14)


### Features

* **web:** edit todos, order by time, mark overdue, warn on duplicate lists ([#227](https://github.com/igor-siergiej/shoppingo/issues/227)) ([ac9ecd4](https://github.com/igor-siergiej/shoppingo/commit/ac9ecd4f8d560e17d152dff1c82b0dfd7c614adf))

## [1.95.5](https://github.com/igor-siergiej/shoppingo/compare/v1.95.4...v1.95.5) (2026-10-13)


### Bug Fixes

* **web:** restore the time picker when adding a todo ([#223](https://github.com/igor-siergiej/shoppingo/issues/223)) ([b7f8a91](https://github.com/igor-siergiej/shoppingo/commit/b7f8a915e8a43de8cb1426a1968f88a9f12183ab)), closes [#173](https://github.com/igor-siergiej/shoppingo/issues/173)

## [1.95.4](https://github.com/igor-siergiej/shoppingo/compare/v1.95.3...v1.95.4) (2026-10-13)


### Bug Fixes

* **web:** keep tags entered when creating or editing a recipe ([#222](https://github.com/igor-siergiej/shoppingo/issues/222)) ([6cb6966](https://github.com/igor-siergiej/shoppingo/commit/6cb696661f5ebd8dfff4609dc9a8de88777d505b))

## [1.95.3](https://github.com/igor-siergiej/shoppingo/compare/v1.95.2...v1.95.3) (2026-10-13)


### Bug Fixes

* **web:** stop voice add re-sending a failed parse in a loop ([#221](https://github.com/igor-siergiej/shoppingo/issues/221)) ([4c31cf8](https://github.com/igor-siergiej/shoppingo/commit/4c31cf80b4150e2294214aab1cee0a752e4dce19))

## [1.95.2](https://github.com/igor-siergiej/shoppingo/compare/v1.95.1...v1.95.2) (2026-10-10)


### Bug Fixes

* **api:** wire the item categoriser into ListService ([#219](https://github.com/igor-siergiej/shoppingo/issues/219)) ([198cf82](https://github.com/igor-siergiej/shoppingo/commit/198cf825fd288d682be6f6b007b3de7432932ec6))

## [1.95.1](https://github.com/igor-siergiej/shoppingo/compare/v1.95.0...v1.95.1) (2026-10-10)


### Bug Fixes

* **api:** categorise items that never got an aisle when a list is read ([#218](https://github.com/igor-siergiej/shoppingo/issues/218)) ([334cd7c](https://github.com/igor-siergiej/shoppingo/commit/334cd7c971ba6d162b71f85e40df8c5f39527a60))

# [1.95.0](https://github.com/igor-siergiej/shoppingo/compare/v1.94.3...v1.95.0) (2026-10-10)


### Features

* **web:** optional keep-listening mode for voice input ([#217](https://github.com/igor-siergiej/shoppingo/issues/217)) ([a74f74d](https://github.com/igor-siergiej/shoppingo/commit/a74f74ddb93a78b0d6f7181c58fe1d3276c91713))

## [1.94.3](https://github.com/igor-siergiej/shoppingo/compare/v1.94.2...v1.94.3) (2026-10-10)


### Performance Improvements

* **web:** load release notes on demand and drop the artificial route delay ([#215](https://github.com/igor-siergiej/shoppingo/issues/215)) ([ee63567](https://github.com/igor-siergiej/shoppingo/commit/ee635671e18f1e9af306fe51210f7d2114cc42a1))

## [1.94.2](https://github.com/igor-siergiej/shoppingo/compare/v1.94.1...v1.94.2) (2026-10-10)


### Bug Fixes

* **web:** point the query vendor chunk at @tanstack/react-query ([#212](https://github.com/igor-siergiej/shoppingo/issues/212)) ([1ac2431](https://github.com/igor-siergiej/shoppingo/commit/1ac2431ead3668793b48d1d776d92609b8e89bdf))

## [1.94.1](https://github.com/igor-siergiej/shoppingo/compare/v1.94.0...v1.94.1) (2026-10-10)


### Performance Improvements

* **api:** index todos, labels, friends and push; remove two N+1s ([#210](https://github.com/igor-siergiej/shoppingo/issues/210)) ([5dfb473](https://github.com/igor-siergiej/shoppingo/commit/5dfb473b2f62c18f191afc6c33157fbd4d89d469))

# [1.94.0](https://github.com/igor-siergiej/shoppingo/compare/v1.93.0...v1.94.0) (2026-10-10)


### Features

* **web:** expose list actions to browser agents via WebMCP ([#207](https://github.com/igor-siergiej/shoppingo/issues/207)) ([f56c103](https://github.com/igor-siergiej/shoppingo/commit/f56c1031452e433890903a9e738c8936759175b9))

# [1.93.0](https://github.com/igor-siergiej/shoppingo/compare/v1.92.0...v1.93.0) (2026-10-10)


### Features

* meal plan that builds the shopping list ([#206](https://github.com/igor-siergiej/shoppingo/issues/206)) ([eca857d](https://github.com/igor-siergiej/shoppingo/commit/eca857de2eae6e66988e3fc764fd03b21da6e9b9))

# [1.92.0](https://github.com/igor-siergiej/shoppingo/compare/v1.91.0...v1.92.0) (2026-10-10)


### Features

* add shopping items by voice ([#205](https://github.com/igor-siergiej/shoppingo/issues/205)) ([98333c8](https://github.com/igor-siergiej/shoppingo/commit/98333c8de38d93397e3cbe6954061b56353044fa))

# [1.91.0](https://github.com/igor-siergiej/shoppingo/compare/v1.90.0...v1.91.0) (2026-10-10)


### Features

* group shopping list items by aisle ([#204](https://github.com/igor-siergiej/shoppingo/issues/204)) ([8a2a586](https://github.com/igor-siergiej/shoppingo/commit/8a2a5862575d3f55ff8339933fb54ab118084054))

# [1.90.0](https://github.com/igor-siergiej/shoppingo/compare/v1.89.7...v1.90.0) (2026-10-10)


### Features

* **api:** per-user AI rate limit, substitute cache, trusted log client IP ([#203](https://github.com/igor-siergiej/shoppingo/issues/203)) ([387825b](https://github.com/igor-siergiej/shoppingo/commit/387825b45d16e6826dd1fc9f0a8da19430ab5550))

## [1.89.7](https://github.com/igor-siergiej/shoppingo/compare/v1.89.6...v1.89.7) (2026-10-10)


### Performance Improvements

* **api:** tag new recipes in the background ([#202](https://github.com/igor-siergiej/shoppingo/issues/202)) ([28cb1f2](https://github.com/igor-siergiej/shoppingo/commit/28cb1f2c0640771fc58fba3567bb6f2906b73e22))

## [1.89.6](https://github.com/igor-siergiej/shoppingo/compare/v1.89.5...v1.89.6) (2026-10-10)


### Bug Fixes

* **api:** harden recipe image uploads ([#201](https://github.com/igor-siergiej/shoppingo/issues/201)) ([b7f97ca](https://github.com/igor-siergiej/shoppingo/commit/b7f97cac550e7729eab9e29cb2d5bbcf88874be1))

## [1.89.5](https://github.com/igor-siergiej/shoppingo/compare/v1.89.4...v1.89.5) (2026-10-10)


### Bug Fixes

* **web:** wipe cached API data and offline queue on logout ([#200](https://github.com/igor-siergiej/shoppingo/issues/200)) ([a495316](https://github.com/igor-siergiej/shoppingo/commit/a495316b13b7f6fad3b509b2f9ca242ccc9ff815))

## [1.89.4](https://github.com/igor-siergiej/shoppingo/compare/v1.89.3...v1.89.4) (2026-10-10)


### Bug Fixes

* **api:** block SSRF in recipe import and image proxy ([#199](https://github.com/igor-siergiej/shoppingo/issues/199)) ([923dcc1](https://github.com/igor-siergiej/shoppingo/commit/923dcc19a3b5058ce204af7d6f271a55d2672844))

## [1.89.3](https://github.com/igor-siergiej/shoppingo/compare/v1.89.2...v1.89.3) (2026-10-10)


### Bug Fixes

* **api:** reject duplicate list titles on create ([#198](https://github.com/igor-siergiej/shoppingo/issues/198)) ([1e9ecc0](https://github.com/igor-siergiej/shoppingo/commit/1e9ecc0625257ddb5876e99c3c373a21082e44fa))

## [1.89.2](https://github.com/igor-siergiej/shoppingo/compare/v1.89.1...v1.89.2) (2026-10-10)


### Bug Fixes

* **api:** require auth and cap cost for item image generation ([#197](https://github.com/igor-siergiej/shoppingo/issues/197)) ([cb15b57](https://github.com/igor-siergiej/shoppingo/commit/cb15b57eeebee887a5defcd5be905054ed83cad9))

## [1.89.1](https://github.com/igor-siergiej/shoppingo/compare/v1.89.0...v1.89.1) (2026-10-10)


### Bug Fixes

* **api:** index list/recipe lookups, stop lost list updates, add k6 capacity test ([#196](https://github.com/igor-siergiej/shoppingo/issues/196)) ([281714f](https://github.com/igor-siergiej/shoppingo/commit/281714f23dcf024587cb7f4ace4bcb53ee432755))

# [1.89.0](https://github.com/igor-siergiej/shoppingo/compare/v1.88.0...v1.89.0) (2026-10-08)


### Features

* show Wikibooks recipe pictures in Discover, credited ([#195](https://github.com/igor-siergiej/shoppingo/issues/195)) ([e6369c6](https://github.com/igor-siergiej/shoppingo/commit/e6369c6effae0c6d13d736bbf8367b1109aebb00))

# [1.88.0](https://github.com/igor-siergiej/shoppingo/compare/v1.87.0...v1.88.0) (2026-10-08)


### Features

* let users publish their own recipes to the Discover library ([#194](https://github.com/igor-siergiej/shoppingo/issues/194)) ([820de12](https://github.com/igor-siergiej/shoppingo/commit/820de1272155766aa7e770f3a004eb50d2679b74))

# [1.87.0](https://github.com/igor-siergiej/shoppingo/compare/v1.86.0...v1.87.0) (2026-10-08)


### Features

* **web:** Discover page to browse, search, preview and add library recipes ([#193](https://github.com/igor-siergiej/shoppingo/issues/193)) ([32630b5](https://github.com/igor-siergiej/shoppingo/commit/32630b5f64ea4addb0b0fd43ffa95aa434b5f138))

# [1.86.0](https://github.com/igor-siergiej/shoppingo/compare/v1.85.0...v1.86.0) (2026-10-07)


### Features

* **api:** ingest the Wikibooks Cookbook into the discovery library ([#192](https://github.com/igor-siergiej/shoppingo/issues/192)) ([8c8a684](https://github.com/igor-siergiej/shoppingo/commit/8c8a684ea42184af88e4edd5ccf2098eaf938cce))

# [1.85.0](https://github.com/igor-siergiej/shoppingo/compare/v1.84.2...v1.85.0) (2026-10-07)


### Features

* **api:** OpenSearch-backed search over a shared recipe library ([#191](https://github.com/igor-siergiej/shoppingo/issues/191)) ([42791e9](https://github.com/igor-siergiej/shoppingo/commit/42791e91d6ad15a8b0e82cbd4307d959d1e2d0fa))

## [1.84.2](https://github.com/igor-siergiej/shoppingo/compare/v1.84.1...v1.84.2) (2026-10-06)


### Bug Fixes

* **api:** stop multi-user sessions tripping kivo's rate limit ([#190](https://github.com/igor-siergiej/shoppingo/issues/190)) ([3863229](https://github.com/igor-siergiej/shoppingo/commit/386322985f5c5999591aa209b5e80b2b5e01bc53))

## [1.84.1](https://github.com/igor-siergiej/shoppingo/compare/v1.84.0...v1.84.1) (2026-10-06)


### Bug Fixes

* **web:** rejected offline edits no longer jam the sync queue ([#189](https://github.com/igor-siergiej/shoppingo/issues/189)) ([80e281e](https://github.com/igor-siergiej/shoppingo/commit/80e281e18b7b8fa88197693d50c497fb88e9785b))

# [1.84.0](https://github.com/igor-siergiej/shoppingo/compare/v1.83.0...v1.84.0) (2026-10-05)


### Features

* real-time shared lists over websocket, with presence ([#188](https://github.com/igor-siergiej/shoppingo/issues/188)) ([524f0b0](https://github.com/igor-siergiej/shoppingo/commit/524f0b0f328c261467aa9b49553bcd25bdddc53f))

# [1.83.0](https://github.com/igor-siergiej/shoppingo/compare/v1.82.6...v1.83.0) (2026-10-05)


### Features

* **web:** mark list items that are waiting to sync ([#187](https://github.com/igor-siergiej/shoppingo/issues/187)) ([bf964d0](https://github.com/igor-siergiej/shoppingo/commit/bf964d046888d7bdadd3d73e0191ef533e73d0af))

## [1.82.6](https://github.com/igor-siergiej/shoppingo/compare/v1.82.5...v1.82.6) (2026-10-05)


### Bug Fixes

* **release:** publish every Release-Notes trailer once, repair 1.82.x notes ([#186](https://github.com/igor-siergiej/shoppingo/issues/186)) ([974fe52](https://github.com/igor-siergiej/shoppingo/commit/974fe525704e2c623c9bec33eafdec185d16aa4c)), closes [181-#185](https://github.com/181-/issues/185)

## [1.82.5](https://github.com/igor-siergiej/shoppingo/compare/v1.82.4...v1.82.5) (2026-10-03)


### Bug Fixes

* **web:** stop Chrome Android autofill on Add Recipe / Add Ingredient inputs ([#185](https://github.com/igor-siergiej/shoppingo/issues/185)) ([223ab29](https://github.com/igor-siergiej/shoppingo/commit/223ab29497232eb6628dc56ce86a29e1223c51e0))

## [1.82.4](https://github.com/igor-siergiej/shoppingo/compare/v1.82.3...v1.82.4) (2026-10-03)


### Bug Fixes

* **web:** dismiss IngredientSubstitutesPopover on scroll ([#184](https://github.com/igor-siergiej/shoppingo/issues/184)) ([5dddc00](https://github.com/igor-siergiej/shoppingo/commit/5dddc00a76d858f6c4c5e8ee3e20b4ae251507de))

## [1.82.3](https://github.com/igor-siergiej/shoppingo/compare/v1.82.2...v1.82.3) (2026-10-03)


### Bug Fixes

* **web:** align registration password rule with kivo, surface server message ([#183](https://github.com/igor-siergiej/shoppingo/issues/183)) ([975ebf2](https://github.com/igor-siergiej/shoppingo/commit/975ebf26d0fa5d7eb9c9b93e00bc25ce553b1fa8))

## [1.82.2](https://github.com/igor-siergiej/shoppingo/compare/v1.82.1...v1.82.2) (2026-10-03)


### Bug Fixes

* **web:** position toasts at the top so they don't cover the bottom app bar ([#182](https://github.com/igor-siergiej/shoppingo/issues/182)) ([877980a](https://github.com/igor-siergiej/shoppingo/commit/877980a7dea1422dadb92f84d930aac1b7be2dcc))

## [1.82.1](https://github.com/igor-siergiej/shoppingo/compare/v1.82.0...v1.82.1) (2026-10-03)


### Bug Fixes

* **web:** FriendPicker Switch does not steal focus from sibling inputs ([#181](https://github.com/igor-siergiej/shoppingo/issues/181)) ([44a099c](https://github.com/igor-siergiej/shoppingo/commit/44a099cab6c8128da4d7eca52c09d893295be5ac))

# [1.82.0](https://github.com/igor-siergiej/shoppingo/compare/v1.81.0...v1.82.0) (2026-10-03)


### Features

* **web:** show prep/cook time and servings on recipe cards ([#180](https://github.com/igor-siergiej/shoppingo/issues/180)) ([0ac6578](https://github.com/igor-siergiej/shoppingo/commit/0ac65789cfcb32f72294b681eb81165e48ef60ac))

# [1.81.0](https://github.com/igor-siergiej/shoppingo/compare/v1.80.0...v1.81.0) (2026-09-29)


### Features

* **web:** scale recipe ingredient quantities by a portions stepper ([#179](https://github.com/igor-siergiej/shoppingo/issues/179)) ([b89affa](https://github.com/igor-siergiej/shoppingo/commit/b89affaa1ba0356b3368acc13475a9facbf92b71))

# [1.80.0](https://github.com/igor-siergiej/shoppingo/compare/v1.79.1...v1.80.0) (2026-09-29)


### Features

* **web:** add canonical input-attribute presets for mobile keyboards ([#178](https://github.com/igor-siergiej/shoppingo/issues/178)) ([f3ae547](https://github.com/igor-siergiej/shoppingo/commit/f3ae547acc7d250a36a1a016a67cd2fdb4fa56e4))

## [1.79.1](https://github.com/igor-siergiej/shoppingo/compare/v1.79.0...v1.79.1) (2026-09-29)


### Bug Fixes

* **web:** Waste Warrior search no longer steals focus on page load ([#177](https://github.com/igor-siergiej/shoppingo/issues/177)) ([51821b6](https://github.com/igor-siergiej/shoppingo/commit/51821b63fa84608a8e64053f15a67478fab8961d))

# [1.79.0](https://github.com/igor-siergiej/shoppingo/compare/v1.78.0...v1.79.0) (2026-09-29)


### Features

* **web:** single page-level Edit on Recipe Detail instead of per-section edits ([#176](https://github.com/igor-siergiej/shoppingo/issues/176)) ([66d8aeb](https://github.com/igor-siergiej/shoppingo/commit/66d8aeb4f8ec95f91cb33eb184d9738b92ebc381))

# [1.78.0](https://github.com/igor-siergiej/shoppingo/compare/v1.77.0...v1.78.0) (2026-09-29)


### Features

* **web:** add-recipe choice is a modal drawer, Cancel only at the bottom ([#175](https://github.com/igor-siergiej/shoppingo/issues/175)) ([670d049](https://github.com/igor-siergiej/shoppingo/commit/670d049d08a844fa149fdb3c67e73ac4e4719c19))

# [1.77.0](https://github.com/igor-siergiej/shoppingo/compare/v1.76.0...v1.77.0) (2026-09-28)


### Features

* **recipes:** suggest substitutes for a recipe ingredient ([#174](https://github.com/igor-siergiej/shoppingo/issues/174)) ([bac883b](https://github.com/igor-siergiej/shoppingo/commit/bac883b2e0b7e981325b151237c1d888f355b4e0))

# [1.76.0](https://github.com/igor-siergiej/shoppingo/compare/v1.75.2...v1.76.0) (2026-09-28)


### Features

* **recipes:** add prep time, cook time, servings and difficulty ([#173](https://github.com/igor-siergiej/shoppingo/issues/173)) ([4e1ab70](https://github.com/igor-siergiej/shoppingo/commit/4e1ab70fbc22019c990f0d2c4448381d9e8cb60f))

## [1.75.2](https://github.com/igor-siergiej/shoppingo/compare/v1.75.1...v1.75.2) (2026-09-28)


### Bug Fixes

* **web:** Recipe Detail no longer false-triggers pull-to-refresh on scroll ([#172](https://github.com/igor-siergiej/shoppingo/issues/172)) ([a79132e](https://github.com/igor-siergiej/shoppingo/commit/a79132ecd812dc60513dc36908a4d223e562add7)), closes [#122](https://github.com/igor-siergiej/shoppingo/issues/122)

## [1.75.1](https://github.com/igor-siergiej/shoppingo/compare/v1.75.0...v1.75.1) (2026-09-28)


### Bug Fixes

* **web:** recipe title no longer autofocuses after an import ([#171](https://github.com/igor-siergiej/shoppingo/issues/171)) ([f564dd6](https://github.com/igor-siergiej/shoppingo/commit/f564dd6d8bd56209e21a58a1dc01c7bd1cfd11cd))

# [1.75.0](https://github.com/igor-siergiej/shoppingo/compare/v1.74.3...v1.75.0) (2026-09-28)


### Features

* **api:** merge near-duplicate ingredients into one shopping list row ([#170](https://github.com/igor-siergiej/shoppingo/issues/170)) ([4aa74d6](https://github.com/igor-siergiej/shoppingo/commit/4aa74d6abcea214e8e11a038602d7eaa556c9064))

## [1.74.3](https://github.com/igor-siergiej/shoppingo/compare/v1.74.2...v1.74.3) (2026-09-28)


### Bug Fixes

* **web:** require a tap on the revealed Delete button, no swipe-only delete ([#169](https://github.com/igor-siergiej/shoppingo/issues/169)) ([6fba673](https://github.com/igor-siergiej/shoppingo/commit/6fba67357f85745727bb5ed5977590ebe2002a98)), closes [#166](https://github.com/igor-siergiej/shoppingo/issues/166)

## [1.74.2](https://github.com/igor-siergiej/shoppingo/compare/v1.74.1...v1.74.2) (2026-09-27)


### Bug Fixes

* **web:** hide recipe edit/delete while selecting ingredients for a list ([#167](https://github.com/igor-siergiej/shoppingo/issues/167)) ([54fd556](https://github.com/igor-siergiej/shoppingo/commit/54fd556850ed90e612e54ca4205704192a437557))

## [1.74.1](https://github.com/igor-siergiej/shoppingo/compare/v1.74.0...v1.74.1) (2026-09-27)


### Bug Fixes

* **web:** shopping list delete no longer needs a second press ([#166](https://github.com/igor-siergiej/shoppingo/issues/166)) ([49ca1be](https://github.com/igor-siergiej/shoppingo/commit/49ca1bef7f7fe33ae9a14f3bef7ab5e8457d9d1b))

# [1.74.0](https://github.com/igor-siergiej/shoppingo/compare/v1.73.1...v1.74.0) (2026-09-23)


### Features

* **web:** what's new panel behind the version badge ([#164](https://github.com/igor-siergiej/shoppingo/issues/164)) ([d892590](https://github.com/igor-siergiej/shoppingo/commit/d892590204c94ff4282dc2c4adab34e9655a9eac))

## [1.73.1](https://github.com/igor-siergiej/shoppingo/compare/v1.73.0...v1.73.1) (2026-09-21)


### Bug Fixes

* **web:** keyboard-safe pinned search in the add-from-recipe drawer ([#163](https://github.com/igor-siergiej/shoppingo/issues/163)) ([ef8281d](https://github.com/igor-siergiej/shoppingo/commit/ef8281da6650b6e52ad7c3b764405b2b406536c5))

# [1.73.0](https://github.com/igor-siergiej/shoppingo/compare/v1.72.0...v1.73.0) (2026-09-21)


### Features

* **web:** Waste Warrior becomes a full page instead of a drawer ([#162](https://github.com/igor-siergiej/shoppingo/issues/162)) ([f60f1d7](https://github.com/igor-siergiej/shoppingo/commit/f60f1d7b9edc42ee88855b8e8edcc4c897038875))

# [1.72.0](https://github.com/igor-siergiej/shoppingo/compare/v1.71.1...v1.72.0) (2026-09-21)


### Features

* **web:** staged in-flight feedback for recipe URL imports ([#161](https://github.com/igor-siergiej/shoppingo/issues/161)) ([25754d1](https://github.com/igor-siergiej/shoppingo/commit/25754d1c408c8e2dbb162964038691dd6ba5eb66))

## [1.71.1](https://github.com/igor-siergiej/shoppingo/compare/v1.71.0...v1.71.1) (2026-09-21)


### Bug Fixes

* **web:** widen recipes grid beyond the 500px column on desktop ([#160](https://github.com/igor-siergiej/shoppingo/issues/160)) ([0cc444e](https://github.com/igor-siergiej/shoppingo/commit/0cc444ef16febe0fd07501b27ce03d3193a9dd94))

# [1.71.0](https://github.com/igor-siergiej/shoppingo/compare/v1.70.0...v1.71.0) (2026-09-19)


### Features

* **calendar:** edit-time sharing for todos ([#159](https://github.com/igor-siergiej/shoppingo/issues/159)) ([a129717](https://github.com/igor-siergiej/shoppingo/commit/a1297175ade40e136784f102300024e3b757a914))

# [1.70.0](https://github.com/igor-siergiej/shoppingo/compare/v1.69.0...v1.70.0) (2026-09-15)


### Features

* **api:** push notifications for todo sharing, fan out daily reminders to shared members ([#158](https://github.com/igor-siergiej/shoppingo/issues/158)) ([e9553c0](https://github.com/igor-siergiej/shoppingo/commit/e9553c047275126ba75cc5be4ca6b07f636783a5))

# [1.69.0](https://github.com/igor-siergiej/shoppingo/compare/v1.68.1...v1.69.0) (2026-09-14)


### Features

* **recipes:** reuse ItemCheckBoxCard for manual ingredient rows ([#157](https://github.com/igor-siergiej/shoppingo/issues/157)) ([e5dfc3a](https://github.com/igor-siergiej/shoppingo/commit/e5dfc3af62a6d0317c512e2604e1d47318254e4b))

## [1.68.1](https://github.com/igor-siergiej/shoppingo/compare/v1.68.0...v1.68.1) (2026-09-14)


### Bug Fixes

* **web:** stop auto-converting tsp/tbsp/cup on unit-system conversion ([#156](https://github.com/igor-siergiej/shoppingo/issues/156)) ([202c256](https://github.com/igor-siergiej/shoppingo/commit/202c25695e66a2150229d0eac3b6edf1f71f5950))

# [1.68.0](https://github.com/igor-siergiej/shoppingo/compare/v1.67.0...v1.68.0) (2026-09-14)


### Features

* **recipes:** shopping-list-style add/edit/delete drawer for manual ingredients ([#155](https://github.com/igor-siergiej/shoppingo/issues/155)) ([656a3d7](https://github.com/igor-siergiej/shoppingo/commit/656a3d7674564e52b1df2f702ee213cd15ac7d09))

# [1.67.0](https://github.com/igor-siergiej/shoppingo/compare/v1.66.1...v1.67.0) (2026-09-14)


### Features

* **recipes:** pick ingredients from an existing shopping list on manual create ([#154](https://github.com/igor-siergiej/shoppingo/issues/154)) ([35c993e](https://github.com/igor-siergiej/shoppingo/commit/35c993eb064a23d24e4b9cddbc93a381c1006330))

## [1.66.1](https://github.com/igor-siergiej/shoppingo/compare/v1.66.0...v1.66.1) (2026-09-13)


### Bug Fixes

* **web:** stop double toast on ingredient delete, show zero on success ([#153](https://github.com/igor-siergiej/shoppingo/issues/153)) ([322b865](https://github.com/igor-siergiej/shoppingo/commit/322b86519ec89a21adda612460d5971ad6003ffd))

# [1.66.0](https://github.com/igor-siergiej/shoppingo/compare/v1.65.3...v1.66.0) (2026-09-13)


### Features

* **recipes:** Waste Warrior — find recipes that use a given ingredient ([#152](https://github.com/igor-siergiej/shoppingo/issues/152)) ([65d8070](https://github.com/igor-siergiej/shoppingo/commit/65d8070fc05f935929feedb7024d26ca89c07a87))

## [1.65.3](https://github.com/igor-siergiej/shoppingo/compare/v1.65.2...v1.65.3) (2026-09-13)


### Bug Fixes

* **web:** stop payment-autofill popups on Add Recipe form fields ([#149](https://github.com/igor-siergiej/shoppingo/issues/149)) ([90bf1ff](https://github.com/igor-siergiej/shoppingo/commit/90bf1ffa09a54b1cf1201c60c32e18f2f37ec1ff))

## [1.65.2](https://github.com/igor-siergiej/shoppingo/compare/v1.65.1...v1.65.2) (2026-09-13)


### Bug Fixes

* **ci:** pass mongo credentials to the e2e test step ([#150](https://github.com/igor-siergiej/shoppingo/issues/150)) ([5adcb74](https://github.com/igor-siergiej/shoppingo/commit/5adcb74c005439d2d63ef641e6130d204ec6cace))

## [1.65.1](https://github.com/igor-siergiej/shoppingo/compare/v1.65.0...v1.65.1) (2026-09-13)


### Bug Fixes

* **web:** pin recipe search field to bottom, results build upward ([#148](https://github.com/igor-siergiej/shoppingo/issues/148)) ([48e084d](https://github.com/igor-siergiej/shoppingo/commit/48e084d5ff44c0374961b2372eec6676c0a1d728))

# [1.65.0](https://github.com/igor-siergiej/shoppingo/compare/v1.64.2...v1.65.0) (2026-09-13)


### Features

* **web:** recipe UI/UX rework — sectioned Add Recipe, hero-image Recipe Detail ([#146](https://github.com/igor-siergiej/shoppingo/issues/146)) ([513e7ab](https://github.com/igor-siergiej/shoppingo/commit/513e7abc4e1af657e8e64d91568db269be5c5f2b))

## [1.64.2](https://github.com/igor-siergiej/shoppingo/compare/v1.64.1...v1.64.2) (2026-09-12)


### Bug Fixes

* **ci:** make the PR workflow trigger on branches with slashes ([#147](https://github.com/igor-siergiej/shoppingo/issues/147)) ([37b104b](https://github.com/igor-siergiej/shoppingo/commit/37b104bcc536a2a09ee8b405f202f3ecdc18625a))

## [1.64.1](https://github.com/igor-siergiej/shoppingo/compare/v1.64.0...v1.64.1) (2026-09-12)


### Bug Fixes

* **web:** drop recipe tag-chip filter, keep search hidden-only ([#145](https://github.com/igor-siergiej/shoppingo/issues/145)) ([0e48d03](https://github.com/igor-siergiej/shoppingo/commit/0e48d03ae39125a35a69e3644efe3818b9f1d890)), closes [#144](https://github.com/igor-siergiej/shoppingo/issues/144)

# [1.64.0](https://github.com/igor-siergiej/shoppingo/compare/v1.63.2...v1.64.0) (2026-09-12)


### Features

* **recipes:** add manual + AI-generated tags, searchable and filterable ([#144](https://github.com/igor-siergiej/shoppingo/issues/144)) ([c804430](https://github.com/igor-siergiej/shoppingo/commit/c804430b9bb2fb7a7fd57fa2f6390a48c985ccd9))

## [1.63.2](https://github.com/igor-siergiej/shoppingo/compare/v1.63.1...v1.63.2) (2026-09-12)


### Bug Fixes

* **web:** schedule undated todos by tapping a day, not just dragging ([#143](https://github.com/igor-siergiej/shoppingo/issues/143)) ([6bd6d38](https://github.com/igor-siergiej/shoppingo/commit/6bd6d3832e78ec5d513055da79c38cd6bc88ab20))

## [1.63.1](https://github.com/igor-siergiej/shoppingo/compare/v1.63.0...v1.63.1) (2026-09-12)


### Bug Fixes

* **web:** stop recipe image skeleton sticking and 403 on first import-add ([#142](https://github.com/igor-siergiej/shoppingo/issues/142)) ([b218b52](https://github.com/igor-siergiej/shoppingo/commit/b218b5214b2439db2e6baf10aaa0f25fd030b269))

# [1.63.0](https://github.com/igor-siergiej/shoppingo/compare/v1.62.0...v1.63.0) (2026-09-09)


### Features

* **web:** convert imported recipe units to a preferred system ([#137](https://github.com/igor-siergiej/shoppingo/issues/137)) ([4431f59](https://github.com/igor-siergiej/shoppingo/commit/4431f59f76b8fbd98f8d5057897e6723c20589b4))

# [1.62.0](https://github.com/igor-siergiej/shoppingo/compare/v1.61.0...v1.62.0) (2026-09-09)


### Features

* **web:** give the extra-actions menu a surface panel ([#136](https://github.com/igor-siergiej/shoppingo/issues/136)) ([8f71e4b](https://github.com/igor-siergiej/shoppingo/commit/8f71e4b25ccf94531fc6cf3c7d8768af17e08733))

# [1.61.0](https://github.com/igor-siergiej/shoppingo/compare/v1.60.0...v1.61.0) (2026-09-09)


### Features

* **web:** redesign recipe card with mobile single-column layout ([#134](https://github.com/igor-siergiej/shoppingo/issues/134)) ([735fc97](https://github.com/igor-siergiej/shoppingo/commit/735fc97af844f44de2fa3c7c3272d4c8115532e2))

# [1.60.0](https://github.com/igor-siergiej/shoppingo/compare/v1.59.10...v1.60.0) (2026-08-26)


### Features

* **web:** replace shared-list badge with member avatar stack ([#133](https://github.com/igor-siergiej/shoppingo/issues/133)) ([8e44a32](https://github.com/igor-siergiej/shoppingo/commit/8e44a3242497a1022c69c8e0a843c7e0e6590552))

## [1.59.10](https://github.com/igor-siergiej/shoppingo/compare/v1.59.9...v1.59.10) (2026-08-20)


### Bug Fixes

* **web:** disable autofill on add-recipe fields and reclaim wasted layout space ([#131](https://github.com/igor-siergiej/shoppingo/issues/131)) ([63d9d79](https://github.com/igor-siergiej/shoppingo/commit/63d9d794aaca4ebf431258d4846432b55b38820a))

## [1.59.9](https://github.com/igor-siergiej/shoppingo/compare/v1.59.8...v1.59.9) (2026-08-18)


### Bug Fixes

* **web:** merge shared/personal lists and recipes into one view ([#128](https://github.com/igor-siergiej/shoppingo/issues/128)) ([2aed5b9](https://github.com/igor-siergiej/shoppingo/commit/2aed5b9e0a96a03fbb790a7934c57766e86dc7a9))

## [1.59.8](https://github.com/igor-siergiej/shoppingo/compare/v1.59.7...v1.59.8) (2026-08-18)


### Bug Fixes

* **web:** recipe import UX improvements ([#127](https://github.com/igor-siergiej/shoppingo/issues/127)) ([58f0e83](https://github.com/igor-siergiej/shoppingo/commit/58f0e8338c612fa6639ed17f994ee583899c77c0))

## [1.59.7](https://github.com/igor-siergiej/shoppingo/compare/v1.59.6...v1.59.7) (2026-08-09)


### Bug Fixes

* **web:** swap each section's own toolbar icon for back, harden search-input autofill ([#126](https://github.com/igor-siergiej/shoppingo/issues/126)) ([acc231b](https://github.com/igor-siergiej/shoppingo/commit/acc231b319c2ecf1d19e73aab3c583a740e6cca0))

## [1.59.6](https://github.com/igor-siergiej/shoppingo/compare/v1.59.5...v1.59.6) (2026-08-09)


### Bug Fixes

* **web:** sync boot theme-color and add dark PWA manifest to stop flashbang ([#125](https://github.com/igor-siergiej/shoppingo/issues/125)) ([cb7ea41](https://github.com/igor-siergiej/shoppingo/commit/cb7ea411ded91bcbd0ecf6951d012ceb3f5bef36))

## [1.59.5](https://github.com/igor-siergiej/shoppingo/compare/v1.59.4...v1.59.5) (2026-08-09)


### Bug Fixes

* remove leftover 'send test reminder' debug trigger ([#124](https://github.com/igor-siergiej/shoppingo/issues/124)) ([380460c](https://github.com/igor-siergiej/shoppingo/commit/380460c43392345574c8807724169b1ee78c40b2))

## [1.59.4](https://github.com/igor-siergiej/shoppingo/compare/v1.59.3...v1.59.4) (2026-08-09)


### Bug Fixes

* **web:** draw input focus ring inset so it can't be clipped by ancestor overflow ([#123](https://github.com/igor-siergiej/shoppingo/issues/123)) ([94ed270](https://github.com/igor-siergiej/shoppingo/commit/94ed270e83d56ca271c418d1002596da66e997fc))

## [1.59.3](https://github.com/igor-siergiej/shoppingo/compare/v1.59.2...v1.59.3) (2026-08-09)


### Bug Fixes

* **web:** stop pull-to-refresh false-triggering while scrolling recipes ([#122](https://github.com/igor-siergiej/shoppingo/issues/122)) ([e4596d4](https://github.com/igor-siergiej/shoppingo/commit/e4596d49f773d0fdb2b40406984155b9be2f61eb))

## [1.59.2](https://github.com/igor-siergiej/shoppingo/compare/v1.59.1...v1.59.2) (2026-08-09)


### Bug Fixes

* **web:** stop payment-autofill popup on recipe search inputs ([#121](https://github.com/igor-siergiej/shoppingo/issues/121)) ([a566283](https://github.com/igor-siergiej/shoppingo/commit/a566283f15da0905590a1d30f2d7ef3af3576af8))

## [1.59.1](https://github.com/igor-siergiej/shoppingo/compare/v1.59.0...v1.59.1) (2026-08-09)


### Bug Fixes

* **web:** include shared friends in optimistic recipe.create cache and invalidate list on sharing changes ([#120](https://github.com/igor-siergiej/shoppingo/issues/120)) ([fcfaa6f](https://github.com/igor-siergiej/shoppingo/commit/fcfaa6f44ec001db9aa0134d4f4b9c7cad811049))

# [1.59.0](https://github.com/igor-siergiej/shoppingo/compare/v1.58.6...v1.59.0) (2026-08-09)


### Features

* **e2e:** add kanban-worker repo config and a real [@smoke-tagged](https://github.com/smoke-tagged) test ([#119](https://github.com/igor-siergiej/shoppingo/issues/119)) ([63d554d](https://github.com/igor-siergiej/shoppingo/commit/63d554d86b95071cbe379e510dd79c7d02a76f0f))

## [1.58.6](https://github.com/igor-siergiej/shoppingo/compare/v1.58.5...v1.58.6) (2026-08-09)


### Bug Fixes

* **web:** use history-aware back navigation on Items and Recipe Detail pages ([#118](https://github.com/igor-siergiej/shoppingo/issues/118)) ([4878cb4](https://github.com/igor-siergiej/shoppingo/commit/4878cb4249d24578daf1dc7875375484fb15eda5))

## [1.58.5](https://github.com/igor-siergiej/shoppingo/compare/v1.58.4...v1.58.5) (2026-08-07)


### Bug Fixes

* **web:** toolbar/nav polish, add-friend rework, and recipe search/sharing fixes ([#117](https://github.com/igor-siergiej/shoppingo/issues/117)) ([fd10f98](https://github.com/igor-siergiej/shoppingo/commit/fd10f98c9105816f146d90e9b8d0eb034240ecf4))

## [1.58.4](https://github.com/igor-siergiej/shoppingo/compare/v1.58.3...v1.58.4) (2026-08-02)


### Bug Fixes

* **web:** rework mobile toolbar, add-friend drawer, and actions FAB ([#116](https://github.com/igor-siergiej/shoppingo/issues/116)) ([c3031b9](https://github.com/igor-siergiej/shoppingo/commit/c3031b9f222f1f18c364033e1fd4336c66215c0f))

## [1.58.3](https://github.com/igor-siergiej/shoppingo/compare/v1.58.2...v1.58.3) (2026-08-01)


### Bug Fixes

* **web:** make mobile add-friend drawer nicer ([#115](https://github.com/igor-siergiej/shoppingo/issues/115)) ([bd7058e](https://github.com/igor-siergiej/shoppingo/commit/bd7058e53b4a16b1726f90a029b732c98f6e1075))

## [1.58.2](https://github.com/igor-siergiej/shoppingo/compare/v1.58.1...v1.58.2) (2026-07-11)


### Bug Fixes

* **recipe-import:** recover JSON-LD with raw control chars in strings ([#113](https://github.com/igor-siergiej/shoppingo/issues/113)) ([f5d72d3](https://github.com/igor-siergiej/shoppingo/commit/f5d72d3d066aeaff1660859e6addce632570f771))

## [1.58.1](https://github.com/igor-siergiej/shoppingo/compare/v1.58.0...v1.58.1) (2026-07-10)


### Bug Fixes

* **web:** recover shared recipe url from Android's text/title share fields ([#112](https://github.com/igor-siergiej/shoppingo/issues/112)) ([6dfaa9b](https://github.com/igor-siergiej/shoppingo/commit/6dfaa9bd618988343a56d19370edcf55471bd954))

# [1.58.0](https://github.com/igor-siergiej/shoppingo/compare/v1.57.4...v1.58.0) (2026-07-10)


### Features

* clean imported ingredient names, add LLM-first parsing behind a flag ([#111](https://github.com/igor-siergiej/shoppingo/issues/111)) ([0513b2e](https://github.com/igor-siergiej/shoppingo/commit/0513b2e31ef3ee18d0c092c349c4c0e38f3413cb))

## [1.57.4](https://github.com/igor-siergiej/shoppingo/compare/v1.57.3...v1.57.4) (2026-07-09)


### Bug Fixes

* **recipe-import:** carry parsed quantity/unit into created recipe ingredients ([#110](https://github.com/igor-siergiej/shoppingo/issues/110)) ([cb6c9fb](https://github.com/igor-siergiej/shoppingo/commit/cb6c9fb22c835b9dacdb9f04ef018247c885a906))

## [1.57.3](https://github.com/igor-siergiej/shoppingo/compare/v1.57.2...v1.57.3) (2026-07-09)


### Bug Fixes

* **recipe-import:** split quantity/unit out of ingredient name ([#109](https://github.com/igor-siergiej/shoppingo/issues/109)) ([7d39d14](https://github.com/igor-siergiej/shoppingo/commit/7d39d147c074f9ac64578f2f18101dc63b8920ea))

## [1.57.2](https://github.com/igor-siergiej/shoppingo/compare/v1.57.1...v1.57.2) (2026-07-09)


### Bug Fixes

* **recipe-import:** send browser-like headers to reduce 403s from recipe sites ([#108](https://github.com/igor-siergiej/shoppingo/issues/108)) ([e4f6f70](https://github.com/igor-siergiej/shoppingo/commit/e4f6f705388176fa66bfc39cc6b3f1b639ad17f1))

## [1.57.1](https://github.com/igor-siergiej/shoppingo/compare/v1.57.0...v1.57.1) (2026-07-09)


### Bug Fixes

* **web:** allow letters and pasting in friend code input ([#107](https://github.com/igor-siergiej/shoppingo/issues/107)) ([10bb440](https://github.com/igor-siergiej/shoppingo/commit/10bb44082fda37009fb977c26853353c7ebd1df1))

# [1.57.0](https://github.com/igor-siergiej/shoppingo/compare/v1.56.0...v1.57.0) (2026-07-09)


### Features

* friends & consent-based sharing ([#106](https://github.com/igor-siergiej/shoppingo/issues/106)) ([767dc1c](https://github.com/igor-siergiej/shoppingo/commit/767dc1c4493ef78e6b73d515b18fb87734cbae03))

# [1.56.0](https://github.com/igor-siergiej/shoppingo/compare/v1.55.2...v1.56.0) (2026-07-07)


### Features

* **recipes:** import recipe from URL ([#105](https://github.com/igor-siergiej/shoppingo/issues/105)) ([88f5978](https://github.com/igor-siergiej/shoppingo/commit/88f59787ba199fb0e43b3fd7cec735233ac5e4d5))

## [1.55.2](https://github.com/igor-siergiej/shoppingo/compare/v1.55.1...v1.55.2) (2026-07-05)


### Bug Fixes

* **api:** set file extension on MinIO image object keys ([#103](https://github.com/igor-siergiej/shoppingo/issues/103)) ([7ab423e](https://github.com/igor-siergiej/shoppingo/commit/7ab423e7d982102aa6d2e6482c239d55b04dd712))
* **ci:** disable husky hooks in release job ([46a6dd9](https://github.com/igor-siergiej/shoppingo/commit/46a6dd938bd99d0f08e65ffa87cb3b478b379c93))

## [1.55.1](https://github.com/igor-siergiej/shoppingo/compare/v1.55.0...v1.55.1) (2026-07-05)


### Bug Fixes

* **todos:** store dueDate as timezone-agnostic day so reminders fire ([#100](https://github.com/igor-siergiej/shoppingo/issues/100)) ([17c033e](https://github.com/igor-siergiej/shoppingo/commit/17c033e1b03526282ddec0c96d11513ce56c64fa)), closes [#98](https://github.com/igor-siergiej/shoppingo/issues/98) [#98](https://github.com/igor-siergiej/shoppingo/issues/98) [#99](https://github.com/igor-siergiej/shoppingo/issues/99)

# [1.55.0](https://github.com/igor-siergiej/shoppingo/compare/v1.54.1...v1.55.0) (2026-07-05)


### Features

* **api:** replace OpenAI image gen with fal.ai FLUX.1 [schnell] ([#102](https://github.com/igor-siergiej/shoppingo/issues/102)) ([db7e91e](https://github.com/igor-siergiej/shoppingo/commit/db7e91e6e36b86584a4d20dfd50c462d643c6c68))

## [1.54.1](https://github.com/igor-siergiej/shoppingo/compare/v1.54.0...v1.54.1) (2026-07-02)


### Bug Fixes

* **api:** match legacy string dueDates in reminder query ([#99](https://github.com/igor-siergiej/shoppingo/issues/99)) ([3352e81](https://github.com/igor-siergiej/shoppingo/commit/3352e8101134d1ae3be1b4b2423c5bac6c270ded)), closes [#98](https://github.com/igor-siergiej/shoppingo/issues/98)

# [1.54.0](https://github.com/igor-siergiej/shoppingo/compare/v1.53.1...v1.54.0) (2026-07-02)


### Features

* offline sync phase 2 + 3 (list creation, todos, labels, recipes) ([#97](https://github.com/igor-siergiej/shoppingo/issues/97)) ([5a65cc9](https://github.com/igor-siergiej/shoppingo/commit/5a65cc95e7fa66dcaa996c363950954d979e6f64))

## [1.53.1](https://github.com/igor-siergiej/shoppingo/compare/v1.53.0...v1.53.1) (2026-06-29)


### Bug Fixes

* **api:** coerce todo dueDate strings to Dates so reminders fire ([#98](https://github.com/igor-siergiej/shoppingo/issues/98)) ([4398583](https://github.com/igor-siergiej/shoppingo/commit/439858304219c3395bcbe48768d7ae541bbc650e))

# [1.53.0](https://github.com/igor-siergiej/shoppingo/compare/v1.52.0...v1.53.0) (2026-06-27)


### Features

* offline sync (Phase 1) — item edits via outbox queue ([#96](https://github.com/igor-siergiej/shoppingo/issues/96)) ([74b6106](https://github.com/igor-siergiej/shoppingo/commit/74b6106a0d1bd25f69db8facadc069ed0739a556))

# [1.52.0](https://github.com/igor-siergiej/shoppingo/compare/v1.51.0...v1.52.0) (2026-06-27)


### Features

* surface reminder run counts for debugging ([#95](https://github.com/igor-siergiej/shoppingo/issues/95)) ([421c83c](https://github.com/igor-siergiej/shoppingo/commit/421c83c83bd8024ff68669716337b7f28d8a91f5))

# [1.51.0](https://github.com/igor-siergiej/shoppingo/compare/v1.50.0...v1.51.0) (2026-06-27)


### Features

* manual trigger for daily todo reminder ([#94](https://github.com/igor-siergiej/shoppingo/issues/94)) ([96b9db2](https://github.com/igor-siergiej/shoppingo/commit/96b9db26003bcbe817412a7d3e6813104e5ac7d6))

# [1.50.0](https://github.com/igor-siergiej/shoppingo/compare/v1.49.0...v1.50.0) (2026-06-25)


### Features

* daily todo reminder push notification (08:30 UK) ([#93](https://github.com/igor-siergiej/shoppingo/issues/93)) ([f14ad39](https://github.com/igor-siergiej/shoppingo/commit/f14ad398996bb4fd262cae225a4efd7efa569484))

# [1.49.0](https://github.com/igor-siergiej/shoppingo/compare/v1.48.0...v1.49.0) (2026-06-24)


### Features

* **web:** notification polish — persistent, per-list, monochrome badge, notify-unless-focused ([#92](https://github.com/igor-siergiej/shoppingo/issues/92)) ([0b567b8](https://github.com/igor-siergiej/shoppingo/commit/0b567b8e0403374163e93b56f3bcd0ded76fc77c))

# [1.48.0](https://github.com/igor-siergiej/shoppingo/compare/v1.47.1...v1.48.0) (2026-06-23)


### Features

* Web Push notifications for shared lists ([#91](https://github.com/igor-siergiej/shoppingo/issues/91)) ([eb9cd40](https://github.com/igor-siergiej/shoppingo/commit/eb9cd405163b155b708eeffab2dec666f69635ec))

## [1.47.1](https://github.com/igor-siergiej/shoppingo/compare/v1.47.0...v1.47.1) (2026-06-23)


### Bug Fixes

* **pwa:** suppress repeated update toast for same pending SW version ([#90](https://github.com/igor-siergiej/shoppingo/issues/90)) ([8827334](https://github.com/igor-siergiej/shoppingo/commit/8827334b1e9502b5cec6f5b21d54f4fa138a525a))

# [1.47.0](https://github.com/igor-siergiej/shoppingo/compare/v1.46.0...v1.47.0) (2026-06-22)


### Features

* **recipes:** replace AI cover image with upload, revert back for free ([#89](https://github.com/igor-siergiej/shoppingo/issues/89)) ([6cf7fba](https://github.com/igor-siergiej/shoppingo/commit/6cf7fba560193c9a1e8ee0bb2aa57227f5a06798))

# [1.46.0](https://github.com/igor-siergiej/shoppingo/compare/v1.45.0...v1.46.0) (2026-06-22)


### Features

* **web:** natural language date input + swipe-to-change calendar months ([#88](https://github.com/igor-siergiej/shoppingo/issues/88)) ([eeb9ecd](https://github.com/igor-siergiej/shoppingo/commit/eeb9ecd3d734f641d78e28336c9000a340a86c06))

# [1.45.0](https://github.com/igor-siergiej/shoppingo/compare/v1.44.1...v1.45.0) (2026-06-09)


### Features

* **web:** label filter grey-out + drawer feedback ([#86](https://github.com/igor-siergiej/shoppingo/issues/86)) ([ae6dd0a](https://github.com/igor-siergiej/shoppingo/commit/ae6dd0a14a84e637f9048079983b91f7a7461bf1))

## [1.44.1](https://github.com/igor-siergiej/shoppingo/compare/v1.44.0...v1.44.1) (2026-06-07)


### Bug Fixes

* **web:** make add todo drawer scrollable on mobile ([#85](https://github.com/igor-siergiej/shoppingo/issues/85)) ([2c61060](https://github.com/igor-siergiej/shoppingo/commit/2c61060073421c75b7ae197ee96baf0f0c1f0e50))

# [1.44.0](https://github.com/igor-siergiej/shoppingo/compare/v1.43.0...v1.44.0) (2026-06-07)


### Features

* **web:** calendar UX refinements ([#84](https://github.com/igor-siergiej/shoppingo/issues/84)) ([589ad2f](https://github.com/igor-siergiej/shoppingo/commit/589ad2f8af81d9ba73ee401e74f830df7703e998))

# [1.43.0](https://github.com/igor-siergiej/shoppingo/compare/v1.42.0...v1.43.0) (2026-06-06)


### Bug Fixes

* **fallow:** resolve all dead-code report findings ([#82](https://github.com/igor-siergiej/shoppingo/issues/82)) ([36df440](https://github.com/igor-siergiej/shoppingo/commit/36df4405afe97639a3d67e6d3336dde0f938f3ee))


### Features

* first-class todos + calendar view ([#83](https://github.com/igor-siergiej/shoppingo/issues/83)) ([fd0d70e](https://github.com/igor-siergiej/shoppingo/commit/fd0d70ee2d32249270346a226673279c517c39a5)), closes [#82](https://github.com/igor-siergiej/shoppingo/issues/82) [hi#crap-score](https://github.com/hi/issues/crap-score)

# [1.42.0](https://github.com/igor-siergiej/shoppingo/compare/v1.41.0...v1.42.0) (2026-06-04)


### Features

* **ci:** add fallow static analysis ([#81](https://github.com/igor-siergiej/shoppingo/issues/81)) ([bb77b40](https://github.com/igor-siergiej/shoppingo/commit/bb77b409d9b223e8f0f3534635d06736e6eed77a))

# [1.41.0](https://github.com/igor-siergiej/shoppingo/compare/v1.40.0...v1.41.0) (2026-05-19)


### Features

* **ci:** restore workflows-utils submodule ([#79](https://github.com/igor-siergiej/shoppingo/issues/79)) ([267df19](https://github.com/igor-siergiej/shoppingo/commit/267df199a31ed575751ed0e147eca06b9610d50f))

# [1.40.0](https://github.com/igor-siergiej/shoppingo/compare/v1.39.0...v1.40.0) (2026-05-19)


### Bug Fixes

* **web:** prevent pull-to-refresh from firing mid-scroll or too easily ([#78](https://github.com/igor-siergiej/shoppingo/issues/78)) ([f92f872](https://github.com/igor-siergiej/shoppingo/commit/f92f8726df7e6cf9c9ba1db1f253d53f603e2bd7))


### Features

* **web:** clean up superpowers directory ([4f39296](https://github.com/igor-siergiej/shoppingo/commit/4f392965948da21097754cb1c20d3352ed14bf3a))

# [1.39.0](https://github.com/igor-siergiej/shoppingo/compare/v1.38.0...v1.39.0) (2026-05-16)


### Features

* **e2e:** add coverage for TODO lists, add-from-recipe, share-target and share-on-create ([a9f2aa9](https://github.com/igor-siergiej/shoppingo/commit/a9f2aa910f0d1c9b2db7a329bcdf0d2257952659))
* **e2e:** expand coverage and fix local test runner setup ([74aee6a](https://github.com/igor-siergiej/shoppingo/commit/74aee6a1408518fc6d00a115abb73e1c4da73950))

# [1.38.0](https://github.com/igor-siergiej/shoppingo/compare/v1.37.0...v1.38.0) (2026-05-16)


### Features

* **e2e:** expand coverage and fix local test runner ([#75](https://github.com/igor-siergiej/shoppingo/issues/75)) ([24539bf](https://github.com/igor-siergiej/shoppingo/commit/24539bf235a33c24da86f40371325a4ff1a1a637))

# [1.37.0](https://github.com/igor-siergiej/shoppingo/compare/v1.36.0...v1.37.0) (2026-05-15)


### Bug Fixes

* **api:** update sharp to 0.34.5 and resync lockfile to restore failing tests ([#74](https://github.com/igor-siergiej/shoppingo/issues/74)) ([adaf914](https://github.com/igor-siergiej/shoppingo/commit/adaf914193fe561e8ce5a94fddb5456a4d0c8687))
* **web:** add mutateAsync to ManageUsersDrawer test mock ([f11e65e](https://github.com/igor-siergiej/shoppingo/commit/f11e65e766db2c28d4825aec10afd9cac8422aa9))


### Features

* **e2e:** 55/55 Playwright E2E tests with full mock infrastructure ([#73](https://github.com/igor-siergiej/shoppingo/issues/73)) ([3e64752](https://github.com/igor-siergiej/shoppingo/commit/3e64752936403270e502e7e05d2456efa61db561))
* **e2e:** convert to true e2e tests against real API and MongoDB ([6294767](https://github.com/igor-siergiej/shoppingo/commit/62947673020cdeaa77289b16e8446e33f3027698))

# [1.36.0](https://github.com/igor-siergiej/shoppingo/compare/v1.35.0...v1.36.0) (2026-05-14)


### Features

* **e2e:** Playwright E2E testing infrastructure ([#72](https://github.com/igor-siergiej/shoppingo/issues/72)) ([7b7fa07](https://github.com/igor-siergiej/shoppingo/commit/7b7fa072b43b54ff0a0afb149014f43717a0179a))

# [1.35.0](https://github.com/igor-siergiej/shoppingo/compare/v1.34.4...v1.35.0) (2026-05-05)


### Features

* **pwa:** add manual check for updates button in menu ([b503e1f](https://github.com/igor-siergiej/shoppingo/commit/b503e1f9c54607df1f0fc2b3440978d5d0f8fc9a))

## [1.34.4](https://github.com/igor-siergiej/shoppingo/compare/v1.34.3...v1.34.4) (2026-05-05)


### Bug Fixes

* **pwa:** check for updates on tab visibility change and reduce poll interval ([398cd3d](https://github.com/igor-siergiej/shoppingo/commit/398cd3d6b8df9d311caa1fd2f567d4a261685f8c))

## [1.34.3](https://github.com/igor-siergiej/shoppingo/compare/v1.34.2...v1.34.3) (2026-05-05)


### Bug Fixes

* store user-uploaded recipe image instead of generating AI image ([#71](https://github.com/igor-siergiej/shoppingo/issues/71)) ([e5b75ed](https://github.com/igor-siergiej/shoppingo/commit/e5b75ed5d7b4715b33dde8b179e20aa844125be6))

## [1.34.2](https://github.com/igor-siergiej/shoppingo/compare/v1.34.1...v1.34.2) (2026-05-03)


### Bug Fixes

* **web:** fix PWA update dialog not appearing after new version published ([#70](https://github.com/igor-siergiej/shoppingo/issues/70)) ([2aa44c6](https://github.com/igor-siergiej/shoppingo/commit/2aa44c6ad1918c8d70b68d84dfa64e5f1e486e88))

## [1.34.1](https://github.com/igor-siergiej/shoppingo/compare/v1.34.0...v1.34.1) (2026-05-03)


### Bug Fixes

* **web:** pull-to-refresh scroll fix and indicator polish ([#69](https://github.com/igor-siergiej/shoppingo/issues/69)) ([601c2f1](https://github.com/igor-siergiej/shoppingo/commit/601c2f1f90fb49e01abd3d2cdf011530125ca538))

# [1.34.0](https://github.com/igor-siergiej/shoppingo/compare/v1.33.0...v1.34.0) (2026-05-02)


### Features

* **web:** add pull-to-refresh with haptics, overscroll indicator, and PWA update check ([#68](https://github.com/igor-siergiej/shoppingo/issues/68)) ([bb3b439](https://github.com/igor-siergiej/shoppingo/commit/bb3b4398c1fd96bc296ec75bd88dafe42f8fe4b7))

# [1.33.0](https://github.com/igor-siergiej/shoppingo/compare/v1.32.3...v1.33.0) (2026-04-30)


### Bug Fixes

* show skeleton while AI recipe image is loading ([#66](https://github.com/igor-siergiej/shoppingo/issues/66)) ([0e2d7e7](https://github.com/igor-siergiej/shoppingo/commit/0e2d7e7eaf9d0cc0b47311266f367038237fbdc3))
* **web:** show skeleton when coverImageKey absent ([530f7ae](https://github.com/igor-siergiej/shoppingo/commit/530f7aeb2f42791d800a0833e9a1ba06c819feb0))


### Features

* **web:** replace pulse skeleton with shimmer animation on recipe cards ([#67](https://github.com/igor-siergiej/shoppingo/issues/67)) ([fb278e6](https://github.com/igor-siergiej/shoppingo/commit/fb278e6a9769564d81d8d4e4b6c780bab57431ff))

## [1.32.3](https://github.com/igor-siergiej/shoppingo/compare/v1.32.2...v1.32.3) (2026-04-29)


### Bug Fixes

* **web:** show skeleton during coverImageKey transition in RecipeCard ([#65](https://github.com/igor-siergiej/shoppingo/issues/65)) ([4bb5ed5](https://github.com/igor-siergiej/shoppingo/commit/4bb5ed59c75e14d7990e5d02fa9b8d76b60fd5ce))

## [1.32.2](https://github.com/igor-siergiej/shoppingo/compare/v1.32.1...v1.32.2) (2026-04-29)


### Bug Fixes

* **api:** share recipes with selected users at creation time ([#64](https://github.com/igor-siergiej/shoppingo/issues/64)) ([1cde950](https://github.com/igor-siergiej/shoppingo/commit/1cde950156176a9c7e7a2fca9740337d1ede4118))

## [1.32.1](https://github.com/igor-siergiej/shoppingo/compare/v1.32.0...v1.32.1) (2026-04-29)


### Bug Fixes

* **web,api:** restore skeleton loading and prevent double image generation ([#63](https://github.com/igor-siergiej/shoppingo/issues/63)) ([f6f5495](https://github.com/igor-siergiej/shoppingo/commit/f6f5495c21231e804165c44841461c9af1699916))

# [1.32.0](https://github.com/igor-siergiej/shoppingo/compare/v1.31.0...v1.32.0) (2026-04-28)


### Features

* **api:** shared AI recipe image cache by title ([#62](https://github.com/igor-siergiej/shoppingo/issues/62)) ([3d57686](https://github.com/igor-siergiej/shoppingo/commit/3d576867efc28c1ad86cf6d033adca647a32c1b6))

# [1.31.0](https://github.com/igor-siergiej/shoppingo/compare/v1.30.0...v1.31.0) (2026-04-28)


### Bug Fixes

* **web:** make unit tests pass for client-initiated image generation ([e039ce6](https://github.com/igor-siergiej/shoppingo/commit/e039ce644daf59b8da19d7b048f0037dcb8814e8))


### Features

* client-initiated recipe image generation with skeleton loading ([#61](https://github.com/igor-siergiej/shoppingo/issues/61)) ([33f9895](https://github.com/igor-siergiej/shoppingo/commit/33f989555a3434c16cee4d50e4b31a0b54a6107b))

# [1.30.0](https://github.com/igor-siergiej/shoppingo/compare/v1.29.0...v1.30.0) (2026-04-23)


### Bug Fixes

* **web:** move IngredientSelectRow test next to component ([6190015](https://github.com/igor-siergiej/shoppingo/commit/61900150ec67c38b8073346fd5002a1dde6f0dae))


### Features

* **api:** Prometheus metrics + RecipeImageService split ([#60](https://github.com/igor-siergiej/shoppingo/issues/60)) ([4598f78](https://github.com/igor-siergiej/shoppingo/commit/4598f78df6e5814aef772ed4b978435bf63859aa))
* reuse IngredientSelectRow in AddFromRecipeDrawer for consistent theming ([#58](https://github.com/igor-siergiej/shoppingo/issues/58)) ([9b88c48](https://github.com/igor-siergiej/shoppingo/commit/9b88c482e5355b384b4d73a88476fa8a2087cf62))
* separate RecipeImageService with food photography prompt and 512px output ([#59](https://github.com/igor-siergiej/shoppingo/issues/59)) ([58d482f](https://github.com/igor-siergiej/shoppingo/commit/58d482fa046cdf60aa4d8225f7c48191242b22e1))

# [1.29.0](https://github.com/igor-siergiej/shoppingo/compare/v1.28.0...v1.29.0) (2026-03-28)


### Features

* async recipe image generation with pizza spinner ([#57](https://github.com/igor-siergiej/shoppingo/issues/57)) ([ac225da](https://github.com/igor-siergiej/shoppingo/commit/ac225daa11af21ba8b76c1c1fd6fd2c77f012a6b))

# [1.28.0](https://github.com/igor-siergiej/shoppingo/compare/v1.27.0...v1.28.0) (2026-03-27)


### Features

* single-column recipe card layout ([#56](https://github.com/igor-siergiej/shoppingo/issues/56)) ([2e049c7](https://github.com/igor-siergiej/shoppingo/commit/2e049c7634b4d196153c29b0d1d45d3a556392ba))

# [1.27.0](https://github.com/igor-siergiej/shoppingo/compare/v1.26.0...v1.27.0) (2026-03-26)


### Features

* fuzzy recipe search ([#53](https://github.com/igor-siergiej/shoppingo/issues/53)) ([480804f](https://github.com/igor-siergiej/shoppingo/commit/480804fc5985aed4e523c618120d7f40a487828e))
* ingredient select theming and images ([#55](https://github.com/igor-siergiej/shoppingo/issues/55)) ([787d39b](https://github.com/igor-siergiej/shoppingo/commit/787d39bcefd9db4971a18e3b2ffcfdda3bb23815))

# [1.26.0](https://github.com/igor-siergiej/shoppingo/compare/v1.25.1...v1.26.0) (2026-03-26)


### Features

* add recipe link and cooking instructions ([#54](https://github.com/igor-siergiej/shoppingo/issues/54)) ([147e31a](https://github.com/igor-siergiej/shoppingo/commit/147e31a7bf93de552a3d36e3658939074033e63b))

## [1.25.1](https://github.com/igor-siergiej/shoppingo/compare/v1.25.0...v1.25.1) (2026-03-26)


### Bug Fixes

* **ci:** add HTTP status code to deploy webhook curl output ([#52](https://github.com/igor-siergiej/shoppingo/issues/52)) ([14165b4](https://github.com/igor-siergiej/shoppingo/commit/14165b44fd6220da65544a6413b3980522c68aa6))

# [1.25.0](https://github.com/igor-siergiej/shoppingo/compare/v1.24.4...v1.25.0) (2026-03-26)


### Features

* improve add recipe button with composite BookOpen+Plus icon ([#51](https://github.com/igor-siergiej/shoppingo/issues/51)) ([a04a85a](https://github.com/igor-siergiej/shoppingo/commit/a04a85aea892dc4dd50d1ea55175ec0bc55f158c))
* PWA update notification with user-controlled updates ([#50](https://github.com/igor-siergiej/shoppingo/issues/50)) ([1f3f11e](https://github.com/igor-siergiej/shoppingo/commit/1f3f11e32b79657c884949e2a2f1906a5601c604))

## [1.24.4](https://github.com/igor-siergiej/shoppingo/compare/v1.24.3...v1.24.4) (2026-03-26)


### Bug Fixes

* center add button when navigating to items page ([#49](https://github.com/igor-siergiej/shoppingo/issues/49)) ([ebca6c5](https://github.com/igor-siergiej/shoppingo/commit/ebca6c5391276f0294b333f0844361200701c6c5))

## [1.24.3](https://github.com/igor-siergiej/shoppingo/compare/v1.24.2...v1.24.3) (2026-03-24)


### Bug Fixes

* recipe image not refreshing after upload or AI generation ([#47](https://github.com/igor-siergiej/shoppingo/issues/47)) ([b771cd1](https://github.com/igor-siergiej/shoppingo/commit/b771cd11ed264a1febdf0a8435556b10ae78a11b))
* **tests:** fix failing web component tests ([#48](https://github.com/igor-siergiej/shoppingo/issues/48)) ([b6fe59d](https://github.com/igor-siergiej/shoppingo/commit/b6fe59dddf18d6351a5ca07ccf5582fe8e89b093))

## [1.24.2](https://github.com/igor-siergiej/shoppingo/compare/v1.24.1...v1.24.2) (2026-03-22)


### Bug Fixes

* recipe images and list refresh after bulk ingredient add ([#46](https://github.com/igor-siergiej/shoppingo/issues/46)) ([dedf395](https://github.com/igor-siergiej/shoppingo/commit/dedf3958342dba0b5c40b9a49286410004a19aaf))

## [1.24.1](https://github.com/igor-siergiej/shoppingo/compare/v1.24.0...v1.24.1) (2026-03-21)


### Bug Fixes

* remove accidentally committed claude worktree gitlinks ([#45](https://github.com/igor-siergiej/shoppingo/issues/45)) ([fa698d7](https://github.com/igor-siergiej/shoppingo/commit/fa698d736dc086945d879a643d4ad6bbb1c691cd))

# [1.24.0](https://github.com/igor-siergiej/shoppingo/compare/v1.23.0...v1.24.0) (2026-03-21)


### Bug Fixes

* add helpful message when all recipe ingredients already in shopping list ([9744fd8](https://github.com/igor-siergiej/shoppingo/commit/9744fd8342b92d3c2d7fa87089de486dc882b447))
* add recipe image retrieval and improve recipe card UI ([68595eb](https://github.com/igor-siergiej/shoppingo/commit/68595eb2b18b08a046f9b0cb55ee0b8a21c4ae42))
* change recipe creation endpoint from POST to PUT ([d0add49](https://github.com/igor-siergiej/shoppingo/commit/d0add49b3d6be4bccc43e24c1ea2e125e8340efc))
* correct selectedIds initialization and listType filter in IngredientSelectSection ([49ab15a](https://github.com/igor-siergiej/shoppingo/commit/49ab15a4715a32a9ff29a7262977033db5b8bb8c))
* move recipe picker button to left section instead of right ([79fbd0f](https://github.com/igor-siergiej/shoppingo/commit/79fbd0fb131ed179e773baf601c2ed495d9f4bf3))
* remove green background from recipe picker button ([6a5ee57](https://github.com/igor-siergiej/shoppingo/commit/6a5ee579301b446952541c1c49b902430a2cf800))
* **tests:** update web component tests to match current component implementations ([#44](https://github.com/igor-siergiej/shoppingo/issues/44)) ([83f795c](https://github.com/igor-siergiej/shoppingo/commit/83f795c459f9875930df7669ddea2338111b0ed3))
* use ListType enum for shopping list comparison in ToolBar ([d6c68f1](https://github.com/igor-siergiej/shoppingo/commit/d6c68f1b53eb5ca1d60e494cc06b41b810091017))


### Features

* add recipe-to-shopping-list bulk import feature ([#41](https://github.com/igor-siergiej/shoppingo/issues/41)) ([c044b17](https://github.com/igor-siergiej/shoppingo/commit/c044b1798ae33d9039e26723e361778c6a850c56))
* consolidate recipe components with shared patterns ([#39](https://github.com/igor-siergiej/shoppingo/issues/39)) ([fd8e779](https://github.com/igor-siergiej/shoppingo/commit/fd8e779780b61d9104dc0a3aff83f764c317fb1e))
* implement complete Recipes feature ([#38](https://github.com/igor-siergiej/shoppingo/issues/38)) ([4fa6376](https://github.com/igor-siergiej/shoppingo/commit/4fa637691d9fce6ff63284fbb1f7d1c58e559863))
* implement recipe image upload and AI generation ([#42](https://github.com/igor-siergiej/shoppingo/issues/42)) ([be104b7](https://github.com/igor-siergiej/shoppingo/commit/be104b704af74603b86f0ca4a5f86e8b433c65a9))


### Reverts

* Revert "chore: remove active state background from navigation buttons" ([dcdf3a6](https://github.com/igor-siergiej/shoppingo/commit/dcdf3a6cb496b2e9cfb52cf46d2452408b95f788))
* Revert "chore: remove colored border from recipe picker button" ([c6c6c01](https://github.com/igor-siergiej/shoppingo/commit/c6c6c01dd005750a73f06e8ca7c64e560e885e3c))
* Revert "Reapply "chore: remove active state background from navigation buttons"" ([6659fca](https://github.com/igor-siergiej/shoppingo/commit/6659fca03fcbc1560bdd2bd3847514502fd86ce6))

# [1.23.0](https://github.com/igor-siergiej/shoppingo/compare/v1.22.0...v1.23.0) (2026-03-20)


### Features

* unified loading page with smooth transitions ([#37](https://github.com/igor-siergiej/shoppingo/issues/37)) ([d293aa7](https://github.com/igor-siergiej/shoppingo/commit/d293aa7553fe0d24af45cc13a50ecae95e5ed048))

# [1.22.0](https://github.com/igor-siergiej/shoppingo/compare/v1.21.9...v1.22.0) (2026-03-19)


### Bug Fixes

* add security-events:write permission for SARIF upload ([#26](https://github.com/igor-siergiej/shoppingo/issues/26)) ([b09e7b0](https://github.com/igor-siergiej/shoppingo/commit/b09e7b083016f4464e2423a64366efa60665a2f5))
* **ci:** add security-events:write permission to semgrep job in main pipeline ([#28](https://github.com/igor-siergiej/shoppingo/issues/28)) ([6fb1f12](https://github.com/igor-siergiej/shoppingo/commit/6fb1f12eca648201a23e291d09f9fcb9f04f9b37))
* **docker:** resolve sharp native bindings issue by running TypeScript directly with bun ([#20](https://github.com/igor-siergiej/shoppingo/issues/20)) ([67294d7](https://github.com/igor-siergiej/shoppingo/commit/67294d74174ea285a65b08dca1c04042fcb0fcff))


### Features

* **ci:** add automatic Dokploy deployment webhook trigger ([#27](https://github.com/igor-siergiej/shoppingo/issues/27)) ([f08875f](https://github.com/igor-siergiej/shoppingo/commit/f08875f5fd30eacd0ed0560e6750ed16467c3351))
* **ci:** add pull request workflow with coverage and semgrep checks ([#22](https://github.com/igor-siergiej/shoppingo/issues/22)) ([64a68a7](https://github.com/igor-siergiej/shoppingo/commit/64a68a7d7a0ad71debadc97284301691d0384c58))

## [1.21.9](https://github.com/igor-siergiej/shoppingo/compare/v1.21.8...v1.21.9) (2026-03-18)


### Bug Fixes

* **docker:** consolidate sharp to root node_modules before copy to runner ([d405914](https://github.com/igor-siergiej/shoppingo/commit/d405914ae1c7443f9163de3a98406b4f26987af0))
* **docker:** copy sharp from packages/api/node_modules instead of consolidating ([6a6a89f](https://github.com/igor-siergiej/shoppingo/commit/6a6a89f118477213a80b141c445bcf30e0da2d35))
* **docker:** install sharp directly in runner stage ([4340048](https://github.com/igor-siergiej/shoppingo/commit/434004850292e4c26129e1ac086c64446ea45cbe))
* **tests:** fix linting errors and bun:test compatibility issues ([efd066f](https://github.com/igor-siergiej/shoppingo/commit/efd066f2a933e5fb79ef1f7d241d12dafc536b56))

## [1.21.8](https://github.com/igor-siergiej/shoppingo/compare/v1.21.7...v1.21.8) (2026-03-18)


### Bug Fixes

* update Dockerfile references from bun.lockb to bun.lock ([c44246f](https://github.com/igor-siergiej/shoppingo/commit/c44246fcd5747d8ca645b050a19a6c9a6e13ad5f))

## [1.21.7](https://github.com/igor-siergiej/shoppingo/compare/v1.21.6...v1.21.7) (2026-03-18)


### Bug Fixes

* copy sharp native binaries from builder stage in Dockerfile ([5baeac6](https://github.com/igor-siergiej/shoppingo/commit/5baeac67117edf1a491d96ace5b376954db3fa0d))
* use bun in runner stage instead of node/npm ([72c0ac0](https://github.com/igor-siergiej/shoppingo/commit/72c0ac088c286f8d3c1fe86c9cae6cf2675bb627))

## [1.21.6](https://github.com/igor-siergiej/shoppingo/compare/v1.21.5...v1.21.6) (2026-03-18)


### Bug Fixes

* add workbox-window as explicit dependency for vite-plugin-pwa ([8dbfedc](https://github.com/igor-siergiej/shoppingo/commit/8dbfedc7834ff47581f9af9a79cb8dab5f574d6c))

## [1.21.5](https://github.com/igor-siergiej/shoppingo/compare/v1.21.4...v1.21.5) (2026-03-18)


### Bug Fixes

* update GitHub Actions to Node.js 24 compatible versions ([f211820](https://github.com/igor-siergiej/shoppingo/commit/f2118203ec613bdefe8c582b1442ba7404ebf56e))

## [1.21.4](https://github.com/igor-siergiej/shoppingo/compare/v1.21.3...v1.21.4) (2026-03-18)


### Bug Fixes

* resolve build-publish pipeline failures ([14e1a55](https://github.com/igor-siergiej/shoppingo/commit/14e1a5599c2d929d73b251d5ba599c96edf7ff85))

## [1.21.3](https://github.com/igor-siergiej/shoppingo/compare/v1.21.2...v1.21.3) (2026-03-18)


### Bug Fixes

* update Dockerfiles to use bun.lock instead of bun.lockb ([30a3777](https://github.com/igor-siergiej/shoppingo/commit/30a3777558cf581f3fa958cfc0e1b63e065b51a6))

## [1.21.2](https://github.com/igor-siergiej/shoppingo/compare/v1.21.1...v1.21.2) (2026-03-18)


### Bug Fixes

* biome linting issues ([ab4f0cc](https://github.com/igor-siergiej/shoppingo/commit/ab4f0ccbdd24dc5991e833521a8ef53b79a89f8a))
* replace Yarn workspace versioning with Bun-compatible Node script ([63b4f55](https://github.com/igor-siergiej/shoppingo/commit/63b4f5558c6c3e5eaf8d3c76524ec8b75ac84c9c))
* resolve all linting warnings ([067da54](https://github.com/igor-siergiej/shoppingo/commit/067da5475d8049d7d2ab72656ae7a792ab51f765))
* update biome-config reference to [@imapps](https://github.com/imapps) namespace in root biome.json ([b98c62a](https://github.com/igor-siergiej/shoppingo/commit/b98c62a3a67d60b78d703b0d2a4d9b02f0a8b7c6))

## [1.21.1](https://github.com/igor-siergiej/shoppingo/compare/v1.21.0...v1.21.1) (2026-03-12)


### Bug Fixes

* **ci-cd:** add contents:read permission for checkout action ([058b1c3](https://github.com/igor-siergiej/shoppingo/commit/058b1c336d35de033db2434fe4fdf40274a74c81))
* **ci-cd:** use GITHUB_TOKEN instead of GH_TOKEN ([854615e](https://github.com/igor-siergiej/shoppingo/commit/854615e6f40b08ed33eeae1ca52c85cebe45fd78))
* suppress biome linting warnings for Elysia context typing and ConfigService unknown types ([03d5a7a](https://github.com/igor-siergiej/shoppingo/commit/03d5a7a4daf0368b9f61ed2dda321f27c7435467))
* use Docker Hub credentials instead of GHCR for image push ([9ac2841](https://github.com/igor-siergiej/shoppingo/commit/9ac2841e0cd259174de9c238cffc54c01356dbda))
* use GitHub Container Registry (ghcr.io) instead of Docker Hub ([3ca5351](https://github.com/igor-siergiej/shoppingo/commit/3ca5351bf134029e4cbe1b6e9c8596cceb107f8e))

# [1.21.0](https://github.com/igor-siergiej/shoppingo/compare/v1.20.4...v1.21.0) (2026-03-12)


### Bug Fixes

* **ci-cd:** correct version extraction for GitHub Actions ([8ddf3d1](https://github.com/igor-siergiej/shoppingo/commit/8ddf3d1d76165aa6d3a06e45b7e72d4df1b36f64))


### Features

* add utils submodule for shared CI/CD pipelines ([8944f9c](https://github.com/igor-siergiej/shoppingo/commit/8944f9c5a1153e2432061c68382f3ccb4b8aee9f))

## [1.20.4](https://github.com/igor-siergiej/shoppingo/compare/v1.20.3...v1.20.4) (2026-03-11)


### Bug Fixes

* install dependencies before workspaces focus in runner stage ([78acb52](https://github.com/igor-siergiej/shoppingo/commit/78acb52dac6922303baf762bd23866d5d4e393f6))
* pass NODE_AUTH_TOKEN to runner stage for GitHub Packages auth ([e186374](https://github.com/igor-siergiej/shoppingo/commit/e1863741fc2fcb9040ea4d431062d89695108bb0))

## [1.20.3](https://github.com/igor-siergiej/shoppingo/compare/v1.20.2...v1.20.3) (2026-03-11)


### Bug Fixes

* remove .yarn from dockerfile copy (not in repo) ([e3dea2b](https://github.com/igor-siergiej/shoppingo/commit/e3dea2bfc214a6c5dd699f7abb08b8fa9a642406))

## [1.20.2](https://github.com/igor-siergiej/shoppingo/compare/v1.20.1...v1.20.2) (2026-03-11)


### Bug Fixes

* add NODE_AUTH_TOKEN to yarn install and change release condition to success ([3aa35a5](https://github.com/igor-siergiej/shoppingo/commit/3aa35a5a598ef8f7bcd188ac5a9e542b9eda661c))
* add npmAuthToken to .yarnrc.yml for GitHub Packages authentication ([11b8e92](https://github.com/igor-siergiej/shoppingo/commit/11b8e921f695f6942632a4f914d2d56a6d01fffc))
* add packages:read permission to jobs for GitHub Packages access ([cf5dcf3](https://github.com/igor-siergiej/shoppingo/commit/cf5dcf354d9afe6d0ea37f2220538cc652e4ad9b))
* downgrade to 0.4.5 which is published to GitHub Packages ([3afe061](https://github.com/igor-siergiej/shoppingo/commit/3afe06168e3919496e6806464c579a43aa2236c2))
* pass NODE_AUTH_TOKEN env var to yarn install in Dockerfiles ([3b79855](https://github.com/igor-siergiej/shoppingo/commit/3b79855c1ed1a418a949cb2f66132eda41a5b01a))
* remove circular dependency and add git pull to build-publish ([ed96084](https://github.com/igor-siergiej/shoppingo/commit/ed9608490245d2dba11dce73aa000d373543b697))
* serial dependencies and version extraction from package.json ([ae29557](https://github.com/igor-siergiej/shoppingo/commit/ae29557a7e0c8ee2283009c3e048885d7654a0ef))
* update yarn lock and utils versions ([52fb99c](https://github.com/igor-siergiej/shoppingo/commit/52fb99c4cbfd7abc2b7110bf26edd7ee5cae6a7d))
* use GH_TOKEN which has explicit read:packages permission ([efda9a6](https://github.com/igor-siergiej/shoppingo/commit/efda9a61c78f1815205f393d646fb22e818941a3))
* use GITHUB_TOKEN instead of GH_TOKEN secret ([557124b](https://github.com/igor-siergiej/shoppingo/commit/557124b07f95e9b6b17c1d961e6bea6d8d2bdc42))
* use NODE_AUTH_TOKEN in .yarnrc.yml to match workflow ([28cac7d](https://github.com/igor-siergiej/shoppingo/commit/28cac7d3314054c488c77a796787416a54086745))

## [1.20.1](https://github.com/igor-siergiej/shoppingo/compare/v1.20.0...v1.20.1) (2026-03-11)


### Bug Fixes

* correct reusable workflow org reference ([d6f1811](https://github.com/igor-siergiej/shoppingo/commit/d6f181118ec0b8efb79e1b5d3af911d917dd4281))

# [1.20.0](https://github.com/igor-siergiej/shoppingo/compare/v1.19.0...v1.20.0) (2026-03-11)


### Bug Fixes

* add mime.types include to nginx config for correct MIME type serving ([e19cf50](https://github.com/igor-siergiej/shoppingo/commit/e19cf5046a1a32a081f6e8321c6960dd06b99a16))
* correct Docker build output paths for web (build) and api (build) ([15b262d](https://github.com/igor-siergiej/shoppingo/commit/15b262d7d95fe043bb168b14278da6dcc8b975ef))
* correct repository URL to igor-siergiej org ([67a40a2](https://github.com/igor-siergiej/shoppingo/commit/67a40a2ff7df3fc27b6ee8303b1265213e06c17d))
* Improve dark mode colors for Appbar and theme toggle button ([2a87f6e](https://github.com/igor-siergiej/shoppingo/commit/2a87f6e29517e1bcde72efbcb76da2482309eb4a))
* make NODE_AUTH_TOKEN optional in yarn config ([0c1e094](https://github.com/igor-siergiej/shoppingo/commit/0c1e0948a156ed374d4e7ba023d5207dbd79790c))


### Features

* Add dark mode toggle to Shoppingo ([2be4d7a](https://github.com/igor-siergiej/shoppingo/commit/2be4d7aecfb808ec5f9d211b1cc0a3fb886f0dd4))
* add separate Dockerfiles for API and web services ([dcfd45d](https://github.com/igor-siergiej/shoppingo/commit/dcfd45d50aa148aa51ccfd05a325072fc92c2bb5))
* Adjust card color to better match cream background ([b73136a](https://github.com/igor-siergiej/shoppingo/commit/b73136a16703005ec73e41c9934fb157aadbbfd2))
* Different green shades for light and dark modes ([37e0820](https://github.com/igor-siergiej/shoppingo/commit/37e0820d8f0ee5757b0e28bc080c04f9b26a9f87))
* Make app bar green in both light and dark modes ([5f44a28](https://github.com/igor-siergiej/shoppingo/commit/5f44a28c6ca9785b42a181537c57155a9993f044))
* Replace green color scheme with neutral gray ([2b9f29e](https://github.com/igor-siergiej/shoppingo/commit/2b9f29ee69650a05be885bc2d98dba96923c200d))
* Restore green app bar in light mode ([0708e05](https://github.com/igor-siergiej/shoppingo/commit/0708e05c8c5f0ee8aa6d6ce8c23bd15e4635cb34))
* Use cream color for light mode background ([6969dcb](https://github.com/igor-siergiej/shoppingo/commit/6969dcb30ebb903d8fdc496cda5ef2dd8ca1d017))
* Use darker green for primary color ([b07d13f](https://github.com/igor-siergiej/shoppingo/commit/b07d13f5ce5b0282df23872a92a193ff358053f6))

# [1.20.0](https://gitlab.com/imapps/shoppingo/compare/v1.19.0...v1.20.0) (2026-02-13)


### Bug Fixes

* Improve dark mode colors for Appbar and theme toggle button ([2a87f6e](https://gitlab.com/imapps/shoppingo/commit/2a87f6e29517e1bcde72efbcb76da2482309eb4a))


### Features

* Add dark mode toggle to Shoppingo ([2be4d7a](https://gitlab.com/imapps/shoppingo/commit/2be4d7aecfb808ec5f9d211b1cc0a3fb886f0dd4))
* Adjust card color to better match cream background ([b73136a](https://gitlab.com/imapps/shoppingo/commit/b73136a16703005ec73e41c9934fb157aadbbfd2))
* Different green shades for light and dark modes ([37e0820](https://gitlab.com/imapps/shoppingo/commit/37e0820d8f0ee5757b0e28bc080c04f9b26a9f87))
* Make app bar green in both light and dark modes ([5f44a28](https://gitlab.com/imapps/shoppingo/commit/5f44a28c6ca9785b42a181537c57155a9993f044))
* Replace green color scheme with neutral gray ([2b9f29e](https://gitlab.com/imapps/shoppingo/commit/2b9f29ee69650a05be885bc2d98dba96923c200d))
* Restore green app bar in light mode ([0708e05](https://gitlab.com/imapps/shoppingo/commit/0708e05c8c5f0ee8aa6d6ce8c23bd15e4635cb34))
* Use cream color for light mode background ([6969dcb](https://gitlab.com/imapps/shoppingo/commit/6969dcb30ebb903d8fdc496cda5ef2dd8ca1d017))
* Use darker green for primary color ([b07d13f](https://gitlab.com/imapps/shoppingo/commit/b07d13f5ce5b0282df23872a92a193ff358053f6))

# [1.19.0](https://gitlab.com/imapps/shoppingo/compare/v1.18.1...v1.19.0) (2026-02-13)


### Features

* Add confirmation dialog for clear selected items and disable buttons ([6113809](https://gitlab.com/imapps/shoppingo/commit/6113809ac055e6c0d0a588839e1005e5b67bb6fa))
* Add confirmation dialogs for delete operations ([adaab22](https://gitlab.com/imapps/shoppingo/commit/adaab2247e077f5e23fa286a9129b5b289d14eca))

## [1.18.1](https://gitlab.com/imapps/shoppingo/compare/v1.18.0...v1.18.1) (2026-02-13)


### Bug Fixes

* Include ownerId in getListsForUser response ([1b5d870](https://gitlab.com/imapps/shoppingo/commit/1b5d8700ea157a767c6dea1f1f5eb17963c63583))
* Make list cards consistent height ([51c29e1](https://gitlab.com/imapps/shoppingo/commit/51c29e198a35c490ff2e4b2b6c75cf8199e91e59))

# [1.18.0](https://gitlab.com/imapps/shoppingo/compare/v1.17.2...v1.18.0) (2026-02-12)


### Features

* Update toast styling and add list ownership controls ([b43e753](https://gitlab.com/imapps/shoppingo/commit/b43e753782c67aba5366e7f0c74dda771362cc24)), closes [#10b981](https://gitlab.com/imapps/shoppingo/issues/10b981)

## [1.17.2](https://gitlab.com/imapps/shoppingo/compare/v1.17.1...v1.17.2) (2026-02-09)


### Bug Fixes

* Properly extract and log error messages in user management endpoints ([7c4b595](https://gitlab.com/imapps/shoppingo/commit/7c4b5955d4f5f7fef4d5afcde09ece64be143c2f))

## [1.17.1](https://gitlab.com/imapps/shoppingo/compare/v1.17.0...v1.17.1) (2026-02-08)


### Bug Fixes

* improve Kubernetes pod scheduling by optimizing kubelet resources ([9e93339](https://gitlab.com/imapps/shoppingo/commit/9e9333946161a5cb19bd7968655d993a022cd9be))

# [1.17.0](https://gitlab.com/imapps/shoppingo/compare/v1.16.1...v1.17.0) (2026-02-08)


### Bug Fixes

* improve Docker daemon startup timeout in CI pipelines ([56f4682](https://gitlab.com/imapps/shoppingo/commit/56f46828fb4b629b2642fa81edf0580a0b2652f4))
* improve error handling and messaging for user sharing and list creation ([2788988](https://gitlab.com/imapps/shoppingo/commit/27889888142173832216d936800ec442192e8561))


### Features

* manage users menu ([acbc14c](https://gitlab.com/imapps/shoppingo/commit/acbc14c5ec5cb39afb6e4eef6837b356a8687796))

## [1.16.1](https://gitlab.com/imapps/shoppingo/compare/v1.16.0...v1.16.1) (2026-01-30)


### Bug Fixes

* ensure gitops jobs receive VERSION artifact from version-release ([b9a76a8](https://gitlab.com/imapps/shoppingo/commit/b9a76a83415aef28a142458cd0599aa8a2a5e3a4))

# [1.16.0](https://gitlab.com/imapps/shoppingo/compare/v1.15.0...v1.16.0) (2026-01-29)


### Bug Fixes

* not being able to add shopping list items ([86a4000](https://gitlab.com/imapps/shoppingo/commit/86a40003a71de0a981548741be23a0151a231af6))


### Features

* added support for openai models for image generation ([64aa415](https://gitlab.com/imapps/shoppingo/commit/64aa415325f8a8cfd9ab224246c9df9a8ed75629))

# [1.15.0](https://gitlab.com/imapps/shoppingo/compare/v1.14.0...v1.15.0) (2026-01-05)


### Features

* add Origin header to kivo /verify requests ([3e2f8df](https://gitlab.com/imapps/shoppingo/commit/3e2f8df909eecb40ec34f25efb61d29df85f47f6))

# [1.14.0](https://gitlab.com/imapps/shoppingo/compare/v1.13.0...v1.14.0) (2026-01-05)


### Features

* fix types package external dependency ([5978217](https://gitlab.com/imapps/shoppingo/commit/59782170912e75b80e829e7cc4af417635b8db34))

# [1.13.0](https://gitlab.com/imapps/shoppingo/compare/v1.12.0...v1.13.0) (2026-01-05)


### Bug Fixes

* apply linting auto-fixes for formatting ([223b53d](https://gitlab.com/imapps/shoppingo/commit/223b53d75e6341e68499d4f24123943dc942d2b5))
* match exact shadcn date-picker example implementation ([af3f23f](https://gitlab.com/imapps/shoppingo/commit/af3f23f380cbc6c47ffdd8f6c6a48698e2a97852))
* resolve 3 linting errors ([235927a](https://gitlab.com/imapps/shoppingo/commit/235927a9f86dc0f59bcd76ea6ec6ae36af93f0b5))
* resolve Calendar identifier conflict ([edb3e92](https://gitlab.com/imapps/shoppingo/commit/edb3e920c514d65f65ba888fb09d2a0830dfb61e))
* resolve date picker in drawer by increasing z-index ([ddac632](https://gitlab.com/imapps/shoppingo/commit/ddac63223bc16ce717faeea9a330647ef4110550))
* resolve TODO list checkbox error and calendar styling ([45d7b17](https://gitlab.com/imapps/shoppingo/commit/45d7b178d873872abc54316015be6041cbad3f31))
* use shadcn date-picker pattern with proper state management ([dca8eed](https://gitlab.com/imapps/shoppingo/commit/dca8eede35a8bf05452a474ee3552b0e07aa56c2))


### Features

* add date picker popover for TODO items ([8ff5b98](https://gitlab.com/imapps/shoppingo/commit/8ff5b98f2d76073b14e6b16164dd275b38534691))
* complete TODO list feature with context-aware UI and date picker ([bb78c73](https://gitlab.com/imapps/shoppingo/commit/bb78c7384e16c7e78446c86dc6c3f201149c4939))
* fix calendar padding ([6a9d9ea](https://gitlab.com/imapps/shoppingo/commit/6a9d9eaa7ace2dff424e57d65e829250ed0eeaae))

# [1.12.0](https://gitlab.com/imapps/shoppingo/compare/v1.11.0...v1.12.0) (2026-01-04)


### Bug Fixes

* include listType in getListsForUser response ([32bf518](https://gitlab.com/imapps/shoppingo/commit/32bf518a928d75cd44943c134d502ec29f39a304))


### Features

* add conditional empty state messages for list types ([10e67bd](https://gitlab.com/imapps/shoppingo/commit/10e67bd54c9a302359c2f3423aedb2288840974c))
* improve add item/task modal UI ([416546d](https://gitlab.com/imapps/shoppingo/commit/416546df10e702f0f40c526e5f89c3df32d7c113))
* replace CheckSquare with ListTodo icon for TODO lists ([2958d6c](https://gitlab.com/imapps/shoppingo/commit/2958d6c29c48cc896625283e2aa238d777749414))

# [1.11.0](https://gitlab.com/imapps/shoppingo/compare/v1.10.3...v1.11.0) (2026-01-04)


### Bug Fixes

* update ListHandlers tests for TODO list feature ([9a959ac](https://gitlab.com/imapps/shoppingo/commit/9a959ac8f00dcfecb7993f91807de45edc02ea3d))


### Features

* add todo list feature with due dates support ([be6e8a8](https://gitlab.com/imapps/shoppingo/commit/be6e8a8e9c664038bf8c5d4f3b9f3e2106467bd2))

## [1.10.3](https://gitlab.com/imapps/shoppingo/compare/v1.10.2...v1.10.3) (2026-01-03)


### Bug Fixes

* add missing getList method to ListService for access control checks ([56a5d93](https://gitlab.com/imapps/shoppingo/commit/56a5d939b6930e1c2f9c7f03614563713558bc37))

## [1.10.2](https://gitlab.com/imapps/shoppingo/compare/v1.10.1...v1.10.2) (2026-01-02)


### Bug Fixes

* implement phase 1 web security hardening and sanitized logging ([7f912de](https://gitlab.com/imapps/shoppingo/commit/7f912de3152cd53fdce04fe6d639c4069c0eaf6e))

## [1.10.1](https://gitlab.com/imapps/shoppingo/compare/v1.10.0...v1.10.1) (2026-01-02)


### Bug Fixes

* implement authorization layer for Shoppingo API ([9c714d3](https://gitlab.com/imapps/shoppingo/commit/9c714d36165f9acd8cbd74eea59f339713527647))
* implement authorization layer for Shoppingo API ([a8bffc1](https://gitlab.com/imapps/shoppingo/commit/a8bffc19317b367c33761b199a4821f9dbf24f72))

# [1.10.0](https://gitlab.com/imapps/shoppingo/compare/v1.9.1...v1.10.0) (2026-01-01)


### Features

* implement end-to-end JWT authentication with Kivo integration ([daa50ee](https://gitlab.com/imapps/shoppingo/commit/daa50eedbc673c476b523b92d17813a92043910c))

## [1.9.1](https://gitlab.com/imapps/shoppingo/compare/v1.9.0...v1.9.1) (2025-12-29)


### Bug Fixes

* add .env to .gitignore to prevent credential leaks ([babab97](https://gitlab.com/imapps/shoppingo/commit/babab97fdae5d5d6aa6f0393e195de94cc52b04e))

# [1.9.0](https://gitlab.com/imapps/shoppingo/compare/v1.8.1...v1.9.0) (2025-12-19)


### Features

* add frontend and backend logging pipeline to Loki ([e9aabc4](https://gitlab.com/imapps/shoppingo/commit/e9aabc447637298269a6534b169d71c754b86c5e))

## [1.8.1](https://gitlab.com/imapps/shoppingo/compare/v1.8.0...v1.8.1) (2025-12-18)


### Bug Fixes

* **ci:** update helm values paths for proper image tag configuration ([0d1e251](https://gitlab.com/imapps/shoppingo/commit/0d1e2515c0b835eed1b82be322b685c767039b86))

# [1.8.0](https://gitlab.com/imapps/shoppingo/compare/v1.7.0...v1.8.0) (2025-12-18)


### Features

* add comprehensive audit logging to shoppingo API ([77763b3](https://gitlab.com/imapps/shoppingo/commit/77763b36dd9bd8f02571ef632057b6db33237878))

# [1.7.0](https://gitlab.com/imapps/shoppingo/compare/v1.6.0...v1.7.0) (2025-12-09)


### Features

* migrate CI/CD pipeline to Helm chart GitOps templates ([02ae5b5](https://gitlab.com/imapps/shoppingo/commit/02ae5b5fe7f44069cf1452984885e6ee42633419))

# [1.6.0](https://gitlab.com/imapps/shoppingo/compare/v1.5.0...v1.6.0) (2025-12-04)


### Features

* move the add button to the middle ([71e1170](https://gitlab.com/imapps/shoppingo/commit/71e1170796649f21d6d465eb353dc1732e343922))

# [1.5.0](https://gitlab.com/imapps/shoppingo/compare/v1.4.0...v1.5.0) (2025-11-17)


### Features

* add commitlint for conventional commits ([eb14c67](https://gitlab.com/imapps/shoppingo/commit/eb14c677885fbdf6ef0195690f3442edd5e6ab77))
* fix commit lint linting lol ([fd644c4](https://gitlab.com/imapps/shoppingo/commit/fd644c468254280ea48fa26270ac1f03e93fc577))
* get commit hook working ([771176a](https://gitlab.com/imapps/shoppingo/commit/771176a09d41326443f74664e2c7ad5cc5bce485))
* new version ([feaea12](https://gitlab.com/imapps/shoppingo/commit/feaea1261a5cf0fb53d5aae32de4810c81fb298f))

# [1.4.0](https://gitlab.com/imapps/shoppingo/compare/v1.3.0...v1.4.0) (2025-11-14)


### Features

* deploy new version ([c0b1d57](https://gitlab.com/imapps/shoppingo/commit/c0b1d570e38541727c83a191a5210b55a0546d0b))

# [1.3.0](https://gitlab.com/imapps/shoppingo/compare/v1.2.1...v1.3.0) (2025-11-04)


### Bug Fixes

* lint ([86ecf14](https://gitlab.com/imapps/shoppingo/commit/86ecf149415212c47c2f5ef79e7c22016ed4e972))


### Features

* added optimistic state changes with tanstack ([f51a259](https://gitlab.com/imapps/shoppingo/commit/f51a25950c92cc74bc51f0e222f395bf1c1bd9e5))
* added swiping to show edit and delete ([0185b9f](https://gitlab.com/imapps/shoppingo/commit/0185b9fb6441801e2898c44945e099bb8a17ddaa))
* move edit to a dialog ([7db30b6](https://gitlab.com/imapps/shoppingo/commit/7db30b6586ffb4f769cb0b97d3595275d615124c))

## [1.2.1](https://gitlab.com/imapps/shoppingo/compare/v1.2.0...v1.2.1) (2025-10-31)


### Bug Fixes

* **ci:** configure publish jobs to allow insecure registry ([443e30c](https://gitlab.com/imapps/shoppingo/commit/443e30c93dffad6bd5f516a58d75d2463782017e))

# [1.2.0](https://gitlab.com/imapps/shoppingo/compare/v1.1.2...v1.2.0) (2025-10-31)


### Features

* add clean orphanes tags script ([a168329](https://gitlab.com/imapps/shoppingo/commit/a16832914ad08eb9e4080c63c14e90f3ed04dcf7))
* use jewellery-catalogue pipeline ([69d8d2e](https://gitlab.com/imapps/shoppingo/commit/69d8d2ec6be2e5d48355ef64d73ca311d859306e))

## [1.1.2](https://gitlab.com/imapps/shoppingo/compare/v1.1.1...v1.1.2) (2025-10-04)


### Bug Fixes

* remove some tests ([929011a](https://gitlab.com/imapps/shoppingo/commit/929011a0042fbd70b08071438829261851f9fc3c))

## [1.1.1](https://gitlab.com/imapps/shoppingo/compare/v1.1.0...v1.1.1) (2025-10-03)


### Bug Fixes

* update package versions too ([69ace70](https://gitlab.com/imapps/shoppingo/commit/69ace70f7449e6cf6e35f50c259064b3805c1d54))

# [1.1.0](https://gitlab.com/imapps/shoppingo/compare/v1.0.0...v1.1.0) (2025-10-03)


### Bug Fixes

* yarn lock and use eslint-config 0.2 ([0097da7](https://gitlab.com/imapps/shoppingo/commit/0097da7465c9b17619730288fb69d7fc6d4ed225))


### Features

* update empty components and some toolbar fixes ([78cff8b](https://gitlab.com/imapps/shoppingo/commit/78cff8b747e4ebc35ffca297fa89243d0f303a36))

# 1.0.0 (2025-09-30)


### Bug Fixes

* make sure prod gitops job has version ([330c93c](https://gitlab.com/imapps/shoppingo/commit/330c93c017b9251f7d9eaa0a2fb1ce8142758da4))
* use new util package versions ([ec5640b](https://gitlab.com/imapps/shoppingo/commit/ec5640b7f5d8fe27c33da3811126ece3ee46dada))
* use version-release steps instead ([d79719e](https://gitlab.com/imapps/shoppingo/commit/d79719e9522c1dd92f339df894c2de942f0deaba))


### Features

* add semantic-release for automated versioning ([43fa720](https://gitlab.com/imapps/shoppingo/commit/43fa720ed16849c836b82adc9534000c498ed54a))
* use semantic versions here too ([9370c27](https://gitlab.com/imapps/shoppingo/commit/9370c27f7be842e841b790b475d2aeb288134bfc))
