import { makeAutoObservable, runInAction } from "mobx"
import type {
	OrganizationData,
	StructureItemOnCache,
	StructureUserItem,
	StructureItem,
} from "@/types/organization"
import type { ContactState } from "./types"
import type { Friend } from "@/types/contact"
import { fetchPaddingData } from "@/utils/request"
import { groupBy } from "lodash-es"
import userInfoService from "@/opensource/services/userInfo"
import { userStore } from "@/opensource/models/user"
import { ContactApi } from "@/opensource/apis"
import type { CommonResponse, PaginationResponse } from "@/types/request"
import { GroupConversationDetail } from "@/types/chat/conversation"

export interface ContactStoreState extends ContactState {
	getUserSearchAll: (query?: string) => Promise<StructureUserItem[]>
	getUserInfos: (params: {
		user_ids: string[]
		query_type?: 1 | 2
	}) => Promise<StructureUserItem[]>
	getFriends: (params: { page_token?: string }) => Promise<PaginationResponse<Friend>>
	getUserGroups: (params: {
		page_token?: string
	}) => Promise<PaginationResponse<GroupConversationDetail>>
	getUserManual: (params: { user_id: string }) => Promise<CommonResponse<string>>
}

export class ContactStore implements ContactStoreState {
	organizations: Map<string, OrganizationData> = new Map()
	departmentInfos: Map<string, StructureItemOnCache> = new Map()
	userInfos: Map<string, StructureUserItem> = new Map()

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	// 数据设置方法
	setOrganizations(organizations: Map<string, OrganizationData>) {
		this.organizations = organizations
	}

	setDepartmentInfos(departmentInfos: Map<string, StructureItemOnCache>) {
		this.departmentInfos = departmentInfos
	}

	setUserInfos(userInfos: Map<string, StructureUserItem>) {
		this.userInfos = userInfos
	}

	/**
	 * 缓存部门信息
	 */
	cacheDepartmentInfos = (data: StructureItem[], sum_type: 1 | 2) => {
		const map = new Map(this.departmentInfos)
		const { organizations, organizationCode } = userStore.user

		data.forEach((item) => {
			// FIXME: 临时处理: 赋值根部门的name, 后续应该由后端修复
			if (item.department_id === "-1") {
				const organization = organizations.find(
					(i) => i.organization_code === organizationCode,
				)

				if (organization) {
					item.name = organization.organization_name
				}
			}

			map.set(item.department_id, {
				...map.get(item.department_id),
				...item,
				...(sum_type === 1
					? {
							employee_sum_deep: map.get(item.department_id)?.employee_sum_deep ?? 0,
					  }
					: { employee_sum_deep: item.employee_sum }),
			})
		})

		runInAction(() => {
			this.departmentInfos = map
		})
	}

	/**
	 * 缓存组织信息
	 */
	cacheOrganization = (parent_id: string, data: OrganizationData) => {
		const map = new Map(this.organizations)
		map.set(parent_id, data)

		runInAction(() => {
			this.organizations = map
		})
	}

	// 兼容原有 SWR 钩子
	getUserSearchAll = (query = "") => {
		return fetchPaddingData<StructureUserItem>((params) =>
			ContactApi.searchUser({ query, ...params }),
		)
	}

	getUserInfos = async (params: { user_ids: string[]; query_type?: 1 | 2 }) => {
		if (!params.user_ids || params.user_ids.length === 0) return []

		const data = await fetchPaddingData<StructureUserItem>((fetchParams) =>
			ContactApi.getUserInfos({
				...params,
				query_type: params.query_type ?? 2,
				...fetchParams,
			}),
		)

		data.forEach((item) => {
			userInfoService.set(item.user_id, item)
		})

		return data
	}

	getFriends = (params: { page_token?: string } = {}) => {
		return ContactApi.getFriends(params)
	}

	getUserGroups = (params: { page_token?: string } = {}) => {
		return ContactApi.getUserGroups(params)
	}

	// 实际实现 getDepartmentInfos
	getDepartmentInfos = async (
		ids: string[],
		sum_type: 1 | 2 = 2,
		alwaysFetch: boolean = false,
	) => {
		if (!ids || ids.length === 0) return []

		if (alwaysFetch) {
			const promises = ids.map((id) =>
				ContactApi.getDepartmentInfo({
					department_id: id,
				}),
			)
			const data = await Promise.all(promises)
			this.cacheDepartmentInfos(data, sum_type)

			return ids.map((id) => this.departmentInfos.get(id)!)
		}

		const { true: cacheInfos = [], false: notCacheInfos = [] } = groupBy(ids, (id) => {
			const info = this.departmentInfos.get(id)
			if (!info) return false
			return sum_type === 1
				? info.employee_sum !== undefined
				: info.employee_sum_deep !== undefined
		})

		const users = cacheInfos.map((id) => this.departmentInfos.get(id)!)

		if (notCacheInfos.length > 0) {
			const promises = notCacheInfos.map((id) =>
				ContactApi.getDepartmentInfo({
					department_id: id,
				}),
			)

			const data = await Promise.all(promises)
			this.cacheDepartmentInfos(data, sum_type)

			users.push(...notCacheInfos.map((id) => this.departmentInfos.get(id)!))
		}

		return users
	}

	getUserManual = (params: { user_id: string }) => {
		return ContactApi.getUserManual(params)
	}
}

// 创建单例实例
export const contactStore = new ContactStore()

// 导出单例实例
export default contactStore
