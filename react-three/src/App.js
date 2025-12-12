import { Canvas, useFrame } from "@react-three/fiber"
import { Float, Lightformer, Text, Html, ContactShadows, Environment, MeshTransmissionMaterial } from "@react-three/drei"
import { Bloom, EffectComposer, N8AO, TiltShift2 } from "@react-three/postprocessing"
import { Route, Link, useLocation } from "wouter"
import { suspend } from "suspend-react"
import { easing } from "maath"

const inter = import("@pmndrs/assets/fonts/inter_regular.woff")

export const App = () => (
  <>
    <Canvas eventSource={document.getElementById("root")} eventPrefix="client" shadows camera={{ position: [0, 0, 20], fov: 50 }}>
      <color attach="background" args={["#e0e0e0"]} />
      <spotLight position={[20, 20, 10]} penumbra={1} castShadow angle={0.2} />
      <Status position={[0, 0, -10]} />
      <Float floatIntensity={2}>
        <Route path="/">
          <Knot />
        </Route>
        <Route path="/activism">
          <Torus />
        </Route>
        <Route path="/charity">
          <Dodecahedron />
        </Route>
      </Float>
      <ContactShadows scale={100} position={[0, -7.5, 0]} blur={1} far={100} opacity={0.85} />
      <Environment preset="city">
        <Lightformer intensity={8} position={[10, 5, 0]} scale={[10, 50, 1]} onUpdate={(self) => self.lookAt(0, 0, 0)} />
      </Environment>
      <EffectComposer disableNormalPass>
        <N8AO aoRadius={1} intensity={2} />
        <Bloom mipmapBlur luminanceThreshold={0.8} intensity={2} levels={8} />
        <TiltShift2 blur={0.2} />
      </EffectComposer>
      <Rig />
    </Canvas>
    <div className="nav">
      <Link to="/">rights</Link>
      <Link to="/activism">activism</Link>
      <Link to="/charity">charity</Link>
    </div>
    <CauseInfo />
  </>
)

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

const Torus = (props) => (
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
