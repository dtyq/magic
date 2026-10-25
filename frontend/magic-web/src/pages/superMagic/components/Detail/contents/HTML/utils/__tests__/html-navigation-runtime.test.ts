import { describe, expect, it, vi } from "vitest"
import {
	HtmlNavigationRuntimeService,
	type HtmlNavigationRuntimeRequest,
} from "../html-navigation-runtime"

const request = (requestId: string): HtmlNavigationRuntimeRequest => ({
	requestId,
	content: `<p>${requestId}</p>`,
	locationSearch: `?value=${requestId}`,
	locationAnchor: "",
})

describe("HtmlNavigationRuntimeService", () => {
	it("keeps only the newest request before the shell is ready", () => {
		const send = vi.fn()
		const service = new HtmlNavigationRuntimeService({ send })

		expect(service.submit(request("123"))).toBe("queued")
		expect(service.submit(request("456"))).toBe("queued")
		expect(service.markShellReady()).toBe("sent")
		expect(send).toHaveBeenCalledTimes(1)
		expect(send).toHaveBeenCalledWith(request("456"))
	})

	it("sends a request once and ignores duplicate submissions", () => {
		const send = vi.fn()
		const service = new HtmlNavigationRuntimeService({ send })

		service.markShellReady()
		expect(service.submit(request("123"))).toBe("sent")
		expect(service.submit(request("123"))).toBe("duplicate")
		expect(send).toHaveBeenCalledTimes(1)
	})

	it("accepts only lifecycle messages for the latest request", () => {
		const service = new HtmlNavigationRuntimeService({ send: vi.fn() })

		service.submit(request("123"))
		service.submit(request("456"))

		expect(service.acceptsMessage("123")).toBe(false)
		expect(service.acceptsMessage("456")).toBe(true)
		expect(service.acceptsMessage()).toBe(true)
	})

	it("drops the old request after the shell is reset", () => {
		const send = vi.fn()
		const service = new HtmlNavigationRuntimeService({ send })

		service.markShellReady()
		service.submit(request("123"))
		service.resetShell()
		service.markShellReady()
		expect(send).toHaveBeenCalledTimes(1)

		expect(service.submit(request("456"))).toBe("sent")
		expect(send).toHaveBeenCalledTimes(2)
		expect(send).toHaveBeenLastCalledWith(request("456"))
	})
})
