import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LoginDeployment } from "@/pages/login/constants"
import { LoginServiceProvider } from "../LoginServiceProvider"
import { useLoginServiceContext } from "../useLoginServiceContext"

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

function ContextProbe() {
	const { deployment, showPublicDeployment, showPrivateDeployment, setPrivateClusterCode } =
		useLoginServiceContext()

	return (
		<div>
			<div data-testid="deployment">{deployment}</div>
			<button
				type="button"
				data-testid="switch-public"
				onClick={() => showPublicDeployment()}
			>
				switch-public
			</button>
			<button
				type="button"
				data-testid="switch-private"
				onClick={() => showPrivateDeployment()}
			>
				switch-private
			</button>
			<button
				type="button"
				data-testid="set-deploy-code"
				onClick={() => setPrivateClusterCode("private-next")}
			>
				set-deploy-code
			</button>
		</div>
	)
}

describe("LoginServiceProvider", () => {
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

	it("defaults to private deployment when cached private code exists", async () => {
		mocks.configStore.cluster.clusterCodeCache = "private-demo"

		render(
			<LoginServiceProvider service={createService() as never}>
				<ContextProbe />
			</LoginServiceProvider>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("deployment").textContent).toBe(
				LoginDeployment.PrivateDeploymentLogin,
			)
		})
		expect(mocks.setClusterCode).toHaveBeenLastCalledWith("private-demo")
	})

	it("keeps public deployment when no cached private code exists", async () => {
		render(
			<LoginServiceProvider service={createService() as never}>
				<ContextProbe />
			</LoginServiceProvider>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("deployment").textContent).toBe(
				LoginDeployment.PublicDeploymentLogin,
			)
		})
		expect(mocks.setClusterCode).toHaveBeenLastCalledWith("")
	})

	it("keeps private deployment after logout when only cached code remains", async () => {
		mocks.configStore.cluster.clusterCode = ""
		mocks.configStore.cluster.clusterCodeCache = "private-after-logout"

		render(
			<LoginServiceProvider service={createService() as never}>
				<ContextProbe />
			</LoginServiceProvider>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("deployment").textContent).toBe(
				LoginDeployment.PrivateDeploymentLogin,
			)
		})
		expect(mocks.setClusterCode).toHaveBeenLastCalledWith("private-after-logout")
	})

	it("clears login scoped cluster when switching back to public login", async () => {
		mocks.configStore.cluster.clusterCodeCache = "private-demo"

		render(
			<LoginServiceProvider service={createService() as never}>
				<ContextProbe />
			</LoginServiceProvider>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("deployment").textContent).toBe(
				LoginDeployment.PrivateDeploymentLogin,
			)
		})

		fireEvent.click(screen.getByTestId("switch-public"))

		await waitFor(() => {
			expect(screen.getByTestId("deployment").textContent).toBe(
				LoginDeployment.PublicDeploymentLogin,
			)
		})
		expect(mocks.setClusterCode).toHaveBeenLastCalledWith("")
	})

	it("restores cached private code when switching from public back to private", async () => {
		mocks.configStore.cluster.clusterCodeCache = "private-demo"

		render(
			<LoginServiceProvider service={createService() as never}>
				<ContextProbe />
			</LoginServiceProvider>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("deployment").textContent).toBe(
				LoginDeployment.PrivateDeploymentLogin,
			)
		})

		fireEvent.click(screen.getByTestId("switch-public"))
		fireEvent.click(screen.getByTestId("switch-private"))

		await waitFor(() => {
			expect(screen.getByTestId("deployment").textContent).toBe(
				LoginDeployment.PrivateDeploymentLogin,
			)
		})
		expect(mocks.setClusterCode).toHaveBeenLastCalledWith("private-demo")
	})

	it("persists cached private code when setting a new deploy code", async () => {
		render(
			<LoginServiceProvider service={createService() as never}>
				<ContextProbe />
			</LoginServiceProvider>,
		)

		fireEvent.click(screen.getByTestId("set-deploy-code"))

		expect(mocks.setClusterCode).toHaveBeenLastCalledWith("private-next")
		expect(mocks.setClusterCodeCache).toHaveBeenCalledWith("private-next")
	})
})
