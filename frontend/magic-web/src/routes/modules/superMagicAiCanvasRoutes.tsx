import { lazy } from "react"
import type { RouteObject } from "react-router"
import { RoutePath } from "@/constants/routes"
import { RouteName } from "@/routes/constants"
import ProjectOrganizationAccessGuard from "@/pages/superMagic/components/ProjectOrganizationAccessGuard"

const AiCanvasPage = lazy(() => import("@/pages/superMagic/pages/AiCanvasPage"))
const AiCanvasProjectPage = lazy(() => import("@/pages/superMagic/lazy/AiCanvasProjectPage"))

/**
 * AI canvas home and its projects. Canvas projects get their own address under the home, like
 * chat projects under `/super/chat`; the navigation service picks it by project mode, and the
 * generic project pages redirect old `/super/:projectId` links of canvas projects here.
 */
export const superMagicAiCanvasRoutes: RouteObject[] = [
	{
		name: RouteName.AiCanvas,
		path: `/:clusterCode${RoutePath.AiCanvas}`,
		element: <AiCanvasPage />,
		meta: {
			title: "routes.aiCanvas",
		},
	},
	{
		name: RouteName.AiCanvasProjectState,
		path: `/:clusterCode${RoutePath.AiCanvasProjectState}`,
		element: (
			<ProjectOrganizationAccessGuard>
				<AiCanvasProjectPage />
			</ProjectOrganizationAccessGuard>
		),
	},
]
