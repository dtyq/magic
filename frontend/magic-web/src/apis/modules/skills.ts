import type { HttpClient } from "@/apis/core/HttpClient"
import { genRequestUrl } from "@/utils/http"

import { SupportLocales } from "@/constants/locale"

// ======================== Types ========================

/** Publisher type for store skills */
export type SkillPublisherType = "USER" | "OFFICIAL" | "VERIFIED_CREATOR" | "PARTNER"

/** Source type for user skills */
export type SkillSourceType =
	| "LOCAL_UPLOAD"
	| "MARKET"
	| "GITHUB"
	| "AGENT_CREATED"
	| "AGENT_THIRD_PARTY_IMPORT"
	| "SYSTEM"
	| "CREW_IMPORT"

/** Publish status */
export type SkillPublishStatus = "PUBLISHED" | "UNPUBLISHED"

/**
 * i18n text object for skills.
 * SupportLocales: en_US, zh_CN
 */
export type SkillI18nText = Record<SupportLocales, string>

/** Publisher info */
export interface SkillPublisher {
	name: string
	avatar: string
}

/** Creator info returned by skill list APIs */
export interface SkillCreatorInfo {
	id: string
	uid: string
	name: string
	time: string
	timestamp: number
	avatar: string
}

// ======================== Store Skills ========================

/** Query params for getting store skills list */
export interface GetStoreSkillsParams {
	page?: number
	page_size?: number
	keyword?: string
	/** Filter by publisher type; omit for all */
	publisher_type?: SkillPublisherType
}

/** Single store skill item */
export interface StoreSkillItem {
	id: string
	skill_code: string
	user_skill_code?: string
	/** Latest published version; empty string if unavailable */
	latest_version?: string
	name_i18n: SkillI18nText
	description_i18n: SkillI18nText
	logo: string
	publisher_type: SkillPublisherType
	publisher: SkillPublisher
	publish_status: SkillPublishStatus
	/** Whether current user has added this skill */
	is_added: boolean
	/** Whether the skill needs upgrade (valid when is_added=true and source_type='MARKET') */
	need_upgrade: boolean
	created_at: string
	updated_at: string
}

/** Response data for store skills list */
export interface GetStoreSkillsResponse {
	list: StoreSkillItem[]
	page: number
	page_size: number
	total: number
}

// ======================== User Skills ========================

/** Query params for getting user skills list */
export interface GetSkillsParams {
	page?: number
	page_size?: number
	keyword?: string
	/** Filter by source type; omit for all */
	source_type?: SkillSourceType
}

/** Single user skill item */
export interface SkillItem {
	id: string
	code: string
	/** Resolved name for current locale (optional; from API) */
	name?: string
	/** Resolved description for current locale (optional; from API) */
	description?: string
	name_i18n: SkillI18nText
	description_i18n: SkillI18nText
	logo: string
	source_type: SkillSourceType
	/** 0=disabled, 1=enabled */
	is_enabled: 0 | 1
	/** Pin time; null means not pinned */
	pinned_at: string | null
	/** Latest successful publish time; null if never published */
	latest_published_at?: string | null
	/** Latest published version; empty string if never published */
	latest_version?: string
	/** Whether a newer published version is available */
	need_upgrade?: boolean
	/** Creator profile for team-shared / market-installed / visible lists */
	creator_info?: SkillCreatorInfo | null
	updated_at: string
	created_at: string
}

/** Response data for user skills list */
export interface GetSkillsResponse {
	list: SkillItem[]
	page: number
	page_size: number
	total: number
}

// ======================== Latest Published Skill Versions ========================

/** Query params for latest published skill versions */
export interface GetSkillLastVersionsParams {
	page?: number
	page_size?: number
	/** Limit query to specific skill codes; max 200 */
	codes?: string[]
	keyword?: string
}

/** Single latest published skill version item */
export interface SkillLastVersionItem {
	id: string
	code: string
	version: string
	/** Resolved name for current locale */
	name: string
	/** Resolved description for current locale */
	description: string
	name_i18n: SkillI18nText
	description_i18n: SkillI18nText
	logo: string
	file_key: string | null
	file_url: string | null
	source_type: SkillSourceType
	publish_status: "PUBLISHED"
	review_status: "APPROVED"
	publish_target_type: PublishTargetType
	published_at: string
	project_id: string | null
	created_at: string
	updated_at: string
}

/** Response data for latest published skill versions */
export interface GetSkillLastVersionsResponse {
	list: SkillLastVersionItem[]
	page: number
	page_size: number
	total: number
}

// ======================== Create Empty Skill ========================

/** Response data for creating an empty skill */
export interface CreateSkillResponse {
	id?: string
	code?: string
	skill_code?: string
}

// ======================== Add Skill from Store ========================

/** Request body for adding skill from store */
export interface AddSkillFromStoreParams {
	store_skill_id: string
}

// ======================== Import Skills ========================

/** Request body for parsing an uploaded skill file (phase 1) */
export interface ParseSkillFileParams {
	/** Object storage key for the uploaded file (.skill or .zip) */
	file_key: string
}

/** Response data for skill file/github parse (phase 1) */
export interface ParseSkillResponse {
	import_token: string
	package_name: string
	package_description: string
	/** Whether this is an update to an existing skill */
	is_update: boolean
	/** null when is_update=false */
	code: string | null
	/** null when is_update=false */
	skill_id: number | null
	name_i18n: SkillI18nText
	description_i18n: SkillI18nText
	logo: string
}

/** Request body for parsing a GitHub repo (phase 1, reserved) */
export interface ParseSkillGithubParams {
	repo_url: string
	branch?: string
}

/** Request body for confirming import (phase 2) */
export interface ImportSkillParams {
	import_token: string
	name_i18n: SkillI18nText
	description_i18n: SkillI18nText
	logo?: string
	source_type?: SkillSourceType
}

export type ImportSkillResponse = { id: string; skill_code: string }

// ======================== Skill Detail ========================

/** Response data for single skill detail */
export interface SkillDetailResponse {
	id: string
	code: string
	/** Version ID from magic_skill_versions */
	version_id: number | null
	/** Version string from magic_skill_versions */
	version_code: string | null
	source_type: SkillSourceType
	/** 0=disabled, 1=enabled */
	is_enabled: 0 | 1
	pinned_at: string | null
	name_i18n: SkillI18nText
	description_i18n: SkillI18nText
	logo: string
	package_name: string
	package_description: string | null
	file_key: string
	file_url: string
	source_id: number | null
	source_meta: Record<string, unknown> | null
	created_at: string
	updated_at: string
	project_id: string | null
	/** Latest publish time; null/omit if never published */
	latest_published_at?: string | null
	publish_type?: PublishToType | null
	allowed_publish_target_types?: AllowedPublishTargetType[]
}

/** Query params for skill version history */
export interface GetSkillVersionsParams {
	page?: number
	page_size?: number
	publish_target_type?: PublishTargetType
	status?: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED"
}

export interface SkillVersionPublisher {
	id: string
	uid?: string
	name: string
	avatar?: string
	time?: string
	timestamp?: number
	operated_at?: string
}

export interface SkillPublishTargetMember {
	id: string
	name: string
}

export interface SkillPublishTargetValueResolved {
	users: SkillPublishTargetMember[]
	departments: SkillPublishTargetMember[]
}

export interface SkillVersionItem {
	id: string
	version: string
	publish_status: string
	review_status: string
	publish_target_type: PublishTargetType
	publisher: SkillVersionPublisher | null
	published_at: string | null
	is_current_version: boolean
	version_description_i18n: SkillI18nText | null
	publish_target_value?: SkillPublishTargetValueResolved | null
}

export interface GetSkillVersionsResponse {
	list: SkillVersionItem[]
	page: number
	page_size: number
	total: number
}

export interface PublishSkillVersionDescriptionI18n {
	zh_CN?: string
	en_US?: string
}

export type PublishTargetType = "PRIVATE" | "MEMBER" | "ORGANIZATION" | "MARKET"

export type PublishToType = "INTERNAL" | "MARKET"

export type AllowedPublishTargetType = Exclude<PublishTargetType, "MARKET">

export interface PublishSkillTargetValue {
	user_ids?: string[]
	department_ids?: string[]
}

export type PublishSkillPrefillDescriptionI18n = SkillI18nText | Record<string, string> | []

export interface PublishSkillPrefillResponse {
	version: string
	version_description_i18n: PublishSkillPrefillDescriptionI18n | null
	publish_target_type: PublishTargetType | null
	publish_target_value?: PublishSkillTargetValue | null
}

export interface PublishSkillParams {
	version: string
	version_description_i18n: PublishSkillVersionDescriptionI18n
	/** Reserved for the upcoming publish-to grouping field. */
	publish_to_type?: PublishToType
	publish_target_type: PublishTargetType
	publish_target_value?: PublishSkillTargetValue | null
}

export interface PublishSkillResponse {
	version_id: string
	version: string
	publish_status: string
	review_status: string
	publish_to_type?: PublishToType
	publish_target_type: PublishTargetType
	is_current_version: boolean
	published_at: string | null
}

// ======================== Update Skill Info ========================

/** Request body for updating skill basic info */
export interface UpdateSkillInfoParams {
	name_i18n?: SkillI18nText
	description_i18n?: SkillI18nText
	/** Empty string clears the logo */
	logo?: string
}

// ======================== API Generator ========================

export const generateSkillsApi = (fetch: HttpClient) => ({
	/**
	 * Get store skills list (marketplace).
	 * Supports pagination, keyword search and publisher type filter.
	 * Results indicate whether the current user has already added each skill.
	 * @param params Query parameters
	 */
	getStoreSkills(params: GetStoreSkillsParams = {}) {
		return fetch.post<GetStoreSkillsResponse>(
			genRequestUrl("/api/v1/skill-market/queries"),
			params,
		)
	},

	/**
	 * Get current user's skill list.
	 * Pinned skills are sorted first, then sorted by updated_at DESC.
	 * Returns need_upgrade=true for MARKET skills with newer versions available.
	 * @param params Query parameters
	 */
	getSkills(params: GetSkillsParams = {}) {
		return fetch.post<GetSkillsResponse>(genRequestUrl("/api/v1/skills/queries"), params)
	},

	/**
	 * Batch query the current published version for visible skills.
	 * Only returns versions with publish_status=PUBLISHED and review_status=APPROVED.
	 * @param params Query parameters
	 */
	getSkillLastVersions(params: GetSkillLastVersionsParams = {}) {
		return fetch.post<GetSkillLastVersionsResponse>(
			genRequestUrl("/api/v1/skills/last-versions/queries"),
			params,
		)
	},

	/**
	 * Get current user's created skills.
	 * latest_version is the newest published version or an empty string.
	 * @param params Query parameters
	 */
	getCreatedSkills(params: GetSkillsParams = {}) {
		return fetch.post<GetSkillsResponse>(
			genRequestUrl("/api/v1/skills/queries/created"),
			params,
		)
	},

	/**
	 * Get team-shared skills visible to the current user.
	 * Data is based on the current published snapshot, not local drafts.
	 * @param params Query parameters
	 */
	getTeamSharedSkills(params: GetSkillsParams = {}) {
		return fetch.post<GetSkillsResponse>(
			genRequestUrl("/api/v1/skills/queries/team-shared"),
			params,
		)
	},

	/**
	 * Get skills installed from the marketplace.
	 * Data is based on the current published snapshot, not local drafts.
	 * @param params Query parameters
	 */
	getMarketInstalledSkills(params: GetSkillsParams = {}) {
		return fetch.post<GetSkillsResponse>(
			genRequestUrl("/api/v1/skills/queries/market-installed"),
			params,
		)
	},

	/**
	 * Create an empty local skill.
	 * Backend generates a new skill record and returns its identity.
	 */
	createSkill() {
		return fetch.post<CreateSkillResponse>(genRequestUrl("/api/v1/skills"), {})
	},

	/**
	 * Add a skill from the store marketplace.
	 * Validates that the skill is published and not already added.
	 * Also increments the store skill's install_count.
	 * @param params.store_skill_id Store skill ID (magic_store_skills.id)
	 */
	addSkillFromStore(params: AddSkillFromStoreParams) {
		return fetch.post<[]>(genRequestUrl("/api/v1/skills/from-store"), params)
	},

	/**
	 * Import phase 1: Parse a skill package file by its object storage key.
	 * Validates the file, extracts SKILL.md metadata, optionally uses AI to
	 * generate i18n name/description, and returns a short-lived import_token.
	 * Does NOT write to the database.
	 * @param params.file_key Object storage key of the uploaded .skill/.zip file
	 */
	parseSkillFile(params: ParseSkillFileParams) {
		return fetch.post<ParseSkillResponse>(
			genRequestUrl("/api/v1/skills/import/parse/file"),
			params,
		)
	},

	/**
	 * Import phase 1 (reserved): Parse a GitHub repository as a skill.
	 * Not yet implemented; reserved for future use.
	 * @param params.repo_url GitHub repository URL
	 * @param params.branch Branch name (default: main)
	 */
	parseSkillGithub(params: ParseSkillGithubParams) {
		return fetch.post<ParseSkillResponse>(
			genRequestUrl("/api/v1/skills/import/parse/github"),
			params,
		)
	},

	/**
	 * Import phase 2: Confirm skill info and persist to the database.
	 * Validates the import_token, then creates or updates the skill record.
	 * Uses a distributed lock to prevent concurrent duplicate imports.
	 * @param params Import confirmation payload including token and i18n fields
	 */
	importSkill(params: ImportSkillParams) {
		return fetch.post<ImportSkillResponse>(genRequestUrl("/api/v1/skills/import"), params)
	},

	/**
	 * Get detailed info for a single user skill.
	 * Includes the latest version info from magic_skill_versions.
	 * Validates that the skill belongs to the current organization.
	 * @param code Skill unique code (magic_skills.code)
	 */
	getSkillDetail({ code }: { code: string }) {
		return fetch.get<SkillDetailResponse>(genRequestUrl("/api/v1/skills/${code}", { code }))
	},

	/**
	 * List publish versions for a skill.
	 * @param code Skill unique code
	 * @param params Pagination and filters
	 */
	getSkillVersions({ code, ...queries }: { code: string } & GetSkillVersionsParams) {
		return fetch.get<GetSkillVersionsResponse>(
			genRequestUrl("/api/v1/skills/${code}/versions", { code }, queries),
		)
	},

	/**
	 * Publish a new skill version.
	 * @param code Skill unique code
	 * @param params Version, i18n release notes, and target
	 */
	publishSkill({ code, ...body }: { code: string } & PublishSkillParams) {
		return fetch.post<PublishSkillResponse>(
			genRequestUrl("/api/v1/skills/${code}/publish", { code }),
			body,
		)
	},

	/**
	 * Get publish prefill data for creating a new skill version.
	 * @param code Skill unique code
	 */
	getSkillPublishPrefill({ code }: { code: string }) {
		return fetch.get<PublishSkillPrefillResponse>(
			genRequestUrl("/api/v1/skills/${code}/publish/prefill", { code }),
		)
	},

	/**
	 * Soft-delete a user skill (all source types supported).
	 * Updates deleted_at; version records in magic_skill_versions are kept.
	 * Validates that the skill belongs to the current organization.
	 * @param code Skill unique code (magic_skills.code)
	 */
	deleteSkill({ code }: { code: string }) {
		return fetch.delete<[]>(genRequestUrl("/api/v1/skills/${code}", { code }))
	},

	/**
	 * Update basic display info for a user skill (name, description, logo).
	 * Only allowed for non-MARKET skills; returns error 40018 for MARKET skills.
	 * Partial updates are supported; omitted fields are left unchanged.
	 * @param code Skill unique code (magic_skills.code)
	 * @param params Fields to update
	 */
	updateSkillInfo({ code, ...params }: { code: string } & UpdateSkillInfoParams) {
		return fetch.put<[]>(genRequestUrl("/api/v1/skills/${code}/info", { code }), params)
	},

	/**
	 * Upgrade a MARKET skill to the latest published version.
	 * Only allowed for skills with source_type='MARKET'.
	 * Copies metadata from the latest store version; no new skill_version is created.
	 * @param code Skill unique code (magic_skills.code)
	 */
	upgradeSkill({ code }: { code: string }) {
		return fetch.put<[]>(genRequestUrl("/api/v1/skills/${code}/upgrade", { code }), {})
	},
})
