# CLAUDE.md

Working notes for AI assistants (and humans) on this repository. Read this first: what the project is, how it is built, which rules must not be broken, and how to verify a change. When something here gets out of date, fix this file in the same change.

## 1. What this is

**Larder** is a product catalogue that keeps working offline, built with Angular 22 and deployed to GitHub Pages. You can browse, search, open products and fill a cart, then lose the connection and keep going. Seen pages are stored in IndexedDB, cart changes and contact messages go through a durable outbox, and every page is prerendered to static HTML.

- Live: `https://stiutin.github.io/larder/` (project site, sub-path `/larder/`)
- Data: [dummyjson](https://dummyjson.com/), a read-only demo API. Writes (cart, contact) are echoed back, not stored.
- It is a **portfolio project** and the reference for the portfolio's house style (see the last section). Its own lint rules are the strictest of the five repositories.

## 2. Toolchain

| Tool       | Version                                                                                                                                         | Notes                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Node.js    | 24 (`.nvmrc`), `engines` `>=22.22.3`                                                                                                            |                                                               |
| Angular    | 22.2 (standalone, zoneless, SSR prerendering, Service Worker)                                                                                   | Angular Material 3, CDK                                       |
| State      | NgRx SignalStore 22                                                                                                                             | `CatalogStore`, `CartStore`                                   |
| Data       | `idb` (IndexedDB), valibot (runtime validation), RxJS 7.8                                                                                       |                                                               |
| TypeScript | 6.0                                                                                                                                             | 7.0 is not supported by `typescript-eslint` or Angular 22 yet |
| Tests      | Vitest 5 through `@angular/build:unit-test`, Testing Library, jsdom, fake-indexeddb; `node:test`; Playwright 1.63; axe-core; Lighthouse CI 0.15 |                                                               |
| Lint       | ESLint 10 (`eslint.config.mjs`), angular-eslint 22, Stylelint 17 (SCSS, alphabetical properties)                                                |                                                               |

## 3. Commands

```bash
npm start                # dev server :4200 (real API)
npm run build            # production build: real API, prerendered, Pages files (scripts/build.mjs)
npm run build:mock       # the same against the local mock API: deterministic content for tests
BASE_HREF=/larder/ npm run build   # a project-site build, as in CI
npm run serve            # serve dist/ like GitHub Pages (:4000; BASE_HREF=/larder/ for the sub-path)
npm run check:pages      # checks a Pages build for what breaks silently on a sub-path
npm test                 # unit and component tests (Vitest)
npm run test:coverage    # the same with coverage thresholds (angular.json)
npm run test:static      # node:test + axe against the prerendered site
npm run e2e              # Playwright (desktop + mobile); run `npm run e2e:install` once
npm run lighthouse       # Lighthouse CI
npm run screenshots      # .github/screenshots/*.png from the showcase dataset
npm run measure:bundle   # bundle size report
npm run lint             # ESLint + Stylelint
npm run typecheck        # app, specs and e2e tsconfigs
npm run check            # format:check + lint + typecheck + unit tests  ← before finishing
```

The commands that need a built site (`test:static`, `e2e`, `lighthouse`) run `scripts/ensure-build.mjs` first. It makes a **mock** build when there is none, or when the inputs (src, configs, lock file, mock API) changed since. `SKIP_BUILD=1` skips that, as in CI, where the build comes from an artifact.

**Definition of done:** `npm run check` is green; for UI, data or offline changes also `npm run test:static` and `npm run e2e`; README and this file are still accurate.

## 4. Repository map

```
src/app/
  core/            errors (ApiError, global handler), HTTP interceptor + API config, offline (IndexedDB,
                   outbox, outbox sync, network status), routing (title strategy), brand, contact info
  features/
    catalog/       product list + product details pages, CatalogStore (+ state, transfer from prerender),
                   resolvers, toolbar, pagination
    cart/          cart page, CartStore, cart storage (IndexedDB), cart maths, cart line, badge
    about/  contact/   static page; contact form + service (queued offline)
  shared/          data (ProductApiService, catalog cache, ProductRepository = stale-while-revalidate),
                   models (+ catalog query parsing), layout (header, footer), UI (product card,
                   theme toggle, update banner, not found)
  app.routes.ts / app.routes.server.ts (what is prerendered) / app.config(.server).ts
src/sw-sync.js     Service Worker extension: imports ngsw-worker.js, adds Background Sync for the outbox
src/styles/        theme colours (generated palette), contrast test
tests/mock-api/    dummyjson stand-in (handler, server, showcase dataset), shared by builds, e2e, screenshots
tests/static/      node:test suite for the prerendered site
scripts/           build, serve (Pages emulator), ensure-build, check-pages, pages-postbuild, screenshots,
                   measure-bundle
e2e/               Playwright journeys + fixtures (mock API routing, network control)
```

## 5. Architecture

**Rendering.** GitHub Pages only serves files, so everything is prerendered (`app.routes.server.ts`):

- `''`, `about`, `contact` and `cart` get one HTML file each;
- `product/:id` gets one file per product, with ids fetched from the API during the build;
- `**` is client-rendered: Pages serves `404.html` (the client shell), and the router shows the not-found page or a product added after the build.

The catalogue store starts from the prerendered snapshot (transfer state, `catalog-transfer.ts`) instead of empty, so hydration shows no skeleton, then refreshes quietly. The cart is prerendered as a loading shell that matches the first client render.

**State.** Two SignalStores. `CatalogStore` is provided on the lazy catalogue route, so it and the data layer stay out of the initial bundle. It holds entities that accumulate across pages, computed current page, page count and filters, one `rxMethod` request stream with `switchMap`, and a `signalMethod` bound to the URL. `CartStore` holds items, conflicts and a hydration flag, plus price reconciliation after reconnecting.

**The URL is the single source of truth for the catalogue.** Query parameters arrive as signal inputs and are parsed into a valid query (garbage becomes defaults), and a newer query cancels an older one.

**Offline data.** `ProductRepository` implements stale-while-revalidate over IndexedDB with `concat(cache, network)`: the cache is always read first, so stale data never overwrites fresh data. Pages store product ids; products are stored once. API responses are cached **by the app, not by the Service Worker**, so the app knows the data's age ("Data as of 14:32"). Every response is validated with valibot.

**The outbox.** Every cart change writes the cart and a whole request (URL, method, body) to IndexedDB immediately. Only the network call is debounced. Flushes are serialised (`MAX_FLUSH_ROUNDS`). Network errors, 5xx, 408, 425 and 429 are retried; other 4xx are dropped, because they can never succeed. An entry replaced while it was in flight is neither deleted nor overwritten. An emptied cart removes its pending snapshot. The Service Worker (`sw-sync.js`) replays the same outbox on Background Sync, even after the tab is closed, and notifies open tabs.

**Forms and hydration.** Anything typed before hydration must survive it. The catalogue filters render their values as attributes and receive later URL changes through an effect. The contact form stays read-only until the page is interactive.

**Theming.** A Material 3 palette generated from three brand colours, colours defined with CSS `light-dark()`, and an inline script in `index.html` that applies the saved theme (`larder-theme` in `localStorage`) before the first frame. A unit test checks WCAG AA contrast for every text/background pair in both themes.

## 6. Invariants - do not break

1. **The IndexedDB schema is duplicated in `src/sw-sync.js`.** Database name, version and stores must match `core/offline/offline-db.ts`. Bump the version in both, and add an upgrade step.
2. **The cache first, then the network** (`concat`), and never let the Service Worker cache API responses (`ngsw-config.json` caches only product images from `cdn.dummyjson.com`).
3. **Validate every API response** with valibot before it reaches a store or a template.
4. **Outbox semantics** (section 5) are covered by tests. Don't "simplify" the in-flight replacement or retry rules.
5. **Prerender/hydration match:** don't render values that differ between the server and the first client render (dates, storage-backed data). Use the loading-shell pattern the cart uses.
6. **Base href:** links use the router or relative URLs. `npm run check:pages` fails a build that ignores the base href or lacks `404.html` or product pages.
7. **The mock API** is the single source of fixture data for builds, tests and screenshots. Its port is 4180, not 4190, which is on the fetch spec's blocked-ports list.
8. **The theme script runs before Angular.** Keep it tiny and dependency-free.
9. **Accessibility:** a skip link, visible focus, reduced motion respected, and AA contrast (tested). axe runs in `test:static` and e2e.

## 7. Conventions (project-specific)

- **Lint rules beyond the house core:** `@typescript-eslint/no-magic-numbers` (named constants, as in the outbox), naming conventions (static readonly `UPPER_CASE`), `member-ordering`, `explicit-module-boundary-types`, the `rxjs/finnish` `$` suffix on observables, `no-unsanitized`, component class suffixes (`Component`, `Container`, `Page`, `Modal`), `prefer-signals`, and template attribute ordering.
- Components: `ChangeDetectionStrategy.OnPush` explicit (lint-enforced here), signals and `input()`/`output()`, control-flow blocks, self-closing tags, `NgOptimizedImage` (`prefer-ngsrc`).
- Features are self-contained (`features/<name>/{data,pages,store,ui}`); `shared/` holds what several features use.

## 8. Testing guide

- **Unit and component:** Vitest in zoneless mode, Testing Library, and a real IndexedDB API (`fake-indexeddb`) instead of hand-written mocks. Wait for conditions (`waitFor`), never for fixed delays. Providers come from `src/test-providers.ts`, setup from `src/test-setup.ts`, fixtures from `src/testing/fixtures.ts`. Coverage thresholds live in `angular.json`: 80 % statements, branches and lines, 78 % functions.
- **Static site:** `tests/static/static.test.mjs` serves the mock build like Pages and checks prerendered HTML, redirects, 404s, Open Graph tags and axe.
- **End-to-end:** `e2e/fixtures.ts` routes browser requests to the same mock handler, and controls the network for the offline journeys. Service workers are blocked (`serviceWorkers: 'block'`), because a worker's own fetches bypass `page.route()`. Projects are `chromium` (desktop) and `mobile` (Pixel 7).

## 9. Recipes

- **New page:** add a route in `app.routes.ts`, and a server route in `app.routes.server.ts` (prerender it). Add a title and description, a static test and an axe check.
- **New API call:** add the endpoint to `API_ENDPOINTS`, a valibot schema, and go through the repository if it should work offline. Extend the mock handler and showcase data.
- **Change the IndexedDB schema:** see invariant 1.

## 10. CI/CD

The jobs are _Lint and types_, _Unit tests_ (with coverage), _Build_ (mock build, bundle report, static tests, artifact), _End-to-end_, _Lighthouse_, and _Deploy to GitHub Pages_. The deploy builds against the **real** API with `BASE_HREF=/larder/` (or the `PAGES_BASE_HREF` variable), runs `check:pages`, and uploads `dist/larder/browser` including dotfiles (`.nojekyll`). One-time setup is listed at the top of the workflow.

## 11. Troubleshooting

| Symptom                                                         | Cause / fix                                                                   |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| E2E or static tests use stale content                           | `ensure-build` decides on input timestamps; delete `dist/` to force a rebuild |
| Playwright: "Executable doesn't exist"                          | `npm run e2e:install`, or `CHROMIUM_PATH=/path/to/chrome`                     |
| Hydration mismatch warnings                                     | invariant 5                                                                   |
| Offline journey fails only with the Service Worker on           | the worker bypassed `page.route()`; e2e keeps it blocked                      |
| Deploy rejected: "branch not allowed to deploy to github-pages" | Settings → Environments → github-pages → allow `master`                       |

## 12. Known limitations

- The demo API does not persist writes: a real backend is on the roadmap (README).
- Products added after the last build are client-rendered through `404.html` until the next deploy.

## House style (identical in every repository of this portfolio)

These five repositories are written as one body of work: [cosmos-stories](https://github.com/stiutin/cosmos-stories), [larder](https://github.com/stiutin/larder), [pixi-neon-district](https://github.com/stiutin/pixi-neon-district), [threejs-solar-system](https://github.com/stiutin/threejs-solar-system) and [threejs-icosphere](https://github.com/stiutin/threejs-icosphere). Keep them alike. When a convention changes, change it everywhere.

**Shared files.** `LICENSE` (MIT, Serge Tiutin), `.editorconfig`, `.gitattributes`, `.nvmrc` (`24`), `.prettierrc`, `.prettierignore`, `.gitignore`, `.vscode/`, `.github/dependabot.yml` and the issue and PR templates are identical across the repositories, apart from a clearly marked `# Project` block at the end of the ignore files.

**Formatting.** Prettier: 120 columns, single quotes, no spaces inside braces (`{a, b}`), trailing commas where ES5 allows them, always parenthesised arrow parameters. `npm run format` fixes everything, and `npm run format:check` runs in CI. ESLint does not format.

**Linting.** `eslint.config.mjs` with `defineConfig`, and two shared blocks:

- `HOUSE_RULES`: sorted imports and exports (`simple-import-sort`), no unused imports, `curly: all`, arrow bodies only where needed, no `console` except `warn` and `error`;
- `HOUSE_TS_RULES` in TypeScript projects: explicit `public`/`protected`/`private` on every class member (never on constructors), `T[]` rather than `Array<T>`, and unused variables allowed only as `_`.

`eslint-config-prettier` comes last. Each project adds its own strictness on top: `typescript-eslint` strict-type-checked in cosmos-stories and pixi-neon-district, Larder's own rule set (magic numbers, naming, member ordering, RxJS) in larder. Styles are linted by Stylelint with properties in alphabetical order; `-webkit-backdrop-filter` and `-webkit-user-select` stay, for Safari.

**`package.json`.** The field order is name, version, description, license, author, repository, homepage, keywords, private, type, engines, scripts, dependencies, devDependencies. Dependencies are sorted, and `engines.node` is `>=22.22.3`. Scripts use the same names everywhere:

| Script                                       | Meaning                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `start`                                      | dev server                                                                |
| `build`                                      | production build                                                          |
| `serve`                                      | serve the production build like GitHub Pages does                         |
| `test` / `test:watch`                        | unit tests (where the project has them)                                   |
| `e2e` / `e2e:run` / `e2e:ui` / `e2e:install` | Playwright: build and test / test only / UI mode / download Chromium      |
| `screenshots`                                | regenerate `.github/screenshots/*.png` for the README                     |
| `lint` / `lint:fix`                          | ESLint and Stylelint                                                      |
| `typecheck`                                  | TypeScript (TypeScript projects)                                          |
| `format` / `format:check`                    | Prettier                                                                  |
| `check`                                      | everything CI checks before building: formatting, lint, types, unit tests |

**TypeScript.** Every TypeScript project has `strict` plus `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch` and `noUncheckedIndexedAccess`. Projects may add more (cosmos-stories: `noPropertyAccessFromIndexSignature`; pixi-neon-district: `exactOptionalPropertyTypes`, unused locals and parameters).

**Dependencies.** The latest versions, with deliberate exceptions noted in each CLAUDE.md. In particular, TypeScript stays on 6.0 because `typescript-eslint` and Angular 22 do not support 7.0 yet.

**Tests.** Every project has Playwright tests against its production build, on a desktop and a Pixel 7 viewport, served the way GitHub Pages serves it. `CHROMIUM_PATH` points Playwright and the screenshot scripts at a specific browser binary (useful in sandboxes). Projects with logic worth isolating also have Vitest unit tests.

**CI.** `.github/workflows/ci.yml` with the same job names: _Lint and types_, _Unit tests_, _Build_, _End-to-end (Playwright)_, _Lighthouse_ (Angular projects), _Deploy to GitHub Pages_. It runs on `ubuntu-24.04`, reads the Node version from `.nvmrc`, and uses the same action versions everywhere. Deploys go from `master` only, and only after the gates pass. The header of the workflow lists the one-time repository settings; the `github-pages` environment must allow `master`.

**Documentation.** The README follows one outline: title, one line, a paragraph, **Open the live demo**, screenshots, then _Features_, _Tech stack_, _How it works_, _Testing_ (a table), _Project structure_, _Running locally_, _Deployment_, _Roadmap_, _License_, _Author_. The voice is calm and specific, in British English, with no badges and no marketing adjectives. Explain _why_ in prose. There is no CHANGELOG and no ADR folder: decisions live in _How it works_ and in this file. `.github/social-preview.png` (1280×640) is the repository's social preview, and every project uses the same design.

**Scripts and tooling.** Node scripts are `.mjs`. TypeScript scripts run through Node's type stripping, and are used only when they share code with the app (cosmos-stories). Scripts have a header comment with usage examples.
