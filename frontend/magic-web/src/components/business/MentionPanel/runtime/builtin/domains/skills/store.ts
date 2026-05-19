import { makeAutoObservable } from "mobx"
import { CrewApi } from "@/apis"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { MentionItemType, type MentionItem, type SkillMentionData } from "../../../../types"
import type { SkillDomainItem, SkillQueryContextOptions } from "./types"

const DEFAULT_SKILL_QUERY_KEY = "__default__"

function getSkillQueryKey(topicMode?: string, agentCode?: string) {
	const normalized = topicMode?.trim()
	if (!normalized || normalized === "default") return DEFAULT_SKILL_QUERY_KEY
	if (normalized === TopicMode.CustomAgent) {
		const code = agentCode?.trim()
		return code || DEFAULT_SKILL_QUERY_KEY
	}
	return normalized
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

	searchItems(normalizedQuery: string, matchesQuery: (target: string, query: string) => boolean) {
		return this.fetchItems({ skillQueryKey: this.currentSkillQueryKey }).then((items) =>
			items.filter((item) => {
				if (matchesQuery(item.name, normalizedQuery)) return true
				if (item.package_name && matchesQuery(item.package_name, normalizedQuery))
					return true
				if (!item.description) return false

				return item.description.toLowerCase().includes(normalizedQuery)
			}),
		)
	}

	hasItem(skillId: string) {
		return this.items.some((item) => item.id === skillId)
	}
}
