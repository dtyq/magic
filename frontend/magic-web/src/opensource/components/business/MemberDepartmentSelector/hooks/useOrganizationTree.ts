import { ContactApi } from "@/apis"
import { useOrganization } from "@/opensource/models/user/hooks"
import userInfoService from "@/opensource/services/userInfo"
import {
	StructureItem,
	StructureUserItem,
	StructureItemType,
	WithIdAndDataType,
} from "@/types/organization"
import { fetchPaddingData } from "@/utils/request"
import { useRequest } from "ahooks"

function useOrganizationTree(
	department_id: string,
	with_member: boolean = false,
	sum_type: 1 | 2 = 2,
) {
	const { organizationCode } = useOrganization()

	const { data, loading, mutate } = useRequest(
		async () => {
			if (!organizationCode) {
				return {
					departments: [],
					users: [],
				}
			}

			const promises: [Promise<StructureItem[]>, Promise<StructureUserItem[]>] = [
				// 获取部门
				fetchPaddingData((params) =>
					ContactApi.getOrganization({
						department_id: department_id,
						sum_type: sum_type,
						...params,
					}),
				),
				// 获取部门成员
				with_member
					? fetchPaddingData((params) =>
							ContactApi.getOrganizationMembers({
								department_id: department_id,
								...params,
							}),
					  )
					: Promise.resolve([] as StructureUserItem[]),
			]

			const [departments, users] = await Promise.all(promises)

			// 缓存用户信息
			users.forEach((item) => {
				userInfoService.set(item.user_id, item)
			})

			return {
				departments: departments.map((item) => ({
					...item,
					dataType: StructureItemType.Department,
					id: item.department_id,
				})) as WithIdAndDataType<StructureItem, StructureItemType.Department>[],
				users: users.map((item) => ({
					...item,
					dataType: StructureItemType.User,
					id: item.user_id,
				})) as WithIdAndDataType<StructureUserItem, StructureItemType.User>[],
			}
		},
		{
			refreshDeps: [organizationCode, department_id, with_member, sum_type],
			retryCount: 2,
		},
	)

	return {
		data,
		isLoading: loading,
		mutate,
	}
}

export default useOrganizationTree
