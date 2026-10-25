import { makeAutoObservable } from "mobx"
import { CrewApi } from "@/apis"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { MentionItemType, type MentionItem, type SkillMentionData } from "../../../../types"
import { includesSearchQuery } from "../../store-helpers/matching"
import type { SkillDomainItem, SkillQueryContextOptions } from "./types"

const DEFAULT_SKILL_QUERY_KEY = "__default__"

function getSkillQueryKey(topicMode?: string, agentCode?: string) {
	const normalized = topicMode?.trim()
	if (normalized === TopicMode.CustomAgent) {
		const code = agentCode?.trim()
		return code || DEFAULT_SKILL_QUERY_KEY
	}

	// Only a custom-agent topic carries an employee code. Other topic modes
	// (general, chat, data analysis, etc.) must use the default skill list.
	return DEFAULT_SKILL_QUERY_KEY
}

function mapSkillToMention(item: SkillDomainItem): MentionItem {
	const skillId = item.code || item.id

	return {
		id: skillId,
		type: MentionItemType.SKILL,
		name: item.name,
		icon: item.logo || undefined,
		description: item.description,
		package_name: item.package_name,
		hasChildren: false,
		isFolder: false,
		data: {
			id: skillId,
			name: item.name,
			icon: item.logo || "",
			description: item.description,
			mention_source: item.mention_source,
			package_name: item.package_name || "",
		} as SkillMentionData,
	}
}

export class MentionPanelSkillsStore {
	items: MentionItem[] = []
	currentSkillQueryKey = DEFAULT_SKILL_QUERY_KEY

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	setQueryContext(options: SkillQueryContextOptions) {
		const nextSkillQueryKey = getSkillQueryKey(options.topicMode, options.agentCode)
		if (this.currentSkillQueryKey === nextSkillQueryKey) return

		this.currentSkillQueryKey = nextSkillQueryKey
		this.items = []
	}

	setItems(list: SkillDomainItem[], requestKey = this.currentSkillQueryKey) {
		const nextSkillList = list.map(mapSkillToMention)
		if (requestKey !== this.currentSkillQueryKey) return nextSkillList

		this.items = nextSkillList
		return nextSkillList
	}

	private getSkillAgentCode(skillQueryKey: string) {
		if (skillQueryKey === DEFAULT_SKILL_QUERY_KEY) return undefined
		return skillQueryKey
	}

	fetchItems(options?: { skillQueryKey?: string }): Promise<MentionItem[]> {
		const requestKey = options?.skillQueryKey ?? this.currentSkillQueryKey
		const agentCode = this.getSkillAgentCode(requestKey)

		return CrewApi.getMentionSkills(agentCode ? { agent_code: agentCode } : {}).then((data) =>
			this.setItems(data, requestKey),
		)
	}

	async getItems() {
		await this.fetchItems().catch(() => {
			this.items = []
		})
		return this.items
	}

	refreshItems() {
		return this.getItems()
	}

	private filterItems(
		items: MentionItem[],
		normalizedQuery: string,
		matchesQuery: (target: string, query: string) => boolean,
	) {
		return items.filter((item) => {
			if (matchesQuery(item.name, normalizedQuery)) return true
			if (item.package_name && matchesQuery(item.package_name, normalizedQuery)) return true
			if (item.description && includesSearchQuery(item.description, normalizedQuery))
				return true
			return false
		})
	}

	private filterDirectMatches(
		items: MentionItem[],
		normalizedQuery: string,
		matchesQuery: (target: string, query: string) => boolean,
	) {
		return items.filter(
			(item) =>
				matchesQuery(item.name, normalizedQuery) ||
				Boolean(item.package_name && matchesQuery(item.package_name, normalizedQuery)),
		)
	}

	async searchItems(
		normalizedQuery: string,
		matchesQuery: (target: string, query: string) => boolean,
	) {
		const items =
			this.items.length > 0
				? this.items
				: await this.fetchItems({ skillQueryKey: this.currentSkillQueryKey })

		const directMatches = this.filterDirectMatches(items, normalizedQuery, matchesQuery)
		return directMatches.length > 0
			? directMatches
			: this.filterItems(items, normalizedQuery, matchesQuery)
	}

	hasItem(skillId: string) {
		return this.items.some((item) => item.id === skillId)
	}
}
