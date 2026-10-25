import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
	outputRoot: "/fixture/html-sandbox",
	mkdir: vi.fn(),
	writeFile: vi.fn(),
	existsSync: vi.fn(),
	serveFixtures: vi.fn(),
	launch: vi.fn(),
	executablePath: vi.fn(),
}))

// Vite's builtin interop may read named imports through default; both must use the same mocks.
vi.mock("node:fs", () => ({
	default: { existsSync: mocks.existsSync },
	existsSync: mocks.existsSync,
}))
vi.mock("node:fs/promises", () => ({
	default: { mkdir: mocks.mkdir, writeFile: mocks.writeFile },
	mkdir: mocks.mkdir,
	writeFile: mocks.writeFile,
}))
vi.mock("puppeteer", () => ({
	default: { launch: mocks.launch, executablePath: mocks.executablePath },
}))
vi.mock("../serve-fixtures", () => ({ serveFixtures: mocks.serveFixtures }))
vi.mock("../build-fixtures", () => ({ outputRoot: mocks.outputRoot }))

interface Report {
	runId: string
	startedAt: string
	finishedAt?: string
	status: "running" | "passed" | "failed"
	results: Array<{ name: string; passed: boolean; error?: string }>
	errors: string[]
	trace: unknown[]
}

describe("browser runner report lifecycle", () => {
	let previousExitCode: typeof process.exitCode
	let report: Report
	let writes: Report[]
	const currentResults = [{ name: "current browser assertion", passed: true }]
	const currentTrace = [{ type: "fixture-ready" }]
	const page = {
		on: vi.fn(),
		setRequestInterception: vi.fn(),
		goto: vi.fn(),
		waitForFunction: vi.fn(),
		evaluate: vi.fn(),
		$eval: vi.fn(),
	}
	const browser = { newPage: vi.fn(), close: vi.fn() }
	const server = { closeAllConnections: vi.fn(), close: vi.fn() }

	beforeEach(() => {
		previousExitCode = process.exitCode
		process.exitCode = undefined
		vi.resetModules()
		vi.resetAllMocks()
		vi.stubEnv("HTML_SANDBOX_CHROME", "")
		vi.spyOn(console, "log").mockImplementation(() => undefined)
		vi.spyOn(console, "error").mockImplementation(() => undefined)
		report = {
			runId: "stale-green-run",
			startedAt: "2020-01-01T00:00:00.000Z",
			finishedAt: "2020-01-01T00:00:01.000Z",
			status: "passed",
			results: [{ name: "stale assertion", passed: true }],
			errors: [],
			trace: [{ type: "stale trace" }],
		}
		writes = []
		mocks.mkdir.mockResolvedValue(undefined)
		// Model an existing green report in memory, so the test never touches build output.
		mocks.writeFile.mockImplementation(async (path: string, contents: string) => {
			expect(path).toBe(`${mocks.outputRoot}/browser-results.json`)
			report = JSON.parse(contents) as Report
			writes.push(report)
		})
		mocks.existsSync.mockReturnValue(true)
		mocks.executablePath.mockReturnValue("/fixture/chrome")
		mocks.serveFixtures.mockImplementation(async () => {
			expectRunningReport()
			return { url: "http://127.0.0.1:12345", server }
		})
		mocks.launch.mockResolvedValue(browser)
		browser.newPage.mockResolvedValue(page)
		browser.close.mockResolvedValue(undefined)
		server.close.mockImplementation((done: (error?: Error) => void) => done())
		page.setRequestInterception.mockResolvedValue(undefined)
		page.goto.mockResolvedValue(undefined)
		page.waitForFunction.mockResolvedValue(undefined)
		page.evaluate.mockResolvedValue(currentResults)
		page.$eval.mockResolvedValue(JSON.stringify(currentTrace))
	})

	afterEach(() => {
		// The executable sets the real process exit code; do not poison later Vitest files.
		process.exitCode = previousExitCode
		vi.unstubAllEnvs()
		vi.restoreAllMocks()
	})

	function expectRunningReport() {
		expect(report).toEqual({
			runId: expect.any(String),
			startedAt: expect.any(String),
			status: "running",
			results: [],
			errors: [],
			trace: [],
		})
		expect(report.runId).not.toBe("stale-green-run")
		expect(Number.isNaN(Date.parse(report.startedAt))).toBe(false)
	}

	function expectTerminalReport(status: "passed" | "failed", error?: string) {
		expect(mocks.mkdir).toHaveBeenCalledWith(mocks.outputRoot, { recursive: true })
		expect(writes).toHaveLength(2)
		expect(writes[0].status).toBe("running")
		expect(writes[0].results).toEqual([])
		expect(writes[0].trace).toEqual([])
		expect(report).toMatchObject({
			runId: writes[0].runId,
			startedAt: writes[0].startedAt,
			finishedAt: expect.any(String),
			status,
		})
		expect(Date.parse(report.finishedAt!)).toBeGreaterThanOrEqual(Date.parse(report.startedAt))
		if (error) expect(report.errors).toEqual([expect.stringContaining(error)])
		else expect(report.errors).toEqual([])
		expect(process.exitCode).toBe(status === "failed" ? 1 : undefined)
	}

	function expectServerClosed() {
		expect(server.closeAllConnections).toHaveBeenCalledTimes(1)
		expect(server.close).toHaveBeenCalledTimes(1)
		expect(server.closeAllConnections.mock.invocationCallOrder[0]).toBeLessThan(
			server.close.mock.invocationCallOrder[0],
		)
		expect(server.close.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.writeFile.mock.invocationCallOrder[1],
		)
	}

	it("replaces a stale green report before fixture build fails", async () => {
		mocks.serveFixtures.mockImplementation(async () => {
			expectRunningReport()
			throw new Error("fixture build failed")
		})

		await import("../run-browser")

		expectTerminalReport("failed", "fixture build failed")
		expect(report.results).toEqual([])
		expect(report.trace).toEqual([])
		expect(mocks.launch).not.toHaveBeenCalled()
		expect(browser.close).not.toHaveBeenCalled()
		expect(server.close).not.toHaveBeenCalled()
	})

	it("records browser launch failure and closes the acquired fixture server", async () => {
		mocks.launch.mockRejectedValue(new Error("browser launch failed"))

		await import("../run-browser")

		expectTerminalReport("failed", "browser launch failed")
		expect(report.results).toEqual([])
		expect(report.trace).toEqual([])
		expect(browser.close).not.toHaveBeenCalled()
		expectServerClosed()
	})

	it("records fixture timeout and closes both browser and server", async () => {
		page.waitForFunction.mockRejectedValue(new Error("fixture completion timed out"))

		await import("../run-browser")

		expectTerminalReport("failed", "fixture completion timed out")
		expect(page.waitForFunction).toHaveBeenCalledWith("window.fixtureDone === true", {
			timeout: 180000,
		})
		expect(page.evaluate).not.toHaveBeenCalled()
		expect(report.results).toEqual([])
		expect(report.trace).toEqual([])
		expect(browser.close).toHaveBeenCalledTimes(1)
		expectServerClosed()
	})

	it("marks successful assertions failed when browser cleanup fails and still closes the server", async () => {
		browser.close.mockRejectedValue(new Error("browser close failed"))

		await import("../run-browser")

		expectTerminalReport("failed", "browser close failed")
		expect(report.results).toEqual(currentResults)
		expect(report.trace).toEqual(currentTrace)
		expect(browser.close).toHaveBeenCalledTimes(1)
		expectServerClosed()
		expect(browser.close.mock.invocationCallOrder[0]).toBeLessThan(
			server.closeAllConnections.mock.invocationCallOrder[0],
		)
	})

	it("publishes only the current assertions and trace after successful cleanup", async () => {
		await import("../run-browser")

		expectTerminalReport("passed")
		expect(report.results).toEqual(currentResults)
		expect(report.trace).toEqual(currentTrace)
		expect(page.goto).toHaveBeenCalledWith("http://127.0.0.1:12345/?autorun", {
			waitUntil: "domcontentloaded",
		})
		expect(page.evaluate).toHaveBeenCalledWith("window.fixtureResults")
		expect(browser.close).toHaveBeenCalledTimes(1)
		expectServerClosed()
	})
})
