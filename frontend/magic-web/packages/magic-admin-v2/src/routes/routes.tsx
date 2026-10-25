import { lazy } from "react"
import { RouteGroup, RouteName, RoutePath, RouteSection } from "@magic-admin-v2/constants/routes"
import { RuntimeMode } from "@magic-admin-v2/constants/runtime"
import AccessDeniedPage from "@magic-admin-v2/pages/access-denied-page"
import { DefaultRouteRedirect } from "@magic-admin-v2/routes/default-route-redirect"
import {
	platformAppMenuAccess,
	platformInfoAccess,
	platformMarketplaceAccess,
	platformModelAccess,
	platformOfficialStaffAccess,
	platformPublishReviewAccess,
	platformSystemCapabilitiesAccess,
	platformSlidesTemplateAccess,
} from "@magic-admin-v2/routes/route-access"
import { editionRoutes, editionStandaloneRoutes } from "@magic-admin-v2/routes/edition"
import type { Route } from "@magic-admin-v2/routes/types"

const DashboardLayout = lazy(() => import("@magic-admin-v2/layouts/dashboard-layout"))
const DashboardPage = lazy(() => import("@magic-admin-v2/pages/dashboard-page"))
const NotFoundPage = lazy(() => import("@magic-admin-v2/pages/not-found-page"))
const PlatformAppMenuPage = lazy(
	() => import("@magic-admin-v2/features/platform-app-menu/platform-app-menu-page"),
)
const PlatformInfoPage = lazy(
	() => import("@magic-admin-v2/features/platform-info/platform-info-page"),
)
const PlatformModelListPage = lazy(
	() => import("@magic-admin-v2/features/platform-model-list/platform-model-list-page"),
)
const PlatformProviderListPage = lazy(
	() => import("@magic-admin-v2/features/platform-provider-list/platform-provider-list-page"),
)
const PlatformOfficialMarketplacePage = lazy(
	() =>
		import("@magic-admin-v2/features/platform-official-marketplace/platform-official-marketplace-page"),
)
const PlatformOfficialStaffPage = lazy(
	() => import("@magic-admin-v2/features/platform-official-staff/platform-official-staff-page"),
)
const PlatformPublishReviewPage = lazy(
	() => import("@magic-admin-v2/features/platform-publish-review/platform-publish-review-page"),
)
const PlatformSystemCapabilitiesPage = lazy(
	() =>
		import("@magic-admin-v2/features/platform-system-capabilities/platform-system-capabilities-page"),
)
const PlatformSlidesTemplatePage = lazy(
	() => import("@magic-admin-v2/features/platform-slides-template/platform-slides-template-page"),
)

function createBaseFeatureRoutes(mode: RuntimeMode): Route[] {
	return [
		{
			name: RouteName.Overview,
			path: RoutePath.Overview,
			element: <DashboardPage />,
			titleKey: "nav.item.overview",
			meta: { menuVisible: false },
		},
		{
			name: RouteName.PlatformInfo,
			path: RoutePath.PlatformInfo,
			element: <PlatformInfoPage />,
			titleKey: "nav.item.platformInfo",
			validate: platformInfoAccess,
			meta: { section: RouteSection.Platform, group: RouteGroup.BasicSettings },
		},
		{
			name: RouteName.PlatformAppMenu,
			path: RoutePath.PlatformAppMenu,
			element: <PlatformAppMenuPage />,
			titleKey: "nav.item.appMenu",
			validate: platformAppMenuAccess,
			meta: { section: RouteSection.Platform, group: RouteGroup.BasicSettings },
		},
		...(mode === RuntimeMode.Standalone ? editionStandaloneRoutes : []),
		{
			name: RouteName.PlatformModelList,
			path: RoutePath.PlatformModelList,
			element: <PlatformModelListPage />,
			titleKey: "nav.item.modelList",
			validate: platformModelAccess,
			meta: { section: RouteSection.Platform, group: RouteGroup.ModelManagement },
		},
		{
			name: RouteName.PlatformProviderList,
			path: RoutePath.PlatformProviderList,
			element: <PlatformProviderListPage />,
			titleKey: "nav.item.providerList",
			validate: platformModelAccess,
			meta: { section: RouteSection.Platform, group: RouteGroup.ModelManagement },
		},
		{
			name: RouteName.PlatformSystemCapabilities,
			path: RoutePath.PlatformSystemCapabilities,
			element: <PlatformSystemCapabilitiesPage />,
			titleKey: "nav.item.systemCapabilities",
			validate: platformSystemCapabilitiesAccess,
			meta: { section: RouteSection.Platform, group: RouteGroup.AgentManagement },
		},
		{
			name: RouteName.PlatformSlidesTemplate,
			path: RoutePath.PlatformSlidesTemplate,
			element: <PlatformSlidesTemplatePage />,
			titleKey: "nav.item.slidesTemplate",
			validate: platformSlidesTemplateAccess,
			meta: { section: RouteSection.Platform, group: RouteGroup.AgentManagement },
		},
		{
			name: RouteName.PlatformOfficialStaff,
			path: RoutePath.PlatformOfficialStaff,
			element: <PlatformOfficialStaffPage />,
			titleKey: "nav.item.officialStaff",
			validate: platformOfficialStaffAccess,
			meta: { section: RouteSection.Platform, group: RouteGroup.AgentManagement },
		},
		{
			name: RouteName.PlatformOfficialMarketplace,
			path: RoutePath.PlatformOfficialMarketplace,
			element: <PlatformOfficialMarketplacePage />,
			titleKey: "nav.item.officialMarketplace",
			validate: platformMarketplaceAccess,
			meta: { section: RouteSection.Platform, group: RouteGroup.AgentManagement },
		},
		{
			name: RouteName.PlatformPublishReview,
			path: RoutePath.PlatformPublishReview,
			element: <PlatformPublishReviewPage />,
			titleKey: "nav.item.publishReview",
			validate: platformPublishReviewAccess,
			meta: { section: RouteSection.Platform, group: RouteGroup.AgentManagement },
		},
	]
}

export function createRoutes(
	mode: RuntimeMode,
	standaloneDevelopmentRoutes: readonly Route[] = [],
): Route[] {
	return [
		{
			name: RouteName.Root,
			element: <DashboardLayout />,
			children: [
				{
					name: RouteName.Index,
					index: true,
					element: <DefaultRouteRedirect />,
				},
				...createBaseFeatureRoutes(mode),
				...editionRoutes,
				...(mode === RuntimeMode.Standalone ? standaloneDevelopmentRoutes : []),
				{
					name: RouteName.Forbidden,
					path: RoutePath.Forbidden,
					element: <AccessDeniedPage />,
					meta: { menuVisible: false },
				},
				{
					name: RouteName.NotFound,
					path: RoutePath.NotFound,
					element: <NotFoundPage />,
					meta: { menuVisible: false },
				},
			],
		},
	]
}
