import { makeAutoObservable } from "mobx"
import { FlowApi } from "@/apis"
import { MentionItemType, type McpMentionData, type MentionItem } from "../../../../types"
import type { McpDomainItem } from "./types"

function mapMcpToMention(item: McpDomainItem): MentionItem {
	return {
		id: item.id,
		type: MentionItemType.MCP,
		name: item.name,
		icon: item.icon,
		hasChildren: false,
		isFolder: false,
		data: {
			id: item.id,
			name: item.name,
			icon: item.icon || "",
			description: item.description,
			require_fields: item.require_fields as McpMentionData["require_fields"],
			check_require_fields:
				item.check_require_fields as McpMentionData["check_require_fields"],
			check_auth: item.check_auth,
		},
	}
}

export class MentionPanelMcpStore {
	items: MentionItem[] = []

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	setItems(list: McpDomainItem[]) {
		this.items = list.map(mapMcpToMention)
	}

	fetchItems() {
		return FlowApi.getAvailableMCP([]).then((res) => {
			this.items = res.list.map(mapMcpToMention)
		})
	}

	getItems() {
		return this.items
	}

	searchItems(normalizedQuery: string, matchesQuery: (target: string, query: string) => boolean) {
		return this.items.filter((item) => matchesQuery(item.name, normalizedQuery))
	}

	hasItem(mcpId: string) {
		return this.items.some((item) => item.id === mcpId)
	}
}
