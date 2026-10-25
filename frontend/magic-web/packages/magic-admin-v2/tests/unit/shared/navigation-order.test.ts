import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { RouteGroup, RouteName, RouteSection } from "../../../src/constants/routes.ts"
import type { AccessContext } from "../../../src/runtime/types.ts"
import { createNavigation } from "../../../src/routes/menu.ts"
import type { Route } from "../../../src/routes/types.ts"

const access: AccessContext = {
	organizationCode: "organization-code",
	hasTeamshareAllPermissions: false,
	isOfficialOrganization: true,
	isPersonalOrganization: false,
	magicPermissionKeys: [],
	teamsharePermissionKeys: [],
	user: { id: "user-id", name: "Admin" },
	organization: {
		organizationCode: "organization-code",
		name: "Organization",
	},
}

function createRoute(
	name: string,
	section: (typeof RouteSection)[keyof typeof RouteSection],
	group: (typeof RouteGroup)[keyof typeof RouteGroup],
): Route {
	return {
		name,
		path: name,
		titleKey: name,
		meta: { section, group },
	}
}

const routes: Route[] = [
	createRoute(RouteName.SubAdmins, RouteSection.DataSecurity, RouteGroup.SecurityPermissions),
	createRoute(RouteName.AdminLogs, RouteSection.DataSecurity, RouteGroup.LogsAnalytics),
	createRoute(RouteName.ConsumptionAnalysis, RouteSection.DataSecurity, RouteGroup.DataDashboard),
	createRoute(RouteName.OrganizationAppMenu, RouteSection.AiGovernance, RouteGroup.ApplicationManagement),
	createRoute(RouteName.ModelGovernance, RouteSection.AiGovernance, RouteGroup.GovernancePolicies),
	createRoute(RouteName.CustomModelList, RouteSection.AiGovernance, RouteGroup.CustomModels),
	createRoute(RouteName.PlatformModelList, RouteSection.Platform, RouteGroup.ModelManagement),
	createRoute(RouteName.PlatformProviderList, RouteSection.Platform, RouteGroup.ModelManagement),
	createRoute(RouteName.PlatformOfficialMarketplace, RouteSection.Platform, RouteGroup.AgentManagement),
	createRoute(RouteName.PlatformTenantCredits, RouteSection.Platform, RouteGroup.TenantManagement),
	createRoute(RouteName.PlatformProxyServer, RouteSection.Platform, RouteGroup.OperationsSettings),
	createRoute(
		RouteName.PlatformAiContentReview,
		RouteSection.Platform,
		RouteGroup.OperationsSettings,
	),
	createRoute(RouteName.PlatformAppMenu, RouteSection.Platform, RouteGroup.BasicSettings),
	createRoute(RouteName.PlatformInfo, RouteSection.Platform, RouteGroup.BasicSettings),
]

describe("navigation order", () => {
	it("uses the prototype section and group order instead of route registration order", () => {
		const navigation = createNavigation(routes, access)

		assert.deepEqual(
			navigation.map((section) => section.id),
			[RouteSection.Platform, RouteSection.AiGovernance, RouteSection.DataSecurity],
		)
		assert.deepEqual(
			navigation[0]?.groups.map((group) => group.id),
			[
				RouteGroup.BasicSettings,
				RouteGroup.OperationsSettings,
				RouteGroup.TenantManagement,
				RouteGroup.AgentManagement,
				RouteGroup.ModelManagement,
			],
		)
		assert.deepEqual(
			navigation[1]?.groups.map((group) => group.id),
			[
				RouteGroup.CustomModels,
				RouteGroup.GovernancePolicies,
				RouteGroup.ApplicationManagement,
			],
		)
		assert.deepEqual(
			navigation[2]?.groups.map((group) => group.id),
			[RouteGroup.DataDashboard, RouteGroup.LogsAnalytics, RouteGroup.SecurityPermissions],
		)
	})

	it("uses the prototype item order inside a group", () => {
		const navigation = createNavigation(routes, access)
		const platform = navigation.find((section) => section.id === RouteSection.Platform)
		const basicSettings = platform?.groups.find((group) => group.id === RouteGroup.BasicSettings)
		const operations = platform?.groups.find(
			(group) => group.id === RouteGroup.OperationsSettings,
		)

		assert.deepEqual(
			basicSettings?.items.map((item) => item.titleKey),
			[RouteName.PlatformInfo, RouteName.PlatformAppMenu],
		)
		assert.deepEqual(
			operations?.items.map((item) => item.titleKey),
			[RouteName.PlatformAiContentReview, RouteName.PlatformProxyServer],
		)
	})
})
