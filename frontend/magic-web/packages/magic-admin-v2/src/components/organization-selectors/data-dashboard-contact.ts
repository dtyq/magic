import type { DataDashboardContactApi } from "@magic-admin-v2/api/data-dashboard-contact/api"
import {
	contactDepartmentToCompatibleNode,
	contactUserToCompatibleNode,
	fetchAllContactTokenPages,
	normalizeContactTokenPage,
} from "./contact-organization"
import type {
	DataDashboardContactOrganizationSelectorAdapters,
	OrganizationSelectorSearchResult,
} from "./types"

const emptySearchResult: OrganizationSelectorSearchResult = {
	items: [],
	hasMore: false,
}

/** 将数据看板后台通讯录接口适配为组织选择器协议。 */
export function createDataDashboardContactOrganizationSelectorAdapters(
	api: DataDashboardContactApi,
): DataDashboardContactOrganizationSelectorAdapters {
	const loadChildren: DataDashboardContactOrganizationSelectorAdapters["loadChildren"] = async ({
		includeMembers,
		parentId,
		signal,
	}) => {
		const departmentId = parentId || "-1"
		const [departments, users] = await Promise.all([
			fetchAllContactTokenPages((pageToken) =>
				api.getDepartmentChildren({ departmentId, pageToken, sumType: 2 }, { signal }),
			),
			includeMembers
				? fetchAllContactTokenPages((pageToken) =>
						api.getDepartmentUsers(
							{ departmentId, pageToken, recursive: 0 },
							{ signal },
						),
					)
				: Promise.resolve([]),
		])

		return [
			...departments.map(contactDepartmentToCompatibleNode),
			...users.map(contactUserToCompatibleNode),
		]
	}

	const searchMembers: DataDashboardContactOrganizationSelectorAdapters["searchMembers"] =
		async ({ pageToken, query, signal }) => {
			const normalizedQuery = query.trim()
			if (!normalizedQuery) return { items: [], hasMore: false }

			const result = normalizeContactTokenPage(
				await api.searchUsers(
					{ pageToken, query: normalizedQuery, queryType: 1, filterAgent: 0 },
					{ signal },
				),
			)

			return {
				items: result.items.map(contactUserToCompatibleNode),
				hasMore: result.hasMore,
				pageToken: result.pageToken,
			}
		}

	const searchDepartments: DataDashboardContactOrganizationSelectorAdapters["searchDepartments"] =
		async ({ pageToken, query, signal }): Promise<OrganizationSelectorSearchResult> => {
			const normalizedQuery = query.trim()
			if (!normalizedQuery) return emptySearchResult

			const result = normalizeContactTokenPage(
				await api.searchDepartments(
					{ pageToken, name: normalizedQuery, sumType: 1 },
					{ signal },
				),
			)

			return {
				items: result.items.map(contactDepartmentToCompatibleNode),
				hasMore: result.hasMore,
				pageToken: result.pageToken,
			}
		}

	return { loadChildren, searchMembers, searchDepartments }
}
