import type { StructureItem, StructureUserItem } from "@admin/types/common"
import { NodeType } from "@admin/types/common"
import { fetchPaddingData } from "@admin/utils/request"
import { useApis } from "@admin/apis"
import { useAdmin } from "@admin/provider/AdminProvider"
import { useMemo } from "react"

// Mock 数据
// const mockData = Array.from({ length: 100 }, (_, i) => ({
// 	id: `${i + 1}`,
// 	real_name: `${i + 1}`,
// 	avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 1}`,
// 	email: `zhangsan${i + 1}@example.com`,
// 	department: "技术部",
// 	resign_date: "2024-03-01",
// }))

/**
 * 获取组织用户数据
 */
export const useOrganizationTree = () => {
	const { CommonApi } = useApis()

	const { organization } = useAdmin()

	const { organizationInfo: MagicOrganization } = organization

	const organizationInfo = useMemo(() => {
		return MagicOrganization
			? {
					...MagicOrganization,
					logo: MagicOrganization.organization_logo || "",
					id: MagicOrganization.magic_id,
					name: MagicOrganization.organization_name || "",
				}
			: undefined
	}, [MagicOrganization])

	/**
	 * 获取用户搜索
	 * @param data
	 * @returns
	 */
	const searchUser = async (data: {
		query: string
		page_token?: string
		query_type?: number
	}) => {
		const res = await CommonApi.searchUser({
			query: data.query ?? "",
			page_token: data.page_token,
			query_type: data.query_type ?? 1,
		})
		const items = res.items.map((item) => ({
			...item,
			dataType: NodeType.User,
			id: item.user_id,
			name: item.nickname || item.real_name,
		}))
		return {
			...res,
			items,
		}
	}

	/**
	 * 获取组织树
	 */
	const fetchMagicDepartmentUser = async ({
		department_id = "-1",
		with_member = true,
		sum_type = 2,
	}) => {
		const promises: [Promise<StructureItem[]>, Promise<StructureUserItem[]>] = [
			// 获取部门
			fetchPaddingData((params) =>
				CommonApi.getOrganization({
					department_id,
					sum_type: sum_type as 1 | 2,
					...params,
				}),
			),
			// 获取部门成员
			with_member
				? fetchPaddingData((params) =>
						CommonApi.getOrganizationMembers({
							department_id,
							...params,
						}),
					)
				: Promise.resolve([] as StructureUserItem[]),
		]

		const [departments, users] = await Promise.all(promises)

		return [
			...departments.map((item) => ({
				...item,
				dataType: NodeType.Department,
				id: item.department_id,
			})),
			...users.map((item) => ({
				...item,
				dataType: NodeType.User,
				id: item.user_id,
				name: item.nickname || item.real_name,
			})),
		]
	}

	return {
		fetchMagicDepartmentUser,
		searchUser,
		organizationInfo,
	}
}
