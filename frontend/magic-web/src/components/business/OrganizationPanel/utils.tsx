import type { WithIdAndDataType, StructureUserItem } from "@/types/organization"
import { StructureItemType } from "@/types/organization"
import type { DepartmentSelectItem, GroupSelectItem, OrganizationSelectItem } from "./originTypes"

/**
 * 判断是否是部门
 * @param node 节点数据
 * @returns 是否是部门
 */
export function isDepartment(node: OrganizationSelectItem): node is DepartmentSelectItem {
	return node.dataType === StructureItemType.Department
}

/**
 * 判断是否是成员
 * @param node 节点数据
 * @returns 是否是成员
 */
export function isMember(
	node: OrganizationSelectItem,
): node is WithIdAndDataType<StructureUserItem, StructureItemType.User> {
	return node.dataType === StructureItemType.User
}

export function isGroup(node: OrganizationSelectItem): node is GroupSelectItem {
	return node.dataType === StructureItemType.Group
}

// export function isPartner(
// 	node: OrganizationSelectItem,
// ): node is WithIdAndDataType<{}, StructureItemType.Partner> {
// 	return node.dataType === StructureItemType.Partner
// }

/**
 * 将组织架构数据扁平化
 * @param data 组织架构数据
 * @param map 存储扁平化数据的map
 * @returns 扁平化的组织架构数据
 */
// export function flattenTree(
// 	data:
// 		| WithIdAndType<StructureItem, StructureItemType.Department>
// 		| WithIdAndType<StructureUserItem, StructureItemType.User>
// 		| (
// 				| WithIdAndType<StructureItem, StructureItemType.Department>
// 				| WithIdAndType<StructureUserItem, StructureItemType.User>
// 		  )[]
// 		| undefined,
// 	map?: Map<string, StructureItem | StructureUserItem>,
// ) {
// 	const result: Map<string, StructureItem | StructureUserItem> = map ?? new Map()

// 	if (!data) return result

// 	const arraify = Array.isArray(data) ? data : [data]

// 	arraify.forEach((item) => {
// 		if (isMember(item)) {
// 			result.set((item as StructureUserItem).user_id, item)
// 		} else {
// 			const department = item as StructureItem
// 			result.set(department.department_id, item)
// 			const list = [...department.children]
// 			if (list.length > 0) {
// 				flattenTree(list, result)
// 			}
// 		}
// 	})
// 	return result
// }

/**
 * 获取部门成员总数
 * @param data 部门成员树
 * @returns 部门成员总数
 */
// export function getDepartmentMemberCount(data: (StructureItem | StructureUserItem)[]) {
// 	let count = 0
// 	data.forEach((item) => {
// 		if (isMember(item)) {
// 			count += 1
// 		} else {
// 			count += getDepartmentMemberCount((item as StructureItem).children || [])
// 		}
// 	})
// 	return count
// }

/**
 * 获取当前渲染的列表数据
 * @param selected 当前选中的节点ID列表
 * @param data 组织架构数据
 * @returns 当前渲染的列表数据
 */
// export function getCurrentList(
// 	selected: string[],
// 	data:
// 		| WithIdAndDataType<StructureItem, StructureItemType.Department>
// 		| WithIdAndDataType<StructureUserItem, StructureItemType.User>
// 		| (
// 				| WithIdAndDataType<StructureItem, StructureItemType.Department>
// 				| WithIdAndDataType<StructureUserItem, StructureItemType.User>
// 		  )[],
// 	showMember: boolean,
// ) {
// 	if (!data) return []

// 	let arrify = Array.isArray(data) ? data : [data]

// 	if (!showMember) {
// 		arrify = arrify.filter(isDepartment)
// 	}

// 	if (selected.length === 0 || arrify.length === 0) {
// 		return arrify
// 	}
// 	const current = arrify.find((item) => isDepartment(item) && item.id === selected[0]) as
// 		| StructureItem
// 		| undefined

// 	if (current) {
// 		return getCurrentList(selected.slice(1), [...(current ? current.children : [])], showMember)
// 	}
// 	return arrify
// }
