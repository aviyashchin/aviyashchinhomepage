import { useEffect, useRef } from 'react'
import { Canvas, useFrame } from "@react-three/fiber"
import { Float, Lightformer, Text, Html, ContactShadows, Environment, MeshTransmissionMaterial } from "@react-three/drei"
import { useMask, useGLTF, useAnimations, Instance, Instances, CameraControls, RandomizedLight, AccumulativeShadows } from "@react-three/drei"
import { Bloom, EffectComposer, N8AO, TiltShift2 } from "@react-three/postprocessing"
import { Route, Link, useLocation } from "wouter"
import { suspend } from "suspend-react"
import { easing } from "maath"

const inter = import("@pmndrs/assets/fonts/inter_regular.woff")

// Bubble configuration for turtle aquarium
const spheres = [
  [1, 'orange', 0.05, [-4, -1, -1]],
  [0.75, 'hotpink', 0.1, [-4, 2, -2]],
  [1.25, 'aquamarine', 0.2, [4, -3, 2]],
  [1.5, 'lightblue', 0.3, [-4, -2, -3]],
  [2, 'pink', 0.3, [-4, 2, -4]],
  [2, 'skyblue', 0.3, [-4, 2, -4]],
  [1.5, 'orange', 0.05, [-4, -1, -1]],
  [2, 'hotpink', 0.1, [-4, 2, -2]],
  [1.5, 'aquamarine', 0.2, [4, -3, 2]],
  [1.25, 'lightblue', 0.3, [-4, -2, -3]],
  [1, 'pink', 0.3, [-4, 2, -4]],
  [1, 'skyblue', 0.3, [-4, 2, -4]]
]

export const App = () => {
  const [loc] = useLocation()
  const isAbout = loc === "/about"

  return (
    <>
      {isAbout ? <TurtleCanvas /> : <MainCanvas />}
      <div className="nav">
        <Link to="/">rights</Link>
        <Link to="/activism">activism</Link>
        <Link to="/charity">charity</Link>
        <Link to="/about">about</Link>
      </div>
      {isAbout ? <AboutOverlay /> : <CauseInfo />}
    </>
  )
}

// Main canvas with shapes
function MainCanvas() {
  return (
    <Canvas eventSource={document.getElementById("root")} eventPrefix="client" shadows camera={{ position: [0, 0, 20], fov: 50 }}>
      <color attach="background" args={["#e0e0e0"]} />
      <spotLight position={[20, 20, 10]} penumbra={1} castShadow angle={0.2} />
      <Status position={[0, 0, -10]} />
      <Float floatIntensity={2}>
        <Route path="/">
          <Knot />
        </Route>
        <Route path="/activism">
          <ShapeTorus />
        </Route>
        <Route path="/charity">
          <Dodecahedron />
        </Route>
      </Float>
      <ContactShadows scale={100} position={[0, -7.5, 0]} blur={1} far={100} opacity={0.85} />
      <Environment resolution={256}>
        <Lightformer intensity={8} position={[10, 5, 0]} scale={[10, 50, 1]} onUpdate={(self) => self.lookAt(0, 0, 0)} />
        <Lightformer intensity={2} position={[-10, 5, 0]} scale={[10, 50, 1]} />
        <Lightformer intensity={4} position={[0, 10, 0]} scale={[50, 10, 1]} rotation-x={Math.PI / 2} />
      </Environment>
      <EffectComposer disableNormalPass>
        <N8AO aoRadius={1} intensity={2} />
        <Bloom mipmapBlur luminanceThreshold={0.8} intensity={2} levels={8} />
        <TiltShift2 blur={0.2} />
      </EffectComposer>
      <Rig />
    </Canvas>
  )
}

// Turtle aquarium canvas
function TurtleCanvas() {
  return (
    <Canvas shadows camera={{ position: [30, 0, -3], fov: 35, near: 1, far: 50 }}>
      <color attach="background" args={['#c6e5db']} />
      <Aquarium position={[0, 0.25, 0]}>
        <Float rotationIntensity={0.3} floatIntensity={2} speed={2}>
          <Turtle position={[0, -0.5, -1]} rotation={[0, Math.PI, 0]} scale={17} />
        </Float>
        <Instances renderOrder={-1000}>
          <sphereGeometry args={[1, 64, 64]} />
          <meshBasicMaterial depthTest={false} />
          {spheres.map(([scale, color, speed, position], index) => (
            <TurtleSphere key={index} scale={scale} color={color} speed={speed} position={position} />
          ))}
        </Instances>
      </Aquarium>
      <AccumulativeShadows temporal frames={100} color="lightblue" colorBlend={2} opacity={0.7} scale={60} position={[0, -5, 0]}>
        <RandomizedLight amount={8} radius={15} ambient={0.5} intensity={1} position={[-5, 10, -5]} size={20} />
      </AccumulativeShadows>
      <Environment resolution={1024}>
        <group rotation={[-Math.PI / 3, 0, 0]}>
          <Lightformer intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={[10, 10, 1]} />
          {[2, 0, 2, 0, 2, 0, 2, 0].map((x, i) => (
            <Lightformer key={i} form="circle" intensity={4} rotation={[Math.PI / 2, 0, 0]} position={[x, 4, i * 4]} scale={[4, 1, 1]} />
          ))}
          <Lightformer intensity={2} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={[50, 2, 1]} />
          <Lightformer intensity={2} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={[50, 2, 1]} />
        </group>
      </Environment>
      <CameraControls truckSpeed={0} dollySpeed={0} minPolarAngle={0} maxPolarAngle={Math.PI / 2} />
    </Canvas>
  )
}

// GLB models (local files in public folder)
const AQUARIUM_MODEL = '/shapes-transformed.glb'
const TURTLE_MODEL = '/turtle-converted.glb'

// Aquarium glass container (stencil disabled for debugging)
function Aquarium({ children, ...props }) {
  const { nodes } = useGLTF(AQUARIUM_MODEL)
  return (
    <group {...props} dispose={null}>
      <mesh castShadow scale={[0.61 * 6, 0.8 * 6, 1 * 6]} geometry={nodes.Cube.geometry}>
        <MeshTransmissionMaterial
          backside
          samples={4}
          thickness={3}
          chromaticAberration={0.025}
          anisotropy={0.1}
          distortion={0.1}
          distortionScale={0.1}
          temporalDistortion={0.2}
          iridescence={1}
          iridescenceIOR={1}
          iridescenceThicknessRange={[0, 1400]}
        />
      </mesh>
      <group>{children}</group>
    </group>
  )
}

// Floating bubble for aquarium
function TurtleSphere({ position, scale = 1, speed = 0.1, color = 'white' }) {
  return (
    <Float rotationIntensity={40} floatIntensity={20} speed={speed / 2}>
      <Instance position={position} scale={scale} color={color} />
    </Float>
  )
}

// Animated swimming turtle (model by DigitalLife3D, CC-BY-NC-4.0)
function Turtle(props) {
  const { scene, animations } = useGLTF(TURTLE_MODEL)
  const { actions, mixer } = useAnimations(animations, scene)
  useEffect(() => {
    mixer.timeScale = 0.5
    actions['Swim Cycle']?.play()
  }, [actions, mixer])
  useFrame((state) => (scene.rotation.z = Math.sin(state.clock.elapsedTime / 4) / 4))
  return <primitive object={scene} {...props} />
}

function Rig() {
  useFrame((state, delta) => {
    easing.damp3(
      state.camera.position,
      [Math.sin(-state.pointer.x) * 5, state.pointer.y * 3.5, 15 + Math.cos(state.pointer.x) * 10],
      0.2,
      delta,
    )
    state.camera.lookAt(0, 0, 0)
  })
}

const ShapeTorus = (props) => (
  <mesh receiveShadow castShadow {...props}>
    <torusGeometry args={[4, 1.2, 128, 64]} />
    <MeshTransmissionMaterial backside backsideThickness={5} thickness={2} />
  </mesh>
)

const Knot = (props) => (
  <mesh receiveShadow castShadow {...props}>
    <torusKnotGeometry args={[3, 1, 256, 32]} />
    <MeshTransmissionMaterial backside backsideThickness={5} thickness={2} />
  </mesh>
)

const Dodecahedron = (props) => (
  <mesh receiveShadow castShadow {...props}>
    <dodecahedronGeometry args={[4, 0]} />
    <MeshTransmissionMaterial backside backsideThickness={5} thickness={2} />
  </mesh>
)

function Status(props) {
  const [loc] = useLocation()
  const text = loc === "/" ? "/rights" : loc
  return (
    <Text fontSize={14} letterSpacing={-0.025} font={suspend(inter).default} color="black" {...props}>
      {text}
      <Html style={{ color: "transparent", fontSize: "33.5em" }} transform>
        {text}
      </Html>
    </Text>
  )
}

const causeData = {
  "/": {
    title: "Non-Human Rights",
    description: "Working to include AI in Non-Human rights efforts.",
    url: "https://www.nonhumanrights.org/"
  },
  "/activism": {
    title: "Activism",
    description: "A better way to align corporations with their externalities.",
    url: "https://www.nytimes.com/2021/06/23/magazine/exxon-mobil-engine-no-1-board.html"
  },
  "/charity": {
    title: "Enduring Hearts",
    description: "I serve on the board of Enduring Hearts, a pediatric heart transplant charity.",
    url: "https://www.enduringhearts.org/about-us/"
  }
}

function CauseInfo() {
  const [loc] = useLocation()
  const cause = causeData[loc] || causeData["/"]
  return (
    <div className="cause-info">
      <a href={cause.url} target="_blank" rel="noopener noreferrer">
        {cause.title}
      </a>
      <p>{cause.description}</p>
    </div>
  )
}

function AboutOverlay() {
  return (
    <div className="about-overlay">
      <h2>About</h2>
      <p className="tagline">Data-driven founder + 2x public exits. Super-Dad. WIP-Human.</p>
      <p>
        Market Research leader with deep knowledge of applying big data, small data, and AI to transform markets.
      </p>
      <p className="experience">
        Previously: CSO @ Engine No. 1, Analytics Lead @ Two Sigma, Offering Director @ IBM Watson Research.
        Founder, WAHA Technologies (acquired by CleanSpark). Founder, CleanEdison (acquired by Kaplan).
      </p>
      <p className="education">
        BS in Comp Sci @JohnsHopkins, MBA @NYUStern.
      </p>
      <p>Passionate about learning, behavior, and experimental design.</p>
      <div className="social-links">
        <a href="https://www.linkedin.com/in/aviyashchin/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        <a href="https://github.com/aviyashchin" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="https://www.instagram.com/aviyashchin/" target="_blank" rel="noopener noreferrer">Instagram</a>
      </div>
    </div>
  )
}
