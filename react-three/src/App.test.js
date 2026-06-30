import React from "react"
import { act } from "react-dom/test-utils"
import { createRoot } from "react-dom/client"
import { App } from "./App"

globalThis.IS_REACT_ACT_ENVIRONMENT = true

jest.mock("@pmndrs/assets/fonts/inter_regular.woff", () => ({
  __esModule: true,
  default: "mock-font"
}))

jest.mock("@react-three/fiber", () => ({
  Canvas: ({ children }) => <div data-testid="canvas">{children}</div>,
  useFrame: jest.fn()
}))

jest.mock("@react-three/drei", () => ({
  Float: ({ children }) => <div>{children}</div>,
  Lightformer: () => <div />,
  Text: ({ children }) => <span>{children}</span>,
  Html: ({ children }) => <span>{children}</span>,
  ContactShadows: () => <div />,
  Environment: ({ children }) => <div>{children}</div>,
  MeshTransmissionMaterial: () => <div />
}))

jest.mock("@react-three/postprocessing", () => ({
  Bloom: () => <div />,
  EffectComposer: ({ children }) => <div>{children}</div>,
  N8AO: () => <div />,
  TiltShift2: () => <div />
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

  it("renders the hidden demos page with official Three.js examples", () => {
    act(() => root.render(<App />))

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
