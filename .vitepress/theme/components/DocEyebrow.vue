<script setup lang="ts">
// The small brand-coloured section name above a page's title. It is not in the frontmatter anywhere: the
// sidebar already says which section a page belongs to, so this reads the answer back out of it rather
// than asking every page to repeat itself.
import { computed } from 'vue'
import { useData, useRoute } from 'vitepress'

const { theme } = useData()
const route = useRoute()

const normalize = (path: string) => path.replace(/\.html$/, '').replace(/\/$/, '')

const section = computed(() => {
  const groups = theme.value.sidebar

  if (!Array.isArray(groups)) {
    return null
  }

  const here = normalize(route.path)

  for (const group of groups) {
    for (const item of group.items ?? []) {
      if (item.link && normalize(item.link) === here) {
        return group.text
      }
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
