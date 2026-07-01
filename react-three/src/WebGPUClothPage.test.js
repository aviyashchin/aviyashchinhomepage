import React from "react"
import { act } from "react-dom/test-utils"
import { createRoot } from "react-dom/client"
import { WebGPUClothPage } from "./WebGPUClothPage"
import { createWebGPUClothScene } from "./webgpuClothScene"

globalThis.IS_REACT_ACT_ENVIRONMENT = true

jest.mock("./webgpuClothScene", () => ({
  createWebGPUClothScene: jest.fn()
}), { virtual: true })

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("WebGPUClothPage", () => {
  let container
  let root
  let originalGpu

  beforeEach(() => {
    originalGpu = navigator.gpu
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    createWebGPUClothScene.mockReset()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: originalGpu
    })
  })

  it("uses the graceful fallback when WebGPU is unavailable", async () => {
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: undefined
    })

    await act(async () => root.render(<WebGPUClothPage />))

    expect(createWebGPUClothScene).not.toHaveBeenCalled()
    expect(container.querySelector('[data-webgpu-state="fallback"]')).not.toBeNull()
  })

  it("mounts and disposes the WebGPU cloth scene when WebGPU is available", async () => {
    const dispose = jest.fn()
    createWebGPUClothScene.mockResolvedValue({ dispose })
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: {}
    })

    await act(async () => {
      root.render(<WebGPUClothPage />)
      await flushPromises()
    })

    const stage = container.querySelector('[data-testid="webgpu-cloth-stage"]')
    expect(stage).not.toBeNull()
    expect(createWebGPUClothScene).toHaveBeenCalledWith(stage)

    act(() => root.unmount())

    expect(dispose).toHaveBeenCalled()
  })
})
