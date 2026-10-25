import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useMicroAppsPage } from "../useMicroAppsPage"

const mocks = vi.hoisted(() => ({ getMicroApps: vi.fn() }))
vi.mock("@/apis", () => ({ SuperMagicApi: { getMicroApps: mocks.getMicroApps } }))
vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			organizationCode: "org",
			userInfo: { user_id: "user" },
			isPersonalOrganization: false,
		},
	},
}))
const options = { searchAll: true, loadWorkspace: false, keyword: "客户" }
function response(ids: string[], total: number, page = 1) {
	return { list: ids.map((app_id) => ({ app_id, app_name: app_id })), total, page, page_size: 20 }
}

describe("unified micro app search", () => {
	beforeEach(() => vi.resetAllMocks())

	it("does not query until search is enabled", async () => {
		mocks.getMicroApps.mockResolvedValue(response([], 0))
		const { result, rerender } = renderHook(
			({ enabled }) => useMicroAppsPage({ ...options, enabled }),
			{ initialProps: { enabled: false } },
		)
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 280))
		})
		expect(mocks.getMicroApps).not.toHaveBeenCalled()
		rerender({ enabled: true })
		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(mocks.getMicroApps.mock.calls.map(([params]) => params.scope)).toEqual([
			"all",
			"accessible",
		])
	})

	it("deduplicates within and across pages without ending when one source is exhausted", async () => {
		mocks.getMicroApps.mockImplementation(({ scope, page }) =>
			Promise.resolve(
				page === 1
					? response(
							scope === "all" ? ["shared", "project"] : ["shared", "published"],
							scope === "all" ? 2 : 21,
						)
					: response(
							scope === "all" ? [] : ["project", "last"],
							scope === "all" ? 2 : 21,
							page,
						),
			),
		)
		const { result } = renderHook(() => useMicroAppsPage(options))
		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(result.current.apps.map((app) => app.app_id)).toEqual([
			"shared",
			"project",
			"published",
		])
		expect(result.current.hasMore).toBe(true)
		await act(async () => {
			await result.current.loadMore()
		})
		expect(result.current.apps.map((app) => app.app_id)).toEqual([
			"shared",
			"project",
			"published",
			"last",
		])
		expect(result.current.hasMore).toBe(false)
	})

	it("keeps results and retries the same page if either source fails", async () => {
		mocks.getMicroApps.mockResolvedValue(response(["first"], 21))
		const { result } = renderHook(() => useMicroAppsPage(options))
		await waitFor(() => expect(result.current.loading).toBe(false))
		mocks.getMicroApps.mockImplementation(({ scope, page }) =>
			scope === "accessible"
				? Promise.reject(new Error("offline"))
				: Promise.resolve(response(["next"], 21, page)),
		)
		await act(async () => {
			await result.current.loadMore()
		})
		expect(result.current.apps.map((app) => app.app_id)).toEqual(["first"])
		expect(result.current.error).toBeNull()
		expect(result.current.loadMoreError).toBeInstanceOf(Error)
		mocks.getMicroApps.mockImplementation(({ page }) =>
			Promise.resolve(response(["next"], 21, page)),
		)
		await act(async () => {
			await result.current.loadMore()
		})
		expect(mocks.getMicroApps).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
		expect(result.current.apps.map((app) => app.app_id)).toEqual(["first", "next"])
		expect(result.current.loadMoreError).toBeNull()
	})

	it("ignores a request that completes after search is cleared", async () => {
		let finish!: (value: ReturnType<typeof response>) => void
		mocks.getMicroApps.mockReturnValue(
			new Promise((resolve) => {
				finish = resolve
			}),
		)
		const { result, rerender } = renderHook(
			({ enabled }) => useMicroAppsPage({ ...options, enabled }),
			{ initialProps: { enabled: true } },
		)
		await waitFor(() => expect(mocks.getMicroApps).toHaveBeenCalledTimes(2))
		rerender({ enabled: false })
		await act(async () => {
			finish(response(["stale"], 1))
		})
		expect(result.current.apps).toEqual([])
	})
})
