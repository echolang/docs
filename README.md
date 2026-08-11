# Echo documentation

The user-facing documentation for the Echo programming language.
## Running it

```bash
npm install
npm run docs:dev        # http://localhost:5173
npm run docs:build      # writes .vitepress/dist, fails on any dead link
npm run docs:preview    # serve the built site
```

## Where things live

| | |
|---|---|
| `.vitepress/config.mts` | title, nav, **the sidebar**, search, markdown settings |
| `.vitepress/theme/` | **the design** — see below |
| `public/` | served at the site root: the logo, which is also the favicon |
| `index.md` | the front page — frontmatter only; the page itself is `theme/components/landing/` |
| `guide/` | getting started, in reading order |
| `language/` `memory/` `collections/` | the language itself |
| `projects/` | modules, the CLI, linking, C interop, debugging |
| `stdlib/` `reference/` | API surface and lookup tables |

## Adding a page

1. Create the `.md` file in the right directory.
2. Add it to the sidebar in `.vitepress/config.mts`. A page that is not in the sidebar is unreachable.
3. Run `npm run docs:build`. The build fails on dead links, which is how a typo'd relative path gets caught.

## Writing

The voice is defined in `.claude/WRITING_STYLE.md` in the compiler repository. Short version: write like a
capable developer explaining the language at a whiteboard. Big picture first, then the rule, then a small
example that proves it. Casual, opinionated, precise. No marketing adjectives.

**Every code example must compile.** Paste it into a scratch `.eco` file and run it:

```bash
echoc run .scratch/snippet.eco
```

`.scratch/` is gitignored for exactly this.

## Unwritten pages

Pages that only have an outline carry an `<!-- STUB -->` comment. That is the writing queue:

```bash
grep -rl STUB . --include=*.md
```

## The theme

The site **extends** the VitePress default theme rather than replacing it, so search, the outline, the
mobile drawer and the prev/next links keep working with no code of ours behind them.

| | |
|---|---|
| `theme/style.css` | almost all of it — palette, type scale, header, sidebar, prose, code blocks, callouts, and the landing page's own palette and snippet colours |
| `theme/shiki-echo.ts` | the code token colours, as one theme used in both colour modes |
| `theme/components/landing/` | **the front page.** `EchoLanding.vue` is the shell and is registered globally in `theme/index.ts`, because the only thing that renders it is one tag in `index.md`; `LandingHero`, `LandingRace` and `LandingTour` are the three sections with behaviour, and `CodeWindow` / `InstallCommand` are the two primitives |
| `theme/components/DocEyebrow.vue` | the section name above a page title, read back out of the sidebar so no page has to repeat it |
| `theme/fonts/` | Lexend, self-hosted. Referenced by a **relative** `url()` so Vite fingerprints it — a `/fonts/…` path out of `public/` would break the day `base` changes |

The **left navigation is dark in both colour modes**, so the sidebar section of `style.css` states one set
of colours rather than a light pair and a dark pair. In light mode that also means the header's wordmark
column has to be filled white by hand: the sidebar is painted from the very top of the page and the header
sits transparently on it. **The landing page follows the same rule** — it is dark whichever way the toggle is
set, which is why the `.eco-landing` block undoes that white fill for its own header.

The front page is `layout: page`, not `layout: home`: VitePress's `VPHero` and `VPFeature` are gone from the
site entirely. One consequence is worth knowing before touching a landing snippet — **the `<pre>` has to be
written in the same template as the snippet**. Vue's compiler only preserves whitespace inside a `<pre>` it
can see, so a snippet slotted into a `<pre>` that lives in `CodeWindow.vue` arrives condensed onto one line.
That is why `CodeWindow` styles the chrome and `style.css` styles `pre.eco-code`.

Two rules are worth knowing before editing `style.css`. Default-theme components use **scoped** styles,
whose `[data-v-…]` attribute outranks any plain selector — that is what every `!important` in the file is
for, and there is no other reason to add one. And headings are Lexend at **weight 400**: the font's `ss01`
feature set is why it is a local file rather than a Google Fonts link.

## Syntax highlighting

Shiki has no grammar for Echo, so `echo` and `eco` fenced blocks are aliased to PHP in
`.vitepress/config.mts`. It gets `$variables`, comments, strings, numbers and most keywords right, and it
gets Echo-specific things like `mv`, `guard`, `usize` and `:$` wrong. Writing a real TextMate grammar and
loading it through `markdown.shikiSetup` is the proper fix, and is worth doing once the page count justifies
it.

## Deploying

Not wired up yet. When this becomes its own repository, add a GitHub Actions workflow that runs
`npm run docs:build` and publishes `.vitepress/dist`. If it lands on a project page rather than a root
domain, `base` in `.vitepress/config.mts` has to change from `/` to `/<repo>/`.
