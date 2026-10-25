import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MagicContextApi } from "../MagicContextApi"

describe("MagicContextApi", () => {
	let postMessageSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		;(window as any).Magic = undefined
		postMessageSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {})
		new MagicContextApi().install()
	})

	afterEach(() => {
		vi.restoreAllMocks()
		vi.useRealTimers()
		;(window as any).Magic = undefined
	})

	function simulateResponse(data: Record<string, unknown>) {
		window.dispatchEvent(
			new MessageEvent("message", {
				data,
				source: window.parent,
				origin: window.location.origin,
			}),
		)
	}

	const context = {
		userId: "user-1",
		userName: "Alice",
		user: {
			user_id: "user-1",
			magic_id: "magic-1",
			organization_code: "org-1",
			nickname: "Alice",
		},
		organizationCode: "org-1",
		language: "zh_CN",
	}

	it("installs getContext on top-level and context namespace", () => {
		expect((window as any).Magic.getContext).toBeTypeOf("function")
		expect((window as any).Magic.context.getContext).toBeTypeOf("function")
	})

	it("getContext() sends MAGIC_CONTEXT_GET_REQUEST and resolves response content", async () => {
		const promise = (window as any).Magic.getContext()

		expect(postMessageSpy).toHaveBeenCalledOnce()
		const [req] = postMessageSpy.mock.calls[0]
		expect(req.type).toBe("MAGIC_CONTEXT_GET_REQUEST")
		expect(typeof req.requestId).toBe("string")

		simulateResponse({
			type: "MAGIC_CONTEXT_GET_RESPONSE",
			requestId: req.requestId,
			success: true,
			content: context,
		})

		await expect(promise).resolves.toEqual(context)
	})

	it("context.getContext() uses the same request protocol", async () => {
		const promise = (window as any).Magic.context.getContext()
		const [req] = postMessageSpy.mock.calls[0]

		expect(req.type).toBe("MAGIC_CONTEXT_GET_REQUEST")

		simulateResponse({
			type: "MAGIC_CONTEXT_GET_RESPONSE",
			requestId: req.requestId,
			success: true,
			content: context,
		})

		await expect(promise).resolves.toEqual(context)
	})

	it("getContext() rejects invalid response content", async () => {
		const promise = (window as any).Magic.getContext()
		const [req] = postMessageSpy.mock.calls[0]

		simulateResponse({
			type: "MAGIC_CONTEXT_GET_RESPONSE",
			requestId: req.requestId,
			success: true,
			content: null,
		})

		await expect(promise).rejects.toThrow("getContext: invalid context response")
	})

	it("does not overwrite an existing namespace getContext", () => {
		const existingGetContext = vi.fn()
		;(window as any).Magic = {
			context: {
				getContext: existingGetContext,
			},
		}

		new MagicContextApi().install()

		expect((window as any).Magic.context.getContext).toBe(existingGetContext)
		expect((window as any).Magic.getContext).toBeTypeOf("function")
	})

	it("reuses an existing top-level getContext for the namespace fallback", () => {
		const existingGetContext = vi.fn()
		;(window as any).Magic = {
			getContext: existingGetContext,
		}

		new MagicContextApi().install()

		expect((window as any).Magic.getContext).toBe(existingGetContext)
		expect((window as any).Magic.context.getContext).toBe(existingGetContext)
	})
})
