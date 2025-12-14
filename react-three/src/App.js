import { lazy, Suspense, useState, useEffect } from 'react'
import { Canvas, useFrame } from "@react-three/fiber"
import { Float, Lightformer, Text, Html, ContactShadows, Environment, MeshTransmissionMaterial } from "@react-three/drei"
import { Bloom, EffectComposer, N8AO, TiltShift2 } from "@react-three/postprocessing"
import { Route, Link, useLocation } from "wouter"
import { suspend } from "suspend-react"
import { easing } from "maath"

const inter = import("@pmndrs/assets/fonts/inter_regular.woff")

// Lazy load turtle page (2MB model)
const TurtlePage = lazy(() => import('./TurtlePage').then(m => ({ default: m.TurtleCanvas })))

// Loading spinner component
function LoadingSpinner() {
  return (
    <div className="loading">
      <div className="loading-spinner"></div>
      <span>Loading</span>
    </div>
  )
}

export const App = () => {
  const [loc] = useLocation()
  const isHome = loc === "/"

  return (
    <>
      {isHome ? (
        <Suspense fallback={<LoadingSpinner />}>
          <TurtlePage />
        </Suspense>
      ) : (
        <MainCanvas />
      )}
      <div className="nav">
        <Link to="/" className={loc === "/" ? "active" : ""}>about</Link>
        <Link to="/rights" className={loc === "/rights" ? "active" : ""}>rights</Link>
        <Link to="/activism" className={loc === "/activism" ? "active" : ""}>activism</Link>
        <Link to="/charity" className={loc === "/charity" ? "active" : ""}>charity</Link>
      </div>
      {isHome ? <AboutOverlay /> : <CauseInfo />}
    </>
  )
}

// Main canvas with shapes
function MainCanvas() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <Canvas
      eventSource={document.getElementById("root")}
      eventPrefix="client"
      shadows
      dpr={isMobile ? [1, 1.5] : [1, 2]}
      camera={{ position: [0, 0, 20], fov: 50 }}
    >
      <color attach="background" args={["#e0e0e0"]} />
      <spotLight position={[20, 20, 10]} penumbra={1} castShadow angle={0.2} />
      <Status position={[0, 0, isMobile ? -50 : -10]} isMobile={isMobile} />
      <Float floatIntensity={2}>
        <Route path="/rights">
          <Knot isMobile={isMobile} />
        </Route>
        <Route path="/activism">
          <ShapeTorus isMobile={isMobile} />
        </Route>
        <Route path="/charity">
          <Dodecahedron isMobile={isMobile} />
        </Route>
      </Float>
      <ContactShadows scale={100} position={[0, -7.5, 0]} blur={1} far={100} opacity={0.85} />
      <Environment resolution={isMobile ? 128 : 256}>
        <Lightformer intensity={8} position={[10, 5, 0]} scale={[10, 50, 1]} onUpdate={(self) => self.lookAt(0, 0, 0)} />
        <Lightformer intensity={2} position={[-10, 5, 0]} scale={[10, 50, 1]} />
        <Lightformer intensity={4} position={[0, 10, 0]} scale={[50, 10, 1]} rotation-x={Math.PI / 2} />
      </Environment>
      <EffectComposer disableNormalPass>
        <N8AO aoRadius={1} intensity={isMobile ? 1 : 2} />
        <Bloom mipmapBlur luminanceThreshold={0.8} intensity={isMobile ? 1 : 2} levels={isMobile ? 4 : 8} />
        <TiltShift2 blur={0.2} />
      </EffectComposer>
      <Rig />
    </Canvas>
  )
}

function Rig() {
  useFrame((state, delta) => {
    easing.damp3(
      state.camera.position,
      [Math.sin(-state.pointer.x) * 5, state.pointer.y * 3.5, 15 + Math.cos(state.pointer.x) * 10],
      0.4,
      delta,
    )
    state.camera.lookAt(0, 0, 0)
  })
}

const ShapeTorus = ({ isMobile, ...props }) => (
  <mesh receiveShadow castShadow {...props}>
    <torusGeometry args={isMobile ? [4, 1.2, 64, 32] : [4, 1.2, 128, 64]} />
    <MeshTransmissionMaterial backside backsideThickness={5} thickness={2} samples={isMobile ? 2 : 4} />
  </mesh>
)

const Knot = ({ isMobile, ...props }) => (
  <mesh receiveShadow castShadow {...props}>
    <torusKnotGeometry args={isMobile ? [3, 1, 128, 16] : [3, 1, 256, 32]} />
    <MeshTransmissionMaterial backside backsideThickness={5} thickness={2} samples={isMobile ? 2 : 4} />
  </mesh>
)

const Dodecahedron = ({ isMobile, ...props }) => (
  <mesh receiveShadow castShadow {...props}>
    <dodecahedronGeometry args={[4, 0]} />
    <MeshTransmissionMaterial backside backsideThickness={5} thickness={2} samples={isMobile ? 2 : 4} />
  </mesh>
)

function Status({ isMobile, ...props }) {
  const [loc] = useLocation()
  return (
    <Text fontSize={isMobile ? 8 : 14} letterSpacing={-0.025} font={suspend(inter).default} color="black" {...props}>
      {loc}
      <Html style={{ color: "transparent", fontSize: isMobile ? "20em" : "33.5em" }} transform>
        {loc}
      </Html>
    </Text>
  )
}

const causeData = {
  "/rights": {
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
  const cause = causeData[loc] || causeData["/rights"]
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
      <p className="tagline">Data-driven founder + 2x public exits.<br />Super-Dad. WIP-Human.</p>
      <p className="current-role">
        Founder/CEO @ <a href="https://subconscious.ai" target="_blank" rel="noopener noreferrer">Subconscious AI</a> — Building systems that explain and predict human behavior.
      </p>
      <p className="experience">
        Previously: CSO @ Engine No. 1, Analytics Lead @ Two Sigma, Offering Director @ IBM Watson Research.
        Founder, WAHA Technologies (acquired by CleanSpark). Founder, CleanEdison (acquired by Kaplan).
      </p>
      <p className="education">
        BS in Comp Sci @JohnsHopkins, MBA @NYUStern.
      </p>
      <p className="awards">
        Green Startup of the Year — Excellence in Education.
      </p>
      <div className="social-links">
        <a href="mailto:avi.yashchin@gmail.com">Email</a>
        <a href="https://www.linkedin.com/in/aviyashchin/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        <a href="https://github.com/aviyashchin" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="https://www.instagram.com/aviyashchin/" target="_blank" rel="noopener noreferrer">Instagram</a>
      </div>
    </div>
  )
}
