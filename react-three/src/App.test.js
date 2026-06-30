import React from "react"
import { act } from "react-dom/test-utils"
import { createRoot } from "react-dom/client"
import { App } from "./App"

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let canvasProps
let mockEffectComposer
let mockMeshTransmissionMaterial
let mockUseFrame
let consoleErrorSpy
const originalConsoleError = console.error

beforeEach(() => {
  canvasProps = undefined
  mockEffectComposer = jest.fn()
  mockMeshTransmissionMaterial = jest.fn()
  mockUseFrame = jest.fn()
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    const text = [message, ...args].join(" ")
    if (text.includes("unrecognized") || text.includes("incorrect casing") || text.includes("does not recognize")) return
    originalConsoleError(message, ...args)
  })
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

jest.mock("@pmndrs/assets/fonts/inter_regular.woff", () => ({
  __esModule: true,
  default: "mock-font"
}))

jest.mock("@react-three/fiber", () => ({
  Canvas: ({ children, ...props }) => {
    canvasProps = props
    return <div data-testid="canvas">{children}</div>
  },
  useFrame: (...args) => mockUseFrame(...args)
}))

jest.mock("@react-three/drei", () => ({
  Float: ({ children }) => <div>{children}</div>,
  Lightformer: () => <div />,
  Text: ({ children }) => <span>{children}</span>,
  Html: ({ children }) => <span>{children}</span>,
  ContactShadows: () => <div />,
  Environment: ({ children }) => <div>{children}</div>,
  MeshTransmissionMaterial: (...args) => {
    mockMeshTransmissionMaterial(...args)
    return <div />
  }
}))

jest.mock("@react-three/postprocessing", () => ({
  Bloom: () => <div />,
  EffectComposer: ({ children }) => {
    mockEffectComposer()
    return <div>{children}</div>
  },
  N8AO: () => <div />,
  TiltShift2: () => <div />
}))

jest.mock("./TurtlePage", () => ({
  TurtleCanvas: () => <div data-testid="turtle-canvas" />
}))

jest.mock("wouter", () => ({
  Link: ({ children, to, className }) => (
    <a className={className} href={to}>{children}</a>
  ),
  Route: ({ children, path }) => (
    globalThis.location.pathname === path ? <>{children}</> : null
  ),
  useLocation: () => [globalThis.location.pathname]
}))

jest.mock("suspend-react", () => ({
  suspend: () => ({ default: "mock-font" })
}))

jest.mock("maath", () => ({
  easing: { damp3: jest.fn() }
}))

describe("App about route", () => {
  let container
  let root

  beforeEach(() => {
    window.history.pushState({}, "", "/about")
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    window.history.pushState({}, "", "/")
  })

  it("renders the about page at /about", async () => {
    await act(async () => root.render(<App />))

    expect(container.textContent).toContain("Data-driven founder")
    expect(container.textContent).toContain("Subconscious AI")
    expect(container.textContent).not.toContain("Non-Human Rights")
    expect(container.querySelector(".nav a.active")?.textContent).toBe("about")
  })
})

describe("App demos route", () => {
  let container
  let root

  beforeEach(() => {
    window.history.pushState({}, "", "/demos")
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    window.history.pushState({}, "", "/")
  })

  it("renders the hidden demos page with official Three.js examples", async () => {
    await act(async () => root.render(<App />))

    const frames = Array.from(container.querySelectorAll("iframe"))
    const sources = frames.map((frame) => frame.getAttribute("src"))

    expect(frames).toHaveLength(4)
    expect(sources).toEqual(expect.arrayContaining([
      "https://threejs.org/examples/webgl_buffergeometry_drawrange.html",
      "https://threejs.org/examples/webgl_postprocessing_pixel.html",
      "https://threejs.org/examples/css3d_mixed.html",
      "https://threejs.org/examples/webgpu_compute_cloth.html"
    ]))
    expect(container.textContent).toContain("CSS3D Mixed")
    expect(container.textContent).toContain("WebGPU Compute Cloth")
    expect(container.querySelector(".nav")?.textContent || "").not.toContain("demos")
  })
})

describe("App rights route performance", () => {
  let container
  let root

  beforeEach(() => {
    window.history.pushState({}, "", "/rights")
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    window.history.pushState({}, "", "/")
  })

  it("keeps the rights scene static and avoids expensive postprocessing", async () => {
    await act(async () => root.render(<App />))

    expect(canvasProps.frameloop).toBe("demand")
    expect(canvasProps.dpr).toEqual([1, 1])
    expect(mockUseFrame).not.toHaveBeenCalled()
    expect(mockEffectComposer).not.toHaveBeenCalled()
    expect(mockMeshTransmissionMaterial).not.toHaveBeenCalled()
  })
})
