// The hero backdrop: the site's mark, exploded into three dimensions.
//
// An emitter sits on a field of pins and fires a shockwave outward. Each wave lifts and lights the pins it
// passes, and rides out on a thin 120° arc — the same arc the logo draws, which is where the whole thing
// comes from. Clicking the hero fires another one.
//
// This is a module rather than part of LandingHero.vue because it is imperative WebGL and the component is
// layout and copy. It is also loaded dynamically, so three.js stays out of the SSR bundle and out of the
// initial chunk: the landing page renders and is readable before any of this arrives.

export interface ShockwaveOptions {
  /** Hex the pins, rings, emitter and its bloom are tinted with. */
  accent?: string
  /** Multiplier on scene time. */
  speed?: number
  /** Fire a wave every few seconds on its own. Always off under reduced motion. */
  autoFire?: boolean
  /** Let the pointer nudge the camera. Always off under reduced motion. */
  parallax?: boolean
}

export interface ShockwaveHandle {
  /** Fire a wave from the emitter. */
  fire(): void
  /** Tear down the renderer, the listeners and every GPU resource. */
  destroy(): void
}

/** Colour of the page behind the canvas, so the far edge of the grid dissolves into it rather than ending. */
const GROUND = 0x06080c

/** Pin colour where no wave is passing. Just above the ground, so the field reads as a surface. */
const PIN_BASE = 0x0b0d11

/** Colour the tallest pins blow out to at the crest of a wave. */
const PIN_HOT = 0xdff2ff

const COLS = 92
const ROWS = 52
const STEP = 0.4

/** Wave speed, in world units per second. */
const V = 5.2

/** Width of the gaussian each wave lifts the pins with. */
const W = 1.1

/** How long a wave stays alive, in seconds. Past this it has left the grid and is fully faded. */
const LIFE = 6

/** Seconds between automatic waves. */
const INTERVAL = 2.6

/** Concurrent waves. There is one ring mesh per slot, so this is also the ring count. */
const MAX_PULSES = 12

/**
 * Age of the wave drawn in the still frame shown under `prefers-reduced-motion`. Chosen so the wave is
 * halfway across the grid: far enough out to read as a shockwave, near enough that the pins are still lit.
 */
const FROZEN_AGE = 1.35

export async function mountShockwave(
  el: HTMLElement,
  opts: ShockwaveOptions = {},
): Promise<ShockwaveHandle | null> {
  const THREE = await import('three')

  const accentHex = opts.accent ?? '#008efc'
  const speed = opts.speed ?? 1
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const autoFire = (opts.autoFire ?? true) && !reduce
  const parallax = (opts.parallax ?? true) && !reduce

  // A machine with no WebGL context still gets the page; it just gets it without the backdrop.
  let renderer: import('three').WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  } catch {
    return null
  }

  const accent = new THREE.Color(accentHex)

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(el.clientWidth || 1, el.clientHeight || 1)
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
  el.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(GROUND, 0.045)

  const camera = new THREE.PerspectiveCamera(38, (el.clientWidth || 1) / (el.clientHeight || 1), 0.1, 120)
  const world = new THREE.Group()
  scene.add(world)

  // The composition is drawn for a wide window: the camera stands off to one side so the emitter sits left
  // of the copy. On a phone that same offset walks the emitter clean off the edge, and a 38° vertical FOV
  // over a tall aspect leaves almost no horizontal view. So both are a function of the aspect — the shot
  // recentres and opens up as the window narrows.
  let shot = { offset: 3.5, fov: 38 }

  function frameCamera(aspect: number) {
    const wide = Math.min(1, Math.max(0, (aspect - 0.7) / 0.9))
    shot = { offset: 3.5 * wide, fov: 38 + (1 - wide) * 16 }
    camera.aspect = aspect
    camera.fov = shot.fov
    camera.updateProjectionMatrix()
  }

  frameCamera((el.clientWidth || 1) / (el.clientHeight || 1))

  // ---------------------------------------------------------------- the field

  const X0 = -COLS * STEP * 0.42
  const Z0 = (-ROWS * STEP) / 2
  const N = COLS * ROWS

  const pinGeo = new THREE.BoxGeometry(0.12, 1, 0.12)
  pinGeo.translate(0, 0.5, 0) // grow upward from the floor rather than from the middle
  const pinMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.4, roughness: 0.5 })
  const pins = new THREE.InstancedMesh(pinGeo, pinMat, N)
  pins.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

  const px = new Float32Array(N) // x, fixed
  const pz = new Float32Array(N) // z, fixed
  const pr = new Float32Array(N) // distance from the emitter, which is what a wave front is compared against
  const pw = new Float32Array(N) // how much this pin responds at all
  const ph = new Float32Array(N) // phase of its idle bob, so the field is not one breathing sheet

  // The field fades out behind the camera and to the sides: the wave is only worth drawing where it is
  // being looked at, and a full rectangle of lit pins reads as a floor rather than as a ripple.
  const angMask = (a: number) => {
    const d = Math.abs(a)
    return d < 1.05 ? 1 : Math.max(0, 1 - (d - 1.05) / 0.9)
  }

  for (let i = 0, r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++, i++) {
      px[i] = X0 + c * STEP
      pz[i] = Z0 + r * STEP
      pr[i] = Math.hypot(px[i], pz[i])
      pw[i] = angMask(Math.atan2(pz[i], px[i])) * Math.exp(-pr[i] * 0.075)
      ph[i] = Math.random() * Math.PI * 2
      pins.setColorAt(i, new THREE.Color(PIN_BASE))
    }
  }
  world.add(pins)

  // --------------------------------------------------------------- the emitter

  const emitMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: accent,
    emissiveIntensity: 1,
    roughness: 0.4,
    toneMapped: false,
  })
  const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.28, 48, 48), emitMat)
  emitter.position.y = 0.9
  world.add(emitter)

  // A soft radial falloff, painted once into a canvas and reused by every bloom sprite.
  const cv = document.createElement('canvas')
  cv.width = cv.height = 256
  const cx = cv.getContext('2d')!
  const grd = cx.createRadialGradient(128, 128, 0, 128, 128, 128)
  const stops: [number, number][] = [[0, 1], [0.1, 0.72], [0.25, 0.36], [0.45, 0.14], [0.7, 0.04], [1, 0]]
  stops.forEach(([p, a]) => grd.addColorStop(p, `rgba(255,255,255,${a})`))
  cx.fillStyle = grd
  cx.fillRect(0, 0, 256, 256)
  const haloTex = new THREE.CanvasTexture(cv)

  // Four nested sprites rather than a post-processing bloom pass: the glow is only ever around one small
  // object, and this costs four quads instead of a second render target.
  const bloom = ([[1.6, 0.95], [4, 0.45], [9, 0.22], [16, 0.1]] as [number, number][]).map(([sc, op]) => {
    const m = new THREE.SpriteMaterial({
      map: haloTex,
      color: accent,
      transparent: true,
      opacity: op,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    })
    const s = new THREE.Sprite(m)
    s.scale.setScalar(sc)
    s.position.copy(emitter.position)
    world.add(s)
    return { sc, op, m, s }
  })

  const light = new THREE.PointLight(accent, 60, 30, 2)
  light.position.set(0, 2.2, 0)
  world.add(light)

  const key = new THREE.DirectionalLight(0xffffff, 0.9)
  key.position.set(-6, 10, 4)
  scene.add(key)

  const ambient = new THREE.AmbientLight(0x223044, 0.6)
  scene.add(ambient)

  // ----------------------------------------------------------------- the rings

  // One 120° arc per wave — the logo's own stroke, laid flat and flying outward.
  const ringGeo = new THREE.TorusGeometry(1, 0.03, 8, 220, (Math.PI * 2) / 3)
  const rings = Array.from({ length: MAX_PULSES }, () => {
    const m = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
    const g = new THREE.Group()
    g.rotation.x = -Math.PI / 2
    g.position.y = 0.06
    const inner = new THREE.Group()
    inner.rotation.z = -Math.PI / 3 // centre the arc on the camera rather than letting it start at 0°
    g.add(inner)
    inner.add(new THREE.Mesh(ringGeo, m))
    world.add(g)
    return { g, m }
  })

  // ------------------------------------------------------------------ the loop

  const clock = new THREE.Clock()
  let pulses: number[] = []
  let lastFire = 0
  let raf = 0
  let running = false
  let dead = false

  const target = { x: 0, y: 0 }
  const cur = { x: 0, y: 0 }

  const colorArr = pins.instanceColor!.array as Float32Array
  const matrixArr = pins.instanceMatrix.array as Float32Array
  const hot = new THREE.Color(PIN_HOT)
  const base = new THREE.Color(PIN_BASE)

  /**
   * Draw one frame at scene time `t`. Pulled out of the loop so the reduced-motion path can render a single
   * still frame and stop, rather than running a rAF that produces the same pixels forever.
   */
  function renderFrame(t: number, live: number[], flashFrom: number, ambientOn: boolean) {
    const fronts = live.map(p => V * (t - p))

    for (let i = 0; i < N; i++) {
      const r = pr[i]
      let h = 0
      for (let j = 0; j < fronts.length; j++) {
        const d = r - fronts[j]
        if (d > -3 && d < 3) h += Math.exp(-(d * d) / W)
      }
      h *= pw[i]

      const y = 0.05 + h * 2.4 + (ambientOn ? 0.07 * Math.sin(t * 0.8 + ph[i]) : 0)

      // Write scale-y and the (fixed) position straight into the instance matrix. Going through an
      // Object3D and updateMatrix() for 4784 pins every frame is most of the frame budget.
      const o = i * 16
      matrixArr[o] = 1
      matrixArr[o + 5] = y
      matrixArr[o + 10] = 1
      matrixArr[o + 12] = px[i]
      matrixArr[o + 14] = pz[i]
      matrixArr[o + 15] = 1

      // Two ramps: base → accent as the pin rises, then accent → near-white only at the very crest.
      const k = Math.min(1, h * 1.35)
      const k1 = Math.min(1, k * 1.6)
      const k2 = Math.max(0, k - 0.6) * 1.6
      let cr = base.r + (accent.r - base.r) * k1
      let cg = base.g + (accent.g - base.g) * k1
      let cb = base.b + (accent.b - base.b) * k1
      cr += (hot.r - cr) * k2
      cg += (hot.g - cg) * k2
      cb += (hot.b - cb) * k2

      const co = i * 3
      colorArr[co] = cr
      colorArr[co + 1] = cg
      colorArr[co + 2] = cb
    }
    pins.instanceMatrix.needsUpdate = true
    pins.instanceColor!.needsUpdate = true

    // Newest wave on the first ring, so a ring is never reassigned to an older wave mid-flight.
    rings.forEach((rg, i) => {
      const p = live[live.length - 1 - i]
      if (p === undefined) {
        rg.m.opacity = 0
        return
      }
      const age = t - p
      const R = Math.max(0.05, V * age)
      rg.g.scale.set(R, R, 1)
      rg.m.opacity = Math.max(0, 0.9 - age * 0.32)
    })

    const flash = Math.exp(-(t - flashFrom) * 3.2)
    emitter.scale.setScalar(1 + 0.9 * flash)
    emitMat.emissiveIntensity = 0.8 + 0.6 * flash
    bloom.forEach(b => {
      b.m.opacity = b.op * (0.7 + 0.9 * flash)
      b.s.scale.setScalar(b.sc * (0.9 + 0.5 * flash))
    })
    light.intensity = 40 + 140 * flash

    // Slow orbit, plus whatever the pointer has dragged the camera towards.
    cur.x += ((parallax ? target.x : 0) - cur.x) * 0.03
    cur.y += ((parallax ? target.y : 0) - cur.y) * 0.03
    const a = -0.55 + (ambientOn ? Math.sin(t * 0.11) * 0.22 : 0) + cur.x * 0.18
    const dist = 17.5
    camera.position.set(Math.sin(a) * dist + shot.offset, 5.4 - cur.y * 0.8, Math.cos(a) * dist)
    camera.lookAt(shot.offset * 0.91, 0.2, 0)

    renderer.render(scene, camera)
  }

  /** The still frame: one wave frozen partway across the field, nothing in motion. */
  function renderStill() {
    renderFrame(FROZEN_AGE, [0], -0.6, false)
  }

  function tick() {
    if (dead) return
    const t = clock.getElapsedTime() * speed

    if (autoFire && t - lastFire > INTERVAL) {
      pulses.push(t)
      lastFire = t
    }
    pulses = pulses.filter(p => t - p < LIFE).slice(-MAX_PULSES)

    // Under reduced motion nothing fires on its own, so once the clicked wave has left the grid there is
    // nothing left to animate. Settle back to the still frame and stop burning frames.
    if (reduce && pulses.length === 0) {
      running = false
      renderStill()
      return
    }

    renderFrame(t, pulses, lastFire, !reduce)
    raf = requestAnimationFrame(tick)
  }

  function start() {
    if (running || dead) return
    running = true
    raf = requestAnimationFrame(tick)
  }

  // ---------------------------------------------------------------- the inputs

  const onMove = (e: PointerEvent) => {
    target.x = (e.clientX / window.innerWidth - 0.5) * 2
    target.y = (e.clientY / window.innerHeight - 0.5) * 2
  }
  if (parallax) window.addEventListener('pointermove', onMove, { passive: true })

  const ro = new ResizeObserver(() => {
    const w = el.clientWidth || 1
    const h = el.clientHeight || 1
    renderer.setSize(w, h)
    frameCamera(w / h)
    if (!running) renderStill() // a frozen scene still has to survive being resized
  })
  ro.observe(el)

  if (reduce) {
    renderStill()
  } else {
    pulses = [0.4]
    lastFire = 0.4
    start()
  }

  return {
    fire() {
      if (dead) return
      const t = clock.getElapsedTime() * speed
      pulses.push(t)
      if (pulses.length > MAX_PULSES) pulses.shift()
      lastFire = t
      start() // reduced motion parks the loop between clicks
    },

    destroy() {
      dead = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)

      pinGeo.dispose()
      pinMat.dispose()
      ringGeo.dispose()
      emitter.geometry.dispose()
      emitMat.dispose()
      haloTex.dispose()
      rings.forEach(r => r.m.dispose())
      bloom.forEach(b => b.m.dispose())
      renderer.domElement.remove()
      renderer.dispose()
    },
  }
}
