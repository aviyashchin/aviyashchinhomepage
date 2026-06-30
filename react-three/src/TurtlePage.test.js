import React from "react"
import { act } from "react-dom/test-utils"
import { createRoot } from "react-dom/client"

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let canvasProps
let heartbeatProps

jest.mock("three", () => ({
  DoubleSide: 2,
  FrontSide: 0
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
  const { TurtleCanvas, setFrontSideMaterials } = require("./TurtlePage")
  const { DoubleSide, FrontSide } = require("three")
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

    expect(canvasProps.dpr).toBe(0.75)
  })

  it("does not cap idle animation with a manual invalidation heartbeat", () => {
    act(() => root.render(<TurtleCanvas />))

    expect(heartbeatProps).toBeUndefined()
  })

  it("renders turtle materials front-sided to avoid extra fragment work", () => {
    const material = { side: DoubleSide, needsUpdate: false }
    const scene = { traverse: (visit) => visit({ material }) }

    setFrontSideMaterials(scene)

    expect(material.side).toBe(FrontSide)
    expect(material.needsUpdate).toBe(true)
  })
})
