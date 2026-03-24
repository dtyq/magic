import { makeAutoObservable, runInAction } from "mobx"
import dayjs from "dayjs"
import i18n from "i18next"
import { SupportLocales } from "@/constants/locale"
import type { SkillDetailResponse, SkillI18nText } from "@/apis/modules/skills"
import { skillsService } from "@/services/skills/SkillsService"
import { SkillConversationStore } from "./conversation-store"
import type { SkillEditPublishStatus, SkillEditSkillInfo } from "./types"
import { ProjectFilesStore } from "@/stores/projectFiles"
import { AttachmentItem } from "../../../components/TopicFilesButton/hooks"
import { createMentionPanelStore } from "@/components/business/MentionPanel/store"

export class SkillEditRootStore {
	skill: SkillEditSkillInfo | null = null
	attachments: AttachmentItem[] = []
	readonly conversation: SkillConversationStore = new SkillConversationStore()

	projectFilesStore: ProjectFilesStore = new ProjectFilesStore()

	mentionPanelStore: ReturnType<typeof createMentionPanelStore> = createMentionPanelStore(
		this.projectFilesStore,
	)

	currentSkillCode: string | null = null
	selectedAttachmentId: string | null = null
	expandedFolderIds: string[] = []
	draftPrompt: string = ""
	loading = false
	error: string | null = null

	constructor() {
		makeAutoObservable(this, { conversation: false }, { autoBind: true })
	}

	get project() {
		return this.conversation.selectedProject
	}

	isFolderExpanded(id: string) {
		return this.expandedFolderIds.includes(id)
	}

	toggleFolder(id: string) {
		if (this.isFolderExpanded(id)) {
			this.expandedFolderIds = this.expandedFolderIds.filter((folderId) => folderId !== id)
			return
		}

		this.expandedFolderIds = [...this.expandedFolderIds, id]
	}

	selectAttachment(id: string) {
		this.selectedAttachmentId = id
	}

	setDraftPrompt(value: string) {
		this.draftPrompt = value
	}

	async initFromSkillCode(code: string) {
		if (!code) return
		if (this.loading && this.currentSkillCode === code) return

		this.currentSkillCode = code
		this.loading = true
		this.error = null
		this.conversation.reset()

		try {
			const detail = await skillsService.getSkillDetail(code)
			const projectId = resolveSkillProjectId(detail)

			runInAction(() => {
				this.hydrateSkillDetail(detail)
			})

			if (projectId) {
				await this.conversation.loadProjectContext(projectId)
			}

			runInAction(() => {
				this.loading = false
			})
		} catch {
			runInAction(() => {
				this.loading = false
				this.error = "fetch-failed"
				this.conversation.reset()
			})
		}
	}

	async refreshSkillDetail() {
		if (!this.currentSkillCode) return

		try {
			const detail = await skillsService.getSkillDetail(this.currentSkillCode)

			runInAction(() => {
				this.error = null
				this.hydrateSkillDetail(detail)
			})
		} catch {
			runInAction(() => {
				this.error = "fetch-failed"
			})
		}
	}

	get selectedAttachment() {
		return (
			this.projectFilesStore.workspaceFileTree.find(
				(item) => item.file_id === this.selectedAttachmentId,
			) ?? null
		)
	}

	private hydrateSkillDetail(detail: SkillDetailResponse) {
		this.skill = {
			...this.skill,
			id: detail.id,
			code: detail.code,
			name: pickI18nText(detail.name_i18n, detail.package_name),
			nameI18n: normalizeSkillI18nText(detail.name_i18n, detail.package_name),
			description: pickI18nText(detail.description_i18n, detail.package_description ?? ""),
			logo: detail.logo,
			versionCode: detail.version_code ?? undefined,
			sourceType: detail.source_type,
			publishStatus: deriveSkillEditPublishStatus(detail),
			publishType: detail.publish_type ?? null,
			allowedPublishTargetTypes: detail.allowed_publish_target_types ?? [],
		}
	}

	setSkillName(name: string, nameI18n?: SkillI18nText) {
		if (!this.skill) return

		const nextNameI18n = nameI18n ?? setCurrentLocaleText(this.skill.nameI18n, name)

		this.skill = {
			...this.skill,
			name,
			nameI18n: nextNameI18n,
		}

		return nextNameI18n
	}
}

function normalizeSkillI18nText(
	value?: Record<string, string> | null,
	fallbackText = "",
): SkillI18nText {
	return {
		[SupportLocales.fallback]: value?.[SupportLocales.fallback] || fallbackText,
		[SupportLocales.enUS]: value?.[SupportLocales.enUS] || "",
		[SupportLocales.zhCN]: value?.[SupportLocales.zhCN] || "",
	}
}

function setCurrentLocaleText(text: SkillI18nText, value: string): SkillI18nText {
	const localeKey = getCurrentLocaleKey()

	return {
		...text,
		[localeKey]: value,
		[SupportLocales.fallback]: value,
	}
}

function getCurrentLocaleKey() {
	const language = i18n.language?.toLowerCase() ?? "en"
	return language.startsWith("zh") ? SupportLocales.zhCN : SupportLocales.enUS
}

function pickI18nText(
	text: SkillI18nText | Record<string, string> | null | undefined,
	fallback = "",
) {
	if (!text) return fallback

	const i18nMap = text as Record<string, string>
	const language = i18n.language?.toLowerCase() ?? "en"
	const preferredKeys = language.startsWith("zh")
		? ["zh_CN", "zh", "en_US", "en"]
		: ["en_US", "en", "zh_CN", "zh"]

	for (const key of preferredKeys) {
		const value = i18nMap[key]
		if (value) return value
	}

	return Object.values(i18nMap).find(Boolean) ?? fallback
}

function resolveSkillProjectId(detail: SkillDetailResponse) {
	return detail.project_id ?? undefined
}

function deriveSkillEditPublishStatus(detail: SkillDetailResponse): SkillEditPublishStatus {
	const latest = detail.latest_published_at
	if (!latest) return "draft"
	if (!detail.updated_at) return "published"
	return dayjs(detail.updated_at).isAfter(dayjs(latest)) ? "draft" : "published"
}
