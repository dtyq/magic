import { makeAutoObservable } from "mobx"
import { FlowApi } from "@/apis"
import { MentionItemType, type McpMentionData, type MentionItem } from "../../../../types"
import type { McpDomainItem } from "./types"
import { getMCPAccess } from "@/components/Agent/MCP/store/mcp-access"

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
	private readonly addedMCPAccess = getMCPAccess({ storageKey: "__added__" })

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	setItems(list: McpDomainItem[]) {
		this.items = list.map(mapMcpToMention)
	}

	async fetchItems() {
		// The global MCP preload may already have loaded this shared store (the
		// input toolbar uses the same __added__ storage). Reuse that result so
		// opening the mention catalog does not issue a duplicate request.
		if (this.addedMCPAccess.initialized) {
			this.items = this.addedMCPAccess.mcpList.map(mapMcpToMention)
			return
		}

		// Keep lightweight test/custom runtimes that do not expose project MCP
		// storage compatible with the existing preloaded data.
		if (typeof FlowApi.getMCPFromProject !== "function") return

		await this.addedMCPAccess.load()
		this.items = this.addedMCPAccess.mcpList.map(mapMcpToMention)
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
