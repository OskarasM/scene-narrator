// Benchmark harness for the scene-narrator spike.
//
// The question this answers: how much does a naive one-to-one DOM mirror of a moving
// 3D scene cost, and at what object count does it stop being viable.
//
// Method note that matters more than anything else here. The scene renders through a
// single InstancedMesh, so the *rendering* cost is flat regardless of N. The N "objects"
// are plain JavaScript records that the accessibility arms mirror. Any frame time
// difference between arms is therefore attributable to the accessibility work and not to
// draw calls. If we used N separate Mesh objects, 5000 draw calls would drown the signal
// we are looking for.

import * as THREE from 'three'

// --- deterministic inputs -------------------------------------------------------------

// mulberry32. Small, seeded, good enough for reproducible object placement.
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const params = new URLSearchParams(location.search)
const ARM = (params.get('arm') || 'A').toUpperCase()
const N = Number(params.get('n') || 100)
const SEED = Number(params.get('seed') || 42)
const DURATION_MS = Number(params.get('duration') || 10000)
const WARMUP_MS = Number(params.get('warmup') || 1000)

// Motion advances by a fixed step rather than by real elapsed time, so the objects follow
// the same path whether the page runs at 60fps or 6fps. Only the cost varies between runs,
// never the work being described.
const FIXED_DT = 1 / 60

// --- scene ----------------------------------------------------------------------------

const canvas = document.getElementById('scene')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
renderer.setPixelRatio(1)
renderer.setSize(window.innerWidth, window.innerHeight, false)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500)
camera.position.set(0, 0, 60)

scene.add(new THREE.AmbientLight(0xffffff, 0.6))
const key = new THREE.DirectionalLight(0xffffff, 0.8)
key.position.set(1, 2, 3)
scene.add(key)

const instanced = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshLambertMaterial({ color: 0x6699ff }),
  N,
)
instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
scene.add(instanced)

const BOUNDS = 40
const rand = mulberry32(SEED)
const objects = new Array(N)
for (let i = 0; i < N; i++) {
  objects[i] = {
    id: i,
    label: 'Object ' + i,
    x: (rand() * 2 - 1) * BOUNDS,
    y: (rand() * 2 - 1) * BOUNDS * 0.6,
    z: (rand() * 2 - 1) * BOUNDS,
    vx: (rand() * 2 - 1) * 6,
    vy: (rand() * 2 - 1) * 6,
    vz: (rand() * 2 - 1) * 6,
  }
}

const dummy = new THREE.Object3D()

function stepMotion() {
  for (let i = 0; i < N; i++) {
    const o = objects[i]
    o.x += o.vx * FIXED_DT
    o.y += o.vy * FIXED_DT
    o.z += o.vz * FIXED_DT
    // Bounce, so objects stay in frame and the motion never settles.
    if (o.x > BOUNDS || o.x < -BOUNDS) o.vx = -o.vx
    if (o.y > BOUNDS * 0.6 || o.y < -BOUNDS * 0.6) o.vy = -o.vy
    if (o.z > BOUNDS || o.z < -BOUNDS) o.vz = -o.vz
    dummy.position.set(o.x, o.y, o.z)
    dummy.updateMatrix()
    instanced.setMatrixAt(i, dummy.matrix)
  }
  instanced.instanceMatrix.needsUpdate = true
}

// --- accessibility arms ---------------------------------------------------------------
//
// A  baseline, canvas only, no accessibility layer at all
// B  naive one-to-one mirror in a sibling div, text rewritten every frame
// C  arm B plus an aria-label rewritten every frame
// D  arm B, but mounted inside the <canvas> element as fallback content
//
// Arm D is the interesting one. Canvas fallback content is the mechanism the HTML spec
// actually provides for describing a canvas, and it is what the html-in-canvas proposal
// builds on, but nobody has published what it costs when it moves.

let nodes = null

function buildMirror(mountId) {
  const mount = document.getElementById(mountId)
  const list = document.createElement('ul')
  list.className = 'sr-only'
  list.setAttribute('aria-label', '3D scene contents')
  const frag = document.createDocumentFragment()
  nodes = new Array(N)
  for (let i = 0; i < N; i++) {
    const li = document.createElement('li')
    li.textContent = objects[i].label
    frag.appendChild(li)
    nodes[i] = li
  }
  list.appendChild(frag)
  mount.appendChild(list)
}

function describeObject(o) {
  return o.label + ' at ' + o.x.toFixed(2) + ', ' + o.y.toFixed(2) + ', ' + o.z.toFixed(2)
}

function updateMirrorText() {
  for (let i = 0; i < N; i++) {
    nodes[i].textContent = describeObject(objects[i])
  }
}

function updateMirrorAria() {
  for (let i = 0; i < N; i++) {
    const text = describeObject(objects[i])
    nodes[i].textContent = text
    nodes[i].setAttribute('aria-label', text)
  }
}

let updateAccessibility = function () {}

if (ARM === 'B') {
  buildMirror('sibling-mount')
  updateAccessibility = updateMirrorText
} else if (ARM === 'C') {
  buildMirror('sibling-mount')
  updateAccessibility = updateMirrorAria
} else if (ARM === 'D') {
  buildMirror('fallback-mount')
  updateAccessibility = updateMirrorText
} else if (ARM !== 'A') {
  throw new Error('Unknown arm: ' + ARM)
}

// --- measurement ----------------------------------------------------------------------

const frameTimes = []
let longTaskCount = 0
let longTaskTotalMs = 0
let longTasksSupported = true

if ('PerformanceObserver' in window) {
  try {
    new PerformanceObserver(function (list) {
      for (const entry of list.getEntries()) {
        longTaskCount++
        longTaskTotalMs += entry.duration
      }
    }).observe({ type: 'longtask', buffered: true })
  } catch (err) {
    // Firefox does not implement the longtask entry type. Reported as null downstream
    // rather than as a zero, because absent and none are not the same measurement.
    longTasksSupported = false
  }
} else {
  longTasksSupported = false
}

let startedAt = null
let measuringFrom = null
let last = null

function percentile(sorted, p) {
  if (sorted.length === 0) return null
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

function finish() {
  const sorted = frameTimes.slice().sort(function (a, b) { return a - b })
  const measuredMs = performance.now() - measuringFrom
  window.__benchResult = {
    arm: ARM,
    n: N,
    seed: SEED,
    durationMs: DURATION_MS,
    warmupMs: WARMUP_MS,
    frames: frameTimes.length,
    measuredMs: measuredMs,
    fps: frameTimes.length / (measuredMs / 1000),
    frameTimeMs: {
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      max: sorted.length ? sorted[sorted.length - 1] : null,
    },
    longTasks: longTasksSupported ? { count: longTaskCount, totalMs: longTaskTotalMs } : null,
    userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency || null,
  }
}

function frame(now) {
  if (startedAt === null) {
    startedAt = now
    last = now
    requestAnimationFrame(frame)
    return
  }

  const elapsed = now - startedAt

  // Discard the warm-up window: shader compilation, JIT, first accessibility tree build.
  if (measuringFrom === null && elapsed >= WARMUP_MS) {
    measuringFrom = now
    longTaskCount = 0
    longTaskTotalMs = 0
  }

  if (measuringFrom !== null) frameTimes.push(now - last)
  last = now

  stepMotion()
  updateAccessibility()
  renderer.render(scene, camera)

  if (elapsed >= WARMUP_MS + DURATION_MS) {
    finish()
    return
  }
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
