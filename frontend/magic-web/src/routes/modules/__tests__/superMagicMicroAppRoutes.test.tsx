import { render, screen } from "@testing-library/react"
import { Suspense } from "react"
import { MemoryRouter, useRoutes } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RoutePath } from "@/constants/routes"
import { RouteName } from "@/routes/constants"
import { microAppPublicRoutes, superMagicMicroAppRoutes } from "../superMagicMicroAppRoutes"

const { featureState, listPage, detailPage, sharePage } = vi.hoisted(() => ({
	featureState: { enabled: true },
	listPage: vi.fn(),
	detailPage: vi.fn(),
	sharePage: vi.fn(),
}))

vi.mock("@/services/microAppFeature", () => ({
	isMicroAppEnabled: () => featureState.enabled,
}))
vi.mock("@/pages/superMagic/pages/MicroAppsPage", () => ({ default: listPage }))
vi.mock("@/pages/superMagic/lazy/MicroAppPage", () => ({ default: detailPage }))
vi.mock("@/pages/share/microApp", () => ({ default: sharePage }))
vi.mock("@/pages/exception/not-found", () => ({
	default: () => <div data-testid="not-found" />,
}))

function TestRoutes() {
	return useRoutes([
		...superMagicMicroAppRoutes,
		...microAppPublicRoutes,
		{
			path: "/:clusterCode/super/:projectId/:topicId",
			element: <div data-testid="generic-project" />,
		},
	])
}

function renderRoute(path: string) {
	return render(
		<MemoryRouter initialEntries={[path]}>
			<Suspense fallback={null}>
				<TestRoutes />
			</Suspense>
		</MemoryRouter>,
	)
}

beforeEach(() => {
	featureState.enabled = true
	vi.clearAllMocks()
	listPage.mockImplementation(() => <div data-testid="micro-app-list" />)
	detailPage.mockImplementation(() => <div data-testid="micro-app-detail" />)
	sharePage.mockImplementation(() => <div data-testid="micro-app-share" />)
})

describe("superMagicMicroAppRoutes", () => {
	it("registers workspace micro app routes", () => {
		const listRoute = superMagicMicroAppRoutes.find((item) => item.name === RouteName.MicroApps)
		const mobileListRoute = superMagicMicroAppRoutes.find(
			(item) => item.name === RouteName.MicroAppsList,
		)
		const detailRoute = superMagicMicroAppRoutes.find(
			(item) => item.name === RouteName.MicroApp,
		)

		expect(RoutePath.MicroApps).toBe("/super/micro-apps")
		expect(RoutePath.MicroAppsList).toBe("/super/micro-apps/list")
		expect(RoutePath.MicroApp).toBe("/super/micro-app/:appId")
		expect(listRoute?.path).toBe("/:clusterCode/super/micro-apps")
		expect(mobileListRoute?.path).toBe("/:clusterCode/super/micro-apps/list")
		expect(detailRoute?.path).toBe("/:clusterCode/super/micro-app/:appId")
	})

	it("registers public micro app share route", () => {
		const shareRoute = microAppPublicRoutes.find(
			(item) => item.name === RouteName.MicroAppShare,
		)

		expect(RoutePath.MicroAppShare).toBe("/micro-app/:appId")
		expect(shareRoute?.path).toBe("/micro-app/:appId")
	})

	it.each([
		["/global/super/micro-apps", "micro-app-list"],
		["/global/super/micro-apps/list", "micro-app-list"],
		["/global/super/micro-app/app-1", "micro-app-detail"],
		["/micro-app/app-1", "micro-app-share"],
	])("opens %s when enabled", async (path, pageTestId) => {
		renderRoute(path)
		expect(await screen.findByTestId(pageTestId)).toBeVisible()
	})

	it.each([
		"/global/super/micro-apps",
		"/global/super/micro-apps/list",
		"/global/super/micro-app/app-1",
		"/micro-app/app-1?password=test",
	])("blocks %s without mounting a business page when disabled", async (path) => {
		featureState.enabled = false
		renderRoute(path)
		expect(await screen.findByTestId("not-found")).toBeVisible()
		expect(screen.queryByTestId("generic-project")).toBeNull()
		expect(listPage).not.toHaveBeenCalled()
		expect(detailPage).not.toHaveBeenCalled()
		expect(sharePage).not.toHaveBeenCalled()
	})
})
