---
# The front page is a landing page, not a document. `layout: page` keeps the site's nav bar and drops
# VitePress's hero/features scaffolding, and `pageClass` is what the landing section of
# theme/style.css hangs its full-bleed and dark-in-both-modes rules on. The page itself is one component
# (theme/components/landing/), registered globally in theme/index.ts.
layout: page
pageClass: eco-landing

# Both of these are things `layout: home` used to suppress on its own and `layout: page` does not. The
# sidebar is configured as one flat list, so without a word here it applies to the front page too; and the
# landing page carries its own footer. Saying it in the frontmatter is what VPSidebar and VPFooter
# themselves read: cheaper and more honest than hiding either with CSS.
sidebar: false
footer: false

title: Echo Programming Language
titleTemplate: false
description: A language for people who want speed without the ceremony.
---

<EchoLanding />
