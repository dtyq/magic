import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import type { LayerElement } from "@/opensource/components/CanvasDesign/canvas/types"
import type { AttachmentItem } from "@/opensource/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { DesignProjectManagerOptions } from "./types"
// import { EventType } from "@/opensource/types/chat"

const DESIGN_ELEMENT_TOOL_NAMES = [
	"create_canvas_element",
	"update_canvas_element",
	"reorder_canvas_elements",
	"batch_create_canvas_elements",
	"batch_update_canvas_elements",
	"generate_images_to_canvas",
] as const

interface ToolDesignData {
	type: "element"
	project_path: string
	elements: LayerElement[]
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

export type LoadAndApplyRemoteFn = (updateType?: "message" | "revoke" | "restore") => Promise<void>

export type WaitForAttachmentsUpdateFn = (callback: () => void | Promise<void>) => void

export interface DesignRemoteListenerOptions extends DesignProjectManagerOptions {
	getMagicProjectJsFileId: () => string | null
	getDesignDataName: () => string
	fetchAndSetVersions: () => Promise<unknown[]>
	loadAndApplyRemote: LoadAndApplyRemoteFn
	waitForAttachmentsUpdate: WaitForAttachmentsUpdateFn
	updateListenerDebounceMs: number
	setIsProcessingRevoke: (v: boolean) => void
	setRevokeType: (v: "revoke" | "restore" | null) => void
}

export class DesignRemoteListener {
	private options: DesignRemoteListenerOptions
	private fileId: string | null = null
	private debounceTimer: ReturnType<typeof setTimeout> | null = null
	private processedTimestamps = new Set<number>()
	private revokeType: "revoke" | "restore" | null = null
	private revokeTimestamp: number | null = null

	constructor(options: DesignRemoteListenerOptions) {
		this.options = options
	}

	updateOptions(options: Partial<DesignRemoteListenerOptions>) {
		this.options = { ...this.options, ...options }
	}

	mount(): void {
		pubsub.subscribe(PubSubEvents.Super_Magic_New_Message, this.handleNewMessage)
		pubsub.subscribe(PubSubEvents.Refresh_Topic_Messages, this.handleMessageRevoked)
		pubsub.subscribe(PubSubEvents.Show_Revoked_Messages, this.handleShowRevokedMessages)
		pubsub.subscribe(PubSubEvents.Hide_Revoked_Messages, this.handleHideRevokedMessages)
		// chatWebSocket.on("businessMessage", handleIntermediateMessage)
	}

	unmount(): void {
		pubsub.unsubscribe(PubSubEvents.Super_Magic_New_Message, this.handleNewMessage)
		pubsub.unsubscribe(PubSubEvents.Refresh_Topic_Messages, this.handleMessageRevoked)
		pubsub.unsubscribe(PubSubEvents.Show_Revoked_Messages, this.handleShowRevokedMessages)
		pubsub.unsubscribe(PubSubEvents.Hide_Revoked_Messages, this.handleHideRevokedMessages)
		// chatWebSocket.off("businessMessage", handleIntermediateMessage)
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
			this.debounceTimer = null
		}
	}

	// private readonly handleIntermediateMessage = (message: {
	// 	type: EventType
	// 	payload: unknown
	// }) => {
	// 	if (message.type !== EventType.Intermediate) {
	// 		return
	// 	}
	// 	const messageData = (message.payload as any).seq.message
	// 	if (messageData.type !== "super_magic_file_change") {
	// 		return
	// 	}
	// 	const { projectId, designProjectId } = this.options
	// 	if (!projectId || messageData.project_id !== projectId) {
	// 		return
	// 	}
	// 	const changeFiles = messageData.changes.map((item: any) => item.file)
	// 	const isDesignProjectFileChange = changeFiles.some(
	// 		(item: any) =>
	// 			item.parent_id === designProjectId && item.file_name === "magic.project.js",
	// 	)
	// 	if (isDesignProjectFileChange) {
	// 		this.debouncedLoadAndApply()
	// 	}
	// }

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
			.find((item) => item.filename === "magic.project.js")

		const fid = this.options.getMagicProjectJsFileId()
		const projName = this.options.designProjectName || this.options.getDesignDataName()
		const isCurrentDesignProject = tool.detail?.data?.project_path?.split("/")[0] === projName

		if (
			!isCurrentDesignProject ||
			!messageMagicProjectJs?.file_id ||
			messageMagicProjectJs.file_id !== fid
		) {
			return
		}

		const ts = messageMagicProjectJs.timestamp ?? 0
		if (this.processedTimestamps.has(ts)) return

		this.processedTimestamps.add(ts)
		if (this.processedTimestamps.size > 100) {
			const first = this.processedTimestamps.values().next().value
			if (first !== undefined) this.processedTimestamps.delete(first)
		}

		const isFirstRecord = !this.fileId
		const hasInitialized = !!this.options.getMagicProjectJsFileId()

		if (isFirstRecord && !hasInitialized) {
			this.fileId = messageMagicProjectJs.file_id
			return
		}

		this.fileId = messageMagicProjectJs.file_id
		this.debouncedLoadAndApply()
	}

	private readonly handleMessageRevoked = async (): Promise<void> => {
		const { selectedTopicId, loadAndApplyRemote, waitForAttachmentsUpdate } = this.options
		const fid = this.options.getMagicProjectJsFileId()
		if (!selectedTopicId || !fid) return

		const eventType = this.revokeType
		const eventTimestamp = this.revokeTimestamp
		this.revokeType = null
		this.revokeTimestamp = null

		const isUserAction =
			eventType !== null && eventTimestamp !== null && Date.now() - eventTimestamp < 2000

		if (!isUserAction) {
			try {
				await new Promise<void>((resolve) => {
					waitForAttachmentsUpdate(async () => {
						try {
							await loadAndApplyRemote("message")
							if (!this.options.isShareRoute) {
								await this.options.fetchAndSetVersions()
							}
							resolve()
						} catch {
							resolve()
						}
					})
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
			await new Promise<void>((resolve) => {
				waitForAttachmentsUpdate(async () => {
					try {
						await loadAndApplyRemote(updateType)
						if (!this.options.isShareRoute) {
							await this.options.fetchAndSetVersions()
						}
						resolve()
					} catch {
						resolve()
					}
				})
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

	private debouncedLoadAndApply(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
		}
		this.debounceTimer = setTimeout(() => {
			this.options.loadAndApplyRemote("message")
			this.debounceTimer = null
		}, this.options.updateListenerDebounceMs)
	}
}
