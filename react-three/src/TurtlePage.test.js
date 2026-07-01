import React from "react"
import { act } from "react-dom/test-utils"
import { createRoot } from "react-dom/client"

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let canvasProps
let heartbeatProps

jest.mock("three", () => ({
  DoubleSide: 2,
  FrontSide: 0,
  MeshPhongMaterial: jest.fn(function MeshPhongMaterial(props) {
    Object.assign(this, props)
  })
}))

jest.mock("@react-three/fiber", () => ({
  Canvas: ({ children, ...props }) => {
    const React = require("react")
    const heartbeat = React.Children.toArray(children).find((child) => child.type?.name?.includes("Invalidate"))

    canvasProps = props
    heartbeatProps = heartbeat?.props

    return <div data-testid="turtle-canvas" />
  },
  useFrame: jest.fn(),
  useThree: jest.fn()
}))

jest.mock("@react-three/drei", () => ({
  Float: ({ children }) => <div>{children}</div>,
  useGLTF: jest.fn(() => ({
    nodes: { Cube: { geometry: {} } },
    scene: { rotation: { z: 0 } },
    animations: []
  })),
  useAnimations: jest.fn(() => ({
    actions: {},
    mixer: { timeScale: 1 }
  })),
  Instance: () => <div />,
  Instances: ({ children }) => <div>{children}</div>,
  CameraControls: () => <div />
}))

describe("TurtleCanvas", () => {
  const { TurtleCanvas, optimizeTurtleMaterials } = require("./TurtlePage")
  const { DoubleSide, FrontSide, MeshPhongMaterial } = require("three")
  let container
  let root

  beforeEach(() => {
    canvasProps = undefined
    heartbeatProps = undefined
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("uses the continuous frame loop for smooth idle animation", () => {
    act(() => root.render(<TurtleCanvas />))

    expect(canvasProps.frameloop).toBeUndefined()
  })

  it("caps the internal drawing buffer below full DPR", () => {
    act(() => root.render(<TurtleCanvas />))

    expect(canvasProps.dpr).toBe(0.5)
  })

  it("uses flat canvas color output to avoid extra tone-mapping work", () => {
    act(() => root.render(<TurtleCanvas />))

    expect(canvasProps.flat).toBe(true)
  })

  it("does not cap idle animation with a manual invalidation heartbeat", () => {
    act(() => root.render(<TurtleCanvas />))

    expect(heartbeatProps).toBeUndefined()
  })

  it("replaces turtle PBR materials with front-sided textured Phong materials", () => {
    const map = { isTexture: true }
    const alphaMap = { isTexture: true }
    const material = {
      color: "green",
      map,
      alphaMap,
      transparent: true,
      opacity: 0.8,
      side: DoubleSide,
      skinning: true
    }
    const object = { material }
    const scene = { traverse: (visit) => visit(object) }

    optimizeTurtleMaterials(scene)

    expect(MeshPhongMaterial).toHaveBeenCalledWith({
      color: "green",
      map,
      alphaMap,
      transparent: true,
      opacity: 0.8,
      side: FrontSide,
      skinning: true
    })
    expect(object.material).toBeInstanceOf(MeshPhongMaterial)
  })
})
