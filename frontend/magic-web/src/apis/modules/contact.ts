import type { Friend, MyOrganization, SquareData } from "@/types/contact"
import { genRequestUrl } from "@/utils/http"
import type { StructureItem, StructureUserItem } from "@/types/organization"
import { SumType } from "@/types/organization"
import type { CommonResponse, PaginationResponse } from "@/types/request"
import type { GroupConversationDetail } from "@/types/chat/conversation"

import type { HttpClient } from "../core/HttpClient"

export const generateContactApi = (fetch: HttpClient) => ({
	/**
	 * 添加好友
	 * @param friend_id
	 * @returns
	 */
	addPropmtFriend(friend_id: string) {
		return fetch.post<{
			success: boolean
		}>(genRequestUrl("/api/v1/contact/friends/${friendId}", { friendId: friend_id }))
	},

	/**
	 * 获取好友列表
	 * @param data
	 * @returns
	 */
	getFriends(data: { page_token?: string }) {
		return fetch.get<PaginationResponse<Friend>>(
			genRequestUrl("/api/v1/contact/friends", {}, { page_token: data.page_token }),
		)
	},

	/**
	 * 获取组织架构
	 * @param data
	 * @param data.department_id 部门 ID，-1 表示根部门
	 * @param data.sum_type 1：返回部门直属用户总数 2：返回本部门 + 所有子部门用户总数
	 * @param data.page_token 分页 token
	 * @returns
	 */
	getOrganization(data: { department_id?: string; sum_type?: 1 | 2; page_token?: string }) {
		return fetch.get<PaginationResponse<StructureItem>>(
			genRequestUrl(
				"/api/v1/contact/departments/${id}/children",
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
	}: {
		department_id: string
		count?: number
		page_token?: string
		is_recursive?: 0 | 1
	}) {
		return fetch.get<PaginationResponse<StructureUserItem>>(
			genRequestUrl(
				"/api/v1/contact/departments/${id}/users",
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
	searchUser(data: {
		query: string
		query_type?: 1 | 2
		page_token?: string
		filter_agent?: boolean
	}) {
		return fetch.get<PaginationResponse<StructureUserItem>>(
			genRequestUrl(
				"/api/v1/contact/users/search",
				{},
				{
					query: data.query,
					query_type: data.query_type,
					page_token: data.page_token,
					filter_agent: data.filter_agent,
				},
			),
		)
	},

	/**
	 * 模糊搜索部门列表
	 * @param data
	 * @returns
	 */
	searchOrganizations(
		data: { name: string; sum_type?: SumType; page_token?: string } = {
			name: "",
			sum_type: SumType.CountDirectDepartment,
		},
	) {
		return fetch.get<PaginationResponse<StructureItem>>(
			genRequestUrl(
				"/api/v1/contact/departments/${id}",
				{},
				{
					name: data.name,
					sum_type: data.sum_type,
					page_token: data.page_token,
				},
			),
		)
	},

	/**
	 * 根据 IDs 获取所有类型用户信息
	 * @param data
	 * @returns
	 */
	getUsersInfo(data: { user_ids: string[]; page_token?: string; query_type?: 1 | 2 }) {
		return fetch.post<PaginationResponse<StructureUserItem>>(
			genRequestUrl("/api/v1/contact/users/queries"),
			data,
			{
				enableRequestUnion: true,
			},
		)
	},

	/**
	 * 根据 IDs 获取所有类型会话信息
	 * @param data
	 * @returns
	 */
	getConversationInfos(data: { group_ids: string[]; page_token?: string }) {
		return fetch.post<PaginationResponse<GroupConversationDetail>>(
			genRequestUrl("/api/v1/contact/groups/queries"),
			data,
		)
	},

	/**
	 * 获取用户群组
	 * @returns
	 */
	getUserGroups(params: { page_token?: string }) {
		return fetch.get<PaginationResponse<GroupConversationDetail & { conversation_id: string }>>(
			genRequestUrl(
				"/api/v1/contact/users/self/groups",
				{},
				{
					page_token: params.page_token,
				},
			),
		)
	},

	/**
	 * 获取部门信息
	 * @param data
	 * @returns
	 */
	getDepartmentInfo(data: { department_id: string }) {
		return fetch.get<StructureItem>(
			genRequestUrl("/api/v1/contact/departments/${id}", { id: data.department_id }),
		)
	},

	/**
	 * 获取用户说明书
	 * @param data
	 * @returns
	 */
	getUserManual(data: { user_id: string }) {
		return fetch.post<CommonResponse<string>>(
			genRequestUrl("/api/v2/magic/contact/user/user-manual"),
			data,
		)
	},

	/**
	 * 获取部门说明书
	 * @param data
	 * @returns
	 */
	getDepartmentDocument(data: { department_id: string }) {
		return fetch.get<CommonResponse<string>>(
			genRequestUrl("/api/v1/departments/${id}/document", { id: data.department_id }),
		)
	},

	/**
	 * @description 获取广场提示词
	 */
	getSquarePrompts() {
		return fetch.get<SquareData>(genRequestUrl("/api/v2/magic/friend/square"))
	},

	/**
	 * @description 获取当前组织(指定组织)下当前用户信息
	 */
	async getAccountUserInfo({ organization_code }: { organization_code?: string } = {}) {
		const data = await fetch.get<PaginationResponse<StructureUserItem>>(
			"/api/v1/contact/accounts/me/users",
			{
				enableRequestUnion: true,
				headers: organization_code
					? {
						"Organization-Code": organization_code,
					}
					: undefined,
			},
		)

		return data?.items?.[0]
	},

	/**
	 * @description User level universal storage save
	 */
	saveUserStorage<T extends object>(data: { key: string; value: T }) {
		return fetch.post<
			CommonResponse<{
				id: string
				key: string
				value: T
			}>
		>(genRequestUrl("/api/v1/contact/users/setting"), data)
	},

	/**
	 * @description User level universal storage retrieval
	 */
	getUserStorage<T extends object>(key: string) {
		return fetch.get<{
			id: string
			key: string
			value: T
		}>(genRequestUrl("/api/v1/contact/users/setting/${key}", { key }))
	},

	/**
	 * @description User level universal storage query
	 */
	queryUserStorage<T extends object>(data: {
		key: Array<string>
		page?: number
		page_size?: number
	}) {
		return fetch.post<
			CommonResponse<{
				page: number
				total: number
				list: Array<{
					id: string
					key: string
					value: T
				}>
			}>
		>(genRequestUrl("/api/v1/contact/users/setting/queries"), data)
	},

	/**
	 * @description 获取我的组织列表
	 * @returns 我的组织列表
	 */
	getMyOrganizations() {
		return fetch.get<{ items: MyOrganization[] }>(
			genRequestUrl("/api/v1/contact/accounts/me/organizations"),
		)
	},
})
