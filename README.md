# Echo documentation

The user-facing documentation for the Echo programming language.
## Running it

```bash
npm install
npm run docs:dev        # http://localhost:5173
npm run docs:build      # writes .vitepress/dist, fails on any dead link
npm run docs:preview    # serve the built site
```

## Publishing

Every push to `main` builds and deploys the site to <https://echoc.dev> through
`.github/workflows/deploy.yml`. Two things have to be set for that to work: Pages' source is **GitHub
Actions** in the repository settings, and the domain lives in `public/CNAME` rather than only in the settings
UI. A deploy overwrites the site root, and Pages forgets a domain it cannot find there.

If the site ever lands on a project page rather than a root domain, `base` in `.vitepress/config.mts` has to
change from `/` to `/<repo>/`.

## Where things live

| | |
|---|---|
| `.vitepress/config.mts` | title, nav, **the sidebar**, search, markdown settings |
| `.vitepress/echo.tmLanguage.json` | the Echo TextMate grammar. **A copy**, see Syntax highlighting below |
| `.vitepress/theme/` | **the design**. See below. |
| `public/` | served at the site root: the logo, which is also the favicon |
| `index.md` | the front page. Frontmatter only; the page itself is `theme/components/landing/` |
| `guide/` | getting started, in reading order |
| `language/` `memory/` `collections/` | the language itself |
| `projects/` | modules, the CLI, linking, C interop, debugging |
| `stdlib/` `reference/` | API surface and lookup tables |

## Adding a page

1. Create the `.md` file in the right directory.
2. Add it to the sidebar in `.vitepress/config.mts`. A page that is not in the sidebar is unreachable.
3. Run `npm run docs:build`. The build fails on dead links, which is how a typo'd relative path gets caught.
