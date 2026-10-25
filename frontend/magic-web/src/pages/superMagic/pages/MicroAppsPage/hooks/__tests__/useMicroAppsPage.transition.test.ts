import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useMicroAppsPage } from "../useMicroAppsPage"

const mocks = vi.hoisted(() => ({
	getMicroApps: vi.fn(),
	user: {
		isPersonalOrganization: false,
		organizationCode: "org-1",
		userInfo: { user_id: "user-1" },
	},
}))
vi.mock("@/apis", () => ({ SuperMagicApi: { getMicroApps: mocks.getMicroApps } }))
vi.mock("@/models/user", () => ({ userStore: { user: mocks.user } }))

function response(id: string) {
	return { list: [{ app_id: id, app_name: id }], total: 1, page: 1, page_size: 20 }
}
function deferred() {
	let resolve!: (value: ReturnType<typeof response>) => void
	const promise = new Promise<ReturnType<typeof response>>((done) => {
		resolve = done
	})
	return { promise, resolve }
}
const options = { initialScope: "created", loadWorkspace: false, retainResults: true } as const

describe("micro app list transitions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.user.organizationCode = "org-1"
		mocks.getMicroApps.mockResolvedValue(response("created-app"))
	})

	it("keeps old results during a new request and uses cached results when returning", async () => {
		const next = deferred()
		const refresh = deferred()
		mocks.getMicroApps
			.mockResolvedValueOnce(response("created-app"))
			.mockReturnValueOnce(next.promise)
			.mockReturnValueOnce(refresh.promise)
		const { result } = renderHook(() => useMicroAppsPage(options))
		await waitFor(() => expect(result.current.loading).toBe(false))
		act(() => result.current.setScope("collaborated"))
		await waitFor(() => expect(mocks.getMicroApps).toHaveBeenCalledTimes(2))
		expect(result.current.initialLoading).toBe(false)
		expect(result.current.loading).toBe(true)
		expect(result.current.apps[0].app_id).toBe("created-app")
		await act(async () => next.resolve(response("collaborated-app")))
		expect(result.current.apps[0].app_id).toBe("collaborated-app")
		act(() => result.current.setScope("created"))
		expect(result.current.apps[0].app_id).toBe("created-app")
		await waitFor(() => expect(mocks.getMicroApps).toHaveBeenCalledTimes(3))
		await act(async () => refresh.resolve(response("updated-app")))
		expect(result.current.apps[0].app_id).toBe("updated-app")
	})

	it("does not retain data or cache across organization changes", async () => {
		const next = deferred()
		const { result, rerender } = renderHook(() => useMicroAppsPage(options))
		await waitFor(() => expect(result.current.loading).toBe(false))
		mocks.getMicroApps.mockReturnValue(next.promise)
		mocks.user.organizationCode = "org-2"
		rerender()
		expect(result.current.apps).toEqual([])
		expect(result.current.initialLoading).toBe(true)
		await waitFor(() => expect(mocks.getMicroApps).toHaveBeenCalledTimes(2))
		await act(async () => next.resolve(response("org-2-app")))
		expect(result.current.apps[0].app_id).toBe("org-2-app")
	})

	it("keeps the latest selection when retained requests finish out of order", async () => {
		const stale = deferred()
		mocks.getMicroApps
			.mockResolvedValueOnce(response("created-app"))
			.mockReturnValueOnce(stale.promise)
			.mockResolvedValueOnce(response("recent-app"))
		const { result } = renderHook(() => useMicroAppsPage(options))
		await waitFor(() => expect(result.current.loading).toBe(false))
		act(() => result.current.setScope("collaborated"))
		await waitFor(() => expect(mocks.getMicroApps).toHaveBeenCalledTimes(2))
		act(() => result.current.setScope("recent"))
		await waitFor(() => expect(result.current.loading).toBe(false))
		await act(async () => stale.resolve(response("stale-app")))
		expect(result.current.apps[0].app_id).toBe("recent-app")
	})
})
