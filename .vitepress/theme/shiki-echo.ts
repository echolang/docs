import type { ThemeRegistrationRaw } from 'shiki'

// One token theme for both colour modes. That is not a shortcut: the design this site follows keeps code
// blocks dark on a white page, so a light variant would never be shown. Passing a single theme (rather than
// a { light, dark } pair) also keeps Shiki from emitting a --shiki-light/--shiki-dark pair on every span.
//
// The background is deliberately `transparent`. Shiki writes its background onto the <pre> as an inline
// style, which outranks any stylesheet — leaving it transparent lets --vp-code-block-bg on the wrapping
// <div> decide, which is what differs between the two modes.
//
// Colours are the slate/brand/pink of the palette in style.css.
export const echoTheme: ThemeRegistrationRaw = {
  name: 'echo-dark',
  type: 'dark',

  colors: {
    'editor.background': 'transparent',
    'editor.foreground': '#f8fafc', // slate-50
  },

  // These are Echo's own scopes, from the grammar in ../echo.tmLanguage.json. Six colours, and the split
  // between them is what makes a line readable rather than decorated:
  //
  //   pink       the names — types, functions, namespaces. Most of what you scan for.
  //   brand      the data — literals, strings, properties, attribute values.
  //   slate-300  the keywords.
  //   slate-400  comments and operators, which you read past.
  //   slate-500  punctuation, which you barely read at all.
  //   slate-50   variables and everything unnamed, which in Echo is most of a function body.
  //
  // Anything the grammar leaves unscoped falls to editor.foreground above, and that is on purpose: a
  // user-declared word operator (`operator (uint64 $a)kg`) cannot be known statically, so it reads as text.
  settings: [
    {
      // Scopeless on purpose — this is the default foreground. It covers `$variables`, which are most of an
      // Echo body and are unreadable if every one of them is coloured, along with anything unscoped.
      settings: {
        foreground: '#f8fafc', // slate-50
      },
    },
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: '#94a3b8' }, // slate-400
    },
    {
      // Keywords, and the language constructs that behave like them. `echo` is a statement rather than a
      // function, so it belongs here and not with the builtins.
      scope: [
        'keyword',
        'keyword.control',
        'keyword.other',
        'keyword.operator.word',
        'storage.modifier',
        'storage.type.function',
        'storage.type.class',
        'entity.name.tag',
      ],
      settings: { foreground: '#cbd5e1' }, // slate-300
    },
    {
      scope: ['keyword.operator'],
      settings: { foreground: '#94a3b8' }, // slate-400
    },
    {
      scope: [
        'punctuation',
        'meta.brace',
        'punctuation.separator',
        'punctuation.terminator',
        'punctuation.section',
      ],
      settings: { foreground: '#64748b' }, // slate-500
    },
    {
      // The `$` belongs to the name it introduces, so it is not punctuation for colouring purposes.
      scope: ['punctuation.definition.variable'],
      settings: { foreground: '#f8fafc' }, // slate-50
    },
    {
      scope: [
        'string',
        'string.quoted',
        'punctuation.definition.string',
        'constant.numeric',
        'constant.language',
        'constant.other',
        'variable.other.constant',
        'variable.other.property',
        'entity.other.attribute-name',
        'support.type.property-name',
      ],
      settings: { foreground: '#66bbfd' }, // brand-300
    },
    {
      // Types and the things that name them, which for Echo is most of what makes a line readable.
      scope: [
        'entity.name.function',
        'entity.name.type',
        'entity.name.class',
        'entity.name.namespace',
        'entity.name.symbol',
        'entity.name.constant',
        'support.function',
        'support.class',
        'support.type',
        'variable.language.axis',
      ],
      settings: { foreground: '#f472b6' }, // pink-400
    },
    {
      // An unknown attribute name and a binary literal are both real compile errors rather than style
      // opinions, so the grammar marks them and the theme says so out loud.
      scope: ['invalid', 'invalid.illegal'],
      settings: { foreground: '#f472b6', fontStyle: 'underline' },
    },
  ],
}
