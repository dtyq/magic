import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	ElementTypeEnum,
	type FrameElement,
	type GroupElement,
	type ImageElement,
	type LayerElement,
	type VideoElement,
} from "@/components/CanvasDesign/canvas/types"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { SuperMagicFileChangeMessage } from "@/types/chat/intermediate_message"
import type { SeqResponse } from "@/types/request"
import type { DesignData } from "../types"
import type { DesignProjectManagerOptions } from "./types"
import { isSameDesignProjectPath } from "../utils/toolDesignProjectInfo"
import {
	registerWaitForNextAttachmentsRefreshForProject,
	waitForNextAttachmentsRefreshForProject,
} from "@/pages/superMagic/services/attachmentsTopicSync"
import {
	formatCanvasRelativeResourcePath,
	hasCurrentDirectoryPrefix,
	isCanvasRelativeResourcePath,
	isRemoteOrSpecialPath,
	normalizePathLocal,
	stripCurrentDirectoryPrefix,
	stripPathEdgeSlashes,
} from "@/components/CanvasDesign/canvas/utils/pathUtils"
import {
	findFileBySrc,
	loadMagicProjectJsContent,
	parseMagicProjectJsContent,
	resolveDesignProjectBasePathFromAttachments,
	normalizeDesignDataPathsAfterLoad,
} from "../utils/utils"
import { buildDesignAttachmentIndex } from "../utils/designAttachmentIndex"
import { designDebugLog } from "../utils/designDebugLog"

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
 * - 当前设计目录内：`./images|videos|audios/...`（含历史裸 `images/...`，在此收口为 `./...`）
 * - 工作区路径：`path/to/file` 或 `/path/to/file`（与附件 relative_file_path 对齐时去掉首尾 `/`）
 * 其余（http、blob、data、`//`、file: 等）不参与附件缺失判断。
 */
function normalizeCanvasMediaSrcForAttachmentWalk(raw: string): string | null {
	const trimmed = raw.trim()
	if (!trimmed) return null
	if (isRemoteOrSpecialPath(trimmed)) return null
	if (/^file:/i.test(trimmed)) return null

	const local = normalizePathLocal(trimmed)

	if (hasCurrentDirectoryPrefix(local)) {
		const rest = stripCurrentDirectoryPrefix(local)
		if (!rest) return null
		return formatCanvasRelativeResourcePath(rest)
	}

	if (isCanvasRelativeResourcePath(local)) {
		return formatCanvasRelativeResourcePath(stripPathEdgeSlashes(local))
	}

	if (local.includes("/")) return stripPathEdgeSlashes(local)

	return local
}

function walkCanvasMediaSources(
	elements: LayerElement[] | undefined,
	onSrc: (src: string) => void,
): void {
	if (!elements?.length) return

	for (const el of elements) {
		if (el.type === ElementTypeEnum.Image || el.type === ElementTypeEnum.Video) {
			const media = el as ImageElement | VideoElement
			const s = media.src?.trim()
			if (!s) continue
			const normalized = normalizeCanvasMediaSrcForAttachmentWalk(s)
			if (!normalized) continue
			onSrc(normalized)
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
		if (!findFileBySrc(src, storeFiles, designProjectBasePath, index)) missing = true
	})
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
export type FetchRemoteDesignDataFn = () => Promise<DesignData | null>

/** 将已拉取的数据写入状态并通知画布更新；attachments 就绪后调用 */
export type ApplyRemoteDesignDataFn = (
	data: DesignData,
	updateType: "message" | "revoke" | "restore",
) => boolean

export type CheckRemoteUpdateFn = () => Promise<{
	hasUpdate: boolean
	currentVersion: number | null
	isCheckReliable: boolean
}>

export interface DesignRemoteListenerOptions extends DesignProjectManagerOptions {
	getMagicProjectJsFileId: () => string | null
	getIsViewingHistory: () => boolean
	getDesignDataName: () => string
	fetchAndSetVersions: () => Promise<unknown[]>
	loadAndApplyRemote: LoadAndApplyRemoteFn
	fetchRemoteDesignData: FetchRemoteDesignDataFn
	applyRemoteDesignData: ApplyRemoteDesignDataFn
	checkRemoteUpdate: CheckRemoteUpdateFn
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
	private pendingFileChangeUpdatedAtMs: number | null = null
	private pendingDebouncedFileChangeUpdatedAtMs: number | null = null
	private lastKnownMagicProjectJsUpdatedAtMs: number | null = null
	private localSaveUpdatedAtMs: number | null = null
	private projectKey: string
	private remoteApplyFlightKey: string | null = null
	private remoteApplyFlightPromise: Promise<void> | null = null
	private latestRemoteApplyToken = 0

	constructor(options: DesignRemoteListenerOptions) {
		this.options = options
		this.projectKey = this.getProjectKey(options)
		this.initializeMagicProjectJsUpdatedAtFromOptions()
	}

	updateOptions(options: Partial<DesignRemoteListenerOptions>) {
		const prevMode = this.getListenerMode()
		const prevProjectKey = this.projectKey
		this.options = { ...this.options, ...options }
		this.projectKey = this.getProjectKey(this.options)
		if (prevProjectKey !== this.projectKey) {
			this.hasPendingFileChangeDuringSave = false
			this.pendingFileChangeUpdatedAtMs = null
			this.pendingDebouncedFileChangeUpdatedAtMs = null
			this.lastKnownMagicProjectJsUpdatedAtMs = null
			this.localSaveUpdatedAtMs = null
			this.initializeMagicProjectJsUpdatedAtFromOptions()
		}
		if (this.isMounted && prevMode !== this.getListenerMode()) {
			this.unsubscribeRemoteUpdateEvents(prevMode)
			this.subscribeRemoteUpdateEvents()
		}
	}

	mount(): void {
		this.isMounted = true
		this.initializeMagicProjectJsUpdatedAtFromOptions()
		this.subscribeRemoteUpdateEvents()
	}

	unmount(): void {
		this.isMounted = false
		this.unsubscribeRemoteUpdateEvents()
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
			this.debounceTimer = null
		}
		this.activeLocalSaveTokens.clear()
		this.hasPendingFileChangeDuringSave = false
		this.pendingFileChangeUpdatedAtMs = null
		this.pendingDebouncedFileChangeUpdatedAtMs = null
		this.localSaveUpdatedAtMs = null
		this.remoteApplyFlightKey = null
		this.remoteApplyFlightPromise = null
		this.latestRemoteApplyToken += 1
	}

	beginLocalSave(): number {
		const saveToken = this.latestLocalSaveToken + 1
		this.latestLocalSaveToken = saveToken
		this.activeLocalSaveTokens.add(saveToken)
		return saveToken
	}

	async endLocalSave(
		saveToken: number | null | undefined,
		didSave: boolean,
		savedUpdatedAt?: string | null,
	): Promise<void> {
		if (saveToken === null || saveToken === undefined) return
		if (!this.activeLocalSaveTokens.has(saveToken)) return

		this.activeLocalSaveTokens.delete(saveToken)
		if (this.activeLocalSaveTokens.size > 0) return

		if (didSave) {
			const savedAtMs = parseUpdatedAt(savedUpdatedAt ?? undefined)
			if (savedAtMs !== null) {
				this.localSaveUpdatedAtMs = savedAtMs
			}
			this.markMagicProjectJsUpdatedAtApplied(savedAtMs ?? this.pendingFileChangeUpdatedAtMs)

			// Check if pending file change is newer than our save (real remote change)
			const pendingMs = this.pendingFileChangeUpdatedAtMs
			this.hasPendingFileChangeDuringSave = false
			this.pendingFileChangeUpdatedAtMs = null

			if (savedAtMs !== null && pendingMs !== null && pendingMs > savedAtMs) {
				void this.handleConfirmedFileChange(pendingMs)
			}
			return
		}

		await this.flushPendingFileChange()
	}

	private getListenerMode(): "message" | "file-change" {
		return this.options.remoteUpdateListenerMode ?? "message"
	}

	private getProjectKey(options: DesignRemoteListenerOptions): string {
		return `${options.projectId ?? ""}:${options.designProjectId ?? ""}`
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

		const fileUpdatedAtMs = parseUpdatedAt(designProjectFileChange.file?.updated_at)
		if (this.shouldIgnoreLocalSaveEcho(fileUpdatedAtMs)) return
		if (this.deferRemoteRefreshDuringSave(fileUpdatedAtMs)) return

		void this.handleConfirmedFileChange(fileUpdatedAtMs)
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

	private deferRemoteRefreshDuringSave(fileUpdatedAtMs?: number | null): boolean {
		if (this.activeLocalSaveTokens.size === 0) return false

		this.hasPendingFileChangeDuringSave = true
		if (fileUpdatedAtMs !== null && fileUpdatedAtMs !== undefined) {
			this.pendingFileChangeUpdatedAtMs = Math.max(
				this.pendingFileChangeUpdatedAtMs ?? 0,
				fileUpdatedAtMs,
			)
		}
		return true
	}

	private async flushPendingFileChange(): Promise<void> {
		if (!this.isMounted) return
		if (!this.hasPendingFileChangeDuringSave) return

		const fileUpdatedAtMs = this.pendingFileChangeUpdatedAtMs
		this.hasPendingFileChangeDuringSave = false
		this.pendingFileChangeUpdatedAtMs = null
		await this.handleConfirmedFileChange(fileUpdatedAtMs)
	}

	private async handleConfirmedFileChange(fileUpdatedAtMs?: number | null): Promise<void> {
		if (!this.isMounted) return

		const updatedAtStatus = this.getFileUpdatedAtStatus(fileUpdatedAtMs)
		if (updatedAtStatus === "newer") {
			this.debouncedLoadAndApply(fileUpdatedAtMs)
			return
		}
		if (updatedAtStatus === "stale") return

		try {
			const { hasUpdate, isCheckReliable } = await this.options.checkRemoteUpdate()
			if (!this.isMounted) return
			if (!hasUpdate && isCheckReliable) return

			this.debouncedLoadAndApply()
		} catch {
			// ignore
		}
	}

	private getFileUpdatedAtStatus(fileUpdatedAtMs?: number | null): "newer" | "stale" | "unknown" {
		if (fileUpdatedAtMs === null || fileUpdatedAtMs === undefined) return "unknown"

		if (
			this.lastKnownMagicProjectJsUpdatedAtMs !== null &&
			fileUpdatedAtMs <= this.lastKnownMagicProjectJsUpdatedAtMs
		)
			return "stale"

		return "newer"
	}

	private markMagicProjectJsUpdatedAtApplied(fileUpdatedAtMs?: number | null): void {
		if (fileUpdatedAtMs === null || fileUpdatedAtMs === undefined) return

		this.lastKnownMagicProjectJsUpdatedAtMs = Math.max(
			this.lastKnownMagicProjectJsUpdatedAtMs ?? 0,
			fileUpdatedAtMs,
		)
	}

	private shouldIgnoreLocalSaveEcho(fileUpdatedAtMs?: number | null): boolean {
		if (this.localSaveUpdatedAtMs === null) return false

		if (fileUpdatedAtMs !== null && fileUpdatedAtMs !== undefined) {
			if (fileUpdatedAtMs <= this.localSaveUpdatedAtMs) {
				this.markMagicProjectJsUpdatedAtApplied(fileUpdatedAtMs)
				return true
			}
			// Newer than our save → real remote change, clear marker
			this.localSaveUpdatedAtMs = null
			return false
		}

		// No timestamp on incoming event → cannot determine, don't ignore
		return false
	}

	private initializeMagicProjectJsUpdatedAtFromOptions(): void {
		if (this.lastKnownMagicProjectJsUpdatedAtMs !== null) return

		const fileUpdatedAtMs = this.getMagicProjectJsUpdatedAtFromOptions()
		if (fileUpdatedAtMs === null) return

		this.lastKnownMagicProjectJsUpdatedAtMs = fileUpdatedAtMs
	}

	/**
	 * file-change 链路：读远端 magic.project.js，必要时等待附件刷新后再次读取；
	 * 返回可直接 apply 的数据；返回 null 表示应由 fetchRemoteDesignData（loadLatest）兜底。
	 */
	private async maybePrepareRemoteDesignDataFromMagicProjectFile(): Promise<DesignData | null> {
		const fid = this.options.getMagicProjectJsFileId()
		if (!fid) return null

		const dslBase = resolveDesignProjectBasePathFromAttachments(this.options)

		let parsed: DesignData | null = null
		try {
			const content = await loadMagicProjectJsContent(fid)
			parsed = parseMagicProjectJsContent(content)
		} catch (e) {
			designDebugLog("remote:parse-magic-project", e)
			return null
		}

		if (!parsed) return null
		if (dslBase) normalizeDesignDataPathsAfterLoad(parsed, dslBase)

		const storeFiles = [
			...(this.options.flatAttachments ?? []),
			...flattenFileItems(this.options.attachments ?? []),
		]

		if (!designDataHasMediaMissingFromAttachments(parsed, storeFiles, dslBase)) return parsed

		const projectId = this.options.projectId
		if (!projectId) return null

		try {
			await waitForNextAttachmentsRefreshForProject(projectId, { timeoutMs: 15_000 })
		} catch (e) {
			designDebugLog("remote:wait-attachments", e)
		}

		try {
			const content = await loadMagicProjectJsContent(fid)
			const again = parseMagicProjectJsContent(content)
			if (again && dslBase) normalizeDesignDataPathsAfterLoad(again, dslBase)
			return again
		} catch (e) {
			designDebugLog("remote:reload-after-wait", e)
			return null
		}
	}

	private getMagicProjectJsUpdatedAtFromOptions(): number | null {
		const fileId = this.options.getMagicProjectJsFileId()
		const files = [
			...(this.options.flatAttachments ?? []),
			...flattenFileItems(this.options.attachments ?? []),
		]
		const magicProjectJs = files.find((item) => {
			if (fileId && item.file_id === fileId) return true

			return (
				String(item.parent_id ?? "") === String(this.options.designProjectId ?? "") &&
				item.file_name === "magic.project.js"
			)
		})

		return parseUpdatedAt(magicProjectJs?.updated_at)
	}

	private async handleRemoteRefresh(
		updateType: "message" | "revoke" | "restore",
		options?: { refreshVersionsAfterApply?: boolean; fileUpdatedAtMs?: number | null },
	): Promise<void> {
		if (!this.isMounted) return

		if (this.options.getIsViewingHistory()) {
			if (this.options.isShareRoute) return

			try {
				await this.options.fetchAndSetVersions()
			} catch {
				// ignore
			}
			return
		}

		const didApplyRemote = await this.options.loadAndApplyRemote(updateType)
		if (didApplyRemote) {
			this.markMagicProjectJsUpdatedAtApplied(options?.fileUpdatedAtMs)
		}

		if (!options?.refreshVersionsAfterApply || this.options.isShareRoute) return

		try {
			await this.options.fetchAndSetVersions()
		} catch {
			// ignore
		}
	}

	private debouncedLoadAndApply(fileUpdatedAtMs?: number | null): void {
		if (!this.isMounted) return

		if (fileUpdatedAtMs !== null && fileUpdatedAtMs !== undefined) {
			this.pendingDebouncedFileChangeUpdatedAtMs = Math.max(
				this.pendingDebouncedFileChangeUpdatedAtMs ?? 0,
				fileUpdatedAtMs,
			)
		}

		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
		}
		this.debounceTimer = setTimeout(() => {
			const pendingFileUpdatedAtMs = this.pendingDebouncedFileChangeUpdatedAtMs
			this.pendingDebouncedFileChangeUpdatedAtMs = null
			if (!this.isMounted) {
				this.debounceTimer = null
				return
			}
			if (this.deferRemoteRefreshDuringSave(pendingFileUpdatedAtMs)) {
				this.debounceTimer = null
				return
			}
			if (this.getListenerMode() === "file-change") {
				const pendingMs = pendingFileUpdatedAtMs
				const applyToken = this.latestRemoteApplyToken + 1
				this.latestRemoteApplyToken = applyToken

				const isLatestApply = () =>
					this.isMounted && this.latestRemoteApplyToken === applyToken

				const run = (async () => {
					try {
						const preloaded =
							await this.maybePrepareRemoteDesignDataFromMagicProjectFile()
						if (!isLatestApply()) return
						if (preloaded) {
							const applied = this.options.applyRemoteDesignData(preloaded, "message")
							if (applied) {
								this.markMagicProjectJsUpdatedAtApplied(pendingMs ?? undefined)
							}
							return
						}
						const newData = await this.options.fetchRemoteDesignData()
						if (!isLatestApply()) return
						if (!newData) return
						const applied = this.options.applyRemoteDesignData(newData, "message")
						if (applied) {
							this.markMagicProjectJsUpdatedAtApplied(pendingMs ?? undefined)
						}
					} catch (e) {
						designDebugLog("remote:file-change-apply", e)
					} finally {
						if (this.latestRemoteApplyToken === applyToken) {
							this.remoteApplyFlightKey = null
							this.remoteApplyFlightPromise = null
						}
					}
				})()

				this.remoteApplyFlightKey = `${this.options.getMagicProjectJsFileId() ?? ""}:${applyToken}`
				this.remoteApplyFlightPromise = run
				void run
			} else {
				void this.handleRemoteRefresh("message", {
					fileUpdatedAtMs: pendingFileUpdatedAtMs,
				})
			}
			this.debounceTimer = null
		}, this.options.updateListenerDebounceMs)
	}
}

function parseUpdatedAt(updatedAt?: string): number | null {
	if (!updatedAt) return null

	const time = new Date(updatedAt).getTime()
	if (Number.isNaN(time)) return null

	return time
}

function flattenFileItems(files: FileItem[]): FileItem[] {
	return files.flatMap((file) => [file, ...flattenFileItems(file.children ?? [])])
}
