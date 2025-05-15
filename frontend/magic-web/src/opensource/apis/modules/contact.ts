import type { Friend, SquareData } from "@/types/contact"
import { genRequestUrl } from "@/utils/http"
import type { StructureItem, StructureUserItem } from "@/types/organization"
import { SumType } from "@/types/organization"
import type { CommonResponse, PaginationResponse } from "@/types/request"
import type { GroupConversationDetail } from "@/types/chat/conversation"
import { RequestUrl } from "../constant"
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
		}>(genRequestUrl(RequestUrl.addPropmtFriend, { friendId: friend_id }))
	},

	/**
	 * 获取好友列表
	 * @param data
	 * @returns
	 */
	getFriends(data: { page_token?: string }) {
		return fetch.get<PaginationResponse<Friend>>(
			genRequestUrl(RequestUrl.getFriends, {}, { page_token: data.page_token }),
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
	}: {
		department_id: string
		count?: number
		page_token?: string
		is_recursive?: 0 | 1
	}) {
		return fetch.get<PaginationResponse<StructureUserItem>>(
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
	searchUser(data: { query: string; query_type?: 1 | 2; page_token?: string }) {
		return fetch.get<PaginationResponse<StructureUserItem>>(
			genRequestUrl(
				RequestUrl.searchUser,
				{},
				{
					query: data.query,
					query_type: data.query_type,
					page_token: data.page_token,
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
				RequestUrl.getDepartmentInfo,
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
	 * @param init
	 * @returns
	 */
	getUserInfos(
		data: { user_ids: string[]; page_token?: string; query_type?: 1 | 2 },
		init?: RequestInit,
	) {
		return fetch.post<PaginationResponse<StructureUserItem>>(
			genRequestUrl(RequestUrl.getUserInfoByIds),
			data,
			{
				...init,
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
			genRequestUrl(RequestUrl.getGroupConversationDetail),
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
				RequestUrl.getUserGroups,
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
			genRequestUrl(RequestUrl.getDepartmentInfo, { id: data.department_id }),
		)
	},

	/**
	 * 获取用户说明书
	 * @param data
	 * @returns
	 */
	getUserManual(data: { user_id: string }) {
		return fetch.post<CommonResponse<string>>(genRequestUrl(RequestUrl.getUserManual), data)
	},

	/**
	 * 获取部门说明书
	 * @param data
	 * @returns
	 */
	getDepartmentDocument(data: { department_id: string }) {
		return fetch.get<CommonResponse<string>>(
			genRequestUrl(RequestUrl.getDepartmentDocument, { id: data.department_id }),
		)
	},

	/**
	 * @description 获取广场提示词
	 */
	getSquarePrompts() {
		return fetch.get<SquareData>(genRequestUrl(RequestUrl.getSquarePrompts))
	},
})
