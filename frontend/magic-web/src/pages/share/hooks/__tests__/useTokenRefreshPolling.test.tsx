import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useTokenRefreshPolling } from "../useTokenRefreshPolling"

const mocks = vi.hoisted(() => ({
	getShareResource: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getShareResource: mocks.getShareResource,
	},
}))

const FIFTY_MINUTES = 1000 * 60 * 50

describe("useTokenRefreshPolling", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()
		delete (window as Window & { temporary_token?: string }).temporary_token
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("ignores a token response from an inactive share scope", async () => {
		let resolveOldRequest: (value: { temporary_token: string }) => void = () => undefined
		const oldRequest = new Promise<{ temporary_token: string }>((resolve) => {
			resolveOldRequest = resolve
		})
		mocks.getShareResource.mockReturnValueOnce(oldRequest)

		const { rerender } = renderHook(
			({ resourceId, scopeKey }) =>
				useTokenRefreshPolling({
					resourceId,
					scopeKey,
					data: { temporary_token: "loaded-token" },
				}),
			{
				initialProps: {
					resourceId: "resource-app-1",
					scopeKey: "app-1",
				},
			},
		)

		await act(async () => {
			await vi.advanceTimersByTimeAsync(FIFTY_MINUTES)
			window.dispatchEvent(new Event("focus"))
			await Promise.resolve()
		})
		expect(mocks.getShareResource).toHaveBeenCalledWith({
			resource_id: "resource-app-1",
			password: undefined,
		})

		rerender({ resourceId: "resource-app-2", scopeKey: "app-2" })
		await act(async () => {
			resolveOldRequest({ temporary_token: "stale-token" })
			await Promise.resolve()
		})

		expect(window.temporary_token).toBeUndefined()
	})

	it("does not refresh on focus while the loaded token is still fresh", async () => {
		const onTokenRefreshed = vi.fn()
		mocks.getShareResource.mockResolvedValue({ temporary_token: "refreshed-token" })

		renderHook(() =>
			useTokenRefreshPolling({
				resourceId: "resource-app-1",
				scopeKey: "app-1",
				data: { temporary_token: "loaded-token" },
				onTokenRefreshed,
			}),
		)

		await act(async () => {
			window.dispatchEvent(new Event("focus"))
			await Promise.resolve()
		})

		expect(mocks.getShareResource).not.toHaveBeenCalled()
		expect(onTokenRefreshed).not.toHaveBeenCalled()
	})

	it("notifies the caller of a token returned for the active share scope", async () => {
		const onTokenRefreshed = vi.fn()
		mocks.getShareResource.mockResolvedValue({ temporary_token: "refreshed-token" })

		renderHook(() =>
			useTokenRefreshPolling({
				resourceId: "resource-app-1",
				scopeKey: "app-1",
				data: { temporary_token: "loaded-token" },
				onTokenRefreshed,
			}),
		)

		await act(async () => {
			await vi.advanceTimersByTimeAsync(FIFTY_MINUTES)
			window.dispatchEvent(new Event("focus"))
			await Promise.resolve()
		})

		expect(onTokenRefreshed).toHaveBeenCalledWith({
			temporary_token: "refreshed-token",
		})
		expect(window.temporary_token).toBeUndefined()
	})
})
