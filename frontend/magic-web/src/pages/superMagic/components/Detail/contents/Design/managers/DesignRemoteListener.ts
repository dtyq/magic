import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	ElementTypeEnum,
	type AudioElement,
	type FrameElement,
	type GroupElement,
	type ImageElement,
	type LayerElement,
	type VideoElement,
} from "@/components/CanvasDesign/runtime/document/types"
import {
	getContents,
	getImageContents,
} from "@/components/CanvasDesign/runtime/document/elementContent"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { SuperMagicFileChangeMessage } from "@/types/chat/intermediate_message"
import type { SeqResponse } from "@/types/request"
import type { DesignData } from "../types"
import {
	resolveDesignAccessMode,
	type DesignProjectManagerOptions,
	type DesignCurrentFileLoadResult,
} from "./types"
import { isSameDesignProjectPath } from "../utils/toolDesignProjectInfo"
import {
	registerWaitForNextAttachmentsRefreshForProject,
	waitForNextAttachmentsRefreshForProject,
} from "@/pages/superMagic/services/attachmentsTopicSync"
import { resolveDesignProjectBasePathFromAttachments } from "../utils/utils"
import { buildDesignAttachmentIndex } from "../utils/designAttachmentIndex"
import { resolveDesignCanvasResourceReference } from "../utils/designResourceReferenceResolver"
import type { LoadDesignDataToRuntimeResult } from "../utils/designDataLoader"
import type { CanvasAccessMode } from "@/components/CanvasDesign/public/props"
import type { SuperMagicProjectAttachmentsReconciledPayload } from "@/pages/superMagic/events/files"
import { getSharedMediaResourceScope } from "@/pages/superMagic/services/sharedMediaResourceScope"

const DESIGN_ELEMENT_TOOL_NAMES = [
	// "create_canvas_element",
	// "update_canvas_element",
	// "reorder_canvas_elements",
	// "batch_create_canvas_elements",
	// "batch_update_canvas_elements",
	// "generate_images_to_canvas",
	// "generate_videos_to_canvas",
	"generate_canvas_images",
	"generate_canvas_videos",
] as const

interface ToolDesignData {
	type: "element"
	project_path: string
	elements: LayerElement[]
}

/**
 * 画布图片/视频 src 仅两类语义：
 * - 当前设计目录内：`./images|videos|audios/...`
 * - 历史裸路径：`images|videos|audios/...`（保留原值，交由过渡迁移按附件树判定）
 * - 工作区路径：`path/to/file` 或 `/path/to/file`（与附件 relative_file_path 对齐时去掉首尾 `/`）
 * 其余（http、blob、data、`//`、file: 等）不参与附件缺失判断。
 */
function walkCanvasMediaSources(
	elements: LayerElement[] | undefined,
	onSrc: (src: string) => void,
): void {
	if (!elements?.length) return

	for (const el of elements) {
		if (el.type === ElementTypeEnum.Image) {
			for (const content of getImageContents(el)) {
				const src = content.src?.trim()
				if (src && !/^file:/i.test(src)) onSrc(src)
			}
			continue
		}
		if (el.type === ElementTypeEnum.Video || el.type === ElementTypeEnum.Audio) {
			for (const content of getContents(el as VideoElement | AudioElement)) {
				const src = content.src?.trim()
				if (!src || /^file:/i.test(src)) continue
				onSrc(src)
			}
			continue
		}

		if (el.type === ElementTypeEnum.Frame || el.type === ElementTypeEnum.Group) {
			const children = (el as FrameElement | GroupElement).children
			walkCanvasMediaSources(children, onSrc)
		}
	}
}

function designDataHasMediaMissingFromAttachments(
	designData: DesignData,
	storeFiles: FileItem[],
	designProjectBasePath?: string,
): boolean {
	const index = buildDesignAttachmentIndex(storeFiles)
	let missing = false
	walkCanvasMediaSources(designData.canvas?.elements, (src) => {
		if (missing) return
		const resolution = resolveDesignCanvasResourceReference(
			src,
			{
				flatAttachments: storeFiles,
				designProjectBasePath,
				attachmentIndex: index,
				attachmentsReady: true,
			},
			{ requireAttachment: true },
		)
		if (resolution.status !== "resolved") missing = true
	})
	return missing
}

/** 生成配置位于 sidecar；任一 processing Content 配置未同步完整时需要等待附件树后重读。 */
export function designDataHasPendingMediaWithoutGenerationDetails(designData: DesignData): boolean {
	let missing = false
	const walk = (elements: LayerElement[] | undefined): void => {
		if (!elements?.length || missing) return

		for (const element of elements) {
			if (element.type === ElementTypeEnum.Image) {
				const hasIncompleteDetails = getImageContents(element as ImageElement).some(
					(content) => {
						if (content.status !== "pending" && content.status !== "processing") {
							return false
						}
						if (content.imageGenerationTaskMeta) return false

						const request = content.generateImageRequest
						return !request?.start_time || !request.expected_finished_at
					},
				)
				if (hasIncompleteDetails) {
					missing = true
					return
				}
			} else if (element.type === ElementTypeEnum.Video) {
				const hasMissingRequest = getContents(element as VideoElement).some(
					(content) =>
						(content.status === "pending" || content.status === "processing") &&
						!content.generateVideoRequest,
				)
				if (hasMissingRequest) {
					missing = true
					return
				}
			}

			if (element.type === ElementTypeEnum.Frame || element.type === ElementTypeEnum.Group) {
				walk((element as FrameElement | GroupElement).children)
				if (missing) return
			}
		}
	}

	walk(designData.canvas?.elements)
	return missing
}

interface ToolMessage {
	id: string
	name: string
	remark: string
	detail: { type: "design" | "image"; data: ToolDesignData }
	attachments: AttachmentItem[]
}

interface NewMessagePayload {
	message?: {
		general_agent_card?: { tool?: ToolMessage }
	}
}

export type LoadAndApplyRemoteFn = (
	updateType?: "message" | "revoke" | "restore",
) => Promise<boolean>

/** 仅拉取远端设计数据，不写状态、不触画布（与等待附件并行） */
export type FetchRemoteDesignDataFn = () => Promise<DesignCurrentFileLoadResult | null>

/** 将已拉取的数据写入状态并通知画布更新；attachments 就绪后调用 */
export type ApplyRemoteDesignDataFn = (
	data: DesignData,
	updateType: "message" | "revoke" | "restore",
	options?: {
		loadResult?: LoadDesignDataToRuntimeResult
	},
) => boolean

export interface DesignRemoteListenerOptions extends DesignProjectManagerOptions {
	/** Current lifecycle mode resolved by the Design state owner. */
	getAccessMode?: () => CanvasAccessMode
	getMagicProjectJsFileId: () => string | null
	getIsViewingHistory: () => boolean
	getDesignDataName: () => string
	fetchAndSetVersions: () => Promise<unknown[]>
	loadAndApplyRemote: LoadAndApplyRemoteFn
	fetchRemoteDesignData: FetchRemoteDesignDataFn
	applyRemoteDesignData: ApplyRemoteDesignDataFn
	updateListenerDebounceMs: number
	setIsProcessingRevoke: (v: boolean) => void
	setRevokeType: (v: "revoke" | "restore" | null) => void
}

export class DesignRemoteListener {
	private options: DesignRemoteListenerOptions
	private fileId: string | null = null
	private debounceTimer: ReturnType<typeof setTimeout> | null = null
	private isMounted = false
	private processedTimestamps = new Set<number>()
	private revokeType: "revoke" | "restore" | null = null
	private revokeTimestamp: number | null = null
	private latestLocalSaveToken = 0
	private activeLocalSaveTokens = new Set<number>()
	private hasPendingFileChangeDuringSave = false
	private projectKey: string
	private latestRemoteApplyToken = 0
	private pendingReconciliation: SuperMagicProjectAttachmentsReconciledPayload | null = null
	private lastReconciledSnapshot:
		SuperMagicProjectAttachmentsReconciledPayload["snapshot"] | null = null

	constructor(options: DesignRemoteListenerOptions) {
		this.options = options
		this.projectKey = this.getProjectKey(options)
	}

	private getAccessMode(): CanvasAccessMode {
		return (
			this.options.getAccessMode?.() ??
			this.options.accessMode ??
			resolveDesignAccessMode(this.options)
		)
	}

	updateOptions(options: Partial<DesignRemoteListenerOptions>) {
		const prevMode = this.getListenerMode()
		const prevProjectKey = this.projectKey
		this.options = { ...this.options, ...options }
		this.projectKey = this.getProjectKey(this.options)
		if (prevProjectKey !== this.projectKey) {
			this.pendingReconciliation = null
			this.lastReconciledSnapshot = null
			this.latestRemoteApplyToken += 1
			this.fileId = null
			this.hasPendingFileChangeDuringSave = false
		}
		if (this.isMounted && prevMode !== this.getListenerMode()) {
			this.unsubscribeRemoteUpdateEvents(prevMode)
			this.subscribeRemoteUpdateEvents()
		}
		this.flushPendingReconciliation()
	}

	mount(): void {
		this.isMounted = true
		this.subscribeRemoteUpdateEvents()
		pubsub.subscribe(
			PubSubEvents.Super_Magic_Project_Attachments_Reconciled,
			this.handleProjectAttachmentsReconciled,
		)
	}

	unmount(): void {
		this.isMounted = false
		this.unsubscribeRemoteUpdateEvents()
		pubsub.unsubscribe(
			PubSubEvents.Super_Magic_Project_Attachments_Reconciled,
			this.handleProjectAttachmentsReconciled,
		)
		this.pendingReconciliation = null
		this.lastReconciledSnapshot = null
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
			this.debounceTimer = null
		}
		this.activeLocalSaveTokens.clear()
		this.hasPendingFileChangeDuringSave = false
		this.latestRemoteApplyToken += 1
	}

	beginLocalSave(): number {
		const saveToken = this.latestLocalSaveToken + 1
		this.latestLocalSaveToken = saveToken
		this.activeLocalSaveTokens.add(saveToken)
		return saveToken
	}

	async endLocalSave(saveToken: number | null | undefined): Promise<void> {
		if (saveToken == null || !this.activeLocalSaveTokens.has(saveToken)) return
		this.activeLocalSaveTokens.delete(saveToken)
		if (this.activeLocalSaveTokens.size > 0) return
		// 保存期间的通知只表示当前文件需重读，不能用时间或历史号丢弃。
		await this.flushPendingFileChange()
	}

	private getListenerMode(): "message" | "file-change" {
		return this.options.remoteUpdateListenerMode ?? "message"
	}

	private getProjectKey(options: DesignRemoteListenerOptions): string {
		return `${options.projectId ?? ""}:${options.designProjectId ?? ""}:${options.fileApi?.identityKey ?? ""}`
	}

	private readonly handleProjectAttachmentsReconciled = (
		payload: SuperMagicProjectAttachmentsReconciledPayload,
	): void => {
		if (
			!this.isMounted ||
			this.getAccessMode() === "share" ||
			payload.projectId !== this.options.projectId ||
			payload.accessScope !== getSharedMediaResourceScope() ||
			payload.snapshot === this.lastReconciledSnapshot
		)
			return

		this.pendingReconciliation = payload
		this.flushPendingReconciliation()
	}

	private flushPendingReconciliation(): void {
		const pending = this.pendingReconciliation
		if (!this.isMounted || !pending || !this.options.getMagicProjectJsFileId()) return
		if (pending.accessScope !== getSharedMediaResourceScope()) {
			this.pendingReconciliation = null
			return
		}

		// MobX 提交后 React 才把附件传进管理器。按真实列表引用等待，不能猜渲染延迟。
		const list = this.options.flatAttachments
		const hasCurrentAttachments = list
			? list === pending.snapshot.list || list === pending.store.workspaceFilesList
			: this.options.attachments === pending.snapshot.tree ||
				this.options.attachments === pending.store.workspaceFileTree
		if (!hasCurrentAttachments) return

		this.pendingReconciliation = null
		this.lastReconciledSnapshot = pending.snapshot
		if (this.deferRemoteRefreshDuringSave()) return
		this.debouncedLoadAndApply()
	}

	private subscribeRemoteUpdateEvents(): void {
		if (this.getListenerMode() === "file-change") {
			pubsub.subscribe(
				PubSubEvents.Super_Magic_File_Change_Intermediate,
				this.handleSuperMagicFileChangeIntermediate,
			)
			return
		}

		pubsub.subscribe(PubSubEvents.Super_Magic_New_Message_V2, this.handleNewMessage)
		pubsub.subscribe(PubSubEvents.Refresh_Topic_Messages, this.handleMessageRevoked)
		pubsub.subscribe(PubSubEvents.Show_Revoked_Messages, this.handleShowRevokedMessages)
		pubsub.subscribe(PubSubEvents.Hide_Revoked_Messages, this.handleHideRevokedMessages)
	}

	private unsubscribeRemoteUpdateEvents(mode = this.getListenerMode()): void {
		if (mode === "file-change") {
			pubsub.unsubscribe(
				PubSubEvents.Super_Magic_File_Change_Intermediate,
				this.handleSuperMagicFileChangeIntermediate,
			)
			return
		}

		pubsub.unsubscribe(PubSubEvents.Super_Magic_New_Message_V2, this.handleNewMessage)
		pubsub.unsubscribe(PubSubEvents.Refresh_Topic_Messages, this.handleMessageRevoked)
		pubsub.unsubscribe(PubSubEvents.Show_Revoked_Messages, this.handleShowRevokedMessages)
		pubsub.unsubscribe(PubSubEvents.Hide_Revoked_Messages, this.handleHideRevokedMessages)
	}

	private readonly handleSuperMagicFileChangeIntermediate = (
		seq: SeqResponse<SuperMagicFileChangeMessage>,
	): void => {
		const messageData = seq?.message
		const { projectId, designProjectId } = this.options
		if (
			!projectId ||
			!designProjectId ||
			!messageData ||
			messageData.project_id !== projectId ||
			!Array.isArray(messageData.changes)
		)
			return

		const designProjectFileChange = messageData.changes.find((item) =>
			this.isDesignProjectMagicProjectJsChange(item),
		)
		if (!designProjectFileChange) return

		if (this.deferRemoteRefreshDuringSave()) return
		this.debouncedLoadAndApply()
	}

	private readonly handleNewMessage = (data: unknown): void => {
		const payload = data as NewMessagePayload
		const tool = payload?.message?.general_agent_card?.tool as ToolMessage | undefined
		if (!tool?.id) return

		if (
			!DESIGN_ELEMENT_TOOL_NAMES.includes(
				tool.name as (typeof DESIGN_ELEMENT_TOOL_NAMES)[number],
			)
		)
			return

		const messageMagicProjectJs = [...(tool.attachments ?? [])]
			.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
			.find(
				(item) =>
					item.filename === "magic.project.js" || item.file_name === "magic.project.js",
			)
		if (!messageMagicProjectJs) return

		if (!this.isCurrentDesignProjectMessage(tool, messageMagicProjectJs)) return

		const ts = messageMagicProjectJs.timestamp ?? 0
		if (this.processedTimestamps.has(ts)) return

		this.processedTimestamps.add(ts)
		if (this.processedTimestamps.size > 100) {
			const first = this.processedTimestamps.values().next().value
			if (first !== undefined) this.processedTimestamps.delete(first)
		}

		const isFirstRecord = !this.fileId
		const hasInitialized = !!this.options.getMagicProjectJsFileId()
		const messageMagicProjectJsFileId = messageMagicProjectJs.file_id

		if (isFirstRecord && !hasInitialized) {
			if (messageMagicProjectJsFileId) this.fileId = messageMagicProjectJsFileId
			return
		}

		if (messageMagicProjectJsFileId) this.fileId = messageMagicProjectJsFileId
		if (this.deferRemoteRefreshDuringSave()) return
		this.debouncedLoadAndApply()
	}

	private isCurrentDesignProjectMessage(
		tool: ToolMessage,
		messageMagicProjectJs: AttachmentItem,
	): boolean {
		const currentMagicProjectJsFileId = this.options.getMagicProjectJsFileId()
		const messageMagicProjectJsFileId = messageMagicProjectJs.file_id
		if (currentMagicProjectJsFileId && messageMagicProjectJsFileId) {
			return messageMagicProjectJsFileId === currentMagicProjectJsFileId
		}

		const projName = this.options.designProjectName || this.options.getDesignDataName()
		return isSameDesignProjectPath({
			projectPath: tool.detail?.data?.project_path,
			designProjectName: projName,
			attachments: tool.attachments,
		})
	}

	private readonly handleMessageRevoked = async (): Promise<void> => {
		const { selectedTopicId, projectId } = this.options
		const fid = this.options.getMagicProjectJsFileId()
		if (!selectedTopicId || !fid) return

		const eventType = this.revokeType
		const eventTimestamp = this.revokeTimestamp
		this.revokeType = null
		this.revokeTimestamp = null

		const isUserAction =
			eventType !== null && eventTimestamp !== null && Date.now() - eventTimestamp < 2000

		const awaitAttachmentsOrContinue = async () => {
			try {
				await registerWaitForNextAttachmentsRefreshForProject(projectId, {
					timeoutMs: 15_000,
				})
			} catch {
				// 与旧逻辑一致：超时也继续拉设计，避免界面卡死
			}
		}

		if (!isUserAction) {
			try {
				await awaitAttachmentsOrContinue()
				await this.handleRemoteRefresh("message", {
					refreshVersionsAfterApply: true,
				})
			} catch {
				// ignore
			}
			return
		}

		const updateType: "revoke" | "restore" = eventType === "restore" ? "restore" : "revoke"
		this.options.setIsProcessingRevoke(true)
		this.options.setRevokeType(updateType)

		try {
			await awaitAttachmentsOrContinue()
			await this.handleRemoteRefresh(updateType, {
				refreshVersionsAfterApply: true,
			})
		} catch {
			// ignore
		} finally {
			this.options.setIsProcessingRevoke(false)
			this.options.setRevokeType(null)
		}
	}

	private readonly handleShowRevokedMessages = (): void => {
		this.revokeType = "restore"
		this.revokeTimestamp = Date.now()
	}

	private readonly handleHideRevokedMessages = (): void => {
		this.revokeType = "revoke"
		this.revokeTimestamp = Date.now()
	}

	private isDesignProjectMagicProjectJsChange(
		item: SuperMagicFileChangeMessage["changes"][number],
	): boolean {
		const { designProjectId } = this.options
		if (item.operation !== "update" || !item.file) return false

		return (
			String(item.file.parent_id ?? "") === String(designProjectId) &&
			item.file.file_name === "magic.project.js"
		)
	}

	private deferRemoteRefreshDuringSave(): boolean {
		if (this.activeLocalSaveTokens.size === 0) return false
		this.hasPendingFileChangeDuringSave = true
		return true
	}

	private async flushPendingFileChange(): Promise<void> {
		if (!this.isMounted || !this.hasPendingFileChangeDuringSave) return
		this.hasPendingFileChangeDuringSave = false
		this.debouncedLoadAndApply()
	}

	/**
	 * file-change 链路：读远端 magic.project.js，媒体或生成配置未同步时等待附件刷新后重读；
	 * 返回可直接 apply 的数据；返回 null 表示应由 fetchRemoteDesignData（loadLatest）兜底。
	 */
	private async maybePrepareRemoteDesignDataFromMagicProjectFile(): Promise<DesignCurrentFileLoadResult | null> {
		const fid = this.options.getMagicProjectJsFileId()
		if (!fid) return null
		const dslBase = resolveDesignProjectBasePathFromAttachments(this.options)
		const snapshot = await this.options.fetchRemoteDesignData()
		if (!snapshot?.data) return null
		const storeFiles = [
			...(this.options.flatAttachments ?? []),
			...flattenFileItems(this.options.attachments ?? []),
		]
		const hasMissingMedia = designDataHasMediaMissingFromAttachments(
			snapshot.data,
			storeFiles,
			dslBase,
		)
		const hasPendingGenerationWithoutInfo = designDataHasPendingMediaWithoutGenerationDetails(
			snapshot.data,
		)
		if (!hasMissingMedia && !hasPendingGenerationWithoutInfo) return snapshot
		const projectId = this.options.projectId
		if (!projectId) return hasMissingMedia ? null : snapshot
		try {
			await waitForNextAttachmentsRefreshForProject(projectId, { timeoutMs: 15_000 })
		} catch {
			// 生成配置同步超时不应阻塞占位符展示；媒体缺失仍沿用原有失败策略。
			return hasMissingMedia ? null : snapshot
		}
		return this.options.fetchRemoteDesignData()
	}

	private async handleRemoteRefresh(
		updateType: "message" | "revoke" | "restore",
		options?: { refreshVersionsAfterApply?: boolean },
	): Promise<void> {
		if (!this.isMounted) return
		const applyToken = this.latestRemoteApplyToken + 1
		this.latestRemoteApplyToken = applyToken
		const isLatestApply = () => this.isMounted && this.latestRemoteApplyToken === applyToken

		if (this.options.getIsViewingHistory()) {
			if (this.getAccessMode() === "share") return

			try {
				await this.options.fetchAndSetVersions()
			} catch {
				// ignore
			}
			if (!isLatestApply()) return
			return
		}

		await this.options.loadAndApplyRemote(updateType)
		if (!isLatestApply()) return

		if (!options?.refreshVersionsAfterApply || this.getAccessMode() === "share") return

		try {
			await this.options.fetchAndSetVersions()
		} catch {
			// ignore
		}
	}

	private debouncedLoadAndApply(): void {
		if (!this.isMounted) return
		// 新通知到达就令在途应用失效；已有防抖负责合并后续读取。
		this.latestRemoteApplyToken += 1
		if (this.debounceTimer) clearTimeout(this.debounceTimer)
		this.debounceTimer = setTimeout(() => {
			this.debounceTimer = null
			if (!this.isMounted) return
			if (this.options.getIsViewingHistory()) {
				if (this.getAccessMode() !== "share")
					void this.options.fetchAndSetVersions().catch(() => undefined)
				return
			}
			if (this.deferRemoteRefreshDuringSave()) return
			if (this.getListenerMode() !== "file-change") {
				void this.handleRemoteRefresh("message").catch(() => undefined)
				return
			}
			const applyToken = this.latestRemoteApplyToken
			const isLatestApply = () => this.isMounted && this.latestRemoteApplyToken === applyToken
			const run = async () => {
				let current = await this.maybePrepareRemoteDesignDataFromMagicProjectFile()
				if (!isLatestApply()) return
				if (!current?.data) current = await this.options.fetchRemoteDesignData()
				if (!isLatestApply() || !current?.data) return
				this.options.applyRemoteDesignData(current.data, "message", {
					loadResult: current.loadResult,
				})
			}
			void run().catch(() => undefined)
		}, this.options.updateListenerDebounceMs)
	}
}

function flattenFileItems(files: FileItem[]): FileItem[] {
	return files.flatMap((file) => [file, ...flattenFileItems(file.children ?? [])])
}
