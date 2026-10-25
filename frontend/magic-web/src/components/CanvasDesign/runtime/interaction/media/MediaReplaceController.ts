import { toast } from "sonner"
import type { Canvas } from "../../core/Canvas"
import { ElementTypeEnum, type MediaElementType } from "../../document/types"
import { getActiveContent, getContentById } from "../../document/elementContent"
import { isAudioFile, isImageFile, isVideoFile, validateFile } from "../../shared/ids"

const MEDIA_ACCEPT: Record<MediaElementType, string> = {
	[ElementTypeEnum.Image]: "image/*,.png,.jpg,.jpeg,.gif,.webp",
	[ElementTypeEnum.Video]: "video/*,.mp4,.mov,.webm",
	[ElementTypeEnum.Audio]: "audio/*,.mp3,.wav,.ogg,.m4a,.aac",
}

export interface MediaReplacementTarget {
	elementId: string
	mediaType: MediaElementType
	contentId: string | null
}

export type MediaReplacementSource = "local-upload" | "project-file"
export type MediaReplacementPhase = "uploading" | "applying"

export interface MediaReplacementState extends MediaReplacementTarget {
	operationId: string
	source: MediaReplacementSource
	phase: MediaReplacementPhase
}

type MediaReplacementStatus = "idle" | MediaReplacementPhase | "error"

/** 统一管理图片、视频、音频工具栏的本地选择与替换状态。 */
export class MediaReplaceController {
	private readonly canvas: Canvas
	private input?: HTMLInputElement
	private replacementState: MediaReplacementState | null = null
	private nextOperationSequence = 0
	private readonly eventUnsubscribers: Array<() => void>
	private destroyed = false

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
		this.eventUnsubscribers = [
			this.canvas.eventEmitter.on("element:change", ({ data }) => {
				const state = this.replacementState
				if (!state) return
				if (data?.elementIds && !data.elementIds.includes(state.elementId)) return
				if (!this.isTargetAvailable(state)) {
					this.replacementState = null
					this.emitState(state, "idle")
				}
			}),
			this.canvas.eventEmitter.on("element:deleted", ({ data }) => {
				this.cancelIfTargetDeleted([data.elementId])
			}),
			this.canvas.eventEmitter.on("element:batchdeleted", ({ data }) => {
				this.cancelIfTargetDeleted(data.elementIds)
			}),
		]
	}

	/** 当前 Canvas 内正在替换的媒体元素；仅运行时状态，不参与 DSL 持久化。 */
	public getReplacingElementId(): string | null {
		return this.replacementState?.elementId ?? null
	}

	public getReplacementState(elementId?: string): MediaReplacementState | null {
		const state = this.replacementState
		if (!state || (elementId && state.elementId !== elementId)) return null
		return state
	}

	public isReplacing(elementId: string, contentId?: string | null): boolean {
		const state = this.getReplacementState(elementId)
		if (!state) return false
		return contentId === undefined || state.contentId === contentId
	}

	/**
	 * 结束当前替换会话。上传请求本身由宿主负责取消或继续；完成回调会因
	 * operationId 已失效而被忽略，真正的文档写入仍由 UploadManager 再次鉴权。
	 */
	public cancel(): boolean {
		const state = this.replacementState
		if (!state) return false
		this.replacementState = null
		if (this.input) this.input.value = ""
		this.emitState(state, "idle")
		return true
	}

	public destroy(): void {
		if (this.destroyed) return
		this.destroyed = true
		this.eventUnsubscribers.forEach((unsubscribe) => unsubscribe())
		// Teardown is silent: the Canvas event emitter is about to be removed and
		// React consumers may already be unmounting. Access changes use cancel()
		// above when a visible state transition is required.
		this.replacementState = null
		if (this.input) {
			this.input.removeEventListener("change", this.handleInputChange)
			this.input.remove()
			this.input = undefined
		}
	}

	public openLocalFilePicker(target: MediaReplacementTarget): void {
		if (
			this.destroyed ||
			!this.canvas.permissionManager.can("document.write") ||
			this.replacementState
		)
			return
		const capturedTarget = this.captureTarget(target)
		if (!capturedTarget) return
		const input = this.ensureInput()
		input.value = ""
		input.accept = MEDIA_ACCEPT[capturedTarget.mediaType]
		input.dataset.elementId = capturedTarget.elementId
		input.dataset.mediaType = capturedTarget.mediaType
		input.dataset.contentId = capturedTarget.contentId ?? ""
		input.click()
	}

	public replaceWithProjectFile(
		target: MediaReplacementTarget & { path: string },
	): Promise<boolean> {
		const capturedTarget = this.captureTarget(target)
		if (!capturedTarget) return Promise.resolve(false)
		return this.performReplacement(capturedTarget, "project-file", () =>
			this.canvas.canvasFileUploadManager.replaceMediaElementFromProject({
				...capturedTarget,
				path: target.path,
			}),
		)
	}

	private readonly handleInputChange = (): void => {
		const input = this.input
		const file = input?.files?.[0]
		const elementId = input?.dataset.elementId
		const mediaType = input?.dataset.mediaType as MediaElementType | undefined
		const contentId = input?.dataset.contentId
		if (
			!input ||
			!file ||
			!elementId ||
			!mediaType ||
			contentId === undefined ||
			this.destroyed
		) {
			return
		}

		const validation = validateFile(file)
		if (!validation.valid || !this.matchesMediaType(file, mediaType)) {
			toast.error(validation.error || this.getUnsupportedMessage(mediaType))
			input.value = ""
			return
		}

		const target = { elementId, mediaType, contentId: contentId || null }
		// 文件选择器打开期间用户仍可能删除元素、删除目标 Content 或切换到其他版本；
		// 重新校验捕获目标，避免把迟到的本地文件写入已失效的目标。
		if (!this.isTargetAvailable(target)) {
			input.value = ""
			return
		}
		void this.performReplacement(target, "local-upload", (operationId) =>
			this.canvas.canvasFileUploadManager.replaceMediaElement({
				...target,
				file,
				onUploadComplete: () => this.transitionToApplying(operationId),
			}),
		).finally(() => {
			input.value = ""
		})
	}

	private async performReplacement(
		target: MediaReplacementTarget,
		source: MediaReplacementSource,
		replace: (operationId: string) => boolean | Promise<boolean>,
	): Promise<boolean> {
		if (
			this.destroyed ||
			!this.canvas.permissionManager.can("document.write") ||
			this.replacementState
		)
			return false

		const operationId = `${target.elementId}:${++this.nextOperationSequence}`
		const phase: MediaReplacementPhase = source === "local-upload" ? "uploading" : "applying"
		this.pauseTargetPlayback(target)
		this.replacementState = { ...target, operationId, source, phase }
		this.emitState(this.replacementState, phase)
		try {
			const success = await replace(operationId)
			if (!this.isCurrentOperation(operationId)) return false
			if (!this.isTargetAvailable(target)) {
				this.finishOperation(operationId, "idle")
				return false
			}
			if (!success) throw new Error(this.getFailedMessage(target.mediaType))
			this.finishOperation(operationId, "idle")
			return true
		} catch (error) {
			if (!this.isCurrentOperation(operationId)) return false
			this.finishOperation(operationId, "error")
			toast.error(
				error instanceof Error && error.message
					? error.message
					: this.getFailedMessage(target.mediaType),
			)
			return false
		}
	}

	private transitionToApplying(operationId: string): void {
		const state = this.replacementState
		if (!state || state.operationId !== operationId || state.phase === "applying") return
		this.replacementState = { ...state, phase: "applying" }
		this.emitState(this.replacementState, "applying")
	}

	private finishOperation(operationId: string, status: "idle" | "error"): void {
		const state = this.replacementState
		if (!state || state.operationId !== operationId) return
		this.replacementState = null
		this.emitState(state, status)
	}

	private isCurrentOperation(operationId: string): boolean {
		return this.replacementState?.operationId === operationId
	}

	private captureTarget(target: MediaReplacementTarget): MediaReplacementTarget | null {
		const element = this.canvas.elementManager.getElementData(target.elementId)
		if (!element || element.type !== target.mediaType) return null
		return {
			...target,
			contentId: target.contentId ?? getActiveContent(element)?.contentId ?? null,
		}
	}

	private isTargetAvailable(target: MediaReplacementTarget): boolean {
		const element = this.canvas.elementManager.getElementData(target.elementId)
		if (!element || element.type !== target.mediaType) return false
		return target.contentId === null || Boolean(getContentById(element, target.contentId))
	}

	private pauseTargetPlayback(target: MediaReplacementTarget): void {
		if (target.mediaType === ElementTypeEnum.Audio) {
			this.canvas.audioPlaybackManager?.pause?.(target.elementId)
			return
		}
		if (target.mediaType !== ElementTypeEnum.Video) return
		const element = this.canvas.elementManager?.getElementInstance?.(target.elementId) as
			| { pauseForReplacement?: () => void }
			| undefined
		element?.pauseForReplacement?.()
	}

	private cancelIfTargetDeleted(elementIds: string[]): void {
		const state = this.replacementState
		if (!state || !elementIds.includes(state.elementId)) return
		this.replacementState = null
		this.emitState(state, "idle")
	}

	private ensureInput(): HTMLInputElement {
		if (this.input) return this.input
		const input = document.createElement("input")
		input.type = "file"
		input.multiple = false
		input.style.display = "none"
		input.addEventListener("change", this.handleInputChange)
		this.canvas.container.appendChild(input)
		this.input = input
		return input
	}

	private matchesMediaType(file: File, mediaType: MediaElementType): boolean {
		switch (mediaType) {
			case ElementTypeEnum.Image:
				return isImageFile(file)
			case ElementTypeEnum.Video:
				return isVideoFile(file)
			case ElementTypeEnum.Audio:
				return isAudioFile(file)
		}
	}

	private getUnsupportedMessage(mediaType: MediaElementType): string {
		switch (mediaType) {
			case ElementTypeEnum.Image:
				return (
					this.canvas.t?.("image.replaceUnsupported", "不支持的图片格式") ??
					"不支持的图片格式"
				)
			case ElementTypeEnum.Video:
				return (
					this.canvas.t?.("video.replaceUnsupported", "不支持的视频格式") ??
					"不支持的视频格式"
				)
			case ElementTypeEnum.Audio:
				return (
					this.canvas.t?.("audio.replaceUnsupported", "不支持的音频格式") ??
					"不支持的音频格式"
				)
		}
	}

	private getFailedMessage(mediaType: MediaElementType): string {
		switch (mediaType) {
			case ElementTypeEnum.Image:
				return (
					this.canvas.t?.("image.replaceFailed", "图片替换失败，请重试") ??
					"图片替换失败，请重试"
				)
			case ElementTypeEnum.Video:
				return (
					this.canvas.t?.("video.replaceFailed", "视频替换失败，请重试") ??
					"视频替换失败，请重试"
				)
			case ElementTypeEnum.Audio:
				return (
					this.canvas.t?.("audio.replaceFailed", "音频替换失败，请重试") ??
					"音频替换失败，请重试"
				)
		}
	}

	private emitState(state: MediaReplacementState, status: MediaReplacementStatus): void {
		const phase = status === "uploading" || status === "applying" ? status : undefined
		this.canvas.eventEmitter.emit({
			type: "element:media:replaceStateChanged",
			data: {
				elementId: state.elementId,
				mediaType: state.mediaType,
				contentId: state.contentId,
				status,
				source: state.source,
				phase,
			},
		})

		// 音频元素内仍有兼容入口；同步旧事件，确保角落按钮的状态反馈不丢失。
		if (state.mediaType === ElementTypeEnum.Audio) {
			this.canvas.eventEmitter.emit({
				type: "element:audio:replaceStateChanged",
				data: {
					elementId: state.elementId,
					contentId: state.contentId,
					status,
					source: state.source,
					phase,
				},
			})
		} else if (state.mediaType === ElementTypeEnum.Image) {
			this.canvas.eventEmitter.emit({
				type: "element:image:replaceStateChanged",
				data: {
					elementId: state.elementId,
					contentId: state.contentId,
					status,
					source: state.source,
					phase,
				},
			})
		}
	}
}
