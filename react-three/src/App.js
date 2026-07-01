import { lazy, Suspense, useState, useEffect } from 'react'
import { Canvas, useFrame } from "@react-three/fiber"
import { Float, Lightformer, Text, ContactShadows, Environment, MeshTransmissionMaterial } from "@react-three/drei"
import { Bloom, EffectComposer, N8AO, TiltShift2 } from "@react-three/postprocessing"
import { Route, Link, useLocation } from "wouter"
import { suspend } from "suspend-react"
import { easing } from "maath"
import { DemosPage } from "./DemosPage"

const inter = import("@pmndrs/assets/fonts/inter_regular.woff")

// Lazy load turtle page (2MB model)
const TurtlePage = lazy(() => import('./TurtlePage').then(m => ({ default: m.TurtleCanvas })))
const WebGPUClothPage = lazy(() => import('./WebGPUClothPage').then(m => ({ default: m.WebGPUClothPage })))

const mainSceneQuality = {
  mobile: {
    dpr: [1, 1.25],
    transmission: { samples: 2, resolution: 256, backsideResolution: 128 },
    contactShadowResolution: 192,
    composerMultisampling: 0,
    bloomLevels: 4
  },
  desktop: {
    dpr: [1, 1.5],
    transmission: { samples: 2, resolution: 256, backsideResolution: 128 },
    contactShadowResolution: 256,
    composerMultisampling: 0,
    bloomLevels: 4
  }
}

export const App = () => {
  const [loc] = useLocation()
  const isAbout = loc === "/" || loc === "/about" || loc === "/about/"
  const isDemos = loc === "/demos" || loc === "/demos/"
  const isCloth = loc === "/cloth" || loc === "/cloth/"

  if (isDemos) {
    return <DemosPage />
  }

  return (
    <>
      {isAbout ? (
        <Suspense fallback={<div className="loading">Loading...</div>}>
          <TurtlePage />
        </Suspense>
      ) : isCloth ? (
        <Suspense fallback={<div className="loading">Loading...</div>}>
          <WebGPUClothPage />
        </Suspense>
      ) : (
        <MainCanvas />
      )}
      <div className="nav">
        <Link to="/" className={isAbout ? "active" : ""}>about</Link>
        <Link to="/rights" className={loc === "/rights" ? "active" : ""}>rights</Link>
        <Link to="/activism" className={loc === "/activism" ? "active" : ""}>activism</Link>
        <Link to="/charity" className={loc === "/charity" ? "active" : ""}>charity</Link>
      </div>
      {isAbout ? <AboutOverlay /> : <CauseInfo />}
    </>
  )
}

// Main canvas with shapes
function MainCanvas() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const quality = isMobile ? mainSceneQuality.mobile : mainSceneQuality.desktop

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
      gl={{ powerPreference: "high-performance" }}
      dpr={quality.dpr}
      camera={{ position: [0, 0, 20], fov: 50 }}
    >
      <color attach="background" args={["#e0e0e0"]} />
      <spotLight position={[20, 20, 10]} penumbra={1} castShadow angle={0.2} />
      <Status position={[0, 0, isMobile ? -50 : -10]} isMobile={isMobile} />
      <Float floatIntensity={2}>
        <Route path="/rights">
          <Knot isMobile={isMobile} transmissionQuality={quality.transmission} />
        </Route>
        <Route path="/activism">
          <ShapeTorus isMobile={isMobile} transmissionQuality={quality.transmission} />
        </Route>
        <Route path="/charity">
          <Dodecahedron isMobile={isMobile} transmissionQuality={quality.transmission} />
        </Route>
      </Float>
      <ContactShadows scale={100} position={[0, -7.5, 0]} blur={1} far={100} opacity={0.85} resolution={quality.contactShadowResolution} />
      <Environment resolution={isMobile ? 128 : 256}>
        <Lightformer intensity={8} position={[10, 5, 0]} scale={[10, 50, 1]} onUpdate={(self) => self.lookAt(0, 0, 0)} />
        <Lightformer intensity={2} position={[-10, 5, 0]} scale={[10, 50, 1]} />
        <Lightformer intensity={4} position={[0, 10, 0]} scale={[50, 10, 1]} rotation-x={Math.PI / 2} />
      </Environment>
      <EffectComposer disableNormalPass multisampling={quality.composerMultisampling}>
        <N8AO aoRadius={1} intensity={isMobile ? 1 : 2} />
        <Bloom mipmapBlur luminanceThreshold={0.8} intensity={isMobile ? 1 : 2} levels={quality.bloomLevels} />
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

const GlassMaterial = ({ quality }) => (
  <MeshTransmissionMaterial backside backsideThickness={5} thickness={2} {...quality} />
)

const ShapeTorus = ({ isMobile, transmissionQuality, ...props }) => (
  <mesh receiveShadow castShadow {...props}>
    <torusGeometry args={isMobile ? [4, 1.2, 64, 32] : [4, 1.2, 128, 64]} />
    <GlassMaterial quality={transmissionQuality} />
  </mesh>
)

const Knot = ({ isMobile, transmissionQuality, ...props }) => (
  <mesh receiveShadow castShadow {...props}>
    <torusKnotGeometry args={isMobile ? [3, 1, 128, 16] : [3, 1, 128, 16]} />
    <GlassMaterial quality={transmissionQuality} />
  </mesh>
)

const Dodecahedron = ({ isMobile, transmissionQuality, ...props }) => (
  <mesh receiveShadow castShadow {...props}>
    <dodecahedronGeometry args={[4, 0]} />
    <GlassMaterial quality={transmissionQuality} />
  </mesh>
)

function Status({ isMobile, ...props }) {
  const [loc] = useLocation()
  return (
    <Text fontSize={isMobile ? 8 : 14} letterSpacing={-0.025} font={suspend(inter).default} color="black" {...props}>
      {loc}
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
  },
  "/cloth": {
    title: "WebGPU Cloth",
    description: "Transparent compute-cloth study adapted from the Three.js WebGPU cloth demo.",
    url: "https://threejs.org/examples/webgpu_compute_cloth.html"
  }
}

function CauseInfo() {
  const [loc] = useLocation()
  const normalizedLoc = loc.endsWith("/") && loc.length > 1 ? loc.slice(0, -1) : loc
  const cause = causeData[normalizedLoc] || causeData["/rights"]
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
        <a href="https://www.linkedin.com/in/aviyashchin/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        <a href="https://github.com/aviyashchin" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="https://www.instagram.com/aviyashchin/" target="_blank" rel="noopener noreferrer">Instagram</a>
      </div>
    </div>
  )
}
