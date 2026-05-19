import { makeAutoObservable } from "mobx"
import { FlowApi } from "@/apis"
import type { UseableToolSet } from "@/types/flow"
import { MentionItemType, type MentionItem, type ToolMentionData } from "../../../../types"
import { MentionPanelBuiltinItemId } from "../../catalog-ids"

export class MentionPanelToolsStore {
	toolItems: UseableToolSet.Item[] = []

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	setItems(list: UseableToolSet.Item[]) {
		this.toolItems = list
	}

	fetchItems() {
		return FlowApi.getUseableToolList({ with_builtin: false }).then((res) => {
			this.toolItems = res.list
		})
	}

	getItems(collectionId: string) {
		if (collectionId === MentionPanelBuiltinItemId.TOOLS) {
			return this.toolItems.map((item) => ({
				id: item.id,
				type: MentionItemType.TOOL,
				name: item.name,
				icon: item.icon,
				hasChildren: (item.tools?.length || 0) > 0,
				isFolder: true,
			})) as MentionItem[]
		}

		const target = this.toolItems.find((item) => item.id === collectionId)
		if (!target) return []

		return (target.tools?.map((item) => ({
			id: item.code,
			type: MentionItemType.TOOL,
			name: `${target.name}:${item.name}`,
			hasChildren: false,
			isFolder: false,
			data: {
				id: item.code,
				name: `${target.name}:${item.name}`,
				description: item.description,
			} as ToolMentionData,
		})) ?? []) as MentionItem[]
	}

	searchItems(normalizedQuery: string, matchesQuery: (target: string, query: string) => boolean) {
		return this.toolItems
			.map((item) => item.tools ?? [])
			.flat()
			.filter((item) => matchesQuery(item.name, normalizedQuery))
			.map((item) => ({
				id: item.code,
				type: MentionItemType.TOOL,
				name: item.name,
				hasChildren: false,
				isFolder: false,
				data: {
					id: item.code,
					name: item.name,
					description: item.description,
				} as ToolMentionData,
			})) as MentionItem[]
	}

	hasItem(toolId: string) {
		return this.toolItems.some((item) => item.tools?.some((tool) => tool.code === toolId))
	}
}
