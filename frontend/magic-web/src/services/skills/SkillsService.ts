import dayjs from "dayjs"
import i18n from "i18next"
import { SkillsApi } from "@/apis"
import type { CollaboratorPermission } from "@/pages/superMagic/types/collaboration"
import { resolveLocalizedText } from "@/utils/locale"
import type {
	CreateSkillResponse,
	GetSkillVersionsParams,
	GetSkillLastVersionsParams,
	GetSkillsParams,
	GetStoreSkillsParams,
	ImportSkillParams,
	ImportSkillResponse,
	ParseSkillResponse,
	PublishSkillParams,
	PublishSkillPrefillResponse,
	PublishSkillResponse,
	SkillDetailResponse,
	SkillMarketDetailResponse,
	SkillI18nText,
	SkillItem,
	SkillLastVersionItem,
	SkillPublisherType,
	SkillSourceType,
	SkillVersionItem,
	StoreSkillItem,
	UpdateSkillInfoParams,
} from "@/apis/modules/skills"

export type { SkillDetailResponse }

export interface PagedSkills<T> {
	list: T[]
	page: number
	pageSize: number
	total: number
}

export interface StoreSkillView {
	id: string
	storeSkillId: string
	userSkillCode?: string
	skillCode: string
	packageName?: string
	name: string
	description: string
	thumbnail?: string
	isFeatured: boolean
	latestVersion?: string
	status: "added" | "not-added"
	authorName?: string
	publisherType?: SkillPublisherType
	needUpgrade: boolean
	updatedAt: string
}

export interface UserSkillView {
	id: string
	userSkillId: string
	userRole?: CollaboratorPermission
	skillCode: string
	packageName?: string
	name: string
	description: string
	thumbnail?: string
	/** Raw i18n fields for update/import operations */
	nameI18n: SkillI18nText
	descriptionI18n: SkillI18nText
	logo: string
	sourceType: SkillSourceType
	creatorName?: string
	creatorAvatar?: string
	publisherType?: SkillPublisherType
	publisherName?: string
	latestVersion?: string
	latestPublishedAt?: string | null
	needUpgrade: boolean
	updatedAt: string
	createdAt: string
}

export interface SkillDetailView {
	code: string
	name: string
	description: string
	logo: string
	packageName?: string
	versionCode?: string
	updatedAt?: string | null
	sourceLabel?: string | null
	publisherType?: SkillPublisherType | null
	publisherName?: string | null
	skillFileUrl?: string | null
	isFeatured: boolean
	isAdded?: boolean
	isCreator?: boolean
}

export type UserSkillsListScope = "created" | "team-shared" | "market-installed"

export class SkillsService {
	async getStoreSkills(params: GetStoreSkillsParams = {}): Promise<PagedSkills<StoreSkillView>> {
		const data = await SkillsApi.getStoreSkills(params)
		return {
			list: data.list.map((item) => this.mapStoreSkill(item)),
			page: data.page,
			pageSize: data.page_size,
			total: data.total,
		}
	}

	async getCreatedSkills(params: GetSkillsParams = {}): Promise<PagedSkills<UserSkillView>> {
		return this.getUserSkillsByScope("created", params)
	}

	async getTeamSharedSkills(params: GetSkillsParams = {}): Promise<PagedSkills<UserSkillView>> {
		return this.getUserSkillsByScope("team-shared", params)
	}

	async getMarketInstalledSkills(
		params: GetSkillsParams = {},
	): Promise<PagedSkills<UserSkillView>> {
		return this.getUserSkillsByScope("market-installed", params)
	}

	async getLatestPublishedSkills(
		params: GetSkillLastVersionsParams = {},
	): Promise<PagedSkills<UserSkillView>> {
		const data = await SkillsApi.getSkillLastVersions(params)
		return {
			list: data.list.map((item) => this.mapLatestPublishedSkill(item)),
			page: data.page,
			pageSize: data.page_size,
			total: data.total,
		}
	}

	async createEmptySkill(): Promise<{ id?: string; code: string }> {
		const data = await SkillsApi.createSkill()
		const code = this.resolveCreatedSkillCode(data)
		if (!code) throw new Error("create-skill-missing-code")
		return {
			id: data.id,
			code,
		}
	}

	addSkillFromStore(storeSkillId: string) {
		return SkillsApi.addSkillFromStore({ store_skill_id: storeSkillId })
	}

	deleteSkill(code: string) {
		return SkillsApi.deleteSkill({ code })
	}

	upgradeSkill(code: string) {
		return SkillsApi.upgradeSkill({ code })
	}

	parseSkillFile(file_key: string): Promise<ParseSkillResponse> {
		return SkillsApi.parseSkillFile({ file_key })
	}

	importSkill(params: ImportSkillParams): Promise<ImportSkillResponse> {
		return SkillsApi.importSkill(params)
	}

	getSkillDetail(code: string): Promise<SkillDetailResponse> {
		return SkillsApi.getSkillDetail({ code })
	}

	getSkillMarketDetail(code: string): Promise<SkillMarketDetailResponse> {
		return SkillsApi.getSkillMarketDetail({ code })
	}

	async getUserSkillDetailView(code: string): Promise<SkillDetailView> {
		const detail = await this.getSkillDetail(code)
		return this.mapUserSkillDetail(detail)
	}

	async getMarketSkillDetailView(code: string): Promise<SkillDetailView> {
		const detail = await this.getSkillMarketDetail(code)
		return this.mapMarketSkillDetail(detail)
	}

	getSkillVersions(
		code: string,
		params: GetSkillVersionsParams = {},
	): Promise<{ list: SkillVersionItem[]; page: number; pageSize: number; total: number }> {
		return SkillsApi.getSkillVersions({ code, ...params }).then((data) => ({
			list: data.list,
			page: data.page,
			pageSize: data.page_size,
			total: data.total,
		}))
	}

	publishSkill(code: string, params: PublishSkillParams): Promise<PublishSkillResponse> {
		return SkillsApi.publishSkill({ code, ...params })
	}

	getSkillPublishPrefill(code: string): Promise<PublishSkillPrefillResponse> {
		return SkillsApi.getSkillPublishPrefill({ code })
	}

	async updateSkillInfo(code: string, params: UpdateSkillInfoParams): Promise<void> {
		await SkillsApi.updateSkillInfo({ code, ...params })
	}

	private mapStoreSkill(item: StoreSkillItem): StoreSkillView {
		return {
			id: String(item.id),
			storeSkillId: item.id,
			skillCode: item.skill_code,
			packageName: item.package_name?.trim() || undefined,
			userSkillCode: item.user_skill_code,
			name: this.mapI18nText(item.name_i18n),
			description: this.mapI18nText(item.description_i18n),
			thumbnail: item.logo || undefined,
			isFeatured: Boolean(item.is_featured),
			latestVersion: item.latest_version || undefined,
			status: item.is_added ? "added" : "not-added",
			authorName: item.publisher?.name,
			publisherType: item.publisher_type,
			needUpgrade: item.need_upgrade,
			updatedAt: this.formatDateTime(item.updated_at),
		}
	}

	private mapUserSkill(item: SkillItem): UserSkillView {
		return {
			id: String(item.id),
			userSkillId: item.id,
			userRole: item.user_role,
			skillCode: item.code,
			packageName: item.package_name?.trim() || undefined,
			name: item.name || this.mapI18nText(item.name_i18n),
			description: item.description || this.mapI18nText(item.description_i18n),
			thumbnail: item.logo || undefined,
			nameI18n: item.name_i18n,
			descriptionI18n: item.description_i18n,
			logo: item.logo,
			sourceType: item.source_type,
			creatorName: item.creator_info?.name,
			creatorAvatar: item.creator_info?.avatar,
			publisherType: item.publisher_type,
			publisherName: item.publisher?.name?.trim() || undefined,
			latestVersion: item.latest_version || undefined,
			latestPublishedAt: item.latest_published_at ?? null,
			needUpgrade: Boolean(item.need_upgrade),
			updatedAt: this.formatDateTime(item.updated_at),
			createdAt: item.created_at,
		}
	}

	private mapLatestPublishedSkill(item: SkillLastVersionItem): UserSkillView {
		return {
			id: item.code,
			userSkillId: item.code,
			skillCode: item.code,
			packageName: item.package_name?.trim() || undefined,
			name: item.name || this.mapI18nText(item.name_i18n),
			description: item.description || this.mapI18nText(item.description_i18n),
			thumbnail: item.logo || undefined,
			nameI18n: item.name_i18n,
			descriptionI18n: item.description_i18n,
			logo: item.logo,
			sourceType: item.source_type,
			latestVersion: item.version || undefined,
			latestPublishedAt: item.published_at,
			needUpgrade: false,
			updatedAt: this.formatDateTime(item.updated_at),
			createdAt: item.created_at,
		}
	}

	private mapUserSkillDetail(detail: SkillDetailResponse): SkillDetailView {
		return {
			code: detail.code,
			name: this.mapI18nText(detail.name_i18n) || detail.package_name || detail.code,
			description:
				this.mapI18nText(detail.description_i18n) || detail.package_description || "",
			logo: detail.logo,
			packageName: detail.package_name?.trim() || undefined,
			versionCode: detail.version_code?.trim() || undefined,
			updatedAt: detail.updated_at,
			sourceLabel: this.mapI18nText(detail.source_i18n) || undefined,
			skillFileUrl: detail.skill_file_url?.trim() || undefined,
			isFeatured: Boolean(detail.is_featured),
		}
	}

	private mapMarketSkillDetail(detail: SkillMarketDetailResponse): SkillDetailView {
		const publisherName = detail.publisher?.name?.trim()

		return {
			code: detail.code,
			name:
				detail.name ||
				this.mapI18nText(detail.name_i18n) ||
				detail.package_name ||
				detail.code,
			description: detail.description || this.mapI18nText(detail.description_i18n) || "",
			logo: detail.logo,
			packageName: detail.package_name?.trim() || undefined,
			versionCode: detail.version_code?.trim() || undefined,
			updatedAt: detail.version_created_at,
			sourceLabel: detail.source || this.mapI18nText(detail.source_i18n) || undefined,
			publisherType: detail.publisher_type,
			publisherName: publisherName || undefined,
			skillFileUrl: detail.skill_file_url?.trim() || undefined,
			isFeatured: Boolean(detail.is_featured),
			isAdded: detail.is_added,
			isCreator: detail.is_creator,
		}
	}

	private async getUserSkillsByScope(
		scope: UserSkillsListScope,
		params: GetSkillsParams = {},
	): Promise<PagedSkills<UserSkillView>> {
		const data = await this.fetchUserSkillsByScope(scope, params)
		return {
			list: data.list.map((item) => this.mapUserSkill(item)),
			page: data.page,
			pageSize: data.page_size,
			total: data.total,
		}
	}

	private fetchUserSkillsByScope(scope: UserSkillsListScope, params: GetSkillsParams = {}) {
		switch (scope) {
			case "created":
				return SkillsApi.getCreatedSkills(params)
			case "team-shared":
				return SkillsApi.getTeamSharedSkills(params)
			case "market-installed":
				return SkillsApi.getMarketInstalledSkills(params)
		}
	}

	private mapI18nText(text: SkillI18nText | Record<string, string> | null | undefined) {
		return resolveLocalizedText(text as Record<string, string>, i18n.language)
	}

	private formatDateTime(value: string) {
		const date = dayjs(value)
		if (!date.isValid()) return value
		return date.format("YYYY-MM-DD HH:mm")
	}

	private resolveCreatedSkillCode(data: CreateSkillResponse | null | undefined) {
		if (!data) return ""
		return data.code || data.skill_code || ""
	}
}

export const skillsService = new SkillsService()
