import * as THREE from "three-webgpu/webgpu"
import {
  cos,
  float,
  instanceIndex,
  sin,
  storage,
  timerLocal,
  tslFn,
  uniform,
  vec3
} from "three-webgpu/tsl"

const CLOTH_WIDTH = 2.45
const CLOTH_HEIGHT = 1.65
const CLOTH_SEGMENTS_X = 72
const CLOTH_SEGMENTS_Y = 48
const SPHERE_RADIUS = 0.68

export async function createWebGPUClothScene(mount) {
  const renderer = new THREE.WebGPURenderer({
    alpha: true,
    antialias: true,
    powerPreference: "high-performance"
  })

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 20)
  camera.position.set(0, 0.02, 4.35)
  camera.lookAt(0, -0.04, 0)

  scene.add(new THREE.AmbientLight(0xffffff, 1.6))

  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2)
  keyLight.position.set(2.8, 3.5, 3.2)
  scene.add(keyLight)

  const rimLight = new THREE.DirectionalLight(0x96d8ff, 1.4)
  rimLight.position.set(-2.5, 1.4, -2.2)
  scene.add(rimLight)

  const clothMesh = createClothMesh()
  scene.add(clothMesh.mesh)

  const sphereCenter = uniform(new THREE.Vector3(0, -0.08, 0.04))
  const sphere = createGlassSphere()
  scene.add(sphere.group)

  const computeCloth = createClothCompute(clothMesh, sphereCenter)

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.domElement.className = "cloth-webgpu-canvas"
  renderer.domElement.dataset.motionProbe = "webgpu-cloth"

  const resize = () => {
    const rect = mount.getBoundingClientRect()
    const width = Math.max(1, Math.floor(rect.width))
    const height = Math.max(1, Math.floor(rect.height))

    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
  }

  resize()

  await renderer.init()

  mount.appendChild(renderer.domElement)

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(mount)

  let disposed = false
  let frameInFlight = false

  const render = async (now = 0) => {
    if (disposed || frameInFlight) return

    frameInFlight = true

    try {
      const seconds = now * 0.001
      sphereCenter.value.set(Math.sin(seconds * 0.7) * 0.07, -0.08 + Math.sin(seconds * 0.45) * 0.025, 0.04)
      sphere.group.position.copy(sphereCenter.value)
      sphere.group.rotation.set(seconds * 0.18, seconds * 0.28, seconds * 0.12)

      await renderer.computeAsync(computeCloth)
      renderer.render(scene, camera)
    } finally {
      frameInFlight = false
    }
  }

  await renderer.setAnimationLoop(render)

  return {
    dispose() {
      disposed = true
      resizeObserver.disconnect()
      renderer.setAnimationLoop(null)

      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement)
      }

      clothMesh.geometry.dispose()
      clothMesh.material.dispose()
      sphere.geometry.dispose()
      sphere.material.dispose()
      sphere.ringGeometry.dispose()
      sphere.ringMaterial.dispose()
      renderer.dispose()
    }
  }
}

function createClothMesh() {
  const geometry = new THREE.PlaneGeometry(CLOTH_WIDTH, CLOTH_HEIGHT, CLOTH_SEGMENTS_X, CLOTH_SEGMENTS_Y)
  const basePosition = geometry.attributes.position.clone()
  const baseNormal = geometry.attributes.normal.clone()
  const positionStorage = new THREE.StorageBufferAttribute(basePosition.count, 4)
  const normalStorage = new THREE.StorageBufferAttribute(baseNormal.count, 4)

  geometry.setAttribute("position", positionStorage)
  geometry.setAttribute("normal", normalStorage)

  const material = new THREE.MeshStandardNodeMaterial({
    color: 0x1f5f8f,
    opacity: 0.62,
    roughness: 0.3,
    side: THREE.DoubleSide,
    transparent: true
  })
  material.depthWrite = false

  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.position.set(0, 0.02, 0)

  return {
    baseNormal,
    basePosition,
    geometry,
    material,
    mesh,
    normalStorage,
    positionStorage
  }
}

function createClothCompute(clothMesh, sphereCenter) {
  const basePosition = storage(clothMesh.basePosition, "vec3", clothMesh.basePosition.count).toReadOnly()
  const baseNormal = storage(clothMesh.baseNormal, "vec3", clothMesh.baseNormal.count).toReadOnly()
  const positionStorage = storage(clothMesh.positionStorage, "vec4", clothMesh.positionStorage.count)
  const normalStorage = storage(clothMesh.normalStorage, "vec4", clothMesh.normalStorage.count)
  const sphereRadius = uniform(SPHERE_RADIUS)

  const computeFn = tslFn(() => {
    const base = vec3(basePosition.element(instanceIndex))
    const normal = vec3(baseNormal.element(instanceIndex))
    const time = timerLocal(0.85)

    const fold = sin(base.x.mul(5.2).add(time.mul(2.4))).mul(0.075)
      .add(cos(base.y.mul(6.5).sub(time.mul(1.35))).mul(0.045))
    const sag = float(CLOTH_HEIGHT * 0.5).sub(base.y).mul(0.12)
    const displaced = vec3(base.x, base.y.sub(sag).add(fold.mul(0.24)), base.z.add(fold)).toVar()

    const sphereDelta = displaced.sub(sphereCenter)
    const sphereDistance = sphereDelta.length().max(0.001)
    const spherePush = sphereRadius.sub(sphereDistance).max(0).mul(0.9)

    displaced.assign(displaced.add(sphereDelta.div(sphereDistance).mul(spherePush)))
    positionStorage.element(instanceIndex).assign(displaced)
    normalStorage.element(instanceIndex).assign(normal)
  })

  return computeFn().compute(clothMesh.basePosition.count)
}

function createGlassSphere() {
  const geometry = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 32)
  const material = new THREE.MeshStandardNodeMaterial({
    color: 0xf8fbff,
    metalness: 0,
    opacity: 0.28,
    roughness: 0.04,
    transparent: true
  })
  material.depthWrite = false

  const group = new THREE.Group()
  const sphere = new THREE.Mesh(geometry, material)
  group.add(sphere)

  const ringGeometry = new THREE.TorusGeometry(SPHERE_RADIUS * 1.01, 0.006, 10, 128)
  const ringMaterial = new THREE.MeshBasicNodeMaterial({
    color: 0xffffff,
    opacity: 0.34,
    transparent: true
  })
  ringMaterial.depthWrite = false

  const rings = [
    [0, 0, 0],
    [Math.PI / 2, 0, 0],
    [0, Math.PI / 2, 0]
  ]

  rings.forEach((rotation) => {
    const ring = new THREE.Mesh(ringGeometry, ringMaterial)
    ring.rotation.set(...rotation)
    group.add(ring)
  })

  return {
    geometry,
    group,
    material,
    ringGeometry,
    ringMaterial
  }
}
