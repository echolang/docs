<script setup lang="ts">
// The "and then this" mosaic. Twelve small examples that did not earn a tour chapter but are a large part
// of why the language is nice to write. No scroll-spy: the rail next door is already doing that job, and
// a second one over a two-column grid would indicate nothing.
import CodeWindow from './CodeWindow.vue'
</script>

<template>
  <section id="also" class="also">
    <div class="intro">
      <p class="eyebrow">and then this</p>
      <h2>The syntax.</h2>
      <p class="lede">
        The tour is the bones. These are the things that make a file nice to write.
      </p>
    </div>

    <div class="grid">
      <article class="bit">
        <h3>An array holds one type</h3>
        <p class="says">
          Brackets are how you write one. The type is in the declaration, and it does not change.
        </p>
        <CodeWindow>
          <pre class="eco-code"><span class="k">array</span><span class="p">&lt;</span><span class="k">int32</span><span class="p">&gt;</span> $numbers = <span class="p">[</span><span class="s">1</span><span class="p">,</span> <span class="s">2</span><span class="p">,</span> <span class="s">3</span><span class="p">];</span>
$numbers<span class="p">[]</span> = <span class="s">4</span><span class="p">;</span>

<span class="k">echo</span> $numbers-&gt;<span class="f">count</span><span class="p">();</span>  <span class="c">// 4</span>
<span class="k">echo</span> $numbers<span class="p">[</span><span class="s">0</span><span class="p">];</span>        <span class="c">// 1</span></pre>
        </CodeWindow>
        <p class="aside">
          Methods live on the array: <code>count</code>, <code>push</code>, <code>pop</code>.
          <a href="/collections/arrays">Arrays →</a>
        </p>
      </article>

      <article class="bit">
        <h3>Interpolation is just a string</h3>
        <p class="says">
          Building a string out of values is part of the literal. No format function, no
          <code>append</code>.
        </p>
        <CodeWindow>
          <pre class="eco-code">$name = <span class="s">'Echo'</span><span class="p">;</span>
$year = <span class="s">2026</span><span class="p">;</span>

<span class="k">echo</span> <span class="s">"{$name} is {$year}."</span><span class="p">;</span>   <span class="c">// interpolates</span>
<span class="k">echo</span> <span class="s">'{$name} is not'</span><span class="p">;</span>        <span class="c">// does not</span></pre>
        </CodeWindow>
        <p class="aside">
          Double quotes interpolate. Single quotes leave the braces alone.
          <a href="/collections/strings">Strings →</a>
        </p>
      </article>

      <article class="bit">
        <h3>A closure is a value</h3>
        <p class="says">
          Sometimes the thing you want to pass is another function, and it is not worth naming.
        </p>
        <CodeWindow>
          <pre class="eco-code"><span class="k">function</span><span class="p">&lt;</span><span class="k">int32</span><span class="p">(</span><span class="k">int32</span><span class="p">)&gt;</span> $double = <span class="k">function</span><span class="p">(</span><span class="k">int32</span> $a<span class="p">)</span> : <span class="k">int32</span> <span class="p">{</span>
    <span class="k">return</span> $a * <span class="s">2</span><span class="p">;</span>
<span class="p">};</span>

<span class="k">echo</span> $double<span class="p">(</span><span class="s">21</span><span class="p">);</span>        <span class="c">// 42</span></pre>
        </CodeWindow>
        <p class="aside">
          <code>function&lt;R(P...)&gt;</code> is an ordinary type: a variable, a parameter, a return.
          Capture is by value.
          <a href="/language/closures">Closures →</a>
        </p>
      </article>

      <article class="bit">
        <h3>Tests sit next to the code</h3>
        <p class="says">
          A test is a block you write in the file it is about. Every invocation except
          <code>echoc test</code> drops it before it is parsed.
        </p>
        <CodeWindow>
          <pre class="eco-code"><span class="k">test</span> adds_up
<span class="p">{</span>
    <span class="f">assert</span><span class="p">(</span><span class="s">22</span> + <span class="s">20</span> == <span class="s">42</span><span class="p">);</span>
<span class="p">}</span></pre>
        </CodeWindow>
        <p class="aside">
          No framework, no separate directory, and it cannot end up in a binary by accident.
          <a href="/projects/testing">Testing →</a>
        </p>
      </article>

      <article class="bit">
        <h3>Write it once</h3>
        <p class="says">
          A function that works for every type that makes sense, compiled down to a concrete copy per type
          you actually use. No boxing.
        </p>
        <CodeWindow>
          <pre class="eco-code"><span class="k">function</span> <span class="f">largest</span><span class="p">&lt;</span><span class="t">T</span> : <span class="t">numeric</span><span class="p">&gt;(</span><span class="t">T</span> $a<span class="p">,</span> <span class="t">T</span> $b<span class="p">)</span> : <span class="t">T</span>
<span class="p">{</span>
    <span class="k">if</span> <span class="p">(</span>$a &gt; $b<span class="p">)</span> <span class="p">{</span>
        <span class="k">return</span> $a<span class="p">;</span>
    <span class="p">}</span>
    <span class="k">return</span> $b<span class="p">;</span>
<span class="p">}</span>

<span class="k">echo</span> <span class="f">largest</span><span class="p">(</span><span class="s">3</span><span class="p">,</span> <span class="s">7</span><span class="p">);</span>      <span class="c">// 7</span>
<span class="k">echo</span> <span class="f">largest</span><span class="p">(</span><span class="s">1.5</span><span class="p">,</span> <span class="s">0.5</span><span class="p">);</span>  <span class="c">// 1.500000</span></pre>
        </CodeWindow>
        <p class="aside">
          Echo monomorphizes. <code>largest(3, 7)</code> is two <code>int32</code>s by the time it runs.
          <a href="/language/generics">Generics →</a>
        </p>
      </article>

      <article class="bit">
        <h3>The destination names the type</h3>
        <p class="says">
          Wherever the destination already said <code>result&lt;int32, string&gt;</code>, the leading
          dot fills in the owner.
        </p>
        <CodeWindow>
          <pre class="eco-code"><span class="k">function</span> <span class="f">halve</span><span class="p">(</span><span class="k">int32</span> $n<span class="p">)</span> : <span class="t">result</span><span class="p">&lt;</span><span class="k">int32</span><span class="p">,</span> <span class="k">string</span><span class="p">&gt;</span>
<span class="p">{</span>
    <span class="k">if</span> <span class="p">(</span>$n % <span class="s">2</span> != <span class="s">0</span><span class="p">)</span> <span class="p">{</span>
        <span class="k">return</span> <span class="p">.</span><span class="f">error</span><span class="p">(</span><span class="s">'odd'</span><span class="p">);</span>
    <span class="p">}</span>
    <span class="k">return</span> <span class="p">.</span><span class="f">ok</span><span class="p">(</span>$n / <span class="s">2</span><span class="p">);</span>
<span class="p">}</span>

<span class="k">echo</span> <span class="f">halve</span><span class="p">(</span><span class="s">10</span><span class="p">)-&gt;</span><span class="f">or</span><span class="p">(</span><span class="s">-1</span><span class="p">);</span>    <span class="c">// 5</span></pre>
        </CodeWindow>
        <p class="aside">
          A return type is a destination. So is a declared variable.
          <a href="/stdlib/result">Results →</a>
        </p>
      </article>

      <article class="bit">
        <h3>Same name, different arguments</h3>
        <p class="says">
          Several functions can share a name as long as the parameters differ. Picked at compile time.
        </p>
        <CodeWindow>
          <pre class="eco-code"><span class="k">function</span> <span class="f">describe</span><span class="p">(</span><span class="k">int32</span> $v<span class="p">)</span> : <span class="k">void</span> <span class="p">{</span> <span class="k">echo</span> <span class="s">1</span><span class="p">;</span> <span class="p">}</span>
<span class="k">function</span> <span class="f">describe</span><span class="p">(</span><span class="k">string</span> $v<span class="p">)</span> : <span class="k">void</span> <span class="p">{</span> <span class="k">echo</span> <span class="s">2</span><span class="p">;</span> <span class="p">}</span>

<span class="f">describe</span><span class="p">(</span><span class="s">1</span><span class="p">);</span>             <span class="c">// 1</span>
<span class="f">describe</span><span class="p">(</span><span class="s">"x"</span><span class="p">);</span>           <span class="c">// 2</span></pre>
        </CodeWindow>
        <p class="aside">
          The return type is not part of the signature. Two functions that differ only in what they return
          are a duplicate, not an overload.
          <a href="/language/functions">Functions →</a>
        </p>
      </article>

      <article class="bit">
        <h3>Absence has to be written</h3>
        <p class="says">
          A <code>T?</code> is a value that might not be there. <code>??</code> supplies a fallback.
          <code>?-&gt;</code> reaches through and stops at the first null.
        </p>
        <CodeWindow>
          <pre class="eco-code"><span class="k">class</span> <span class="t">Node</span>
<span class="p">{</span>
    <span class="k">int32</span> $tag<span class="p">;</span>
    <span class="t">Node</span><span class="p">?</span> $next<span class="p">;</span>
<span class="p">}</span>

<span class="k">int32</span><span class="p">?</span> $n = <span class="s">8</span><span class="p">;</span>
<span class="k">echo</span> $n ?? <span class="s">-1</span><span class="p">;</span>                      <span class="c">// 8</span>

<span class="t">Node</span><span class="p">?</span> $head = <span class="k">null</span><span class="p">;</span>
<span class="k">echo</span> $head<span class="p">?-&gt;</span>next<span class="p">?-&gt;</span>tag ?? <span class="s">-1</span><span class="p">;</span>      <span class="c">// -1</span></pre>
        </CodeWindow>
        <p class="aside">
          Neither one unwraps. For that, <code>guard</code>.
          <a href="/memory/nullability">Nullability →</a>
        </p>
      </article>

      <article class="bit">
        <h3><code>..</code> is not syntax</h3>
        <p class="says">
          <code>foreach</code> walks anything that says it can be iterated. A range is one of those, and
          <code>..</code> is an ordinary operator from the standard library.
        </p>
        <CodeWindow>
          <pre class="eco-code"><span class="k">foreach</span> <span class="p">(</span><span class="s">0</span> <span class="k">..</span> <span class="s">3</span> <span class="k">as</span> $i<span class="p">)</span> <span class="p">{</span>
    <span class="k">echo</span> $i<span class="p">;</span>                <span class="c">// 0 1 2</span>
<span class="p">}</span></pre>
        </CodeWindow>
        <p class="aside">
          The compiler knows nothing about <code>0 .. 3</code>. You could have written it.
          <a href="/collections/ranges">Ranges →</a>
        </p>
      </article>

      <article class="bit">
        <h3>A word can be an operator</h3>
        <p class="says">
          You are not limited to the symbols the language ships. A word works, and you pick where it sits
          in the precedence table.
        </p>
        <CodeWindow>
          <pre class="eco-code"><span class="k">operator</span> <span class="p">(</span><span class="k">float64</span> $a<span class="p">)</span> <span class="f">avg</span> <span class="p">(</span><span class="k">float64</span> $b<span class="p">)</span> : <span class="k">float64</span>
<span class="p">{</span>
    <span class="k">return</span> <span class="p">(</span>$a + $b<span class="p">)</span> / <span class="s">2.0</span><span class="p">;</span>
<span class="p">}</span>

<span class="k">echo</span> <span class="s">10.0</span> <span class="f">avg</span> <span class="s">20.0</span><span class="p">;</span>         <span class="c">// 15.000000</span></pre>
        </CodeWindow>
        <p class="aside">
          Declaring <code>avg</code> as an operator does not stop you declaring a function called
          <code>avg</code>. They live in different worlds.
          <a href="/language/operators">Operators →</a>
        </p>
      </article>

      <article class="bit">
        <h3>const if happens first</h3>
        <p class="says">
          A normal <code>if</code> runs at runtime. <code>const if</code> happens before that: the compiler
          picks an arm and the other one never becomes part of the program.
        </p>
        <CodeWindow>
          <pre class="eco-code"><span class="k">function</span> <span class="f">describe</span><span class="p">&lt;</span><span class="t">T</span><span class="p">&gt;()</span> : <span class="k">void</span>
<span class="p">{</span>
    <span class="k">const if</span> <span class="p">(</span><span class="t">mem</span><span class="p">::</span><span class="f">needs_destruction</span><span class="p">&lt;</span><span class="t">T</span><span class="p">&gt;())</span> <span class="p">{</span>
        <span class="k">echo</span> <span class="s">"owns something"</span><span class="p">;</span>
    <span class="p">}</span> <span class="k">else</span> <span class="p">{</span>
        <span class="k">echo</span> <span class="s">"plain data"</span><span class="p">;</span>
    <span class="p">}</span>
<span class="p">}</span>

<span class="f">describe</span><span class="p">&lt;</span><span class="k">int32</span><span class="p">&gt;();</span>          <span class="c">// plain data</span></pre>
        </CodeWindow>
        <p class="aside">
          The losing arm is discarded before type checking, so it may contain code that would not even
          compile for the current type.
          <a href="/language/control-flow">Control flow →</a>
        </p>
      </article>

      <article class="bit">
        <h3>dprint dumps the shape</h3>
        <p class="says">
          When you just want to see a value, <code>dprint</code> dumps it with its shape and its types. No
          <code>-g</code>.
        </p>
        <CodeWindow>
          <pre class="eco-code"><span class="k">struct</span> <span class="t">Point</span>
<span class="p">{</span>
    <span class="k">float64</span> $x<span class="p">;</span>
    <span class="k">float64</span> $y<span class="p">;</span>
<span class="p">}</span>

<span class="f">dprint</span><span class="p">(</span><span class="t">Point</span><span class="p">(</span><span class="s">3.0</span><span class="p">,</span> <span class="s">4.0</span><span class="p">));</span>
<span class="c">// [Point] { $x = 3, $y = 4 }</span></pre>
        </CodeWindow>
        <p class="aside">
          It is a compile-time expansion rather than a runtime walk, so a static value costs nothing.
          <a href="/projects/debugging">Debugging →</a>
        </p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.also {
  border-top: 1px solid var(--eco-ink-line-soft);
  scroll-margin-top: var(--vp-nav-height);
}

.intro {
  max-width: 1180px;
  margin: 0 auto;
  padding: 6rem 1.875rem 2.5rem;
}

.eyebrow {
  margin: 0;
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--eco-brand-500);
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

.grid {
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 1.875rem 6.25rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3.5rem 1.75rem;
}

.bit {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

h3 {
  margin: 0;
  font-family: var(--eco-font-display);
  font-feature-settings: 'ss01';
  font-size: 1.375rem;
  letter-spacing: -0.03em;
  font-weight: 400;
}

.says {
  margin: 0;
  font-size: 1.03125rem;
  line-height: 1.6;
  color: var(--eco-ink-muted);
}

.aside {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--eco-ink-dim);
}

@media (max-width: 960px) {
  .intro {
    padding: 3.5rem 1.25rem 2rem;
  }

  .grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 3rem;
    padding: 0 1.25rem 3.5rem;
  }
}
</style>
