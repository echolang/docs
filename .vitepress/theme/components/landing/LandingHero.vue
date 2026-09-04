<script setup lang="ts">
// The hero: one full-viewport statement over a shockwave rolling across a field of pins.
//
// The scene is the site's mark taken literally — an emitter firing rings outward — and it is decorative, so
// it is aria-hidden, it degrades to the radial wash underneath if WebGL is missing, and it holds still under
// prefers-reduced-motion. Everything that draws it is in shockwave.ts, loaded on mount so three.js is
// neither in the SSR bundle nor in the initial chunk.
//
// The design drew its own header. The site keeps VitePress's instead, which is the same call EchoLanding
// makes: the real one carries search, the theme toggle and the GitHub link.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { mountShockwave, type ShockwaveHandle } from './shockwave'

const stage = ref<HTMLElement | null>(null)
let scene: ShockwaveHandle | null = null

onMounted(async () => {
  if (!stage.value) return
  try {
    scene = await mountShockwave(stage.value, { accent: '#008efc' })
  } catch (e) {
    // A backdrop is not worth a blank page: if three.js will not load or the GPU will not give us a
    // context, the wash behind the canvas is the fallback and it is already there.
    console.error('[hero] shockwave failed to mount', e)
  }
})

onBeforeUnmount(() => {
  scene?.destroy()
  scene = null
})
</script>

<template>
  <header class="hero">
    <div ref="stage" class="stage" aria-hidden="true" @click="scene?.fire()" />
    <div class="vignette" aria-hidden="true" />

    <div class="inner">
      <h1>Echo goes brrrrr.</h1>

      <p class="lede">PHP-flavoured syntax, statically typed, compiled to one native binary.</p>

      <div class="actions">
        <a class="btn btn-brand" href="/guide/installation">Install it</a>
        <a class="btn btn-ghost" href="/guide/tour">Read the tour</a>
      </div>
    </div>

    <p class="strip" aria-hidden="true">
      <span class="hint">click anywhere to echo</span>
      <span class="tick" />
      <span>macOS · Linux · Windows</span>
    </p>
  </header>
</template>

<style scoped>
/* Pulled up under the nav bar, which is transparent at the top of this page: the scene runs to the very top
   of the window the way the design drew it, rather than starting below a band of flat ground. The content
   inside pays the nav height back as padding. */
.hero {
  position: relative;
  margin-top: calc(-1 * var(--vp-nav-height));
  height: 100svh;
  min-height: 40rem;
  max-height: 60rem;
  overflow: hidden;
}

/* The canvas mounts in here. The gradient is what shows before three.js arrives, and what stays if it never
   does — so the section is never a black rectangle. */
.stage {
  position: absolute;
  inset: 0;
  cursor: crosshair;
  background: radial-gradient(ellipse 50% 40% at 50% 62%, rgb(0 142 252 / 0.1), transparent 70%);
}

/* Darkens the top and bottom of the scene so the headline and the strip sit on ground rather than on grid.
   The middle two stops are what the copy sits on: a wave crest passing behind the sub-headline is bright
   enough to swallow it, and this is the layer that holds it back. */
.vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgb(6 8 12 / 0.9) 0%,
    rgb(6 8 12 / 0.55) 22%,
    rgb(6 8 12 / 0.18) 42%,
    rgb(6 8 12 / 0) 58%,
    rgb(6 8 12 / 0.7) 100%
  );
}

/* Sits below the fixed nav bar, and does not take the pointer: the click that fires a wave has to reach the
   canvas from anywhere that is not a button. */
.inner {
  position: relative;
  padding: calc(var(--vp-nav-height) + 9vh) 1.875rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.625rem;
  text-align: center;
  pointer-events: none;
  animation: eco-hero-in 900ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
}

@keyframes eco-hero-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

h1 {
  margin: 0;
  font-family: var(--eco-font-display);
  font-feature-settings: 'ss01';
  font-size: clamp(3.5rem, 8.4vw, 7.75rem);
  line-height: 0.94;
  letter-spacing: -0.05em;
  font-weight: 500;
  text-wrap: balance;
  color: #f4f4f7;
}

/* The one line the scene can actually beat: small, mid-grey, and sitting where the wave crest is brightest.
   The shadow is invisible over the resting field and is what keeps it readable over a passing wave. */
.lede {
  margin: 0;
  max-width: 44ch;
  font-size: 1.125rem;
  line-height: 1.5;
  color: var(--eco-ink-muted);
  text-wrap: balance;
  text-shadow: 0 1px 18px rgb(6 8 12 / 0.9);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 0.375rem;
  pointer-events: auto;
}

.btn {
  display: inline-flex;
  align-items: center;
  height: 2.75rem;
  padding: 0 1.375rem;
  border-radius: 9999px;
  font-size: 0.9375rem;
  font-weight: 500;
  text-decoration: none;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s;
}

.btn-brand {
  background: var(--eco-brand-500);
  color: #fff;
  box-shadow: 0 0 0 1px rgb(0 142 252 / 0.4), 0 8px 30px -8px rgb(0 142 252 / 0.6);
}

.btn-brand:hover {
  background: #2aa0ff;
  color: #fff;
}

.btn-ghost {
  border: 1px solid var(--eco-ink-line-strong);
  color: var(--eco-ink-bright);
  background: rgb(6 8 12 / 0.4);
  backdrop-filter: blur(8px);
}

.btn-ghost:hover {
  border-color: rgb(255 255 255 / 0.32);
  color: #fff;
}

.strip {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 1.75rem;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 1.5rem;
  font-family: var(--vp-font-family-mono);
  font-size: 0.78125rem;
  letter-spacing: 0.02em;
  color: var(--eco-ink-faintest);
  pointer-events: none;
}

.tick {
  width: 1px;
  height: 0.75rem;
  background: var(--eco-ink-line-strong);
}

@media (max-width: 960px) {
  .hero {
    min-height: 34rem;
  }

  .inner {
    padding: calc(var(--vp-nav-height) + 7vh) 1.25rem 0;
    gap: 1.25rem;
  }

  .lede {
    font-size: 1.0625rem;
  }
}

/* Narrow enough that the strip would wrap onto two lines and leave the separator dangling on the first.
   The invitation is the half that goes: it says "click" on a device that has no pointer anyway. */
@media (max-width: 34rem) {
  .hint,
  .tick {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .inner {
    animation: none;
  }

  /* The scene holds still, so the invitation to click it would be a lie. */
  .hint,
  .tick {
    display: none;
  }
}
</style>
