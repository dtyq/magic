import dayjs from "@/infrastructure/vendors/dayjs"
import { SkillsApi } from "@/apis"
import { SupportLocales } from "@/constants/locale"
import type { CollaboratorPermission } from "@/pages/superMagic/types/collaboration"
import type {
	CreateSkillResponse,
	GetSkillMarketCategoriesParams,
	GetSkillVersionsParams,
	GetSkillLastVersionsParams,
	GetSkillsParams,
	GetStoreSkillsParams,
	ImportOfficialSkillParams,
	ImportOfficialSkillResponse,
	ImportSkillParams,
	ImportSkillResponse,
	ParseOfficialSkillResponse,
	ParseSkillResponse,
	AsyncPublishTaskResponse,
	PublishSkillParams,
	PublishSkillPrefillResponse,
	PublishSkillResponse,
	SkillDetailResponse,
	SkillMarketCategoryItem,
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
import { analyticsService } from "@/services/analytics"

export type { SkillDetailResponse }

export interface PagedSkills<T> {
	list: T[]
	page: number
	pageSize: number
	total: number
}

/** Paginated response for the public Skill market list. */
export interface StoreSkillsPage<T> {
	list: T[]
	page: number
	pageSize: number
}

export interface SkillMarketCategoryView {
	id: string
	name: string
	logo?: string
	sortOrder: number
	skillCount: number
}

export interface StoreSkillView {
	id: string
	storeSkillId: string
	userSkillCode?: string
	skillCode: string
	packageName?: string
	name: string
	description: string
	source?: string
	thumbnail?: string
	isFeatured: boolean
	installCount?: number
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
	projectId?: string | null
	userRole?: CollaboratorPermission
	skillCode: string
	packageName?: string
	name: string
	description: string
	source?: string
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
	categoryIds?: string[]
	isAdded?: boolean
	isCreator?: boolean
}

export type UserSkillsListScope = "created" | "team-shared" | "collaborated" | "market-installed"

export class SkillsService {
	/** The marketplace install API returns no identity, so retain the code from the loaded row. */
	private storeSkillCodes = new Map<string, string>()

	async getSkillMarketCategories(
		params: GetSkillMarketCategoriesParams = {},
	): Promise<SkillMarketCategoryView[]> {
		const data = await SkillsApi.getSkillMarketCategories(params)
		return data.list.map((item) => this.mapSkillMarketCategory(item))
	}

	async getStoreSkills(
		params: GetStoreSkillsParams = {},
	): Promise<StoreSkillsPage<StoreSkillView>> {
		const data = await SkillsApi.getStoreSkills(params)
		const list = data.list.map((item) => {
			const skillCode = item.code?.trim() || item.skill_code?.trim()
			if (skillCode) this.storeSkillCodes.set(String(item.id), skillCode)
			return this.mapStoreSkill(item)
		})
		return {
			list,
			page: data.page,
			pageSize: data.page_size,
		}
	}

	async getCreatedSkills(params: GetSkillsParams = {}): Promise<PagedSkills<UserSkillView>> {
		return this.getUserSkillsByScope("created", params)
	}

	async getTeamSharedSkills(params: GetSkillsParams = {}): Promise<PagedSkills<UserSkillView>> {
		return this.getUserSkillsByScope("team-shared", params)
	}

	async getCollaboratedSkills(params: GetSkillsParams = {}): Promise<PagedSkills<UserSkillView>> {
		return this.getUserSkillsByScope("collaborated", params)
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
		analyticsService.report("skill_create_attempted", { source_type: "empty" })
		// An empty Skill also provisions its project and default topic asynchronously.
		analyticsService.report("project_create_attempted", { sceneOverride: "skill" })
		const data = await SkillsApi.createSkill()
		const code = this.resolveCreatedSkillCode(data)
		if (!code) throw new Error("create-skill-missing-code")
		return {
			id: data.id,
			code,
		}
	}

	async addSkillFromStore(storeSkillId: string, knownSkillCode?: string) {
		analyticsService.report("skill_create_attempted", { source_type: "store" })
		const result = await SkillsApi.addSkillFromStore({ store_skill_id: storeSkillId })
		const skillCode =
			this.resolveSkillCodeFromUnknown(result) ??
			this.storeSkillCodes.get(String(storeSkillId)) ??
			knownSkillCode?.trim()
		void skillCode
		return result
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

	parseOfficialSkillFile(file_key: string): Promise<ParseOfficialSkillResponse> {
		return SkillsApi.parseOfficialSkillFile({ file_key })
	}

	async importSkill(params: ImportSkillParams): Promise<ImportSkillResponse> {
		analyticsService.report("skill_create_attempted", { source_type: "import" })
		const result = await SkillsApi.importSkill(params)
		return result
	}

	importOfficialSkill(params: ImportOfficialSkillParams): Promise<ImportOfficialSkillResponse> {
		return SkillsApi.importOfficialSkill(params)
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

	publishSkillAsync(code: string, params: PublishSkillParams): Promise<AsyncPublishTaskResponse> {
		return SkillsApi.publishSkillAsync({ code, ...params })
	}

	checkSkillPublish(code: string, publishTaskId: string): Promise<AsyncPublishTaskResponse> {
		return SkillsApi.checkSkillPublish({ code, publish_task_id: publishTaskId })
	}

	getSkillPublishPrefill(code: string): Promise<PublishSkillPrefillResponse> {
		return SkillsApi.getSkillPublishPrefill({ code })
	}

	async updateSkillInfo(code: string, params: UpdateSkillInfoParams): Promise<void> {
		await SkillsApi.updateSkillInfo({ code, ...params })
	}

	private mapStoreSkill(item: StoreSkillItem): StoreSkillView {
		const name =
			item.name?.trim() || item.package_name?.trim() || item.code || item.skill_code || ""
		const description = item.description?.trim() || ""

		return {
			id: String(item.id),
			storeSkillId: item.id,
			skillCode: item.code || item.skill_code || item.package_name || String(item.id),
			packageName: item.package_name?.trim() || undefined,
			userSkillCode: item.user_skill_code,
			name,
			description,
			source: item.source?.trim() || undefined,
			thumbnail: item.logo || undefined,
			isFeatured: Boolean(item.is_featured),
			installCount: typeof item.install_count === "number" ? item.install_count : undefined,
			latestVersion: item.latest_version || undefined,
			status: item.is_added ? "added" : "not-added",
			authorName: item.publisher?.name,
			publisherType: item.publisher_type,
			needUpgrade: item.need_upgrade,
			updatedAt: this.formatDateTime(item.updated_at),
		}
	}

	private mapSkillMarketCategory(item: SkillMarketCategoryItem): SkillMarketCategoryView {
		return {
			id: String(item.id),
			name: item.name,
			logo: item.logo || undefined,
			sortOrder: item.sort_order,
			skillCount: item.skill_count,
		}
	}

	private mapUserSkill(item: SkillItem): UserSkillView {
		const name = item.name?.trim() || item.package_name?.trim() || item.code
		const description = item.description?.trim() || ""

		return {
			id: String(item.id),
			userSkillId: item.id,
			projectId: item.project_id,
			userRole: item.user_role,
			skillCode: item.code,
			packageName: item.package_name?.trim() || undefined,
			name,
			description,
			source: item.source?.trim() || undefined,
			thumbnail: item.logo || undefined,
			// Keep edit/import flows supplied with a stable i18n shape while list cards
			// render the locale-resolved fields above. The API may remove these raw
			// fields after the migration, so the resolved value seeds missing entries.
			nameI18n: this.ensureSkillI18nText(undefined, name),
			descriptionI18n: this.ensureSkillI18nText(undefined, description),
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
		const name = item.name?.trim() || item.package_name?.trim() || item.code
		const description = item.description?.trim() || ""

		return {
			id: item.code,
			userSkillId: item.code,
			skillCode: item.code,
			packageName: item.package_name?.trim() || undefined,
			name,
			description,
			source: item.source?.trim() || undefined,
			thumbnail: item.logo || undefined,
			// Preserve the edit payload contract without using raw i18n values for
			// display; direct fields are the source of truth for this response.
			nameI18n: this.ensureSkillI18nText(item.name_i18n, name),
			descriptionI18n: this.ensureSkillI18nText(item.description_i18n, description),
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
			name: detail.name?.trim() || detail.package_name || detail.code,
			description: detail.description?.trim() || detail.package_description || "",
			logo: detail.logo,
			packageName: detail.package_name?.trim() || undefined,
			versionCode: detail.version_code?.trim() || undefined,
			updatedAt: detail.updated_at,
			sourceLabel: detail.source?.trim() || undefined,
			skillFileUrl: detail.skill_file_url?.trim() || undefined,
			isFeatured: Boolean(detail.is_featured),
		}
	}

	private mapMarketSkillDetail(detail: SkillMarketDetailResponse): SkillDetailView {
		const publisherName = detail.publisher?.name?.trim()

		return {
			code: detail.code,
			name: detail.name?.trim() || detail.package_name || detail.code,
			description: detail.description?.trim() || "",
			logo: detail.logo,
			packageName: detail.package_name?.trim() || undefined,
			versionCode: detail.version_code?.trim() || undefined,
			updatedAt: detail.version_created_at,
			sourceLabel: detail.source?.trim() || undefined,
			publisherType: detail.publisher_type,
			publisherName: publisherName || undefined,
			skillFileUrl: detail.skill_file_url?.trim() || undefined,
			isFeatured: Boolean(detail.is_featured),
			categoryIds: detail.category_ids ?? [],
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
				return SkillsApi.getUserSkills({ ...params, scope: "created" })
			case "team-shared":
				return SkillsApi.getUserSkills({ ...params, scope: "team_shared" })
			case "collaborated":
				return SkillsApi.getUserSkills({ ...params, scope: "collaborated" })
			case "market-installed":
				return SkillsApi.getUserSkills({ ...params, scope: "market_installed" })
		}
	}

	/**
	 * Retains the legacy edit payload shape after display fields become locale-resolved strings.
	 * Raw i18n values are compatibility data only and must not drive list/detail presentation.
	 */
	private ensureSkillI18nText(
		text: SkillI18nText | Record<string, string> | null | undefined,
		fallback: string,
	): SkillI18nText {
		return {
			[SupportLocales.fallback]: text?.[SupportLocales.fallback] || fallback,
			[SupportLocales.enUS]: text?.[SupportLocales.enUS] || fallback,
			[SupportLocales.zhCN]: text?.[SupportLocales.zhCN] || fallback,
		}
	}

	private formatDateTime(value: string) {
		const date = dayjs(value)
		if (!date.isValid()) return value
		return date.format("YYYY-MM-DD HH:mm")
	}

	private resolveCreatedSkillCode(data: CreateSkillResponse | null | undefined) {
		if (!data) return ""
		return data.code?.trim() || data.skill_code?.trim() || ""
	}

	/** Market install may return an object or a one-item list; never treat store id as skill_code. */
	private resolveSkillCodeFromUnknown(result: unknown): string | undefined {
		if (!result) return undefined
		if (Array.isArray(result)) {
			return this.resolveSkillCodeFromUnknown(result[0])
		}
		if (typeof result === "object") {
			const value = result as { skill_code?: string; code?: string }
			return value.skill_code?.trim() || value.code?.trim() || undefined
		}
		return undefined
	}
}

export const skillsService = new SkillsService()
