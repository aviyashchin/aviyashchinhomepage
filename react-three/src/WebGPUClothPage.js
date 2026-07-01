import { useEffect, useRef, useState } from "react"
import { createWebGPUClothScene } from "./webgpuClothScene"

export function WebGPUClothPage() {
  const stageRef = useRef(null)
  const [state, setState] = useState("loading")

  useEffect(() => {
    const stage = stageRef.current

    if (!stage || !navigator.gpu) {
      setState("fallback")
      return undefined
    }

    let disposed = false
    let sceneHandle = null

    createWebGPUClothScene(stage)
      .then((handle) => {
        if (disposed) {
          handle.dispose()
          return
        }

        sceneHandle = handle
        setState("ready")
      })
      .catch(() => {
        if (!disposed) setState("fallback")
      })

    return () => {
      disposed = true
      if (sceneHandle) sceneHandle.dispose()
    }
  }, [])

  return (
    <main className="cloth-page" data-webgpu-state={state}>
      <div className="cloth-route-label">/cloth</div>
      <div className="cloth-stage" data-testid="webgpu-cloth-stage" ref={stageRef} aria-hidden="true">
        {state === "fallback" ? (
          <div className="cloth-fallback-visual">
            <div className="cloth-fallback-ball" />
            <div className="cloth-fallback-sheet" />
          </div>
        ) : null}
      </div>
    </main>
  )
}
