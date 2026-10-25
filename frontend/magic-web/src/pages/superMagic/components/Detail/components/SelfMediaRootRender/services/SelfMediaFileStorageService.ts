import { SuperMagicApi } from "@/apis"
import { superMagicUploadTokenService } from "@/pages/superMagic/components/MessageEditor/services/UploadTokenService"
import { createFileApi, type FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import type { ScheduledTask } from "@/types/scheduledTask"
import { Upload } from "@dtyq/upload-sdk"
import type { SelfMediaPlatform } from "../../../types"
import { hasMeaningfulSelfMediaDraftData } from "../components/SelfMediaInitPanel/types"
import type {
	SelfMediaInitData,
	ArticleDetail,
	OutlineNode,
	BrandImageItem,
	SelfMediaInitGlobalSettings,
	MaterialItem,
} from "../components/SelfMediaInitPanel/types"
import type { SelfMediaPostMeta, SelfMediaPostPublishStatus } from "../types"
import {
	removeSelfMediaPostFromIndex,
	renameSelfMediaPostInIndex,
	setSelfMediaPostPublishStatusInIndex,
} from "./selfMediaMagicProjectIndex"
import type { SelfMediaHomeDailyInsightPayload } from "./selfMediaHomeInsight"
import type { SelfMediaOpsHealthInsightPayload } from "./selfMediaOpsHealthInsight"
import { normalizePostOpsMetricsPayload } from "./selfMediaOpsMetricsNormalize"

// ─── Constants ─────────────────────────────────────────────────────────────────

const DRAFTS_DIR = "__drafts"
const BRAND_CONFIG_DIR = "__brand"
const BRAND_CONFIG_JSON = "brand-config.json"
const BRAND_CONFIG_IMAGES_DIR = "brand-images"
const DRAFT_JSON = "draft.json"
const REFERENCE_INDEX_JSON = "reference-index.json"
const DRAFT_MATERIALS_DIR = "draft-materials"
const BRAND_IMAGES_DIR = "brand-images"
const ARCHIVE_DIR = "archive"
const ARCHIVE_MANIFEST_JSON = "manifest.json"
const TEMPLATES_DIR = "templates"
const TEMPLATES_MATERIALS_DIR = "templates-materials"

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DraftPayload {
	version: number
	currentStep: number
	createdAt: string
	updatedAt: string
	global?: SerializedGlobalSettings
	articles: SerializedArticle[]
}

export interface BrandConfigPayload extends SerializedGlobalSettings {
	version: number
	createdAt: string
	updatedAt: string
}

export interface TemplatePayload {
	version: number
	id: string
	name: string
	createdAt: string
	updatedAt: string
	global: SerializedGlobalSettings
	articles: SerializedArticle[]
}

export interface DraftArchiveManifest {
	version: number
	archiveId: string
	createdAt: string
	currentStep: number
	articleCount: number
	titles: string[]
}

export interface TemplateMeta {
	id: string
	name: string
	createdAt: string
	author: string
	articleCount: number
	titles: string[]
}

export type SelfMediaPostOpsMetricValue =
	| string
	| number
	| null
	| {
			value?: string | number | null
			label?: string
			source?: string | null
			note?: string
	  }

export interface SelfMediaPostOpsMetricsHistoryItem {
	fetchedAt: string
	metrics: Record<string, SelfMediaPostOpsMetricValue>
	derivedMetrics?: Record<string, SelfMediaPostOpsMetricValue>
	source?: SelfMediaPostOpsMetricsPayload["source"]
	note?: string
}

export interface SelfMediaPostOpsSourceHistoryItem {
	fetchedAt: string
	publishedUrl?: string
	fetchStatus?: SelfMediaPostOpsSourcePayload["fetchStatus"]
	lastFetchedAt?: string
	failureReason?: string
	note?: string
}

export interface SelfMediaPostOpsCommentsHistoryItem {
	fetchedAt: string
	summary?: string
	comments?: SelfMediaPostOpsCommentItem[]
	insights?: string[]
	source?: SelfMediaPostOpsCommentsPayload["source"]
}

export interface SelfMediaPostOpsMetricsPayload {
	version: number
	updatedAt: string
	source: "real-platform" | "user" | "reference" | "generated" | "mixed"
	metrics: Record<string, SelfMediaPostOpsMetricValue>
	derivedMetrics?: Record<string, SelfMediaPostOpsMetricValue>
	notes?: string
	history?: SelfMediaPostOpsMetricsHistoryItem[]
}

export interface SelfMediaPostOpsSourcePayload {
	version: number
	updatedAt: string
	platform: string
	publishedUrl: string
	fetchStatus?: "pending" | "fetched" | "failed"
	lastFetchedAt?: string
	failureReason?: string
	notes?: string
	autoSync?: {
		enabled: boolean
		taskId?: string
		timeConfig?: ScheduledTask.TimeConfig
		updatedAt?: string
		lastError?: string
	}
	history?: SelfMediaPostOpsSourceHistoryItem[]
}

export interface SelfMediaPostOpsCommentItem {
	id: string
	author?: string
	text: string
	sentiment?: "positive" | "neutral" | "negative" | "question"
	intent?: string
	time?: string
}

export interface SelfMediaPostOpsCommentsPayload {
	version: number
	updatedAt: string
	source: "real-platform" | "user" | "reference" | "generated" | "mixed"
	summary?: string
	comments: SelfMediaPostOpsCommentItem[]
	insights?: string[]
	history?: SelfMediaPostOpsCommentsHistoryItem[]
}

export interface SelfMediaPostOpsReviewPayload {
	content: string
}

export interface DeleteSelfMediaPostParams {
	platform: SelfMediaPlatform
	id: string
	entry: string
}

export interface RenameSelfMediaPostParams extends DeleteSelfMediaPostParams {
	name: string
}

export interface SetSelfMediaPostPublishStatusParams extends DeleteSelfMediaPostParams {
	publishStatus?: SelfMediaPostPublishStatus
}

interface SerializedReferenceFile {
	name: string
	content: string
	kind?: "text" | "data-url"
	file_id?: string
	file_path?: string
}

interface SerializedArticle {
	title: string
	folderName: string
	style: string
	visualPreset?: string
	cardCount: number
	outline: SerializedOutlineNode[]
	materials: SerializedMaterial[]
	notes: string
	platform?: string
	description?: string
	descriptionJson?: Record<string, unknown>
	visualReferenceFiles?: SerializedReferenceFile[]
	visualDescriptionJson?: Record<string, unknown>
}

interface SerializedOutlineNode {
	id: string
	text: string
	children?: SerializedOutlineNode[]
	materials?: SerializedMaterial[]
}

interface SerializedMaterial {
	id: string
	name: string
	description: string
	relativePath: string
}

interface SerializedBrandImage {
	id: string
	name: string
	description: string
	relativePath: string
	isImage: boolean
}

interface SerializedGlobalSettings {
	author: string
	brandPosition: string
	targetAudience: string
	brandImages: SerializedBrandImage[]
}

interface ReferenceIndexPayload {
	version: number
	createdAt: string
	updatedAt: string
	items: ReferenceIndexItem[]
}

type ReferenceIndexRole = "brand" | "article-material" | "outline-material" | "visual-reference"

interface ReferenceIndexItem {
	id: string
	role: ReferenceIndexRole
	name: string
	description?: string
	articleIndex?: number
	outlineNodeId?: string
	relativePath?: string
	kind?: "file" | "text" | "data-url"
	file_id?: string
	file_path?: string
	content?: string
}

interface FileNode {
	file_id?: string
	file_name?: string
	relative_file_path?: string
	is_directory?: boolean
	parent_id?: string | null
	children?: FileNode[]
	[key: string]: unknown
}

// ─── Service ───────────────────────────────────────────────────────────────────

/**
 * 自媒体文件存储服务。
 * 将草稿和模板以文件形式存储在项目的 __drafts/ 目录中。
 */
export class SelfMediaFileStorageService {
	private readonly fileApi: FileApi
	private projectId: string
	private parentFileId: string | undefined
	private folderRelativePath: string | undefined
	private dirCache = new Map<string, string>() // path -> file_id
	private dirInflight = new Map<string, Promise<string>>() // path -> in-flight promise
	private fileInflight = new Map<string, Promise<string | null>>() // parentId:fileName -> in-flight promise
	private brandConfigSaving: Promise<void> | null = null

	// ─── Project file list cache (dedup concurrent calls) ────────────────
	private fileListCache: FileNode[] | null = null
	private fileListCacheTime = 0
	private fileListInflight: Promise<FileNode[]> | null = null
	private static FILE_LIST_CACHE_TTL = 3000 // 3s TTL

	constructor(
		projectId: string,
		parentFileId?: string,
		folderRelativePath?: string,
		fileApi: FileApi = createFileApi(),
	) {
		this.projectId = projectId
		this.fileApi = fileApi
		this.parentFileId = parentFileId
		this.folderRelativePath = folderRelativePath
			? folderRelativePath.replace(/^\/+/, "").replace(/\/+$/, "")
			: undefined
	}

	// ─── Draft Operations ────────────────────────────────────────────────────

	async saveBrandConfig(global: SelfMediaInitGlobalSettings): Promise<void> {
		// Serialize concurrent saves to avoid duplicate file/folder creation
		if (this.brandConfigSaving) {
			await this.brandConfigSaving.catch(() => undefined)
		}
		const doSave = async () => {
			const now = new Date().toISOString()
			await this.ensureBrandImagesUploaded(global.brandImages, "brand", true)
			const payload = await this.buildBrandConfigPayload(global, now)
			const brandConfigDir = await this.ensureDirectory(BRAND_CONFIG_DIR)
			const brandConfigFileId = await this.createAndWriteFile(
				brandConfigDir,
				BRAND_CONFIG_JSON,
				JSON.stringify(payload, null, 2),
			)
			if (!brandConfigFileId) {
				throw new Error("Failed to save brand config")
			}
		}
		this.brandConfigSaving = doSave()
		try {
			await this.brandConfigSaving
		} finally {
			this.brandConfigSaving = null
		}
	}

	async loadBrandConfig(): Promise<SelfMediaInitGlobalSettings | null> {
		try {
			const files = await this.getProjectFileList()
			const file = this.findBrandConfigFile(files)
			if (!file?.file_id) return null

			const content = (await this.fileApi.getFileContentById(file.file_id, {
				responseType: "text",
			})) as string
			const payload: BrandConfigPayload = JSON.parse(content)

			return this.deserializeGlobal(payload)
		} catch {
			return null
		}
	}

	async updatePostTitle(postEntryPath: string, nextTitle: string): Promise<void> {
		const title = nextTitle.trim()
		if (!title) {
			throw new Error("postTitleEmpty")
		}
		await this.updatePostMeta(postEntryPath, { title })
	}

	async updatePostMeta(
		postEntryPath: string,
		patch: Pick<SelfMediaPostMeta, "title" | "subtitle" | "tags">,
	): Promise<void> {
		if (patch.title !== undefined && !patch.title.trim()) {
			throw new Error("postTitleEmpty")
		}
		const files = await this.getProjectFileList()
		const file = this.findFileByProjectRelativePath(files, postEntryPath)
		if (!file?.file_id) {
			throw new Error("postManifestMissing")
		}

		const content = (await this.fileApi.getFileContentById(file.file_id, {
			responseType: "text",
		})) as string
		await SuperMagicApi.saveFileContent([
			{
				file_id: file.file_id,
				content: updatePostManifestMetaContent(content, patch),
			},
		])
		this.invalidateFileListCache()
	}

	async renamePost(target: RenameSelfMediaPostParams): Promise<void> {
		const title = target.name.trim()
		if (!title) {
			throw new Error("postTitleEmpty")
		}
		const files = await this.getProjectFileList()
		const postFile = this.findFileByProjectRelativePath(files, target.entry)
		if (!postFile?.file_id) {
			throw new Error("postManifestMissing")
		}
		const magicProjectFile = this.findFileByProjectRelativePath(files, "magic.project.js")
		if (!magicProjectFile?.file_id) {
			throw new Error("magicProjectNotFound")
		}

		const [postContent, magicProjectContent] = await Promise.all([
			this.fileApi.getFileContentById(postFile.file_id, {
				responseType: "text",
			}) as Promise<string>,
			this.fileApi.getFileContentById(magicProjectFile.file_id, {
				responseType: "text",
			}) as Promise<string>,
		])
		const updatedPostContent = updatePostManifestTitleContent(postContent, title)
		const updatedIndexContent = renameSelfMediaPostInIndex(magicProjectContent, {
			platform: target.platform,
			id: target.id,
			entry: target.entry,
			name: title,
		})

		await SuperMagicApi.saveFileContent([
			{
				file_id: postFile.file_id,
				content: updatedPostContent,
			},
			{
				file_id: magicProjectFile.file_id,
				content: updatedIndexContent,
				enable_shadow: true,
			},
		])
		this.invalidateFileListCache()
	}

	async setPostPublishStatus(target: SetSelfMediaPostPublishStatusParams): Promise<void> {
		const files = await this.getProjectFileList()
		const postFile = this.findFileByProjectRelativePath(files, target.entry)
		if (!postFile?.file_id) {
			throw new Error("postManifestMissing")
		}
		const magicProjectFile = this.findFileByProjectRelativePath(files, "magic.project.js")
		if (!magicProjectFile?.file_id) {
			throw new Error("magicProjectNotFound")
		}

		const [postContent, magicProjectContent] = await Promise.all([
			this.fileApi.getFileContentById(postFile.file_id, {
				responseType: "text",
			}) as Promise<string>,
			this.fileApi.getFileContentById(magicProjectFile.file_id, {
				responseType: "text",
			}) as Promise<string>,
		])
		const updatedPostContent = updatePostManifestPublishStatusContent(
			postContent,
			target.publishStatus,
		)
		const updatedIndexContent = setSelfMediaPostPublishStatusInIndex(magicProjectContent, {
			platform: target.platform,
			id: target.id,
			entry: target.entry,
			publishStatus: target.publishStatus,
		})

		await SuperMagicApi.saveFileContent([
			{
				file_id: postFile.file_id,
				content: updatedPostContent,
			},
			{
				file_id: magicProjectFile.file_id,
				content: updatedIndexContent,
				enable_shadow: true,
			},
		])
		this.invalidateFileListCache()
	}

	async deletePost(target: DeleteSelfMediaPostParams): Promise<void> {
		const files = await this.getProjectFileList()
		const magicProjectFile = this.findFileByProjectRelativePath(files, "magic.project.js")
		if (!magicProjectFile?.file_id) {
			throw new Error("magicProjectNotFound")
		}

		const postDirectoryPath = this.getPostDirectoryPath(target.entry)
		const postDirectory = this.findDirectoryInProjectFiles(files, postDirectoryPath)
		if (!postDirectory?.file_id) {
			throw new Error("postDirectoryMissing")
		}

		const content = (await this.fileApi.getFileContentById(magicProjectFile.file_id, {
			responseType: "text",
		})) as string
		const updatedContent = removeSelfMediaPostFromIndex(content, target)

		await SuperMagicApi.saveFileContent([
			{
				file_id: magicProjectFile.file_id,
				content: updatedContent,
				enable_shadow: true,
			},
		])
		await SuperMagicApi.deleteFile(postDirectory.file_id)
		this.invalidateFileListCache()
	}

	async savePostOpsMetrics(
		postEntryPath: string,
		payload: SelfMediaPostOpsMetricsPayload,
	): Promise<void> {
		const existing = payload.history ? null : await this.loadPostOpsMetrics(postEntryPath)
		await this.savePostOpsJsonFile(postEntryPath, "metrics.json", {
			...payload,
			history:
				payload.history ??
				appendPostOpsMetricsHistory(existing, {
					fetchedAt: payload.updatedAt,
					metrics: payload.metrics,
					derivedMetrics: payload.derivedMetrics,
					source: payload.source,
					note: payload.notes,
				}),
		})
	}

	async loadPostOpsMetrics(
		postEntryPath: string,
	): Promise<SelfMediaPostOpsMetricsPayload | null> {
		try {
			const metricsPath = `${this.getPostOpsPath(postEntryPath)}/metrics.json`
			let files = await this.getProjectFileList()
			let file = this.findFileByProjectRelativePath(files, metricsPath)
			if (!file?.file_id) {
				this.invalidateFileListCache()
				files = await this.getProjectFileList()
				file = this.findFileByProjectRelativePath(files, metricsPath)
			}
			if (!file?.file_id) return null

			const content = (await this.fileApi.getFileContentById(file.file_id, {
				responseType: "text",
			})) as string
			return normalizePostOpsMetricsPayload(JSON.parse(content))
		} catch {
			return null
		}
	}

	async savePostOpsSource(
		postEntryPath: string,
		payload: SelfMediaPostOpsSourcePayload,
	): Promise<void> {
		const existing = payload.history ? null : await this.loadPostOpsSource(postEntryPath)
		await this.savePostOpsJsonFile(postEntryPath, "source.json", {
			...payload,
			history:
				payload.history ??
				appendPostOpsSourceHistory(existing, {
					fetchedAt: payload.updatedAt,
					publishedUrl: payload.publishedUrl,
					fetchStatus: payload.fetchStatus,
					lastFetchedAt: payload.lastFetchedAt,
					failureReason: payload.failureReason,
					note: payload.notes,
				}),
		})
	}

	async loadPostOpsSource(postEntryPath: string): Promise<SelfMediaPostOpsSourcePayload | null> {
		try {
			const content = await this.loadPostOpsFileContent(postEntryPath, "source.json")
			if (!content) return null
			return JSON.parse(content) as SelfMediaPostOpsSourcePayload
		} catch {
			return null
		}
	}

	async savePostOpsComments(
		postEntryPath: string,
		payload: SelfMediaPostOpsCommentsPayload,
	): Promise<void> {
		const existing = payload.history ? null : await this.loadPostOpsComments(postEntryPath)
		await this.savePostOpsJsonFile(postEntryPath, "comments.json", {
			...payload,
			history:
				payload.history ??
				appendPostOpsCommentsHistory(existing, {
					fetchedAt: payload.updatedAt,
					summary: payload.summary,
					comments: payload.comments,
					insights: payload.insights,
					source: payload.source,
				}),
		})
	}

	async loadPostOpsComments(
		postEntryPath: string,
	): Promise<SelfMediaPostOpsCommentsPayload | null> {
		try {
			const content = await this.loadPostOpsFileContent(postEntryPath, "comments.json")
			if (!content) return null
			return JSON.parse(content) as SelfMediaPostOpsCommentsPayload
		} catch {
			return null
		}
	}

	async savePostOpsReview(
		postEntryPath: string,
		payload: SelfMediaPostOpsReviewPayload,
	): Promise<void> {
		const opsDir = await this.ensureDirectory(this.getPostOpsPath(postEntryPath))
		await this.createAndWriteFile(opsDir, "review.md", payload.content)
	}

	async loadPostOpsReview(postEntryPath: string): Promise<SelfMediaPostOpsReviewPayload | null> {
		try {
			const content = await this.loadPostOpsFileContent(postEntryPath, "review.md")
			if (content === null) return null
			return { content }
		} catch {
			return null
		}
	}

	async savePostOpsReviewHtml(
		postEntryPath: string,
		payload: SelfMediaPostOpsReviewPayload,
	): Promise<void> {
		const opsDir = await this.ensureDirectory(this.getPostOpsPath(postEntryPath))
		await this.createAndWriteFile(opsDir, "review.html", payload.content)
	}

	async loadPostOpsReviewHtml(
		postEntryPath: string,
	): Promise<SelfMediaPostOpsReviewPayload | null> {
		try {
			const content = await this.loadPostOpsFileContent(postEntryPath, "review.html")
			if (content === null) return null
			return { content }
		} catch {
			return null
		}
	}

	async saveHomeDailyInsight(payload: SelfMediaHomeDailyInsightPayload): Promise<void> {
		await this.saveProjectOpsJsonFile("home-daily-insight.json", payload)
	}

	async loadHomeDailyInsight(): Promise<SelfMediaHomeDailyInsightPayload | null> {
		try {
			const content = await this.loadProjectOpsFileContent("home-daily-insight.json")
			if (!content) return null
			return JSON.parse(content) as SelfMediaHomeDailyInsightPayload
		} catch {
			return null
		}
	}

	async saveOpsHealthInsight(payload: SelfMediaOpsHealthInsightPayload): Promise<void> {
		await this.saveProjectOpsJsonFile("ops-health-insight.json", payload)
	}

	async loadOpsHealthInsight(): Promise<SelfMediaOpsHealthInsightPayload | null> {
		try {
			const content = await this.loadProjectOpsFileContent("ops-health-insight.json")
			if (!content) return null
			return JSON.parse(content) as SelfMediaOpsHealthInsightPayload
		} catch {
			return null
		}
	}

	/** Persist draft to project files */
	async saveDraft(data: SelfMediaInitData, currentStep: number): Promise<void> {
		if (!hasMeaningfulSelfMediaDraftData(data)) {
			return
		}
		await this.persistDraft(data, currentStep)
	}

	/** Archive the current draft snapshot before clearing the active slot. */
	async archiveDraft(data: SelfMediaInitData, currentStep: number): Promise<string | null> {
		try {
			const now = new Date().toISOString()
			const archiveId = `arc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

			await this.ensureBrandImagesUploaded(data.global.brandImages)
			await this.ensureDraftMaterialsUploaded(data.articles)

			const archiveSnapshot = this.buildArchiveSnapshotData(data, archiveId)
			const payload = await this.buildDraftPayload(archiveSnapshot, currentStep, now)
			const referenceIndex = this.buildReferenceIndexPayload(archiveSnapshot, now)
			const archiveDir = await this.ensureDirectory(
				`${this.getBasePath()}/${ARCHIVE_DIR}/${archiveId}`,
			)
			if (!archiveDir) return null

			const manifestFileId = await this.createAndWriteFile(
				archiveDir,
				ARCHIVE_MANIFEST_JSON,
				JSON.stringify(
					{
						version: 1,
						archiveId,
						createdAt: now,
						currentStep,
						articleCount: data.articles.length,
						titles: data.articles.map((item) => item.title).filter(Boolean),
					} satisfies DraftArchiveManifest,
					null,
					2,
				),
			)
			const archiveDraftFileId = await this.createAndWriteFile(
				archiveDir,
				DRAFT_JSON,
				JSON.stringify(payload, null, 2),
			)
			const archiveReferenceIndexFileId = await this.createAndWriteFile(
				archiveDir,
				REFERENCE_INDEX_JSON,
				JSON.stringify(referenceIndex, null, 2),
			)
			if (!manifestFileId || !archiveDraftFileId || !archiveReferenceIndexFileId) {
				return null
			}

			const materialsArchived = await this.archiveDraftMaterials(archiveDir)
			if (!materialsArchived) return null
			await this.clearDraft({ removeMaterials: false })
			return archiveId
		} catch {
			return null
		}
	}

	/**
	 * Load draft from project files
	 */
	async loadDraft(): Promise<{ data: SelfMediaInitData; currentStep: number } | null> {
		try {
			const files = await this.getProjectFileList()
			const draftFile = this.findDraftFile(files)
			if (!draftFile?.file_id) {
				return null
			}

			const content = (await this.fileApi.getFileContentById(draftFile.file_id, {
				responseType: "text",
			})) as string

			const payload: DraftPayload = JSON.parse(content)
			const data = this.deserializePayload(payload)
			if (!hasMeaningfulSelfMediaDraftData(data)) {
				return null
			}
			return {
				data,
				currentStep: payload.currentStep,
			}
		} catch {
			return null
		}
	}

	/**
	 * Clear draft files
	 */
	async clearDraft(options?: { removeMaterials?: boolean }): Promise<void> {
		try {
			const files = await this.getProjectFileList()
			const draftJsonPath = this.getDraftJsonRelativePath()
			const referenceIndexPath = this.getReferenceIndexRelativePath()
			const draftFiles = files.filter((f) => {
				if (f.is_directory || !f.relative_file_path) return false
				const normalized = this.normalizeRelativePath(f.relative_file_path)
				return normalized === draftJsonPath || normalized === referenceIndexPath
			})
			for (const f of draftFiles) {
				if (f.file_id) {
					await SuperMagicApi.deleteFile(f.file_id).catch(() => {})
				}
			}

			if (options?.removeMaterials === false) return

			const materialsDirPath = this.folderRelativePath
				? this.normalizeRelativePath(
						`${this.folderRelativePath}/${DRAFTS_DIR}/${DRAFT_MATERIALS_DIR}`,
					)
				: this.normalizeRelativePath(`${DRAFTS_DIR}/${DRAFT_MATERIALS_DIR}`)
			const materialsDir = files.find(
				(f) =>
					f.is_directory &&
					f.relative_file_path &&
					this.normalizeRelativePath(f.relative_file_path) === materialsDirPath,
			)
			if (materialsDir?.file_id) {
				await SuperMagicApi.deleteFile(materialsDir.file_id).catch(() => {})
			}
		} catch {
			// silent
		}
	}

	// ─── Template Operations ─────────────────────────────────────────────────

	/**
	 * Save current data as a named template
	 */
	async saveTemplate(data: SelfMediaInitData, name: string): Promise<string> {
		const id = `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
		const now = new Date().toISOString()

		await this.ensureBrandImagesUploaded(data.global.brandImages)

		const payload: TemplatePayload = {
			version: 1,
			id,
			name,
			createdAt: now,
			updatedAt: now,
			global: this.serializeGlobal(data.global),
			articles: this.serializeArticles(data.articles),
		}

		const templatesDir = await this.ensureDirectory(`${this.getBasePath()}/${TEMPLATES_DIR}`)

		// Write JSON
		const jsonFileId = await this.createAndWriteFile(
			templatesDir,
			`${id}.json`,
			JSON.stringify(payload, null, 2),
		)

		// Upload materials for template
		await this.uploadTemplateMaterials(data.articles, id)

		return id
	}

	/**
	 * List available templates
	 */
	async listTemplates(): Promise<TemplateMeta[]> {
		try {
			const files = await this.getProjectFileList()
			const templatesPath = `${this.getBasePath()}/${TEMPLATES_DIR}`

			const jsonFiles = files.filter(
				(f) =>
					!f.is_directory &&
					f.relative_file_path?.startsWith(templatesPath) &&
					f.relative_file_path?.endsWith(".json"),
			)

			const results: TemplateMeta[] = []
			for (const file of jsonFiles) {
				try {
					const content = (await this.fileApi.getFileContentById(file.file_id!, {
						responseType: "text",
					})) as string
					const payload: TemplatePayload = JSON.parse(content)
					results.push({
						id: payload.id,
						name: payload.name,
						createdAt: payload.createdAt,
						author: payload.global.author,
						articleCount: payload.articles.length,
						titles: payload.articles.map((a) => a.title).filter(Boolean),
					})
				} catch {
					// skip corrupted template
				}
			}

			return results.sort(
				(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			)
		} catch {
			return []
		}
	}

	/**
	 * Load a specific template by ID
	 */
	async loadTemplate(templateId: string): Promise<SelfMediaInitData | null> {
		try {
			const files = await this.getProjectFileList()
			const jsonPath = `${this.getBasePath()}/${TEMPLATES_DIR}/${templateId}.json`
			const file = files.find((f) => !f.is_directory && f.relative_file_path === jsonPath)
			if (!file?.file_id) return null

			const content = (await this.fileApi.getFileContentById(file.file_id, {
				responseType: "text",
			})) as string
			const payload: TemplatePayload = JSON.parse(content)
			return this.deserializePayload(payload)
		} catch {
			return null
		}
	}

	/**
	 * Delete a template by ID
	 */
	async deleteTemplate(templateId: string): Promise<void> {
		try {
			const files = await this.getProjectFileList()
			const basePath = `${this.getBasePath()}/${TEMPLATES_DIR}`

			// Delete .json and .md files
			const toDelete = files.filter(
				(f) =>
					!f.is_directory &&
					f.relative_file_path?.startsWith(basePath) &&
					(f.relative_file_path === `${basePath}/${templateId}.json` ||
						f.relative_file_path === `${basePath}/${templateId}.md`),
			)
			for (const f of toDelete) {
				if (f.file_id) {
					await SuperMagicApi.deleteFile(f.file_id).catch(() => {})
				}
			}

			// Delete template materials directory
			const matDir = files.find(
				(f) =>
					f.is_directory &&
					f.relative_file_path ===
						`${this.getBasePath()}/${TEMPLATES_MATERIALS_DIR}/${templateId}`,
			)
			if (matDir?.file_id) {
				await SuperMagicApi.deleteFile(matDir.file_id).catch(() => {})
			}
		} catch {
			// silent
		}
	}

	// ─── Material Upload ─────────────────────────────────────────────────────

	/**
	 * Upload a brand image to __drafts/brand-images/
	 * Returns the project-relative path for draft.json.
	 */
	async uploadBrandImageToDraft(
		file: File,
		onProgress?: (percent: number) => void,
	): Promise<string | null> {
		try {
			const brandDir = `${this.getBasePath()}/${BRAND_IMAGES_DIR}`
			const parentDirId = await this.ensureDirectory(brandDir)
			if (!parentDirId) return null

			const credentials = await superMagicUploadTokenService.getUploadToken(this.projectId)
			if (!credentials) return null

			const uploader = new Upload()
			onProgress?.(0)

			const fileKey = await new Promise<string>((resolve, reject) => {
				const { success, fail, progress } = uploader.upload({
					file,
					fileName: file.name,
					customCredentials: superMagicUploadTokenService.changeDir(
						credentials,
						brandDir,
					),
					body: JSON.stringify({
						storage: "private",
						sts: true,
						content_type: file.type || "application/octet-stream",
					}),
				})

				progress?.((percent?: number) => {
					if (typeof percent === "number") onProgress?.(percent)
				})
				success?.((res: any) => resolve(res?.data?.path || res?.key || res?.file_key || ""))
				fail?.((err: any) => reject(err))
			})

			if (fileKey) {
				const relativePath = this.toProjectRelativePath(`${brandDir}/${file.name}`)
				await superMagicUploadTokenService.saveFileToProject({
					project_id: this.projectId,
					parent_id: parentDirId,
					file_key: fileKey,
					file_name: file.name,
					file_size: file.size,
					file_type: "user_upload",
					storage_type: "workspace",
					source: "home" as any,
					relative_file_path: relativePath,
				})
				return relativePath
			}
			return null
		} catch {
			return null
		}
	}

	async uploadBrandImageToBrandConfig(
		file: File,
		onProgress?: (percent: number) => void,
	): Promise<string | null> {
		try {
			const brandDir = `${BRAND_CONFIG_DIR}/${BRAND_CONFIG_IMAGES_DIR}`
			const parentDirId = await this.ensureDirectory(brandDir)
			if (!parentDirId) return null

			const credentials = await superMagicUploadTokenService.getUploadToken(this.projectId)
			if (!credentials) return null

			const uploader = new Upload()
			onProgress?.(0)

			const fileKey = await new Promise<string>((resolve, reject) => {
				const { success, fail, progress } = uploader.upload({
					file,
					fileName: file.name,
					customCredentials: superMagicUploadTokenService.changeDir(
						credentials,
						brandDir,
					),
					body: JSON.stringify({
						storage: "private",
						sts: true,
						content_type: file.type || "application/octet-stream",
					}),
				})

				progress?.((percent?: number) => {
					if (typeof percent === "number") onProgress?.(percent)
				})
				success?.((res: any) => resolve(res?.data?.path || res?.key || res?.file_key || ""))
				fail?.((err: any) => reject(err))
			})

			if (!fileKey) return null

			const relativePath = this.toProjectRelativePath(`${brandDir}/${file.name}`)
			await superMagicUploadTokenService.saveFileToProject({
				project_id: this.projectId,
				parent_id: parentDirId,
				file_key: fileKey,
				file_name: file.name,
				file_size: file.size,
				file_type: "user_upload",
				storage_type: "workspace",
				source: "home" as any,
				relative_file_path: relativePath,
			})
			return relativePath
		} catch {
			return null
		}
	}

	/**
	 * Upload a material file to draft-materials/{articleIndex}/
	 * Returns the relative path for reference.
	 */
	async uploadMaterialToDraft(articleIndex: number, file: File): Promise<string | null> {
		try {
			const materialDir = `${this.getBasePath()}/${DRAFT_MATERIALS_DIR}/${articleIndex}`
			const parentDirId = await this.ensureDirectory(materialDir)
			if (!parentDirId) return null

			const credentials = await superMagicUploadTokenService.getUploadToken(this.projectId)
			if (!credentials) return null

			const uploader = new Upload()

			const fileKey = await new Promise<string>((resolve, reject) => {
				const { success, fail } = uploader.upload({
					file,
					fileName: file.name,
					customCredentials: superMagicUploadTokenService.changeDir(
						credentials,
						materialDir,
					),
					body: JSON.stringify({
						storage: "private",
						sts: true,
						content_type: file.type || "application/octet-stream",
					}),
				})

				success?.((res: any) => resolve(res?.data?.path || res?.key || res?.file_key || ""))
				fail?.((err: any) => reject(err))
			})

			if (fileKey) {
				const relativePath = this.toProjectRelativePath(`${materialDir}/${file.name}`)
				await superMagicUploadTokenService.saveFileToProject({
					project_id: this.projectId,
					parent_id: parentDirId,
					file_key: fileKey,
					file_name: file.name,
					file_size: file.size,
					file_type: "user_upload",
					storage_type: "workspace",
					source: "home" as any,
					relative_file_path: relativePath,
				})
				return relativePath
			}
			return null
		} catch {
			return null
		}
	}

	// ─── Cleanup ─────────────────────────────────────────────────────────────

	dispose(): void {}

	// ─── Private Helpers ─────────────────────────────────────────────────────

	private normalizeRelativePath(path: string): string {
		return path.replace(/^\/+/, "").replace(/\/+$/, "")
	}

	/** Path relative to self-media folder → full path in project file tree. */
	private toProjectRelativePath(pathFromSelfMediaFolder: string): string {
		const normalized = this.normalizeRelativePath(pathFromSelfMediaFolder)
		if (this.folderRelativePath) {
			return this.normalizeRelativePath(`${this.folderRelativePath}/${normalized}`)
		}
		return normalized
	}

	private getProjectRelativePathCandidates(pathFromSelfMediaFolder: string): string[] {
		const normalized = this.normalizeRelativePath(pathFromSelfMediaFolder)
		const projected = this.toProjectRelativePath(normalized)
		return Array.from(new Set([projected, normalized]))
	}

	private findDirectoryInProjectFiles(
		files: FileNode[],
		pathFromSelfMediaFolder: string,
	): FileNode | undefined {
		const targets = this.getProjectRelativePathCandidates(pathFromSelfMediaFolder)
		return files.find(
			(f) =>
				f.is_directory &&
				f.relative_file_path &&
				targets.includes(this.normalizeRelativePath(f.relative_file_path)),
		)
	}

	private findFileByProjectRelativePath(
		files: FileNode[],
		pathFromSelfMediaFolder: string,
	): FileNode | undefined {
		const targets = this.getProjectRelativePathCandidates(pathFromSelfMediaFolder)
		return files.find(
			(f) =>
				!f.is_directory &&
				f.relative_file_path &&
				targets.includes(this.normalizeRelativePath(f.relative_file_path)),
		)
	}

	private async savePostOpsJsonFile(
		postEntryPath: string,
		fileName: string,
		payload: unknown,
	): Promise<void> {
		const opsDir = await this.ensureDirectory(this.getPostOpsPath(postEntryPath))
		await this.createAndWriteFile(opsDir, fileName, JSON.stringify(payload, null, 2))
	}

	private async saveProjectOpsJsonFile(fileName: string, payload: unknown): Promise<void> {
		const opsDir = await this.ensureDirectory("ops")
		await this.createAndWriteFile(opsDir, fileName, JSON.stringify(payload, null, 2))
	}

	private async loadPostOpsFileContent(
		postEntryPath: string,
		fileName: string,
	): Promise<string | null> {
		const files = await this.getProjectFileList()
		const file = this.findFileByProjectRelativePath(
			files,
			`${this.getPostOpsPath(postEntryPath)}/${fileName}`,
		)
		if (!file?.file_id) return null

		return (await this.fileApi.getFileContentById(file.file_id, {
			responseType: "text",
		})) as string
	}

	private async loadProjectOpsFileContent(fileName: string): Promise<string | null> {
		const files = await this.getProjectFileList()
		const file = this.findFileByProjectRelativePath(files, `ops/${fileName}`)
		if (!file?.file_id) return null

		return (await this.fileApi.getFileContentById(file.file_id, {
			responseType: "text",
		})) as string
	}

	private getPostOpsPath(postEntryPath: string): string {
		const normalized = this.normalizeRelativePath(postEntryPath)
		return normalized.replace(/\/?post\.json$/, "/ops")
	}

	private getPostDirectoryPath(postEntryPath: string): string {
		const normalized = this.normalizeRelativePath(postEntryPath)
		return normalized.replace(/\/?post\.json$/, "")
	}

	/** Path segment under parentFileId for ensureDirectory (not project-root relative). */
	private getBasePath(): string {
		return DRAFTS_DIR
	}

	/** Full project-relative path for draft.json lookup in attachment/file list. */
	private getDraftJsonRelativePath(): string {
		if (this.folderRelativePath) {
			return this.normalizeRelativePath(
				`${this.folderRelativePath}/${DRAFTS_DIR}/${DRAFT_JSON}`,
			)
		}
		return this.normalizeRelativePath(`${DRAFTS_DIR}/${DRAFT_JSON}`)
	}

	private getReferenceIndexRelativePath(): string {
		if (this.folderRelativePath) {
			return this.normalizeRelativePath(
				`${this.folderRelativePath}/${DRAFTS_DIR}/${REFERENCE_INDEX_JSON}`,
			)
		}
		return this.normalizeRelativePath(`${DRAFTS_DIR}/${REFERENCE_INDEX_JSON}`)
	}

	private getBrandConfigRelativePath(): string {
		if (this.folderRelativePath) {
			return this.normalizeRelativePath(
				`${this.folderRelativePath}/${BRAND_CONFIG_DIR}/${BRAND_CONFIG_JSON}`,
			)
		}
		return this.normalizeRelativePath(`${BRAND_CONFIG_DIR}/${BRAND_CONFIG_JSON}`)
	}

	private findDraftFile(files: FileNode[]): FileNode | undefined {
		const target = this.getDraftJsonRelativePath()
		const exact = files.find(
			(f) =>
				!f.is_directory &&
				f.relative_file_path &&
				this.normalizeRelativePath(f.relative_file_path) === target,
		)
		if (exact) return exact

		const suffix = `/${DRAFTS_DIR}/${DRAFT_JSON}`
		const candidates = files.filter(
			(f) => !f.is_directory && f.relative_file_path?.endsWith(suffix),
		)
		if (candidates.length === 0) return undefined
		if (!this.folderRelativePath) return candidates[0]

		const folderPrefix = this.folderRelativePath
		return (
			candidates.find((f) =>
				this.normalizeRelativePath(f.relative_file_path!).startsWith(`${folderPrefix}/`),
			) ?? candidates[0]
		)
	}

	private findBrandConfigFile(files: FileNode[]): FileNode | undefined {
		const target = this.getBrandConfigRelativePath()
		return files.find(
			(f) =>
				!f.is_directory &&
				f.relative_file_path &&
				this.normalizeRelativePath(f.relative_file_path) === target,
		)
	}

	private async persistDraft(data: SelfMediaInitData, currentStep: number): Promise<void> {
		const now = new Date().toISOString()

		await this.ensureBrandImagesUploaded(data.global.brandImages)
		await this.ensureDraftMaterialsUploaded(data.articles)

		const payload = await this.buildDraftPayload(data, currentStep, now)
		const referenceIndex = this.buildReferenceIndexPayload(data, now)

		const draftsDir = await this.ensureDirectory(this.getBasePath())

		// Write draft.json
		await this.createAndWriteFile(draftsDir, DRAFT_JSON, JSON.stringify(payload, null, 2))

		await this.createAndWriteFile(
			draftsDir,
			REFERENCE_INDEX_JSON,
			JSON.stringify(referenceIndex, null, 2),
		)
	}

	private async ensureDirectory(path: string): Promise<string> {
		// Check cache first
		const cached = this.dirCache.get(path)
		if (cached) return cached

		// Deduplicate concurrent calls for the same path
		const inflight = this.dirInflight.get(path)
		if (inflight) return inflight

		const doCreate = async (): Promise<string> => {
			// Split path and create each level
			const parts = path.split("/").filter(Boolean)
			let currentParentId = this.parentFileId
			let currentPath = ""

			for (const part of parts) {
				currentPath = currentPath ? `${currentPath}/${part}` : part
				const cachedPart = this.dirCache.get(currentPath)
				if (cachedPart) {
					currentParentId = cachedPart
					continue
				}

				// Check if another (different) path's inflight covers this sub-path
				if (currentPath !== path) {
					const partInflight = this.dirInflight.get(currentPath)
					if (partInflight) {
						currentParentId = await partInflight
						continue
					}
				}

				const response = await SuperMagicApi.createFile({
					project_id: this.projectId,
					parent_id: currentParentId,
					file_name: part,
					is_directory: true,
					ignore_duplicate: true,
				})

				const fileId = (response as any)?.file_id
				if (fileId) {
					this.dirCache.set(currentPath, fileId)
					currentParentId = fileId
				} else {
					// Directory might already exist — try to find it in file list
					const files = await this.getProjectFileList()
					const existing = this.findDirectoryInProjectFiles(files, currentPath)
					if (existing?.file_id) {
						this.dirCache.set(currentPath, existing.file_id)
						currentParentId = existing.file_id
					} else {
						throw new Error(`Failed to resolve directory: ${currentPath}`)
					}
				}
			}

			if (!currentParentId) {
				throw new Error(`Failed to resolve directory: ${path}`)
			}
			return currentParentId
		}

		const promise = doCreate()
		this.dirInflight.set(path, promise)
		try {
			return await promise
		} finally {
			this.dirInflight.delete(path)
		}
	}

	private async createAndWriteFile(
		parentDirId: string,
		fileName: string,
		content: string,
	): Promise<string | null> {
		// Deduplicate concurrent writes to the same file
		const inflightKey = `${parentDirId}:${fileName}`
		const inflight = this.fileInflight.get(inflightKey)
		if (inflight) {
			// Wait for the previous write, then write again with new content
			await inflight.catch(() => {})
		}

		const doWrite = async (): Promise<string | null> => {
			try {
				// Try to find existing file first
				const files = await this.getProjectFileList()
				const basePath = this.getBasePath()

				// Determine the full path based on parentDirId
				let fullPath = ""
				if (parentDirId) {
					const parentDir = files.find((f) => f.is_directory && f.file_id === parentDirId)
					fullPath = parentDir?.relative_file_path
						? `${parentDir.relative_file_path}/${fileName}`
						: `${basePath}/${fileName}`
				}

				// Check if file already exists
				let fileId: string | undefined
				if (fullPath) {
					const existing = files.find(
						(f) => !f.is_directory && f.relative_file_path === fullPath,
					)
					fileId = existing?.file_id
				}

				// Create file if not exists
				if (!fileId) {
					const response = await SuperMagicApi.createFile({
						project_id: this.projectId,
						parent_id: parentDirId,
						file_name: fileName,
						is_directory: false,
						ignore_duplicate: true,
					})
					fileId = (response as any)?.file_id
					this.invalidateFileListCache()
				}

				if (!fileId) return null

				// Write content
				await SuperMagicApi.saveFileContent([{ file_id: fileId, content }])
				return fileId
			} catch {
				return null
			}
		}

		const promise = doWrite()
		this.fileInflight.set(inflightKey, promise)
		try {
			return await promise
		} finally {
			this.fileInflight.delete(inflightKey)
		}
	}

	private async getProjectFileList(): Promise<FileNode[]> {
		const now = Date.now()
		// Return cached result if still fresh
		if (
			this.fileListCache &&
			now - this.fileListCacheTime < SelfMediaFileStorageService.FILE_LIST_CACHE_TTL
		) {
			return this.fileListCache
		}
		// Dedup concurrent in-flight requests
		if (this.fileListInflight) {
			return this.fileListInflight
		}
		this.fileListInflight = (async () => {
			try {
				const response = await SuperMagicApi.getAttachmentsByProjectId({
					projectId: this.projectId,
					temporaryToken: "",
				})
				const list = ((response as any)?.list || []) as FileNode[]
				this.fileListCache = list
				this.fileListCacheTime = Date.now()
				return list
			} catch {
				return []
			} finally {
				this.fileListInflight = null
			}
		})()
		return this.fileListInflight
	}

	/** Invalidate the file list cache (e.g. after writes) */
	invalidateFileListCache(): void {
		this.fileListCache = null
		this.fileListCacheTime = 0
	}

	private async uploadTemplateMaterials(
		articles: ArticleDetail[],
		templateId: string,
	): Promise<void> {
		for (let i = 0; i < articles.length; i++) {
			const article = articles[i]
			if (!article.materials || article.materials.length === 0) continue

			const materialDir = `${this.getBasePath()}/${TEMPLATES_MATERIALS_DIR}/${templateId}/${i}`
			await this.ensureDirectory(materialDir)

			const credentials = await superMagicUploadTokenService.getUploadToken(this.projectId)
			if (!credentials) continue

			for (const item of article.materials) {
				try {
					const uploader = new Upload()

					const fileKey = await new Promise<string>((resolve, reject) => {
						const { success, fail } = uploader.upload({
							file: item.file,
							fileName: item.file.name,
							customCredentials: superMagicUploadTokenService.changeDir(
								credentials,
								materialDir,
							),
							body: JSON.stringify({
								storage: "private",
								sts: true,
								content_type: item.file.type || "application/octet-stream",
							}),
						})

						success?.((res: any) =>
							resolve(res?.data?.path || res?.key || res?.file_key || ""),
						)
						fail?.((err: any) => reject(err))
					})

					if (fileKey) {
						await superMagicUploadTokenService.saveFileToProject({
							project_id: this.projectId,
							file_key: fileKey,
							file_name: item.file.name,
							file_size: item.file.size,
							file_type: "user_upload",
							storage_type: "workspace",
							source: "home" as any,
							relative_file_path: `${materialDir}/${item.file.name}`,
						})
					}
				} catch {
					// skip individual material failures
				}
			}
		}
	}

	private async ensureDraftMaterialsUploaded(articles: ArticleDetail[]): Promise<void> {
		for (let articleIndex = 0; articleIndex < articles.length; articleIndex += 1) {
			const article = articles[articleIndex]
			for (const material of this.collectAllArticleMaterials(article)) {
				if (material.uploadedPath || !material.file?.size) continue
				const path = await this.uploadMaterialToDraft(articleIndex, material.file)
				if (path) material.uploadedPath = path
			}
		}
	}

	private collectAllArticleMaterials(article: ArticleDetail): MaterialItem[] {
		const items = [...(article.materials || [])]
		const visit = (nodes: OutlineNode[]) => {
			for (const node of nodes) {
				if (node.materials?.length) items.push(...node.materials)
				if (node.children?.length) visit(node.children)
			}
		}
		visit(article.outline || [])
		return items
	}

	private async archiveDraftMaterials(archiveDirId: string): Promise<boolean> {
		const files = await this.getProjectFileList()
		const materialsDirPath = this.folderRelativePath
			? this.normalizeRelativePath(
					`${this.folderRelativePath}/${DRAFTS_DIR}/${DRAFT_MATERIALS_DIR}`,
				)
			: this.normalizeRelativePath(`${DRAFTS_DIR}/${DRAFT_MATERIALS_DIR}`)
		const materialsDir = files.find(
			(item) =>
				item.is_directory &&
				item.relative_file_path &&
				this.normalizeRelativePath(item.relative_file_path) === materialsDirPath,
		)
		if (!materialsDir?.file_id) return true
		try {
			await SuperMagicApi.moveFile({
				file_id: materialsDir.file_id,
				target_parent_id: archiveDirId,
			})
			return true
		} catch {
			return false
		}
	}

	// ─── Serialization ───────────────────────────────────────────────────────

	private async buildDraftPayload(
		data: SelfMediaInitData,
		currentStep: number,
		now: string,
	): Promise<DraftPayload> {
		let createdAt = now
		try {
			const existing = await this.loadDraft()
			if (existing) {
				const files = await this.getProjectFileList()
				const draftFile = this.findDraftFile(files)
				if (draftFile?.file_id) {
					const content = (await this.fileApi.getFileContentById(draftFile.file_id, {
						responseType: "text",
					})) as string
					const prev: DraftPayload = JSON.parse(content)
					createdAt = prev.createdAt || now
				}
			}
		} catch {
			// use now
		}

		return {
			version: 1,
			currentStep,
			createdAt,
			updatedAt: now,
			articles: this.serializeArticles(data.articles),
		}
	}

	private async buildBrandConfigPayload(
		global: SelfMediaInitGlobalSettings,
		now: string,
	): Promise<BrandConfigPayload> {
		let createdAt = now
		try {
			const files = await this.getProjectFileList()
			const existingFile = this.findBrandConfigFile(files)
			if (existingFile?.file_id) {
				const content = (await this.fileApi.getFileContentById(existingFile.file_id, {
					responseType: "text",
				})) as string
				const prev: BrandConfigPayload = JSON.parse(content)
				createdAt = prev.createdAt || now
			}
		} catch {
			// use now
		}

		return {
			version: 1,
			createdAt,
			updatedAt: now,
			...this.serializeGlobal(global),
		}
	}

	private buildReferenceIndexPayload(
		data: SelfMediaInitData,
		now: string,
	): ReferenceIndexPayload {
		const items: ReferenceIndexItem[] = []

		data.articles.forEach((article, articleIndex) => {
			article.materials.forEach((material) => {
				items.push({
					id: material.id,
					role: "article-material",
					name: material.file?.name || "unknown",
					description: material.description,
					articleIndex,
					relativePath: material.uploadedPath,
					kind: "file",
				})
			})

			const visitOutline = (nodes: OutlineNode[]) => {
				nodes.forEach((node) => {
					node.materials?.forEach((material) => {
						items.push({
							id: material.id,
							role: "outline-material",
							name: material.file?.name || "unknown",
							description: material.description,
							articleIndex,
							outlineNodeId: node.id,
							relativePath: material.uploadedPath,
							kind: "file",
						})
					})
					if (node.children?.length) visitOutline(node.children)
				})
			}
			visitOutline(article.outline)

			article.visualReferenceFiles?.forEach((file, visualIndex) => {
				items.push({
					id: `visual-${articleIndex}-${visualIndex}`,
					role: "visual-reference",
					name: file.name,
					articleIndex,
					relativePath: file.file_path,
					kind: file.kind ? file.kind : file.file_path ? "file" : "text",
					file_id: file.file_id,
					file_path: file.file_path,
					content: file.content,
				})
			})
		})

		return {
			version: 1,
			createdAt: now,
			updatedAt: now,
			items,
		}
	}

	private buildArchiveSnapshotData(
		data: SelfMediaInitData,
		archiveId: string,
	): SelfMediaInitData {
		return {
			global: {
				...data.global,
				brandImages: data.global.brandImages.map((item) => ({ ...item })),
			},
			articles: data.articles.map((article) => ({
				...article,
				outline: this.rewriteOutlineForArchive(article.outline || [], archiveId),
				materials: (article.materials || []).map((item) => ({
					...item,
					uploadedPath: this.rewriteDraftMaterialPathForArchive(
						item.uploadedPath,
						archiveId,
					),
				})),
				visualReferenceFiles: (article.visualReferenceFiles || []).map((item) => ({
					...item,
				})),
			})),
		}
	}

	private rewriteOutlineForArchive(nodes: OutlineNode[], archiveId: string): OutlineNode[] {
		return nodes.map((node) => ({
			...node,
			children: this.rewriteOutlineForArchive(node.children || [], archiveId),
			materials: (node.materials || []).map((item) => ({
				...item,
				uploadedPath: this.rewriteDraftMaterialPathForArchive(item.uploadedPath, archiveId),
			})),
		}))
	}

	private rewriteDraftMaterialPathForArchive(
		path: string | undefined,
		archiveId: string,
	): string | undefined {
		if (!path) return path
		const normalized = this.normalizeRelativePath(path)
		const draftMaterialsPrefix = `${
			this.folderRelativePath
				? this.normalizeRelativePath(
						`${this.folderRelativePath}/${DRAFTS_DIR}/${DRAFT_MATERIALS_DIR}`,
					)
				: this.normalizeRelativePath(`${DRAFTS_DIR}/${DRAFT_MATERIALS_DIR}`)
		}/`
		if (!normalized.startsWith(draftMaterialsPrefix)) return path
		const suffix = normalized.slice(draftMaterialsPrefix.length)
		const archivePrefix = `${
			this.folderRelativePath
				? this.normalizeRelativePath(
						`${this.folderRelativePath}/${DRAFTS_DIR}/${ARCHIVE_DIR}/${archiveId}/${DRAFT_MATERIALS_DIR}`,
					)
				: this.normalizeRelativePath(
						`${DRAFTS_DIR}/${ARCHIVE_DIR}/${archiveId}/${DRAFT_MATERIALS_DIR}`,
					)
		}/`
		return `${archivePrefix}${suffix}`
	}

	private serializeArticles(articles: ArticleDetail[]): SerializedArticle[] {
		return articles.map((article, idx) => ({
			title: article.title,
			folderName: article.folderName,
			style: article.style,
			visualPreset: article.visualPreset,
			cardCount: article.cardCount,
			outline: this.serializeOutline(article.outline, idx),
			materials: (article.materials || []).map((m) => ({
				id: m.id,
				name: m.file?.name || "unknown",
				description: m.description,
				relativePath:
					m.uploadedPath ||
					this.toProjectRelativePath(
						`${DRAFTS_DIR}/${DRAFT_MATERIALS_DIR}/${idx}/${m.file?.name || "unknown"}`,
					),
			})),
			notes: article.notes,
			platform: article.platform,
			description: article.description,
			descriptionJson: article.descriptionJson as Record<string, unknown> | undefined,
			visualReferenceFiles: (article.visualReferenceFiles || []).map((f) => ({
				name: f.name,
				content: f.content,
				kind: f.kind,
				file_id: f.file_id,
				file_path: f.file_path,
			})),
			visualDescriptionJson: article.visualDescriptionJson as
				Record<string, unknown> | undefined,
		}))
	}

	private serializeOutline(nodes: OutlineNode[], articleIndex: number): SerializedOutlineNode[] {
		return nodes.map((node) => ({
			id: node.id,
			text: node.text,
			children: this.serializeOutline(node.children || [], articleIndex),
			materials: (node.materials || []).map((material) => ({
				id: material.id,
				name: material.file?.name || "unknown",
				description: material.description,
				relativePath:
					material.uploadedPath ||
					this.toProjectRelativePath(
						`${DRAFTS_DIR}/${DRAFT_MATERIALS_DIR}/${articleIndex}/${material.file?.name || "unknown"}`,
					),
			})),
		}))
	}

	private serializeGlobal(global: SelfMediaInitGlobalSettings): SerializedGlobalSettings {
		return {
			author: global.author,
			brandPosition: global.brandPosition,
			targetAudience: global.targetAudience,
			brandImages: (global.brandImages || []).map((img) => ({
				id: img.id,
				name: img.file?.name || "unknown",
				description: img.description,
				relativePath:
					img.uploadedPath ||
					this.toProjectRelativePath(
						`${DRAFTS_DIR}/${BRAND_IMAGES_DIR}/${img.file?.name || "unknown"}`,
					),
				isImage: img.isImage,
			})),
		}
	}

	private async buildDraftGlobalSettings(
		global: SelfMediaInitGlobalSettings,
	): Promise<SerializedGlobalSettings> {
		const serializedGlobal = this.serializeGlobal(global)
		if (serializedGlobal.brandImages.length > 0) return serializedGlobal

		return {
			...serializedGlobal,
			brandImages: await this.listDraftBrandImagesFromDirectory(),
		}
	}

	private async listDraftBrandImagesFromDirectory(): Promise<SerializedBrandImage[]> {
		const files = await this.getProjectFileList()
		const brandImagesDir = this.toProjectRelativePath(
			`${this.getBasePath()}/${BRAND_IMAGES_DIR}`,
		)

		return files
			.filter(
				(item) =>
					!item.is_directory &&
					item.relative_file_path &&
					this.normalizeRelativePath(item.relative_file_path).startsWith(
						`${brandImagesDir}/`,
					),
			)
			.sort((a, b) =>
				this.normalizeRelativePath(a.relative_file_path || "").localeCompare(
					this.normalizeRelativePath(b.relative_file_path || ""),
				),
			)
			.map((item) => {
				const relativePath = this.normalizeRelativePath(item.relative_file_path || "")
				const name = item.file_name || relativePath.split("/").pop() || "unknown"

				return {
					id: `brand-image:${relativePath}`,
					name,
					description: "",
					relativePath,
					isImage: this.isImageFileName(name),
				}
			})
	}

	private isImageFileName(fileName: string): boolean {
		return /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic|heif)$/i.test(fileName)
	}

	private async ensureBrandImagesUploaded(
		brandImages: BrandImageItem[],
		target: "draft" | "brand" = "draft",
		strict = false,
	): Promise<void> {
		for (const item of brandImages) {
			if (item.uploadedPath || !item.file?.size) continue
			const path =
				target === "brand"
					? await this.uploadBrandImageToBrandConfig(item.file)
					: await this.uploadBrandImageToDraft(item.file)
			if (path) item.uploadedPath = path
			if (!path && strict) {
				throw new Error(`Failed to upload brand image: ${item.file.name}`)
			}
		}
	}

	private deserializeBrandImages(serialized: unknown): BrandImageItem[] {
		if (!Array.isArray(serialized)) return []
		return serialized.map((item: SerializedBrandImage & { uploadedPath?: string }) => ({
			id: item.id,
			file: new File([], item.name || "file"),
			previewUrl: "",
			description: item.description || "",
			isImage: Boolean(item.isImage),
			uploadedPath: item.relativePath || item.uploadedPath,
		}))
	}

	private deserializePayload(payload: DraftPayload | TemplatePayload): SelfMediaInitData {
		return {
			global: this.deserializeGlobal(payload.global),
			articles: payload.articles.map((a) => ({
				title: a.title,
				folderName: a.folderName,
				style: a.style,
				visualPreset: a.visualPreset,
				cardCount: a.cardCount,
				outline: this.normalizeOutline(a.outline),
				materials: Array.isArray(a.materials)
					? a.materials.map((m) => ({
							id: m.id || `material_${Date.now()}`,
							file: new File([], m.name || "file"),
							previewUrl: "",
							description: m.description || "",
							uploadedPath: m.relativePath,
						}))
					: [],
				notes: a.notes,
				platform: a.platform as any,
				description: a.description,
				descriptionJson: a.descriptionJson,
				visualDescriptionJson: a.visualDescriptionJson,
				visualReferenceFiles: Array.isArray(a.visualReferenceFiles)
					? a.visualReferenceFiles.map((f) => ({
							name: f.name || "file",
							content: f.content || "",
							kind: f.kind,
							file_id: f.file_id,
							file_path: f.file_path,
						}))
					: [],
			})),
		}
	}

	private deserializeGlobal(
		global: SerializedGlobalSettings | BrandConfigPayload | undefined,
	): SelfMediaInitGlobalSettings {
		return {
			author: global?.author || "",
			brandPosition: global?.brandPosition || "",
			targetAudience: global?.targetAudience || "",
			brandImages: this.deserializeBrandImages(global?.brandImages),
		}
	}

	private normalizeOutline(nodes: unknown): OutlineNode[] {
		if (!Array.isArray(nodes)) return []

		type OutlineSourceNode = {
			id?: string
			text?: string
			children?: unknown[]
			materials?: Array<{
				id?: string
				name?: string
				description?: string
				relativePath?: string
				uploadedPath?: string
			}>
		}

		let counter = 0
		const normalize = (items: unknown[]): OutlineNode[] =>
			items.map((item) => {
				const node = item as OutlineSourceNode
				return {
					id:
						typeof node.id === "string"
							? node.id
							: `outline_${Date.now()}_${++counter}`,
					text: typeof node.text === "string" ? node.text : "",
					children: Array.isArray(node.children) ? normalize(node.children) : [],
					materials: Array.isArray(node.materials)
						? node.materials.map((m, idx) => ({
								id: m.id || `outline_mat_${idx}`,
								file: new File([], m.name || "file"),
								previewUrl: "",
								description: m.description || "",
								uploadedPath: m.relativePath || m.uploadedPath,
							}))
						: [],
				}
			})

		return normalize(nodes)
	}
}

function appendPostOpsMetricsHistory(
	existing: SelfMediaPostOpsMetricsPayload | null,
	next: SelfMediaPostOpsMetricsHistoryItem,
): SelfMediaPostOpsMetricsHistoryItem[] {
	const base = existing?.history?.length
		? existing.history
		: existing
			? [
					{
						fetchedAt: existing.updatedAt,
						metrics: existing.metrics,
						derivedMetrics: existing.derivedMetrics,
						source: existing.source,
						note: existing.notes,
					},
				]
			: []
	return upsertPostOpsHistoryItem(base, next)
}

function appendPostOpsSourceHistory(
	existing: SelfMediaPostOpsSourcePayload | null,
	next: SelfMediaPostOpsSourceHistoryItem,
): SelfMediaPostOpsSourceHistoryItem[] {
	const base = existing?.history?.length
		? existing.history
		: existing
			? [
					{
						fetchedAt: existing.updatedAt,
						publishedUrl: existing.publishedUrl,
						fetchStatus: existing.fetchStatus,
						lastFetchedAt: existing.lastFetchedAt,
						failureReason: existing.failureReason,
						note: existing.notes,
					},
				]
			: []
	return upsertPostOpsHistoryItem(base, next)
}

function appendPostOpsCommentsHistory(
	existing: SelfMediaPostOpsCommentsPayload | null,
	next: SelfMediaPostOpsCommentsHistoryItem,
): SelfMediaPostOpsCommentsHistoryItem[] {
	const base = existing?.history?.length
		? existing.history
		: existing
			? [
					{
						fetchedAt: existing.updatedAt,
						summary: existing.summary,
						comments: existing.comments,
						insights: existing.insights,
						source: existing.source,
					},
				]
			: []
	return upsertPostOpsHistoryItem(base, next)
}

function upsertPostOpsHistoryItem<T extends { fetchedAt: string }>(items: T[], next: T): T[] {
	const withoutSameTime = items.filter((item) => item.fetchedAt !== next.fetchedAt)
	return [...withoutSameTime, next].sort(
		(left, right) => Date.parse(left.fetchedAt) - Date.parse(right.fetchedAt),
	)
}

function updatePostManifestTitleContent(content: string, title: string): string {
	return updatePostManifestMetaContent(content, { title })
}

function updatePostManifestMetaContent(
	content: string,
	patch: Pick<SelfMediaPostMeta, "title" | "subtitle" | "tags">,
): string {
	let manifest: Record<string, unknown>
	try {
		const parsed = JSON.parse(content) as Record<string, unknown>
		if (!parsed || typeof parsed !== "object") {
			throw new Error("postManifestInvalid")
		}
		manifest = parsed
	} catch {
		throw new Error("postManifestInvalid")
	}

	const rawMeta = manifest.meta
	const meta =
		rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
			? (rawMeta as Record<string, unknown>)
			: {}

	return JSON.stringify(
		{
			...manifest,
			meta: {
				...meta,
				...patch,
			},
		},
		null,
		2,
	)
}

function updatePostManifestPublishStatusContent(
	content: string,
	publishStatus?: SelfMediaPostPublishStatus,
): string {
	let manifest: Record<string, unknown>
	try {
		const parsed = JSON.parse(content) as Record<string, unknown>
		if (!parsed || typeof parsed !== "object") {
			throw new Error("postManifestInvalid")
		}
		manifest = parsed
	} catch {
		throw new Error("postManifestInvalid")
	}

	const rawMeta = manifest.meta
	const meta =
		rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
			? { ...(rawMeta as Record<string, unknown>) }
			: {}

	if (publishStatus) {
		meta.publishStatus = publishStatus
	} else {
		delete meta.publishStatus
	}

	return JSON.stringify(
		{
			...manifest,
			meta,
		},
		null,
		2,
	)
}
