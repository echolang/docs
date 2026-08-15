<script setup lang="ts">
// The small brand-coloured section name above a page's title. It is not in the frontmatter anywhere: the
// sidebar already says which section a page belongs to, so this reads the answer back out of it rather
// than asking every page to repeat itself.
import { computed } from 'vue'
import { useData, useRoute } from 'vitepress'

const { theme } = useData()
const route = useRoute()

const normalize = (path: string) => path.replace(/\.html$/, '').replace(/\/$/, '')

// Nearest enclosing group: a nested IO page should read "Input and Output", not
// "Standard Library", and a one-level walk would miss it entirely.
const sectionFor = (group: { text?: string, link?: string, items?: any[] }, here: string): string | null => {
  for (const item of group.items ?? []) {
    if (item.link && normalize(item.link) === here) {
      return group.text ?? null
    }

    if (item.items) {
      const nested = sectionFor(item, here)
      if (nested) {
        return nested
      }
    }
  }

  return null
}

const section = computed(() => {
  const groups = theme.value.sidebar

  if (!Array.isArray(groups)) {
    return null
  }

  const here = normalize(route.path)

  for (const group of groups) {
    const found = sectionFor(group, here)
    if (found) {
      return found
    }
  }

  return null
})
</script>

<template>
  <p v-if="section" class="eco-eyebrow">{{ section }}</p>
</template>

<style scoped>
.eco-eyebrow {
  font-family: var(--eco-font-display);
  font-feature-settings: 'ss01';
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.5rem;
  color: var(--eco-brand-500);
}
</style>
