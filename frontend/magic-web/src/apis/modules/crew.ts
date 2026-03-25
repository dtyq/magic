import type { HttpClient } from "@/apis/core/HttpClient"
import { genRequestUrl } from "@/utils/http"

import {
	FieldPanelConfig,
	GuidePanelConfig,
	DemoPanelConfig,
} from "@/pages/superMagic/components/MainInputContainer/panels"
import type { CrewAgentPrompt } from "@/services/crew/agent-prompt"

// ======================== Shared Types ========================

/** Multi-language text object. Must include "default" when creating; used as fallback. */
export type CrewI18nText = Record<string, string> & { default?: string }

/** Build CrewI18nText with default as primary value (required for API). */
export function buildCrewI18nText(
	value: string,
	localeValues?: Record<string, string>,
): CrewI18nText {
	return { default: value, en_US: value, zh_CN: value, ...localeValues }
}

/** Resolve CrewI18nText to a plain string for the given locale. */
export function resolveCrewI18nText(text: CrewI18nText | null | undefined, locale: string): string {
	if (!text) return ""
	const lang = locale?.toLowerCase() ?? "en"
	const preferredKeys = lang.startsWith("zh")
		? ["zh_CN", "zh", "en_US", "en"]
		: ["en_US", "en", "zh_CN", "zh"]
	for (const key of preferredKeys) {
		const value = text[key]
		if (value) return value
	}
	if (text.default) return text.default
	const fallback = Object.values(text).find(Boolean)
	return (fallback as string) ?? ""
}

/** Normalize mixed role i18n value to a single string. */
export function normalizeCrewI18nArrayValue(value: unknown): string {
	if (typeof value === "string") return value
	if (Array.isArray(value)) {
		const firstValidValue = value.find(
			(item): item is string => typeof item === "string" && item.length > 0,
		)
		return firstValidValue ?? ""
	}
	return ""
}

/** Resolve CrewI18nArrayText to a string for the given locale. */
export function resolveCrewI18nArrayText(
	text: CrewI18nArrayText | null | undefined,
	locale: string,
): string {
	if (!text) return ""
	const lang = locale?.toLowerCase() ?? "en"
	const preferredKeys = lang.startsWith("zh")
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

/** Multi-language array text object (e.g. role tags) */
export type CrewI18nArrayValue = string[] | null | undefined
export type CrewI18nArrayText = Record<string, CrewI18nArrayValue> & {
	default?: CrewI18nArrayValue
}

/** Publisher type for store agents */
export type CrewPublisherType =
	| "USER"
	| "OFFICIAL"
	| "OFFICIAL_BUILTIN"
	| "VERIFIED_CREATOR"
	| "PARTNER"

/** Publisher info for store agents */
export interface CrewPublisher {
	name: string
	avatar: string
}

/** Source type for user agents */
export type CrewSourceType = "LOCAL_CREATE" | "MARKET"

/** Publish status */
export type CrewPublishStatus = "PUBLISHED" | "OFFLINE" | "DRAFT"

/** Icon type: 1=icon, 2=image */
export type CrewIconType = 1 | 2

/** Agent icon object (request: type+value; response: type+url+color) */
export interface CrewIconObject {
	type?: string
	/** Image/icon URL in responses */
	url?: string
	/** Icon value or URL in create/update requests */
	value?: string
	color?: string
}

/** Resolve CrewIconObject to a display URL string. */
export function resolveCrewIconUrl(icon: CrewIconObject | null | undefined): string {
	if (!icon) return ""
	return icon.url ?? icon.value ?? ""
}

/** A single playbook base data (used in list views) */
export interface CrewPlayBookBaseData {
	name_i18n: CrewI18nText
	/** Emoji or icon key */
	icon: string | null
	theme_color: string | null
}

// ======================== Store Agent Categories (API 1) ========================

/** Single store agent category item */
export interface StoreCategoryItem {
	id: number
	name_i18n: CrewI18nText
	/** Logo image URL; null means not set */
	logo: string | null
	sort_order: number
	crew_count: number
}

/** Response for store agent categories list */
export interface GetStoreCategoriesResponse {
	list: StoreCategoryItem[]
}

// ======================== Store Agents (API 2) ========================

/** Query params for getting store agents list */
export interface GetStoreAgentsParams {
	page?: number
	page_size?: number
	keyword?: string
	/** Filter by category ID; omit for all */
	category_id?: string
}

/** Single store agent item */
export interface StoreAgentItem {
	id: string
	agent_code: string
	user_code?: string | null
	name_i18n: CrewI18nText
	role_i18n: CrewI18nArrayText
	description_i18n: CrewI18nText
	/** Agent icon object (url, type, color) */
	icon: CrewIconObject | null
	/** Icon type: 1=icon, 2=image */
	icon_type: CrewIconType
	/** Playbooks/features; API may return `playbooks` instead of `features` */
	features?: CrewPlayBookBaseData[]
	playbooks?: CrewPlayBookBaseData[]
	publisher_type: CrewPublisherType
	publisher?: CrewPublisher | null
	category_id: string | null
	/** Whether the current user has added this agent */
	is_added: boolean
	/** Latest market version code */
	latest_version_code: string | null
	/** Whether the current user can remove this market record */
	allow_delete: boolean
	created_at: string
	updated_at: string
}

/** Response for store agents list */
export interface GetStoreAgentsResponse {
	list: StoreAgentItem[]
	page: number
	page_size: number
	total: number
}

/** Market agent detail response */
export interface StoreAgentMarketDetailResponse {
	id: string
	agent_code: string
	name: string
	role: string[]
	description: string
	name_i18n: CrewI18nText
	role_i18n: CrewI18nArrayText | null
	description_i18n: CrewI18nText | null
	icon: CrewIconObject | null
	icon_type: CrewIconType
	version_code: string
	created_at: string
	published_at: string | null
}

// ======================== User Agents (API 3) ========================

/** Query params for getting user agents list */
export interface GetAgentsParams {
	page?: number
	page_size?: number
	keyword?: string
}

/** Single user agent item */
export interface AgentItem {
	id: string
	/** Crew unique code (magic_super_magic_agents.code) */
	code: string
	name_i18n: CrewI18nText
	role_i18n: CrewI18nArrayText
	description_i18n: CrewI18nText
	/** Agent icon object (url, type, color) */
	icon: CrewIconObject | null
	/** Icon type: 1=icon, 2=image */
	icon_type: CrewIconType
	playbooks: CrewPlayBookBaseData[]
	source_type: CrewSourceType
	publisher_type?: CrewPublisherType
	publisher?: CrewPublisher | null
	enabled: boolean
	/** null when not from store */
	is_store_offline: boolean | null
	need_upgrade: boolean
	latest_version_code: string | null
	allow_delete: boolean
	/** null means not pinned */
	pinned_at: string | null
	latest_published_at: string | null
	updated_at: string
	created_at: string
}

/** Response for user agents list */
export interface GetAgentsResponse {
	list: AgentItem[]
	page: number
	page_size: number
	total: number
}

/** Response for external user agents list */
export interface GetExternalAgentsResponse extends GetAgentsResponse {}

// ======================== Create Agent (API 4) ========================

/** Request body for creating a new agent */
export interface CreateAgentParams {
	name_i18n: CrewI18nText
	role_i18n?: CrewI18nArrayText
	description_i18n?: CrewI18nText
	/** Agent icon object (type + value; backend extracts path from value if URL) */
	icon?: CrewIconObject
	/** Icon type: 1=icon, 2=image */
	icon_type?: CrewIconType
	/** Shadowed prompt payload */
	prompt?: string
}

/** Response for create agent */
export interface CreateAgentResponse {
	id: string
	code: string
}

export type AgentPublishTargetType = "PRIVATE" | "MEMBER" | "ORGANIZATION" | "MARKET"

export type AgentPublishToType = "INTERNAL" | "MARKET"

export type AgentAllowedPublishTargetType = Exclude<AgentPublishTargetType, "MARKET">

export type AgentVersionReviewStatus = "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED"

export type AgentVersionPublishStatus = "PUBLISHED" | "OFFLINE"

/** Request body for publish agent */
export interface PublishAgentTargetValue {
	user_ids?: string[]
	department_ids?: string[]
}

export type PublishAgentPrefillDescriptionI18n = CrewI18nText | Record<string, string> | []

export interface PublishAgentPrefillResponse {
	version: string
	version_description_i18n: PublishAgentPrefillDescriptionI18n | null
	publish_target_type: AgentPublishTargetType | null
	publish_target_value?: PublishAgentTargetValue | null
}

export interface PublishAgentParams {
	version: string
	version_description_i18n: CrewI18nText
	/** Reserved for the upcoming publish-to grouping field. */
	publish_to_type?: AgentPublishToType
	publish_target_type: AgentPublishTargetType
	publish_target_value?: PublishAgentTargetValue | null
}

/** Response for publish agent (API 17) */
export interface PublishAgentResponse {
	version_id: string
	version: string
	publish_status: AgentVersionPublishStatus
	review_status: AgentVersionReviewStatus
	publish_to_type?: AgentPublishToType
	publish_target_type: AgentPublishTargetType
	is_current_version: boolean
	published_at: string
}

// ======================== Update Agent Info (API 5) ========================

/** Request body for updating agent basic info */
export interface UpdateAgentInfoParams {
	name_i18n?: CrewI18nText
	role_i18n?: CrewI18nArrayText
	description_i18n?: CrewI18nText
	prompt_shadow?: string
	/** Icon object; value="" clears the icon */
	icon?: CrewIconObject
	icon_type?: CrewIconType
}

// ======================== Update Agent Skills (API 6, 6.1, 6.2) ========================

/** Request body for updating agent skills (full replace) */
export interface UpdateAgentSkillsParams {
	skill_codes: string[]
}

/** Request body for adding agent skills (incremental) */
export interface AddAgentSkillsParams {
	skill_codes: string[]
}

/** Request body for deleting agent skills */
export interface DeleteAgentSkillsParams {
	skill_codes: string[]
}

// ======================== Mention Panel Skills ========================

export type MentionSkillSource = "system" | "agent" | "mine"

export interface GetMentionSkillsParams {
	agent_code?: string
}

export interface MentionSkillItem {
	id: string
	code: string
	name: string
	description: string
	logo: string | null
	mention_source: MentionSkillSource
	package_name: string
}

export interface GetMentionSkillsResponse {
	code: number
	message: string
	data: MentionSkillItem[]
}

// ======================== Agent Detail (API 7) ========================

/** A bound skill with detail info */
export interface AgentSkillItem {
	id: number
	skill_id: number
	skill_code: string
	name_i18n: CrewI18nText
	description_i18n: CrewI18nText
	logo: string | null
	sort_order: number
}

/** A playbook (feature/scene) */
export interface PlaybookItem {
	id: string
	agent_id: number
	agent_code: string
	name_i18n: CrewI18nText
	description_i18n: CrewI18nText | null
	/** Emoji or icon key */
	icon: string | null
	theme_color: string | null
	enabled: boolean
	sort_order: number
	config: PlaybookConfig | null
	created_at: string
	updated_at: string
}

/** Playbook configuration object */
export interface PlaybookConfig {
	scenes_config?: {
		presets?: FieldPanelConfig
		quick_start?: GuidePanelConfig
		inspiration?: DemoPanelConfig
	}
	presets_config?: Record<string, unknown>
	quick_starts_config?: string[]
}

/** Full agent detail response */
export interface AgentDetailResponse {
	id: number | string
	agent_code: string
	version_code?: string | null
	version_id?: string | null
	name_i18n: CrewI18nText
	role_i18n: CrewI18nArrayText
	description_i18n: CrewI18nText
	/** Agent icon object (type + value) */
	icon: CrewIconObject | null
	icon_type?: CrewIconType
	/** Prompt content (string or structured object) */
	prompt: CrewAgentPrompt | null
	enabled: boolean
	source_type: CrewSourceType
	is_store_offline: boolean | null
	pinned_at: string | null
	file_key?: string | null
	latest_published_at: string | null
	skills: AgentSkillItem[]
	features: PlaybookItem[]
	created_at: string
	updated_at: string
	project_id: string | null
	publish_type?: AgentPublishToType | null
	allowed_publish_target_types?: AgentAllowedPublishTargetType[]
}

// ======================== Agent Versions (API 18) ========================

export interface GetAgentVersionsParams {
	page?: number
	page_size?: number
	publish_target_type?: AgentPublishTargetType
	status?: AgentVersionReviewStatus
}

export interface AgentVersionPublisher {
	id: string
	uid?: string
	name: string
	time?: string
	timestamp?: number
	avatar?: string
}

export interface AgentPublishTargetMember {
	id: string
	name: string
}

export interface AgentPublishTargetValueResolved {
	users: AgentPublishTargetMember[]
	departments: AgentPublishTargetMember[]
}

export interface AgentVersionItem {
	id: string
	version: string
	publish_status: AgentVersionPublishStatus
	review_status: AgentVersionReviewStatus
	publish_to_type?: AgentPublishToType
	publish_target_type: AgentPublishTargetType
	publish_to_label: string
	publisher: AgentVersionPublisher | null
	published_at: string | null
	display_time: string
	is_current_version: boolean
	version_description_i18n: CrewI18nText | null
	publish_target_value?: AgentPublishTargetValueResolved | null
}

export interface GetAgentVersionsResponse {
	list: AgentVersionItem[]
	page: number
	page_size: number
	total: number
}

// ======================== Playbooks (API 8-13) ========================

/** Query params for getting agent playbooks */
export interface GetPlaybooksParams {
	/** Filter by enabled state; omit for all */
	enabled?: boolean
}

/** Request body for creating a playbook */
export interface CreatePlaybookParams {
	name_i18n: CrewI18nText
	description_i18n?: CrewI18nText
	icon?: string
	theme_color?: string
	enabled?: boolean
	sort_order?: number
	config?: PlaybookConfig
}

/** Response body for creating a playbook */
export interface CreatePlaybookResponse {
	id: string
}

/** Request body for updating a playbook */
export interface UpdatePlaybookParams {
	name_i18n?: CrewI18nText
	description_i18n?: CrewI18nText
	icon?: string
	theme_color?: string
	enabled?: boolean
	sort_order?: number
	config?: PlaybookConfig
}

/** Request body for toggling playbook enabled state */
export interface TogglePlaybookEnabledParams {
	enabled: boolean
}

/** Request body for reordering playbooks */
export interface ReorderPlaybooksParams {
	ids: string[]
}

// ======================== API Generator ========================

export const generateCrewApi = (fetch: HttpClient) => ({
	/**
	 * Get store agent category list.
	 * Returns all categories with crew count for the current organization.
	 */
	getStoreAgentCategories() {
		return fetch.get<GetStoreCategoriesResponse>(
			genRequestUrl("/api/v2/super-magic/agent-market/categories"),
		)
	},

	/**
	 * Get store agents list (marketplace).
	 * POST with body: page, page_size, keyword, category_id.
	 * Results include is_added and allow_delete flags for each agent.
	 * @param params Request body
	 */
	getStoreAgents(params: GetStoreAgentsParams = {}) {
		const { page = 1, page_size = 20, keyword, category_id } = params
		return fetch.post<GetStoreAgentsResponse>(
			genRequestUrl("/api/v2/super-magic/agent-market/queries"),
			{
				page,
				page_size,
				keyword,
				category_id,
			},
		)
	},

	/**
	 * Get marketplace detail for a single agent.
	 * Used when the current user has not installed the agent yet.
	 * @param code Market agent code
	 */
	getStoreAgentMarketDetail({ code }: { code: string }) {
		return fetch.get<StoreAgentMarketDetailResponse>(
			genRequestUrl("/api/v2/super-magic/agent-market/${code}", { code }),
		)
	},

	/**
	 * Get current user's created agents list.
	 * POST with body: page, page_size, keyword.
	 * Only returns agents created by the current user.
	 * @param params Request body
	 */
	getAgents(params: GetAgentsParams = {}) {
		const { page = 1, page_size = 20, keyword } = params
		return fetch.post<GetAgentsResponse>(genRequestUrl("/api/v2/super-magic/agents/queries"), {
			page,
			page_size,
			keyword,
		})
	},

	/**
	 * Get current user's external agents list.
	 * POST with body: page, page_size, keyword.
	 * Includes market hires and agents published to the current user.
	 * @param params Request body
	 */
	getExternalAgents(params: GetAgentsParams = {}) {
		const { page = 1, page_size = 20, keyword } = params
		return fetch.post<GetExternalAgentsResponse>(
			genRequestUrl("/api/v2/super-magic/agents/external/queries"),
			{
				page,
				page_size,
				keyword,
			},
		)
	},

	/**
	 * Create a new agent (LOCAL_CREATE source type).
	 * Generates a unique code from name_i18n.en_US.
	 * @param params Agent creation payload
	 */
	createAgent(params: CreateAgentParams) {
		return fetch.post<CreateAgentResponse>(genRequestUrl("/api/v2/super-magic/agents"), params)
	},

	/**
	 * Get agent detail by code.
	 * Includes bound skills and playbooks.
	 * Validates that the agent belongs to the current organization.
	 * @param code Agent unique code
	 */
	getAgentDetail({ code }: { code: string }) {
		return fetch.get<AgentDetailResponse>(
			genRequestUrl("/api/v2/super-magic/agents/${code}", { code }),
		)
	},

	/**
	 * Update agent basic display info.
	 * Only allowed for non-MARKET agents.
	 * Partial updates supported; omitted fields are left unchanged.
	 * @param code Agent unique code
	 * @param params Fields to update
	 */
	updateAgentInfo({ code, ...params }: { code: string } & UpdateAgentInfoParams) {
		return fetch.put<[]>(genRequestUrl("/api/v2/super-magic/agents/${code}", { code }), params)
	},

	/**
	 * Soft-delete a user agent.
	 * For MARKET agents: only deletes the user's agent record.
	 * For LOCAL_CREATE agents: deletes all related data (skills, playbooks, etc.)
	 * @param code Agent unique code
	 */
	deleteAgent({ code }: { code: string }) {
		return fetch.delete<[]>(genRequestUrl("/api/v2/super-magic/agents/${code}", { code }))
	},

	/**
	 * Upgrade a MARKET agent to the latest published version.
	 * Only allowed for agents with source_type='MARKET'.
	 * Updates version_id, version_code and metadata from the latest store version.
	 * @param code Agent unique code
	 */
	upgradeAgent({ code }: { code: string }) {
		return fetch.put<[]>(
			genRequestUrl("/api/v2/super-magic/agents/${code}/upgrade", { code }),
			{},
		)
	},

	/**
	 * Publish agent to store (creates version under review).
	 * Only allowed for non-MARKET agents. Creates agent_version with review_status=UNDER_REVIEW.
	 * @param code Agent unique code
	 */
	publishAgent({ code, ...params }: { code: string } & PublishAgentParams) {
		return fetch.post<PublishAgentResponse>(
			genRequestUrl("/api/v2/super-magic/agents/${code}/publish", { code }),
			params,
		)
	},

	/**
	 * Get publish prefill data for creating a new agent version.
	 * @param code Agent unique code
	 */
	getAgentPublishPrefill({ code }: { code: string }) {
		return fetch.get<PublishAgentPrefillResponse>(
			genRequestUrl("/api/v2/super-magic/agents/${code}/publish/prefill", { code }),
		)
	},

	/**
	 * Get agent publish versions.
	 * @param code Agent unique code
	 * @param params Query params
	 */
	getAgentVersions({ code, ...params }: { code: string } & GetAgentVersionsParams) {
		return fetch.get<GetAgentVersionsResponse>(
			genRequestUrl("/api/v2/super-magic/agents/${code}/versions", { code }, params),
		)
	},

	/**
	 * Offline agent version (unpublish from store).
	 * Updates all PUBLISHED versions to OFFLINE.
	 * @param code Agent unique code
	 */
	offlineAgent({ code }: { code: string }) {
		return fetch.put<[]>(
			genRequestUrl("/api/v2/super-magic/agents/${code}/offline", { code }),
			{},
		)
	},

	/**
	 * Update agent bound skills list (full replace).
	 * Deletes all existing bindings and creates new ones from the provided list.
	 * Passing an empty skill_codes array clears all bindings.
	 * @param code Agent unique code
	 * @param params Skills code list to bind
	 */
	updateAgentSkills({ code, ...params }: { code: string } & UpdateAgentSkillsParams) {
		return fetch.put<[]>(
			genRequestUrl("/api/v2/super-magic/agents/${code}/skills", { code }),
			params,
		)
	},

	/**
	 * Add skills to agent (incremental).
	 * Skips already-bound skills; does not replace existing bindings.
	 * @param code Agent unique code
	 * @param params Skill codes to add
	 */
	addAgentSkills({ code, ...params }: { code: string } & AddAgentSkillsParams) {
		return fetch.post<[]>(
			genRequestUrl("/api/v2/super-magic/agents/${code}/skills", { code }),
			params,
		)
	},

	/**
	 * Remove skills from agent.
	 * Soft-deletes the binding records for the given skill codes.
	 * Missing bindings are silently ignored.
	 * @param code Agent unique code
	 * @param params Skill codes to remove
	 */
	deleteAgentSkills({ code, ...params }: { code: string } & DeleteAgentSkillsParams) {
		return fetch.delete<[]>(
			genRequestUrl("/api/v2/super-magic/agents/${code}/skills", { code }),
			params,
		)
	},

	/**
	 * Get mentionable skills for the @ panel.
	 * agent_code is optional and should be omitted for default mode.
	 * @param params Query parameters
	 */
	getMentionSkills(params: GetMentionSkillsParams = {}) {
		return fetch.get<MentionSkillItem[]>(
			genRequestUrl("/api/v2/super-magic/agents/mention-skills", {}, params),
		)
	},

	/**
	 * Hire a store agent (add to My Crew).
	 * Validates that the agent is published and not already hired.
	 * Also increments the store agent's install_count.
	 * @param code Store agent code (magic_super_magic_store_agents.agent_code)
	 */
	hireStoreAgent({ code }: { code: string }) {
		return fetch.post<[]>(
			genRequestUrl("/api/v2/super-magic/agent-market/${code}/hire", { code }),
			{},
		)
	},

	/**
	 * Get agent playbooks list.
	 * Sorted by: enabled DESC, sort_order DESC, created_at ASC.
	 * @param code Agent unique code
	 * @param params Optional enabled filter
	 */
	getAgentPlaybooks({ code, ...params }: { code: string } & GetPlaybooksParams) {
		return fetch.get<PlaybookItem[]>(
			genRequestUrl(
				"/api/v2/super-magic/agents/${code}/playbooks",
				{ code },
				{ enabled: params.enabled },
			),
		)
	},

	/**
	 * Create a new playbook for an agent.
	 * @param code Agent unique code
	 * @param params Playbook creation payload
	 */
	createAgentPlaybook({ code, ...params }: { code: string } & CreatePlaybookParams) {
		return fetch.post<CreatePlaybookResponse>(
			genRequestUrl("/api/v2/super-magic/agents/${code}/playbooks", { code }),
			params,
		)
	},

	/**
	 * Update a playbook's basic info and config.
	 * Partial updates supported; omitted fields are left unchanged.
	 * @param code Agent unique code
	 * @param playbookId Playbook ID
	 * @param params Fields to update
	 */
	updateAgentPlaybook({
		code,
		playbookId,
		...params
	}: { code: string; playbookId: string } & UpdatePlaybookParams) {
		return fetch.put<[]>(
			genRequestUrl("/api/v2/super-magic/agents/${code}/playbooks/${playbookId}", {
				code,
				playbookId,
			}),
			params,
		)
	},

	/**
	 * Soft-delete a playbook.
	 * @param code Agent unique code
	 * @param playbookId Playbook ID
	 */
	deleteAgentPlaybook({ code, playbookId }: { code: string; playbookId: string }) {
		return fetch.delete<[]>(
			genRequestUrl("/api/v2/super-magic/agents/${code}/playbooks/${playbookId}", {
				code,
				playbookId,
			}),
		)
	},

	/**
	 * Toggle a playbook's enabled/disabled state.
	 * @param code Agent unique code
	 * @param playbookId Playbook ID
	 * @param params enabled flag
	 */
	toggleAgentPlaybookEnabled({
		code,
		playbookId,
		...params
	}: { code: string; playbookId: string } & TogglePlaybookEnabledParams) {
		return fetch.put<[]>(
			genRequestUrl("/api/v2/super-magic/agents/${code}/playbooks/${playbookId}/enabled", {
				code,
				playbookId,
			}),
			params,
		)
	},

	/**
	 * Batch reorder playbooks for an agent.
	 * First ID gets the highest sort_order, last ID gets 0.
	 * @param code Agent unique code
	 * @param params Ordered list of playbook IDs
	 */
	reorderAgentPlaybooks({ code, ...params }: { code: string } & ReorderPlaybooksParams) {
		return fetch.put<[]>(
			genRequestUrl("/api/v2/super-magic/agents/${code}/playbooks/reorder", { code }),
			params,
		)
	},
})
