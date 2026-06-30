import { lazy, Suspense, useState, useEffect } from 'react'
import { Canvas } from "@react-three/fiber"
import { Text, Html } from "@react-three/drei"
import { Route, Link, useLocation } from "wouter"
import { suspend } from "suspend-react"
import { DemosPage } from "./DemosPage"

const inter = import("@pmndrs/assets/fonts/inter_regular.woff")

// Lazy load turtle page (2MB model)
const TurtlePage = lazy(() => import('./TurtlePage').then(m => ({ default: m.TurtleCanvas })))

export const App = () => {
  const [loc] = useLocation()
  const isAbout = loc === "/" || loc === "/about" || loc === "/about/"
  const isDemos = loc === "/demos" || loc === "/demos/"

  if (isDemos) {
    return <DemosPage />
  }

  return (
    <>
      {isAbout ? (
        <Suspense fallback={<div className="loading">Loading...</div>}>
          <TurtlePage />
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

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <Canvas
      eventSource={document.getElementById("root")}
      eventPrefix="client"
      frameloop="demand"
      gl={{ antialias: false, powerPreference: "high-performance" }}
      dpr={[1, 1]}
      camera={{ position: [0, 0, 20], fov: 50 }}
    >
      <color attach="background" args={["#e0e0e0"]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[8, 10, 8]} intensity={1.8} />
      <Status position={[0, 0, isMobile ? -50 : -10]} isMobile={isMobile} />
      <Route path="/rights">
        <Knot isMobile={isMobile} />
      </Route>
      <Route path="/activism">
        <ShapeTorus isMobile={isMobile} />
      </Route>
      <Route path="/charity">
        <Dodecahedron isMobile={isMobile} />
      </Route>
    </Canvas>
  )
}

const ShapeTorus = ({ isMobile, ...props }) => (
  <mesh {...props}>
    <torusGeometry args={isMobile ? [4, 1.2, 48, 24] : [4, 1.2, 96, 32]} />
    <CauseMaterial />
  </mesh>
)

const Knot = ({ isMobile, ...props }) => (
  <mesh {...props}>
    <torusKnotGeometry args={isMobile ? [3, 1, 96, 12] : [3, 1, 160, 18]} />
    <CauseMaterial />
  </mesh>
)

const Dodecahedron = ({ isMobile, ...props }) => (
  <mesh {...props}>
    <dodecahedronGeometry args={[4, 0]} />
    <CauseMaterial />
  </mesh>
)

function CauseMaterial() {
  return <meshStandardMaterial color="#f0f0f0" roughness={0.35} metalness={0.12} />
}

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
        <a href="https://www.linkedin.com/in/aviyashchin/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        <a href="https://github.com/aviyashchin" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="https://www.instagram.com/aviyashchin/" target="_blank" rel="noopener noreferrer">Instagram</a>
      </div>
    </div>
  )
}
