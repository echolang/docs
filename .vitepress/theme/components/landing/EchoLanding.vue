<script setup lang="ts">
// The landing page. Registered globally in theme/index.ts, because the only thing that renders it is one tag
// in index.md.
//
// The site's own nav bar sits above all of this: the design drew its own header, and keeping VitePress's
// means the front page keeps search, the theme toggle and the GitHub link instead of a second, emptier
// header. The scroll-progress bar the design pinned under its header is pinned under the real one.
//
// The page is dark in both colour modes, which is the rule the sidebar already follows. There is one palette
// here, not a light pair and a dark pair; it lives in the landing section of style.css.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import CodeWindow from './CodeWindow.vue'
import InstallCommand from './InstallCommand.vue'
import LandingHero from './LandingHero.vue'
import LandingRace from './LandingRace.vue'
import LandingTour from './LandingTour.vue'

const progress = ref(0)

function onScroll() {
  const doc = document.documentElement
  const max = doc.scrollHeight - window.innerHeight
  progress.value = max > 0 ? (window.scrollY / max) * 100 : 0
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

const gaps = [
  'holes in the type system',
  'a tiny standard library',
  'the compiler probably has bugs',
]
</script>

<template>
  <div class="eco-landing-root">
    <div class="progress" :style="{ width: `${progress.toFixed(2)}%` }" aria-hidden="true" />

    <LandingHero />
    <LandingRace />

    <!-- The first question everybody asks -->
    <section class="contrast">
      <div class="contrast-inner">
        <div>
          <p class="eyebrow">the first question everybody asks</p>
          <h2>It will not run<br />your PHP.</h2>
          <p class="says">
            Echo borrows PHP's syntax because you can already read it, not because it is trying to be
            compatible with it. It never will be.
          </p>
          <p class="says">
            Paste a PHP file into <code>echoc</code> and you get a wall of diagnostics. That is working as
            intended.
          </p>
        </div>

        <div class="stack">
          <CodeWindow title="legacy.php">
            <pre class="eco-code is-foreign">$things = ['a', 1, null, 3.5];

foreach ($things as $t) {
    echo gettype($t);
}</pre>
          </CodeWindow>

          <p class="arrow">↓&nbsp;&nbsp;echoc build legacy.php</p>

          <div class="errors">
            <p>The function 'gettype' could not be found</p>
            <p>Invalid type conversion: cannot assign 'int32' to 'string'</p>
            <p>cannot assign null to 'string' - add '?' to its type if it may be absent</p>
            <p class="errors-foot">4 errors, nothing was compiled. Three of them are on line one.</p>
          </div>
        </div>
      </div>
    </section>

    <LandingTour />

    <!-- Ownership -->
    <section id="memory" class="memory">
      <div class="memory-inner">
        <p class="eyebrow green">the part you cannot skim</p>
        <h2 class="wide">Every value has exactly one owner.</h2>
        <p class="says wide">
          When the owner goes out of scope, the value is destroyed. You can hand ownership to somebody else,
          and that is called a move. Here is the part I like: the call site has to agree to the
          <code class="bright">mv</code> too.
        </p>

        <div class="pair">
          <CodeWindow title="GIVE IT AWAY" tone="rose">
            <pre class="eco-code"><span class="k">function</span> <span class="f">consume</span><span class="p">(</span><span class="k">mv array</span><span class="p">&lt;</span><span class="k">int32</span><span class="p">&gt;</span> $xs<span class="p">)</span> : <span class="k">int32</span>
<span class="p">{</span>
    <span class="k">return</span> $xs-&gt;<span class="f">count</span><span class="p">();</span>
<span class="p">}</span>

<span class="k">echo</span> <span class="f">consume</span><span class="p">(</span><span class="k">mv</span> $nums<span class="p">);</span>     <span class="c">// 3</span>
<span class="k">echo</span> $nums-&gt;<span class="f">count</span><span class="p">();</span>        <span class="x">// error: '$nums' has been moved out of.</span></pre>
          </CodeWindow>

          <CodeWindow title="JUST LET IT LOOK" tone="green">
            <pre class="eco-code"><span class="k">function</span> <span class="f">total</span><span class="p">(</span><span class="k">const array</span><span class="p">&lt;</span><span class="k">int32</span><span class="p">&gt;&amp;</span> $xs<span class="p">)</span> : <span class="k">int32</span>
<span class="p">{</span>
    <span class="c">// a read-only borrow</span>
<span class="p">}</span>

<span class="k">echo</span> <span class="f">total</span><span class="p">(</span>$nums<span class="p">);</span>          <span class="c">// 6</span>
<span class="k">echo</span> $nums-&gt;<span class="f">count</span><span class="p">();</span>        <span class="c">// 3, still yours</span></pre>
          </CodeWindow>
        </div>

        <p class="says closing">
          A function signature cannot quietly eat something you thought you still had. Every place a value
          stops being yours is spelled out, in your own source.
          <a href="/memory/ownership">How ownership works →</a>
        </p>
      </div>
    </section>

    <!-- Two commands -->
    <section class="commands">
      <div class="commands-inner">
        <h2 class="tight">Run it, or ship it</h2>

        <div class="pair">
          <div class="command is-primary">
            <p class="line"><span class="prompt">$ </span>echoc run hello.eco</p>
            <p class="says">
              Straight to output. The program is built in memory and executed, and your directory looks
              exactly the way it did before. Debug by default, so <code class="bright">assert</code> and the
              runtime checks are still watching you.
            </p>
          </div>

          <div class="command">
            <p class="line"><span class="prompt">$ </span>echoc build -o hello hello.eco</p>
            <p class="says">
              A binary you can hand to somebody. Release by default: the checks come out, the optimizer goes
              in, and there is nothing to install on the far end.
            </p>
          </div>
        </div>

        <p class="more"><a href="/reference/cli-reference">The rest of the command line →</a></p>
      </div>
    </section>

    <!-- Honest -->
    <section id="honest" class="honest">
      <div class="honest-inner">
        <p class="eyebrow muted">let's be honest for a moment</p>
        <h2 class="centred">
          Echo is a hobby. Please do not run your payroll on it.
        </h2>

        <ul class="gaps">
          <li v-for="gap in gaps" :key="gap">{{ gap }}</li>
        </ul>

        <p class="says centred-says">
          None of it is hidden and none of it is a surprise to me. The
          <a href="/reference/limitations">full list of what is missing, broken, or quietly wrong</a> is a
          page of this documentation, and it is the one page I keep most current.
        </p>
      </div>
    </section>

    <!-- Install -->
    <section id="install" class="install">
      <div class="rings" aria-hidden="true">
        <svg viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="12" stroke="var(--eco-brand-500)" stroke-width="0.4" opacity="0.35" />
          <circle cx="50" cy="50" r="24" stroke="var(--eco-brand-500)" stroke-width="0.4" opacity="0.22" />
          <circle cx="50" cy="50" r="36" stroke="var(--eco-brand-500)" stroke-width="0.4" opacity="0.14" />
          <circle cx="50" cy="50" r="48" stroke="var(--eco-brand-500)" stroke-width="0.4" opacity="0.08" />
        </svg>
      </div>

      <div class="install-inner">
        <h2 class="huge">Still here?</h2>
        <p class="says centred-says">
          Then you are exactly the kind of person this is for. One command, one binary, no runtime to install
          afterwards.
        </p>

        <InstallCommand />

        <p class="footnote">
          macOS on Apple Silicon and Linux on x86_64 have prebuilt binaries;
          <a href="/guide/installation">anything else builds from source</a>.
        </p>
      </div>
    </section>

    <footer class="foot">
      <div class="foot-inner">
        <div class="foot-mark">
          <svg viewBox="0 0 100 100" width="18" height="18" fill="none" aria-hidden="true">
            <circle cx="35" cy="50" r="7.5" fill="currentColor" />
            <path d="M 44 34.4 A 18 18 0 0 1 44 65.6" stroke="currentColor" stroke-width="7" stroke-linecap="round" />
            <path d="M 50 24 A 30 30 0 0 1 50 76" stroke="currentColor" stroke-width="7" stroke-linecap="round" opacity="0.62" />
          </svg>
          <span>Echo. Built in ZH mostly at night...</span>
        </div>

        <nav class="foot-links">
          <a href="/guide/what-is-echo">Guide</a>
          <a href="/memory/ownership">Memory</a>
          <a href="/reference/limitations">What is missing</a>
          <a href="https://github.com/echolang/echo" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* Pinned under the real nav bar rather than the design's own. */
.progress {
  position: fixed;
  top: var(--vp-nav-height);
  left: 0;
  height: 2px;
  background: var(--eco-brand-500);
  z-index: 30;
  transition: width 0.05s linear;
}

/* ------------------------------------------------------------- shared bits */

h2 {
  margin: 1rem 0 0;
  font-family: var(--eco-font-display);
  font-feature-settings: 'ss01';
  font-size: clamp(2.375rem, 4.4vw, 3.875rem);
  line-height: 1;
  letter-spacing: -0.04em;
  font-weight: 400;
}

h2.wide {
  max-width: 18ch;
}

h2.tight {
  margin: 0;
  font-size: clamp(2rem, 3.4vw, 2.875rem);
  letter-spacing: -0.035em;
}

h2.centred {
  margin: 1.125rem 0 0;
  font-size: clamp(2.125rem, 3.8vw, 3.375rem);
  line-height: 1.05;
}

h2.huge {
  margin: 0;
  font-size: clamp(2.5rem, 5vw, 4.5rem);
  letter-spacing: -0.045em;
}

.eyebrow {
  margin: 0;
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--eco-brand-500);
}

.eyebrow.green {
  color: var(--eco-ink-green);
}

.eyebrow.muted {
  color: var(--eco-ink-dim);
}

.says {
  margin: 1.375rem 0 0;
  max-width: 44ch;
  font-size: 1.125rem;
  line-height: 1.6;
  color: var(--eco-ink-muted);
}

.says + .says {
  margin-top: 1rem;
}

.says.wide {
  max-width: 58ch;
}

.says.closing {
  max-width: 62rem;
  margin-top: 1.625rem;
  font-size: 1.0625rem;
  color: var(--eco-ink-dim);
}

.centred-says {
  margin-left: auto;
  margin-right: auto;
  max-width: 52ch;
}

.pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  margin-top: 2.75rem;
}

/* ------------------------------------------------------------------ contrast */

.contrast-inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: 6.875rem 1.875rem 6.25rem;
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  gap: 4rem;
  align-items: center;
}

.stack {
  display: grid;
  gap: 0.75rem;
}

.arrow {
  margin: 0;
  text-align: center;
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  color: var(--eco-ink-faintest);
}

.errors {
  border-radius: var(--eco-radius);
  border: 1px solid rgb(255 110 140 / 0.24);
  background: rgb(255 110 140 / 0.05);
  padding: 1.125rem 1.25rem;
  font-family: var(--vp-font-family-mono);
  font-size: 0.84375rem;
  line-height: 2;
  color: var(--eco-ink-rose);
}

.errors p {
  margin: 0;
}

.errors .errors-foot {
  color: var(--eco-ink-dim);
}

/* ------------------------------------------------------------------- memory */

.memory {
  border-top: 1px solid var(--eco-ink-line-soft);
}

.memory-inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: 6.875rem 1.875rem;
}

/* ----------------------------------------------------------------- commands */

.commands {
  border-top: 1px solid var(--eco-ink-line-soft);
  background: var(--eco-ink-band);
}

.commands-inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: 6.25rem 1.875rem;
}

.command {
  border-radius: var(--eco-radius);
  border: 1px solid var(--eco-ink-line);
  background: var(--eco-ink-surface);
  padding: 1.625rem 1.75rem;
}

.command.is-primary {
  border-color: rgb(0 142 252 / 0.28);
  background: linear-gradient(180deg, rgb(0 142 252 / 0.07), rgb(0 142 252 / 0));
}

.command .line {
  margin: 0;
  font-family: var(--vp-font-family-mono);
  font-size: 0.9375rem;
  color: var(--eco-ink-bright);
  overflow-x: auto;
}

.command .says {
  margin-top: 1.125rem;
  max-width: none;
  font-size: 1.0625rem;
}

.prompt {
  color: var(--eco-ink-green);
}

.more {
  margin: 1.75rem 0 0;
  font-size: 0.9375rem;
}

/* ------------------------------------------------------------------- honest */

.honest {
  border-top: 1px solid var(--eco-ink-line-soft);
}

.honest-inner {
  max-width: 900px;
  margin: 0 auto;
  padding: 6.875rem 1.875rem;
  text-align: center;
}

.gaps {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.625rem;
  margin: 2.125rem 0 0;
  padding: 0;
  list-style: none;
}

.gaps li {
  font-family: var(--vp-font-family-mono);
  font-size: 0.8125rem;
  color: var(--eco-ink-dim);
  border: 1px solid var(--eco-ink-line-strong);
  border-radius: 9999px;
  padding: 0.5rem 1rem;
}

.honest .says {
  margin-top: 1.875rem;
}

/* ------------------------------------------------------------------ install */

.install {
  position: relative;
  border-top: 1px solid var(--eco-ink-line-soft);
  background: var(--eco-ink-band);
  overflow: hidden;
}

.rings {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 700px;
  height: 700px;
  margin: -350px 0 0 -350px;
  pointer-events: none;
  opacity: 0.5;
}

.rings svg {
  width: 100%;
  height: 100%;
}

.install-inner {
  position: relative;
  max-width: 900px;
  margin: 0 auto;
  padding: 7.5rem 1.875rem;
  text-align: center;
}

.install .says {
  margin-top: 1.25rem;
  font-size: 1.1875rem;
  line-height: 1.55;
}

.footnote {
  margin: 1.375rem 0 0;
  font-size: 0.9375rem;
  color: var(--eco-ink-dim);
}

/* ------------------------------------------------------------------- footer */

.foot {
  border-top: 1px solid var(--eco-ink-line-soft);
  padding: 2.5rem 1.875rem;
}

.foot-inner {
  max-width: 1180px;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  align-items: center;
  justify-content: space-between;
  font-size: 0.875rem;
  color: var(--eco-ink-dimmer);
}

.foot-mark {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  color: var(--eco-ink-faint);
}

.foot-mark span {
  color: var(--eco-ink-dimmer);
}

.foot-links {
  display: flex;
  flex-wrap: wrap;
  gap: 1.375rem;
}

.foot-links a {
  color: var(--eco-ink-dimmer);
  text-decoration: none;
}

.foot-links a:hover {
  color: var(--eco-ink-bright);
}

/* --------------------------------------------------------------- responsive */

@media (max-width: 960px) {
  .contrast-inner {
    grid-template-columns: minmax(0, 1fr);
    gap: 2.5rem;
    padding: 3.5rem 1.25rem;
  }

  .memory-inner,
  .commands-inner,
  .honest-inner {
    padding: 3.5rem 1.25rem;
  }

  .install-inner {
    padding: 4.5rem 1.25rem;
  }

  .foot {
    padding: 2rem 1.25rem;
  }

  .pair {
    grid-template-columns: minmax(0, 1fr);
    margin-top: 2rem;
  }

  .says,
  h2.wide {
    max-width: none;
  }

  .rings {
    width: 460px;
    height: 460px;
    margin: -230px 0 0 -230px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .progress {
    transition: none;
  }
}
</style>
