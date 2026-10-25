import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { PERMISSION_KEY_MAP } from "@admin/const/common"
import { findFirstAccessibleRoutePath, isRoutePathAccessible } from "../routeAccess"

const personalSuperAdmin = {
	isOfficialOrg: false,
	isPersonalOrganization: true,
	userPermissions: [PERMISSION_KEY_MAP.MAGIC_PERSON_PERMISSIONS],
	teamshareUserPermissions: [],
	env: { MAGIC_APP_ENV: "saas-test" },
}

const organizationAdmin = {
	...personalSuperAdmin,
	isPersonalOrganization: false,
	userPermissions: [PERMISSION_KEY_MAP.MAGIC_ALL_PERMISSIONS],
}

const modelControlRoutes = [
	{
		path: "/admin/ai/model",
		validateOrganization: ({ isPersonalOrganization }: { isPersonalOrganization: boolean }) =>
			!isPersonalOrganization,
		validate: () => true,
		children: [
			{
				path: "/admin/ai/model/control",
				title: "control",
				validate: () => true,
			},
		],
	},
]

describe("route organization access", () => {
	it("denies personal organizations on a restricted route and its child url", () => {
		expect(
			isRoutePathAccessible(modelControlRoutes, "/admin/ai/model", personalSuperAdmin),
		).toBe(false)
		expect(
			isRoutePathAccessible(
				modelControlRoutes,
				"/admin/ai/model/control",
				personalSuperAdmin,
			),
		).toBe(false)
	})

	it("allows the same child url for an organization admin", () => {
		expect(
			isRoutePathAccessible(modelControlRoutes, "/admin/ai/model/control", organizationAdmin),
		).toBe(true)
	})

	it("keeps personal-organization checks on enterprise model and usage control routes", () => {
		const routesSource = readFileSync(
			resolve(
				dirname(fileURLToPath(import.meta.url)),
				"../../../enterprise/src/pages/AiManage/routes.tsx",
			),
			"utf8",
		)
		const personalOrganizationCheck =
			"validateOrganization: ({ isPersonalOrganization }) => !isPersonalOrganization"

		for (const routeName of ["AdminAIModelManagement", "AdminUsageControl"] as const) {
			const start = routesSource.indexOf(`name: RouteName.${routeName}`)
			const block = routesSource.slice(start, start + 240)
			expect(block).toContain(personalOrganizationCheck)
		}
	})
	it("skips a transformed empty group and uses the next accessible sibling", () => {
		const transformedIndexRedirect = {
			index: true,
			isAccessibleIndexRedirect: true,
		} as const
		const routes = [
			{
				path: "/admin",
				children: [
					{
						path: "/admin/empty-group",
						title: "empty-group",
						children: [
							transformedIndexRedirect,
							{
								path: "/admin/empty-group/hidden",
								title: "hidden",
								validate: () => false,
							},
						],
					},
					{
						path: "/admin/usable",
						title: "usable",
						validate: () => true,
					},
				],
			},
		]

		expect(
			findFirstAccessibleRoutePath(routes[0].children ?? [], personalSuperAdmin, [routes[0]]),
		).toBe("/admin/usable")
	})
})
