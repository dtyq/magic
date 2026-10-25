import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import install from "../telemetry"

type SandboxWindow = Window & {
	__MAGIC_FILE_ID__?: string
	__MAGIC_RELATIVE_PATH__?: string
	__MAGIC_IFRAME_CHAIN__?: string[]
}

describe("sandbox telemetry runtime", () => {
	let iframe: HTMLIFrameElement
	let sandbox: SandboxWindow
	let postMessage: ReturnType<typeof spyOnParent>

	beforeEach(() => {
		iframe = document.createElement("iframe")
		document.body.append(iframe)
		sandbox = iframe.contentWindow as SandboxWindow
		postMessage = spyOnParent(sandbox.parent)
		vi.stubGlobal("window", sandbox)
		vi.stubGlobal("document", sandbox.document)
	})
	afterEach(() => {
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
		iframe.remove()
	})

	it("installs once and deduplicates parent/top targets while retaining the existing file identity", () => {
		sandbox.__MAGIC_FILE_ID__ = "existing-file"
		sandbox.__MAGIC_RELATIVE_PATH__ = "app/nested.html"
		sandbox.__MAGIC_IFRAME_CHAIN__ = ["outer-file", "existing-file"]
		install({ fileId: "replacement-file" })
		install({ fileId: "another-file" })
		sandbox.dispatchEvent(
			new ErrorEvent("error", {
				message: "runtime failure",
				filename: "https://cdn.example/script.js",
				lineno: 12,
				colno: 4,
			}),
		)
		expect(postMessage).toHaveBeenCalledTimes(1)
		expect(postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "MAGIC_HTML_SANDBOX_TELEMETRY",
				payload: expect.objectContaining({
					severity: "error",
					dedupeCount: 1,
					event: expect.objectContaining({
						type: "runtime_error",
						errorType: "error",
						lineno: 12,
						colno: 4,
					}),
					source: {
						depth: 2,
						fileId: "existing-file",
						path: "app/nested.html",
						chainFileIds: ["outer-file", "existing-file"],
					},
				}),
			}),
			"*",
		)
	})

	it("reports at most five copies of one error and keeps a separate budget for a different error", () => {
		install({ fileId: "file-a" })
		for (let index = 0; index < 7; index += 1)
			sandbox.dispatchEvent(new ErrorEvent("error", { message: "repeated failure" }))
		sandbox.dispatchEvent(new ErrorEvent("error", { message: "different failure" }))
		expect(postMessage).toHaveBeenCalledTimes(6)
		expect(
			postMessage.mock.calls.slice(0, 5).map(([message]) => message.payload.dedupeCount),
		).toEqual([1, 2, 3, 4, 5])
		expect(postMessage.mock.calls[5][0].payload.source.fileId).toBe("file-a")
		expect(
			new Set(postMessage.mock.calls.map(([message]) => message.payload.eventId)).size,
		).toBe(6)
	})

	it.each([
		["script", "src", "script"],
		["link", "href", "stylesheet"],
		["img", "src", "image"],
		["iframe", "src", "iframe"],
		["source", "src", "media"],
		["object", "data", "unknown"],
	])(
		"reports %s resource failures and redacts URL credentials",
		(tag, attribute, resourceType) => {
			install({})
			const element = document.createElement(tag)
			element.setAttribute(
				attribute,
				"https://cdn.example/file?token=secret-a&access_token=secret-b&signature=secret-c&x-oss-signature=secret-d&Expires=secret-e",
			)
			document.body.append(element)
			element.dispatchEvent(new Event("error"))
			expect(postMessage).toHaveBeenCalledTimes(1)
			const event = postMessage.mock.calls[0][0].payload.event
			expect(event).toMatchObject({
				type: "resource_load_failed",
				tagName: tag,
				resourceType,
			})
			const url = new URL(event.url)
			for (const key of ["token", "access_token", "signature", "x-oss-signature", "Expires"])
				expect(url.searchParams.get(key)).toBe("[redacted]")
		},
	)

	it("reports promise rejections with bounded message and stack text", () => {
		install({})
		const event = new Event("unhandledrejection")
		Object.defineProperty(event, "reason", {
			value: { message: "x".repeat(700), stack: "y".repeat(2200) },
		})
		sandbox.dispatchEvent(event)
		const error = postMessage.mock.calls[0][0].payload.event
		expect(error).toMatchObject({ type: "runtime_error", errorType: "unhandledrejection" })
		expect(error.message).toContain("...[truncated]")
		expect(error.stack).toContain("...[truncated]")
		expect(error.message.length).toBeLessThan(530)
		expect(error.stack.length).toBeLessThan(2030)
	})

	it("ignores resource errors without a URL", () => {
		install({})
		const image = document.createElement("img")
		document.body.append(image)
		image.dispatchEvent(new Event("error"))
		expect(postMessage).not.toHaveBeenCalled()
	})

	it("does not install on the top-level application", () => {
		vi.unstubAllGlobals()
		const addListener = vi.spyOn(window, "addEventListener")
		install({ fileId: "host" })
		expect(addListener).not.toHaveBeenCalled()
	})
})

function spyOnParent(parent: Window) {
	return vi.spyOn(parent, "postMessage").mockImplementation(() => undefined)
}
