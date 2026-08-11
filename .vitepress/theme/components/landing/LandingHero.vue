<script setup lang="ts">
// The hero. Two halves: the pitch, and a `hello.eco` window with the command that ran it under the snippet.
// The backdrop is the site logo drawn very large with each arc pulsing outward in turn — the mark's own
// ripple, animated. It is decorative, so it is aria-hidden and it stops under prefers-reduced-motion.
import CodeWindow from './CodeWindow.vue'
</script>

<template>
  <header class="hero">
    <div class="ripple" aria-hidden="true">
      <svg viewBox="0 0 100 100" fill="none">
        <circle cx="35" cy="50" r="3" fill="var(--eco-brand-500)" opacity="0.55" />
        <path class="wave" d="M 44 34.4 A 18 18 0 0 1 44 65.6" />
        <path class="wave" style="animation-delay: 1.25s" d="M 50 24 A 30 30 0 0 1 50 76" />
        <path class="wave" style="animation-delay: 2.5s" d="M 56 13.6 A 42 42 0 0 1 56 86.4" />
        <path class="wave" style="animation-delay: 3.75s" d="M 62 3 A 54 54 0 0 1 62 97" />
      </svg>
    </div>

    <div class="inner">
      <div class="pitch">
        <h1>Echo goes <span class="brr">brrrrr</span>.</h1>

        <p class="lede">
          Echo is a statically typed, natively compiled language with PHP-flavoured syntax. Variables start
          with <code>$</code>, blocks use braces, <code>echo</code> prints things. Underneath it is much
          closer to Swift, Rust or C++.
        </p>

        <div class="actions">
          <a class="btn btn-brand" href="/guide/installation">Install it</a>
          <a class="btn btn-ghost" href="/guide/tour">Read the tour</a>
        </div>
      </div>

      <div class="window-wrap">
        <div class="glow glow-brand" aria-hidden="true" />
        <div class="glow glow-indigo" aria-hidden="true" />

        <CodeWindow title="hello.eco" tone="brand" dots>
          <pre class="eco-code"><span class="k">struct</span> <span class="t">Point</span>
<span class="p">{</span>
    <span class="k">float64</span> $x<span class="p">;</span>
    <span class="k">float64</span> $y<span class="p">;</span>

    <span class="k">const function</span> <span class="f">len</span><span class="p">()</span> : <span class="k">float64</span>
    <span class="p">{</span>
        <span class="k">return</span> <span class="f">std::math::sqrt</span><span class="p">(</span>$this-&gt;x * $this-&gt;x + $this-&gt;y * $this-&gt;y<span class="p">);</span>
    <span class="p">}</span>
<span class="p">}</span>

<span class="k">echo</span> <span class="t">Point</span><span class="p">(</span><span class="s">3.0</span><span class="p">,</span> <span class="s">4.0</span><span class="p">)</span>-&gt;<span class="f">len</span><span class="p">();</span></pre>

          <template #footer>
            <span class="prompt">$</span>
            <span>echoc run hello.eco</span>
            <span class="result">5.000000</span>
            <span class="caret" aria-hidden="true" />
          </template>
        </CodeWindow>
      </div>
    </div>
  </header>
</template>

<style scoped>
.hero {
  position: relative;
  overflow: hidden;
  padding: 5.75rem 1.875rem 5rem;
}

/* The mark, drawn at 900px and hung off the top right corner. */
.ripple {
  position: absolute;
  top: -300px;
  right: -280px;
  width: 900px;
  height: 900px;
  pointer-events: none;
}

.ripple svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.wave {
  stroke: var(--eco-brand-500);
  stroke-width: 0.6;
  transform-box: view-box;
  transform-origin: 35px 50px;
  animation: eco-wave 5s linear infinite;
}

@keyframes eco-wave {
  0% {
    opacity: 0;
    transform: scale(0.62);
  }

  18% {
    opacity: 0.55;
  }

  100% {
    opacity: 0;
    transform: scale(1.3);
  }
}

.inner {
  position: relative;
  max-width: 1280px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 3.75rem;
  align-items: center;
}

h1 {
  margin: 0;
  font-family: var(--eco-font-display);
  font-feature-settings: 'ss01';
  font-size: clamp(3.375rem, 7vw, 7rem);
  line-height: 0.92;
  letter-spacing: -0.05em;
  font-weight: 400;
  text-wrap: balance;
}

.brr {
  color: var(--eco-brand-500);
}

.lede {
  margin: 1.75rem 0 0;
  max-width: 34ch;
  font-size: 1.25rem;
  line-height: 1.5;
  color: var(--eco-ink-muted);
}

.lede code {
  font-family: var(--vp-font-family-mono);
  font-size: 0.9em;
  color: var(--eco-ink-bright);
  background: none;
  padding: 0;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 2.25rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  padding: 0.875rem 1.5rem;
  border-radius: var(--eco-radius);
  font-size: 0.96875rem;
  text-decoration: none;
  transition: background-color 0.2s, border-color 0.2s;
}

.btn-brand {
  background: var(--eco-brand-500);
  color: #fff;
  font-weight: 600;
}

.btn-brand:hover {
  background: #2ba3ff;
  color: #fff;
}

.btn-ghost {
  border: 1px solid var(--eco-ink-line-strong);
  color: var(--eco-ink-bright);
  font-weight: 500;
}

.btn-ghost:hover {
  border-color: rgb(255 255 255 / 0.42);
  color: var(--eco-ink-bright);
}

.window-wrap {
  position: relative;
}

/* Two blurred washes behind the window, the same pair the old hero used. */
.glow {
  position: absolute;
  border-radius: 9999px;
  filter: blur(40px);
  pointer-events: none;
}

.glow-brand {
  top: -12rem;
  right: -10rem;
  width: 30rem;
  height: 30rem;
  background: radial-gradient(closest-side, rgb(0 142 252 / 0.4), rgb(0 142 252 / 0));
}

.glow-indigo {
  bottom: -9rem;
  right: -7rem;
  width: 30rem;
  height: 30rem;
  background: radial-gradient(closest-side, rgb(129 140 248 / 0.32), rgb(129 140 248 / 0));
}

.window-wrap :deep(.eco-window) {
  position: relative;
  box-shadow: 0 50px 100px -50px rgb(0 142 252 / 0.5);
}

.prompt {
  color: var(--eco-ink-green);
}

.result {
  margin-left: auto;
  color: var(--eco-ink-bright);
}

.caret {
  width: 8px;
  height: 15px;
  background: var(--eco-brand-500);
  animation: eco-blink 1.1s steps(1) infinite;
}

@keyframes eco-blink {
  0%,
  49% {
    opacity: 1;
  }

  50%,
  100% {
    opacity: 0;
  }
}

/* The design is drawn at one desktop width. Below 960 the two halves stack and the mark shrinks with
   them — at 900px it is wider than the phone it would be sitting on. */
@media (max-width: 960px) {
  .hero {
    padding: 3.5rem 1.25rem 3.5rem;
  }

  .inner {
    grid-template-columns: minmax(0, 1fr);
    gap: 2.75rem;
  }

  .ripple {
    top: -180px;
    right: -220px;
    width: 520px;
    height: 520px;
  }

  .lede {
    max-width: 46ch;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wave,
  .caret {
    animation: none;
  }

  .wave {
    opacity: 0.35;
  }
}
</style>
