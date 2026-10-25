import { buildApiUrl } from "@magic-admin-v2/api/api-url"
import { RequestUrl } from "@magic-admin-v2/api/constants"
import type { HttpClient, RequestOptions } from "@magic-admin-v2/api/types"
import type {
	DataDashboardContactDepartment,
	DataDashboardContactDepartmentChildrenParams,
	DataDashboardContactDepartmentSearchParams,
	DataDashboardContactDepartmentUsersParams,
	DataDashboardContactPage,
	DataDashboardContactUser,
	DataDashboardContactUserSearchParams,
} from "./types"

export function createDataDashboardContactApi(client: HttpClient) {
	return {
		getDepartmentChildren(
			{
				departmentId = "-1",
				pageToken,
				sumType = 2,
			}: DataDashboardContactDepartmentChildrenParams = {},
			options?: RequestOptions,
		) {
			return client.get<DataDashboardContactPage<DataDashboardContactDepartment>>(
				buildApiUrl(
					RequestUrl.dataDashboardContactDepartmentChildren,
					{ id: departmentId || "-1" },
					{ page_token: pageToken, sum_type: sumType },
				),
				options,
			)
		},

		getDepartmentUsers(
			{
				departmentId = "-1",
				pageToken = "",
				recursive = 0,
			}: DataDashboardContactDepartmentUsersParams = {},
			options?: RequestOptions,
		) {
			return client.get<DataDashboardContactPage<DataDashboardContactUser>>(
				buildApiUrl(
					RequestUrl.dataDashboardContactDepartmentUsers,
					{ id: departmentId || "-1" },
					{ page_token: pageToken, recursive },
				),
				options,
			)
		},

		searchUsers(
			{
				pageToken,
				query,
				queryType = 1,
				filterAgent = 0,
			}: DataDashboardContactUserSearchParams,
			options?: RequestOptions,
		) {
			return client.get<DataDashboardContactPage<DataDashboardContactUser>>(
				buildApiUrl(RequestUrl.dataDashboardContactUserSearch, undefined, {
					page_token: pageToken,
					query,
					query_type: queryType,
					filter_agent: filterAgent,
				}),
				options,
			)
		},

		searchDepartments(
			{ pageToken, name, sumType = 1 }: DataDashboardContactDepartmentSearchParams,
			options?: RequestOptions,
		) {
			return client.get<DataDashboardContactPage<DataDashboardContactDepartment>>(
				buildApiUrl(RequestUrl.dataDashboardContactDepartmentSearch, undefined, {
					page_token: pageToken,
					name,
					sum_type: sumType,
				}),
				options,
			)
		},
	}
}

export type DataDashboardContactApi = ReturnType<typeof createDataDashboardContactApi>
