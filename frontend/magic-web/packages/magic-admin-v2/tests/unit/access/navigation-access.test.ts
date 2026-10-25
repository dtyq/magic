import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PERMISSION_KEY_MAP } from "../../../src/constants/permissions.ts"
import { RouteGroup, RouteName, RoutePath, RouteSection } from "../../../src/constants/routes.ts"
import { and, allowMagic, officialOrganization } from "../../../src/routes/access.ts"
import { createNavigation } from "../../../src/routes/menu.ts"
import type { Route } from "../../../src/routes/types.ts"

const routes: Route[] = [
	{
		name: RouteName.PlatformInfo,
		path: RoutePath.PlatformInfo,
		titleKey: "nav.item.platformInfo",
		validate: and(
			officialOrganization,
			allowMagic(PERMISSION_KEY_MAP.PLATFORM_INFO_MANAGEMENT_QUERY),
		),
		meta: { section: RouteSection.Platform, group: RouteGroup.BasicSettings },
	},
	{
		name: RouteName.ExamplesList,
		path: RoutePath.ExamplesList,
		titleKey: "nav.item.exampleList",
		meta: { section: RouteSection.Examples, group: RouteGroup.ExampleData },
	},
]

function createAccess({
	isOfficialOrganization,
	magicPermissionKeys,
}: {
	isOfficialOrganization: boolean
	magicPermissionKeys: string[]
}) {
	return {
		organizationCode: "organization-code",
		hasTeamshareAllPermissions: false,
		isOfficialOrganization,
		isPersonalOrganization: false,
		magicPermissionKeys,
		teamsharePermissionKeys: [],
		user: { id: "user-id", name: "Admin" },
		organization: {
			organizationCode: "organization-code",
			name: "Organization",
		},
	}
}

describe("navigation access", () => {
	it("hides the entire platform section for non-official organizations", () => {
		const navigation = createNavigation(
			routes,
			createAccess({
				isOfficialOrganization: false,
				magicPermissionKeys: [PERMISSION_KEY_MAP.MAGIC_PLATFORM_PERMISSIONS],
			}),
		)

		assert.equal(
			navigation.some((section) => section.id === RouteSection.Platform),
			false,
		)
		assert.equal(
			navigation.some((section) => section.id === RouteSection.Examples),
			true,
		)
	})

	it("hides the entire platform section when no platform management permission is present", () => {
		const navigation = createNavigation(
			routes,
			createAccess({
				isOfficialOrganization: true,
				magicPermissionKeys: [PERMISSION_KEY_MAP.MAGIC_ALL_PERMISSIONS],
			}),
		)

		assert.equal(
			navigation.some((section) => section.id === RouteSection.Platform),
			false,
		)
	})

	it("keeps the platform section for official organizations with platform management permissions", () => {
		const navigation = createNavigation(
			routes,
			createAccess({
				isOfficialOrganization: true,
				magicPermissionKeys: [PERMISSION_KEY_MAP.PLATFORM_INFO_MANAGEMENT_QUERY],
			}),
		)

		assert.equal(
			navigation.some((section) => section.id === RouteSection.Platform),
			true,
		)
	})
})
