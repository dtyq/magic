import { act, cleanup, render, renderHook } from "@testing-library/react"
import { useEffect, type PropsWithChildren } from "react"
import { MemoryRouter, Route, Routes, useNavigate } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { appStore } from "@/stores/app"

const mocks = vi.hoisted(() => ({
	accountSwitch: vi.fn(),
	setClusterCode: vi.fn(),
	ensureClusterConfigReady: vi.fn(),
	getPrivateConfigure: vi.fn(),
	refreshAccountContextPage: vi.fn(),
	historyReplace: vi.fn(),
	routesMatch: vi.fn(),
	userStore: {
		account: {
			accounts: [
				{
					deployCode: "mock-target-cluster",
					magic_id: "mock-magic-id",
					magic_user_id: "mock-user-id",
					organizationCode: "mock-org-code",
				},
			],
		},
	},
	configStore: {
		cluster: {
			clusterCode: "mock-current-cluster",
			clusterConfig: { "mock-target-cluster": {} } as Record<string, object>,
		},
	},
}))

vi.mock("@/models/config", () => ({
	configStore: mocks.configStore,
}))

vi.mock("@/models/user", () => ({
	userStore: mocks.userStore,
}))

vi.mock("@/stores/authentication", () => ({
	useAccount: () => ({
		accountSwitch: mocks.accountSwitch,
	}),
}))

vi.mock("@/services", () => ({
	service: {
		get: () => ({
			setClusterCode: mocks.setClusterCode,
		}),
	},
}))

vi.mock("@/services/config/cluster-config-loader", () => ({
	ensureClusterConfigReady: mocks.ensureClusterConfigReady,
}))

vi.mock("@/apis", () => ({
	CommonApi: {
		getPrivateConfigure: mocks.getPrivateConfigure,
	},
}))

vi.mock("@/routes/history/helpers", () => ({
	convertSearchParams: vi.fn(() => ({})),
	routesMatch: mocks.routesMatch,
}))

vi.mock("@/routes/helpers", () => ({
	defaultClusterCode: "global",
}))

vi.mock("@/routes", () => ({
	history: {
		replace: mocks.historyReplace,
	},
}))

vi.mock("@/routes/constants", () => ({
	RouteName: {
		Super: "Super",
	},
}))

vi.mock("@/routes/const/whiteRoutes", () => ({
	whiteListRoutes: ["/:clusterCode/preview"],
}))

vi.mock("@/providers/ClusterProvider", () => ({
	useClusterCode: () => ({ setClusterCode: vi.fn() }),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("../../ClusterLoginFailed", () => ({
	default: ({ children }: PropsWithChildren) => <div data-testid="login-failed">{children}</div>,
}))

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({ children }: PropsWithChildren) => <button>{children}</button>,
}))

vi.mock("@/components/shadcn-ui/spinner", () => ({
	Spinner: () => <span />,
}))

vi.mock("@/broadcastChannel/eventFactory/accountContextRefresh", () => ({
	refreshAccountContextPage: mocks.refreshAccountContextPage,
}))

import { useClusterSwitch } from "../useClusterSwitch"
import { ClusterLayoutBase } from "../../ClusterLayoutBase"

describe("useClusterSwitch", () => {
	const account = { ...mocks.userStore.account.accounts[0] }
	const wrapper = ({ children }: PropsWithChildren) => <MemoryRouter>{children}</MemoryRouter>
	function deferred() {
		let resolve!: () => void
		let reject!: (error: Error) => void
		const promise = new Promise<void>((res, rej) => {
			resolve = res
			reject = rej
		})
		return { promise, resolve, reject }
	}
	const flush = () =>
		act(async () => {
			await Promise.resolve()
		})
	beforeEach(() => {
		vi.clearAllMocks()
		appStore.setAppInitPromise(Promise.resolve({ result: "SUCCESS" }))
		mocks.configStore.cluster.clusterCode = "mock-current-cluster"
		mocks.configStore.cluster.clusterConfig = { "mock-target-cluster": {} }
		mocks.userStore.account.accounts = [{ ...account }]
		mocks.accountSwitch.mockResolvedValue(undefined)
		mocks.getPrivateConfigure.mockResolvedValue({})
		mocks.ensureClusterConfigReady.mockResolvedValue(undefined)
	})
	afterEach(() => {
		cleanup()
		appStore.setAppInitPromise(null)
		vi.restoreAllMocks()
	})

	function renderLayout(path = "/mock-target-cluster/page") {
		const mounted = vi.fn()
		const unmounted = vi.fn()
		const open = vi.fn()
		let navigate!: ReturnType<typeof useNavigate>
		function Child() {
			useEffect(() => {
				mounted()
				return unmounted
			}, [])
			return <div data-testid="child-view" />
		}
		function Layout() {
			navigate = useNavigate()
			return <ClusterLayoutBase loginAdapter={{ open }} />
		}
		const view = render(
			<MemoryRouter initialEntries={[path]}>
				<Routes>
					<Route path="/:clusterCode" element={<Layout />}>
						<Route path="*" element={<Child />} />
					</Route>
				</Routes>
			</MemoryRouter>,
		)
		return { ...view, mounted, unmounted, open, navigate: (path: string) => navigate(path) }
	}
	it("waits for the complete bootstrap promise before reading hydrated accounts", async () => {
		const init = deferred()
		appStore.setAppInitPromise(init.promise)
		mocks.userStore.account.accounts = []
		const view = renderLayout()
		await flush()
		expect(view.queryByTestId("child-view")).toBeNull()
		expect(mocks.accountSwitch).not.toHaveBeenCalled()
		expect(mocks.getPrivateConfigure).not.toHaveBeenCalled()
		await act(async () => {
			mocks.userStore.account.accounts.push(account)
			init.resolve()
		})
		expect(mocks.accountSwitch).toHaveBeenCalledTimes(1)
		expect(mocks.refreshAccountContextPage).toHaveBeenCalledTimes(1)
	})
	it("admits the account restored by DingTalk without switching it again", async () => {
		const init = deferred()
		appStore.setAppInitPromise(init.promise)
		const view = renderLayout()
		await act(async () => {
			mocks.configStore.cluster.clusterCode = "mock-target-cluster"
			init.resolve()
		})
		expect(view.mounted).toHaveBeenCalledTimes(1)
		expect(mocks.accountSwitch).not.toHaveBeenCalled()
	})
	it("does not admit when the bootstrap promise rejects", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined)
		appStore.setAppInitPromise(Promise.reject(new Error("bootstrap failed")))
		mocks.configStore.cluster.clusterCode = "mock-target-cluster"
		const view = renderLayout()
		await flush()
		expect(view.queryByTestId("child-view")).toBeNull()
		expect(mocks.accountSwitch).not.toHaveBeenCalled()
	})
	it("uses the current account after a later login instead of a cached bootstrap failure", async () => {
		appStore.setAppInitPromise(
			Promise.resolve({ result: "INIT_FAILED_REDIRECTED", error: new Error("old failure") }),
		)
		mocks.configStore.cluster.clusterCode = "mock-target-cluster"
		const view = renderLayout()
		await flush()
		expect(view.queryByTestId("child-view")).not.toBeNull()
		expect(mocks.accountSwitch).not.toHaveBeenCalled()
	})

	it("does not switch back when adding kk changes global cluster and accounts", async () => {
		mocks.configStore.cluster.clusterCode = "mock-target-cluster"
		const { result, rerender } = renderHook(
			() => useClusterSwitch({ targetClusterCode: "mock-target-cluster" }),
			{ wrapper },
		)
		await flush()
		act(() => {
			mocks.configStore.cluster.clusterCode = "kk"
			mocks.userStore.account.accounts.push({ ...account, deployCode: "kk" })
			rerender()
		})
		await flush()
		expect(result.current.isSameCluster).toBe(true)
		expect(mocks.accountSwitch).not.toHaveBeenCalled()
		expect(mocks.getPrivateConfigure).not.toHaveBeenCalled()
	})
	it("keeps the Outlet mounted during same-cluster pathname and query navigation", async () => {
		mocks.configStore.cluster.clusterCode = "mock-target-cluster"
		const view = renderLayout()
		await flush()
		await act(async () => view.navigate("/mock-target-cluster/page?tab=other"))
		await act(async () => view.navigate("/mock-target-cluster/another"))
		expect(view.mounted).toHaveBeenCalledTimes(1)
		expect(view.unmounted).not.toHaveBeenCalled()
		expect(mocks.accountSwitch).not.toHaveBeenCalled()
	})
	it("still checks a protected route after navigating from a public route", async () => {
		mocks.userStore.account.accounts = []
		const view = renderLayout("/mock-target-cluster/preview")
		await flush()
		expect(view.queryByTestId("child-view")).not.toBeNull()
		await act(async () => view.navigate("/mock-target-cluster/page"))
		expect(view.queryByTestId("login-failed")).not.toBeNull()
	})
	it("continues one pending switch across unrelated query changes", async () => {
		const task = deferred()
		mocks.accountSwitch.mockReturnValueOnce(task.promise)
		const view = renderLayout()
		await flush()
		await act(async () => view.navigate("/mock-target-cluster/page?tab=other"))
		expect(mocks.accountSwitch).toHaveBeenCalledTimes(1)
		expect(view.queryByTestId("child-view")).toBeNull()
		await act(async () => task.resolve())
		expect(view.queryByTestId("child-view")).not.toBeNull()
		expect(mocks.refreshAccountContextPage).toHaveBeenCalledTimes(1)
	})
	it("does not admit or refresh when account switching fails", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined)
		mocks.accountSwitch.mockRejectedValueOnce(new Error("switch failed"))
		const view = renderLayout()
		await flush()
		expect(view.queryByTestId("login-failed")).not.toBeNull()
		expect(mocks.refreshAccountContextPage).not.toHaveBeenCalled()
	})
	it("ignores stale configuration results after changing target", async () => {
		const task = deferred()
		mocks.getPrivateConfigure.mockReturnValueOnce(task.promise)
		const view = renderLayout()
		await flush()
		await act(async () => view.navigate("/missing/page"))
		await act(async () => task.resolve())
		expect(view.queryByTestId("login-failed")).not.toBeNull()
		expect(mocks.accountSwitch).not.toHaveBeenCalled()
	})
	it("waits for the previous switch before reconciling another target", async () => {
		const task = deferred()
		mocks.accountSwitch.mockReturnValueOnce(task.promise)
		const view = renderLayout()
		await flush()
		await act(async () => view.navigate("/missing/page"))
		expect(mocks.getPrivateConfigure).toHaveBeenCalledTimes(1)
		await act(async () => task.resolve())
		expect(view.queryByTestId("login-failed")).not.toBeNull()
		expect(mocks.refreshAccountContextPage).not.toHaveBeenCalled()
	})
	it("refreshes once when navigation returns to the target of a pending switch", async () => {
		const task = deferred()
		mocks.accountSwitch.mockReturnValueOnce(task.promise)
		const view = renderLayout()
		await flush()
		await act(async () => view.navigate("/missing/page"))
		await act(async () => view.navigate("/mock-target-cluster/page"))
		await act(async () => {
			mocks.configStore.cluster.clusterCode = "mock-target-cluster"
			task.resolve()
		})
		expect(mocks.accountSwitch).toHaveBeenCalledTimes(1)
		expect(mocks.refreshAccountContextPage).toHaveBeenCalledTimes(1)
	})
	it("does not refresh after unmounting a pending switch", async () => {
		const task = deferred()
		mocks.accountSwitch.mockReturnValueOnce(task.promise)
		const view = renderLayout()
		await flush()
		view.unmount()
		await act(async () => task.resolve())
		expect(mocks.refreshAccountContextPage).not.toHaveBeenCalled()
	})
	it("does not overwrite a new active cluster when config discovery finishes", async () => {
		mocks.configStore.cluster.clusterCode = "mock-target-cluster"
		delete mocks.configStore.cluster.clusterConfig["mock-target-cluster"]
		const task = deferred()
		mocks.ensureClusterConfigReady.mockReturnValueOnce(task.promise)
		const view = renderLayout()
		await flush()
		mocks.configStore.cluster.clusterCode = "kk"
		await act(async () => task.resolve())
		expect(mocks.setClusterCode).not.toHaveBeenCalled()
		expect(view.mounted).toHaveBeenCalledTimes(1)
	})
	it("honors an explicit global query override over a private path", async () => {
		mocks.configStore.cluster.clusterCode = ""
		const view = renderLayout("/mock-target-cluster/page?thirdPartyAuthDeployCode=global")
		await flush()
		expect(view.queryByTestId("child-view")).not.toBeNull()
		expect(mocks.accountSwitch).not.toHaveBeenCalled()
	})
	it("retains invalid-cluster redirect behavior", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined)
		mocks.getPrivateConfigure.mockRejectedValueOnce(new Error("invalid cluster"))
		renderLayout()
		await flush()
		expect(mocks.historyReplace).toHaveBeenCalled()
	})
})
