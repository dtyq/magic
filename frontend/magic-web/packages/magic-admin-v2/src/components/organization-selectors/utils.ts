import type {
	OrganizationSelectorLoadChildren,
	OrganizationSelectorNode,
	OrganizationSelectorNodeType,
} from "./types"

export function isNodeSelectable(
	node: OrganizationSelectorNode,
	selectableTypes: OrganizationSelectorNodeType[],
) {
	return selectableTypes.includes(node.type)
}

export function getNodeKey(node: OrganizationSelectorNode) {
	return `${node.type}:${node.id}`
}

export function mergeNodes(
	currentItems: OrganizationSelectorNode[],
	nextItems: OrganizationSelectorNode[],
) {
	const map = new Map(currentItems.map((item) => [getNodeKey(item), item]))
	nextItems.forEach((item) => {
		map.set(getNodeKey(item), item)
	})
	return Array.from(map.values())
}

export function formatSelectorMessage(template: string, values: Record<string, string | number>) {
	return Object.entries(values).reduce(
		(message, [key, value]) => message.split(`{{${key}}}`).join(String(value)),
		template,
	)
}

export function getErrorMessage(error: unknown, fallback: string) {
	if (error instanceof Error) {
		return error.message
	}
	return fallback
}

export async function resolveMembersFromSelection(
	selected: OrganizationSelectorNode[],
	loadChildren: OrganizationSelectorLoadChildren,
	includeMembers: boolean,
) {
	const users = selected.filter((item) => item.type === "user" && !item.disabled)
	const departments = selected.filter((item) => item.type === "department")

	if (!departments.length) {
		return users
	}

	const children = await Promise.all(
		departments.map((department) =>
			fetchDepartmentMembers(department.id, loadChildren, includeMembers),
		),
	)

	return mergeNodes(users, children.flat()).filter(
		(item) => item.type === "user" && !item.disabled,
	)
}

async function fetchDepartmentMembers(
	departmentId: string,
	loadChildren: OrganizationSelectorLoadChildren,
	includeMembers: boolean,
): Promise<OrganizationSelectorNode[]> {
	const children = await loadChildren({
		parentId: departmentId,
		includeMembers,
	})
	const users = children.filter((item) => item.type === "user")
	const departments = children.filter((item) => item.type === "department")
	const nestedUsers = await Promise.all(
		departments.map((department) =>
			fetchDepartmentMembers(department.id, loadChildren, includeMembers),
		),
	)

	return mergeNodes(users, nestedUsers.flat())
}
