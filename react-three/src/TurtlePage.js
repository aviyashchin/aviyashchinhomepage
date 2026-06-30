import { Canvas } from "@react-three/fiber"
import { useGLTF, CameraControls } from "@react-three/drei"

// GLB models (local files in public folder)
const TURTLE_MODEL = '/turtle-draco.glb'

// Turtle aquarium canvas
export function TurtleCanvas() {
  return (
    <div className="turtle-stage" aria-hidden="true">
      <Canvas
        className="turtle-canvas"
        dpr={[1, 1]}
        frameloop="demand"
        gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
        camera={{ position: [30, 0, -3], fov: 35, near: 1, far: 50 }}
      >
        <ambientLight intensity={0.45} />
        <directionalLight position={[-5, 10, -5]} intensity={1.5} />
        <Turtle position={[0, -0.5, -1]} rotation={[0, Math.PI, 0]} scale={55} />
        <CameraControls truckSpeed={0} dollySpeed={0} minPolarAngle={0} maxPolarAngle={Math.PI / 2} />
      </Canvas>
    </div>
  )
}

// Turtle model by DigitalLife3D, CC-BY-NC-4.0.
function Turtle(props) {
  const { scene } = useGLTF(TURTLE_MODEL)
  return <primitive object={scene} {...props} />
}
