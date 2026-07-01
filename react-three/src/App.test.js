import React from "react"
import { act } from "react-dom/test-utils"
import { createRoot } from "react-dom/client"
import { App } from "./App"

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mockSerializeProps = ({ children, ...props }) => JSON.stringify(props)

jest.mock("@pmndrs/assets/fonts/inter_regular.woff", () => ({
  __esModule: true,
  default: "mock-font"
}))

jest.mock("@react-three/fiber", () => ({
  Canvas: ({ children, ...props }) => <div data-testid="canvas" data-props={mockSerializeProps(props)}>{children}</div>,
  useFrame: jest.fn()
}))

jest.mock("@react-three/drei", () => ({
  Float: ({ children }) => <div>{children}</div>,
  Lightformer: () => <div />,
  Text: ({ children }) => <span>{children}</span>,
  Html: ({ children }) => <span>{children}</span>,
  ContactShadows: (props) => <div data-testid="contact-shadows" data-props={mockSerializeProps(props)} />,
  Environment: ({ children }) => <div>{children}</div>,
  MeshTransmissionMaterial: (props) => <div data-testid="mesh-transmission-material" data-props={mockSerializeProps(props)} />
}))

jest.mock("@react-three/postprocessing", () => ({
  Bloom: (props) => <div data-testid="bloom" data-props={mockSerializeProps(props)} />,
  EffectComposer: ({ children, ...props }) => <div data-testid="effect-composer" data-props={mockSerializeProps(props)}>{children}</div>,
  N8AO: (props) => <div data-testid="n8ao" data-props={mockSerializeProps(props)} />,
  TiltShift2: (props) => <div data-testid="tilt-shift" data-props={mockSerializeProps(props)} />
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

const readProps = (container, testId) => JSON.parse(container.querySelector(`[data-testid="${testId}"]`)?.getAttribute("data-props") || "{}")

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

describe("App cause route render loops", () => {
  let container
  let root

  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1440
    })
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    window.history.pushState({}, "", "/")
  })

  it("keeps /rights on the continuous frame loop without reducing scene quality", async () => {
    window.history.pushState({}, "", "/rights")

    await act(async () => root.render(<App />))

    expect(readProps(container, "canvas")).toEqual(expect.objectContaining({
      dpr: [1, 1.5],
      gl: { powerPreference: "high-performance" }
    }))
    expect(readProps(container, "canvas").frameloop).toBeUndefined()

    const materialProps = readProps(container, "mesh-transmission-material")
    expect(materialProps).toEqual(expect.objectContaining({
      backside: true,
      backsideThickness: 5,
      thickness: 2,
      samples: 2,
      resolution: 256,
      backsideResolution: 128
    }))

    expect(readProps(container, "contact-shadows")).toEqual(expect.objectContaining({
      scale: 100,
      blur: 1,
      far: 100,
      opacity: 0.85,
      resolution: 256
    }))

    expect(readProps(container, "effect-composer")).toEqual(expect.objectContaining({
      disableNormalPass: true,
      multisampling: 0
    }))
    expect(readProps(container, "n8ao").intensity).toBe(2)
    expect(readProps(container, "bloom")).toEqual(expect.objectContaining({
      intensity: 2,
      levels: 4
    }))
    expect(readProps(container, "tilt-shift").blur).toBe(0.2)
  })

  it("keeps /activism on the continuous frame loop for visible idle motion", async () => {
    window.history.pushState({}, "", "/activism")

    await act(async () => root.render(<App />))

    expect(readProps(container, "canvas").frameloop).toBeUndefined()
  })

  it("keeps /charity on the continuous frame loop for visible idle motion", async () => {
    window.history.pushState({}, "", "/charity")

    await act(async () => root.render(<App />))

    expect(readProps(container, "canvas").frameloop).toBeUndefined()
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
