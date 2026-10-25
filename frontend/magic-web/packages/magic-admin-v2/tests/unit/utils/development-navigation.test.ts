import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { RouteGroup, RoutePath, RouteSection } from "../../../src/constants/routes.ts"
import { createNavigation } from "../../../src/routes/menu.ts"
import type { AccessContext } from "../../../src/runtime/types.ts"
import { developmentRoutes } from "../../../src/standalone/routes/development.tsx"

function createAccess(): AccessContext {
	return {
		organizationCode: "organization-code",
		hasTeamshareAllPermissions: false,
		isOfficialOrganization: false,
		isPersonalOrganization: false,
		magicPermissionKeys: [],
		teamsharePermissionKeys: [],
		user: { id: "user-id", name: "Admin" },
		organization: {
			organizationCode: "organization-code",
			name: "Organization",
		},
	}
}

describe("development navigation", () => {
	it("keeps every frontend example category in the standalone development menu", () => {
		const navigation = createNavigation(developmentRoutes, createAccess(), "/admin-v2")
		const examples = navigation.find((section) => section.id === RouteSection.Examples)

		assert.ok(examples)
		assert.deepEqual(
			examples.groups.map((group) => group.id),
			[
				RouteGroup.ExampleDashboard,
				RouteGroup.ExampleData,
				RouteGroup.ExampleForms,
				RouteGroup.ExampleSettings,
				RouteGroup.ExampleDetails,
				RouteGroup.ExampleStates,
			],
		)

		const hrefs = examples.groups.flatMap((group) => group.items.map((item) => item.href))
		for (const path of [
			RoutePath.ExamplesDashboard,
			RoutePath.ExamplesList,
			RoutePath.ExamplesCards,
			RoutePath.ExamplesFormSingle,
			RoutePath.ExamplesFormMulti,
			RoutePath.ExamplesSettings,
			RoutePath.ExamplesDetail,
			RoutePath.ExamplesDetailEdit,
			RoutePath.ExamplesEmpty,
			RoutePath.ExamplesWizard,
			RoutePath.ExamplesDialog,
			RoutePath.ExamplesSheet,
		]) {
			assert.ok(
				hrefs.includes(`/admin-v2/${path}`),
				`Missing development menu route: ${path}`,
			)
		}
	})
})
