#!/usr/bin/env node

import { chromium } from "playwright"

const DEFAULT_URL = "http://127.0.0.1:3101/about"
const DEFAULT_DURATION_MS = 5000
const DEFAULT_TIMEOUT_MS = 15000
const DEFAULT_CHANNEL = "chrome"

function printHelp() {
  console.log(`Usage: node scripts/check-turtle-smoothness.mjs [options]

Checks that the About page turtle animates without click/drag interaction.

Options:
  --url <url>                  Page URL to check. Default: ${DEFAULT_URL}
  --duration <ms>              Autoplay sample window. Default: ${DEFAULT_DURATION_MS}
  --timeout <ms>               Navigation/canvas timeout. Default: ${DEFAULT_TIMEOUT_MS}
  --channel <name>             Chromium channel, or "bundled". Default: ${DEFAULT_CHANNEL}
  --headed                     Run Chrome headed instead of headless.
  --min-changed-ratio <ratio>  Minimum screenshot pixel-change ratio.
  --min-active-frames <count>  Minimum WebGL render frames during the sample.
  --max-frame-gap-ms <ms>      Maximum allowed p95 gap between render frames.
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

  return {
    help: false,
    url: readOption(argv, "--url", DEFAULT_URL),
    duration: readNumber(argv, "--duration", DEFAULT_DURATION_MS, { allowZero: false }),
    timeout: readNumber(argv, "--timeout", DEFAULT_TIMEOUT_MS, { allowZero: false }),
    channel: readOption(argv, "--channel", DEFAULT_CHANNEL),
    headed: argv.includes("--headed"),
    json: argv.includes("--json"),
    thresholds: {
      minChangedRatio: readNumber(argv, "--min-changed-ratio", 0.01),
      minActiveFrames: readNumber(argv, "--min-active-frames", 1),
      maxFrameGapMs: readNumber(argv, "--max-frame-gap-ms", 250)
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

function percentile(values, amount) {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * amount))] || 0
}

function summarizeFrames(times) {
  const frames = groupRenderFrames(times)
  const starts = frames.map((frame) => frame.first)
  const gaps = starts.slice(1).map((time, index) => time - starts[index])
  const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / Math.max(1, gaps.length)

  return {
    drawCalls: times.length,
    renderFrames: frames.length,
    avgGapMs: avgGap,
    p95GapMs: percentile(gaps, 0.95),
    maxGapMs: gaps.length ? Math.max(...gaps) : 0
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
    },
    {
      name: "frame gap p95",
      actual: report.frames.p95GapMs,
      max: report.options.thresholds.maxFrameGapMs,
      passed: report.frames.p95GapMs <= report.options.thresholds.maxFrameGapMs
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
  console.log(`Turtle smoothness check
URL: ${report.url}
Status: ${report.status}
Sample window: ${report.options.duration}ms

Motion:
  changed pixels: ${report.changed} / ${report.sampled}
  changed ratio:  ${formatNumber(report.changedRatio, 4)}

Render cadence:
  draw calls:      ${report.frames.drawCalls}
  render frames:   ${report.frames.renderFrames}
  avg gap:         ${formatNumber(report.frames.avgGapMs, 1)}ms
  p95 gap:         ${formatNumber(report.frames.p95GapMs, 1)}ms
  max gap:         ${formatNumber(report.frames.maxGapMs, 1)}ms

DOM:
  about text:      ${report.hasAboutText}
  canvas count:    ${report.canvasCount}

Thresholds:`)

  for (const check of report.thresholds.checks) {
    if ("min" in check) {
      console.log(`  ${check.passed ? "pass" : "fail"} ${check.name}: ${formatNumber(check.actual, 4)} >= ${formatNumber(check.min, 4)}`)
    } else {
      console.log(`  ${check.passed ? "pass" : "fail"} ${check.name}: ${formatNumber(check.actual, 1)}ms <= ${formatNumber(check.max, 1)}ms`)
    }
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
    args: ["--enable-unsafe-webgpu", "--enable-unsafe-swiftshader"]
  }

  if (options.channel !== "bundled") launchOptions.channel = options.channel

  const browser = await chromium.launch(launchOptions)
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  })

  try {
    await page.addInitScript(() => {
      window.__turtleDrawTimes = []

      for (const name of ["WebGLRenderingContext", "WebGL2RenderingContext"]) {
        const Context = window[name]
        if (!Context) continue

        for (const method of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
          const original = Context.prototype[method]
          if (typeof original !== "function") continue

          Context.prototype[method] = function (...args) {
            window.__turtleDrawTimes.push(performance.now())
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
    await page.evaluate(() => { window.__turtleDrawTimes = [] })

    const first = await page.screenshot({ fullPage: false })
    await page.waitForTimeout(options.duration)
    const second = await page.screenshot({ fullPage: false })
    const frameTimes = await page.evaluate(() => window.__turtleDrawTimes.slice())

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

        return { context, width: canvas.width, height: canvas.height }
      }

      const a = await load(firstUrl)
      const b = await load(secondUrl)
      const left = Math.floor(a.width * 0.22)
      const top = Math.floor(a.height * 0.18)
      const right = Math.floor(a.width * 0.78)
      const bottom = Math.floor(a.height * 0.78)
      let changed = 0
      let sampled = 0

      for (let y = top; y < bottom; y += 8) {
        for (let x = left; x < right; x += 8) {
          const p1 = a.context.getImageData(x, y, 1, 1).data
          const p2 = b.context.getImageData(x, y, 1, 1).data
          const delta = Math.abs(p1[0] - p2[0]) + Math.abs(p1[1] - p2[1]) + Math.abs(p1[2] - p2[2]) + Math.abs(p1[3] - p2[3])

          sampled += 1
          if (delta > 18) changed += 1
        }
      }

      return {
        changed,
        sampled,
        changedRatio: changed / sampled,
        hasAboutText: document.body.innerText.includes("Data-driven founder"),
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
      frames: summarizeFrames(frameTimes)
    }

    report.thresholds = evaluateThresholds(report)
    report.status = report.thresholds.passed && report.hasAboutText && report.canvasCount === 1 ? "ok" : "threshold-failed"

    if (options.json) console.log(JSON.stringify(report, null, 2))
    else printHuman(report)

    if (report.status !== "ok") process.exitCode = 1
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(`check-turtle-smoothness failed: ${error.message}`)
  process.exit(1)
})
