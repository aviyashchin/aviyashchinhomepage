#!/usr/bin/env node

import { chromium } from "playwright"

const DEFAULT_DURATION_MS = 5000
const DEFAULT_TIMEOUT_MS = 15000
const DEFAULT_CHANNEL = "chrome"

function printHelp() {
  console.log(`Usage: node scripts/check-route-motion.mjs --url <url> [options]

Checks that a route has visible automatic canvas motion without interaction.

Options:
  --url <url>                  Page URL to check.
  --duration <ms>              Sample window. Default: ${DEFAULT_DURATION_MS}
  --timeout <ms>               Navigation/canvas timeout. Default: ${DEFAULT_TIMEOUT_MS}
  --channel <name>             Chromium channel, or "bundled". Default: ${DEFAULT_CHANNEL}
  --headed                     Run Chrome headed instead of headless.
  --min-changed-ratio <ratio>  Minimum screenshot pixel-change ratio.
  --min-active-frames <count>  Minimum WebGL render frames during the sample.
  --json                       Print only JSON.
  --help                       Show this help.
`)
}

function readOption(args, name, fallback) {
  for (let index = args.length - 1; index >= 0; index -= 1) {
    const arg = args[index]
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1)
    if (arg === name && args[index + 1]) return args[index + 1]
  }
  return fallback
}

function readNumber(args, name, fallback, { allowZero = true } = {}) {
  const value = readOption(args, name, fallback)
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || (allowZero ? parsed < 0 : parsed <= 0)) {
    throw new Error(`${name} must be a ${allowZero ? "non-negative" : "positive"} number`)
  }

  return parsed
}

function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { help: true }

  const url = readOption(argv, "--url", null)
  if (!url) throw new Error("--url is required")

  return {
    help: false,
    url,
    duration: readNumber(argv, "--duration", DEFAULT_DURATION_MS, { allowZero: false }),
    timeout: readNumber(argv, "--timeout", DEFAULT_TIMEOUT_MS, { allowZero: false }),
    channel: readOption(argv, "--channel", DEFAULT_CHANNEL),
    headed: argv.includes("--headed"),
    json: argv.includes("--json"),
    thresholds: {
      minChangedRatio: readNumber(argv, "--min-changed-ratio", 0.01),
      minActiveFrames: readNumber(argv, "--min-active-frames", 1)
    }
  }
}

function toDataUrl(buffer) {
  return `data:image/png;base64,${buffer.toString("base64")}`
}

function groupRenderFrames(times) {
  const frames = []

  for (const time of times) {
    const last = frames[frames.length - 1]

    if (!last || time - last.last > 10) {
      frames.push({ first: time, last: time, drawCalls: 1 })
    } else {
      last.last = time
      last.drawCalls += 1
    }
  }

  return frames
}

function summarizeFrames(events) {
  const frameIds = new Set(events.map((event) => event.frame).filter((frame) => frame > 0))
  const frames = frameIds.size ? [] : groupRenderFrames(events.map((event) => event.time))

  return {
    drawCalls: events.length,
    renderFrames: frameIds.size || frames.length
  }
}

function evaluateThresholds(report) {
  const checks = [
    {
      name: "changed ratio",
      actual: report.changedRatio,
      min: report.options.thresholds.minChangedRatio,
      passed: report.changedRatio >= report.options.thresholds.minChangedRatio
    },
    {
      name: "active frames",
      actual: report.frames.renderFrames,
      min: report.options.thresholds.minActiveFrames,
      passed: report.frames.renderFrames >= report.options.thresholds.minActiveFrames
    }
  ]

  return {
    passed: checks.every((check) => check.passed),
    checks
  }
}

function formatNumber(value, digits = 3) {
  return Number(value || 0).toFixed(digits)
}

function printHuman(report) {
  console.log(`Route motion check
URL: ${report.url}
Status: ${report.status}
Sample window: ${report.options.duration}ms

Motion:
  changed pixels: ${report.changed} / ${report.sampled}
  changed ratio:  ${formatNumber(report.changedRatio, 4)}

Render cadence:
  draw calls:      ${report.frames.drawCalls}
  render frames:   ${report.frames.renderFrames}

DOM:
  canvas count:    ${report.canvasCount}

Thresholds:`)

  for (const check of report.thresholds.checks) {
    console.log(`  ${check.passed ? "pass" : "fail"} ${check.name}: ${formatNumber(check.actual, 4)} >= ${formatNumber(check.min, 4)}`)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const launchOptions = {
    headless: !options.headed,
    args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist", "--use-angle=default"]
  }

  if (options.channel !== "bundled") launchOptions.channel = options.channel

  let browser

  try {
    browser = await chromium.launch(launchOptions)
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1
    })

    await page.addInitScript(() => {
      window.__routeDrawEvents = []
      window.__routeRafFrame = 0

      const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window)
      window.requestAnimationFrame = (callback) => nativeRequestAnimationFrame((time) => {
        window.__routeRafFrame += 1
        return callback(time)
      })

      for (const name of ["WebGLRenderingContext", "WebGL2RenderingContext"]) {
        const Context = window[name]
        if (!Context) continue

        for (const method of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
          const original = Context.prototype[method]
          if (typeof original !== "function") continue

          Context.prototype[method] = function (...args) {
            window.__routeDrawEvents.push({
              frame: window.__routeRafFrame,
              time: performance.now()
            })
            return original.apply(this, args)
          }
        }
      }
    })

    await page.goto(options.url, {
      waitUntil: "domcontentloaded",
      timeout: options.timeout
    })

    await page.waitForSelector("canvas", { timeout: options.timeout })
    await page.waitForTimeout(1500)
    await page.evaluate(() => { window.__routeDrawEvents = [] })

    const first = await page.screenshot({ fullPage: false })
    await page.waitForTimeout(options.duration)
    const second = await page.screenshot({ fullPage: false })
    const drawEvents = await page.evaluate(() => window.__routeDrawEvents.slice())

    const motion = await page.evaluate(async ({ firstUrl, secondUrl }) => {
      async function load(url) {
        const image = new Image()
        image.src = url
        await image.decode()

        const canvas = document.createElement("canvas")
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight

        const context = canvas.getContext("2d")
        context.drawImage(image, 0, 0)

        return {
          data: context.getImageData(0, 0, canvas.width, canvas.height).data,
          width: canvas.width,
          height: canvas.height
        }
      }

      const a = await load(firstUrl)
      const b = await load(secondUrl)
      const left = Math.floor(a.width * 0.12)
      const top = Math.floor(a.height * 0.12)
      const right = Math.floor(a.width * 0.82)
      const bottom = Math.floor(a.height * 0.82)
      let changed = 0
      let sampled = 0

      for (let y = top; y < bottom; y += 8) {
        for (let x = left; x < right; x += 8) {
          const index = (y * a.width + x) * 4
          const delta = Math.abs(a.data[index] - b.data[index]) +
            Math.abs(a.data[index + 1] - b.data[index + 1]) +
            Math.abs(a.data[index + 2] - b.data[index + 2]) +
            Math.abs(a.data[index + 3] - b.data[index + 3])

          sampled += 1
          if (delta > 18) changed += 1
        }
      }

      return {
        changed,
        sampled,
        changedRatio: changed / sampled,
        canvasCount: document.querySelectorAll("canvas").length
      }
    }, {
      firstUrl: toDataUrl(first),
      secondUrl: toDataUrl(second)
    })

    const report = {
      status: "ok",
      url: page.url(),
      options,
      ...motion,
      frames: summarizeFrames(drawEvents)
    }

    report.thresholds = evaluateThresholds(report)
    report.status = report.thresholds.passed && report.canvasCount === 1 ? "ok" : "threshold-failed"

    if (options.json) console.log(JSON.stringify(report, null, 2))
    else printHuman(report)

    if (report.status !== "ok") process.exitCode = 1
  } finally {
    if (browser) await browser.close()
  }
}

main().catch((error) => {
  console.error(`check-route-motion failed: ${error.message}`)
  process.exit(1)
})
