import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MagicUserApi } from "../MagicUserApi"

describe("MagicUserApi", () => {
	let postMessageSpy: ReturnType<typeof vi.spyOn>
	let api: MagicUserApi

	beforeEach(() => {
		;(window as any).Magic = undefined
		postMessageSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {})
		api = new MagicUserApi()
		api.install()
	})

	afterEach(() => {
		vi.restoreAllMocks()
		;(window as any).Magic = undefined
	})

	it("installs an idempotent getInfo API", () => {
		const firstGetInfo = (window as any).Magic.user.getInfo
		api.install()

		expect(typeof firstGetInfo).toBe("function")
		expect((window as any).Magic.user.getInfo).toBe(firstGetInfo)
	})

	it("sends requested scopes and reason to the parent window", () => {
		const promise = (window as any).Magic.user.getInfo({
			scopes: ["user.profile.display", "user.profile.identity"],
			reason: "Render the profile card",
		})

		expect(postMessageSpy).toHaveBeenCalledOnce()
		const [request, origin] = postMessageSpy.mock.calls[0]
		expect(request).toMatchObject({
			type: "MAGIC_GET_USER_INFO_REQUEST",
			scopes: ["user.profile.display", "user.profile.identity"],
			reason: "Render the profile card",
		})
		expect(origin).toBe(window.location.origin)

		window.dispatchEvent(
			new MessageEvent("message", {
				data: {
					type: "MAGIC_GET_USER_INFO_RESPONSE",
					requestId: request.requestId,
					success: true,
					userInfo: { name: "Ada", avatar: "https://example.test/ada.png" },
				},
				source: window.parent,
				origin: window.location.origin,
			}),
		)

		return expect(promise).resolves.toEqual({
			name: "Ada",
			avatar: "https://example.test/ada.png",
		})
	})

	it("rejects when the parent denies the request", async () => {
		const promise = (window as any).Magic.user.getInfo()
		const [request] = postMessageSpy.mock.calls[0]

		window.dispatchEvent(
			new MessageEvent("message", {
				data: {
					type: "MAGIC_GET_USER_INFO_RESPONSE",
					requestId: request.requestId,
					success: false,
					error: "Permission denied",
				},
				source: window.parent,
				origin: window.location.origin,
			}),
		)

		await expect(promise).rejects.toThrow("Permission denied")
	})
})
