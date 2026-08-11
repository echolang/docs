// The site extends the VitePress default theme rather than replacing it. Search, the outline scroll spy,
// the mobile drawer and the prev/next links are all worth keeping; what changes is how they look, and that
// lives in style.css.
//
// Two things CSS cannot produce: the section eyebrow above a page title, which Layout.vue fills a slot with,
// and the front page, which is a landing page rather than a document. `EchoLanding` is registered globally
// because the only thing that renders it is one tag in index.md.
import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import EchoLanding from './components/landing/EchoLanding.vue'

import './style.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('EchoLanding', EchoLanding)
  },
}
