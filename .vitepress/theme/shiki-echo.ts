import type { ThemeRegistrationRaw } from 'shiki'

// One token theme for both colour modes. That is not a shortcut: the design this site follows keeps code
// blocks dark on a white page, so a light variant would never be shown. Passing a single theme (rather than
// a { light, dark } pair) also keeps Shiki from emitting a --shiki-light/--shiki-dark pair on every span.
//
// The background is deliberately `transparent`. Shiki writes its background onto the <pre> as an inline
// style, which outranks any stylesheet — leaving it transparent lets --vp-code-block-bg on the wrapping
// <div> decide, which is what differs between the two modes.
//
// Colours are the slate/brand/pink of the palette in style.css. Fenced `echo`/`eco` blocks are highlighted
// with the PHP grammar (see `languageAlias` in config.mts), so these are PHP scopes.
export const echoTheme: ThemeRegistrationRaw = {
  name: 'echo-dark',
  type: 'dark',

  colors: {
    'editor.background': 'transparent',
    'editor.foreground': '#f8fafc', // slate-50
  },

  // The scopes below were read off the PHP grammar tokenising real Echo, not guessed from PHP. Two are
  // worth knowing about: a type name Echo writes where PHP would write nothing — `int32 $x`, `struct Point`,
  // `array<Point>` — comes out as `constant.other.php`, and `echo` is a `support.function.construct`, which
  // is why both are named explicitly.
  settings: [
    {
      // Anything the grammar does not name — `$variables` above all, which are most of an Echo body and are
      // unreadable if every one of them is coloured.
      settings: {
        foreground: '#f8fafc', // slate-50
      },
    },
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: '#94a3b8' }, // slate-400
    },
    {
      // Keywords, and the language constructs that behave like them.
      scope: [
        'keyword',
        'keyword.control',
        'keyword.other',
        'storage.modifier',
        'storage.type.function',
        'storage.type.class',
        'support.function.construct',
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
        'variable.other.property',
        'variable.other.object.property',
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
        'support.function',
        'support.class',
        'meta.function-call',
        'variable.function',
        'constant.other',
        'storage.type',
      ],
      settings: { foreground: '#f472b6' }, // pink-400
    },
  ],
}
