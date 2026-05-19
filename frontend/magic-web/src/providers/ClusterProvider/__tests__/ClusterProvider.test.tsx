import { act, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { configStore } from "@/models/config"
import { ClusterProvider } from "../ClusterProvider"
import { useClusterCode } from "../hooks/useClusterCode"

vi.mock("../ClusterConfigSyncProvider", () => ({
	ClusterConfigSyncProvider: ({ children }: { children: React.ReactNode }) => children,
}))

function ClusterProbe() {
	const { clusterCode } = useClusterCode()

	return <div data-testid="cluster-code">{clusterCode}</div>
}

describe("ClusterProvider", () => {
	beforeEach(() => {
		configStore.cluster.setClusterCode("")
	})

	it("syncs local cluster from the global active cluster by default", async () => {
		act(() => {
			configStore.cluster.setClusterCode("global-active")
		})

		render(
			<ClusterProvider>
				<ClusterProbe />
			</ClusterProvider>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("cluster-code").textContent).toBe("global-active")
		})
	})

	it("disables global-to-local sync with syncFromGlobalClusterCode", async () => {
		act(() => {
			configStore.cluster.setClusterCode("global-active")
		})

		render(
			<ClusterProvider syncFromGlobalClusterCode={false}>
				<ClusterProbe />
			</ClusterProvider>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("cluster-code").textContent).toBe("")
		})
	})

	it("syncs global-to-local state when syncFromGlobalClusterCode is explicitly enabled", async () => {
		act(() => {
			configStore.cluster.setClusterCode("global-active")
		})

		render(
			<ClusterProvider syncFromGlobalClusterCode={true}>
				<ClusterProbe />
			</ClusterProvider>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("cluster-code").textContent).toBe("global-active")
		})
	})
})
