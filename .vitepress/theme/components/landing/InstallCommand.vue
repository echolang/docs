<script setup lang="ts">
// The click-to-copy install box. The command is the real one from guide/installation.md — the design carried
// a `echolang.dev/install` placeholder, and a copy button that puts a command at a host nobody owns onto
// somebody's clipboard is worse than no copy button.
import { ref } from 'vue'

const COMMAND = 'curl -fsSL https://raw.githubusercontent.com/echolang/echo/master/install.sh | bash'

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  try {
    await navigator.clipboard.writeText(COMMAND)
  } catch {
    // Denied permission, an insecure origin, or a browser without the API. The command is on screen and
    // selectable either way, so there is nothing to report.
    return
  }
  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => (copied.value = false), 1600)
}
</script>

<template>
  <button class="box" type="button" :aria-label="`Copy: ${COMMAND}`" @click="copy">
    <span class="prompt" aria-hidden="true">$</span>
    <code>{{ COMMAND }}</code>
    <span class="label" :class="{ 'is-copied': copied }">{{ copied ? 'COPIED' : 'COPY' }}</span>
  </button>
</template>

<style scoped>
.box {
  display: inline-flex;
  align-items: center;
  gap: 1.125rem;
  max-width: 100%;
  margin-top: 2.125rem;
  padding: 1rem 1.375rem;
  border-radius: var(--eco-radius);
  border: 1px solid var(--eco-ink-line-strong);
  background: var(--eco-ink-surface);
  font-family: var(--vp-font-family-mono);
  font-size: 0.9375rem;
  color: var(--eco-ink-bright);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s;
}

.box:hover {
  border-color: var(--eco-brand-500);
}

.prompt {
  flex: none;
  color: var(--eco-ink-green);
}

/* The real command is long. It scrolls inside the box rather than widening the page. */
code {
  min-width: 0;
  overflow-x: auto;
  white-space: nowrap;
  background: none;
  padding: 0;
  font-size: inherit;
  color: inherit;
}

.label {
  flex: none;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  color: var(--eco-ink-dim);
  transition: color 0.2s;
}

.label.is-copied {
  color: var(--eco-ink-green);
}

@media (max-width: 640px) {
  .box {
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    font-size: 0.8125rem;
  }
}
</style>
