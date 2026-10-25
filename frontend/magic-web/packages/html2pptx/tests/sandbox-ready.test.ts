// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest"
import {
	HtmlRenderSandbox,
	type SandboxReadyControllerConstructor,
} from "../src/sandbox/htmlRenderSandbox"
import { NATIVE_LOAD_WAIT_MS } from "../src/shared/constants"

let sandbox: HtmlRenderSandbox | null = null

afterEach(() => {
	sandbox?.destroy()
	sandbox = null
})

describe("sandbox readiness", () => {
	it("reports an ordinary page script error and continues when an issue handler is provided", async () => {
		const issues: Array<{ code: string; message: string; severity: string }> = []
		sandbox = new HtmlRenderSandbox()
		Object.defineProperty(sandbox.document, "readyState", {
			configurable: true,
			get: () => "complete",
		})
		sandbox.window.requestAnimationFrame = (callback: FrameRequestCallback): number =>
			window.setTimeout(() => callback(performance.now()), 0)

		const render = sandbox.render("<html><body>ready</body></html>", {
			onExportIssue: (issue) => issues.push(issue),
		})
		sandbox.window.dispatchEvent(
			new ErrorEvent("error", {
				message: "Chart container #invBar was not found",
				error: new Error("Chart container #invBar was not found"),
			}),
		)

		await expect(render).resolves.toBeDefined()
		expect(issues).toEqual([
			{
				code: "page-script-error",
				message: "Chart container #invBar was not found",
				severity: "warning",
			},
		])
	})

	it("starts readiness only once when polling and DOMContentLoaded overlap", async () => {
		let readyCalls = 0
		const ReadyController = class {
			async waitForReady(): Promise<void> {
				readyCalls += 1
				await new Promise((resolve) => setTimeout(resolve, 10))
			}
			restore(): void {}
		} as SandboxReadyControllerConstructor

		sandbox = new HtmlRenderSandbox(undefined, { ReadyController })
		Object.defineProperty(sandbox.document, "readyState", {
			configurable: true,
			get: () => "complete",
		})
		sandbox.window.requestAnimationFrame = (callback: FrameRequestCallback): number =>
			window.setTimeout(() => callback(performance.now()), 0)

		const render = sandbox.render("<html><body>ready</body></html>")
		sandbox.document.dispatchEvent(new Event("DOMContentLoaded"))
		await render

		expect(readyCalls).toBe(1)
	})

	it.each([
		["static HTML", "<html><body>ready</body></html>", 0],
		["scripted HTML", "<html><body><script>void 0</script></body></html>", NATIVE_LOAD_WAIT_MS],
	])("uses the expected native-load wait for %s", async (_label, html, expectedWaitMs) => {
		let observedWaitMs: number | undefined
		const ReadyController = class {
			constructor(input: { nativeLoadWaitMs: number }) {
				observedWaitMs = input.nativeLoadWaitMs
			}
			async waitForReady(): Promise<void> {}
			restore(): void {}
		} as SandboxReadyControllerConstructor

		sandbox = new HtmlRenderSandbox(undefined, { ReadyController })
		Object.defineProperty(sandbox.document, "readyState", {
			configurable: true,
			get: () => "complete",
		})
		sandbox.window.requestAnimationFrame = (callback: FrameRequestCallback): number =>
			window.setTimeout(() => callback(performance.now()), 0)

		await sandbox.render(html)

		expect(observedWaitMs).toBe(expectedWaitMs)
	})
})
