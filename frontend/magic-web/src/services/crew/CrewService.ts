import i18n from "i18next"
import { CrewApi } from "@/apis"
import { resolveCrewAgentPromptText } from "./agent-prompt"
import {
	buildCrewI18nText,
	type CrewI18nArrayText,
	type CrewI18nText,
	type CrewIconObject,
	type CrewPublisherType,
	type CrewSourceType,
	type GetAgentsParams,
	type GetAgentVersionsParams,
	type GetAgentVersionsResponse,
	type GetPlaybooksParams,
	type GetStoreAgentsParams,
	type CreateAgentParams,
	type PublishAgentParams,
	type PublishAgentPrefillResponse,
	type UpdateAgentInfoParams,
	type UpdateAgentSkillsParams,
	type AddAgentSkillsParams,
	type DeleteAgentSkillsParams,
	type CreatePlaybookParams,
	type CreatePlaybookResponse,
	type UpdatePlaybookParams,
	type StoreCategoryItem,
	type StoreAgentItem,
	type StoreAgentMarketDetailResponse,
	type AgentItem,
	type AgentDetailResponse,
	type PlaybookItem,
	type PlaybookConfig,
	normalizeCrewI18nArrayValue,
} from "@/apis/modules/crew"

// ======================== View Models ========================

export interface CategoryView {
	id: string
	name: string
	logo: string | null
	crewCount: number
}

export interface StoreAgentView {
	id: string
	agentCode: string
	userCode: string | null
	latestVersionCode: string | null
	name: string
	role: string
	description: string
	icon: string | null
	playbooks: CrewPlaybookView[]
	publisherType: string
	publisherName: string | null
	categoryId: string | null
	isAdded: boolean
	allowDelete: boolean
	updatedAt: string
}

export interface MyCrewView {
	id: string
	agentCode: string
	name: string
	role: string
	description: string
	icon: string | null
	playbooks: CrewPlaybookView[]
	sourceType: CrewSourceType
	publisherType: CrewPublisherType | null
	publisherName: string | null
	enabled: boolean
	isStoreOffline: boolean | null
	needUpgrade: boolean
	allowDelete: boolean
	latestVersionCode: string | null
	latestPublishedAt: string | null
	pinnedAt: string | null
	updatedAt: string
}

export interface AgentDetailView {
	id: string
	agentCode: string
	name: string
	role: string
	description: string
	icon: string | null
	prompt: string | null
	enabled: boolean
	sourceType: CrewSourceType
	isStoreOffline: boolean | null
	pinnedAt: string | null
	skills: AgentSkillView[]
	features: PlaybookView[]
}

export interface StoreAgentMarketDetailView {
	id: string
	agentCode: string
	name: string
	role: string
	description: string
	icon: string | null
	versionCode: string
	publishedAt: string | null
	createdAt: string
}

export interface AgentSkillView {
	id: string
	skillId: string
	skillCode: string
	name: string
	description: string
	logo: string | null
	sortOrder: number
}

export interface PlaybookView {
	id: string
	agentId: number
	agentCode: string
	name: string
	description: string | null
	icon: string | null
	themeColor: string | null
	enabled: boolean
	sortOrder: number
	config: PlaybookConfig | null
	createdAt: string
	updatedAt: string
}

export interface CrewPlaybookView {
	name: string
	icon: string | null
	themeColor: string | null
}

export interface PagedResult<T> {
	list: T[]
	page: number
	pageSize: number
	total: number
}

// ======================== Service ========================

export class CrewService {
	// ─── Categories ─────────────────────────────────────────────────────────

	async getStoreCategories(): Promise<CategoryView[]> {
		const data = await CrewApi.getStoreAgentCategories()
		return data.list.map((item) => this.mapCategory(item))
	}

	// ─── Store Agents ────────────────────────────────────────────────────────

	async getStoreAgents(params: GetStoreAgentsParams = {}): Promise<PagedResult<StoreAgentView>> {
		const data = await CrewApi.getStoreAgents(params)
		return {
			list: data.list.map((item) => this.mapStoreAgent(item)),
			page: data.page,
			pageSize: data.page_size,
			total: data.total,
		}
	}

	hireAgent(code: string) {
		return CrewApi.hireStoreAgent({ code })
	}

	async getStoreAgentMarketDetail(code: string): Promise<StoreAgentMarketDetailView> {
		const data = await CrewApi.getStoreAgentMarketDetail({ code })
		return this.mapStoreAgentMarketDetail(data)
	}

	// ─── User Agents ─────────────────────────────────────────────────────────

	async getCreatedAgents(params: GetAgentsParams = {}): Promise<PagedResult<MyCrewView>> {
		const data = await CrewApi.getAgents(params)
		return {
			list: data.list.map((item) => this.mapMyAgent(item)),
			page: data.page,
			pageSize: data.page_size,
			total: data.total,
		}
	}

	async getExternalAgents(params: GetAgentsParams = {}): Promise<PagedResult<MyCrewView>> {
		const data = await CrewApi.getExternalAgents(params)
		return {
			list: data.list.map((item) => this.mapMyAgent(item)),
			page: data.page,
			pageSize: data.page_size,
			total: data.total,
		}
	}

	/**
	 * Create an agent with default params (untitled name).
	 * Used when user clicks "Create Crew" before navigating to edit page.
	 */
	async createDefaultAgent(): Promise<{ id: string; code: string }> {
		// const defaultName = i18n.t("crew/create:untitledCrew")
		return this.createAgent({
			name_i18n: buildCrewI18nText(""),
		})
	}

	/**
	 * Create an agent and resolve its generated code.
	 * The create API only returns an id, so we fetch the agent list to get the code.
	 */
	async createAgent(params: CreateAgentParams): Promise<{ id: string; code: string }> {
		const data = await CrewApi.createAgent(params)
		return { id: data.id, code: data.code }
	}

	async getAgentDetail(code: string): Promise<AgentDetailView> {
		const data = await CrewApi.getAgentDetail({ code })
		return this.mapAgentDetail(data)
	}

	/** Returns raw API response for store hydration (preserves i18n structure). */
	async getAgentDetailRaw(code: string): Promise<AgentDetailResponse> {
		return CrewApi.getAgentDetail({ code })
	}

	updateAgentInfo(code: string, params: UpdateAgentInfoParams) {
		return CrewApi.updateAgentInfo({ code, ...params })
	}

	deleteAgent(code: string) {
		return CrewApi.deleteAgent({ code })
	}

	upgradeAgent(code: string) {
		return CrewApi.upgradeAgent({ code })
	}

	publishAgent(code: string, params: PublishAgentParams) {
		return CrewApi.publishAgent({ code, ...params })
	}

	getAgentPublishPrefill(code: string): Promise<PublishAgentPrefillResponse> {
		return CrewApi.getAgentPublishPrefill({ code })
	}

	getAgentVersions(
		code: string,
		params: GetAgentVersionsParams = {},
	): Promise<GetAgentVersionsResponse> {
		return CrewApi.getAgentVersions({ code, ...params })
	}

	offlineAgent(code: string) {
		return CrewApi.offlineAgent({ code })
	}

	// ─── Agent Skills ─────────────────────────────────────────────────────────

	/** Full replace: delete all existing bindings and recreate from skill_codes list. */
	updateAgentSkills(code: string, params: UpdateAgentSkillsParams) {
		return CrewApi.updateAgentSkills({ code, ...params })
	}

	/** Incremental add: bind one or more skills without touching existing bindings. */
	addAgentSkills(code: string, params: AddAgentSkillsParams) {
		return CrewApi.addAgentSkills({ code, ...params })
	}

	/** Incremental remove: soft-delete bindings for the given skill codes. */
	deleteAgentSkills(code: string, params: DeleteAgentSkillsParams) {
		return CrewApi.deleteAgentSkills({ code, ...params })
	}

	// ─── Playbooks ────────────────────────────────────────────────────────────

	async getPlaybooks(code: string, params: GetPlaybooksParams = {}): Promise<PlaybookView[]> {
		const data = await CrewApi.getAgentPlaybooks({ code, ...params })
		return data.map((item) => this.mapPlaybook(item))
	}

	async createPlaybook(code: string, params: CreatePlaybookParams): Promise<string> {
		const data: CreatePlaybookResponse = await CrewApi.createAgentPlaybook({ code, ...params })
		return data.id
	}

	updatePlaybook(code: string, playbookId: string, params: UpdatePlaybookParams) {
		return CrewApi.updateAgentPlaybook({ code, playbookId, ...params })
	}

	deletePlaybook(code: string, playbookId: string) {
		return CrewApi.deleteAgentPlaybook({ code, playbookId })
	}

	togglePlaybookEnabled(code: string, playbookId: string, enabled: boolean) {
		return CrewApi.toggleAgentPlaybookEnabled({ code, playbookId, enabled })
	}

	reorderPlaybooks(code: string, ids: string[]) {
		return CrewApi.reorderAgentPlaybooks({ code, ids })
	}

	// ─── Mappers ──────────────────────────────────────────────────────────────

	private mapCategory(item: StoreCategoryItem): CategoryView {
		return {
			id: String(item.id),
			name: this.mapI18nText(item.name_i18n),
			logo: item.logo,
			crewCount: item.crew_count,
		}
	}

	private resolveIconUrl(icon: CrewIconObject | null | undefined): string | null {
		if (!icon) return null
		return icon.url ?? icon.value ?? null
	}

	private mapStoreAgent(item: StoreAgentItem): StoreAgentView {
		const iconUrl = this.resolveIconUrl(item.icon)
		const featureRows = item.features ?? item.playbooks ?? []
		return {
			id: String(item.id),
			agentCode: item.agent_code,
			userCode: item.user_code ?? null,
			latestVersionCode: item.latest_version_code,
			name: this.mapI18nText(item.name_i18n),
			role: this.mapI18nArrayText(item.role_i18n),
			description: this.mapI18nText(item.description_i18n),
			icon: iconUrl,
			playbooks: featureRows.map((f) => ({
				name: this.mapI18nText(f.name_i18n),
				icon: f.icon,
				themeColor: f.theme_color,
			})),
			publisherType: item.publisher_type,
			publisherName: item.publisher?.name?.trim() || null,
			categoryId: item.category_id,
			isAdded: item.is_added,
			allowDelete: item.allow_delete,
			updatedAt: item.updated_at,
		}
	}

	private mapStoreAgentMarketDetail(
		item: StoreAgentMarketDetailResponse,
	): StoreAgentMarketDetailView {
		const localizedRole = item.role_i18n
			? this.mapI18nArrayText(item.role_i18n)
			: normalizeCrewI18nArrayValue(item.role)
		const localizedDescription = item.description_i18n
			? this.mapI18nText(item.description_i18n)
			: item.description
		return {
			id: String(item.id),
			agentCode: item.agent_code,
			name: this.mapI18nText(item.name_i18n) || item.name,
			role: localizedRole,
			description: localizedDescription,
			icon: this.resolveIconUrl(item.icon),
			versionCode: item.version_code,
			publishedAt: item.published_at,
			createdAt: item.created_at,
		}
	}

	private mapMyAgent(item: AgentItem): MyCrewView {
		const iconUrl = this.resolveIconUrl(item.icon)
		return {
			id: String(item.id),
			agentCode: item.code,
			name: this.mapI18nText(item.name_i18n),
			role: this.mapI18nArrayText(item.role_i18n),
			description: this.mapI18nText(item.description_i18n),
			icon: iconUrl,
			playbooks: item?.playbooks?.map((f) => ({
				name: this.mapI18nText(f.name_i18n),
				icon: f.icon,
				themeColor: f.theme_color,
			})),
			sourceType: this.normalizeSourceType(item.source_type),
			publisherType: item.publisher_type ?? null,
			publisherName: item.publisher?.name?.trim() || null,
			enabled: item.enabled,
			isStoreOffline: item.is_store_offline,
			needUpgrade: item.need_upgrade,
			allowDelete: item.allow_delete,
			latestVersionCode: item.latest_version_code,
			latestPublishedAt: item.latest_published_at,
			pinnedAt: item.pinned_at,
			updatedAt: item.updated_at,
		}
	}

	private mapAgentDetail(item: AgentDetailResponse): AgentDetailView {
		const iconUrl = this.resolveIconUrl(item.icon)
		const skills = item.skills ?? []
		const features = item.features ?? []
		return {
			id: String(item.id),
			agentCode: item.agent_code,
			name: this.mapI18nText(item.name_i18n),
			role: this.mapI18nArrayText(item.role_i18n),
			description: this.mapI18nText(item.description_i18n),
			icon: iconUrl,
			prompt: resolveCrewAgentPromptText(item.prompt),
			enabled: item.enabled,
			sourceType: this.normalizeSourceType(item.source_type),
			isStoreOffline: item.is_store_offline,
			pinnedAt: item.pinned_at,
			skills: skills.map((s) => ({
				id: String(s.id),
				skillId: String(s.skill_id),
				skillCode: s.skill_code,
				name: this.mapI18nText(s.name_i18n),
				description: this.mapI18nText(s.description_i18n),
				logo: s.logo,
				sortOrder: s.sort_order,
			})),
			features: features.map((p) => this.mapPlaybook(p)),
		}
	}

	private mapPlaybook(item: PlaybookItem): PlaybookView {
		return {
			id: item.id,
			agentId: item.agent_id,
			agentCode: item.agent_code,
			name: this.mapI18nText(item.name_i18n),
			description: item.description_i18n ? this.mapI18nText(item.description_i18n) : null,
			icon: item.icon,
			themeColor: item.theme_color,
			enabled: item.enabled,
			sortOrder: item.sort_order,
			config: item.config,
			createdAt: item.created_at,
			updatedAt: item.updated_at,
		}
	}

	private normalizeSourceType(sourceType: string | null | undefined): CrewSourceType {
		if (sourceType === "LOCAL_CREATE") return "LOCAL_CREATE"
		return "MARKET"
	}

	private mapI18nText(text: CrewI18nText | null | undefined): string {
		if (!text) return ""
		const language = i18n.language?.toLowerCase() ?? "en"
		const preferredKeys = language.startsWith("zh")
			? ["zh_CN", "zh", "en_US", "en"]
			: ["en_US", "en", "zh_CN", "zh"]

		for (const key of preferredKeys) {
			const value = text[key]
			if (value) return value
		}
		if (text.default) return text.default
		const fallback = Object.values(text).find(Boolean)
		return fallback ?? ""
	}

	private mapI18nArrayText(text: CrewI18nArrayText | null | undefined): string {
		if (!text) return ""
		const language = i18n.language?.toLowerCase() ?? "en"
		const preferredKeys = language.startsWith("zh")
			? ["zh_CN", "zh", "en_US", "en"]
			: ["en_US", "en", "zh_CN", "zh"]

		for (const key of preferredKeys) {
			const value = normalizeCrewI18nArrayValue(text[key])
			if (value) return value
		}

		const defaultValue = normalizeCrewI18nArrayValue(text.default)
		if (defaultValue) return defaultValue

		const fallback = Object.values(text)
			.map((value) => normalizeCrewI18nArrayValue(value))
			.find((value) => value.length > 0)
		return fallback ?? ""
	}
}

export const crewService = new CrewService()
