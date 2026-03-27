import { SuperMagicApi } from "@/apis"
import { logger as Logger } from "@/utils/log"
import superMagicTopicModelCacheService from "./SuperMagicTopicModelCacheService"
import topicModelStore from "@/stores/superMagic/topicModelStore"
import superMagicModeService from "../SuperMagicModeService"
import { ModelItem, ModelStatusEnum } from "@/pages/superMagic/components/MessageEditor/types"
import type { TopicMode } from "@/pages/superMagic/pages/Workspace/types"
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
	timestamp: number
}

export interface SuperMagicTopicModelStoreLike {
	selectedLanguageModel: ModelItem | null
	selectedImageModel: ModelItem | null
	isLoading: boolean
	currentTopicId: string
	currentProjectId: string
	currentTopicMode: TopicMode
	setSelectedLanguageModel: (model: ModelItem | null) => void
	setSelectedImageModel: (model: ModelItem | null) => void
	setLoading: (loading: boolean) => void
}

/**
 * Level model fetch result
 */
interface LevelModelResult {
	success: boolean
	languageModel: ModelItem | null
	imageModel: ModelItem | null
	hasValidRemoteData: boolean // 远程是否有有效数据
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
	private activeReactionDisposers = new Set<() => void>()

	// Register beforeunload only once
	private isBeforeUnloadRegistered = false

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
			logger.log("Service already initialized for store")
			return
		}

		// Listen to Store's context changes and trigger model fetching
		const disposer = reaction(
			() => ({
				topicId: store.currentTopicId,
				projectId: store.currentProjectId,
				topicMode: store.currentTopicMode,
			}),
			async ({ topicId, projectId, topicMode }, prev) => {
				logger.report("[Context] Context changed", {
					prevTopicId: prev?.topicId,
					prevProjectId: prev?.projectId,
					prevTopicMode: prev?.topicMode,
					newTopicId: topicId,
					newProjectId: projectId,
					newTopicMode: topicMode,
				})

				// Flush old topic's pending save before switching
				if (prev && prev.topicId && prev.topicId !== topicId) {
					logger.report("[Context] Flushing old topic before switching", {
						oldTopicId: prev.topicId,
						newTopicId: topicId,
					})
					await this.flushAll(prev.topicId)
				}

				// 话题内，切换模式，重新校验模型
				// 话题外，还是走默认的逻辑
				if (
					prev &&
					prev.topicId &&
					prev.topicId === topicId &&
					prev.topicMode &&
					prev.topicMode !== topicMode
				) {
					logger.report("[Context] Topic mode changed, validating models", {
						oldMode: prev.topicMode,
						newMode: topicMode,
					})
					await this.validateModelsForMode(topicMode, store)
					return
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
		disposer()
		this.reactionDisposers.delete(store)
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
	): Promise<ModelItem | null> {
		const model = await superMagicModeService.resolveLanguageModelByMode(topicMode, modelId)
		if (model?.model_status !== ModelStatusEnum.Normal) return null
		return model
	}

	/**
	 * Resolve image model by mode.
	 */
	private async resolveImageModel(
		topicMode: TopicMode,
		modelId?: string | null,
	): Promise<ModelItem | null> {
		const model = await superMagicModeService.resolveImageModelByMode(topicMode, modelId)
		if (model?.model_status !== ModelStatusEnum.Normal) return null
		return model
	}

	/**
	 * Validate if model can still be resolved.
	 */
	private async isModelValid(
		model: ModelItem | null,
		topicMode: TopicMode,
		modelType: "language" | "image",
	): Promise<boolean> {
		if (!model) return false

		if (modelType === "image") {
			const resolvedModel = await this.resolveImageModel(topicMode, model.model_id)
			return resolvedModel !== null
		}

		const resolvedModel = await this.resolveLanguageModel(topicMode, model.model_id)
		return resolvedModel !== null
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
		logger.report("[Validate] Mode validation started", {
			topicMode,
			currentLanguageModelId: store.selectedLanguageModel?.model_id,
			currentImageModelId: store.selectedImageModel?.model_id,
		})

		const modelList = superMagicModeService.getModelListByMode(topicMode)
		const imageModelList = superMagicModeService.getImageModelListByMode(topicMode)

		let languageModel = store.selectedLanguageModel
		let imageModel = store.selectedImageModel
		let needsUpdate = false

		// Validate language model
		if (!(await this.isModelValid(languageModel, topicMode, "language"))) {
			languageModel = this.getFirstUsableModel(modelList)
			needsUpdate = true
			logger.report("[Validate] Language model invalid for mode, switching", {
				topicMode,
				oldModelId: store.selectedLanguageModel?.model_id,
				newModelId: languageModel?.model_id,
				availableModelsCount: modelList.length,
			})
		}

		// Validate image model
		if (!(await this.isModelValid(imageModel, topicMode, "image"))) {
			imageModel = this.getFirstUsableModel(imageModelList)
			needsUpdate = true
			logger.report("[Validate] Image model invalid for mode, switching", {
				topicMode,
				oldModelId: store.selectedImageModel?.model_id,
				newModelId: imageModel?.model_id,
				availableModelsCount: imageModelList.length,
			})
		}

		// Update Store if needed
		if (needsUpdate) {
			store.setSelectedLanguageModel(languageModel)
			store.setSelectedImageModel(imageModel)

			logger.report("[Validate] Models updated, saving to backend", {
				topicMode,
				languageModelId: languageModel?.model_id,
				imageModelId: imageModel?.model_id,
			})

			// Save to cache and backend
			this.saveModel(
				store.currentTopicId,
				store.currentProjectId,
				languageModel,
				imageModel,
				store,
			)
		} else {
			logger.report("[Validate] Models valid for current mode, no update needed", {
				topicMode,
				languageModelId: languageModel?.model_id,
				imageModelId: imageModel?.model_id,
			})
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
	 * @param _store - Store instance (reserved for future use)
	 * @param levelName - Level name for logging (Topic/Project/ModeDefault/Global)
	 * @returns Level model result
	 */
	private async fetchLevelModel(
		levelKey: string,
		topicMode: TopicMode,
		imageModelList: ModelItem[],
		_store: SuperMagicTopicModelStoreLike,
		levelName: string,
	): Promise<LevelModelResult> {
		let hasValidRemoteData = false

		logger.report(`[Fallback] ${levelName} level fetch started`, { levelKey })

		try {
			// Step 1: 从本地缓存获取
			let localLanguageModel: ModelItem | null = null
			let localImageModel: ModelItem | null = null
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
				const l = await this.resolveLanguageModel(topicMode, cachedData.languageModelId)
				const i = await this.resolveImageModel(topicMode, cachedData.imageModelId)

				const lValid = l !== null
				const iValid = i !== null

				if (lValid) {
					localLanguageModel = l
					hasLocalCache = true
				}
				if (iValid) {
					localImageModel = i
					hasLocalCache = true
				}

				logger.report(`[Fallback] ${levelName} local cache result`, {
					levelKey,
					hasLocalCache,
					localLanguageModelId: localLanguageModel?.model_id,
					localImageModelId: localImageModel?.model_id,
					languageValid: lValid,
					imageValid: iValid,
				})
			} else {
				logger.report(`[Fallback] ${levelName} local cache miss`, { levelKey })
			}

			// Step 2: 从远程 API 获取
			let remoteLanguageModel: ModelItem | null = null
			let remoteImageModel: ModelItem | null = null
			let hasRemoteData = false

			try {
				const res = await SuperMagicApi.getSuperMagicTopicModel({
					topic_id: levelKey,
				})

				const l = await this.resolveLanguageModel(topicMode, res.model?.model_id)
				const i = await this.resolveImageModel(topicMode, res.image_model?.model_id)

				const lValid = l !== null
				const iValid = i !== null

				// Check if this mode supports image models
				const supportsImageModel = imageModelList.length > 0

				if (lValid) {
					remoteLanguageModel = l
					hasRemoteData = true
				}
				if (iValid) {
					remoteImageModel = i
					hasRemoteData = true
				}

				// 标记远程是否有完整有效的数据
				// If image models are supported: both language and image models must be valid
				// If image models are NOT supported: only language model needs to be valid,
				//   and empty/invalid image_model in the response should be treated as valid
				if (supportsImageModel) {
					// Mode supports image model: require both to be valid
					if (lValid && iValid) {
						hasValidRemoteData = true
					}
				} else {
					// Mode doesn't support image model: only check language model
					// Empty or invalid image_model in response is acceptable
					if (lValid) {
						hasValidRemoteData = true
					}
				}

				logger.report(`[Fallback] ${levelName} remote API result`, {
					levelKey,
					hasRemoteData,
					hasValidRemoteData,
					remoteLanguageModelId: remoteLanguageModel?.model_id,
					remoteImageModelId: remoteImageModel?.model_id,
					languageValid: lValid,
					imageValid: iValid,
					supportsImageModel,
				})
			} catch (e) {
				logger.report(`[Fallback] ${levelName} remote API failed`, { levelKey, error: e })
			}

			// Step 3: 校验和纠正逻辑
			let finalLanguageModel: ModelItem | null = null
			let finalImageModel: ModelItem | null = null
			let needsCorrection = false

			// 如果远程有有效数据，优先使用远程数据
			if (hasRemoteData) {
				finalLanguageModel = remoteLanguageModel
				finalImageModel = remoteImageModel

				// 检查本地和远程是否一致
				const languageModelMismatch =
					localLanguageModel?.model_id !== remoteLanguageModel?.model_id
				const imageModelMismatch = localImageModel?.model_id !== remoteImageModel?.model_id

				if (hasLocalCache && (languageModelMismatch || imageModelMismatch)) {
					needsCorrection = true
					logger.report(`[Fallback] ${levelName} data mismatch detected`, {
						levelKey,
						localLanguageModelId: localLanguageModel?.model_id,
						remoteLanguageModelId: remoteLanguageModel?.model_id,
						localImageModelId: localImageModel?.model_id,
						remoteImageModelId: remoteImageModel?.model_id,
						languageModelMismatch,
						imageModelMismatch,
					})
				}
			} else if (hasLocalCache) {
				// 如果远程没有数据，但本地有，使用本地数据
				finalLanguageModel = localLanguageModel
				finalImageModel = localImageModel
				logger.report(`[Fallback] ${levelName} using local cache (no remote data)`, {
					levelKey,
					localLanguageModelId: localLanguageModel?.model_id,
					localImageModelId: localImageModel?.model_id,
				})
			}

			// Step 4: 更新本地缓存和远程数据（如果需要纠正）
			if (needsCorrection && finalLanguageModel && finalImageModel) {
				// 更新本地缓存
				if (levelName === "Project") {
					await superMagicTopicModelCacheService.saveProjectModel(levelKey, {
						languageModelId: finalLanguageModel.model_id,
						imageModelId: finalImageModel.model_id,
						timestamp: Date.now(),
					})
				} else if (levelName === "ModeDefault") {
					await superMagicTopicModelCacheService.saveModeDefaultModel(levelKey, {
						languageModelId: finalLanguageModel.model_id,
						imageModelId: finalImageModel.model_id,
						timestamp: Date.now(),
					})
				} else {
					await superMagicTopicModelCacheService.saveTopicModel(levelKey, {
						languageModelId: finalLanguageModel.model_id,
						imageModelId: finalImageModel.model_id,
						timestamp: Date.now(),
					})
				}

				logger.log(`${levelName} level corrected`, {
					levelKey,
					languageModelId: finalLanguageModel.model_id,
					imageModelId: finalImageModel.model_id,
				})
			}

			// Determine success based on whether the mode supports image models
			// If image models are supported (imageModelList.length > 0), both models must exist
			// If image models are not supported, only language model needs to exist
			const supportsImageModel = imageModelList.length > 0
			const success = supportsImageModel
				? !!(finalLanguageModel && finalImageModel)
				: !!finalLanguageModel

			logger.report(`[Fallback] ${levelName} level completed`, {
				levelKey,
				success,
				finalLanguageModelId: finalLanguageModel?.model_id,
				finalImageModelId: finalImageModel?.model_id,
				hasValidRemoteData,
				needsCorrection,
				supportsImageModel,
			})

			return {
				success,
				languageModel: finalLanguageModel,
				imageModel: finalImageModel,
				hasValidRemoteData,
			}
		} catch (error) {
			logger.report(`[Fallback] ${levelName} level error`, { levelKey, error })
			return {
				success: false,
				languageModel: null,
				imageModel: null,
				hasValidRemoteData: false,
			}
		}
	}

	/**
	 * Check if we still need to fetch more models
	 * @param supportsImageModel - Whether the mode supports image models
	 * @param languageModel - Current language model
	 * @param imageModel - Current image model
	 * @returns true if we need to continue cascading to the next level
	 */
	private needMoreModels(
		supportsImageModel: boolean,
		languageModel: ModelItem | null,
		imageModel: ModelItem | null,
	): boolean {
		// If mode supports image models: require both models to stop cascading
		// If mode doesn't support image models: only require language model to stop cascading
		return supportsImageModel ? !languageModel || !imageModel : !languageModel
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
		store.setLoading(true)

		const modelList = superMagicModeService.getModelListByMode(topicMode)
		const imageModelList = superMagicModeService.getImageModelListByMode(topicMode)
		const supportsImageModel = imageModelList.length > 0

		logger.report("[Fallback] Four-level cascade started", {
			topicId,
			projectId,
			topicMode,
			supportsImageModel,
			availableLanguageModelsCount: modelList.length,
			availableImageModelsCount: imageModelList.length,
		})

		try {
			// 四层级联策略: Topic -> Project -> ModeDefault(default_{topicMode}) -> Global(default)
			// 每层都执行: 取本地缓存 -> 取远程 -> 校验 -> 纠正

			let finalLanguageModel: ModelItem | null = null
			let finalImageModel: ModelItem | null = null

			// 存储各级别结果，用于后续回填逻辑
			let topicResult: LevelModelResult = {
				success: false,
				languageModel: null,
				imageModel: null,
				hasValidRemoteData: false,
			}
			let projectResult: LevelModelResult = {
				success: false,
				languageModel: null,
				imageModel: null,
				hasValidRemoteData: false,
			}
			let modeDefaultResult: LevelModelResult = {
				success: false,
				languageModel: null,
				imageModel: null,
				hasValidRemoteData: false,
			}

			// Level 1: Topic 级别（跳过空或 default 的 topicId）
			const shouldFetchTopic = topicId && topicId !== DEFAULT_TOPIC_ID

			if (shouldFetchTopic) {
				logger.report("[Fallback] Level 1: Fetching Topic level", { topicId })
				topicResult = await this.fetchLevelModel(
					topicId,
					topicMode,
					imageModelList,
					store,
					"Topic",
				)

				if (store.currentTopicId !== topicId) return

				if (!finalLanguageModel) finalLanguageModel = topicResult.languageModel
				if (!finalImageModel) finalImageModel = topicResult.imageModel

				if (topicResult.success) {
					logger.report("[Fallback] Level 1: Topic level success, cascade stopped", {
						topicId,
						languageModelId: finalLanguageModel?.model_id,
						imageModelId: finalImageModel?.model_id,
					})
				} else {
					logger.report(
						"[Fallback] Level 1: Topic level incomplete, continuing cascade",
						{
							topicId,
							languageModelId: topicResult.languageModel?.model_id,
							imageModelId: topicResult.imageModel?.model_id,
						},
					)
				}
			} else {
				logger.report("[Fallback] Level 1: Topic level skipped", {
					topicId,
					reason: topicId ? "is default topic" : "empty topicId",
				})
			}

			// Level 2: Project 级别 (如果 Topic 级别未完全成功)
			const shouldFetchProject = this.needMoreModels(
				supportsImageModel,
				finalLanguageModel,
				finalImageModel,
			)

			if (shouldFetchProject && projectId) {
				logger.report("[Fallback] Level 2: Fetching Project level", { projectId })
				const projectKey = this.genProjectKey(projectId)
				projectResult = await this.fetchLevelModel(
					projectKey,
					topicMode,
					imageModelList,
					store,
					"Project",
				)

				if (store.currentTopicId !== topicId) return

				const beforeLanguage = finalLanguageModel?.model_id
				const beforeImage = finalImageModel?.model_id
				if (!finalLanguageModel) finalLanguageModel = projectResult.languageModel
				if (!finalImageModel) finalImageModel = projectResult.imageModel

				logger.report("[Fallback] Level 2: Project level result", {
					projectId,
					projectKey,
					beforeLanguageModelId: beforeLanguage,
					afterLanguageModelId: finalLanguageModel?.model_id,
					beforeImageModelId: beforeImage,
					afterImageModelId: finalImageModel?.model_id,
					isComplete: !this.needMoreModels(
						supportsImageModel,
						finalLanguageModel,
						finalImageModel,
					),
				})
			} else if (shouldFetchProject) {
				logger.report("[Fallback] Level 2: Project level skipped", {
					reason: "no projectId",
				})
			}

			// Level 3: ModeDefault 级别 (default_{topicMode}) (如果 Project 级别未完全成功)
			const shouldFetchModeDefault = this.needMoreModels(
				supportsImageModel,
				finalLanguageModel,
				finalImageModel,
			)

			if (shouldFetchModeDefault) {
				if (store.currentTopicId !== topicId) return
				const modeDefaultKey = this.genModeDefaultKey(topicMode)
				logger.report("[Fallback] Level 3: Fetching ModeDefault level", {
					topicMode,
					modeDefaultKey,
				})
				modeDefaultResult = await this.fetchLevelModel(
					modeDefaultKey,
					topicMode,
					imageModelList,
					store,
					"ModeDefault",
				)

				if (store.currentTopicId !== topicId) return

				const beforeLanguage = finalLanguageModel?.model_id
				const beforeImage = finalImageModel?.model_id
				if (!finalLanguageModel) finalLanguageModel = modeDefaultResult.languageModel
				if (!finalImageModel) finalImageModel = modeDefaultResult.imageModel

				logger.report("[Fallback] Level 3: ModeDefault level result", {
					topicMode,
					modeDefaultKey,
					beforeLanguageModelId: beforeLanguage,
					afterLanguageModelId: finalLanguageModel?.model_id,
					beforeImageModelId: beforeImage,
					afterImageModelId: finalImageModel?.model_id,
					isComplete: !this.needMoreModels(
						supportsImageModel,
						finalLanguageModel,
						finalImageModel,
					),
				})
			}

			// Level 4: Global 级别 (default) (如果 ModeDefault 级别也未完全成功)
			const shouldFetchGlobal = this.needMoreModels(
				supportsImageModel,
				finalLanguageModel,
				finalImageModel,
			)

			if (shouldFetchGlobal) {
				// 提前检查：如果 topicId 已经变了，直接返回，避免不必要的 Global 请求
				if (store.currentTopicId !== topicId) return
				logger.report("[Fallback] Level 4: Fetching Global level", {})
				const globalResult = await this.fetchLevelModel(
					DEFAULT_TOPIC_ID,
					topicMode,
					imageModelList,
					store,
					"Global",
				)

				if (store.currentTopicId !== topicId) return

				const beforeLanguage = finalLanguageModel?.model_id
				const beforeImage = finalImageModel?.model_id
				if (!finalLanguageModel) finalLanguageModel = globalResult.languageModel
				if (!finalImageModel) finalImageModel = globalResult.imageModel

				logger.report("[Fallback] Level 4: Global level result", {
					beforeLanguageModelId: beforeLanguage,
					afterLanguageModelId: finalLanguageModel?.model_id,
					beforeImageModelId: beforeImage,
					afterImageModelId: finalImageModel?.model_id,
					isComplete: !this.needMoreModels(
						supportsImageModel,
						finalLanguageModel,
						finalImageModel,
					),
				})
			}

			// Level 5: 列表第一个可用模型 (如果所有级别都失败)
			const needFirstUsableLanguage = !finalLanguageModel
			const needFirstUsableImage = !finalImageModel

			if (needFirstUsableLanguage) {
				finalLanguageModel = this.getFirstUsableModel(modelList)
				logger.report("[Fallback] Level 5: Using first usable language model", {
					languageModelId: finalLanguageModel?.model_id,
				})
			}

			if (needFirstUsableImage) {
				finalImageModel = this.getFirstUsableModel(imageModelList)
				logger.report("[Fallback] Level 5: Using first usable image model", {
					imageModelId: finalImageModel?.model_id,
				})
			}

			if (store.currentTopicId !== topicId) return

			// 更新 store
			store.setSelectedLanguageModel(finalLanguageModel)
			store.setSelectedImageModel(finalImageModel)

			// 级联回填逻辑：从高级别获取的值回填到低级别
			// 确定数据来源级别
			const sourceLevel =
				shouldFetchTopic && topicResult.success
					? "Topic"
					: projectResult.success
						? "Project"
						: modeDefaultResult.success
							? "ModeDefault"
							: "Global"

			logger.report("[Fallback] Data source level determined", {
				sourceLevel,
				topicSuccess: topicResult.success,
				projectSuccess: projectResult.success,
				modeDefaultSuccess: modeDefaultResult.success,
			})

			// 回填规则：只有从更高级别获取的数据才应该回填到低级别
			// Topic 成功 → 不回填任何级别
			// Project 成功 → 只回填 Topic
			// ModeDefault 成功 → 回填 Topic 和 Project
			// Global 成功 → 回填 Topic, Project 和 ModeDefault

			// 回填 Topic 级别（仅当数据来源是 Project, ModeDefault 或 Global 时，且 topicId 有效）
			// 修复：允许 languageModel 和 imageModel 独立回填（不要求两者都存在）
			const needTopicBackfill =
				shouldFetchTopic && // topicId 有效
				sourceLevel !== "Topic" && // 数据不是来自 Topic 本身
				(!topicResult.success || !topicResult.hasValidRemoteData) &&
				(finalLanguageModel || finalImageModel) // At least one model exists

			if (needTopicBackfill) {
				logger.report("[Fallback] Backfilling Topic level", {
					topicId,
					sourceLevel,
					languageModelId: finalLanguageModel?.model_id,
					imageModelId: finalImageModel?.model_id,
				})
				// 保存到 Topic 级别本地缓存
				await superMagicTopicModelCacheService.saveTopicModel(topicId, {
					languageModelId: finalLanguageModel?.model_id,
					imageModelId: finalImageModel?.model_id,
					timestamp: Date.now(),
				})

				// 更新 Topic 级别远程数据
				try {
					await SuperMagicApi.saveSuperMagicTopicModel({
						cache_id: topicId,
						model_id: finalLanguageModel?.model_id,
						image_model_id: finalImageModel?.model_id,
					})
					logger.log("Backfilled Topic level (independent models)", {
						topicId,
						languageModelId: finalLanguageModel?.model_id,
						imageModelId: finalImageModel?.model_id,
					})
				} catch (e) {
					logger.log("Failed to backfill Topic remote data", { topicId, error: e })
				}
			} else if (shouldFetchTopic && topicResult.success && topicResult.hasValidRemoteData) {
				// Topic 级别本身就成功了且远程数据也有效，只需更新本地缓存
				await superMagicTopicModelCacheService.saveTopicModel(topicId, {
					languageModelId: finalLanguageModel?.model_id,
					imageModelId: finalImageModel?.model_id,
					timestamp: Date.now(),
				})
			}

			// 回填 Project 级别（仅当数据来源是 ModeDefault 或 Global 时）
			// 修复：允许 languageModel 和 imageModel 独立回填
			const needProjectBackfill =
				projectId &&
				(sourceLevel === "ModeDefault" || sourceLevel === "Global") && // 数据来自 ModeDefault 或 Global 级别
				(!projectResult.success || !projectResult.hasValidRemoteData) &&
				(finalLanguageModel || finalImageModel) // At least one model exists

			if (needProjectBackfill) {
				const projectKey = this.genProjectKey(projectId)
				logger.report("[Fallback] Backfilling Project level", {
					projectId,
					projectKey,
					sourceLevel,
					languageModelId: finalLanguageModel?.model_id,
					imageModelId: finalImageModel?.model_id,
				})

				// 保存到 Project 级别本地缓存
				await superMagicTopicModelCacheService.saveProjectModel(projectId, {
					languageModelId: finalLanguageModel?.model_id,
					imageModelId: finalImageModel?.model_id,
					timestamp: Date.now(),
				})

				// 更新 Project 级别远程数据
				try {
					await SuperMagicApi.saveSuperMagicTopicModel({
						cache_id: projectKey,
						model_id: finalLanguageModel?.model_id,
						image_model_id: finalImageModel?.model_id,
					})
					logger.log("Backfilled Project level (independent models)", {
						projectId,
						languageModelId: finalLanguageModel?.model_id,
						imageModelId: finalImageModel?.model_id,
					})
				} catch (e) {
					logger.log("Failed to backfill Project remote data", { projectId, error: e })
				}
			} else if (projectId && projectResult.success && projectResult.hasValidRemoteData) {
				// Project 级别本身就成功了且远程数据也有效，只需更新本地缓存
				await superMagicTopicModelCacheService.saveProjectModel(projectId, {
					languageModelId: finalLanguageModel?.model_id,
					imageModelId: finalImageModel?.model_id,
					timestamp: Date.now(),
				})
			}

			// 回填 ModeDefault 级别（仅当数据来源是 Global 时）
			// 修复：允许 languageModel 和 imageModel 独立回填
			const needModeDefaultBackfill =
				sourceLevel === "Global" && // 数据来自 Global 级别
				(!modeDefaultResult.success || !modeDefaultResult.hasValidRemoteData) &&
				(finalLanguageModel || finalImageModel) // At least one model exists

			if (needModeDefaultBackfill) {
				const modeDefaultKey = this.genModeDefaultKey(topicMode)
				logger.report("[Fallback] Backfilling ModeDefault level", {
					topicMode,
					modeDefaultKey,
					sourceLevel,
					languageModelId: finalLanguageModel?.model_id,
					imageModelId: finalImageModel?.model_id,
				})

				// 保存到 ModeDefault 级别本地缓存
				await superMagicTopicModelCacheService.saveModeDefaultModel(modeDefaultKey, {
					languageModelId: finalLanguageModel?.model_id,
					imageModelId: finalImageModel?.model_id,
					timestamp: Date.now(),
				})

				// 更新 ModeDefault 级别远程数据
				try {
					await SuperMagicApi.saveSuperMagicTopicModel({
						cache_id: modeDefaultKey,
						model_id: finalLanguageModel?.model_id,
						image_model_id: finalImageModel?.model_id,
					})
					logger.log("Backfilled ModeDefault level (independent models)", {
						topicMode,
						languageModelId: finalLanguageModel?.model_id,
						imageModelId: finalImageModel?.model_id,
					})
				} catch (e) {
					logger.log("Failed to backfill ModeDefault remote data", {
						topicMode,
						error: e,
					})
				}
			} else if (modeDefaultResult.success && modeDefaultResult.hasValidRemoteData) {
				// ModeDefault 级别本身就成功了且远程数据也有效，只需更新本地缓存
				await superMagicTopicModelCacheService.saveModeDefaultModel(
					this.genModeDefaultKey(topicMode),
					{
						languageModelId: finalLanguageModel?.model_id,
						imageModelId: finalImageModel?.model_id,
						timestamp: Date.now(),
					},
				)
			}

			logger.report("[Fallback] Four-level cascade completed", {
				topicId,
				projectId,
				topicMode,
				sourceLevel,
				finalLanguageModelId: finalLanguageModel?.model_id,
				finalImageModelId: finalImageModel?.model_id,
				topicBackfilled: needTopicBackfill,
				projectBackfilled: needProjectBackfill,
				modeDefaultBackfilled: needModeDefaultBackfill,
				usedFirstUsableLanguage: needFirstUsableLanguage,
				usedFirstUsableImage: needFirstUsableImage,
			})
		} catch (error) {
			if (store.currentTopicId !== topicId) return
			logger.report("Critical error in fetchTopicModel", { topicId, error })
			this.setFirstUsableModels(modelList, imageModelList, store)
		} finally {
			if (store.currentTopicId === topicId) {
				store.setLoading(false)
			}
		}
	}

	/**
	 * Set first usable models (final fallback)
	 * @param modelList - Available language models
	 * @param imageModelList - Available image models
	 * @param store - Store instance
	 */
	private setFirstUsableModels(
		modelList: ModelItem[],
		imageModelList: ModelItem[],
		store: SuperMagicTopicModelStoreLike = topicModelStore,
	) {
		const firstLanguage = this.getFirstUsableModel(modelList)
		const firstImage = this.getFirstUsableModel(imageModelList)

		store.setSelectedLanguageModel(firstLanguage)
		store.setSelectedImageModel(firstImage)

		logger.log("Using first usable models (fallback)", {
			languageModelId: firstLanguage?.model_id,
			imageModelId: firstImage?.model_id,
		})
	}

	/**
	 * Save model configuration with debouncing
	 * @param topicId - Topic ID
	 * @param projectId - Project ID
	 * @param languageModel - Language model (undefined = keep current)
	 * @param imageModel - Image model (undefined = keep current)
	 * @param store - Store instance
	 */
	async saveModel(
		topicId: string,
		projectId: string,
		languageModel?: ModelItem | null,
		imageModel?: ModelItem | null,
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
			cacheKey = this.genModeDefaultKey(store.currentTopicMode)
			cacheId = this.genModeDefaultKey(store.currentTopicMode)
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
		})

		// Step 1: Update Store state immediately
		if (languageModel !== undefined) {
			store.setSelectedLanguageModel(languageModel)
		}
		if (imageModel !== undefined) {
			store.setSelectedImageModel(imageModel)
		}

		// Step 2: Save to local cache immediately
		const currentLanguage =
			languageModel !== undefined ? languageModel : store.selectedLanguageModel
		const currentImage = imageModel !== undefined ? imageModel : store.selectedImageModel

		// Save to appropriate level cache
		if (saveLevel === "Topic") {
			// Save to both Topic and Project level
			await superMagicTopicModelCacheService.saveTopicModel(topicId, {
				languageModelId: currentLanguage?.model_id,
				imageModelId: currentImage?.model_id,
				timestamp: Date.now(),
			})
			// Also save to Project level to update project default
			if (projectId) {
				await superMagicTopicModelCacheService.saveProjectModel(projectId, {
					languageModelId: currentLanguage?.model_id,
					imageModelId: currentImage?.model_id,
					timestamp: Date.now(),
				})
			}
		} else if (saveLevel === "Project") {
			await superMagicTopicModelCacheService.saveProjectModel(projectId, {
				languageModelId: currentLanguage?.model_id,
				imageModelId: currentImage?.model_id,
				timestamp: Date.now(),
			})
		} else if (saveLevel === "ModeDefault") {
			// Save to ModeDefault level
			await superMagicTopicModelCacheService.saveModeDefaultModel(cacheKey, {
				languageModelId: currentLanguage?.model_id,
				imageModelId: currentImage?.model_id,
				timestamp: Date.now(),
			})
		} else {
			// Save to default/global level
			await superMagicTopicModelCacheService.saveDefaultModel({
				languageModelId: currentLanguage?.model_id,
				imageModelId: currentImage?.model_id,
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
			timestamp: Date.now(),
		}

		// Merge latest model selection
		if (languageModel !== undefined) {
			pending.languageModel = languageModel
		}
		if (imageModel !== undefined) {
			pending.imageModel = imageModel
		}
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
				timestamp: Date.now(),
			}

			// Merge latest model selection
			if (languageModel !== undefined) {
				projectPending.languageModel = languageModel
			}
			if (imageModel !== undefined) {
				projectPending.imageModel = imageModel
			}
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

		const { topicId, projectId, cacheId, languageModel, imageModel } = data

		logger.report("[Save] Flushing pending save to backend", {
			cacheKey,
			cacheId,
			topicId,
			projectId,
			languageModelId: languageModel?.model_id,
			imageModelId: imageModel?.model_id,
		})

		try {
			const res = await SuperMagicApi.saveSuperMagicTopicModel({
				cache_id: cacheId || topicId, // Use cacheId if available, fallback to topicId
				model_id: languageModel?.model_id,
				image_model_id: imageModel?.model_id,
			})

			if (res.success) {
				logger.report("[Save] Backend save successful", {
					cacheId,
					topicId,
					projectId,
					languageModelId: languageModel?.model_id,
					imageModelId: imageModel?.model_id,
				})
			}
		} catch (error) {
			logger.report("[Save] Backend save failed", {
				cacheId,
				topicId,
				projectId,
				languageModelId: languageModel?.model_id,
				imageModelId: imageModel?.model_id,
				error,
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
	genModeDefaultKey(topicMode: TopicMode): string {
		return `default_${topicMode}`
	}

	/**
	 * Cleanup timers and buffers for specific topic
	 * @param topicId - Topic ID
	 */
	cleanup(topicId: string) {
		const timer = this.debounceTimers.get(topicId)
		if (timer) {
			clearTimeout(timer)
			this.debounceTimers.delete(topicId)
		}
		this.pendingSaves.delete(topicId)
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
