import { makeAutoObservable } from "mobx"
import { BotApi } from "@/apis"
import { MentionItemType, type AgentMentionData, type MentionItem } from "../../../../types"
import type { AgentDomainItem } from "./types"

function mapAgentToMention(item: AgentDomainItem): MentionItem {
	return {
		id: item.id,
		type: MentionItemType.AGENT,
		name: item.name,
		icon: item.avatar,
		hasChildren: false,
		isFolder: false,
		createdAt: item.created_at,
		data: {
			agent_id: item.id,
			agent_name: item.name,
			agent_avatar: item.avatar,
			agent_description: item.description,
		} as AgentMentionData,
	}
}

export class MentionPanelAgentsStore {
	items: MentionItem[] = []

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	setItems(list: AgentDomainItem[]) {
		this.items = list.map(mapAgentToMention)
	}

	fetchItems() {
		return BotApi.getUserAllAgentList().then((res) => {
			this.items = res.list.map(mapAgentToMention)
		})
	}

	getItems() {
		return this.items
	}

	searchItems(normalizedQuery: string, matchesQuery: (target: string, query: string) => boolean) {
		return this.items.filter((item) => matchesQuery(item.name, normalizedQuery))
	}

	hasItem(agentId: string) {
		return this.items.some((item) => item.id === agentId)
	}
}
