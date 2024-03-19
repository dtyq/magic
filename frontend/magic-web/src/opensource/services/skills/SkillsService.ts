import dayjs from "dayjs"
import i18n from "i18next"
import { SkillsApi } from "@/opensource/apis"
import type {
	GetSkillsParams,
	GetStoreSkillsParams,
	ImportSkillParams,
	ImportSkillResponse,
	ParseSkillResponse,
	SkillDetailResponse,
	SkillI18nText,
	SkillSourceType,
	StoreSkillItem,
	SkillItem,
	UpdateSkillInfoParams,
} from "@/opensource/apis/modules/skills"

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
	name: string
	description: string
	thumbnail?: string
	status: "added" | "not-added"
	authorType: "official" | "user"
	authorName?: string
	needUpgrade: boolean
	updatedAt: string
}

export interface UserSkillView {
	id: string
	userSkillId: string
	skillCode: string
	name: string
	description: string
	thumbnail?: string
	/** Raw i18n fields for update/import operations */
	nameI18n: SkillI18nText
	descriptionI18n: SkillI18nText
	logo: string
	sourceType: SkillSourceType
	needUpgrade: boolean
	updatedAt: string
	createdAt: string
}

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

	async getUserSkills(params: GetSkillsParams = {}): Promise<PagedSkills<UserSkillView>> {
		const data = await SkillsApi.getSkills(params)
		return {
			list: data.list.map((item) => this.mapUserSkill(item)),
			page: data.page,
			pageSize: data.page_size,
			total: data.total,
		}
	}

	async getUserSkillIdMapByCodes(skillCodes: string[]): Promise<Map<string, string>> {
		const idMap = new Map<string, string>()
		const pendingCodes = new Set(skillCodes.filter(Boolean))
		if (!pendingCodes.size) return idMap

		let page = 1
		const pageSize = 100

		while (pendingCodes.size) {
			const data = await SkillsApi.getSkills({ page, page_size: pageSize })
			for (const item of data.list) {
				if (!pendingCodes.has(item.code)) continue
				idMap.set(item.code, item.id)
				pendingCodes.delete(item.code)
			}

			const loadedCount = page * data.page_size
			const hasNextPage = loadedCount < data.total && data.list.length > 0
			if (!hasNextPage) break
			page += 1
		}

		return idMap
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

	async updateSkillInfo(code: string, params: UpdateSkillInfoParams): Promise<void> {
		await SkillsApi.updateSkillInfo({ code, ...params })
	}

	private mapStoreSkill(item: StoreSkillItem): StoreSkillView {
		const isOfficialPublisher = item.publisher_type === "OFFICIAL"
		return {
			id: String(item.id),
			storeSkillId: item.id,
			skillCode: item.skill_code,
			userSkillCode: item.user_skill_code,
			name: this.mapI18nText(item.name_i18n),
			description: this.mapI18nText(item.description_i18n),
			thumbnail: item.logo || undefined,
			status: item.is_added ? "added" : "not-added",
			authorType: isOfficialPublisher ? "official" : "user",
			authorName: isOfficialPublisher ? undefined : item.publisher?.name,
			needUpgrade: item.need_upgrade,
			updatedAt: this.formatDateTime(item.updated_at),
		}
	}

	private mapUserSkill(item: SkillItem): UserSkillView {
		return {
			id: String(item.id),
			userSkillId: item.id,
			skillCode: item.code,
			name: this.mapI18nText(item.name_i18n),
			description: this.mapI18nText(item.description_i18n),
			thumbnail: item.logo || undefined,
			nameI18n: item.name_i18n,
			descriptionI18n: item.description_i18n,
			logo: item.logo,
			sourceType: item.source_type,
			needUpgrade: item.need_upgrade,
			updatedAt: this.formatDateTime(item.updated_at),
			createdAt: item.created_at,
		}
	}

	private mapI18nText(text: SkillI18nText | Record<string, string> | null | undefined) {
		if (!text) return ""
		const i18nMap = text as Record<string, string>
		const language = i18n.language?.toLowerCase() ?? "en"
		const preferredKeys = language.startsWith("zh")
			? ["zh_CN", "zh", "en_US", "en"]
			: ["en_US", "en", "zh_CN", "zh"]

		for (const key of preferredKeys) {
			const value = i18nMap[key]
			if (value) return value
		}

		const fallback = Object.values(i18nMap).find(Boolean)
		return fallback ?? ""
	}

	private formatDateTime(value: string) {
		const date = dayjs(value)
		if (!date.isValid()) return value
		return date.format("YYYY-MM-DD HH:mm")
	}
}

export const skillsService = new SkillsService()
