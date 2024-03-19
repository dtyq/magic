import type { Department, TreeNode, UserGroup } from "./components/UserSelector/types"
import { NodeType } from "./components/UserSelector/types"

/**
 * 判断是否是部门
 * @param node 节点数据
 * @returns 是否是部门
 */
export function isDepartment(node: TreeNode): node is Department {
	return node.dataType === NodeType.Department
}

/**
 * 判断是否是部门
 * @param node 节点数据
 * @returns 是否是部门
 */
export function isUserGroup(node: TreeNode): node is UserGroup {
	return node.dataType === NodeType.UserGroup
}

/**
 * 判断是否是用户
 * @param node 节点数据
 * @returns 是否是用户
 */
export function isMember(node: TreeNode) {
	return node.dataType !== NodeType.Department && node.dataType !== NodeType.UserGroup
}
