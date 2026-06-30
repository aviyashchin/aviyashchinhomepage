#!/usr/bin/env node

import { chromium } from "playwright"

const DEFAULT_URL = "http://127.0.0.1:3101/rights"
const DEFAULT_DURATION_MS = 5000
const DEFAULT_TIMEOUT_MS = 15000
const DEFAULT_CHANNEL = "chrome"

function printHelp() {
  console.log(`Usage: npm run perf:rights -- [options]

Profiles the React Three /rights route in Chrome with Playwright.

Options:
  --url <url>          Page URL to profile. Default: ${DEFAULT_URL}
  --duration <ms>      requestAnimationFrame sample window. Default: ${DEFAULT_DURATION_MS}
  --timeout <ms>       Navigation/canvas timeout. Default: ${DEFAULT_TIMEOUT_MS}
  --channel <name>     Chromium channel, e.g. chrome, chrome-beta, msedge.
                       Use "bundled" to use Playwright's bundled Chromium.
                       Default: ${DEFAULT_CHANNEL}
  --headed             Run Chrome headed instead of headless.
  --json               Print only JSON.
  --help               Show this help.
`)
}

function readOption(args, name, fallback) {
  const eq = args.find((arg) => arg.startsWith(`${name}=`))
  if (eq) return eq.slice(name.length + 1)
  const index = args.indexOf(name)
  if (index !== -1 && args[index + 1]) return args[index + 1]
  return fallback
}

function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    return { help: true }
  }

  const duration = Number(readOption(argv, "--duration", DEFAULT_DURATION_MS))
  const timeout = Number(readOption(argv, "--timeout", DEFAULT_TIMEOUT_MS))

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("--duration must be a positive number of milliseconds")
  }

  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new Error("--timeout must be a positive number of milliseconds")
  }

  return {
    help: false,
    url: readOption(argv, "--url", DEFAULT_URL),
    duration,
    timeout,
    channel: readOption(argv, "--channel", DEFAULT_CHANNEL),
    headed: argv.includes("--headed"),
    json: argv.includes("--json")
  }
}

function formatMs(value) {
  return `${Number(value || 0).toFixed(1)}ms`
}

function formatNumber(value, digits = 1) {
  return Number(value || 0).toFixed(digits)
}

function toMetricMap(metrics) {
  return Object.fromEntries(metrics.metrics.map((metric) => [metric.name, metric.value]))
}

function delta(after, before, name) {
  return (after[name] || 0) - (before[name] || 0)
}

function printHuman(report) {
  console.log(`Rights page performance profile
URL: ${report.url}
Status: ${report.status}
Readiness: domcontentloaded + canvas selector; networkidle intentionally skipped
Sample window: ${report.options.duration}ms

Navigation:
  domContentLoaded: ${formatMs(report.timings.domContentLoadedMs)}
  loadEvent:        ${formatMs(report.timings.loadEventMs)}
  responseEnd:      ${formatMs(report.timings.responseEndMs)}

Frame timing:
  frames:     ${report.frames.count}
  avg:        ${formatMs(report.frames.avgMs)} (${formatNumber(report.frames.fpsApprox)} fps)
  min:        ${formatMs(report.frames.minMs)}
  p50/p95/p99:${formatMs(report.frames.p50Ms)} / ${formatMs(report.frames.p95Ms)} / ${formatMs(report.frames.p99Ms)}
  max:        ${formatMs(report.frames.maxMs)}
  >16.7ms:    ${report.frames.over16_7}
  >33.3ms:    ${report.frames.over33_3}
  >50ms:      ${report.frames.over50}

Long tasks:
  supported: ${report.longTasks.supported}
  count:     ${report.longTasks.count}
  total:     ${formatMs(report.longTasks.totalDurationMs)}
  max:       ${formatMs(report.longTasks.maxDurationMs)}

WebGL:
  available: ${report.webgl.available}
  renderer:  ${report.webgl.renderer || "n/a"}
  vendor:    ${report.webgl.vendor || "n/a"}
  buffer:    ${report.webgl.drawingBufferWidth || 0}x${report.webgl.drawingBufferHeight || 0}
  css size:  ${report.webgl.cssWidth || 0}x${report.webgl.cssHeight || 0}
  ratio:     ${formatNumber(report.webgl.pixelRatio, 2)}
  antialias: ${report.webgl.antialias}
  max texture/renderbuffer: ${report.webgl.maxTextureSize || 0} / ${report.webgl.maxRenderbufferSize || 0}
  extensions: ${report.webgl.extensionsCount || 0}

Chrome/CDP:
  task:        ${formatMs(report.cdp.taskDurationMs)}
  script:      ${formatMs(report.cdp.scriptDurationMs)}
  layout:      ${formatMs(report.cdp.layoutDurationMs)}
  recalcStyle: ${formatMs(report.cdp.recalcStyleDurationMs)}
  nodes:       ${report.cdp.nodes}

Console:
  warnings/errors: ${report.console.warningOrErrorCount}
  total messages:  ${report.console.messages.length}

Page errors:       ${report.pageErrors.length}
Request failures:  ${report.requestFailures.length}`)

  if (report.console.messages.length) {
    console.log("\nFirst console messages:")
    for (const message of report.console.messages.slice(0, 8)) {
      console.log(`  [${message.type}] ${message.text}`)
    }
  }

  if (report.requestFailures.length) {
    console.log("\nRequest failures:")
    for (const failure of report.requestFailures.slice(0, 8)) {
      console.log(`  ${failure.failure || "failed"} ${failure.url}`)
    }
  }
}

async function collectInPageMetrics(duration) {
  return window.__profileRightsCollect(duration)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const launchOptions = {
    headless: !options.headed,
    args: ["--enable-unsafe-webgpu", "--enable-unsafe-swiftshader"]
  }

  if (options.channel !== "bundled") {
    launchOptions.channel = options.channel
  }

  let browser

  try {
    browser = await chromium.launch(launchOptions)
  } catch (error) {
    throw new Error(
      `Unable to launch Chromium channel "${options.channel}". Install Google Chrome, pass --channel bundled after running npx playwright install chromium, or pass another installed channel.\n${error.message}`
    )
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  })
  const page = await context.newPage()
  const consoleMessages = []
  const pageErrors = []
  const requestFailures = []

  page.on("console", (message) => {
    consoleMessages.push({
      type: message.type(),
      text: message.text()
    })
  })

  page.on("pageerror", (error) => {
    pageErrors.push(error.message)
  })

  page.on("requestfailed", (request) => {
    requestFailures.push({
      url: request.url(),
      failure: request.failure()?.errorText || "request failed"
    })
  })

  const client = await context.newCDPSession(page)
  await client.send("Performance.enable")
  const beforeMetrics = toMetricMap(await client.send("Performance.getMetrics"))

  try {
    await page.goto(options.url, {
      waitUntil: "domcontentloaded",
      timeout: options.timeout
    })

    await page.waitForSelector("canvas", {
      timeout: options.timeout
    })

    await page.evaluate(() => {
      window.__profileRightsCollect = async (duration) => {
        const longTasks = []
        let longTaskSupported = false
        let longTaskObserver = null

        try {
          longTaskObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              longTasks.push({
                name: entry.name,
                startTime: entry.startTime,
                duration: entry.duration
              })
            }
          })
          longTaskObserver.observe({ type: "longtask", buffered: true })
          longTaskSupported = true
        } catch {
          longTaskSupported = false
        }

        const frames = []
        const start = performance.now()
        let previous = start

        await new Promise((resolve) => {
          function tick(now) {
            frames.push(now - previous)
            previous = now

            if (now - start >= duration) {
              resolve()
              return
            }

            requestAnimationFrame(tick)
          }

          requestAnimationFrame(tick)
          setTimeout(resolve, duration + 2000)
        })

        if (longTaskObserver) longTaskObserver.disconnect()

        const sortedFrames = frames.slice(1).sort((a, b) => a - b)
        const percentile = (amount) => sortedFrames[Math.min(sortedFrames.length - 1, Math.floor(sortedFrames.length * amount))] || 0
        const average = sortedFrames.reduce((sum, frame) => sum + frame, 0) / Math.max(1, sortedFrames.length)
        const totalLongTaskDuration = longTasks.reduce((sum, task) => sum + task.duration, 0)
        const canvas = document.querySelector("canvas")
        const gl = canvas && (canvas.getContext("webgl2") || canvas.getContext("webgl"))
        const navigation = performance.getEntriesByType("navigation")[0]

        let webgl = { available: false }

        if (gl && canvas) {
          const debug = gl.getExtension("WEBGL_debug_renderer_info")
          const extensions = gl.getSupportedExtensions() || []

          webgl = {
            available: true,
            cssWidth: canvas.clientWidth,
            cssHeight: canvas.clientHeight,
            drawingBufferWidth: gl.drawingBufferWidth,
            drawingBufferHeight: gl.drawingBufferHeight,
            pixelRatio: gl.drawingBufferWidth / Math.max(1, canvas.clientWidth),
            vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
            renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
            version: gl.getParameter(gl.VERSION),
            shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
            antialias: gl.getContextAttributes()?.antialias || false,
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
            maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
            extensionsCount: extensions.length,
            extensions: extensions.slice().sort()
          }
        }

        return {
          timings: navigation ? {
            domContentLoadedMs: navigation.domContentLoadedEventEnd,
            loadEventMs: navigation.loadEventEnd,
            responseEndMs: navigation.responseEnd,
            transferSize: navigation.transferSize || 0,
            decodedBodySize: navigation.decodedBodySize || 0
          } : {},
          frames: {
            count: sortedFrames.length,
            avgMs: average,
            fpsApprox: average > 0 ? 1000 / average : 0,
            minMs: sortedFrames[0] || 0,
            p50Ms: percentile(0.50),
            p95Ms: percentile(0.95),
            p99Ms: percentile(0.99),
            maxMs: sortedFrames[sortedFrames.length - 1] || 0,
            over16_7: sortedFrames.filter((frame) => frame > 16.7).length,
            over33_3: sortedFrames.filter((frame) => frame > 33.3).length,
            over50: sortedFrames.filter((frame) => frame > 50).length
          },
          longTasks: {
            supported: longTaskSupported,
            count: longTasks.length,
            totalDurationMs: totalLongTaskDuration,
            maxDurationMs: Math.max(0, ...longTasks.map((task) => task.duration)),
            entries: longTasks.slice(0, 20)
          },
          webgl
        }
      }
    })

    await page.waitForTimeout(500)
    const inPage = await page.evaluate(collectInPageMetrics, options.duration)
    const afterMetrics = toMetricMap(await client.send("Performance.getMetrics"))

    const report = {
      status: "ok",
      url: page.url(),
      options,
      timings: inPage.timings,
      frames: inPage.frames,
      longTasks: inPage.longTasks,
      console: {
        warningOrErrorCount: consoleMessages.filter((message) => ["warning", "error"].includes(message.type)).length,
        messages: consoleMessages.slice(0, 50)
      },
      pageErrors,
      requestFailures,
      webgl: inPage.webgl,
      cdp: {
        taskDurationMs: delta(afterMetrics, beforeMetrics, "TaskDuration") * 1000,
        scriptDurationMs: delta(afterMetrics, beforeMetrics, "ScriptDuration") * 1000,
        layoutDurationMs: delta(afterMetrics, beforeMetrics, "LayoutDuration") * 1000,
        recalcStyleDurationMs: delta(afterMetrics, beforeMetrics, "RecalcStyleDuration") * 1000,
        jsHeapUsedSize: afterMetrics.JSHeapUsedSize || 0,
        nodes: afterMetrics.Nodes || 0
      }
    }

    if (options.json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      printHuman(report)
    }
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(`perf:rights failed: ${error.message}`)
  process.exit(1)
})
