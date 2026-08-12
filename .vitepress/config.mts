import { defineConfig } from 'vitepress'

import { echoTheme } from './theme/shiki-echo'
import echoGrammar from './echo.tmLanguage.json'

// The sidebar is the structure of the docs. It is deliberately one flat definition rather than a per
// directory one, because the reading order across sections is the point: a newcomer can start at the top
// and walk down without meeting a concept before its prerequisite.
const sidebar = [
  {
    text: 'Getting Started',
    items: [
      { text: 'What is Echo?', link: '/guide/what-is-echo' },
      { text: 'Installation', link: '/guide/installation' },
      { text: 'Your first program', link: '/guide/first-program' },
      { text: 'A tour of Echo', link: '/guide/tour' },
      { text: 'Coming from PHP', link: '/guide/coming-from-php' },
    ],
  },
  {
    text: 'The Language',
    items: [
      { text: 'Variables', link: '/language/variables' },
      { text: 'Types', link: '/language/types' },
      { text: 'Expressions', link: '/language/expressions' },
      { text: 'Control flow', link: '/language/control-flow' },
      { text: 'Functions', link: '/language/functions' },
      { text: 'Closures', link: '/language/closures' },
      { text: 'Structs', link: '/language/structs' },
      { text: 'Classes', link: '/language/classes' },
      { text: 'Interfaces', link: '/language/interfaces' },
      { text: 'Generics', link: '/language/generics' },
      { text: 'Operators', link: '/language/operators' },
      { text: 'Namespaces', link: '/language/namespaces' },
      { text: 'Visibility', link: '/language/visibility' },
      { text: 'Constants', link: '/language/constants' },
      { text: 'Errors and panics', link: '/language/errors-and-panics' },
    ],
  },
  {
    text: 'Memory and Safety',
    items: [
      { text: 'Ownership and moving', link: '/memory/ownership' },
      { text: 'Copying', link: '/memory/copying' },
      { text: 'Nullability', link: '/memory/nullability' },
      { text: 'Pointers and references', link: '/memory/pointers' },
      { text: 'Unsafe', link: '/memory/unsafe' },
    ],
  },
  {
    text: 'Collections',
    items: [
      { text: 'Strings', link: '/collections/strings' },
      { text: 'Arrays', link: '/collections/arrays' },
      { text: 'Maps', link: '/collections/maps' },
      { text: 'Slices', link: '/collections/slices' },
      { text: 'Ranges', link: '/collections/ranges' },
      { text: 'Iteration', link: '/collections/iteration' },
    ],
  },
  {
    text: 'Building Projects',
    items: [
      { text: 'Modules', link: '/projects/modules' },
      { text: 'The echoc CLI', link: '/projects/cli' },
      { text: 'Conditional compilation', link: '/projects/conditional-compilation' },
      { text: 'Linking', link: '/projects/linking' },
      { text: 'C interop', link: '/projects/c-interop' },
      { text: 'Debugging', link: '/projects/debugging' },
    ],
  },
  {
    text: 'Standard Library',
    items: [
      { text: 'Overview', link: '/stdlib/' },
      { text: 'mem', link: '/stdlib/mem' },
      { text: 'contract', link: '/stdlib/contract' },
      { text: 'hash', link: '/stdlib/hash' },
      { text: 'str and arr', link: '/stdlib/str-arr' },
      { text: 'std::io', link: '/stdlib/io' },
      { text: 'std::math', link: '/stdlib/math' },
      { text: 'std::env', link: '/stdlib/env' },
    ],
  },
  {
    text: 'Reference',
    items: [
      { text: 'Keywords', link: '/reference/keywords' },
      { text: 'Primitive types', link: '/reference/primitive-types' },
      { text: 'Attributes', link: '/reference/attributes' },
      { text: 'CLI reference', link: '/reference/cli-reference' },
      { text: 'What is missing', link: '/reference/limitations' },
    ],
  },
]

export default defineConfig({
  title: 'Echo',
  description: 'A statically typed, natively compiled language with PHP-flavoured syntax.',
  lang: 'en-US',

  // `docs/` becomes its own repository later. If it ends up on a GitHub project page rather than a root
  // domain, this has to become '/<repo>/'.
  base: '/',

  cleanUrls: true,
  lastUpdated: true,

  // A `head` href is **not** rewritten against `base` the way a themeConfig image is, so if `base` above
  // ever stops being '/', this path has to gain the same prefix by hand.
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/echo-logo.svg' }],
  ],

  markdown: {
    // Echo's own TextMate grammar, so `usize`, attributes and `?->` colour as themselves rather than as
    // whatever PHP happened to make of them. It declares `eco` as an alias, so both fence spellings work.
    //
    // The file is a copy — echolang/echolang-vscode is the source of truth and its header says so. The two
    // are separate repositories and the docs have no build step that could fetch one.
    languages: [echoGrammar as any],

    // One theme, not a light/dark pair — code blocks stay dark on a white page. See theme/shiki-echo.ts.
    theme: echoTheme,
  },

  themeConfig: {
    logo: '/echo-logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/what-is-echo', activeMatch: '/guide/' },
      { text: 'Language', link: '/language/variables', activeMatch: '/(language|memory|collections)/' },
      { text: 'Projects', link: '/projects/modules', activeMatch: '/projects/' },
      { text: 'Standard Library', link: '/stdlib/', activeMatch: '/stdlib/' },
      { text: 'Reference', link: '/reference/keywords', activeMatch: '/reference/' },
    ],

    sidebar,

    search: {
      provider: 'local',
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/echolang/echo' },
    ],

    editLink: {
      pattern: 'https://github.com/echolang/echo/edit/master/docs/:path',
      text: 'Suggest an edit to this page',
    },

    outline: {
      level: [2, 3],
      label: 'On this page',
    },

    footer: {
      message: 'Echo is a work in progress. Nothing here is a promise of stability.',
    },
  },
})
