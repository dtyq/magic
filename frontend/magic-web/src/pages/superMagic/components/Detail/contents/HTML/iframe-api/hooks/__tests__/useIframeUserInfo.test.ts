import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useIframeUserInfo } from "../useIframeUserInfo"

function makeIframeRef(postMessage = vi.fn()) {
	return {
		current: {
			contentWindow: { postMessage },
		} as unknown as HTMLIFrameElement,
	}
}

describe("useIframeUserInfo", () => {
	it("posts user info responses to the configured target origin", async () => {
		const iframePostMessage = vi.fn()
		const iframeRef = makeIframeRef(iframePostMessage)

		const { result } = renderHook(() =>
			useIframeUserInfo({
				iframeRef,
				targetOrigin: "https://sandbox.example.com",
				getUserInfo: () => ({
					name: "Ada",
					avatar: "https://cdn.example.com/avatar.png",
					user_id: "user-1",
					magic_id: "magic-1",
					organization_code: "org-1",
				}),
			}),
		)

		await act(async () => {
			await result.current.handleUserInfoMessage("MAGIC_GET_USER_INFO_REQUEST", {
				requestId: "req-1",
			})
		})

		expect(iframePostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "MAGIC_GET_USER_INFO_RESPONSE",
				requestId: "req-1",
				success: true,
				userInfo: expect.objectContaining({
					name: "Ada",
					avatar: "https://cdn.example.com/avatar.png",
				}),
			}),
			"https://sandbox.example.com",
		)
	})
})
