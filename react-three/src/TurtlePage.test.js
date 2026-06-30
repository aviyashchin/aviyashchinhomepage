import React from "react"
import { act } from "react-dom/test-utils"
import { createRoot } from "react-dom/client"

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let canvasProps
let hasAutoInvalidate
let mockUseGLTF
let mockUseAnimations
let mockUseFrame
let consoleErrorSpy
const originalConsoleError = console.error

jest.mock("@react-three/fiber", () => ({
  Canvas: ({ children, ...props }) => {
    const React = require("react")
    const autoInvalidate = React.Children.toArray(children).find((child) => child.type?.name === "AutoInvalidate")

    canvasProps = props
    hasAutoInvalidate = Boolean(autoInvalidate)

    const renderedChildren = React.Children.toArray(children).filter((child) => typeof child.type === "function")

    return <div data-testid="turtle-canvas">{renderedChildren}</div>
  },
  useFrame: (...args) => mockUseFrame(...args)
}))

jest.mock("@react-three/drei", () => ({
  useGLTF: (...args) => mockUseGLTF(...args),
  useAnimations: (...args) => mockUseAnimations(...args),
  CameraControls: () => <div />
}))

describe("TurtleCanvas", () => {
  const { TurtleCanvas } = require("./TurtlePage")
  let container
  let root

  beforeEach(() => {
    canvasProps = undefined
    hasAutoInvalidate = undefined
    mockUseGLTF = jest.fn(() => ({
      scene: { position: { y: 0 }, rotation: { y: 0, z: 0 } },
      animations: []
    }))
    mockUseAnimations = jest.fn(() => ({
      actions: {},
      mixer: { timeScale: 1 }
    }))
    mockUseFrame = jest.fn()
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
      const text = [message, ...args].join(" ")
      if (text.includes("primitive") && text.includes("unrecognized")) return
      originalConsoleError(message, ...args)
    })
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    consoleErrorSpy.mockRestore()
    container.remove()
  })

  it("uses a static WebGL render with CSS-driven turtle motion", () => {
    act(() => root.render(<TurtleCanvas />))

    expect(canvasProps.frameloop).toBe("demand")
    expect(canvasProps.className).toBe("turtle-canvas")
    expect(hasAutoInvalidate).toBe(false)
    expect(mockUseFrame).not.toHaveBeenCalled()
    expect(mockUseAnimations).not.toHaveBeenCalled()
  })
})
