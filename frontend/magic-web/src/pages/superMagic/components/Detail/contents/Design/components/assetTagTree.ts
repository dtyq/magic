import type { AssetTagGroupItem, AssetTagItem, AssetTagTreeNode } from "@/apis"

export interface AssetTagOption extends AssetTagItem {
	groupName: string
}

export interface AssetTagOptionGroup {
	group: AssetTagGroupItem
	options: AssetTagOption[]
}

/**
 * A node is a group when it is marked as one, or when it actually contains child tags.
 * A tag node, a node with no child list, or an empty list that is not a group
 * is a custom tag. The API also returns those roots beside real groups.
 */
export function isAssetTagGroup(node: AssetTagTreeNode): node is AssetTagGroupItem {
	if (node.nodeType === "tag") return false
	if (!("tags" in node) || !Array.isArray(node.tags)) return false
	if (node.nodeType === "group") return true
	return node.tags.length > 0
}

/**
 * `null`, `""`, and `"0"` are the stored forms of "no group".
 * `undefined` is omitted data: a tag already nested under a group keeps that group.
 */
export function isExplicitlyUngroupedParent(parentId: string | null | undefined): boolean {
	return parentId === null || parentId === "" || parentId === "0"
}

/** Groups keep API order. Tags with no group are collected for the custom section. */
export function partitionAssetTagOptions(nodes: AssetTagTreeNode[]): {
	groupedOptions: AssetTagOptionGroup[]
	customOptions: AssetTagOption[]
} {
	const groupedOptions: AssetTagOptionGroup[] = []
	const customOptions: AssetTagOption[] = []
	const seenCustomIds = new Set<string>()

	const pushCustom = (tag: AssetTagItem) => {
		if (seenCustomIds.has(tag.id)) return
		seenCustomIds.add(tag.id)
		customOptions.push({ ...tag, groupName: "" })
	}

	for (const node of nodes) {
		if (!isAssetTagGroup(node)) {
			pushCustom(node)
			continue
		}

		const options: AssetTagOption[] = []
		for (const tag of node.tags) {
			if (isExplicitlyUngroupedParent(tag.parentId)) {
				pushCustom(tag)
				continue
			}
			options.push({ ...tag, groupName: node.name })
		}
		if (options.length > 0) groupedOptions.push({ group: node, options })
	}

	return { groupedOptions, customOptions }
}
