#!/usr/bin/env node

import fs from "node:fs/promises"
import http from "node:http"
import path from "node:path"
import { chromium } from "playwright"

const DEFAULT_PORT = 3126
const DEFAULT_TIMEOUT_MS = 20000
const DEFAULT_CHANNEL = "chrome"
const BUILD_DIR = path.resolve("build")

function readOption(args, name, fallback) {
  for (let index = args.length - 1; index >= 0; index -= 1) {
    const arg = args[index]
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1)
    if (arg === name && args[index + 1]) return args[index + 1]
  }
  return fallback
}

function readNumber(args, name, fallback) {
  const parsed = Number(readOption(args, name, fallback))
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a positive number`)
  return parsed
}

function parseArgs(argv) {
  return {
    channel: readOption(argv, "--channel", DEFAULT_CHANNEL),
    headed: argv.includes("--headed"),
    port: readNumber(argv, "--port", DEFAULT_PORT),
    timeout: readNumber(argv, "--timeout", DEFAULT_TIMEOUT_MS)
  }
}

function contentType(filePath) {
  const extension = path.extname(filePath)

  return {
    ".css": "text/css",
    ".html": "text/html",
    ".js": "text/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain",
    ".woff": "font/woff",
    ".woff2": "font/woff2"
  }[extension] || "application/octet-stream"
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function serveBuild(port) {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://127.0.0.1:${port}`)
      const pathname = decodeURIComponent(url.pathname)
      const candidate = path.join(BUILD_DIR, pathname)
      const filePath = await fileExists(candidate) && !candidate.endsWith(path.sep)
        ? candidate
        : path.join(BUILD_DIR, "index.html")

      const body = await fs.readFile(filePath)
      response.writeHead(200, { "content-type": contentType(filePath) })
      response.end(body)
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain" })
      response.end(error.message)
    }
  })

  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(port, "127.0.0.1", resolve)
  })

  return server
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
}

function toDataUrl(buffer) {
  return `data:image/png;base64,${buffer.toString("base64")}`
}

async function launchBrowser(options) {
  const launchOptions = {
    headless: !options.headed,
    args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist", "--use-angle=default"]
  }

  if (options.channel !== "bundled") launchOptions.channel = options.channel

  try {
    return await chromium.launch(launchOptions)
  } catch (error) {
    if (options.channel === "bundled") throw error
    return chromium.launch({ ...launchOptions, channel: undefined })
  }
}

async function compareScreenshots(page, first, second) {
  return page.evaluate(async ({ firstUrl, secondUrl }) => {
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
        height: canvas.height,
        width: canvas.width
      }
    }

    const a = await load(firstUrl)
    const b = await load(secondUrl)
    const left = Math.floor(a.width * 0.18)
    const top = Math.floor(a.height * 0.16)
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
      changedRatio: changed / sampled,
      sampled
    }
  }, {
    firstUrl: toDataUrl(first),
    secondUrl: toDataUrl(second)
  })
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const server = await serveBuild(options.port)
  let browser

  try {
    browser = await launchBrowser(options)
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1
    })

    const pageErrors = []
    const consoleErrors = []

    page.on("pageerror", (error) => pageErrors.push(error.message))
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text())
    })

    const url = `http://127.0.0.1:${options.port}/cloth`
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeout })
    await page.waitForSelector(".cloth-page", { timeout: options.timeout })
    await page.waitForFunction(() => {
      const state = document.querySelector(".cloth-page")?.dataset.webgpuState
      return state === "ready" || state === "fallback"
    }, { timeout: options.timeout })

    const state = await page.locator(".cloth-page").getAttribute("data-webgpu-state")
    const navText = await page.locator(".nav").textContent()
    const titleVisible = await page.getByRole("link", { name: "WebGPU Cloth" }).isVisible()
    const canvasCount = await page.locator("canvas[data-motion-probe='webgpu-cloth']").count()
    const fallbackVisible = await page.locator(".cloth-fallback-visual").isVisible().catch(() => false)
    let motion = null

    if (state === "ready") {
      await page.waitForTimeout(1000)
      const first = await page.screenshot({ fullPage: false })
      await page.waitForTimeout(1200)
      const second = await page.screenshot({ fullPage: false })
      motion = await compareScreenshots(page, first, second)
    }

    const checks = [
      { name: "cloth page reached terminal state", passed: state === "ready" || state === "fallback" },
      { name: "cause overlay is present", passed: titleVisible },
      { name: "hidden route is not in nav", passed: !navText.includes("cloth") },
      { name: "no page errors", passed: pageErrors.length === 0 },
      { name: "no console errors", passed: consoleErrors.length === 0 },
      {
        name: "visual is present",
        passed: state === "ready" ? canvasCount === 1 : fallbackVisible
      },
      {
        name: "ready scene has automatic motion",
        passed: state === "fallback" || (motion && motion.changedRatio >= 0.001)
      }
    ]

    console.log(`Cloth route check
URL: ${url}
State: ${state}
Canvas count: ${canvasCount}
Fallback visible: ${fallbackVisible}
${motion ? `Changed ratio: ${motion.changedRatio.toFixed(4)}` : "Changed ratio: n/a"}

Checks:`)

    for (const check of checks) {
      console.log(`  ${check.passed ? "pass" : "fail"} ${check.name}`)
    }

    if (pageErrors.length) console.log(`Page errors:\n${pageErrors.join("\n")}`)
    if (consoleErrors.length) console.log(`Console errors:\n${consoleErrors.join("\n")}`)

    if (!checks.every((check) => check.passed)) process.exitCode = 1
  } finally {
    if (browser) await browser.close()
    await closeServer(server)
  }
}

main().catch((error) => {
  console.error(`check-cloth-route failed: ${error.message}`)
  process.exit(1)
})
