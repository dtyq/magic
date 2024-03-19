import type {
	StructureUserItem,
	WithPageToken,
	SearchUserParams,
	StructureItem,
	GetOrganizationMembersParams,
	GetOrganizationParams,
} from "@/types/common"
import { genRequestUrl } from "../utils"
import { RequestUrl } from "../constant"
import type { HttpClient } from "../core/HttpClient"

export const generateCommonApi = (client: HttpClient) => {
	return {
		/**
		 * 获取组织架构
		 * @param data
		 * @param data.department_id 部门 ID，-1 表示根部门
		 * @param data.sum_type 1：返回部门直属用户总数 2：返回本部门 + 所有子部门用户总数
		 * @param data.page_token 分页 token
		 * @returns
		 */
		getOrganization(data: GetOrganizationParams) {
			return client.get<WithPageToken<StructureItem>>(
				genRequestUrl(
					RequestUrl.getOrganization,
					{ id: data.department_id ?? -1 },
					{
						sum_type: data.sum_type,
						page_token: data.page_token,
					},
				),
			)
		},

		/**
		 * 获取组织架构成员
		 * @param data
		 * @returns
		 */
		getOrganizationMembers({
			department_id,
			count = 50,
			page_token = "",
			is_recursive = 0,
		}: GetOrganizationMembersParams) {
			return client.get<WithPageToken<StructureUserItem>>(
				genRequestUrl(
					RequestUrl.getDepartmentUsers,
					{ id: department_id ?? "-1" },
					{
						count,
						page_token,
						is_recursive,
					},
				),
			)
		},

		/**
		 * 搜索用户
		 * @param data
		 * @returns
		 */
		searchUser(data: SearchUserParams) {
			return client.get<WithPageToken<StructureUserItem>>(
				genRequestUrl(RequestUrl.searchUser, {}, { ...data }),
			)
		},
	}
}
