<script setup lang="ts">
// The six-chapter tour. A sticky rail on the left names the chapters, the articles scroll past on the right,
// and whichever article has crossed 42% of the viewport is the active one — the rail highlights it and the
// other five dim.
//
// The rail is a scroll *indicator*, so below 960px it is not stacked above the content, it is dropped: over
// the top of a single column it would indicate nothing.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import CodeWindow from './CodeWindow.vue'

const chapters = [
  'There is no main',
  'One type, forever',
  'Structs are values',
  'Classes are the other half',
  'Arrays hold one type',
  'Operators are declarations',
]

const active = ref(0)
const steps = ref<HTMLElement[]>([])
/** Set once mounted; until then every step renders undimmed so the prerendered HTML reads as plain prose. */
const spy = ref(false)

function onScroll() {
  const line = window.innerHeight * 0.42
  let best = 0
  steps.value.forEach((el, n) => {
    if (el && el.getBoundingClientRect().top <= line) best = n
  })
  active.value = best
}

onMounted(() => {
  spy.value = true
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <section id="tour" class="tour">
    <div class="intro">
      <p class="eyebrow">the whirlwind version</p>
      <h2>The language in six snippets.</h2>
      <p class="lede">
        Most of this reads like PHP. The parts that do not are the point.
      </p>
    </div>

    <div class="body">
      <nav class="rail" aria-label="Tour chapters">
        <a
          v-for="(chapter, n) in chapters"
          :key="chapter"
          class="chapter"
          :class="{ 'is-active': spy && active === n }"
          :href="`#tour-${n + 1}`"
        >
          <span class="num">{{ String(n + 1).padStart(2, '0') }}</span>
          <span>{{ chapter }}</span>
        </a>
        <a class="onward" href="#memory">→ then the memory model</a>
      </nav>

      <div class="steps">
        <article
          :id="'tour-1'"
          :ref="(el) => { if (el) steps[0] = el as HTMLElement }"
          class="step"
          :class="{ 'is-dim': spy && active !== 0 }"
        >
          <h3>There is no main</h3>
          <p class="says">
            Top-level statements in a file are the program. Declarations can go anywhere, statements run top
            to bottom. That is the whole rule.
          </p>
          <CodeWindow>
            <pre class="eco-code"><span class="k">echo</span> <span class="s">"this runs"</span><span class="p">;</span></pre>
          </CodeWindow>
          <p class="aside">No boilerplate, no imports. A file is a program.</p>
        </article>

        <article
          :id="'tour-2'"
          :ref="(el) => { if (el) steps[1] = el as HTMLElement }"
          class="step"
          :class="{ 'is-dim': spy && active !== 1 }"
        >
          <h3>Variables have one type, forever</h3>
          <p class="says">
            The type is fixed at the declaration, and the compiler knows it before your program runs.
          </p>
          <CodeWindow>
            <pre class="eco-code">$count = <span class="s">3</span><span class="p">;</span>         <span class="c">// int32, inferred</span>
$ratio = <span class="s">0.5</span><span class="p">;</span>       <span class="c">// float64, inferred</span>
<span class="k">string</span> $name = <span class="s">"Echo"</span><span class="p">;</span>

$count = <span class="s">"three"</span><span class="p">;</span>   <span class="x">// error: cannot assign 'string' to 'int32'</span></pre>
          </CodeWindow>
          <p class="aside">
            No dynamic typing, no unions, no <code>mixed</code>. <code>const</code> makes it read-only on top
            of that.
          </p>
        </article>

        <article
          :id="'tour-3'"
          :ref="(el) => { if (el) steps[2] = el as HTMLElement }"
          class="step"
          :class="{ 'is-dim': spy && active !== 2 }"
        >
          <h3>Structs are values</h3>
          <p class="says">
            There is no <code class="bright">new</code>. You call the type. A struct lives where you put it, a
            local lives on the stack, and assigning it copies it.
          </p>
          <CodeWindow>
            <pre class="eco-code"><span class="k">struct</span> <span class="t">Point</span>
<span class="p">{</span>
    <span class="k">float64</span> $x<span class="p">;</span>
    <span class="k">float64</span> $y<span class="p">;</span>
<span class="p">}</span>

$a = <span class="t">Point</span><span class="p">(</span><span class="s">3.0</span><span class="p">,</span> <span class="s">4.0</span><span class="p">);</span>
$b = $a<span class="p">;</span>            <span class="c">// a copy</span>
$b-&gt;x = <span class="s">10.0</span><span class="p">;</span>

<span class="k">echo</span> $a-&gt;x<span class="p">;</span>         <span class="c">// still 3</span></pre>
          </CodeWindow>
          <p class="aside">
            Nothing is allocated and nothing is reference counted. Members are reached with
            <code>-&gt;</code>, always, including your own.
          </p>
        </article>

        <article
          :id="'tour-4'"
          :ref="(el) => { if (el) steps[3] = el as HTMLElement }"
          class="step"
          :class="{ 'is-dim': spy && active !== 3 }"
        >
          <h3>Classes are the other half</h3>
          <p class="says">
            Same declaration syntax, opposite behaviour. A class lives on the heap and is reference counted,
            so assigning one shares it.
          </p>
          <CodeWindow>
            <pre class="eco-code">$a = <span class="t">Account</span><span class="p">(</span><span class="s">"Mario"</span><span class="p">,</span> <span class="s">100</span><span class="p">);</span>
$b = $a<span class="p">;</span>            <span class="c">// NOT a copy. same object, one more owner</span>
$b-&gt;<span class="f">deposit</span><span class="p">(</span><span class="s">50</span><span class="p">);</span>

<span class="k">echo</span> $a-&gt;<span class="f">balance</span><span class="p">();</span> <span class="c">// 150</span></pre>
          </CodeWindow>
          <div class="pair">
            <div class="card">
              <p class="tag brand">STRUCT</p>
              <p class="tag-says">One owner, and a copy.</p>
            </div>
            <div class="card">
              <p class="tag green">CLASS</p>
              <p class="tag-says">Many owners, one shared object.</p>
            </div>
          </div>
          <p class="aside">Pick per type, at the declaration, and every use site follows from it.</p>
        </article>

        <article
          :id="'tour-5'"
          :ref="(el) => { if (el) steps[4] = el as HTMLElement }"
          class="step"
          :class="{ 'is-dim': spy && active !== 4 }"
        >
          <h3>Arrays hold one type</h3>
          <p class="says">
            In PHP an array is a hash map that will take anything. In Echo it is a growable buffer of exactly
            one type, and it is an object, so the operations live on it.
          </p>
          <CodeWindow>
            <pre class="eco-code"><span class="k">array</span><span class="p">&lt;</span><span class="k">int32</span><span class="p">&gt;</span> $numbers = <span class="p">[</span><span class="s">1</span><span class="p">,</span> <span class="s">2</span><span class="p">,</span> <span class="s">3</span><span class="p">];</span>
$numbers<span class="p">[] =</span> <span class="s">4</span><span class="p">;</span>            <span class="c">// append</span>
$numbers-&gt;<span class="f">push</span><span class="p">(</span><span class="s">5</span><span class="p">);</span>         <span class="c">// the same thing, spelled out</span>

<span class="k">foreach</span> <span class="p">(</span><span class="s">0</span> <span class="k">..</span> <span class="s">3</span> <span class="k">as</span> $i<span class="p">) {</span>
    <span class="k">echo</span> $i<span class="p">;</span>                <span class="c">// 0 1 2</span>
<span class="p">}</span></pre>
          </CodeWindow>
          <p class="aside">
            Here is the fun part: <code>..</code> is not syntax. It is an ordinary operator from the standard
            library that returns a <code>range&lt;T&gt;</code>, which brings us to the last one.
          </p>
        </article>

        <article
          :id="'tour-6'"
          :ref="(el) => { if (el) steps[5] = el as HTMLElement }"
          class="step"
          :class="{ 'is-dim': spy && active !== 5 }"
        >
          <h3>Operators are declarations</h3>
          <p class="says">
            You can overload the built-in ones for your own types, and declare entirely new ones with their
            own precedence. Suffix operators are my favourite bit.
          </p>
          <CodeWindow>
            <pre class="eco-code"><span class="k">operator</span> <span class="p">(</span><span class="k">uint64</span> $a<span class="p">)</span><span class="f">mm</span> : <span class="t">Distance</span> <span class="p">{</span> <span class="k">return</span> <span class="t">Distance</span><span class="p">(</span>$a<span class="p">); }</span>
<span class="k">operator</span> <span class="p">(</span><span class="k">uint64</span> $a<span class="p">)</span><span class="f">cm</span> : <span class="t">Distance</span> <span class="p">{</span> <span class="k">return</span> <span class="t">Distance</span><span class="p">(</span>$a * <span class="s">10</span><span class="p">); }</span>
<span class="k">operator</span> <span class="p">(</span><span class="k">uint64</span> $a<span class="p">)</span><span class="f">m</span>  : <span class="t">Distance</span> <span class="p">{</span> <span class="k">return</span> <span class="t">Distance</span><span class="p">(</span>$a * <span class="s">1000</span><span class="p">); }</span>

$distance = <span class="s">1m</span> + <span class="s">50cm</span> + <span class="s">500mm</span><span class="p">;</span>
<span class="k">echo</span> $distance-&gt;millimeters<span class="p">;</span>    <span class="c">// 2000</span></pre>
          </CodeWindow>
          <p class="aside">
            The compiler knows nothing about <code>..</code> or <code>1m</code>. Both are library code you
            could have written.
          </p>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.tour {
  border-top: 1px solid var(--eco-ink-line-soft);
  background: var(--eco-ink-band);
}

.intro {
  max-width: 1180px;
  margin: 0 auto;
  padding: 6rem 1.875rem 2.5rem;
}

h2 {
  margin: 1rem 0 0;
  max-width: 16ch;
  font-family: var(--eco-font-display);
  font-feature-settings: 'ss01';
  font-size: clamp(2.375rem, 4.4vw, 3.875rem);
  line-height: 1;
  letter-spacing: -0.04em;
  font-weight: 400;
}

.lede {
  margin: 1.25rem 0 0;
  max-width: 52ch;
  font-size: 1.125rem;
  line-height: 1.6;
  color: var(--eco-ink-muted);
}

.body {
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 1.875rem 5rem;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 3.75rem;
  align-items: start;
}

.rail {
  position: sticky;
  top: calc(var(--vp-nav-height) + 3.5rem);
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 2.5625rem;
}

.chapter {
  display: flex;
  gap: 0.875rem;
  align-items: baseline;
  padding: 0.6875rem 0.875rem;
  border-radius: var(--eco-radius);
  font-size: 0.96875rem;
  color: var(--eco-ink-dimmer);
  text-decoration: none;
  transition: color 0.25s, background-color 0.25s;
}

.chapter:hover {
  color: var(--eco-ink-bright);
}

.chapter.is-active {
  color: var(--eco-ink-bright);
  background: rgb(0 142 252 / 0.1);
}

.num {
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  opacity: 0.7;
}

.chapter.is-active .num {
  color: var(--eco-brand-500);
  opacity: 1;
}

.onward {
  margin-top: 1.125rem;
  padding: 0.6875rem 0.875rem;
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  color: var(--eco-ink-faintest);
  text-decoration: none;
}

.onward:hover {
  color: var(--eco-brand-400);
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 6rem;
  padding: 2.5rem 0 7.5rem;
}

.step {
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
  transition: opacity 0.35s ease;
  /* An anchor jump must not land the heading under the sticky header. */
  scroll-margin-top: calc(var(--vp-nav-height) + 2rem);
}

.step.is-dim {
  opacity: 0.42;
}

h3 {
  margin: 0;
  font-family: var(--eco-font-display);
  font-feature-settings: 'ss01';
  font-size: 1.875rem;
  letter-spacing: -0.03em;
  font-weight: 400;
}

.says {
  margin: 0;
  max-width: 56ch;
  font-size: 1.09375rem;
  line-height: 1.6;
  color: var(--eco-ink-muted);
}

.aside {
  margin: 0;
  font-size: 0.96875rem;
  line-height: 1.6;
  color: var(--eco-ink-dim);
}

.pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.card {
  border: 1px solid var(--eco-ink-line);
  border-radius: var(--eco-radius);
  padding: 1rem 1.125rem;
  background: var(--eco-ink-surface);
}

.tag {
  margin: 0;
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
}

.tag.brand {
  color: var(--eco-brand-500);
}

.tag.green {
  color: var(--eco-ink-green);
}

.tag-says {
  margin: 0.5rem 0 0;
  font-size: 1rem;
  color: var(--eco-ink-bright);
}

@media (max-width: 960px) {
  .intro {
    padding: 3.5rem 1.25rem 2rem;
  }

  .body {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
    padding: 0 1.25rem 3rem;
  }

  /* The rail indicates a scroll position. Above a single column it would indicate nothing, so it goes. */
  .rail {
    display: none;
  }

  .steps {
    gap: 4rem;
    padding: 0 0 2rem;
  }

  /* Dimming five of six steps only reads as focus next to a rail saying which one is which. */
  .step.is-dim {
    opacity: 1;
  }

  .pair {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
