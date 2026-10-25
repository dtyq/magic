import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PERMISSION_KEY_MAP } from "../../../src/constants/permissions"
import { RouteName, RouteSection } from "../../../src/constants/routes"
import { RuntimeMode } from "../../../src/constants/runtime"
import type { AccessContext } from "../../../src/runtime/types"
import { createNavigation } from "../../../src/routes/menu"
import { createRoutes } from "../../../src/routes/routes"

const embeddedRoutes = createRoutes(RuntimeMode.Embedded)
const standaloneRoutes = createRoutes(RuntimeMode.Standalone)

function createAccess(overrides: Partial<AccessContext> = {}): AccessContext {
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
		...overrides,
	}
}

function getRoute(name: string, routes = embeddedRoutes) {
	const visit = (candidates: typeof routes): (typeof routes)[number] | undefined => {
		for (const route of candidates) {
			if (route.name === name) return route
			const child = route.children ? visit(route.children) : undefined
			if (child) return child
		}
		return undefined
	}

	return visit(routes)
}

function findRoute(name: string, routes = embeddedRoutes) {
	const route = getRoute(name, routes)
	assert.ok(route, `Missing route: ${name}`)
	assert.ok(route.validate, `Missing route validator: ${name}`)
	return route
}

function canAccess(name: string, access: AccessContext, routes = embeddedRoutes) {
	const validate = findRoute(name, routes).validate
	assert.ok(validate)
	return validate(access)
}

function platformMenuItems(access: AccessContext, routes = embeddedRoutes) {
	return createNavigation(routes, access)
		.filter((section) => section.id === RouteSection.Platform)
		.flatMap((section) => section.groups.flatMap((group) => group.items))
		.map((item) => item.titleKey)
}

const removedRouteNames = [
	"platform-ai-watermark",
	"platform-custom-provider-license",
	"platform-maintenance",
	"platform-resource-alerts",
	"platform-package-list",
	"platform-package-detail",
	"platform-order-list",
	"internal-publish-review",
	"platform-model-identifier-mapping",
	"platform-model-multiplier",
]

describe("platform route access", () => {
	it("does not register commercial pages in embedded or standalone routes", () => {
		for (const name of removedRouteNames) {
			assert.equal(getRoute(name, embeddedRoutes), undefined)
			assert.equal(getRoute(name, standaloneRoutes), undefined)
		}
	})

	it("uses page-level platform information permissions for settings pages", () => {
		const access = createAccess({
			isOfficialOrganization: true,
			magicPermissionKeys: [PERMISSION_KEY_MAP.PLATFORM_INFO_MANAGEMENT_QUERY],
		})

		assert.equal(canAccess(RouteName.PlatformInfo, access), true)
		assert.deepEqual(platformMenuItems(access), ["nav.item.platformInfo"])
		assert.deepEqual(platformMenuItems(access, standaloneRoutes), ["nav.item.platformInfo"])
	})

	it("does not let the broad Magic administrator group enter platform pages", () => {
		const access = createAccess({
			isOfficialOrganization: true,
			magicPermissionKeys: [PERMISSION_KEY_MAP.MAGIC_ALL_PERMISSIONS],
		})

		assert.equal(canAccess(RouteName.PlatformInfo, access), false)
		assert.deepEqual(platformMenuItems(access, standaloneRoutes), [])
	})

	it("keeps platform settings restricted to the official organization", () => {
		const access = createAccess({
			isOfficialOrganization: false,
			magicPermissionKeys: [PERMISSION_KEY_MAP.PLATFORM_INFO_MANAGEMENT_QUERY],
		})

		assert.equal(canAccess(RouteName.PlatformInfo, access), false)
		assert.deepEqual(platformMenuItems(access, standaloneRoutes), [])
	})

	it("keeps the platform group behavior through the concrete page permission", () => {
		const access = createAccess({
			isOfficialOrganization: true,
			magicPermissionKeys: [PERMISSION_KEY_MAP.MAGIC_PLATFORM_PERMISSIONS],
		})

		assert.equal(canAccess(RouteName.PlatformInfo, access), true)
	})

	it("shows PPT templates for either legacy permission and keeps personal orgs hidden", () => {
		const queryAccess = createAccess({
			isOfficialOrganization: true,
			magicPermissionKeys: [PERMISSION_KEY_MAP.SLIDES_TEMPLATE_QUERY],
		})
		const editAccess = createAccess({
			isOfficialOrganization: true,
			magicPermissionKeys: [PERMISSION_KEY_MAP.SLIDES_TEMPLATE_EDIT],
		})
		const personalAccess = createAccess({
			isOfficialOrganization: true,
			isPersonalOrganization: true,
			magicPermissionKeys: [PERMISSION_KEY_MAP.SLIDES_TEMPLATE_QUERY],
		})

		assert.equal(canAccess(RouteName.PlatformSlidesTemplate, queryAccess), true)
		assert.equal(canAccess(RouteName.PlatformSlidesTemplate, editAccess), true)
		assert.equal(canAccess(RouteName.PlatformSlidesTemplate, personalAccess), false)
		assert.deepEqual(platformMenuItems(queryAccess), ["nav.item.slidesTemplate"])
	})
})
