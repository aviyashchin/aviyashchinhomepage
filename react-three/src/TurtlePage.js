import { useEffect } from 'react'
import { Canvas, useFrame } from "@react-three/fiber"
import { Float, Lightformer, Environment, MeshTransmissionMaterial } from "@react-three/drei"
import { useGLTF, useAnimations, Instance, Instances, CameraControls, RandomizedLight, AccumulativeShadows } from "@react-three/drei"

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

// GLB models (local files in public folder)
const AQUARIUM_MODEL = '/shapes-transformed.glb'
const TURTLE_MODEL = '/turtle-draco.glb'

// Turtle aquarium canvas
export function TurtleCanvas() {
  return (
    <Canvas shadows camera={{ position: [30, 0, -3], fov: 35, near: 1, far: 50 }}>
      <color attach="background" args={['#e0e0e0']} />
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
      <AccumulativeShadows temporal frames={60} color="lightblue" colorBlend={2} opacity={0.7} scale={60} position={[0, -5, 0]}>
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

// Aquarium glass container
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
