<script setup lang="ts">
// The one code window on the landing page. The hero, the PHP contrast block, the tour steps, the also-this
// cards and both ownership cards are this component wearing different chrome: three traffic lights and a
// filename, a coloured label, or no bar at all.
//
// The snippet is **not** slotted into a `<pre>` in here, and that is load-bearing: Vue's template compiler
// only preserves whitespace inside a `<pre>` written in the *same* template, so slot content authored
// elsewhere comes through condensed and every snippet collapses onto one line. Consumers write their own
// `<pre class="eco-code">`, which style.css styles once for all of them.
//
// Snippets are marked up by hand rather than run through Shiki, for the reason the site has always used
// here: a highlighter in a client component pulls a whole TextMate grammar into the bundle to colour a few
// dozen lines. The token classes live in style.css so every window on the page shares one set.
defineProps<{
  title?: string
  dots?: boolean
  tone?: 'brand' | 'rose' | 'green' | 'muted'
}>()
</script>

<template>
  <div class="eco-window">
    <div v-if="title || dots" class="chrome" :class="tone ? `tone-${tone}` : undefined">
      <template v-if="dots">
        <span class="light" aria-hidden="true" />
        <span class="light" aria-hidden="true" />
        <span class="light" aria-hidden="true" />
      </template>
      <span v-if="title" class="name">{{ title }}</span>
    </div>

    <slot />

    <div v-if="$slots.footer" class="foot">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
.eco-window {
  border-radius: var(--eco-radius);
  border: 1px solid var(--eco-ink-line);
  background: var(--eco-ink-surface);
  overflow: hidden;
}

.chrome {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--eco-ink-line-soft);
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  color: var(--eco-ink-dim);
}

.light {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #232c39;
}

/* The filename sits after the lights, so it needs its own gap when there are lights to sit after. */
.light + .name {
  margin-left: 0.5rem;
}

.tone-brand .name {
  color: var(--eco-brand-400);
}

.tone-rose .name {
  color: var(--eco-ink-rose);
  letter-spacing: 0.1em;
}

.tone-green .name {
  color: var(--eco-ink-green);
  letter-spacing: 0.1em;
}

.foot {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem 1.5rem;
  border-top: 1px solid var(--eco-ink-line-soft);
  background: var(--eco-ink-sunken);
  font-family: var(--vp-font-family-mono);
  font-size: 0.8125rem;
  color: var(--eco-ink-dim);
}

@media (max-width: 640px) {
  .foot {
    padding: 0.75rem 1rem;
  }
}
</style>
