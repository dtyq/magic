import type { HttpClient } from "@/apis/core/HttpClient"
import { genRequestUrl } from "@/utils/http"

import { SupportLocales } from "@/constants/locale"

// ======================== Types ========================

/** Publisher type for store skills */
export type SkillPublisherType = "USER" | "OFFICIAL" | "VERIFIED_CREATOR" | "PARTNER"

/** Source type for user skills */
export type SkillSourceType = "LOCAL_UPLOAD" | "STORE" | "GITHUB"

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
	name_i18n: SkillI18nText
	description_i18n: SkillI18nText
	logo: string
	publisher_type: SkillPublisherType
	publisher: SkillPublisher
	publish_status: SkillPublishStatus
	/** Whether current user has added this skill */
	is_added: boolean
	/** Whether the skill needs upgrade (valid when is_added=true and source_type='STORE') */
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
	name_i18n: SkillI18nText
	description_i18n: SkillI18nText
	logo: string
	source_type: SkillSourceType
	/** 0=disabled, 1=enabled */
	is_enabled: 0 | 1
	/** Pin time; null means not pinned */
	pinned_at: string | null
	need_upgrade: boolean
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
}

export type ImportSkillResponse = { id: string; skill_code: string }

// ======================== Skill Detail ========================

/** Response data for single skill detail */
export interface SkillDetailResponse {
	id: number
	code: string
	/** Version ID from magic_skill_versions */
	version_id: number
	/** Version string from magic_skill_versions */
	version_code: string
	source_type: SkillSourceType
	/** 0=disabled, 1=enabled */
	is_enabled: 0 | 1
	pinned_at: string | null
	name_i18n: SkillI18nText
	description_i18n: SkillI18nText
	logo: string
	package_name: string
	package_description: string
	file_key: string
	source_id: number | null
	source_meta: Record<string, unknown> | null
	created_at: string
	updated_at: string
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
	 * Returns need_upgrade=true for STORE skills with newer versions available.
	 * @param params Query parameters
	 */
	getSkills(params: GetSkillsParams = {}) {
		return fetch.post<GetSkillsResponse>(genRequestUrl("/api/v1/skills/queries"), params)
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
	 * Only allowed for non-STORE skills; returns error 40018 for STORE skills.
	 * Partial updates are supported; omitted fields are left unchanged.
	 * @param code Skill unique code (magic_skills.code)
	 * @param params Fields to update
	 */
	updateSkillInfo({ code, ...params }: { code: string } & UpdateSkillInfoParams) {
		return fetch.put<[]>(genRequestUrl("/api/v1/skills/${code}/info", { code }), params)
	},

	/**
	 * Upgrade a STORE skill to the latest published version.
	 * Only allowed for skills with source_type='STORE'.
	 * Copies metadata from the latest store version; no new skill_version is created.
	 * @param code Skill unique code (magic_skills.code)
	 */
	upgradeSkill({ code }: { code: string }) {
		return fetch.put<[]>(genRequestUrl("/api/v1/skills/${code}/upgrade", { code }), {})
	},
})
