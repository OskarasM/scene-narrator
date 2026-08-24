import { Line } from '../ui/Line'
import { CodeCard, InstallCommand } from '../chrome'
import { INSTALL_COMMAND, REPO_URL, SOURCE } from '../site'

/**
 * 00:33. Three lines to describe a scene.
 *
 * The integration, both ways round. The React binding is what most people will
 * reach for and the plain call is what it is built on, so both are here: a
 * library whose only documented entry point is a React component is a React
 * component, not a library.
 */

const R3F = `import { Canvas } from '@react-three/fiber'
import { SceneNarrator, useDescribe } from 'scene-narrator/react'

function Van({ van }) {
  const ref = useRef()
  useDescribe(ref, {
    label: van.name,
    role: 'van',
    state: () => (van.moving ? 'moving' : 'parked'),
  })
  return <mesh ref={ref} position={van.position} />
}

export default function App() {
  return (
    <Canvas>
      <SceneNarrator label="Delivery yard" />
      {vans.map((van) => <Van key={van.id} van={van} />)}
    </Canvas>
  )
}`

const PLAIN = `import { createNarrator, describe } from 'scene-narrator'

describe(van, {
  label: 'Van 7',
  role: 'van',
  state: () => (van.moving ? 'moving' : 'parked'),
})

const narrator = createNarrator(scene, {
  camera,
  mount: renderer.domElement,
  label: 'Delivery yard',
})

function frame() {
  narrator.update()
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}`

export function Use() {
  return (
    <Line
      id="use"
      stamp="00:33"
      title="Three lines to describe a scene"
      lede={
        <>
          Say what a thing is, mount the narrator, call update in the loop you already have.
          There is no build step, no configuration file and no runtime dependency: it is
          about a thousand lines of TypeScript with <code>three</code> as its only peer.
        </>
      }
      aside={
        <>
          <p className="eyebrow">Where descriptors live</p>
          <p>
            On <code>object.userData.a11y</code>, which means a scene authored in Blender and
            exported as glTF can carry its descriptions in <code>extras</code> and arrive
            already described, with no code at the object at all.
          </p>
        </>
      }
    >
      <InstallCommand command={INSTALL_COMMAND} />

      <div className="cards">
        <CodeCard filename="App.tsx" status="React Three Fiber">
          {R3F}
        </CodeCard>
        <CodeCard filename="main.ts" status="Plain Three.js">
          {PLAIN}
        </CodeCard>
      </div>

      <div className="prose">
        <p>
          <code>state()</code> is called at the narrator cadence, never once per frame, so it
          may be as expensive as a property read and no more. <code>detail()</code> is called
          only when its area has focus, which is where the expensive string building belongs.
          Both of those are the whole performance contract, and neither is enforced: a
          <code>state()</code> that walks the scene graph will be slow, and the library will
          not stop you.
        </p>
        <p>
          Scenes with real semantic structure should name their own regions and get{' '}
          <q>Loading bay</q> instead of <q>The north-west of the scene</q>. The compass
          headings are what automatic grouping can honestly produce for a scene nobody has
          described. The configurator above uses the named form; the other two use the grid.
        </p>
      </div>

      <p className="source-line">
        API design and the alternatives that were rejected:{' '}
        <a href={SOURCE('API.md')}>API.md</a>. The full write-up, including why the tree
        mounts inside the canvas: <a href={SOURCE('GUIDE.md')}>GUIDE.md</a>. Everything else:{' '}
        <a href={REPO_URL}>the repository</a>.
      </p>
    </Line>
  )
}
