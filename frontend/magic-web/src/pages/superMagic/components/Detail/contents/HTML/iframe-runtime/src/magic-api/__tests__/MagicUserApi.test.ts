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
		vi.useRealTimers()
		;(window as any).Magic = undefined
	})

	function simulateResponse(data: Record<string, unknown>) {
		window.dispatchEvent(
			new MessageEvent("message", {
				data,
				source: window.parent,
			}),
		)
	}

	it("getInfo() sends no scopes by default", async () => {
		const promise = (window as any).Magic.user.getInfo()

		const req = postMessageSpy.mock.calls[0][0] as Record<string, any>
		expect(req.type).toBe("MAGIC_GET_USER_INFO_REQUEST")
		expect(req.scopes).toBeUndefined()

		simulateResponse({
			type: "MAGIC_GET_USER_INFO_RESPONSE",
			requestId: req.requestId,
			success: true,
			userInfo: {
				name: "Display Name",
				avatar: "https://example.com/avatar.png",
			},
		})

		await expect(promise).resolves.toEqual({
			name: "Display Name",
			avatar: "https://example.com/avatar.png",
		})
	})

	it("getInfo() sends requested scopes and reason", async () => {
		const promise = (window as any).Magic.user.getInfo({
			scopes: ["user.profile.identity"],
			reason: "展示个人名片",
		})

		const req = postMessageSpy.mock.calls[0][0] as Record<string, any>
		expect(req.type).toBe("MAGIC_GET_USER_INFO_REQUEST")
		expect(req.scopes).toEqual(["user.profile.identity"])
		expect(req.reason).toBe("展示个人名片")

		simulateResponse({
			type: "MAGIC_GET_USER_INFO_RESPONSE",
			requestId: req.requestId,
			success: true,
			userInfo: {
				name: "Display Name",
				avatar: "https://example.com/avatar.png",
				user_id: "user-1",
				magic_id: "magic-1",
			},
		})

		await expect(promise).resolves.toEqual({
			name: "Display Name",
			avatar: "https://example.com/avatar.png",
			user_id: "user-1",
			magic_id: "magic-1",
		})
	})
})
