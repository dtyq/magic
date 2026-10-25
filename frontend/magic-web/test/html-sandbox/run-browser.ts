import puppeteer from "puppeteer"
import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { serveFixtures } from "./serve-fixtures"
import { outputRoot } from "./build-fixtures"

const runId = randomUUID()
const startedAt = new Date().toISOString()
const reportPath = resolve(outputRoot, "browser-results.json")
const errors: string[] = []
let results: Array<{ name: string; passed: boolean; error?: string }> = []
let trace: unknown[] = []
let status: "running" | "passed" | "failed" = "running"
let fixtures: Awaited<ReturnType<typeof serveFixtures>> | undefined
let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined

async function writeReport() {
	await writeFile(
		reportPath,
		JSON.stringify(
			{
				runId,
				startedAt,
				finishedAt: status === "running" ? undefined : new Date().toISOString(),
				status,
				results,
				errors,
				trace,
			},
			null,
			2,
		),
	)
}

function recordFailure(error: unknown) {
	status = "failed"
	process.exitCode = 1
	const message = error instanceof Error ? error.stack || error.message : String(error)
	errors.push(message)
	console.error("BROWSER ERROR", message)
}

try {
	await mkdir(outputRoot, { recursive: true })
	// Replace the previous report before build/launch, including when those steps fail.
	await writeReport()
	fixtures = await serveFixtures()
	const { url } = fixtures
	browser = await puppeteer.launch({
		headless: true,
		...(process.env.HTML_SANDBOX_CHROME
			? { executablePath: process.env.HTML_SANDBOX_CHROME }
			: existsSync(puppeteer.executablePath())
				? {}
				: { channel: "chrome" as const }),
	})
	const page = await browser.newPage()
	page.on("pageerror", (error) => errors.push(String(error)))
	// Fail closed: fixtures must not accidentally reach a real backend/CDN.
	await page.setRequestInterception(true)
	page.on("request", (request) => {
		const address = new URL(request.url())
		if (
			["data:", "blob:", "about:"].includes(address.protocol) ||
			(address.port === new URL(url).port &&
				["127.0.0.1", "localhost"].includes(address.hostname))
		)
			void request.continue()
		else {
			errors.push("Unexpected external request: " + address.origin)
			void request.abort()
		}
	})
	await page.goto(url + "/?autorun", { waitUntil: "domcontentloaded" })
	await page.waitForFunction("window.fixtureDone === true", { timeout: 180000 })
	const collected = (await page.evaluate("window.fixtureResults")) as Array<{
		name: string
		passed: boolean
		error?: string
	}>
	if (!Array.isArray(collected) || collected.length === 0)
		throw Error("No browser assertions executed")
	results = collected
	const failures = results.filter((result) => !result.passed)
	const traceText = await page.$eval("#trace", (element) => element.textContent)
	trace = JSON.parse(traceText || "[]")
	for (const failure of failures) console.error("FAIL", failure.name, failure.error || "")
	for (const error of errors) console.error("BROWSER ERROR", error)
	console.log(`Browser: ${results.length - failures.length}/${results.length} assertions passed`)
	status = failures.length || errors.length ? "failed" : "passed"
	if (status === "failed") process.exitCode = 1
} catch (error) {
	recordFailure(error)
} finally {
	try {
		await browser?.close()
	} catch (error) {
		recordFailure(error)
	}
	// A disconnected browser must not prevent the fixture server from closing.
	try {
		if (fixtures) {
			const { server } = fixtures
			server.closeAllConnections()
			await new Promise<void>((done, reject) =>
				server.close((error) => (error ? reject(error) : done())),
			)
		}
	} catch (error) {
		recordFailure(error)
	}
	if (errors.length) {
		status = "failed"
		process.exitCode = 1
	}
	await writeReport()
}
