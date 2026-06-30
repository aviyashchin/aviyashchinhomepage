import React from "react"
import { act } from "react-dom/test-utils"
import { createRoot } from "react-dom/client"

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let canvasProps
const mockInvalidate = jest.fn()
let mockIntervalCallback

jest.mock("@react-three/fiber", () => ({
  Canvas: ({ children, ...props }) => {
    canvasProps = props
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
  const { useThree } = require("@react-three/fiber")
  const { TurtleCanvas, AutoInvalidate } = require("./TurtlePage")
  let container
  let root

  beforeEach(() => {
    canvasProps = undefined
    mockInvalidate.mockClear()
    useThree.mockReturnValue({ invalidate: mockInvalidate })
    mockIntervalCallback = undefined
    global.setInterval = jest.fn((callback) => {
      mockIntervalCallback = callback
      return 1
    })
    global.clearInterval = jest.fn()
    window.setInterval = global.setInterval
    window.clearInterval = global.clearInterval
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("keeps the optimized demand frame loop", () => {
    act(() => root.render(<TurtleCanvas />))

    expect(canvasProps.frameloop).toBe("demand")
  })

  it("invalidates frames automatically so the turtle animates without a click", async () => {
    await act(async () => root.render(<AutoInvalidate fps={8} />))

    expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 125)
    expect(mockInvalidate).not.toHaveBeenCalled()

    act(() => mockIntervalCallback())
    expect(mockInvalidate).toHaveBeenCalledTimes(1)
  })
})
