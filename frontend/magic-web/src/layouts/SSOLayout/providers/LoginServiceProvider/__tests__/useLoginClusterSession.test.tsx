import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LoginDeployment } from "@/pages/login/constants"
import { useLoginClusterSession } from "../useLoginClusterSession"

const mocks = vi.hoisted(() => {
	return {
		clusterCode: "",
		setClusterCode: vi.fn(),
		configStore: {
			cluster: {
				clusterCode: "",
				clusterCodeCache: "",
			},
		},
		setClusterCodeCache: vi.fn(),
	}
})

vi.mock("@/providers/ClusterProvider", () => ({
	useClusterCode: () => ({
		clusterCode: mocks.clusterCode,
		setClusterCode: mocks.setClusterCode,
	}),
}))

vi.mock("@/models/config", () => ({
	configStore: mocks.configStore,
}))

describe("useLoginClusterSession", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.clusterCode = ""
		mocks.configStore.cluster.clusterCode = ""
		mocks.configStore.cluster.clusterCodeCache = ""
	})

	function createService() {
		return {
			get: vi.fn((key: string) => {
				if (key === "configService") {
					return {
						setClusterCodeCache: mocks.setClusterCodeCache,
					}
				}
				throw new Error(`Unexpected service lookup: ${key}`)
			}),
		}
	}

	it("starts in public login when no cached private cluster exists", async () => {
		const { result } = renderHook(() =>
			useLoginClusterSession({ service: createService() as never }),
		)

		await waitFor(() => {
			expect(result.current.deployment).toBe(LoginDeployment.PublicDeploymentLogin)
		})
		expect(mocks.setClusterCode).toHaveBeenLastCalledWith("")
	})

	it("starts in private login when a cached private cluster exists", async () => {
		mocks.configStore.cluster.clusterCodeCache = "private-demo"

		const { result } = renderHook(() =>
			useLoginClusterSession({ service: createService() as never }),
		)

		await waitFor(() => {
			expect(result.current.deployment).toBe(LoginDeployment.PrivateDeploymentLogin)
		})
		expect(mocks.setClusterCode).toHaveBeenLastCalledWith("private-demo")
	})

	it("restores the cached private cluster after switching back from public login", async () => {
		mocks.configStore.cluster.clusterCodeCache = "private-demo"

		const { result } = renderHook(() =>
			useLoginClusterSession({ service: createService() as never }),
		)

		await waitFor(() => {
			expect(result.current.deployment).toBe(LoginDeployment.PrivateDeploymentLogin)
		})

		act(() => {
			result.current.showPublicDeployment()
		})
		act(() => {
			result.current.showPrivateDeployment()
		})

		await waitFor(() => {
			expect(mocks.setClusterCode).toHaveBeenLastCalledWith("private-demo")
		})
	})

	it("persists the cached private cluster when setting a new deploy code", () => {
		const { result } = renderHook(() =>
			useLoginClusterSession({ service: createService() as never }),
		)

		act(() => {
			result.current.setPrivateClusterCode("private-next")
		})

		expect(mocks.setClusterCode).toHaveBeenLastCalledWith("private-next")
		expect(mocks.setClusterCodeCache).toHaveBeenCalledWith("private-next")
	})
})
