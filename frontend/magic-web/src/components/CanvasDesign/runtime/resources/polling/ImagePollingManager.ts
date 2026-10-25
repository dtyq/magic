import type { Canvas } from "../../core/Canvas"
import type { ImageElement as ImageElementData, ImageElementContent } from "../../document/types"
import {
	getImageContents,
	getImageContentById,
	isImageElementContent,
	updateImageContent,
} from "../../document/elementContent"
import {
	finalizeMediaSourceReplacement,
	mergeMediaSourceReplacementFields,
} from "../../document/mediaSourceReplacement"
import { GenerationStatus, type GetImageGenerationResultParams } from "../../../public/magic-types"
import { IMAGE_CONFIG } from "../../elements/image/ImageElement.config"
import {
	getImageGenerationId,
	getImageGenerationTiming,
	isPendingImageGeneration,
	parseImageGenerationCreatedAt,
	type ImageGenerationTiming,
} from "../../elements/image/imageGenerationTiming"
import {
	getCanvasHostResourceReferenceResolver,
	resolveCanvasStorageResourceReference,
	resolveCanvasGeneratedResourceStoragePath,
} from "../../shared/path/canvasResourcePath"
import { isBatchImageGenerationTaskMeta } from "../image/imageGenerationTaskMeta"
import {
	extractSmartNameFromFileName,
	getGenerationResultStatusPatch,
	isGenerationTaskNotFoundError,
	shouldContinueGenerationPolling,
} from "./generationPollingUtils"

const AGENT_IMAGE_RECOVERY_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const

interface PollingTarget {
	contentId: string
	content: ImageElementContent
	imageId: string
}

export interface PollingManagerConfig {
	elementId: string
	canvas: Canvas
	getElementData: () => ImageElementData
	onStatusUpdate?: (contentId: string) => void
	/** 仅在成功结果写回的同一次文档更新中决定是否自动激活新 Content。 */
	shouldAutoActivateContent?: (contentId: string) => boolean
	onContentSettled?: (contentId: string) => void
}

/** 图片轮询管理器：同时轮询一个图片节点内所有未完成 Content。 */
export class ImagePollingManager {
	private config: PollingManagerConfig
	private isPolling = false
	private pollingTimer?: ReturnType<typeof setTimeout>
	private pollingRunId = 0
	private pollingRequestSequence = 0
	private inFlightPollingKeys = new Map<string, number>()
	private nextPollAtByKey = new Map<string, number>()
	private observedPollingKeyByIdentity = new Map<string, string>()
	private pausedPollingKeys = new Set<string>()
	private unsubscribeElementUpdated?: () => void
	private unsubscribeGeneration?: () => void
	private deadlineTimer?: ReturnType<typeof setTimeout>
	private timings = new Map<string, ImageGenerationTiming>()
	private expiredTimings = new Set<string>()
	private destroyed = false

	constructor(config: PollingManagerConfig) {
		this.config = config
		this.unsubscribeGeneration = config.canvas.generationRuntimeManager.subscribeElement(
			config.elementId,
			() => this.syncGenerationTiming(),
		)
		const eventEmitter = config.canvas.eventEmitter as typeof config.canvas.eventEmitter & {
			on?: (
				event: "element:updated",
				listener: (event: { data: { elementId: string } }) => void,
			) => () => void
		}
		if (typeof eventEmitter.on === "function") {
			this.unsubscribeElementUpdated = eventEmitter.on("element:updated", (event) => {
				if (event.data?.elementId !== this.config.elementId) return
				this.syncWithElementData()
			})
		}
	}

	public start(): void {
		this.syncWithElementData()
	}

	public stop(): void {
		this.isPolling = false
		this.pollingRunId += 1
		this.clearPollingTimer()
		this.inFlightPollingKeys.clear()
		this.nextPollAtByKey.clear()
	}

	public isActive(): boolean {
		return this.isPolling
	}

	public syncWithElementData(): void {
		this.syncGenerationTiming()
		this.reconcileObservedTargets()
		const targets = this.getPollingTargets()
		if (targets.length === 0) {
			this.clearPollingTimer()
			if (this.inFlightPollingKeys.size === 0 && this.isPolling) this.stop()
			return
		}
		if (!this.isPolling) {
			this.isPolling = true
			this.pollingRunId += 1
		}
		this.schedulePolling(this.pollingRunId)
	}

	public getGenerationTiming(contentId: string): ImageGenerationTiming | undefined {
		return this.timings.get(contentId)
	}

	/**
	 * 等待期限不依赖接口轮询是否暂停。例：Agent 找不到结果文件时停止查文件，
	 * 仍在十分钟后显示超时；真实结果后来写入则自动清除此版本的等待状态。
	 */
	private syncGenerationTiming(): void {
		if (this.destroyed) return
		if (this.deadlineTimer !== undefined) clearTimeout(this.deadlineTimer)
		this.deadlineTimer = undefined
		// 构造图片实例时尚未注册到 ElementManager，等待注册后再保存观察时间。
		if (!this.config.canvas.elementManager.hasElement(this.config.elementId)) {
			queueMicrotask(() => {
				if (
					!this.destroyed &&
					this.config.canvas.elementManager.hasElement(this.config.elementId)
				) {
					this.syncGenerationTiming()
				}
			})
			return
		}
		const element = this.config.getElementData()
		if (!isImageElementContent(element)) return
		if (this.config.canvas.elementManager.isTemporary(this.config.elementId)) return
		const now = Date.now()
		let nextDeadline = Number.POSITIVE_INFINITY
		const activeContentIds = new Set<string>()
		const activeDeadlineKeys = new Set<string>()
		let nextElement = element
		for (const content of getImageContents(element)) {
			const runtime = this.config.canvas.generationRuntimeManager.getTargetState(
				this.config.elementId,
				content.contentId,
			)
			const observedContent = runtime
				? {
						...content,
						generateImageRequest:
							runtime.generateImageRequest ?? content.generateImageRequest,
						imageGenerationTaskMeta:
							runtime.imageGenerationTaskMeta ?? content.imageGenerationTaskMeta,
					}
				: content
			if (!isPendingImageGeneration(observedContent)) continue
			activeContentIds.add(content.contentId)
			const imageId = getImageGenerationId(observedContent)
			const previous = this.timings.get(content.contentId)
			const persisted = getImageGenerationTiming(observedContent)
			const timing =
				persisted ??
				(previous && (previous.imageId === imageId || !previous.imageId)
					? { ...previous, imageId }
					: {
							startedAt: runtime?.startedAt ?? now,
							imageId,
							source: runtime ? ("submitted" as const) : ("observed" as const),
						})
			this.timings.set(content.contentId, timing)
			// 观察时间只在拥有写权限时随既有 DSL 保存；不写入请求或后端状态。
			if (
				!runtime &&
				!persisted &&
				this.config.canvas.permissionManager.can("document.write")
			) {
				nextElement = updateImageContent(nextElement, content.contentId, {
					generationTiming: timing,
				})
			}
			const deadline = timing.startedAt + IMAGE_CONFIG.GENERATION_TIMEOUT_MS + 1
			const deadlineKey = `${content.contentId}:${imageId ?? ""}:${timing.startedAt}`
			activeDeadlineKeys.add(deadlineKey)
			if (deadline <= now) {
				if (!this.expiredTimings.has(deadlineKey)) {
					this.expiredTimings.add(deadlineKey)
					this.config.canvas.eventEmitter.emit({
						type: "element:image:displayStateChanged",
						data: { elementId: this.config.elementId, contentId: content.contentId },
					})
				}
			} else {
				nextDeadline = Math.min(nextDeadline, deadline)
			}
		}
		for (const contentId of this.timings.keys()) {
			if (!activeContentIds.has(contentId)) this.timings.delete(contentId)
		}
		for (const key of this.expiredTimings) {
			if (!activeDeadlineKeys.has(key)) this.expiredTimings.delete(key)
		}
		if (nextElement !== element) {
			this.config.canvas.elementManager.update(
				this.config.elementId,
				{ contents: nextElement.contents },
				{ silent: false, historyPolicy: "exclude" },
			)
			return
		}
		if (Number.isFinite(nextDeadline)) {
			this.deadlineTimer = setTimeout(
				() => this.syncGenerationTiming(),
				Math.max(0, nextDeadline - now),
			)
		}
	}

	/**
	 * 只启动当前尚未 in-flight 且已到期的目标。元素更新可以随时调用该方法：
	 * 相同目标会被去重，新追加的 Content 则无需等待其他 Content 完成即可开始轮询。
	 */
	private schedulePolling(pollingRunId: number): void {
		if (!this.isCurrentPollingRunId(pollingRunId)) return
		this.clearPollingTimer()
		const targets = this.getPollingTargets()
		if (targets.length === 0) {
			if (this.inFlightPollingKeys.size === 0) this.stopIfCurrentRun(pollingRunId)
			return
		}

		const now = Date.now()
		let nextPollAt = Number.POSITIVE_INFINITY
		for (const target of targets) {
			const pollingKey = this.getPollingKey(target)
			if (this.inFlightPollingKeys.has(pollingKey)) continue

			const targetNextPollAt = this.nextPollAtByKey.get(pollingKey)
			if (targetNextPollAt === undefined || targetNextPollAt <= now) {
				this.startPollingTarget(target, pollingRunId, pollingKey)
				continue
			}
			nextPollAt = Math.min(nextPollAt, targetNextPollAt)
		}

		if (Number.isFinite(nextPollAt)) {
			this.pollingTimer = setTimeout(
				() => {
					this.pollingTimer = undefined
					this.schedulePolling(pollingRunId)
				},
				Math.max(0, nextPollAt - Date.now()),
			)
		}
	}

	private startPollingTarget(
		target: PollingTarget,
		pollingRunId: number,
		pollingKey: string,
	): void {
		const requestSequence = ++this.pollingRequestSequence
		this.inFlightPollingKeys.set(pollingKey, requestSequence)
		this.nextPollAtByKey.delete(pollingKey)

		void this.pollTarget(target, pollingRunId).finally(() => {
			if (!this.isCurrentPollingRunId(pollingRunId)) return
			if (this.inFlightPollingKeys.get(pollingKey) !== requestSequence) return

			this.inFlightPollingKeys.delete(pollingKey)
			this.reconcileObservedTargets()
			const stillCurrent = this.getPollingTargets().some(
				(candidate) => this.getPollingKey(candidate) === pollingKey,
			)
			if (stillCurrent) {
				this.nextPollAtByKey.set(pollingKey, Date.now() + IMAGE_CONFIG.POLLING_INTERVAL)
			} else {
				this.nextPollAtByKey.delete(pollingKey)
			}
			this.schedulePolling(pollingRunId)
		})
	}

	private async pollTarget(target: PollingTarget, pollingRunId: number): Promise<void> {
		const imageIdSource = this.getImageIdSource(target)
		if (imageIdSource === "agent") {
			await this.recoverAgentGeneratedFile(target, pollingRunId)
			return
		}
		if (imageIdSource === "unknown") {
			this.pausedPollingKeys.add(this.getTargetIdentity(target))
			return
		}
		await this.pollGenerationResult(target, pollingRunId)
	}

	private getCandidateTargets(): PollingTarget[] {
		const element = this.config.getElementData()
		if (!isImageElementContent(element)) return []
		const targets: PollingTarget[] = []
		for (const content of getImageContents(element)) {
			const imageId = this.getContentPollingImageId(content)
			if (!imageId || content.src) continue
			if (content.status && !shouldContinueGenerationPolling(content.status)) continue
			targets.push({ contentId: content.contentId, content, imageId })
		}
		return targets
	}

	private getPollingTargets(): PollingTarget[] {
		return this.getCandidateTargets().filter(
			(target) => !this.pausedPollingKeys.has(this.getTargetIdentity(target)),
		)
	}

	/**
	 * paused 状态只属于具体的 contentId + imageId；普通几何更新不会解除暂停，
	 * 任务 ID 或来源真正变化时，会通过 observed key 变化解除旧暂停并重新调度。
	 */
	private reconcileObservedTargets(): void {
		const nextPollingKeyByIdentity = new Map<string, string>()
		for (const target of this.getCandidateTargets()) {
			nextPollingKeyByIdentity.set(this.getTargetIdentity(target), this.getPollingKey(target))
		}

		for (const identity of this.pausedPollingKeys) {
			if (
				this.observedPollingKeyByIdentity.get(identity) !==
				nextPollingKeyByIdentity.get(identity)
			) {
				this.pausedPollingKeys.delete(identity)
			}
		}

		const nextPollingKeys = new Set(nextPollingKeyByIdentity.values())
		for (const pollingKey of this.nextPollAtByKey.keys()) {
			if (!nextPollingKeys.has(pollingKey)) this.nextPollAtByKey.delete(pollingKey)
		}
		this.observedPollingKeyByIdentity = nextPollingKeyByIdentity
	}

	private getContentPollingImageId(content: ImageElementContent): string | undefined {
		if (content.generateImageRequest?.image_id) return content.generateImageRequest.image_id
		const taskMeta = content.imageGenerationTaskMeta
		if (isBatchImageGenerationTaskMeta(taskMeta)) return undefined
		return taskMeta?.image_id
	}

	private getPollingKey(target: PollingTarget): string {
		return `${target.contentId}:${target.imageId}:${this.getImageIdSource(target)}`
	}

	private getTargetIdentity(target: PollingTarget): string {
		return `${target.contentId}:${target.imageId}`
	}

	private getCurrentTarget(
		pollingRunId: number,
		target: PollingTarget,
	): PollingTarget | undefined {
		if (!this.isPolling || this.pollingRunId !== pollingRunId) return undefined
		return this.getPollingTargets().find(
			(candidate) => this.getPollingKey(candidate) === this.getPollingKey(target),
		)
	}

	private isCurrentPollingRun(pollingRunId: number, target?: PollingTarget): boolean {
		if (!this.isCurrentPollingRunId(pollingRunId)) return false
		return !target || Boolean(this.getCurrentTarget(pollingRunId, target))
	}

	/**
	 * 判断异步回调仍属于当前轮询生命周期。目标身份变化时，旧回调需要触发一次
	 * syncWithElementData()，而不能因为目标 key 已变化就把管理器永久留在 active 状态。
	 */
	private isCurrentPollingRunId(pollingRunId: number): boolean {
		return this.isPolling && this.pollingRunId === pollingRunId
	}

	private stopIfCurrentRun(pollingRunId: number): void {
		if (this.isCurrentPollingRunId(pollingRunId)) this.stop()
	}

	private clearPollingTimer(): void {
		if (this.pollingTimer === undefined) return
		clearTimeout(this.pollingTimer)
		this.pollingTimer = undefined
	}

	private hasPatchChanges(current: object, patch: object): boolean {
		const currentRecord = current as Record<string, unknown>
		return Object.entries(patch).some(([key, value]) => currentRecord[key] !== value)
	}

	private getImageIdSource(target: PollingTarget): "agent" | "user" | "inline" | "unknown" {
		if (target.content.imageGenerationTaskMeta?.image_id === target.imageId) return "inline"

		const runtimeManager = (
			this.config.canvas as Canvas & {
				elementDetailsRuntimeManager?: {
					getGenerateImageRequestImageIdSource: (
						elementId: string,
						imageId?: string,
						contentId?: string,
					) => "agent" | "user" | "inline" | "unknown"
				}
			}
		).elementDetailsRuntimeManager

		return (
			runtimeManager?.getGenerateImageRequestImageIdSource(
				this.config.elementId,
				target.imageId,
				target.contentId,
			) ?? "inline"
		)
	}

	private primeGeneratedImageResource(
		path: string,
		fileUrl: string | null | undefined,
		fileName: string,
	): void {
		if (!fileUrl) return
		this.config.canvas.imageResourceManager.primeCache(path, {
			src: fileUrl,
			fileName,
			resource_version: `generated:${fileName}`,
		})
	}

	private async pollGenerationResult(target: PollingTarget, pollingRunId: number): Promise<void> {
		const getImageGenerationResult =
			this.config.canvas.magicConfigManager.config?.methods?.getImageGenerationResult
		if (!getImageGenerationResult) {
			this.stopIfCurrentRun(pollingRunId)
			return
		}

		try {
			const params: GetImageGenerationResultParams = { image_id: target.imageId }
			const result = await getImageGenerationResult(params)
			if (!this.isCurrentPollingRun(pollingRunId, target)) {
				this.syncWithElementData()
				return
			}

			const storagePath =
				result.file_dir && result.file_name
					? resolveCanvasGeneratedResourceStoragePath(
							this.config.canvas,
							result.file_dir,
							result.file_name,
						)
					: undefined
			if (storagePath && result.file_name) {
				this.primeGeneratedImageResource(storagePath, result.file_url, result.file_name)
			}

			const currentElement = this.config.getElementData()
			if (!isImageElementContent(currentElement)) return
			const currentContent = getImageContentById(currentElement, target.contentId)
			if (!currentContent) return
			const createdAt = parseImageGenerationCreatedAt(result.created_at)
			const contentPatch = mergeMediaSourceReplacementFields(currentContent, {
				...(createdAt !== undefined &&
				currentContent.generationTiming?.startedAt !== createdAt
					? {
							generationTiming: {
								startedAt: createdAt,
								imageId: target.imageId,
								source: "server" as const,
							},
						}
					: {}),
				...getGenerationResultStatusPatch(
					result.status,
					result.error_message,
					Boolean(storagePath),
				),
				...(storagePath ? { src: storagePath } : {}),
			})
			const shouldActivate =
				result.status === GenerationStatus.Completed &&
				Boolean(storagePath) &&
				this.config.shouldAutoActivateContent?.(target.contentId)
			const namePatch =
				storagePath &&
				result.file_name &&
				!currentElement.name &&
				!target.content.imageGenerationTaskMeta
					? { name: extractSmartNameFromFileName(result.file_name) }
					: {}
			const didUpdateElement =
				this.hasPatchChanges(currentContent, contentPatch) || shouldActivate
			if (didUpdateElement) {
				const nextElement = updateImageContent(
					currentElement,
					target.contentId,
					contentPatch,
				)
				this.config.canvas.elementManager.update(
					this.config.elementId,
					{
						...namePatch,
						contents: nextElement.contents,
						...(shouldActivate ? { activeContentId: target.contentId } : {}),
					},
					{ silent: false, historyPolicy: "exclude" },
				)
				if (storagePath) {
					finalizeMediaSourceReplacement(this.config.canvas, {
						previousSrc: currentContent.src,
						nextSrc: storagePath,
						previousComplianceCheckId: currentContent.complianceCheckId,
						previousAssetId: currentContent.assetId,
					})
				}
			}

			if (didUpdateElement) {
				this.config.canvas.eventEmitter.emit({
					type: "element:image:resultUpdated",
					data: { elementId: this.config.elementId },
				})
			}

			if (!shouldContinueGenerationPolling(contentPatch.status ?? result.status)) {
				this.config.onContentSettled?.(target.contentId)
			}
		} catch (error) {
			if (!this.isCurrentPollingRun(pollingRunId, target)) {
				this.syncWithElementData()
				return
			}
			if (isGenerationTaskNotFoundError(error, target.imageId)) {
				this.recoverMissingTask(target, pollingRunId)
				return
			}
			// 单个 Content 查询失败不能终止同一图片元素的其他 Content 轮询。
			this.pausedPollingKeys.add(this.getTargetIdentity(target))
			this.config.onStatusUpdate?.(target.contentId)
		}
	}

	private canApplyAgentRecovery(pollingRunId: number, target: PollingTarget): boolean {
		if (!this.isCurrentPollingRun(pollingRunId, target)) return false
		const current = this.getPollingTargets().find(
			(candidate) => this.getPollingKey(candidate) === this.getPollingKey(target),
		)
		return Boolean(
			current && !current.content.src && this.getImageIdSource(current) === "agent",
		)
	}

	private async recoverAgentGeneratedFile(
		target: PollingTarget,
		pollingRunId: number,
	): Promise<void> {
		const getFileInfo = this.config.canvas.magicConfigManager.config?.methods?.getFileInfo
		const resolveResourceReference = getCanvasHostResourceReferenceResolver(this.config.canvas)
		if (!getFileInfo || !resolveResourceReference) {
			this.pausedPollingKeys.add(this.getTargetIdentity(target))
			return
		}

		for (const extension of AGENT_IMAGE_RECOVERY_EXTENSIONS) {
			if (!this.canApplyAgentRecovery(pollingRunId, target)) {
				this.syncWithElementData()
				return
			}
			const fileName = `${target.imageId}.${extension}`
			const candidatePath = `images/${fileName}`
			try {
				const result = await getFileInfo(candidatePath, {
					useImageProcess: false,
					forceRefresh: true,
					priority: "background",
				})
				if (!result?.src || !this.canApplyAgentRecovery(pollingRunId, target)) continue
				const resolution = resolveCanvasStorageResourceReference(
					candidatePath,
					resolveResourceReference,
					{ requireAttachment: true },
				)
				if (
					resolution.status !== "resolved" ||
					resolution.resourceKind !== "workspace-file"
				) {
					continue
				}
				const persistedPath = resolution.storagePath
				this.primeGeneratedImageResource(
					persistedPath,
					result.src,
					result.fileName || fileName,
				)
				const currentElement = this.config.getElementData()
				if (!isImageElementContent(currentElement)) return
				const currentContent = getImageContentById(currentElement, target.contentId)
				if (!currentContent) return
				const recoveryPatch = mergeMediaSourceReplacementFields(currentContent, {
					src: persistedPath,
					status: GenerationStatus.Completed,
					errorMessage: undefined,
				})
				const nextElement = updateImageContent(
					currentElement,
					target.contentId,
					recoveryPatch,
				)
				this.config.canvas.elementManager.update(
					this.config.elementId,
					{ contents: nextElement.contents },
					{ silent: false, historyPolicy: "exclude" },
				)
				finalizeMediaSourceReplacement(this.config.canvas, {
					previousSrc: currentContent.src,
					nextSrc: persistedPath,
					previousComplianceCheckId: currentContent.complianceCheckId,
					previousAssetId: currentContent.assetId,
				})
				this.config.canvas.eventEmitter.emit({
					type: "element:image:resultUpdated",
					data: { elementId: this.config.elementId },
				})
				return
			} catch {
				// 继续检查其他后缀；找不到文件不代表 Agent 任务失败。
			}
		}
		this.pausedPollingKeys.add(this.getTargetIdentity(target))
	}

	private recoverMissingTask(target: PollingTarget, pollingRunId: number): void {
		if (!this.isCurrentPollingRun(pollingRunId, target)) return
		if (this.getImageIdSource(target) === "agent") return
		const element = this.config.getElementData()
		if (!isImageElementContent(element)) return
		const targetContent = getImageContentById(element, target.contentId)
		if (!targetContent) return
		if (
			element.contents.length === 1 &&
			targetContent.imageGenerationTaskMeta?.image_id === target.imageId
		) {
			this.config.canvas.elementManager.delete(this.config.elementId)
			return
		}
		const next = updateImageContent(element, target.contentId, {
			status: GenerationStatus.Failed,
			errorMessage: undefined,
		})
		this.config.canvas.elementManager.update(
			this.config.elementId,
			{ contents: next.contents },
			{ silent: false, historyPolicy: "exclude" },
		)
		this.config.onContentSettled?.(target.contentId)
		this.config.canvas.eventEmitter.emit({
			type: "element:image:generate-submit-failed",
			data: { elementId: this.config.elementId },
		})
	}

	public destroy(): void {
		this.destroyed = true
		if (this.deadlineTimer !== undefined) clearTimeout(this.deadlineTimer)
		this.unsubscribeGeneration?.()
		this.timings.clear()
		this.expiredTimings.clear()
		this.stop()
		this.unsubscribeElementUpdated?.()
		this.unsubscribeElementUpdated = undefined
	}
}
