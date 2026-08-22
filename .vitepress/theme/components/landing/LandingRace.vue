<script setup lang="ts">
// The race strip. Two lanes: Echo laps its track every LAP_ECO_MS and pops a running count each time it
// comes round, PHP crawls a single lap of LAP_PHP_MS. When PHP finally arrives both counters settle — PHP on
// one, Echo on LAP_PHP_MS / LAP_ECO_MS — the strip holds that for HOLD_MS and starts over.
//
// The two durations are the ratio the strip exists to show, so they are stated here and nowhere else.
//
// Positions are written onto the nodes as `transform`, not through Vue as `left` / `width`. Layout
// properties snap to device pixels, and PHP's crawl is a few pixels a second, so a `left` update was a
// visible hitch every quarter-second. A transform composites at subpixel and does not wait on a render.
import { onBeforeUnmount, onMounted, ref } from 'vue'

const LAP_ECO_MS = 3000
const LAP_PHP_MS = 210000
/** How long the settled state is held before the lanes reset. */
const HOLD_MS = 2000
/** How long a counter stays scaled up after it ticks. */
const POP_MS = 120
/** The dot is 22px wide, so its travel is the track minus its own width. */
const DOT_PX = 22

const TOTAL_LAPS = Math.floor(LAP_PHP_MS / LAP_ECO_MS)

const strip = ref<HTMLElement>()
const ecoDot = ref<HTMLElement>()
const phpDot = ref<HTMLElement>()
const ecoTrail = ref<HTMLElement>()
const phpTrail = ref<HTMLElement>()

const ecoLabel = ref('ready')
const phpLabel = ref('ready')
const ecoLit = ref(false)
const phpLit = ref(false)
const ecoPop = ref(false)
const phpPop = ref(false)

let frame = 0
let observer: IntersectionObserver | undefined
let ecoPopTimer: ReturnType<typeof setTimeout> | undefined
let phpPopTimer: ReturnType<typeof setTimeout> | undefined
let restartTimer: ReturnType<typeof setTimeout> | undefined
let wakeTimer: ReturnType<typeof setTimeout> | undefined

let started: number | null = null
let lastLap = 0
let visible = false

function popEco(text: string) {
  ecoLabel.value = text
  ecoLit.value = true
  ecoPop.value = true
  clearTimeout(ecoPopTimer)
  ecoPopTimer = setTimeout(() => (ecoPop.value = false), POP_MS)
}

function popPhp(text: string) {
  phpLabel.value = text
  phpLit.value = true
  phpPop.value = true
  clearTimeout(phpPopTimer)
  phpPopTimer = setTimeout(() => (phpPop.value = false), POP_MS)
}

function place(dot: HTMLElement | undefined, trail: HTMLElement | undefined, at: number) {
  if (!dot || !trail) return
  const travel = Math.max(0, (dot.parentElement?.clientWidth ?? 0) - DOT_PX)
  dot.style.transform = `translate3d(${at * travel}px, 0, 0)`
  trail.style.transform = `scaleX(${at})`
}

function placeEco(at: number) {
  place(ecoDot.value, ecoTrail.value, at)
}

function placePhp(at: number) {
  place(phpDot.value, phpTrail.value, at)
}

function reset() {
  started = null
  lastLap = 0
}

function tick(now: number) {
  frame = requestAnimationFrame(tick)
  if (!visible) return

  if (started === null) {
    started = now
    placeEco(0)
    placePhp(0)
    ecoLabel.value = 'ready'
    phpLabel.value = 'ready'
    ecoLit.value = false
    phpLit.value = false
  }

  const elapsed = now - started

  // PHP arrives. Both counters settle, the strip holds, then it all starts again.
  if (elapsed >= LAP_PHP_MS) {
    placePhp(1)
    placeEco(1)
    popPhp('done 1x')
    popEco(`done ${TOTAL_LAPS}x`)
    visible = false
    restartTimer = setTimeout(reset, HOLD_MS)
    wakeTimer = setTimeout(() => (visible = true), HOLD_MS)
    return
  }

  placePhp(elapsed / LAP_PHP_MS)

  const laps = Math.floor(elapsed / LAP_ECO_MS)
  placeEco((elapsed % LAP_ECO_MS) / LAP_ECO_MS)
  if (laps > lastLap) {
    lastLap = laps
    popEco(`done ${laps}x`)
  }
}

/** The settled state, with nothing moving — what reduced motion gets instead of the loop. */
function settle() {
  placeEco(1)
  placePhp(1)
  ecoLabel.value = `done ${TOTAL_LAPS}x`
  phpLabel.value = 'done 1x'
  ecoLit.value = true
  phpLit.value = true
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    settle()
    return
  }

  // A loop nobody can see is a loop worth not running — and the lanes restart from zero on re-entry, so
  // scrolling back to the strip replays it rather than catching it mid-crawl.
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        visible = entry.isIntersecting
        if (visible) reset()
      }
    },
    { threshold: 0.3 },
  )
  if (strip.value) observer.observe(strip.value)

  frame = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  if (frame) cancelAnimationFrame(frame)
  observer?.disconnect()
  clearTimeout(ecoPopTimer)
  clearTimeout(phpPopTimer)
  clearTimeout(restartTimer)
  clearTimeout(wakeTimer)
})
</script>

<template>
  <div class="band">
    <div ref="strip" class="strip">
      <div class="who is-eco">Echo</div>
      <div class="track">
        <div ref="ecoTrail" class="trail is-eco" />
        <div ref="ecoDot" class="dot is-eco">
          <span class="pulse" aria-hidden="true" />
          <span class="core" />
        </div>
      </div>
      <div class="count is-eco" :class="{ 'is-lit': ecoLit, 'is-pop': ecoPop }">{{ ecoLabel }}</div>

      <div class="who">PHP</div>
      <div class="track">
        <div ref="phpTrail" class="trail" />
        <div ref="phpDot" class="dot">
          <span class="core" />
        </div>
      </div>
      <div class="count" :class="{ 'is-lit': phpLit, 'is-pop': phpPop }">{{ phpLabel }}</div>

      <p class="caption">
        Echo goes through LLVM and comes out a real executable. Nothing to boot, no bytecode to warm up, no
        runtime to ship alongside it.
      </p>
    </div>
  </div>
</template>

<style scoped>
.band {
  border-top: 1px solid var(--eco-ink-line-soft);
  border-bottom: 1px solid var(--eco-ink-line-soft);
  background: var(--eco-ink-band);
  padding: 2.125rem 1.875rem 1.875rem;
}

.strip {
  max-width: 1180px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr) 130px;
  gap: 1.375rem;
  align-items: center;
  font-family: var(--vp-font-family-mono);
  font-size: 0.78125rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.who {
  color: var(--eco-ink-dimmer);
}

.who.is-eco {
  color: var(--eco-ink-bright);
}

.track {
  --dot: 22px;
  position: relative;
  height: 22px;
  border-bottom: 1px dashed rgb(255 255 255 / 0.09);
}

.trail {
  position: absolute;
  left: 0;
  bottom: -1px;
  width: calc(100% - var(--dot));
  height: 2px;
  border-radius: 2px;
  background: rgb(255 255 255 / 0.12);
  transform: scaleX(0);
  transform-origin: left center;
  will-change: transform;
}

.trail.is-eco {
  background: linear-gradient(90deg, rgb(0 142 252 / 0), var(--eco-brand-500));
}

.dot {
  position: absolute;
  left: 0;
  bottom: -11px;
  width: var(--dot);
  height: var(--dot);
  will-change: transform;
}

.core {
  position: absolute;
  left: 6px;
  top: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--eco-ink-faint);
}

.dot.is-eco .core {
  background: var(--eco-brand-500);
  box-shadow: 0 0 18px var(--eco-brand-500);
}

.pulse {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid var(--eco-brand-500);
  animation: eco-ripple 1.1s ease-out infinite;
}

@keyframes eco-ripple {
  0% {
    transform: scale(0.7);
    opacity: 0.55;
  }

  100% {
    transform: scale(2.2);
    opacity: 0;
  }
}

/* The counter. It scales up for a moment each time it ticks, which is what makes Echo's lap rate legible
   without reading the number. */
.count {
  text-align: right;
  color: var(--eco-ink-faint);
  transform: scale(1);
  transition: transform 0.12s ease, color 0.12s ease;
}

.count.is-lit {
  color: var(--eco-ink-dimmer);
}

.count.is-eco.is-lit {
  color: var(--eco-brand-500);
}

.count.is-pop {
  transform: scale(1.3);
}

.caption {
  grid-column: 1 / -1;
  margin: 0.375rem 0 0;
  color: var(--eco-ink-dimmer);
  letter-spacing: 0.02em;
  text-transform: none;
  font-family: var(--vp-font-family-base);
  font-size: 0.9375rem;
  line-height: 1.6;
}

/* The lane label column is 210px because the design put it there; on a phone the label goes above its own
   track and the counter tucks in beside it. */
@media (max-width: 720px) {
  .band {
    padding: 1.75rem 1.25rem 1.5rem;
  }

  .strip {
    grid-template-columns: minmax(0, 1fr) 6.5rem;
    column-gap: 0.75rem;
    row-gap: 0.5rem;
  }

  .who {
    grid-column: 1 / -1;
    margin-top: 0.5rem;
  }

  .track {
    grid-column: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pulse {
    animation: none;
    opacity: 0.4;
  }

  .count {
    transition: none;
  }

  .dot,
  .trail {
    will-change: auto;
  }
}
</style>
