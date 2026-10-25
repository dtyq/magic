import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"
import type { CollaboratorPermission } from "@/pages/superMagic/types/collaboration"

import { SupportLocales } from "@/constants/locale"

// ======================== Types ========================

/** Publisher type for store skills */
export type SkillPublisherType =
	"USER" | "OFFICIAL" | "OFFICIAL_BUILTIN" | "VERIFIED_CREATOR" | "PARTNER"

/** Source type for user skills */
export type SkillSourceType =
	| "LOCAL_UPLOAD"
	| "MARKET"
	| "GITHUB"
	| "AGENT_CREATED"
	| "DIALOGUE_CREATION"
	| "AGENT_THIRD_PARTY_IMPORT"
	| "SYSTEM"
	| "CREW_IMPORT"

/** User skill list scope. */
export type SkillListScope = "all" | "created" | "team_shared" | "collaborated" | "market_installed"

/** Publish status */
export type SkillPublishStatus = "PUBLISHED" | "UNPUBLISHED"

/** Review status for published skill versions */
export type SkillVersionReviewStatus =
	"PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "INVALIDATED"

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

/** Creator info returned by single skill detail APIs */
export interface SkillDetailCreatorInfo {
	id: string
	name: string
	avatar: string
	operate_at: string
}

// ======================== Store Skills ========================

/** Query params for getting store skills list */
export interface GetStoreSkillsParams {
	page?: number
	page_size?: number
	keyword?: string
	/** Filter by publisher type; omit for all */
	publisher_type?: SkillPublisherType
	/** Filter by first-level category IDs. IDs are strings across the API contract. */
	category_ids?: string[]
	/** Filter by featured status; omit or pass null to include all skills. */
	is_featured?: boolean | 0 | 1 | null
}

/** Single skill-market category node. */
export interface SkillMarketCategoryItem {
	id: string
	parent_id: string
	name: string
	logo: string | null
	sort_order: number
	status: number
	skill_count: number
	children?: SkillMarketCategoryItem[]
}

/** Query params for getting skill-market categories. */
export interface GetSkillMarketCategoriesParams {
	/** Set true to include categories without visible skills; omit for the Skill library. */
	include_empty?: boolean | 0 | 1
}

/** Response data for skill-market categories. */
export interface GetSkillMarketCategoriesResponse {
	list: SkillMarketCategoryItem[]
}

/** Single store skill item */
export interface StoreSkillItem {
	id: string
	/** Preferred unique code field; `skill_code` is retained for compatibility. */
	code?: string
	skill_code?: string
	user_skill_code?: string
	package_name?: string
	/** Resolved fields returned by the current market API contract. */
	name?: string
	description?: string
	source?: string
	is_featured?: boolean | 0 | 1
	install_count?: number
	/** Latest published version; empty string if unavailable */
	latest_version?: string
	logo: string
	file_key?: string | null
	file_url?: string | null
	publisher_type: SkillPublisherType
	publisher: Partial<SkillPublisher>
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
}

// ======================== User Skills ========================

/** Query params for getting user skills list */
export interface GetSkillsParams {
	page?: number
	page_size?: number
	keyword?: string
	/** Filter by source type; omit for all */
	source_type?: SkillSourceType
	/** Explicit list scope for the unified user skills endpoint. */
	scope?: SkillListScope
}

/** Single user skill item */
export interface SkillItem {
	id: string
	code: string
	project_id?: string | null
	user_role?: CollaboratorPermission
	package_name?: string
	/** Resolved name for the current locale. */
	name?: string
	/** Resolved description for the current locale. */
	description?: string
	/** Resolved source for the current locale. */
	source?: string
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
	/** Publisher profile for market-installed lists */
	publisher_type?: SkillPublisherType
	publisher?: SkillPublisher | null
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
	package_name?: string
	version: string
	/** Resolved name for current locale */
	name: string
	/** Resolved description for current locale */
	description: string
	/** Resolved source for the current locale. */
	source?: string
	/** Deprecated compatibility fields; use the resolved display fields above. */
	name_i18n?: SkillI18nText
	description_i18n?: SkillI18nText
	source_i18n?: SkillI18nText
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
	source_i18n?: SkillI18nText
	logo: string
}

/** Response data for parsing an official Skill package (admin phase 1). */
export interface ParseOfficialSkillResponse {
	import_token: string
	package_name: string
	code: string
	package_description: string
	is_update: boolean
	name_i18n: Record<string, string>
	description_i18n: Record<string, string>
	source_i18n?: Record<string, string>
	logo: string
	market_id: number | null
}

/** Common fields for an official Skill import request. */
export interface OfficialSkillImportFields {
	version: string
	name_i18n: SkillI18nText
	description_i18n: SkillI18nText
	source_i18n?: SkillI18nText
	logo?: string
	category_ids?: string[]
	publish_status?: "OFFLINE" | "PUBLISHED"
	is_hidden?: boolean
	is_featured?: boolean
	sort_order?: number
}

/** Page import: the parse token is required. */
export interface ImportOfficialSkillByTokenParams extends OfficialSkillImportFields {
	import_token: string
	file_key?: never
}

/** Direct import: intended for a previously uploaded object-storage file. */
export interface ImportOfficialSkillByFileKeyParams extends OfficialSkillImportFields {
	file_key: string
	import_token?: never
}

export type ImportOfficialSkillParams =
	ImportOfficialSkillByTokenParams | ImportOfficialSkillByFileKeyParams

export interface ImportOfficialSkillResponse {
	code: string
	version: string
	action: "created" | "updated"
	market_id: number | null
	version_id: number | null
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
	source_i18n?: SkillI18nText
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
	/** Resolved name for the current locale. */
	name: string
	/** Resolved description for the current locale. */
	description: string
	/** Resolved source for the current locale. */
	source: string
	/** Deprecated compatibility fields; use the resolved display fields above. */
	name_i18n?: SkillI18nText
	description_i18n?: SkillI18nText
	source_i18n?: SkillI18nText
	logo: string
	package_name: string
	package_description: string | null
	file_key: string
	file_url: string
	skill_file_url: string
	source_id: number | null
	source_meta: Record<string, unknown> | null
	created_at: string
	updated_at: string
	project_id: string | null
	/** Latest publish time; null/omit if never published */
	latest_published_at?: string | null
	publish_type?: PublishToType | null
	allowed_publish_target_types?: AllowedPublishTargetType[]
	creator_info?: SkillDetailCreatorInfo | null
	is_featured?: boolean
}

/** Response data for single market skill detail */
export interface SkillMarketDetailResponse {
	code: string
	name: string
	description: string
	source: string
	/** Deprecated compatibility fields; use the resolved display fields above. */
	name_i18n?: Record<string, string>
	description_i18n?: Record<string, string>
	source_i18n?: Record<string, string> | string[]
	skill_file_url: string
	version_code: string
	package_name: string
	version_created_at: string
	logo: string
	publisher_type: SkillPublisherType
	publisher: SkillPublisher | null
	is_added: boolean
	is_creator: boolean
	is_featured: boolean
	/** Bound category IDs. The skill market page only displays first-level categories. */
	category_ids?: string[]
}

/** Query params for skill version history */
export interface GetSkillVersionsParams {
	page?: number
	page_size?: number
	publish_target_type?: PublishTargetType
	status?: SkillVersionReviewStatus
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
	review_status: SkillVersionReviewStatus
	publish_target_type: PublishTargetType
	publisher: SkillVersionPublisher | null
	published_at: string | null
	is_current_version: boolean
	/** Resolved version details displayed by the publish history/detail view. */
	version_description?: string | null
	/** @deprecated Kept for compatibility with older version responses. */
	version_description_i18n?: SkillI18nText | null
	publish_target_value?: SkillPublishTargetValueResolved | null
	/** Categories selected when this version was published to the skills library. */
	category_ids?: string[]
	categories?: Array<{
		id: string | number
		name: string
	}> | null
}

export interface GetSkillVersionsResponse {
	list: SkillVersionItem[]
	page: number
	page_size: number
	total: number
}

export interface PublishSkillVersionDescriptionI18n {
	default?: string
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
	category_ids?: string[]
}

export interface PublishSkillParams {
	version: string
	version_description_i18n: PublishSkillVersionDescriptionI18n
	/** Reserved for the upcoming publish-to grouping field. */
	publish_to_type?: PublishToType
	publish_target_type: PublishTargetType
	publish_target_value?: PublishSkillTargetValue | null
	category_ids?: string[]
}

export interface PublishSkillResponse {
	version_id: string
	version: string
	publish_status: string
	review_status: SkillVersionReviewStatus
	publish_to_type?: PublishToType
	publish_target_type: PublishTargetType
	is_current_version: boolean
	published_at: string | null
	category_ids?: string[]
}

/** Async publish task lifecycle status (ZIP packing / upload). */
export type AsyncPublishTaskStatus = "processing" | "ready" | "failed"

/** Response for async skill publish create / check. */
export interface AsyncPublishTaskResponse {
	publish_task_id: string
	status: AsyncPublishTaskStatus
	progress: number | null
	resource_type?: "agent" | "skill"
	resource_code?: string
	organization_code?: string
	publisher_user_id?: string
	version_id?: number | string
	task_key?: string
	sandbox_id?: string
	file_key?: string | null
	error?: string | null
	created_at?: number
	updated_at?: number
}

export interface CheckSkillPublishParams {
	publish_task_id: string
}

// ======================== Update Skill Info ========================

/** Request body for updating skill basic info */
export interface UpdateSkillInfoParams {
	name_i18n?: SkillI18nText
	description_i18n?: SkillI18nText
	source_i18n?: SkillI18nText
	/** Empty string clears the logo */
	logo?: string
}

// ======================== API Generator ========================

export const generateSkillsApi = (fetch: ServiceHttpClient) => ({
	/**
	 * Get the skill-market category tree.
	 * Empty categories are returned only when include_empty is explicitly enabled.
	 */
	getSkillMarketCategories(params: GetSkillMarketCategoriesParams = {}) {
		return fetch.get<GetSkillMarketCategoriesResponse>("/api/v1/skill-market/categories", {
			params: { include_empty: params.include_empty },
		})
	},

	/**
	 * Get store skills list (marketplace).
	 * Endpoint: POST /api/v1/skill-market/queries
	 * Supports pagination, keyword search, publisher type, category and featured filters.
	 * The current response is cursor-free page pagination and does not require a total count.
	 * Results indicate whether the current user has already added each skill.
	 * @param params Query parameters
	 */
	getStoreSkills(params: GetStoreSkillsParams = {}) {
		return fetch.post<GetStoreSkillsResponse>("/api/v1/skill-market/queries", params)
	},

	/**
	 * Batch query the current published version for visible skills.
	 * Only returns versions with publish_status=PUBLISHED and review_status=APPROVED.
	 * @param params Query parameters
	 */
	getSkillLastVersions(params: GetSkillLastVersionsParams = {}) {
		return fetch.post<GetSkillLastVersionsResponse>(
			"/api/v1/skills/last-versions/queries",
			params,
		)
	},

	/**
	 * Get current user's created skills.
	 * Endpoint: POST /api/v1/skills/queries/created
	 * latest_version is the newest published version or an empty string.
	 * @param params Query parameters
	 * @deprecated Use getUserSkills({ ...params, scope: "created" }) instead.
	 */
	getCreatedSkills(params: GetSkillsParams = {}) {
		return fetch.post<GetSkillsResponse>("/api/v1/skills/queries/created", params)
	},

	/**
	 * Get user skills by an explicit scope.
	 * Endpoint: POST /api/v1/skills/queries
	 */
	getUserSkills(params: GetSkillsParams = {}) {
		return fetch.post<GetSkillsResponse>("/api/v1/skills/queries", params)
	},

	/**
	 * Get team-shared skills visible to the current user.
	 * Endpoint: POST /api/v1/skills/queries/team-shared
	 * Data is based on the current published snapshot, not local drafts.
	 * @param params Query parameters
	 * @deprecated Use getUserSkills({ ...params, scope: "team_shared" }) instead.
	 */
	getTeamSharedSkills(params: GetSkillsParams = {}) {
		return fetch.post<GetSkillsResponse>("/api/v1/skills/queries/team-shared", params)
	},

	/**
	 * Get skills installed from the marketplace.
	 * Endpoint: POST /api/v1/skills/queries/market-installed
	 * Data is based on the current published snapshot, not local drafts.
	 * @param params Query parameters
	 * @deprecated Use getUserSkills({ ...params, scope: "market_installed" }) instead.
	 */
	getMarketInstalledSkills(params: GetSkillsParams = {}) {
		return fetch.post<GetSkillsResponse>("/api/v1/skills/queries/market-installed", params)
	},

	/**
	 * Create an empty local skill.
	 * Backend generates a new skill record and returns its identity.
	 */
	createSkill() {
		return fetch.post<CreateSkillResponse>("/api/v1/skills", {})
	},

	/**
	 * Add a skill from the store marketplace.
	 * Validates that the skill is published and not already added.
	 * Also increments the store skill's install_count.
	 * @param params.store_skill_id Store skill ID (magic_store_skills.id)
	 */
	addSkillFromStore(params: AddSkillFromStoreParams) {
		return fetch.post<[]>("/api/v1/skills/from-store", params)
	},

	/**
	 * Import phase 1: Parse a skill package file by its object storage key.
	 * Validates the file, extracts SKILL.md metadata, optionally uses AI to
	 * generate i18n name/description, and returns a short-lived import_token.
	 * Does NOT write to the database.
	 * @param params.file_key Object storage key of the uploaded .skill/.zip file
	 */
	parseSkillFile(params: ParseSkillFileParams) {
		return fetch.post<ParseSkillResponse>("/api/v1/skills/import/parse/file", params)
	},

	/**
	 * Admin-only official Skill import phase 1.
	 * Parses an uploaded package and returns a short-lived import token.
	 */
	parseOfficialSkillFile(params: ParseSkillFileParams) {
		return fetch.post<ParseOfficialSkillResponse>(
			"/api/v1/admin/official-skills/import/parse/file",
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
		return fetch.post<ParseSkillResponse>("/api/v1/skills/import/parse/github", params)
	},

	/**
	 * Import phase 2: Confirm skill info and persist to the database.
	 * Validates the import_token, then creates or updates the skill record.
	 * Uses a distributed lock to prevent concurrent duplicate imports.
	 * @param params Import confirmation payload including token and i18n fields
	 */
	importSkill(params: ImportSkillParams) {
		return fetch.post<ImportSkillResponse>("/api/v1/skills/import", params)
	},

	/**
	 * Admin-only official Skill import phase 2.
	 * `import_token` is used by the page flow; `file_key` is used by direct imports.
	 */
	importOfficialSkill(params: ImportOfficialSkillParams) {
		return fetch.post<ImportOfficialSkillResponse>(
			"/api/v1/admin/official-skills/import",
			params,
		)
	},

	/**
	 * Get detailed info for a single user skill.
	 * Includes the latest version info from magic_skill_versions.
	 * Validates that the skill belongs to the current organization.
	 * @param code Skill unique code (magic_skills.code)
	 */
	getSkillDetail({ code }: { code: string }) {
		return fetch.get<SkillDetailResponse>(`/api/v1/skills/${code}`)
	},

	/**
	 * Get detailed info for a single market skill.
	 * Includes localized metadata and the published SKILL.md URL.
	 * @param code Skill unique code
	 */
	getSkillMarketDetail({ code }: { code: string }) {
		return fetch.get<SkillMarketDetailResponse>(`/api/v1/skill-market/${code}`)
	},

	/**
	 * List publish versions for a skill.
	 * @param code Skill unique code
	 * @param params Pagination and filters
	 */
	getSkillVersions({ code, ...queries }: { code: string } & GetSkillVersionsParams) {
		return fetch.get<GetSkillVersionsResponse>(`/api/v1/skills/${code}/versions`, {
			params: { ...queries },
		})
	},

	/**
	 * Publish a new skill version.
	 * @param code Skill unique code
	 * @param params Version, i18n release notes, and target
	 */
	publishSkill({ code, ...body }: { code: string } & PublishSkillParams) {
		return fetch.post<PublishSkillResponse>(`/api/v1/skills/${code}/publish`, body)
	},

	/**
	 * Create an async skill publish task (returns quickly; poll checkSkillPublish for result).
	 * Request body matches the sync publish endpoint.
	 */
	publishSkillAsync({ code, ...body }: { code: string } & PublishSkillParams) {
		return fetch.post<AsyncPublishTaskResponse>(`/api/v1/skills/${code}/publish/async`, body)
	},

	/**
	 * Poll async skill publish task status by publish_task_id.
	 */
	checkSkillPublish({ code, publish_task_id }: { code: string } & CheckSkillPublishParams) {
		return fetch.get<AsyncPublishTaskResponse>(`/api/v1/skills/${code}/publish/check`, {
			params: { publish_task_id },
		})
	},

	/**
	 * Get publish prefill data for creating a new skill version.
	 * @param code Skill unique code
	 */
	getSkillPublishPrefill({ code }: { code: string }) {
		return fetch.get<PublishSkillPrefillResponse>(`/api/v1/skills/${code}/publish/prefill`)
	},

	/**
	 * Soft-delete a user skill (all source types supported).
	 * Updates deleted_at; version records in magic_skill_versions are kept.
	 * Validates that the skill belongs to the current organization.
	 * @param code Skill unique code (magic_skills.code)
	 */
	deleteSkill({ code }: { code: string }) {
		return fetch.delete<[]>(`/api/v1/skills/${code}`)
	},

	/**
	 * Update basic display info for a user skill (name, description, logo).
	 * Only allowed for non-MARKET skills; returns error 40018 for MARKET skills.
	 * Partial updates are supported; omitted fields are left unchanged.
	 * @param code Skill unique code (magic_skills.code)
	 * @param params Fields to update
	 */
	updateSkillInfo({ code, ...params }: { code: string } & UpdateSkillInfoParams) {
		return fetch.put<[]>(`/api/v1/skills/${code}/info`, params)
	},

	/**
	 * Upgrade a MARKET skill to the latest published version.
	 * Only allowed for skills with source_type='MARKET'.
	 * Copies metadata from the latest store version; no new skill_version is created.
	 * @param code Skill unique code (magic_skills.code)
	 */
	upgradeSkill({ code }: { code: string }) {
		return fetch.put<[]>(`/api/v1/skills/${code}/upgrade`, {})
	},
})
