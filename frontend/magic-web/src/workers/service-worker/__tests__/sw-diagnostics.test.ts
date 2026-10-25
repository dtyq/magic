import { afterEach, describe, expect, it, vi } from "vitest"
import { createServiceWorkerDiagnostics } from "../sw-diagnostics"

interface DiagnosticsPlugin {
	cacheKeyWillBeUsed: (context: {
		event: ExtendableEvent
		mode: "read" | "write"
		request: Request
	}) => Request
	cachedResponseWillBeUsed: (context: {
		cachedResponse: Response
		event: ExtendableEvent
	}) => Response
	handlerDidComplete: (context: {
		error?: Error
		event: ExtendableEvent
		request: Request
		response: Response
	}) => void
}

/** Creates a minimal SW scope and exposes the diagnostics fetch listener for unit tests. */
function createScope(href: string): {
	scope: ServiceWorkerGlobalScope
	getFetchListener: () => ((event: ExtendableEvent & { request: Request }) => void) | undefined
} {
	let fetchListener: ((event: ExtendableEvent & { request: Request }) => void) | undefined
	const scope = {
		location: { href },
		addEventListener(type: string, listener: typeof fetchListener) {
			if (type === "fetch") fetchListener = listener
		},
	} as unknown as ServiceWorkerGlobalScope

	return { scope, getFetchListener: () => fetchListener }
}

/** Runs one cache-hit request through the diagnostics Workbox plugin callbacks. */
function runCacheHit(
	fetchListener: (event: ExtendableEvent & { request: Request }) => void,
	plugin: DiagnosticsPlugin,
	url: string,
): void {
	const request = new Request(url)
	const event = { request } as ExtendableEvent & { request: Request }
	const response = new Response("ok", { status: 200 })

	fetchListener(event)
	plugin.cacheKeyWillBeUsed({ event, mode: "read", request })
	plugin.cachedResponseWillBeUsed({ cachedResponse: response, event })
	plugin.handlerDidComplete({ event, request, response })
}

describe("service worker diagnostics", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("removes query parameters from every logged URL field", () => {
		const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined)
		const { scope } = createScope(
			"https://app.example.com/sw.js?swDiagnostics=1&token=mock-token",
		)
		const diagnostics = createServiceWorkerDiagnostics(scope)

		diagnostics.logWorkboxLoad({
			runtimeUrl: "https://cdn.example.com/workbox.js?signature=mock-signature",
		})
		diagnostics.logBootComplete({
			workboxRuntimeUrl: "https://cdn.example.com/workbox.js?key=mock-key",
		})

		const payloads = consoleInfo.mock.calls.map((call) => call[1] as Record<string, unknown>)
		expect(payloads[0].scriptUrl).toBe("https://app.example.com/sw.js")
		expect(payloads[1].runtimeUrl).toBe("https://cdn.example.com/workbox.js")
		expect(payloads[2].workboxRuntimeUrl).toBe("https://cdn.example.com/workbox.js")
	})

	it("uses fallback thresholds when registration parameters are missing", () => {
		const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined)
		const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		const { scope, getFetchListener } = createScope(
			"https://app.example.com/sw.js?swDiagnostics=1",
		)
		const diagnostics = createServiceWorkerDiagnostics(scope)
		diagnostics.bindFetchListener()
		const plugin = diagnostics.createCacheTimingPlugin(
			"test-cache",
		) as unknown as DiagnosticsPlugin
		const fetchListener = getFetchListener()
		if (!fetchListener) throw new Error("Expected diagnostics fetch listener")

		runCacheHit(fetchListener, plugin, "https://app.example.com/assets/first.js?token=mock")
		consoleInfo.mockClear()
		consoleWarn.mockClear()
		runCacheHit(fetchListener, plugin, "https://app.example.com/assets/second.js?token=mock")

		expect(consoleInfo).not.toHaveBeenCalled()
		expect(consoleWarn).not.toHaveBeenCalled()
	})
})
