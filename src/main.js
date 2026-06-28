import './style.css'
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/* ============================================================
   SLOK - Color Hole 3D in Artnomad-stijl
   Sleep een zwart gat over het veld en verzwelg de stad.
   Het gat groeit; grote gebouwen kun je pas op als je groot
   genoeg bent. Procedurele low-poly stad (geen externe assets),
   maar opgezet zodat je later GLB-modellen kunt inladen.
   ============================================================ */

/* ---------- i18n ---------- */
const I18N = {
  nl: {
    title: 'SLOK',
    tag: 'Sleep het gat. Verzwelg de stad.',
    how: 'Beweeg het gat over het veld en slok alles op. Hoe meer je verzwelgt, hoe groter je wordt. Grote gebouwen kun je pas op als je groot genoeg bent.',
    start: 'Start',
    loading: 'Stad laden',
    again: 'Opnieuw',
    level: 'Niveau',
    time: 'Tijd',
    score: 'Score',
    swallowed: 'verzwolgen',
    won: 'Veld leeg',
    lost: 'Tijd op',
    cleared: 'Knap gedaan',
    timeup: 'Bijna',
  },
  en: {
    title: 'SLOK',
    tag: 'Drag the hole. Devour the city.',
    how: 'Move the hole across the field and swallow everything. The more you devour, the bigger you grow. Big buildings need a bigger hole.',
    start: 'Start',
    loading: 'Loading city',
    again: 'Again',
    level: 'Level',
    time: 'Time',
    score: 'Score',
    swallowed: 'swallowed',
    won: 'Field cleared',
    lost: 'Time up',
    cleared: 'Well done',
    timeup: 'So close',
  },
}
let lang = 'nl'
const t = (k) => I18N[lang][k] || k

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n)
  })
  document.documentElement.lang = lang
  el.lang.textContent = lang.toUpperCase()
  if (!assetsReady) el.start.textContent = t('loading') + '...'
}

/* ---------- DOM ---------- */
const el = {
  canvas: document.getElementById('scene'),
  overlay: document.getElementById('overlay'),
  end: document.getElementById('end'),
  hud: document.getElementById('hud'),
  start: document.getElementById('btn-start'),
  again: document.getElementById('btn-again'),
  lang: document.getElementById('btn-lang'),
  sound: document.getElementById('btn-sound'),
  level: document.getElementById('hud-level'),
  time: document.getElementById('hud-time'),
  score: document.getElementById('hud-score'),
  bar: document.getElementById('progress-bar'),
  ptext: document.getElementById('progress-text'),
  endKicker: document.getElementById('end-kicker'),
  endTitle: document.getElementById('end-title'),
  endScore: document.getElementById('end-score'),
  endSwallowed: document.getElementById('end-swallowed'),
}

/* ---------- Audio (gesynthetiseerd, geen bestanden) ---------- */
const audio = {
  ctx: null,
  on: true,
  master: null,
  init() {
    if (this.ctx) return
    this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.5
    this.master.connect(this.ctx.destination)
  },
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume()
  },
  blop(combo = 0) {
    if (!this.on || !this.ctx) return
    const c = this.ctx
    const now = c.currentTime
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    const base = 220 + Math.min(combo, 14) * 26
    o.frequency.setValueAtTime(base * 1.5, now)
    o.frequency.exponentialRampToValueAtTime(base * 0.6, now + 0.16)
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(0.32, now + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
    o.connect(g)
    g.connect(this.master)
    o.start(now)
    o.stop(now + 0.24)
  },
  click() {
    if (!this.on || !this.ctx) return
    const c = this.ctx
    const now = c.currentTime
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'triangle'
    o.frequency.setValueAtTime(520, now)
    o.frequency.exponentialRampToValueAtTime(880, now + 0.05)
    g.gain.setValueAtTime(0.2, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
    o.connect(g)
    g.connect(this.master)
    o.start(now)
    o.stop(now + 0.13)
  },
  chime(win) {
    if (!this.on || !this.ctx) return
    const c = this.ctx
    const notes = win ? [523, 659, 784, 1047] : [392, 330, 262]
    notes.forEach((f, i) => {
      const now = c.currentTime + i * 0.11
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'triangle'
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, now)
      g.gain.exponentialRampToValueAtTime(0.26, now + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
      o.connect(g)
      g.connect(this.master)
      o.start(now)
      o.stop(now + 0.42)
    })
  },
  startAmbient() {
    if (!this.ctx || this._amb) return
    const c = this.ctx
    const o = c.createOscillator()
    const o2 = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o2.type = 'sine'
    o.frequency.value = 58
    o2.frequency.value = 87
    g.gain.value = 0.06
    o.connect(g)
    o2.connect(g)
    g.connect(this.master)
    o.start()
    o2.start()
    this._amb = { g }
  },
}

/* ---------- Palet (Veld en Mandarijn) ---------- */
const PAL = {
  sky: 0xeaddc0,
  fog: 0xe6d7b8,
  ground: 0x7d9968,
  groundEdge: 0x6c875a,
  hole: 0x141008,
  holeRim: 0x0c0905,
  accent: 0xe8622a,
  blocks: [0xe8622a, 0xd8b27a, 0xefe0c4, 0xc8643c, 0x8aa57a, 0xd9d3c4, 0xb5764a, 0xe7a14b],
  trunk: 0x8a5a3c,
  leaf: 0x6f8f5f,
  leaf2: 0x86a36e,
}

/* ---------- Three setup ---------- */
const renderer = new THREE.WebGLRenderer({ canvas: el.canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.outputColorSpace = THREE.SRGBColorSpace

const scene = new THREE.Scene()
scene.background = new THREE.Color(PAL.sky)
scene.fog = new THREE.Fog(PAL.fog, 78, 168)

// zachte omgevingsreflecties -> tactiele, "fysieke miniatuur"-uitstraling (skeuomorf)
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
scene.environmentIntensity = 0.45

const FIELD = 26 // halve veldgrootte (grotere stad)
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 260)
// camera-rig: volgt het gat en zoomt mee uit naarmate het gat groeit
const camDir = new THREE.Vector3(0, 38, 19).normalize() // steiler/meer van bovenaf zodat hoge gebouwen het gat minder afdekken
const camLook = new THREE.Vector3(0, 0, 0)
let camDist = 24
camera.position.copy(camLook).addScaledVector(camDir, camDist)
camera.lookAt(camLook)

/* lights */
const hemi = new THREE.HemisphereLight(0xfff3da, 0x6b7a52, 0.95)
scene.add(hemi)
const sun = new THREE.DirectionalLight(0xfff0d4, 1.25)
sun.position.set(16, 30, 14)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near = 1
sun.shadow.camera.far = 90
const sc = 30
sun.shadow.camera.left = -sc
sun.shadow.camera.right = sc
sun.shadow.camera.top = sc
sun.shadow.camera.bottom = -sc
sun.shadow.bias = -0.0004
scene.add(sun)
scene.add(sun.target) // zon volgt het gat zodat schaduwen scherp blijven

/* ground */
const groundMat = new THREE.MeshStandardMaterial({ color: PAL.ground, roughness: 0.95 })
const ground = new THREE.Mesh(new THREE.PlaneGeometry(280, 280), groundMat)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

// donkere veld-rand zodat het speelveld leesbaar is
const edge = new THREE.Mesh(
  new THREE.RingGeometry(FIELD + 0.4, FIELD + 60, 4, 1),
  new THREE.MeshStandardMaterial({ color: PAL.groundEdge, roughness: 1 })
)
edge.rotation.x = -Math.PI / 2
edge.position.y = 0.01
edge.receiveShadow = true
scene.add(edge)

/* ---------- Het gat ---------- */
const hole = {
  x: 0,
  z: 0,
  tx: 0,
  tz: 0,
  r: 0.36,
  rTarget: 0.36,
  group: new THREE.Group(),
}
// gat start precies groot genoeg voor het kleinste object (mensje footR ~0.3, struik ~0.35)
const START_R = 0.36
const MAX_R = 6.0
const GROW_EVERY = 10 // gat groeit elke 10 opgeslokte objecten
const GROW_STEP = 0.34 // per stap iets groter (rustig, blijft overzichtelijk)
const holeDisc = new THREE.Mesh(
  new THREE.CircleGeometry(1, 72),
  new THREE.MeshBasicMaterial({ color: PAL.hole })
)
holeDisc.rotation.x = -Math.PI / 2
holeDisc.position.y = 0.04
hole.group.add(holeDisc)
const holeRim = new THREE.Mesh(
  new THREE.RingGeometry(0.96, 1.1, 72),
  new THREE.MeshBasicMaterial({ color: PAL.accent })
)
holeRim.rotation.x = -Math.PI / 2
holeRim.position.y = 0.05
hole.group.add(holeRim)
const holeGlow = new THREE.Mesh(
  new THREE.RingGeometry(1.08, 1.42, 72),
  new THREE.MeshBasicMaterial({ color: PAL.accent, transparent: true, opacity: 0.45 })
)
holeGlow.rotation.x = -Math.PI / 2
holeGlow.position.y = 0.03
hole.group.add(holeGlow)
scene.add(hole.group)

/* ---------- Wereld / objecten ---------- */
const worldGroup = new THREE.Group() // opslokbare objecten
const worldStatic = new THREE.Group() // wegen, decoratie (niet opslokbaar)
scene.add(worldStatic)
scene.add(worldGroup)
let objects = []
let falling = []

const tmpMat = (hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.78, metalness: 0.02 })

/* ---------- Echte modellen (Kenney City Kit + Nature Kit + Mini Characters, CC0) ---------- */
const fbxLoader = new FBXLoader()
const gltfLoader = new GLTFLoader()
const texLoader = new THREE.TextureLoader()
let cityProtos = []
let treeProtos = []
let bushProtos = []
let peopleProtos = []
let carProtos = []
let propProtos = []
let assetsReady = false

function loadTex(url) {
  return new Promise((res) =>
    texLoader.load(url, (tx) => {
      tx.colorSpace = THREE.SRGBColorSpace
      tx.anisotropy = 4
      res(tx)
    })
  )
}
function loadFBX(url) {
  return new Promise((res, rej) => fbxLoader.load(url, res, undefined, rej))
}
function loadGLB(url) {
  // geef de volledige gltf terug (scene + animations)
  return new Promise((res, rej) => gltfLoader.load(url, res, undefined, rej))
}

// Kenney GLTF-modellen hebben metallicFactor 1 (worden zwart zonder env map): uitzetten
function deMetal(node) {
  node.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) {
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      mats.forEach((m) => {
        if (m && 'metalness' in m) {
          m.metalness = 0
          if (m.roughness !== undefined) m.roughness = Math.max(m.roughness, 0.7)
        }
      })
    }
  })
}

// meet een model en zet schaduwen aan
function measure(node) {
  node.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  const box = new THREE.Box3().setFromObject(node)
  const size = new THREE.Vector3()
  box.getSize(size)
  return { foot: Math.max(size.x, size.z) || 1, height: size.y || 1, minY: box.min.y }
}

async function loadAssets() {
  // --- gebouwen (Kenney City Kit, FBX, gedeelde colormap-atlas) ---
  const [varA, varB] = await Promise.all([
    loadTex('models/city/variation-a.png'),
    loadTex('models/city/variation-b.png'),
  ])
  const tex = [varA, varB]
  const cityNames = [
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
    'skyscraper-a', 'skyscraper-b', 'skyscraper-c', 'skyscraper-d', 'skyscraper-e',
  ]
  const treeNames = [
    'tree_default', 'tree_oak', 'tree_fat', 'tree_tall', 'tree_detailed',
    'tree_pineRoundA', 'tree_pineDefaultA', 'tree_thin',
  ]
  const bushNames = ['plant_bush', 'plant_bushDetailed', 'plant_bushLarge']
  const peopleNames = [
    'character-male-a', 'character-male-b', 'character-male-c', 'character-male-d',
    'character-female-a', 'character-female-b', 'character-female-c', 'character-female-d',
  ]
  const carNames = [
    'sedan', 'suv', 'taxi', 'police', 'ambulance', 'firetruck',
    'delivery', 'garbage-truck', 'hatchback-sports', 'sedan-sports', 'suv-luxury', 'truck-flat',
  ]
  // kleine straatobjecten (echte modellen), paden relatief aan models/
  const propPaths = [
    'nature/plant_bushSmall', 'nature/flower_redA', 'nature/flower_redB', 'nature/flower_yellowA',
    'nature/flower_purpleA', 'nature/flower_purpleB', 'nature/grass', 'nature/grass_large',
    'nature/mushroom_red', 'nature/mushroom_redGroup', 'nature/mushroom_tan', 'nature/rock_largeA',
    'nature/rock_largeB', 'nature/log', 'nature/plant_flatTall', 'cars/cone',
  ]

  const [cityGroups, treeGltfs, bushGltfs, peopleGltfs, carGltfs, propGltfs] = await Promise.all([
    Promise.all(cityNames.map((n) => loadFBX(`models/city/building-${n}.fbx`))),
    Promise.all(treeNames.map((n) => loadGLB(`models/nature/${n}.glb`))),
    Promise.all(bushNames.map((n) => loadGLB(`models/nature/${n}.glb`))),
    Promise.all(peopleNames.map((n) => loadGLB(`models/people/${n}.glb`))),
    Promise.all(carNames.map((n) => loadGLB(`models/cars/${n}.glb`))),
    Promise.all(propPaths.map((n) => loadGLB(`models/${n}.glb`))),
  ])

  cityProtos = cityGroups.map((g, idx) => {
    g.traverse((o) => {
      if (o.isMesh) {
        o.material = new THREE.MeshStandardMaterial({ map: tex[idx % 2], roughness: 0.74, metalness: 0.02 })
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    return { node: g, ...measure(g), tall: idx >= 14, skinned: false }
  })
  // GLB-protos: deMetal op de scene, animatieclips bewaren voor de mensen
  treeGltfs.forEach((g) => deMetal(g.scene))
  bushGltfs.forEach((g) => deMetal(g.scene))
  peopleGltfs.forEach((g) => deMetal(g.scene))
  carGltfs.forEach((g) => deMetal(g.scene))
  propGltfs.forEach((g) => deMetal(g.scene))
  treeProtos = treeGltfs.map((g) => ({ node: g.scene, ...measure(g.scene), skinned: false }))
  bushProtos = bushGltfs.map((g) => ({ node: g.scene, ...measure(g.scene), skinned: false }))
  peopleProtos = peopleGltfs.map((g) => ({ node: g.scene, clips: g.animations, ...measure(g.scene), skinned: true }))
  carProtos = carGltfs.map((g) => ({ node: g.scene, ...measure(g.scene), skinned: false }))
  propProtos = propGltfs.map((g) => ({ node: g.scene, ...measure(g.scene), skinned: false }))

  assetsReady = true
}

// kloon een proto (skinned via SkeletonUtils), schaal naar doelmaat, plaats op de grond
function spawn(proto, x, z, target, byHeight) {
  const s = byHeight ? target / proto.height : target / proto.foot
  const mesh = proto.skinned ? skeletonClone(proto.node) : proto.node.clone(true)
  mesh.scale.setScalar(s)
  mesh.position.set(x, -proto.minY * s, z)
  return { mesh, s }
}

function makeBuilding(x, z, rot, bigLot) {
  const proto = cityProtos[(Math.random() * cityProtos.length) | 0]
  // footprint begrensd zodat gebouwen binnen de groene kavel blijven (niet over de stoep)
  const targetFoot = bigLot ? 2.7 + Math.random() * 0.9 : 1.35 + Math.random() * 0.4
  const { mesh, s } = spawn(proto, x, z, targetFoot, false)
  mesh.rotation.y = rot
  const heightScaled = proto.height * s
  return { mesh, baseScale: s, footR: (proto.foot * s) * 0.5, value: targetFoot * targetFoot * heightScaled * 0.4 }
}

function makeTree(x, z) {
  const proto = treeProtos[(Math.random() * treeProtos.length) | 0]
  const targetH = 1.4 + Math.random() * 1.1
  const { mesh, s } = spawn(proto, x, z, targetH, true)
  mesh.rotation.y = Math.random() * Math.PI * 2
  return { mesh, baseScale: s, footR: Math.max(proto.foot * s * 0.5, 0.5), value: 1.0 }
}

function makeBush(x, z) {
  const proto = bushProtos[(Math.random() * bushProtos.length) | 0]
  const targetH = 0.5 + Math.random() * 0.4
  const { mesh, s } = spawn(proto, x, z, targetH, true)
  mesh.rotation.y = Math.random() * Math.PI * 2
  return { mesh, baseScale: s, footR: Math.max(proto.foot * s * 0.5, 0.35), value: 0.5 }
}

function makePerson(x, z) {
  const proto = peopleProtos[(Math.random() * peopleProtos.length) | 0]
  const targetH = 0.7 + Math.random() * 0.2
  const { mesh, s } = spawn(proto, x, z, targetH, true)
  const heading = Math.random() * Math.PI * 2
  mesh.rotation.y = heading
  // loop-animatie afspelen (Kenney-clip 'walk'), niet allemaal in sync
  let mixer = null
  if (proto.clips && proto.clips.length) {
    const clip = proto.clips.find((c) => c.name === 'walk') || proto.clips.find((c) => c.name === 'idle')
    if (clip) {
      mixer = new THREE.AnimationMixer(mesh)
      const act = mixer.clipAction(clip)
      act.play()
      act.time = Math.random() * clip.duration
    }
  }
  return {
    mesh, baseScale: s, footR: Math.max(proto.foot * s * 0.5, 0.3), value: 0.4,
    kind: 'person', mixer, speed: 0.45 + Math.random() * 0.45,
  }
}

function makeCar(x, z, rot) {
  const proto = carProtos[(Math.random() * carProtos.length) | 0]
  const targetLen = 1.7 + Math.random() * 0.5 // op de lengste as schalen
  const { mesh, s } = spawn(proto, x, z, targetLen, false)
  mesh.rotation.y = rot
  const wheels = []
  mesh.traverse((o) => {
    if (o.name && o.name.indexOf('wheel') === 0) wheels.push(o)
  })
  return {
    mesh, baseScale: s, footR: Math.max(proto.foot * s * 0.5, 0.6), value: 1.1,
    kind: 'car', wheels, speed: 1.8 + Math.random() * 1.8,
  }
}

// klein straatobject: echt model, of procedurele lantaarnpaal / brandkraan
function makeProp(x, z) {
  const roll = Math.random()
  if (roll < 0.05) return makeBusStop(x, z)
  if (roll < 0.12) return makeHydrant(x, z)
  if (roll < 0.21) return makeBench(x, z)
  if (roll < 0.29) return makeTrashBin(x, z)
  if (roll < 0.36) return makeMailbox(x, z)
  if (roll < 0.42) return makeBollard(x, z)
  if (roll < 0.51) return makeBicycle(x, z)
  if (roll < 0.59) return makePlanter(x, z)
  const proto = propProtos[(Math.random() * propProtos.length) | 0]
  const targetH = 0.22 + Math.random() * 0.3
  const { mesh, s } = spawn(proto, x, z, targetH, true)
  mesh.rotation.y = Math.random() * Math.PI * 2
  return { mesh, baseScale: s, footR: Math.max(proto.foot * s * 0.5, 0.18), value: 0.25 }
}

function makeLampPost(x, z) {
  const g = new THREE.Group()
  const dark = tmpMat(0x2c2722)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.5, 8), dark)
  pole.position.y = 0.75
  pole.castShadow = true
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.06), dark)
  arm.position.set(0.18, 1.46, 0)
  const lamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.12, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xffe1a3, emissive: 0xffb74d, emissiveIntensity: 0.9, roughness: 0.5 })
  )
  lamp.position.set(0.34, 1.41, 0)
  g.add(pole, arm, lamp)
  g.position.set(x, 0, z)
  g.rotation.y = Math.random() * Math.PI * 2
  return { mesh: g, baseScale: 1, footR: 0.22, value: 0.3 }
}

function makeHydrant(x, z) {
  const g = new THREE.Group()
  const red = tmpMat(0xb23a2e)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.32, 10), red)
  body.position.y = 0.16
  body.castShadow = true
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), red)
  cap.position.y = 0.32
  const side = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.13, 8), red)
  side.rotation.z = Math.PI / 2
  side.position.set(-0.13, 0.19, 0)
  const side2 = side.clone()
  side2.position.x = 0.13
  g.add(body, cap, side, side2)
  g.position.set(x, 0, z)
  return { mesh: g, baseScale: 1, footR: 0.2, value: 0.3 }
}

function makeBench(x, z) {
  const g = new THREE.Group()
  const wood = tmpMat(0xb5764a)
  const metal = tmpMat(0x39332b)
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.32), wood)
  seat.position.y = 0.26
  seat.castShadow = true
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.3, 0.06), wood)
  back.position.set(0, 0.44, -0.13)
  back.castShadow = true
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.3), metal)
  legL.position.set(-0.4, 0.13, 0)
  const legR = legL.clone()
  legR.position.x = 0.4
  g.add(seat, back, legL, legR)
  g.position.set(x, 0, z)
  g.rotation.y = (Math.floor(Math.random() * 4) * Math.PI) / 2
  return { mesh: g, baseScale: 1, footR: 0.5, value: 0.4 }
}

function makeTrashBin(x, z) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.4, 12), tmpMat(0x4a5a44))
  body.position.y = 0.2
  body.castShadow = true
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 12), tmpMat(0x394735))
  lid.position.y = 0.42
  g.add(body, lid)
  g.position.set(x, 0, z)
  return { mesh: g, baseScale: 1, footR: 0.22, value: 0.3 }
}

function makeMailbox(x, z) {
  const g = new THREE.Group()
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), tmpMat(0x39332b))
  post.position.y = 0.35
  post.castShadow = true
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.16), tmpMat(0xc24a2a))
  box.position.y = 0.78
  box.castShadow = true
  g.add(post, box)
  g.position.set(x, 0, z)
  g.rotation.y = Math.random() * Math.PI * 2
  return { mesh: g, baseScale: 1, footR: 0.2, value: 0.3 }
}

function makeBollard(x, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 8), tmpMat(0x2c2722))
  m.position.set(x, 0.25, z)
  m.castShadow = true
  return { mesh: m, baseScale: 1, footR: 0.14, value: 0.2 }
}

function makeTrafficLight(x, z, rot) {
  const g = new THREE.Group()
  const dark = tmpMat(0x2c2722)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 8), dark)
  pole.position.y = 0.8
  pole.castShadow = true
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.16), dark)
  head.position.set(0, 1.56, 0)
  head.castShadow = true
  const light = (color, y, intensity) => {
    const l = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 6),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity })
    )
    l.position.set(0, y, 0.09)
    return l
  }
  g.add(pole, head, light(0xe0432e, 1.69, 0.6), light(0xf0b429, 1.56, 0.4), light(0x57a639, 1.43, 0.55))
  g.position.set(x, 0, z)
  g.rotation.y = rot === undefined ? Math.random() * Math.PI * 2 : rot
  return { mesh: g, baseScale: 1, footR: 0.22, value: 0.4 }
}

function makeBusStop(x, z, rot) {
  const g = new THREE.Group()
  const frame = tmpMat(0x39332b)
  const glass = new THREE.MeshStandardMaterial({ color: 0xaccbd0, transparent: true, opacity: 0.4, roughness: 0.3 })
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.07, 0.6), frame)
  roof.position.y = 1.05
  roof.castShadow = true
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.05), glass)
  back.position.set(0, 0.55, -0.27)
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.05, 0.06), frame)
  p1.position.set(-0.65, 0.52, 0.25)
  const p2 = p1.clone()
  p2.position.x = 0.65
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.22), tmpMat(0xb5764a))
  seat.position.set(0, 0.3, -0.16)
  g.add(roof, back, p1, p2, seat)
  g.position.set(x, 0, z)
  g.rotation.y = rot === undefined ? (Math.floor(Math.random() * 4) * Math.PI) / 2 : rot
  return { mesh: g, baseScale: 1, footR: 0.75, value: 0.5 }
}

function makeFountain(x, z) {
  const g = new THREE.Group()
  const stone = tmpMat(0x9a9488)
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x4a90b8, roughness: 0.2, metalness: 0.1 })
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.3, 18), stone)
  basin.position.y = 0.15
  basin.castShadow = true
  basin.receiveShadow = true
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.06, 18), waterMat)
  water.position.y = 0.29
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.5, 12), stone)
  pillar.position.y = 0.45
  pillar.castShadow = true
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 12), stone)
  top.position.y = 0.72
  const topWater = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 12), waterMat)
  topWater.position.y = 0.77
  g.add(basin, water, pillar, top, topWater)
  g.position.set(x, 0, z)
  return { mesh: g, baseScale: 1, footR: 1.0, value: 1.5 }
}

function makeStall(x, z, rot) {
  const g = new THREE.Group()
  const wood = tmpMat(0x8a5a3c)
  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.5), wood)
  counter.position.y = 0.25
  counter.castShadow = true
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.05), wood)
  p1.position.set(-0.5, 0.45, -0.2)
  const p2 = p1.clone()
  p2.position.x = 0.5
  const awn = new THREE.Group()
  const a1 = tmpMat(0xe8622a)
  const a2 = tmpMat(0xefe0c4)
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.62), i % 2 ? a1 : a2)
    s.position.x = -0.48 + i * 0.24
    awn.add(s)
  }
  awn.position.set(0, 0.95, -0.05)
  awn.rotation.x = -0.22
  g.add(counter, p1, p2, awn)
  g.position.set(x, 0, z)
  g.rotation.y = rot === undefined ? Math.random() * Math.PI * 2 : rot
  return { mesh: g, baseScale: 1, footR: 0.7, value: 0.6 }
}

function makeBicycle(x, z) {
  const g = new THREE.Group()
  const dark = tmpMat(0x2c2722)
  const accent = tmpMat(0xe8622a)
  const w1 = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 14), dark)
  w1.position.set(-0.28, 0.16, 0)
  const w2 = w1.clone()
  w2.position.x = 0.28
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.04), accent)
  frame.position.set(0, 0.22, 0)
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.06), dark)
  seat.position.set(-0.12, 0.32, 0)
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), dark)
  bar.position.set(0.24, 0.28, 0)
  g.add(w1, w2, frame, seat, bar)
  g.position.set(x, 0, z)
  g.rotation.y = Math.random() * Math.PI * 2
  return { mesh: g, baseScale: 1, footR: 0.3, value: 0.3 }
}

function makePlanter(x, z) {
  const g = new THREE.Group()
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.34), tmpMat(0x8a5a3c))
  box.position.y = 0.1
  box.castShadow = true
  const soil = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 0.27), tmpMat(0x4a3a2a))
  soil.position.y = 0.21
  g.add(box, soil)
  const cols = [0xe8622a, 0xf0b429, 0xc0497a]
  for (let i = 0; i < 4; i++) {
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), tmpMat(cols[i % cols.length]))
    fl.position.set(-0.24 + i * 0.16, 0.27, (Math.random() - 0.5) * 0.14)
    g.add(fl)
  }
  g.position.set(x, 0, z)
  g.rotation.y = (Math.floor(Math.random() * 2) * Math.PI) / 2
  return { mesh: g, baseScale: 1, footR: 0.4, value: 0.35 }
}

function add(o, x, z) {
  o.x = x
  o.z = z
  o.state = 'idle'
  o.baseYaw = o.mesh.rotation.y // voor het kantelen (teeter/tuimel) naar het gat
  o._lean = 0
  worldGroup.add(o.mesh)
  objects.push(o)
}

// past dit object hier zonder een bestaand object te overlappen?
function fits(x, z, footR, margin = 0.12) {
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i]
    const rr = footR + o.footR + margin
    const dx = x - o.x
    const dz = z - o.z
    if (dx * dx + dz * dz < rr * rr) return false
  }
  return true
}

// voeg een al gemaakt object alleen toe als het past; anders weggooien
function tryAdd(o, x, z) {
  if (o && fits(x, z, o.footR)) {
    add(o, x, z)
    return true
  }
  return false
}

function clearWorld() {
  worldGroup.clear()
  worldStatic.clear()
  objects = []
  falling = []
}

/* ---------- Geordende stad: blokken gescheiden door wegen ---------- */
const BLOCK_CENTERS = [-24, -16, -8, 0, 8, 16, 24] // blokmiddens (7x7 stad)
const ROAD_GAPS = [-20, -12, -4, 4, 12, 20] // wegen tussen de blokken
const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x39372f, roughness: 1 })
const dashMat = new THREE.MeshStandardMaterial({ color: 0xd8c79a, roughness: 1 })
const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x9c9587, roughness: 1 })
const grassPadMat = new THREE.MeshStandardMaterial({ color: PAL.ground, roughness: 0.95 })

// platte quad op de grond (XZ-vlak), klaar om te mergen
function flatQuad(w, h, x, y, z) {
  const g = new THREE.PlaneGeometry(w, h)
  g.rotateX(-Math.PI / 2)
  g.translate(x, y, z)
  return g
}

// ligt een punt op het wegdek? (zo ja: alleen auto's mogen daar staan)
function onRoad(x, z) {
  const m = 1.45 // halve wegbreedte + marge
  for (const g of ROAD_GAPS) {
    if (Math.abs(x - g) < m || Math.abs(z - g) < m) return true
  }
  return false
}

// ligt een punt op een zebrapad bij een kruising? (daar mogen voetgangers wél lopen)
function onCrosswalk(x, z) {
  for (const gx of ROAD_GAPS) {
    for (const gz of ROAD_GAPS) {
      // zebra over de verticale weg (noord/zuid van de kruising)
      if (Math.abs(x - gx) < 1.4 && (Math.abs(z - (gz + 1.6)) < 0.55 || Math.abs(z - (gz - 1.6)) < 0.55)) return true
      // zebra over de horizontale weg (oost/west van de kruising)
      if (Math.abs(z - gz) < 1.4 && (Math.abs(x - (gx + 1.6)) < 0.55 || Math.abs(x - (gx - 1.6)) < 0.55)) return true
    }
  }
  return false
}

function buildRoads() {
  const len = FIELD * 2 + 6
  // asfalt
  ROAD_GAPS.forEach((g) => {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(2.2, len), asphaltMat)
    v.rotation.x = -Math.PI / 2
    v.position.set(g, 0.012, 0)
    v.receiveShadow = true
    worldStatic.add(v)
    const h = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.2), asphaltMat)
    h.rotation.x = -Math.PI / 2
    h.position.set(0, 0.013, g)
    h.receiveShadow = true
    worldStatic.add(h)
  })

  // stoepen rond elk blok (grijze rand met groen midden), gemerged tot 2 meshes
  const swGeos = []
  const grGeos = []
  for (const cx of BLOCK_CENTERS) {
    for (const cz of BLOCK_CENTERS) {
      swGeos.push(flatQuad(5.9, 5.9, cx, 0.011, cz))
      grGeos.push(flatQuad(4.5, 4.5, cx, 0.014, cz))
    }
  }
  const sw = new THREE.Mesh(mergeGeometries(swGeos), sidewalkMat)
  sw.receiveShadow = true
  worldStatic.add(sw)
  const gr = new THREE.Mesh(mergeGeometries(grGeos), grassPadMat)
  gr.receiveShadow = true
  worldStatic.add(gr)

  // wegmarkering: middenstrepen + zebrapaden bij de kruisingen, gemerged tot 1 mesh
  const marks = []
  ROAD_GAPS.forEach((g) => {
    for (let p = -FIELD; p <= FIELD; p += 2.4) {
      marks.push(flatQuad(0.16, 0.9, g, 0.02, p)) // verticale weg
      marks.push(flatQuad(0.9, 0.16, p, 0.021, g)) // horizontale weg
    }
  })
  for (const gx of ROAD_GAPS) {
    for (const gz of ROAD_GAPS) {
      // zebrapad over elk van de vier wegarmen van de kruising
      for (let b = -2; b <= 2; b++) {
        const o = b * 0.34
        marks.push(flatQuad(0.13, 0.72, gx + o, 0.022, gz + 1.6)) // noord
        marks.push(flatQuad(0.13, 0.72, gx + o, 0.022, gz - 1.6)) // zuid
        marks.push(flatQuad(0.72, 0.13, gx + 1.6, 0.022, gz + o)) // oost
        marks.push(flatQuad(0.72, 0.13, gx - 1.6, 0.022, gz + o)) // west
      }
    }
  }
  const markMesh = new THREE.Mesh(mergeGeometries(marks), dashMat)
  worldStatic.add(markMesh)
}

// 2x2 (of toren) gebouwenblok, netjes uitgelijnd op het raster
function placeBuildingBlock(cx, cz, level) {
  if (Math.random() < 0.22) {
    // een groot torenblok in het midden van de groene kavel
    add(makeBuilding(cx, cz, (Math.floor(Math.random() * 4) * Math.PI) / 2, true), cx, cz)
    return
  }
  const lot = 1.3 // dichter bij het midden zodat gebouwen binnen het groen blijven
  for (let ix = -1; ix <= 1; ix += 2) {
    for (let iz = -1; iz <= 1; iz += 2) {
      const lx = cx + ix * lot
      const lz = cz + iz * lot
      const r = Math.random()
      if (r < 0.12) {
        tryAdd(makeTree(lx, lz), lx, lz)
      } else if (r < 0.2) {
        tryAdd(makeBush(lx, lz), lx, lz)
      } else {
        // gevel naar de dichtstbijzijnde straat richten
        const rot = (Math.abs(ix) >= Math.abs(iz) ? (ix > 0 ? 1 : 3) : iz > 0 ? 0 : 2) * (Math.PI / 2)
        add(makeBuilding(lx, lz, rot, false), lx, lz)
      }
    }
  }
}

// parkblok: bomen in een los raster, struiken, soms een wandelaar
function placePark(cx, cz) {
  // soms een blikvanger in het midden: fontein of marktkraam
  const feat = Math.random()
  const hasCenter = feat < 0.45
  if (feat < 0.28) add(makeFountain(cx, cz), cx, cz)
  else if (feat < 0.45) add(makeStall(cx, cz), cx, cz)
  for (let ix = -1; ix <= 1; ix++) {
    for (let iz = -1; iz <= 1; iz++) {
      if (hasCenter && ix === 0 && iz === 0) continue // midden vrij voor de blikvanger
      const x = cx + ix * 1.7 + (Math.random() - 0.5) * 0.4
      const z = cz + iz * 1.7 + (Math.random() - 0.5) * 0.4
      const r = Math.random()
      if (r < 0.46) tryAdd(makeTree(x, z), x, z)
      else if (r < 0.66) tryAdd(makeBush(x, z), x, z)
      else if (r < 0.88) tryAdd(makeProp(x, z), x, z)
      else tryAdd(makePerson(x, z), x, z)
    }
  }
}

function buildLevel(level) {
  clearWorld()
  buildRoads()
  for (const cx of BLOCK_CENTERS) {
    for (const cz of BLOCK_CENTERS) {
      if (cx === 0 && cz === 0) {
        // startplein: kleine objecten (mensjes + struikjes) rond het midden zodat
        // het piepkleine startgat meteen iets te happen heeft; (0,0) blijft vrij
        const ring = [
          [0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9],
          [1.3, 1.3], [-1.3, 1.3], [1.3, -1.3], [-1.3, -1.3],
          [1.9, 0], [-1.9, 0], [0, 1.9], [0, -1.9],
          [2.2, 1.1], [-2.2, -1.1], [1.1, 2.2], [-1.1, -2.2],
        ]
        ring.forEach(([px, pz], idx) => {
          const m = idx % 3 === 0 ? makePerson(px, pz) : idx % 3 === 1 ? makeProp(px, pz) : makeBush(px, pz)
          tryAdd(m, px, pz)
        })
        continue
      }
      if (Math.random() < 0.2) placePark(cx, cz)
      else placeBuildingBlock(cx, cz, level)
    }
  }
  // straatmeubilair op de stoep, langs de blokranden (nooit op het wegdek)
  for (const cx of BLOCK_CENTERS) {
    for (const cz of BLOCK_CENTERS) {
      if (cx === 0 && cz === 0) continue
      // lantaarnpaal op een stoephoek (buitenrand stoep)
      if (Math.random() < 0.55) {
        const lx = cx + (Math.random() < 0.5 ? -2.7 : 2.7)
        const lz = cz + (Math.random() < 0.5 ? -2.7 : 2.7)
        if (!onRoad(lx, lz)) tryAdd(makeLampPost(lx, lz), lx, lz)
      }
      // klein straatmeubilair op de buitenrand van de stoep (tegen de stoeprand)
      const edges = [
        [cx, cz + 2.6], [cx, cz - 2.6], [cx + 2.6, cz], [cx - 2.6, cz],
      ]
      for (const [ex, ez] of edges) {
        if (onRoad(ex, ez)) continue
        tryAdd(makeProp(ex, ez), ex, ez)
      }
    }
  }
  // verkeerslichten op de vier hoeken van een deel van de kruisingen,
  // op de stoep en gericht naar de kruising
  for (const gx of ROAD_GAPS) {
    for (const gz of ROAD_GAPS) {
      if (Math.random() > 0.4) continue
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const lx = gx + sx * 1.55
          const lz = gz + sz * 1.55
          if (onRoad(lx, lz) || Math.hypot(lx, lz) < 3.5) continue
          tryAdd(makeTrafficLight(lx, lz, Math.atan2(-sx, -sz)), lx, lz)
        }
      }
    }
  }
  // auto's op de wegen, uitgelijnd met de rijbaan
  for (const g of ROAD_GAPS) {
    const nV = 2 + ((Math.random() * 3) | 0)
    for (let i = 0; i < nV; i++) {
      const z = -FIELD + Math.random() * 2 * FIELD
      const lane = Math.random() < 0.5 ? -0.55 : 0.55
      const x = g + lane
      if (Math.hypot(x, z) < 4.5) continue
      tryAdd(makeCar(x, z, lane < 0 ? 0 : Math.PI), x, z)
    }
    const nH = 2 + ((Math.random() * 3) | 0)
    for (let i = 0; i < nH; i++) {
      const x = -FIELD + Math.random() * 2 * FIELD
      const lane = Math.random() < 0.5 ? -0.55 : 0.55
      const z = g + lane
      if (Math.hypot(x, z) < 4.5) continue
      tryAdd(makeCar(x, z, lane < 0 ? Math.PI / 2 : -Math.PI / 2), x, z)
    }
  }
  // geparkeerde auto's langs de stoeprand (stilstaand: snelheid 0)
  for (const g of ROAD_GAPS) {
    for (let p = -FIELD + 4; p <= FIELD - 4; p += 4.6) {
      if (Math.random() < 0.4) {
        const side = Math.random() < 0.5 ? -0.92 : 0.92
        const px = g + side
        const pz = p + (Math.random() - 0.5) * 1.2
        if (Math.hypot(px, pz) > 4.5) {
          const c = makeCar(px, pz, side < 0 ? 0 : Math.PI)
          c.speed = 0
          tryAdd(c, px, pz)
        }
      }
      if (Math.random() < 0.4) {
        const side = Math.random() < 0.5 ? -0.92 : 0.92
        const px = p + (Math.random() - 0.5) * 1.2
        const pz = g + side
        if (Math.hypot(px, pz) > 4.5) {
          const c = makeCar(px, pz, side < 0 ? Math.PI / 2 : -Math.PI / 2)
          c.speed = 0
          tryAdd(c, px, pz)
        }
      }
    }
  }
  // wandelaars op de stoep, langs de blokranden (nooit op het wegdek)
  const walkers = 14 + level * 3
  for (let i = 0; i < walkers; i++) {
    const cx = BLOCK_CENTERS[(Math.random() * BLOCK_CENTERS.length) | 0]
    const cz = BLOCK_CENTERS[(Math.random() * BLOCK_CENTERS.length) | 0]
    const off = 2.4
    const along = (Math.random() - 0.5) * 3
    let x, z
    switch ((Math.random() * 4) | 0) {
      case 0: x = cx + along; z = cz + off; break
      case 1: x = cx + along; z = cz - off; break
      case 2: x = cx + off; z = cz + along; break
      default: x = cx - off; z = cz + along
    }
    if (Math.hypot(x, z) < 3.5 || onRoad(x, z)) continue
    tryAdd(makePerson(x, z), x, z)
  }
  state.total = objects.length
  state.swallowed = 0
  state.massTotal = Math.max(1, objects.reduce((sum, o) => sum + o.value, 0))
  state.massEaten = 0
}

/* ---------- Spelstatus ---------- */
const state = {
  mode: 'intro', // intro | playing | end
  level: 1,
  total: 0,
  swallowed: 0,
  score: 0,
  combo: 0,
  comboTimer: 0,
  time: 60,
  massTotal: 1,
  massEaten: 0,
}

function resetHole() {
  hole.x = 0
  hole.z = 0
  hole.tx = 0
  hole.tz = 0
  hole.r = START_R
  hole.rTarget = START_R
  hole.group.position.set(0, 0, 0)
  hole.group.scale.setScalar(START_R)
  camLook.set(0, 0, 0)
  camDist = 22
}

function startLevel(level) {
  state.level = level
  state.time = Math.max(75, 120 - (level - 1) * 8)
  state.combo = 0
  state.comboTimer = 0
  resetHole()
  buildLevel(level)
  state.mode = 'playing'
  el.hud.classList.remove('hidden')
  el.overlay.classList.add('hidden')
  el.end.classList.add('hidden')
  updateHud()
}

function newGame() {
  state.score = 0
  startLevel(1)
}

/* ---------- Swallow-logica ---------- */
function startFall(o) {
  o.state = 'falling'
  o.fx = o.x
  o.fz = o.z
  o.fy = o.mesh.position.y
  o.ft = 0
  o.spin = (Math.random() - 0.5) * 12
  o.fdx = o.x - hole.x // richting waarin het object het gat in tuimelt
  o.fdz = o.z - hole.z
  objects.splice(objects.indexOf(o), 1)
  falling.push(o)
  // groeien
  state.swallowed++
  state.score += Math.round((10 + o.value * 6) * (1 + state.combo * 0.12))
  state.combo++
  state.comboTimer = 1.1
  // groei stapsgewijs: elke 10 opgeslokte objecten een stapje groter
  const stage = Math.floor(state.swallowed / GROW_EVERY)
  const newTarget = Math.min(MAX_R, START_R + stage * GROW_STEP)
  audio.blop(state.combo)
  if (newTarget > hole.rTarget) {
    hole.rTarget = newTarget
    hole._pulse = 0.22 // duidelijk groei-pulsje op het tiende object
    audio.click()
  }
  updateHud()
}

const _UP = new THREE.Vector3(0, 1, 0)
const _axis = new THREE.Vector3()
const _qa = new THREE.Quaternion()

// zet de kanteling (lean) van een object richting het gat
function setLean(o, dx, dz, lean) {
  if (lean < 0.0008) {
    o.mesh.quaternion.setFromAxisAngle(_UP, o.baseYaw)
    return
  }
  const d = Math.hypot(dx, dz) || 1
  _axis.set(dz / d, 0, -dx / d) // horizontale as loodrecht op de richting naar het gat
  o.mesh.quaternion.setFromAxisAngle(_UP, o.baseYaw).premultiply(_qa.setFromAxisAngle(_axis, lean))
}
function leanToward(o, dx, dz, target, dt) {
  o._lean += (target - o._lean) * Math.min(1, dt * 6)
  setLean(o, dx, dz, o._lean)
}

function updateSwallow(dt) {
  // idle objecten: vallen erin, of kantelen (teeter) als het gat er deels onder komt
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i]
    const dx = o.x - hole.x
    const dz = o.z - hole.z
    const dist = Math.hypot(dx, dz)
    const swallowable = hole.r >= o.footR * 0.85
    if (swallowable && dist < hole.r + o.footR * 0.5) {
      startFall(o) // genoeg eronder -> tuimelt erin (vergevingsgezind: ook deels eronder telt)
      continue
    }
    if (o.kind === 'person' || o.kind === 'car') continue // die bewegen zelf
    const reach = hole.r - (dist - o.footR) // >0 als de gat-rand onder de footprint zit
    if (reach > 0.02) {
      // te klein gat: alleen lichtjes wiebelen; groot genoeg: duidelijk overhellen
      const cap = swallowable ? 0.75 : 0.16
      leanToward(o, dx, dz, Math.min(cap, reach * 0.7), dt)
    } else if (o._lean > 0.001) {
      leanToward(o, dx, dz, 0, dt) // weer rechtop komen
    }
  }
  // vallende objecten: naar het midden trekken, omlaag, tuimelen en krimpen
  for (let i = falling.length - 1; i >= 0; i--) {
    const o = falling[i]
    o.ft += dt
    const k = Math.min(1, o.ft / 0.55)
    const e = k * k * (3 - 2 * k) // smoothstep
    o.mesh.position.x = o.fx + (hole.x - o.fx) * e
    o.mesh.position.z = o.fz + (hole.z - o.fz) * e
    o.mesh.position.y = o.fy - 6 * e
    o.mesh.scale.setScalar(Math.max(0.001, (o.baseScale || 1) * (1 - e)))
    setLean(o, o.fdx, o.fdz, e * 1.7) // tuimelt voorover het gat in
    if (k >= 1) {
      worldGroup.remove(o.mesh)
      falling.splice(i, 1)
    }
  }
}

// zou een wandelaar hier door een object heen lopen? (andere mensen mogen passeren)
function personBlocked(self, nx, nz) {
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i]
    if (o === self || o.kind === 'person' || o.state !== 'idle') continue
    const rr = self.footR + o.footR
    const dx = nx - o.x
    const dz = nz - o.z
    if (dx * dx + dz * dz < rr * rr) return true
  }
  return false
}

// levende stad: mensen lopen over de stoep, auto's rijden over de weg
function updateTraffic(dt) {
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i]
    if (o.state !== 'idle') continue
    if (o.kind === 'car') {
      const h = o.mesh.rotation.y
      let nx = o.x + Math.sin(h) * o.speed * dt
      let nz = o.z + Math.cos(h) * o.speed * dt
      if (nx > FIELD) nx = -FIELD
      else if (nx < -FIELD) nx = FIELD
      if (nz > FIELD) nz = -FIELD
      else if (nz < -FIELD) nz = FIELD
      o.x = nx
      o.z = nz
      o.mesh.position.x = nx
      o.mesh.position.z = nz
      for (let w = 0; w < o.wheels.length; w++) o.wheels[w].rotation.x -= o.speed * dt * 3.2
    } else if (o.kind === 'person') {
      if (o.mixer) o.mixer.update(dt)
      const h = o.mesh.rotation.y
      const nx = o.x + Math.sin(h) * o.speed * dt
      const nz = o.z + Math.cos(h) * o.speed * dt
      // mag hier niet komen: op de weg (tenzij zebrapad), buiten het veld, of door een object heen
      const offField = Math.abs(nx) > FIELD - 0.5 || Math.abs(nz) > FIELD - 0.5
      const onStreet = onRoad(nx, nz) && !onCrosswalk(nx, nz)
      if (offField || onStreet || personBlocked(o, nx, nz)) {
        // draai een nieuwe kant op om eromheen te lopen
        o.mesh.rotation.y = h + Math.PI / 2 + (Math.random() - 0.5) * 1.4
      } else {
        o.x = nx
        o.z = nz
        o.mesh.position.x = nx
        o.mesh.position.z = nz
      }
    }
  }
}

/* ---------- Input ---------- */
const raycaster = new THREE.Raycaster()
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const ndc = new THREE.Vector2()
const hit = new THREE.Vector3()
let dragging = false

function pointerToGround(clientX, clientY) {
  const rect = el.canvas.getBoundingClientRect()
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(ndc, camera)
  if (raycaster.ray.intersectPlane(groundPlane, hit)) {
    const lim = FIELD - 0.5
    hole.tx = Math.max(-lim, Math.min(lim, hit.x))
    hole.tz = Math.max(-lim, Math.min(lim, hit.z))
  }
}

el.canvas.addEventListener('pointerdown', (e) => {
  if (state.mode !== 'playing') return
  dragging = true
  audio.resume()
  pointerToGround(e.clientX, e.clientY)
})
window.addEventListener('pointermove', (e) => {
  if (state.mode !== 'playing') return
  // op desktop volgt het gat de cursor altijd; op touch alleen tijdens slepen
  if (e.pointerType === 'touch' && !dragging) return
  pointerToGround(e.clientX, e.clientY)
})
window.addEventListener('pointerup', () => {
  dragging = false
})

/* ---------- HUD ---------- */
function updateHud() {
  el.level.textContent = state.level
  el.time.textContent = Math.ceil(state.time)
  el.score.textContent = state.score
  const done = state.total === 0 ? 0 : (state.swallowed / state.total) * 100
  el.bar.style.width = done + '%'
  el.ptext.textContent = `${state.swallowed} / ${state.total}`
  el.time.style.color = state.time <= 8 ? PAL.accentCss || '#c64e1d' : ''
}

function endGame(win) {
  state.mode = 'end'
  el.hud.classList.add('hidden')
  el.end.classList.remove('hidden')
  el.endKicker.textContent = win ? t('cleared') : t('timeup')
  el.endTitle.textContent = win ? t('won') : t('lost')
  el.endScore.textContent = state.score
  el.endSwallowed.textContent = `${state.swallowed} / ${state.total}`
  audio.chime(win)
  // bij winst: knop gaat naar volgend level
  state._win = win
}

/* ---------- Loop ---------- */
const clock = new THREE.Clock()
function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)

  let lookX = 0
  let lookZ = 0
  let targetDist = 42 // overzichtsstand voor de menu's

  if (state.mode === 'playing') {
    // gat beweegt met begrensde snelheid naar het doel (rustig en controleerbaar)
    const dx = hole.tx - hole.x
    const dz = hole.tz - hole.z
    const dlen = Math.hypot(dx, dz)
    if (dlen > 1e-4) {
      const speed = 4.2 + hole.r * 0.28 // rustig (begrensd); iets sneller als het gat groter is
      const step = Math.min(dlen, speed * dt)
      hole.x += (dx / dlen) * step
      hole.z += (dz / dlen) * step
    }

    // gat groeit soepel naar zijn (stapsgewijze) doelgrootte
    hole.r += (hole.rTarget - hole.r) * Math.min(1, dt * 3)

    // puls-animatie op de schaal
    if (hole._pulse > 0) hole._pulse = Math.max(0, hole._pulse - dt)
    const pulse = 1 + Math.sin((hole._pulse / 0.18) * Math.PI) * 0.06
    hole.group.position.set(hole.x, 0, hole.z)
    hole.group.scale.setScalar(hole.r * pulse)

    updateSwallow(dt)
    updateTraffic(dt)

    // combo verloopt
    if (state.comboTimer > 0) {
      state.comboTimer -= dt
      if (state.comboTimer <= 0) state.combo = 0
    }

    // tijd
    state.time -= dt
    updateHud()

    // camera volgt het gat en zoomt mee uit zodat het altijd in beeld blijft
    lookX = hole.x
    lookZ = hole.z
    const frac = (hole.r - START_R) / (MAX_R - START_R)
    targetDist = 14 + frac * 31 // piepklein gat = flink ingezoomd, groot gat = verder (maar overzichtelijk)

    if (state.swallowed >= state.total && state.total > 0) {
      endGame(true)
    } else if (state.time <= 0) {
      state.time = 0
      endGame(false)
    }
  } else {
    hole.group.position.set(hole.x, 0, hole.z)
    hole.group.scale.setScalar(hole.r)
  }

  // camera-rig toepassen (volgen + zoomen), soepel en rustig
  camLook.x += (lookX - camLook.x) * Math.min(1, dt * 2.8)
  camLook.z += (lookZ - camLook.z) * Math.min(1, dt * 2.8)
  camDist += (targetDist - camDist) * Math.min(1, dt * 1.6)
  camera.position.copy(camLook).addScaledVector(camDir, camDist)
  camera.lookAt(camLook)

  // zon (en schaduw-frustum) volgt het gat
  sun.position.set(camLook.x + 16, 34, camLook.z + 14)
  sun.target.position.set(camLook.x, 0, camLook.z)
  sun.target.updateMatrixWorld()

  renderer.render(scene, camera)
}

/* ---------- Resize ---------- */
function resize() {
  const w = window.innerWidth
  const h = window.innerHeight
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)

/* ---------- UI wiring ---------- */
el.start.addEventListener('click', () => {
  if (!assetsReady) return
  audio.init()
  audio.resume()
  audio.startAmbient()
  audio.click()
  newGame()
})
el.again.addEventListener('click', () => {
  audio.click()
  if (state._win) startLevel(state.level + 1)
  else newGame()
})
el.lang.addEventListener('click', () => {
  lang = lang === 'nl' ? 'en' : 'nl'
  applyI18n()
  if (state.mode === 'end') {
    el.endKicker.textContent = state._win ? t('cleared') : t('timeup')
    el.endTitle.textContent = state._win ? t('won') : t('lost')
  }
})
el.sound.addEventListener('click', () => {
  audio.on = !audio.on
  el.sound.classList.toggle('muted', !audio.on)
  if (audio.on && audio.ctx) audio.resume()
})

/* ---------- Boot ---------- */
resetHole()
resize()
animate()

el.start.disabled = true
el.start.classList.add('busy')
applyI18n()
loadAssets()
  .then(() => {
    el.start.disabled = false
    el.start.classList.remove('busy')
    el.start.textContent = t('start')
  })
  .catch((err) => {
    console.error('Asset load failed', err)
    el.start.textContent = 'Fout bij laden'
  })
