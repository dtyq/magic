import { SuperMagicApi } from "@/apis"
import type { SuperMagicTopicModelResponse } from "@/apis/modules/superMagic"
import { logger as Logger } from "@/infrastructure/logger"
import superMagicTopicModelCacheService, {
	type CachedModelData,
} from "./SuperMagicTopicModelCacheService"
import topicModelStore from "@/stores/superMagic/topicModelStore"
import superMagicModeService, { resolveModeMapKey } from "../SuperMagicModeService"
import { ModelItem, ModelStatusEnum } from "@/pages/superMagic/components/MessageEditor/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { reaction } from "mobx"
import { DEFAULT_TOPIC_ID } from "./constants"

const logger = Logger.createLogger("SuperMagicTopicModelService")

/**
 * Pending save data structure
 */
interface PendingSaveData {
	topicId: string
	projectId: string
	cacheId: string // The actual cache_id to use for backend API (topic/project/default)
	languageModel: ModelItem | null
	imageModel: ModelItem | null
	videoModel: ModelItem | null
	timestamp: number
}

export interface SuperMagicTopicModelStoreLike {
	selectedLanguageModel: ModelItem | null
	selectedImageModel: ModelItem | null
	selectedVideoModel: ModelItem | null
	isLoading: boolean
	currentTopicId: string
	currentProjectId: string
	currentTopicMode: TopicMode
	/** Agent code when topic_mode is custom_agent */
	currentAgentCode: string
	/** Context key whose model data has completed loading */
	loadedContextKey: string
	setSelectedLanguageModel: (model: ModelItem | null) => void
	setSelectedImageModel: (model: ModelItem | null) => void
	setSelectedVideoModel: (model: ModelItem | null) => void
	setLoading: (loading: boolean) => void
	markCurrentContextLoaded: (contextKey: string) => void
}

/**
 * Level model fetch result
 */
interface LevelModelResult {
	success: boolean
	languageModel: ModelItem | null
	imageModel: ModelItem | null
	videoModel: ModelItem | null
	hasValidRemoteData: boolean // 远程是否有有效数据
	usedLocalCache: boolean
}

interface NormalizedModelsResult {
	languageModel: ModelItem | null
	imageModel: ModelItem | null
	videoModel: ModelItem | null
	needsUpdate: boolean
}

interface ModelContext {
	topicId: string
	projectId: string
	topicMode: TopicMode
	agentCode?: string | null
}

interface CascadeBackfillModels {
	languageModel: ModelItem | null
	imageModel: ModelItem | null
	videoModel: ModelItem | null
}

/** [topicId, projectId, topicMode, agentCode]; missing agent is "". */
export function getTopicModelContextKey(context: {
	topicId: string
	projectId: string
	topicMode: string
	agentCode?: string | null
}) {
	return JSON.stringify([
		context.topicId,
		context.projectId,
		context.topicMode,
		context.agentCode ?? "",
	])
}

interface ModelRequestGuard {
	requestId: number
	requestedContext: ModelContext
	/** Only the first discard is reported, to keep one line per request. */
	staleReported?: boolean
}

/** Reports events with the owning requestId attached. */
type RequestReporter = (message: string, payload?: Record<string, unknown>) => void

function toErrorLogFields(error: unknown): Record<string, unknown> {
	if (error instanceof Error) {
		return {
			errorName: error.name,
			errorMessage: error.message,
		}
	}

	if (error && typeof error === "object") {
		const record = error as Record<string, unknown>
		return {
			...(typeof record.code === "string" || typeof record.code === "number"
				? { errorCode: record.code }
				: {}),
			errorMessage:
				typeof record.message === "string" ? record.message : "Unknown backend error",
		}
	}

	return {
		errorMessage: typeof error === "string" ? error : "Unknown backend error",
	}
}

function toResponseLogFields(response: SuperMagicTopicModelResponse): Record<string, unknown> {
	return {
		...(typeof response.success === "boolean" ? { success: response.success } : {}),
		...(typeof response.code === "string" || typeof response.code === "number"
			? { code: response.code }
			: {}),
		...(typeof response.message === "string" ? { message: response.message } : {}),
	}
}

function isExplicitRejectedResponse(response: SuperMagicTopicModelResponse): boolean {
	return response.success === false
}

/**
 * Super Magic Topic Model Service
 * Handles model fetching, caching, and synchronization
 */
class SuperMagicTopicModelService {
	// Debounce timers, managed by topicId
	private debounceTimers = new Map<string, NodeJS.Timeout>()

	// Debounce delay in milliseconds
	private readonly DEBOUNCE_DELAY = 500

	// Pending saves buffer, stores latest model combinations
	private pendingSaves = new Map<string, PendingSaveData>()

	// Store reaction disposers (support multiple store instances)
	private reactionDisposers = new WeakMap<SuperMagicTopicModelStoreLike, () => void>()
	private storeReferenceCounts = new WeakMap<SuperMagicTopicModelStoreLike, number>()
	private activeReactionDisposers = new Set<() => void>()
	private requestIds = new WeakMap<SuperMagicTopicModelStoreLike, number>()

	// Register beforeunload only once
	private isBeforeUnloadRegistered = false

	private isCurrentContext(store: SuperMagicTopicModelStoreLike, context: ModelContext) {
		return (
			store.currentTopicId === context.topicId &&
			store.currentProjectId === context.projectId &&
			store.currentTopicMode === context.topicMode &&
			store.currentAgentCode === (context.agentCode ?? "")
		)
	}

	private createRequestGuard(
		store: SuperMagicTopicModelStoreLike,
		requestedContext: ModelContext,
	): ModelRequestGuard {
		const requestId = (this.requestIds.get(store) ?? 0) + 1
		this.requestIds.set(store, requestId)

		return {
			requestId,
			requestedContext,
		}
	}

	private invalidateRequests(store: SuperMagicTopicModelStoreLike) {
		this.requestIds.set(store, (this.requestIds.get(store) ?? 0) + 1)
	}

	private isCurrentRequest(store: SuperMagicTopicModelStoreLike, guard: ModelRequestGuard) {
		const latestRequestId = this.requestIds.get(store)
		const isLatestRequest = latestRequestId === guard.requestId
		if (isLatestRequest && this.isCurrentContext(store, guard.requestedContext)) return true

		if (!guard.staleReported) {
			guard.staleReported = true
			logger.report("[Request] Discarding stale request", {
				requestId: guard.requestId,
				latestRequestId,
				reason: isLatestRequest ? "context changed" : "superseded by newer request",
				requestedContextKey: getTopicModelContextKey(guard.requestedContext),
				currentContextKey: getTopicModelContextKey({
					topicId: store.currentTopicId,
					projectId: store.currentProjectId,
					topicMode: store.currentTopicMode,
					agentCode: store.currentAgentCode,
				}),
			})
		}

		return false
	}

	private createRequestReporter(requestId: number): RequestReporter {
		return (message, payload = {}) => logger.report(message, { requestId, ...payload })
	}

	private toCachedModelData(models: CascadeBackfillModels): CachedModelData {
		return {
			languageModelId: models.languageModel?.model_id,
			imageModelId: models.imageModel?.model_id,
			videoModelId: models.videoModel?.model_id,
			timestamp: Date.now(),
		}
	}

	/** Write local then remote as a pair once the request is still current. */
	private async persistCascadeBackfill(
		isCurrentRequest: () => boolean,
		{
			level,
			cacheId,
			models,
			saveLocal,
			report,
			logContext = {},
		}: {
			level: "Topic" | "Project" | "ModeDefault"
			cacheId: string
			models: CascadeBackfillModels
			saveLocal: (data: CachedModelData) => Promise<void>
			report: RequestReporter
			logContext?: Record<string, unknown>
		},
	) {
		if (!isCurrentRequest()) return
		const modelIds = {
			languageModelId: models.languageModel?.model_id,
			imageModelId: models.imageModel?.model_id,
			videoModelId: models.videoModel?.model_id,
		}
		report(`[Fallback] Backfilling ${level} level`, { ...logContext, ...modelIds })
		await saveLocal(this.toCachedModelData(models))
		try {
			const response = await SuperMagicApi.saveSuperMagicTopicModel({
				cache_id: cacheId,
				model_id: models.languageModel?.model_id,
				image_model_id: models.imageModel?.model_id,
				video_model_id: models.videoModel?.model_id,
			})
			if (isExplicitRejectedResponse(response)) {
				report(`[Fallback] ${level} remote backfill rejected`, {
					...logContext,
					...modelIds,
					cacheId,
					...toResponseLogFields(response),
				})
			} else {
				logger.log(`Backfilled ${level} level remotely`, {
					...logContext,
					...modelIds,
				})
			}
		} catch (error) {
			report(`[Fallback] ${level} remote backfill failed`, {
				...logContext,
				...modelIds,
				cacheId,
				...toErrorLogFields(error),
			})
		}
	}

	/**
	 * Initialize service - set up Store reaction
	 */
	init() {
		this.initForStore(topicModelStore)
	}

	/**
	 * Initialize service for a specific store instance
	 * This enables multiple independent UI instances.
	 */
	initForStore(store: SuperMagicTopicModelStoreLike) {
		const existing = this.reactionDisposers.get(store)
		if (existing) {
			const nextReferenceCount = (this.storeReferenceCounts.get(store) ?? 0) + 1
			this.storeReferenceCounts.set(store, nextReferenceCount)
			logger.log("Service already initialized for store", {
				referenceCount: nextReferenceCount,
			})
			return
		}

		// Listen to Store's context changes and trigger model fetching
		const disposer = reaction(
			() => ({
				topicId: store.currentTopicId,
				projectId: store.currentProjectId,
				topicMode: store.currentTopicMode,
				agentCode: store.currentAgentCode,
			}),
			async ({ topicId, projectId, topicMode, agentCode }, prev) => {
				this.invalidateRequests(store)
				logger.report("[Context] Context changed", {
					prevTopicId: prev?.topicId,
					prevProjectId: prev?.projectId,
					prevTopicMode: prev?.topicMode,
					prevAgentCode: prev?.agentCode,
					newTopicId: topicId,
					newProjectId: projectId,
					newTopicMode: topicMode,
					newAgentCode: agentCode,
				})

				// Flush old topic's pending save before switching
				if (prev && prev.topicId && prev.topicId !== topicId) {
					logger.report("[Context] Flushing old topic before switching", {
						oldTopicId: prev.topicId,
						newTopicId: topicId,
					})
					await this.flushAll(prev.topicId)
				}

				// 同话题切 mode/Agent 仍走 fetch：目录和 ModeDefault 按 mode/Agent
				// 隔离。内存校验会跳过新模式已存配置，未加载完时还可能把空模型
				// 当成无效并写入 Auto。
				if (
					prev &&
					prev.topicId &&
					prev.topicId === topicId &&
					prev.topicMode &&
					(prev.topicMode !== topicMode || prev.agentCode !== agentCode)
				) {
					logger.report("[Context] Topic mode changed, refetching", {
						oldMode: prev.topicMode,
						newMode: topicMode,
						oldAgentCode: prev.agentCode,
						newAgentCode: agentCode,
					})
				}

				// Skip if both are empty (unstable phase), but NOT if topicId="default"
				// topicId="default" + projectId="" = workspace home, should fetch ModeDefault
				// topicId="" + projectId="" = unstable phase, should skip
				if (!topicId && !projectId && !topicMode) {
					logger.report("[Context] Skipping fetch (unstable phase)", {
						topicId,
						projectId,
						topicMode,
					})
					return
				}
				await this.fetchTopicModel(topicId, projectId, topicMode, store)
			},
			{ fireImmediately: true },
		)

		this.reactionDisposers.set(store, disposer)
		this.storeReferenceCounts.set(store, 1)
		this.activeReactionDisposers.add(disposer)

		logger.log("Service initialized with Store reaction (per-store)")

		// Register beforeunload handler
		if (typeof window !== "undefined" && !this.isBeforeUnloadRegistered) {
			window.addEventListener("beforeunload", this.handleBeforeUnload)
			this.isBeforeUnloadRegistered = true
		}
	}

	/**
	 * Destroy reaction for a specific store instance
	 * Called by hook cleanup to avoid leaks.
	 */
	destroyForStore(store: SuperMagicTopicModelStoreLike) {
		const disposer = this.reactionDisposers.get(store)
		if (!disposer) return
		const currentReferenceCount = this.storeReferenceCounts.get(store) ?? 0
		if (currentReferenceCount > 1) {
			this.storeReferenceCounts.set(store, currentReferenceCount - 1)
			return
		}
		disposer()
		this.reactionDisposers.delete(store)
		this.storeReferenceCounts.delete(store)
		this.invalidateRequests(store)
		this.activeReactionDisposers.delete(disposer)
	}

	/**
	 * Handle page unload - send pending saves
	 */
	private handleBeforeUnload = () => {
		const pendingCount = this.pendingSaves.size
		if (pendingCount > 0) {
			const pending = Array.from(this.pendingSaves.values())
			for (const data of pending) {
				// Use sendBeacon for async non-blocking request
				const body = JSON.stringify({
					model_id: data.languageModel?.model_id,
					image_model_id: data.imageModel?.model_id,
					video_model_id: data.videoModel?.model_id,
				})
				navigator.sendBeacon(
					`/api/v1/contact/users/setting/super-magic/topic-model/${data.topicId}`,
					body,
				)
			}
			logger.log("Sent pending saves via sendBeacon", { count: pendingCount })
		}
	}

	/**
	 * Get the first usable model from list
	 * @param modelList - Model list
	 * @returns First usable model or null
	 */
	private getFirstUsableModel(modelList: ModelItem[]): ModelItem | null {
		return modelList.find((item) => item.model_status === ModelStatusEnum.Normal) || null
	}

	/**
	 * Resolve language model by mode.
	 */
	private async resolveLanguageModel(
		topicMode: TopicMode,
		modelId?: string | null,
		agentCode?: string | null,
	): Promise<ModelItem | null> {
		const model = await superMagicModeService.resolveLanguageModelByMode(
			topicMode,
			modelId,
			agentCode,
		)
		if (model?.model_status !== ModelStatusEnum.Normal) return null
		return model
	}

	/**
	 * Resolve image model by mode.
	 */
	private async resolveImageModel(
		topicMode: TopicMode,
		modelId?: string | null,
		agentCode?: string | null,
	): Promise<ModelItem | null> {
		const model = await superMagicModeService.resolveImageModelByMode(
			topicMode,
			modelId,
			agentCode,
		)
		if (model?.model_status !== ModelStatusEnum.Normal) return null
		return model
	}

	/**
	 * Resolve video model by mode.
	 */
	private async resolveVideoModel(
		topicMode: TopicMode,
		modelId?: string | null,
		agentCode?: string | null,
	): Promise<ModelItem | null> {
		const model = await superMagicModeService.resolveVideoModelByMode(
			topicMode,
			modelId,
			agentCode,
		)
		if (model?.model_status !== ModelStatusEnum.Normal) return null
		return model
	}

	/**
	 * Validate if model can still be resolved.
	 */
	private async isModelValid(
		model: ModelItem | null,
		topicMode: TopicMode,
		modelType: "language" | "image" | "video",
		agentCode?: string | null,
	): Promise<boolean> {
		if (!model) return false

		if (modelType === "image") {
			const resolvedModel = await this.resolveImageModel(topicMode, model.model_id, agentCode)
			return resolvedModel !== null
		}
		if (modelType === "video") {
			const resolvedModel = await this.resolveVideoModel(topicMode, model.model_id, agentCode)
			return resolvedModel !== null
		}

		const resolvedModel = await this.resolveLanguageModel(topicMode, model.model_id, agentCode)
		return resolvedModel !== null
	}

	private async normalizeModelsForMode({
		topicMode,
		languageModel,
		imageModel,
		videoModel,
		agentCode,
	}: {
		topicMode: TopicMode
		languageModel: ModelItem | null
		imageModel: ModelItem | null
		videoModel: ModelItem | null
		agentCode?: string | null
	}): Promise<NormalizedModelsResult> {
		const modelList = superMagicModeService.getModelListByMode(topicMode, agentCode)
		const imageModelList = superMagicModeService.getImageModelListByMode(topicMode, agentCode)
		const videoModelList = superMagicModeService.getVideoModelListByMode(topicMode, agentCode)

		let nextLanguageModel = languageModel
		let nextImageModel = imageModel
		let nextVideoModel = videoModel
		let needsUpdate = false

		if (!(await this.isModelValid(nextLanguageModel, topicMode, "language", agentCode))) {
			nextLanguageModel = this.getFirstUsableModel(modelList)
			needsUpdate = true
		}

		if (!(await this.isModelValid(nextImageModel, topicMode, "image", agentCode))) {
			nextImageModel = this.getFirstUsableModel(imageModelList)
			needsUpdate = true
		}

		if (!(await this.isModelValid(nextVideoModel, topicMode, "video", agentCode))) {
			nextVideoModel = this.getFirstUsableModel(videoModelList)
			needsUpdate = true
		}

		return {
			languageModel: nextLanguageModel,
			imageModel: nextImageModel,
			videoModel: nextVideoModel,
			needsUpdate,
		}
	}

	/**
	 * Validate models for current mode
	 * Called when topic mode changes
	 * @param topicMode - New topic mode
	 * @param store - Store instance
	 */
	private async validateModelsForMode(
		topicMode: TopicMode,
		store: SuperMagicTopicModelStoreLike = topicModelStore,
	) {
		const agentCode = store.currentAgentCode || null
		const context = {
			topicId: store.currentTopicId,
			projectId: store.currentProjectId,
			topicMode,
			agentCode,
		}
		if (!this.isCurrentContext(store, context)) return
		const contextKey = getTopicModelContextKey(context)
		// 当前上下文尚未加载完成时不校验，避免把空/旧模型当成无效并写入 Auto
		if (store.loadedContextKey !== contextKey) {
			logger.report("[Validate] Skip validation before models are loaded", {
				topicMode,
				agentCode,
				contextKey,
				loadedContextKey: store.loadedContextKey,
			})
			return
		}
		const requestGuard = this.createRequestGuard(store, context)
		const isCurrentRequest = () => this.isCurrentRequest(store, requestGuard)
		const report = this.createRequestReporter(requestGuard.requestId)
		store.setLoading(true)

		const previousLanguageModel = store.selectedLanguageModel
		const previousImageModel = store.selectedImageModel
		const previousVideoModel = store.selectedVideoModel
		report("[Validate] Mode validation started", {
			topicMode,
			agentCode,
			currentLanguageModelId: previousLanguageModel?.model_id,
			currentImageModelId: previousImageModel?.model_id,
			currentVideoModelId: previousVideoModel?.model_id,
		})

		try {
			const modelList = superMagicModeService.getModelListByMode(topicMode, agentCode)
			const imageModelList = superMagicModeService.getImageModelListByMode(
				topicMode,
				agentCode,
			)
			const videoModelList = superMagicModeService.getVideoModelListByMode(
				topicMode,
				agentCode,
			)
			const { languageModel, imageModel, videoModel, needsUpdate } =
				await this.normalizeModelsForMode({
					topicMode,
					languageModel: previousLanguageModel,
					imageModel: previousImageModel,
					videoModel: previousVideoModel,
					agentCode,
				})
			if (!isCurrentRequest()) return
			if (languageModel?.model_id !== previousLanguageModel?.model_id) {
				report("[Validate] Language model invalid for mode, switching", {
					topicMode,
					oldModelId: previousLanguageModel?.model_id,
					newModelId: languageModel?.model_id,
					availableModelsCount: modelList.length,
				})
			}

			if (imageModel?.model_id !== previousImageModel?.model_id) {
				report("[Validate] Image model invalid for mode, switching", {
					topicMode,
					oldModelId: previousImageModel?.model_id,
					newModelId: imageModel?.model_id,
					availableModelsCount: imageModelList.length,
				})
			}

			if (videoModel?.model_id !== previousVideoModel?.model_id) {
				report("[Validate] Video model invalid for mode, switching", {
					topicMode,
					oldModelId: previousVideoModel?.model_id,
					newModelId: videoModel?.model_id,
					availableModelsCount: videoModelList.length,
				})
			}

			// Update Store if needed
			if (needsUpdate) {
				store.setSelectedLanguageModel(languageModel)
				store.setSelectedImageModel(imageModel)
				store.setSelectedVideoModel(videoModel)

				report("[Validate] Models updated, saving to backend", {
					topicMode,
					languageModelId: languageModel?.model_id,
					imageModelId: imageModel?.model_id,
					videoModelId: videoModel?.model_id,
				})

				// Save to cache and backend
				this.saveModel(
					store.currentTopicId,
					store.currentProjectId,
					languageModel,
					imageModel,
					videoModel,
					store,
				)
			} else {
				report("[Validate] Models valid for current mode, no update needed", {
					topicMode,
					languageModelId: languageModel?.model_id,
					imageModelId: imageModel?.model_id,
					videoModelId: videoModel?.model_id,
				})
			}
			if (isCurrentRequest()) {
				store.markCurrentContextLoaded(contextKey)
			}
		} finally {
			if (isCurrentRequest()) store.setLoading(false)
		}
	}

	/**
	 * Validate selected models with store current mode.
	 */
	async validateSelectedModels(store: SuperMagicTopicModelStoreLike = topicModelStore) {
		if (!store.currentTopicMode) return
		await this.validateModelsForMode(store.currentTopicMode, store)
	}

	/**
	 * Fetch model for a specific level (Topic/Project/ModeDefault/Global)
	 * 执行完整流程: 取本地缓存 -> 取远程 -> 校验 -> 纠正
	 * @param levelKey - Level identifier (topicId, projectKey, modeDefaultKey, or "default")
	 * @param modelList - Available language models
	 * @param imageModelList - Available image models
	 * @param report - Reporter carrying the owning requestId
	 * @param levelName - Level name for logging (Topic/Project/ModeDefault/Global)
	 * @returns Level model result
	 */
	private async fetchLevelModel(
		levelKey: string,
		topicMode: TopicMode,
		imageModelList: ModelItem[],
		videoModelList: ModelItem[],
		report: RequestReporter,
		levelName: string,
		agentCode?: string | null,
	): Promise<LevelModelResult> {
		let hasValidRemoteData = false
		let usedLocalCache = false

		report(`[Fallback] ${levelName} level fetch started`, { levelKey })

		try {
			// Step 1: 从本地缓存获取
			let localLanguageModel: ModelItem | null = null
			let localImageModel: ModelItem | null = null
			let localVideoModel: ModelItem | null = null
			let hasLocalCache = false

			const cachedData =
				levelName === "Project"
					? await superMagicTopicModelCacheService.getProjectModel(levelKey)
					: levelName === "ModeDefault"
						? await superMagicTopicModelCacheService.getModeDefaultModel(levelKey)
						: levelKey === DEFAULT_TOPIC_ID
							? await superMagicTopicModelCacheService.getDefaultModel()
							: await superMagicTopicModelCacheService.getTopicModel(levelKey)

			if (cachedData) {
				const l = await this.resolveLanguageModel(
					topicMode,
					cachedData.languageModelId,
					agentCode,
				)
				const i = await this.resolveImageModel(
					topicMode,
					cachedData.imageModelId,
					agentCode,
				)
				const v = await this.resolveVideoModel(
					topicMode,
					cachedData.videoModelId,
					agentCode,
				)

				const lValid = l !== null
				const iValid = i !== null
				const vValid = v !== null

				if (lValid) {
					localLanguageModel = l
					hasLocalCache = true
				}
				if (iValid) {
					localImageModel = i
					hasLocalCache = true
				}
				if (vValid) {
					localVideoModel = v
					hasLocalCache = true
				}

				report(`[Fallback] ${levelName} local cache result`, {
					levelKey,
					hasLocalCache,
					localLanguageModelId: localLanguageModel?.model_id,
					localImageModelId: localImageModel?.model_id,
					localVideoModelId: localVideoModel?.model_id,
					languageValid: lValid,
					imageValid: iValid,
					videoValid: vValid,
				})
			} else {
				report(`[Fallback] ${levelName} local cache miss`, { levelKey })
			}

			// Step 2: 从远程 API 获取
			let remoteLanguageModel: ModelItem | null = null
			let remoteImageModel: ModelItem | null = null
			let remoteVideoModel: ModelItem | null = null
			let hasRemoteData = false

			try {
				const res = await SuperMagicApi.getSuperMagicTopicModel({
					topic_id: levelKey,
				})

				const l = await this.resolveLanguageModel(topicMode, res.model?.model_id, agentCode)
				const i = await this.resolveImageModel(
					topicMode,
					res.image_model?.model_id,
					agentCode,
				)
				const v = await this.resolveVideoModel(
					topicMode,
					res.video_model?.model_id,
					agentCode,
				)

				const lValid = l !== null
				const iValid = i !== null
				const vValid = v !== null

				// Check if this mode supports image models
				const supportsImageModel = imageModelList.length > 0
				const supportsVideoModel = videoModelList.length > 0

				if (lValid) {
					remoteLanguageModel = l
					hasRemoteData = true
				}
				if (iValid) {
					remoteImageModel = i
					hasRemoteData = true
				}
				if (vValid) {
					remoteVideoModel = v
					hasRemoteData = true
				}

				// 标记远程是否有完整有效的数据
				const hasValidImageRemoteData = !supportsImageModel || iValid
				const hasValidVideoRemoteData = !supportsVideoModel || vValid
				hasValidRemoteData = !!(
					lValid &&
					hasValidImageRemoteData &&
					hasValidVideoRemoteData
				)

				report(`[Fallback] ${levelName} remote API result`, {
					levelKey,
					hasRemoteData,
					hasValidRemoteData,
					remoteLanguageModelId: remoteLanguageModel?.model_id,
					remoteImageModelId: remoteImageModel?.model_id,
					remoteVideoModelId: remoteVideoModel?.model_id,
					languageValid: lValid,
					imageValid: iValid,
					videoValid: vValid,
					supportsImageModel,
					supportsVideoModel,
				})
			} catch (e) {
				report(`[Fallback] ${levelName} remote API failed`, {
					levelKey,
					...toErrorLogFields(e),
				})
			}

			// Step 3: 校验和纠正逻辑
			let finalLanguageModel: ModelItem | null = null
			let finalImageModel: ModelItem | null = null
			let finalVideoModel: ModelItem | null = null
			let needsCorrection = false

			// 如果远程有有效数据，优先使用远程数据
			if (hasRemoteData) {
				finalLanguageModel = remoteLanguageModel
				finalImageModel = remoteImageModel
				finalVideoModel = remoteVideoModel

				// 检查本地和远程是否一致
				const languageModelMismatch =
					localLanguageModel?.model_id !== remoteLanguageModel?.model_id
				const imageModelMismatch = localImageModel?.model_id !== remoteImageModel?.model_id
				const videoModelMismatch = localVideoModel?.model_id !== remoteVideoModel?.model_id

				if (
					hasLocalCache &&
					(languageModelMismatch || imageModelMismatch || videoModelMismatch)
				) {
					needsCorrection = true
					report(`[Fallback] ${levelName} data mismatch detected`, {
						levelKey,
						localLanguageModelId: localLanguageModel?.model_id,
						remoteLanguageModelId: remoteLanguageModel?.model_id,
						localImageModelId: localImageModel?.model_id,
						remoteImageModelId: remoteImageModel?.model_id,
						localVideoModelId: localVideoModel?.model_id,
						remoteVideoModelId: remoteVideoModel?.model_id,
						languageModelMismatch,
						imageModelMismatch,
						videoModelMismatch,
					})
				}
			} else if (hasLocalCache) {
				// 如果远程没有数据，但本地有，使用本地数据
				finalLanguageModel = localLanguageModel
				finalImageModel = localImageModel
				finalVideoModel = localVideoModel
				usedLocalCache = true
				report(`[Fallback] ${levelName} using local cache (no remote data)`, {
					levelKey,
					localLanguageModelId: localLanguageModel?.model_id,
					localImageModelId: localImageModel?.model_id,
					localVideoModelId: localVideoModel?.model_id,
				})
			}

			// Step 4: 更新本地缓存和远程数据（如果需要纠正）
			if (
				needsCorrection &&
				finalLanguageModel &&
				(!imageModelList.length || finalImageModel) &&
				(!videoModelList.length || finalVideoModel)
			) {
				// 更新本地缓存
				if (levelName === "Project") {
					await superMagicTopicModelCacheService.saveProjectModel(levelKey, {
						languageModelId: finalLanguageModel.model_id,
						imageModelId: finalImageModel?.model_id,
						videoModelId: finalVideoModel?.model_id,
						timestamp: Date.now(),
					})
				} else if (levelName === "ModeDefault") {
					await superMagicTopicModelCacheService.saveModeDefaultModel(levelKey, {
						languageModelId: finalLanguageModel.model_id,
						imageModelId: finalImageModel?.model_id,
						videoModelId: finalVideoModel?.model_id,
						timestamp: Date.now(),
					})
				} else {
					await superMagicTopicModelCacheService.saveTopicModel(levelKey, {
						languageModelId: finalLanguageModel.model_id,
						imageModelId: finalImageModel?.model_id,
						videoModelId: finalVideoModel?.model_id,
						timestamp: Date.now(),
					})
				}

				report(`[Fallback] ${levelName} local cache corrected`, {
					levelKey,
					languageModelId: finalLanguageModel.model_id,
					imageModelId: finalImageModel?.model_id,
					videoModelId: finalVideoModel?.model_id,
				})
			}

			// Determine success based on whether the mode supports image/video models
			const supportsImageModel = imageModelList.length > 0
			const supportsVideoModel = videoModelList.length > 0
			const success = !!(
				finalLanguageModel &&
				(!supportsImageModel || finalImageModel) &&
				(!supportsVideoModel || finalVideoModel)
			)

			report(`[Fallback] ${levelName} level completed`, {
				levelKey,
				success,
				finalLanguageModelId: finalLanguageModel?.model_id,
				finalImageModelId: finalImageModel?.model_id,
				finalVideoModelId: finalVideoModel?.model_id,
				hasValidRemoteData,
				needsCorrection,
				supportsImageModel,
				supportsVideoModel,
			})

			return {
				success,
				languageModel: finalLanguageModel,
				imageModel: finalImageModel,
				videoModel: finalVideoModel,
				hasValidRemoteData,
				usedLocalCache,
			}
		} catch (error) {
			report(`[Fallback] ${levelName} level error`, {
				levelKey,
				...toErrorLogFields(error),
			})
			return {
				success: false,
				languageModel: null,
				imageModel: null,
				videoModel: null,
				hasValidRemoteData: false,
				usedLocalCache: false,
			}
		}
	}

	/**
	 * Check if we still need to fetch more models
	 * @param supportsImageModel - Whether the mode supports image models
	 * @param supportsVideoModel - Whether the mode supports video models
	 * @param languageModel - Current language model
	 * @param imageModel - Current image model
	 * @param videoModel - Current video model
	 * @returns true if we need to continue cascading to the next level
	 */
	private needMoreModels(
		supportsImageModel: boolean,
		supportsVideoModel: boolean,
		languageModel: ModelItem | null,
		imageModel: ModelItem | null,
		videoModel: ModelItem | null,
	): boolean {
		return !!(
			!languageModel ||
			(supportsImageModel && !imageModel) ||
			(supportsVideoModel && !videoModel)
		)
	}

	/**
	 * Fetch topic model with optimistic update + async verification
	 * Uses cascaded per-field fallback (Topic -> Project -> ModeDefault -> Global -> Usable)
	 * @param topicId - Topic ID
	 * @param projectId - Project ID
	 * @param topicMode - Topic mode
	 * @param store - Store instance
	 */
	async fetchTopicModel(
		topicId: string,
		projectId: string,
		topicMode: TopicMode,
		store: SuperMagicTopicModelStoreLike = topicModelStore,
	) {
		let hasCompletedLoading = false
		const agentCode = store.currentAgentCode || null
		const context = { topicId, projectId, topicMode, agentCode }
		if (!this.isCurrentContext(store, context)) return
		const requestGuard = this.createRequestGuard(store, context)
		const isCurrentRequest = () => this.isCurrentRequest(store, requestGuard)
		const report = this.createRequestReporter(requestGuard.requestId)

		const completeLoading = () => {
			if (hasCompletedLoading) return
			if (!isCurrentRequest()) return
			store.markCurrentContextLoaded(getTopicModelContextKey(context))
			store.setLoading(false)
			hasCompletedLoading = true
		}

		store.setLoading(true)

		let modelList = superMagicModeService.getModelListByMode(topicMode, agentCode)
		let imageModelList = superMagicModeService.getImageModelListByMode(topicMode, agentCode)
		let videoModelList = superMagicModeService.getVideoModelListByMode(topicMode, agentCode)
		let supportsImageModel = imageModelList.length > 0
		let supportsVideoModel = videoModelList.length > 0

		report("[Fallback] Four-level cascade started", {
			topicId,
			projectId,
			topicMode,
			agentCode,
			supportsImageModel,
			supportsVideoModel,
			availableLanguageModelsCount: modelList.length,
			availableImageModelsCount: imageModelList.length,
			availableVideoModelsCount: videoModelList.length,
		})

		try {
			// A mode owns its model list, so every level below "Topic" is only meaningful
			// once the featured crew list has arrived. A cold start (nothing hydrated from
			// storage yet) can reach this point first: settling with an empty list clears
			// `isLoading` and leaves nothing to retry when the list lands, so the composer
			// reports "no language model" forever and its send button stays disabled.
			// `fetchModeList` joins the request the page already started, when there is one.
			if (modelList.length === 0 && !superMagicModeService.isModeAvailabilityResolved) {
				report("[Fallback] Waiting for featured mode list before cascading", {
					topicMode,
					agentCode,
				})
				try {
					await superMagicModeService.fetchModeList()
				} catch (error) {
					// Keep going: the cascade still has its own remote/cache levels.
					report("[Fallback] Featured mode list unavailable, continuing cascade", {
						topicMode,
						...toErrorLogFields(error),
					})
				}

				if (!isCurrentRequest()) return

				modelList = superMagicModeService.getModelListByMode(topicMode, agentCode)
				imageModelList = superMagicModeService.getImageModelListByMode(topicMode, agentCode)
				videoModelList = superMagicModeService.getVideoModelListByMode(topicMode, agentCode)
				supportsImageModel = imageModelList.length > 0
				supportsVideoModel = videoModelList.length > 0
			}

			if (topicMode === TopicMode.Default && modelList.length === 0) {
				await superMagicModeService.fetchDefaultModeModelList()
				modelList = superMagicModeService.getModelListByMode(topicMode, agentCode)
				imageModelList = superMagicModeService.getImageModelListByMode(topicMode, agentCode)
				videoModelList = superMagicModeService.getVideoModelListByMode(topicMode, agentCode)
				supportsImageModel = imageModelList.length > 0
				supportsVideoModel = videoModelList.length > 0
			}
			// 四层级联策略: Topic -> Project -> ModeDefault(default_{topicMode}) -> Global(default)
			// 每层都执行: 取本地缓存 -> 取远程 -> 校验 -> 纠正

			let finalLanguageModel: ModelItem | null = null
			let finalImageModel: ModelItem | null = null
			let finalVideoModel: ModelItem | null = null

			// 存储各级别结果，用于后续回填逻辑
			let topicResult: LevelModelResult = {
				success: false,
				languageModel: null,
				imageModel: null,
				videoModel: null,
				hasValidRemoteData: false,
				usedLocalCache: false,
			}
			let projectResult: LevelModelResult = {
				success: false,
				languageModel: null,
				imageModel: null,
				videoModel: null,
				hasValidRemoteData: false,
				usedLocalCache: false,
			}
			let modeDefaultResult: LevelModelResult = {
				success: false,
				languageModel: null,
				imageModel: null,
				videoModel: null,
				hasValidRemoteData: false,
				usedLocalCache: false,
			}
			let globalResult: LevelModelResult = {
				success: false,
				languageModel: null,
				imageModel: null,
				videoModel: null,
				hasValidRemoteData: false,
				usedLocalCache: false,
			}

			// Level 1: Topic 级别（跳过空或 default 的 topicId）
			const shouldFetchTopic = topicId && topicId !== DEFAULT_TOPIC_ID

			if (shouldFetchTopic) {
				report("[Fallback] Level 1: Fetching Topic level", { topicId })
				topicResult = await this.fetchLevelModel(
					topicId,
					topicMode,
					imageModelList,
					videoModelList,
					report,
					"Topic",
					agentCode,
				)

				if (!isCurrentRequest()) return

				if (!finalLanguageModel) finalLanguageModel = topicResult.languageModel
				if (!finalImageModel) finalImageModel = topicResult.imageModel
				if (!finalVideoModel) finalVideoModel = topicResult.videoModel

				if (topicResult.success) {
					report("[Fallback] Level 1: Topic level success, cascade stopped", {
						topicId,
						languageModelId: finalLanguageModel?.model_id,
						imageModelId: finalImageModel?.model_id,
						videoModelId: finalVideoModel?.model_id,
					})
				} else {
					report("[Fallback] Level 1: Topic level incomplete, continuing cascade", {
						topicId,
						languageModelId: topicResult.languageModel?.model_id,
						imageModelId: topicResult.imageModel?.model_id,
						videoModelId: topicResult.videoModel?.model_id,
					})
				}
			} else {
				report("[Fallback] Level 1: Topic level skipped", {
					topicId,
					reason: topicId ? "is default topic" : "empty topicId",
				})
			}

			// Level 2: Project 级别 (如果 Topic 级别未完全成功)
			const shouldFetchProject = this.needMoreModels(
				supportsImageModel,
				supportsVideoModel,
				finalLanguageModel,
				finalImageModel,
				finalVideoModel,
			)

			if (shouldFetchProject && projectId) {
				report("[Fallback] Level 2: Fetching Project level", { projectId })
				const projectKey = this.genProjectKey(projectId)
				projectResult = await this.fetchLevelModel(
					projectKey,
					topicMode,
					imageModelList,
					videoModelList,
					report,
					"Project",
					agentCode,
				)

				if (!isCurrentRequest()) return

				const beforeLanguage = finalLanguageModel?.model_id
				const beforeImage = finalImageModel?.model_id
				const beforeVideo = finalVideoModel?.model_id
				if (!finalLanguageModel) finalLanguageModel = projectResult.languageModel
				if (!finalImageModel) finalImageModel = projectResult.imageModel
				if (!finalVideoModel) finalVideoModel = projectResult.videoModel

				report("[Fallback] Level 2: Project level result", {
					projectId,
					projectKey,
					beforeLanguageModelId: beforeLanguage,
					afterLanguageModelId: finalLanguageModel?.model_id,
					beforeImageModelId: beforeImage,
					afterImageModelId: finalImageModel?.model_id,
					beforeVideoModelId: beforeVideo,
					afterVideoModelId: finalVideoModel?.model_id,
					isComplete: !this.needMoreModels(
						supportsImageModel,
						supportsVideoModel,
						finalLanguageModel,
						finalImageModel,
						finalVideoModel,
					),
				})
			} else if (shouldFetchProject) {
				report("[Fallback] Level 2: Project level skipped", {
					reason: "no projectId",
				})
			}

			// Level 3: ModeDefault 级别 (default_{topicMode}) (如果 Project 级别未完全成功)
			const shouldFetchModeDefault = this.needMoreModels(
				supportsImageModel,
				supportsVideoModel,
				finalLanguageModel,
				finalImageModel,
				finalVideoModel,
			)

			if (shouldFetchModeDefault) {
				if (!isCurrentRequest()) return
				const modeDefaultKey = this.genModeDefaultKey(topicMode, agentCode)
				report("[Fallback] Level 3: Fetching ModeDefault level", {
					topicMode,
					modeDefaultKey,
				})
				modeDefaultResult = await this.fetchLevelModel(
					modeDefaultKey,
					topicMode,
					imageModelList,
					videoModelList,
					report,
					"ModeDefault",
					agentCode,
				)

				if (!isCurrentRequest()) return

				const beforeLanguage = finalLanguageModel?.model_id
				const beforeImage = finalImageModel?.model_id
				const beforeVideo = finalVideoModel?.model_id
				if (!finalLanguageModel) finalLanguageModel = modeDefaultResult.languageModel
				if (!finalImageModel) finalImageModel = modeDefaultResult.imageModel
				if (!finalVideoModel) finalVideoModel = modeDefaultResult.videoModel

				report("[Fallback] Level 3: ModeDefault level result", {
					topicMode,
					modeDefaultKey,
					beforeLanguageModelId: beforeLanguage,
					afterLanguageModelId: finalLanguageModel?.model_id,
					beforeImageModelId: beforeImage,
					afterImageModelId: finalImageModel?.model_id,
					beforeVideoModelId: beforeVideo,
					afterVideoModelId: finalVideoModel?.model_id,
					isComplete: !this.needMoreModels(
						supportsImageModel,
						supportsVideoModel,
						finalLanguageModel,
						finalImageModel,
						finalVideoModel,
					),
				})
			}

			// Level 4: Global 级别 (default) (如果 ModeDefault 级别也未完全成功)
			const shouldFetchGlobal = this.needMoreModels(
				supportsImageModel,
				supportsVideoModel,
				finalLanguageModel,
				finalImageModel,
				finalVideoModel,
			)

			if (shouldFetchGlobal) {
				// 提前检查：如果 topicId 已经变了，直接返回，避免不必要的 Global 请求
				if (!isCurrentRequest()) return
				report("[Fallback] Level 4: Fetching Global level", {})
				globalResult = await this.fetchLevelModel(
					DEFAULT_TOPIC_ID,
					topicMode,
					imageModelList,
					videoModelList,
					report,
					"Global",
					agentCode,
				)

				if (!isCurrentRequest()) return

				const beforeLanguage = finalLanguageModel?.model_id
				const beforeImage = finalImageModel?.model_id
				const beforeVideo = finalVideoModel?.model_id
				if (!finalLanguageModel) finalLanguageModel = globalResult.languageModel
				if (!finalImageModel) finalImageModel = globalResult.imageModel
				if (!finalVideoModel) finalVideoModel = globalResult.videoModel

				report("[Fallback] Level 4: Global level result", {
					beforeLanguageModelId: beforeLanguage,
					afterLanguageModelId: finalLanguageModel?.model_id,
					beforeImageModelId: beforeImage,
					afterImageModelId: finalImageModel?.model_id,
					beforeVideoModelId: beforeVideo,
					afterVideoModelId: finalVideoModel?.model_id,
					isComplete: !this.needMoreModels(
						supportsImageModel,
						supportsVideoModel,
						finalLanguageModel,
						finalImageModel,
						finalVideoModel,
					),
				})
			}

			// Level 5: 列表第一个可用模型 (如果所有级别都失败)
			const needFirstUsableLanguage = !finalLanguageModel
			const needFirstUsableImage = !finalImageModel
			const needFirstUsableVideo = !finalVideoModel

			if (needFirstUsableLanguage) {
				finalLanguageModel = this.getFirstUsableModel(modelList)
				report("[Fallback] Level 5: Using first usable language model", {
					languageModelId: finalLanguageModel?.model_id,
				})
			}

			if (needFirstUsableImage) {
				finalImageModel = this.getFirstUsableModel(imageModelList)
				report("[Fallback] Level 5: Using first usable image model", {
					imageModelId: finalImageModel?.model_id,
				})
			}

			if (needFirstUsableVideo) {
				finalVideoModel = this.getFirstUsableModel(videoModelList)
				report("[Fallback] Level 5: Using first usable video model", {
					videoModelId: finalVideoModel?.model_id,
				})
			}

			if (!isCurrentRequest()) return
			const sourceLevel =
				shouldFetchTopic && topicResult.success
					? "Topic"
					: projectResult.success
						? "Project"
						: modeDefaultResult.success
							? "ModeDefault"
							: "Global"
			const sourceResult =
				sourceLevel === "Topic"
					? topicResult
					: sourceLevel === "Project"
						? projectResult
						: sourceLevel === "ModeDefault"
							? modeDefaultResult
							: globalResult

			if (sourceResult.usedLocalCache) {
				const normalizedModels = await this.normalizeModelsForMode({
					topicMode,
					languageModel: finalLanguageModel,
					imageModel: finalImageModel,
					videoModel: finalVideoModel,
					agentCode,
				})
				if (!isCurrentRequest()) return
				finalLanguageModel = normalizedModels.languageModel
				finalImageModel = normalizedModels.imageModel
				finalVideoModel = normalizedModels.videoModel
			}

			// 更新 store
			store.setSelectedLanguageModel(finalLanguageModel)
			store.setSelectedImageModel(finalImageModel)
			store.setSelectedVideoModel(finalVideoModel)

			if (sourceResult.usedLocalCache) {
				report("[Fallback] Local cache models revalidated before store update", {
					topicId,
					projectId,
					topicMode,
					languageModelId: finalLanguageModel?.model_id,
					imageModelId: finalImageModel?.model_id,
					videoModelId: finalVideoModel?.model_id,
				})
			}

			// 级联回填逻辑：从高级别获取的值回填到低级别
			// 确定数据来源级别
			report("[Fallback] Data source level determined", {
				sourceLevel,
				topicSuccess: topicResult.success,
				projectSuccess: projectResult.success,
				modeDefaultSuccess: modeDefaultResult.success,
			})

			// 回填规则：从更高级别获取的数据回填到低级别；本地命中但远程缺失时重试同级远程写入
			// Topic 远程成功 → 不回填任何级别
			// Project 成功 → 只回填 Topic
			// ModeDefault 成功 → 回填 Topic 和 Project
			// Global 成功 → 回填 Topic, Project 和 ModeDefault

			// 回填 Topic 级别，或重试仅命中本地缓存的 Topic 远程写入
			// 修复：允许 languageModel 和 imageModel 独立回填（不要求两者都存在）
			const needTopicBackfill =
				shouldFetchTopic && // topicId 有效
				(sourceLevel !== "Topic" || topicResult.usedLocalCache) &&
				(!topicResult.success || !topicResult.hasValidRemoteData) &&
				(finalLanguageModel || finalImageModel || finalVideoModel) // At least one model exists

			const models: CascadeBackfillModels = {
				languageModel: finalLanguageModel,
				imageModel: finalImageModel,
				videoModel: finalVideoModel,
			}

			if (needTopicBackfill) {
				await this.persistCascadeBackfill(isCurrentRequest, {
					level: "Topic",
					cacheId: topicId,
					models,
					report,
					logContext: { topicId, sourceLevel },
					saveLocal: (data) =>
						superMagicTopicModelCacheService.saveTopicModel(topicId, data),
				})
			} else if (
				shouldFetchTopic &&
				topicResult.success &&
				topicResult.hasValidRemoteData &&
				isCurrentRequest()
			) {
				await superMagicTopicModelCacheService.saveTopicModel(
					topicId,
					this.toCachedModelData(models),
				)
			}

			// 回填 Project 级别，或重试仅命中本地缓存的 Project 远程写入
			// 修复：允许 languageModel 和 imageModel 独立回填
			const needProjectBackfill =
				projectId &&
				(sourceLevel === "ModeDefault" ||
					sourceLevel === "Global" ||
					projectResult.usedLocalCache) &&
				(!projectResult.success || !projectResult.hasValidRemoteData) &&
				(finalLanguageModel || finalImageModel || finalVideoModel) // At least one model exists

			if (needProjectBackfill) {
				const projectKey = this.genProjectKey(projectId)
				await this.persistCascadeBackfill(isCurrentRequest, {
					level: "Project",
					cacheId: projectKey,
					models,
					report,
					logContext: { projectId, projectKey, sourceLevel },
					saveLocal: (data) =>
						superMagicTopicModelCacheService.saveProjectModel(projectId, data),
				})
			} else if (
				projectId &&
				projectResult.success &&
				projectResult.hasValidRemoteData &&
				isCurrentRequest()
			) {
				await superMagicTopicModelCacheService.saveProjectModel(
					projectId,
					this.toCachedModelData(models),
				)
			}

			// 回填 ModeDefault 级别，或重试仅命中本地缓存的 ModeDefault 远程写入
			// 修复：允许 languageModel 和 imageModel 独立回填
			const needModeDefaultBackfill =
				(sourceLevel === "Global" || modeDefaultResult.usedLocalCache) &&
				(!modeDefaultResult.success || !modeDefaultResult.hasValidRemoteData) &&
				(finalLanguageModel || finalImageModel || finalVideoModel) // At least one model exists

			if (needModeDefaultBackfill) {
				const modeDefaultKey = this.genModeDefaultKey(topicMode, agentCode)
				await this.persistCascadeBackfill(isCurrentRequest, {
					level: "ModeDefault",
					cacheId: modeDefaultKey,
					models,
					report,
					logContext: { topicMode, modeDefaultKey, sourceLevel },
					saveLocal: (data) =>
						superMagicTopicModelCacheService.saveModeDefaultModel(modeDefaultKey, data),
				})
			} else if (
				modeDefaultResult.success &&
				modeDefaultResult.hasValidRemoteData &&
				isCurrentRequest()
			) {
				await superMagicTopicModelCacheService.saveModeDefaultModel(
					this.genModeDefaultKey(topicMode, agentCode),
					this.toCachedModelData(models),
				)
			}

			report("[Fallback] Four-level cascade completed", {
				topicId,
				projectId,
				topicMode,
				sourceLevel,
				finalLanguageModelId: finalLanguageModel?.model_id,
				finalImageModelId: finalImageModel?.model_id,
				finalVideoModelId: finalVideoModel?.model_id,
				topicBackfilled: needTopicBackfill,
				projectBackfilled: needProjectBackfill,
				modeDefaultBackfilled: needModeDefaultBackfill,
				usedFirstUsableLanguage: needFirstUsableLanguage,
				usedFirstUsableImage: needFirstUsableImage,
				usedFirstUsableVideo: needFirstUsableVideo,
			})
		} catch (error) {
			if (!isCurrentRequest()) return
			report("Critical error in fetchTopicModel", {
				topicId,
				...toErrorLogFields(error),
			})
			this.setFirstUsableModels(modelList, imageModelList, videoModelList, store)
		} finally {
			completeLoading()
		}
	}

	/**
	 * Set first usable models (final fallback)
	 * @param modelList - Available language models
	 * @param imageModelList - Available image models
	 * @param videoModelList - Available video models
	 * @param store - Store instance
	 */
	private setFirstUsableModels(
		modelList: ModelItem[],
		imageModelList: ModelItem[],
		videoModelList: ModelItem[],
		store: SuperMagicTopicModelStoreLike = topicModelStore,
	) {
		const firstLanguage = this.getFirstUsableModel(modelList)
		const firstImage = this.getFirstUsableModel(imageModelList)
		const firstVideo = this.getFirstUsableModel(videoModelList)

		store.setSelectedLanguageModel(firstLanguage)
		store.setSelectedImageModel(firstImage)
		store.setSelectedVideoModel(firstVideo)

		logger.log("Using first usable models (fallback)", {
			languageModelId: firstLanguage?.model_id,
			imageModelId: firstImage?.model_id,
			videoModelId: firstVideo?.model_id,
		})
	}

	/**
	 * Save model configuration with debouncing
	 * @param topicId - Topic ID
	 * @param projectId - Project ID
	 * @param languageModel - Language model (undefined = keep current)
	 * @param imageModel - Image model (undefined = keep current)
	 * @param videoModel - Video model (undefined = keep current)
	 * @param store - Store instance
	 */
	async saveModel(
		topicId: string,
		projectId: string,
		languageModel?: ModelItem | null,
		imageModel?: ModelItem | null,
		videoModel?: ModelItem | null,
		store: SuperMagicTopicModelStoreLike = topicModelStore,
	) {
		// Determine save level and cache key based on topicId and projectId
		// Priority: Topic > Project > ModeDefault > Global
		const shouldSaveToTopic = topicId && topicId !== DEFAULT_TOPIC_ID
		const shouldSaveToProject = !shouldSaveToTopic && projectId

		let cacheKey: string
		let cacheId: string // Used for backend API
		let saveLevel: "Topic" | "Project" | "ModeDefault" | "Global"

		if (shouldSaveToTopic) {
			// Topic level
			cacheKey = topicId
			cacheId = topicId
			saveLevel = "Topic"
		} else if (shouldSaveToProject) {
			// Project level
			cacheKey = this.genProjectKey(projectId)
			cacheId = this.genProjectKey(projectId)
			saveLevel = "Project"
		} else if (store.currentTopicMode) {
			// ModeDefault level (default_{topicMode})
			cacheKey = this.genModeDefaultKey(store.currentTopicMode, store.currentAgentCode)
			cacheId = this.genModeDefaultKey(store.currentTopicMode, store.currentAgentCode)
			saveLevel = "ModeDefault"
		} else {
			// Global level (default)
			cacheKey = DEFAULT_TOPIC_ID
			cacheId = DEFAULT_TOPIC_ID
			saveLevel = "Global"
		}

		logger.report("[Save] Save level determined", {
			saveLevel,
			topicId,
			projectId,
			cacheKey,
			cacheId,
			languageModelId: languageModel?.model_id,
			imageModelId: imageModel?.model_id,
			videoModelId: videoModel?.model_id,
		})

		// Step 1: Update Store state immediately
		if (languageModel !== undefined) {
			store.setSelectedLanguageModel(languageModel)
		}
		if (imageModel !== undefined) {
			store.setSelectedImageModel(imageModel)
		}
		if (videoModel !== undefined) {
			store.setSelectedVideoModel(videoModel)
		}

		// Step 2: Save to local cache immediately
		const currentLanguage =
			languageModel !== undefined ? languageModel : store.selectedLanguageModel
		const currentImage = imageModel !== undefined ? imageModel : store.selectedImageModel
		const currentVideo = videoModel !== undefined ? videoModel : store.selectedVideoModel

		// Save to appropriate level cache
		if (saveLevel === "Topic") {
			// Save to both Topic and Project level
			await superMagicTopicModelCacheService.saveTopicModel(topicId, {
				languageModelId: currentLanguage?.model_id,
				imageModelId: currentImage?.model_id,
				videoModelId: currentVideo?.model_id,
				timestamp: Date.now(),
			})
			// Also save to Project level to update project default
			if (projectId) {
				await superMagicTopicModelCacheService.saveProjectModel(projectId, {
					languageModelId: currentLanguage?.model_id,
					imageModelId: currentImage?.model_id,
					videoModelId: currentVideo?.model_id,
					timestamp: Date.now(),
				})
			}
		} else if (saveLevel === "Project") {
			await superMagicTopicModelCacheService.saveProjectModel(projectId, {
				languageModelId: currentLanguage?.model_id,
				imageModelId: currentImage?.model_id,
				videoModelId: currentVideo?.model_id,
				timestamp: Date.now(),
			})
		} else if (saveLevel === "ModeDefault") {
			// Save to ModeDefault level
			await superMagicTopicModelCacheService.saveModeDefaultModel(cacheKey, {
				languageModelId: currentLanguage?.model_id,
				imageModelId: currentImage?.model_id,
				videoModelId: currentVideo?.model_id,
				timestamp: Date.now(),
			})
		} else {
			// Save to default/global level
			await superMagicTopicModelCacheService.saveDefaultModel({
				languageModelId: currentLanguage?.model_id,
				imageModelId: currentImage?.model_id,
				videoModelId: currentVideo?.model_id,
				timestamp: Date.now(),
			})
		}

		// Step 3: Update pending save buffer
		const pending = this.pendingSaves.get(cacheKey) || {
			topicId,
			projectId,
			cacheId, // Store the actual cache_id to use for backend API
			languageModel: store.selectedLanguageModel,
			imageModel: store.selectedImageModel,
			videoModel: store.selectedVideoModel,
			timestamp: Date.now(),
		}

		// Merge latest model selection
		if (languageModel !== undefined) {
			pending.languageModel = languageModel
		}
		if (imageModel !== undefined) {
			pending.imageModel = imageModel
		}
		if (videoModel !== undefined) {
			pending.videoModel = videoModel
		}
		pending.topicId = topicId
		pending.projectId = projectId
		pending.timestamp = Date.now()
		pending.cacheId = cacheId // Update cacheId

		this.pendingSaves.set(cacheKey, pending)

		// Step 4: Debounce
		const existingTimer = this.debounceTimers.get(cacheKey)
		if (existingTimer) {
			clearTimeout(existingTimer)
		}

		const timer = setTimeout(() => {
			this.flushPendingSave(cacheKey)
		}, this.DEBOUNCE_DELAY)

		this.debounceTimers.set(cacheKey, timer)

		// If saving to Topic level, also schedule a save for Project level
		if (saveLevel === "Topic" && projectId) {
			const projectKey = this.genProjectKey(projectId)
			const projectPending = this.pendingSaves.get(projectKey) || {
				topicId,
				projectId,
				cacheId: projectKey,
				languageModel: store.selectedLanguageModel,
				imageModel: store.selectedImageModel,
				videoModel: store.selectedVideoModel,
				timestamp: Date.now(),
			}

			// Merge latest model selection
			if (languageModel !== undefined) {
				projectPending.languageModel = languageModel
			}
			if (imageModel !== undefined) {
				projectPending.imageModel = imageModel
			}
			if (videoModel !== undefined) {
				projectPending.videoModel = videoModel
			}
			projectPending.topicId = topicId
			projectPending.projectId = projectId
			projectPending.timestamp = Date.now()

			this.pendingSaves.set(projectKey, projectPending)

			// Debounce for project level
			const existingProjectTimer = this.debounceTimers.get(projectKey)
			if (existingProjectTimer) {
				clearTimeout(existingProjectTimer)
			}

			const projectTimer = setTimeout(() => {
				this.flushPendingSave(projectKey)
			}, this.DEBOUNCE_DELAY)

			this.debounceTimers.set(projectKey, projectTimer)
		}
	}

	/**
	 * Flush a specific pending save to backend
	 * @param cacheKey - Cache key (topicId, projectKey, or "default")
	 */
	private async flushPendingSave(cacheKey: string) {
		const data = this.pendingSaves.get(cacheKey)
		if (!data) return

		const { topicId, projectId, cacheId, languageModel, imageModel, videoModel } = data

		logger.report("[Save] Flushing pending save to backend", {
			cacheKey,
			cacheId,
			topicId,
			projectId,
			languageModelId: languageModel?.model_id,
			imageModelId: imageModel?.model_id,
			videoModelId: videoModel?.model_id,
		})

		try {
			const response = await SuperMagicApi.saveSuperMagicTopicModel({
				cache_id: cacheId || topicId, // Use cacheId if available, fallback to topicId
				model_id: languageModel?.model_id,
				image_model_id: imageModel?.model_id,
				video_model_id: videoModel?.model_id,
			})

			if (isExplicitRejectedResponse(response)) {
				logger.report("[Save] Backend save rejected", {
					cacheId,
					topicId,
					projectId,
					languageModelId: languageModel?.model_id,
					imageModelId: imageModel?.model_id,
					videoModelId: videoModel?.model_id,
					...toResponseLogFields(response),
				})
			} else {
				logger.report("[Save] Backend save successful", {
					cacheId,
					topicId,
					projectId,
					languageModelId: languageModel?.model_id,
					imageModelId: imageModel?.model_id,
					videoModelId: videoModel?.model_id,
				})
			}
		} catch (error) {
			logger.report("[Save] Backend save failed", {
				cacheId,
				topicId,
				projectId,
				languageModelId: languageModel?.model_id,
				imageModelId: imageModel?.model_id,
				videoModelId: videoModel?.model_id,
				...toErrorLogFields(error),
			})
		} finally {
			this.pendingSaves.delete(cacheKey)
			this.debounceTimers.delete(cacheKey)
		}
	}

	/**
	 * Flush all pending saves immediately
	 * @param topicId - Optional topic ID, flush all if not provided
	 */
	async flushAll(topicId?: string) {
		const keysToFlush = topicId ? [topicId] : Array.from(this.pendingSaves.keys())
		const flushPromises = keysToFlush.map((key) => this.flushPendingSave(key))
		await Promise.allSettled(flushPromises)
		logger.log("Flushed all pending saves", { topicId })
	}

	/**
	 * Generate project cache key
	 * @param projectId - Project ID
	 * @returns Cache key
	 */
	genProjectKey(projectId: string): string {
		if (!projectId) return DEFAULT_TOPIC_ID
		return `project_id_${projectId}`
	}

	/**
	 * Generate mode default cache key
	 * @param topicMode - Topic mode
	 * @returns Cache key
	 */
	genModeDefaultKey(topicMode: TopicMode, agentCode?: string | null): string {
		return `default_${resolveModeMapKey(topicMode, agentCode)}`
	}

	/** 清理指定话题的 debounce；仅当 project 待保存仍由该话题拥有时一并清理 */
	cleanup(topicId: string) {
		const pending = this.pendingSaves.get(topicId)
		this.clearPendingSave(topicId)
		if (!pending?.projectId) return

		const projectKey = this.genProjectKey(pending.projectId)
		if (this.pendingSaves.get(projectKey)?.topicId === topicId) {
			this.clearPendingSave(projectKey)
		}
	}

	private clearPendingSave(cacheKey: string) {
		const timer = this.debounceTimers.get(cacheKey)
		if (timer) {
			clearTimeout(timer)
			this.debounceTimers.delete(cacheKey)
		}
		this.pendingSaves.delete(cacheKey)
	}

	/**
	 * Destroy service (cleanup all timers and reaction)
	 */
	destroy() {
		this.debounceTimers.forEach((timer) => clearTimeout(timer))
		this.debounceTimers.clear()
		this.pendingSaves.clear()

		this.activeReactionDisposers.forEach((disposer) => disposer())
		this.activeReactionDisposers.clear()

		if (typeof window !== "undefined" && this.isBeforeUnloadRegistered) {
			window.removeEventListener("beforeunload", this.handleBeforeUnload)
			this.isBeforeUnloadRegistered = false
		}

		logger.log("Service destroyed")
	}
}

const superMagicTopicModelService = new SuperMagicTopicModelService()

export default superMagicTopicModelService
