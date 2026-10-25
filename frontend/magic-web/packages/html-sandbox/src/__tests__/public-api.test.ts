import { describe, expect, it, vi } from "vitest"

describe("html sandbox public API", () => {
	it("exports helpers and runtime APIs without starting the runtime on import", async () => {
		const listen = vi.spyOn(window, "addEventListener")
		const consoleError = console.error
		try {
			const api = await import("../index")

			expect(typeof api.BaseRuntimeBridgeApiPlugin).toBe("function")
			expect(typeof api.getEditableTextContent).toBe("function")
			expect(typeof api.getParentOrigin).toBe("function")
			expect(typeof api.markSourceNode).toBe("function")
			expect(typeof api.runtimeLoggerHub).toBe("object")
			expect(typeof api.startIframeRuntime).toBe("function")
			expect(listen).not.toHaveBeenCalled()
			expect(console.error).toBe(consoleError)
			expect(window.__iframeEditorRuntime__).toBeUndefined()
		} finally {
			listen.mockRestore()
		}
	})
})
