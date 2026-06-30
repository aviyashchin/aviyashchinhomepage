const DEMO_EXAMPLES = [
  {
    title: "Draw Range",
    label: "WebGL BufferGeometry",
    url: "https://threejs.org/examples/webgl_buffergeometry_drawrange.html",
    note: "Animated particles and line draw ranges."
  },
  {
    title: "Pixel Pass",
    label: "WebGL Postprocessing",
    url: "https://threejs.org/examples/webgl_postprocessing_pixel.html",
    note: "Pixelated render pass with outline controls."
  },
  {
    title: "CSS3D Mixed",
    label: "CSS and WebGL",
    url: "https://threejs.org/examples/css3d_mixed.html",
    note: "Layered CSS3D panels with WebGL geometry."
  },
  {
    title: "WebGPU Compute Cloth",
    label: "WebGPU",
    url: "https://threejs.org/examples/webgpu_compute_cloth.html",
    note: "Compute-shader cloth simulation. Requires WebGPU support."
  }
]

export function DemosPage() {
  return (
    <main className="demos-page">
      <header className="demos-header">
        <div>
          <p className="demos-kicker">Hidden lab</p>
          <h1>Three.js demos</h1>
        </div>
        <a className="demos-home" href="/">Back to site</a>
      </header>

      <section className="demos-note" aria-label="Demo caveats">
        <p>
          These examples run inside cross-origin iframes from threejs.org. WebGPU
          support depends on the browser, GPU, hardware acceleration, and origin
          policy; unsupported browsers will show the upstream fallback.
        </p>
      </section>

      <section className="demos-grid" aria-label="Three.js example frames">
        {DEMO_EXAMPLES.map((demo) => (
          <article className="demo-card" key={demo.url}>
            <div className="demo-card-header">
              <div>
                <p>{demo.label}</p>
                <h2>{demo.title}</h2>
              </div>
              <a href={demo.url} target="_blank" rel="noreferrer">Open</a>
            </div>
            <iframe
              title={demo.title}
              src={demo.url}
              loading="lazy"
              referrerPolicy="no-referrer"
              allow="fullscreen; xr-spatial-tracking"
            />
            <p className="demo-note">{demo.note}</p>
          </article>
        ))}
      </section>
    </main>
  )
}
