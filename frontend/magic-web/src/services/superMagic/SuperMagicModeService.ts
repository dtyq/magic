import { BUSINESS_API_ERROR_CODE } from "@/constants/api"
import { MODEL_TYPE_IMAGE, MODEL_TYPE_LLM } from "@/apis/modules/org-ai-model-provider"
import { userStore } from "@/models/user"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/types"
import {
	ModeItem,
	ModeModelGroupItemResponse,
	TopicMode,
} from "@/pages/superMagic/pages/Workspace/types"
import superMagicCustomModelService from "./SuperMagicCustomModelService"
import superMagicModeListRepository, {
	LEGACY_MODE_LIST_LS_PREFIX,
} from "./repositories/SuperMagicModeListRepository"
import { logger as Logger } from "@/utils/log"
import { platformKey } from "@/utils/storage"
import { TFunction } from "i18next"
import { makeAutoObservable, reaction } from "mobx"
import { SuperMagicApi } from "@/apis"
import { configStore } from "@/models/config"
import { interfaceStore } from "@/stores/interface"
import { waitForLanguageReady } from "@/utils/waitPublicConfigInit"

const logger = Logger.createLogger("SuperMagicModeService")
type ModeModelType = "language" | "image" | "video"

/** Map key for featured modes; custom_agent uses agent_code as identifier */
export function resolveModeMapKey(topicMode: string, agentCode?: string | null): string {
	if (topicMode === TopicMode.CustomAgent && agentCode) return agentCode
	return topicMode
}

/**
 * Key for `_modeMap` entries from featured or persisted lists. Backend uses the
 * agent code as `mode.identifier` for custom crews (not the literal
 * `TopicMode.CustomAgent`), so this equals `resolveModeMapKey(CustomAgent,
 * agentCode)` when resolving those rows.
 */
function resolveFeaturedModeMapKey(item: ModeItem): string {
	return item.mode.identifier
}

function buildModeMapFromModeList(list: ModeItem[]): Map<string, ModeItem> {
	return new Map(list.map((item) => [resolveFeaturedModeMapKey(item), item]))
}

// Configuration constants
/** Client freshness window for fetchModeList dedupe (not a polling interval) */
const REFRESH_INTERVAL = 15 * 60 * 1000
const MAX_RETRY_COUNT = 3
const RETRY_DELAY_BASE = 1000 // Base delay for retry in milliseconds

interface RequestState<T> {
	promise: Promise<T> | null
	contextKey: string | null
}

interface FreshnessState {
	lastContextKey: string | null
	lastFetchAt: number
}

function createEmptyRequestState<T>(): RequestState<T> {
	return {
		promise: null,
		contextKey: null,
	}
}

function createEmptyFreshnessState(): FreshnessState {
	return {
		lastContextKey: null,
		lastFetchAt: 0,
	}
}

/**
 * Super Magic 模式服务
 * 用于管理 Super Magic 模式列表
 * 提供模式列表的获取、设置、验证等功能
 */
class SuperMagicModeService {
	_modeList: ModeItem[] = []

	_modeMap: Map<string, ModeItem> = new Map()

	_isModeListLoading = false

	_retryTimer: ReturnType<typeof setTimeout> | null = null

	private _modeListRequestState = createEmptyRequestState<ModeItem[]>()

	modeListReaction: ReturnType<typeof reaction> | null = null

	private _defaultModeModelList: ModeModelGroupItemResponse[] | null = null
	private _defaultModeModelRequestState = createEmptyRequestState<void>()
	private _modeListFreshnessState = createEmptyFreshnessState()
	private _defaultModeModelFreshnessState = createEmptyFreshnessState()

	private _legacyMigrationPromise: Promise<void> | null = null

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })

		// Auto cleanup on page unload
		if (typeof window !== "undefined") {
			window.addEventListener("beforeunload", this.destroy)
		}

		// Kick off legacy localStorage → IndexedDB migration early so
		// quota pressure is relieved regardless of current user context.
		void this.migrateLegacyLocalStorage()

		this.modeListReaction = reaction(
			() => [
				configStore.i18n.displayLanguage,
				userStore.user.organizationCode,
				userStore.user.userInfo?.user_id,
			],
			([displayLanguage, organizationCode, userId]) => {
				if (!organizationCode || !userId) {
					this.resetModeList()
					return
				}

				logger.log("Mode list context changed", {
					displayLanguage,
					organizationCode,
					userId,
				})
				void this.hydrateFromStorage().finally(() => {
					void this.fetchModeList()
				})
			},
			{ fireImmediately: true },
		)
	}

	private get globalTopicModeLocaleStorageKey() {
		const context = this.resolveCurrentModeListContext()
		return context?.storageKey ?? null
	}

	private get currentContextKey() {
		const organizationCode = userStore.user.organizationCode || "unknown-org"
		const userId = userStore.user.userInfo?.user_id || "unknown-user"
		const lang = configStore.i18n.displayLanguage ?? "unknown-lang"
		return `${organizationCode}:${userId}:${lang}`
	}

	private isFreshForCurrentContext(lastContextKey: string | null, lastFetchAt: number) {
		return (
			lastContextKey === this.currentContextKey && Date.now() - lastFetchAt < REFRESH_INTERVAL
		)
	}

	private hasFreshDataForCurrentContext(freshnessState: FreshnessState) {
		return this.isFreshForCurrentContext(
			freshnessState.lastContextKey,
			freshnessState.lastFetchAt,
		)
	}

	private markFreshForContext(contextKey: string): FreshnessState {
		return {
			lastContextKey: contextKey,
			lastFetchAt: Date.now(),
		}
	}

	private resolveCurrentModeListContext() {
		const organizationCode = userStore.user.organizationCode
		const userId = userStore.user.userInfo?.user_id
		if (!organizationCode || !userId) return null

		const lang = configStore.i18n.displayLanguage ?? "unknown-lang"
		return {
			contextKey: `${organizationCode}:${userId}:${lang}`,
			storageKey: platformKey(`super_magic/mode_list/${organizationCode}/${userId}/${lang}`),
		}
	}

	/**
	 * Hydrate mode list from IndexedDB; falls back to localStorage when IDB
	 * is unavailable (private mode, quota errors, etc.).
	 */
	async hydrateFromStorage(
		storageKey: string | null = this.globalTopicModeLocaleStorageKey,
	): Promise<void> {
		if (!storageKey) {
			this.resetModeList()
			return
		}

		// Make sure any legacy entry for this key has been moved to IDB first
		await this.migrateLegacyLocalStorage()

		try {
			const data = await superMagicModeListRepository.getByKey(storageKey)
			if (Array.isArray(data)) {
				this._modeList = data
				this._modeMap = buildModeMapFromModeList(data)
				logger.log("Successfully loaded mode list from IndexedDB")
				return
			}
			if (data !== undefined) {
				logger.warn("Invalid mode list data in IndexedDB, expected array")
			}
		} catch (error) {
			logger.warn(
				"Failed to load mode list from IndexedDB, falling back to localStorage",
				error,
			)
			this.hydrateFromLocalStorageFallback(storageKey)
			return
		}

		this.hydrateFromLocalStorageFallback(storageKey)
	}

	private hydrateFromLocalStorageFallback(storageKey: string) {
		try {
			const raw = window.localStorage.getItem(storageKey)
			if (!raw) {
				this.resetModeList()
				return
			}
			const parsed = JSON.parse(raw)
			if (Array.isArray(parsed)) {
				this._modeList = parsed
				this._modeMap = buildModeMapFromModeList(parsed)
				logger.log("Loaded mode list from localStorage fallback")
			} else {
				logger.warn("Invalid mode list data in localStorage fallback")
				this.resetModeList()
			}
		} catch (error) {
			logger.error("Failed to load mode list from localStorage fallback", error)
			this.resetModeList()
		}
	}

	/**
	 * Persist mode list to IndexedDB; falls back to localStorage on failure.
	 */
	async persistToStorage(
		modeList: ModeItem[],
		storageKey: string | null = this.globalTopicModeLocaleStorageKey,
	): Promise<void> {
		if (!storageKey) return

		try {
			await superMagicModeListRepository.saveByKey(storageKey, modeList)
			return
		} catch (error) {
			logger.warn(
				"Failed to persist mode list to IndexedDB, falling back to localStorage",
				error,
			)
		}

		try {
			window.localStorage.setItem(storageKey, JSON.stringify(modeList))
		} catch (error) {
			logger.error("Failed to persist mode list to localStorage fallback", error)
		}
	}

	/**
	 * One-time, idempotent migration of legacy localStorage entries to IDB.
	 * Removes every `MAGIC:super_magic/mode_list/*` key to relieve quota —
	 * including entries for other organizations the user may no longer need.
	 */
	migrateLegacyLocalStorage(): Promise<void> {
		if (this._legacyMigrationPromise) {
			return this._legacyMigrationPromise
		}

		this._legacyMigrationPromise = (async () => {
			if (typeof window === "undefined" || !window.localStorage) return

			const storage = window.localStorage
			const keys: string[] = []
			try {
				for (let i = 0; i < storage.length; i += 1) {
					const key = storage.key(i)
					if (key && key.startsWith(LEGACY_MODE_LIST_LS_PREFIX)) {
						keys.push(key)
					}
				}
			} catch (error) {
				logger.warn("Failed to enumerate legacy mode list keys", error)
				return
			}

			if (keys.length === 0) return

			let migrated = 0
			let removed = 0
			for (const key of keys) {
				let shouldRemove = true
				try {
					const raw = storage.getItem(key)
					if (raw) {
						const parsed = JSON.parse(raw)
						if (Array.isArray(parsed)) {
							await superMagicModeListRepository.saveByKey(key, parsed)
							migrated += 1
						}
					}
				} catch (error) {
					// Keep the entry if IDB write failed so we can retry next time;
					// still remove malformed JSON to free up space.
					logger.warn("Failed to migrate legacy mode list entry", { key, error })
					shouldRemove = this.isLegacyEntryCorrupted(storage, key)
				}

				if (shouldRemove) {
					try {
						storage.removeItem(key)
						removed += 1
					} catch (error) {
						logger.warn("Failed to remove legacy mode list entry", { key, error })
					}
				}
			}

			logger.log("Legacy mode list migration finished", {
				scanned: keys.length,
				migrated,
				removed,
			})
		})().catch((error) => {
			logger.error("Legacy mode list migration crashed", error)
			// Allow a retry in future lifecycles instead of latching the failure.
			this._legacyMigrationPromise = null
		})

		return this._legacyMigrationPromise
	}

	private isLegacyEntryCorrupted(storage: Storage, key: string): boolean {
		try {
			const raw = storage.getItem(key)
			if (!raw) return true
			JSON.parse(raw)
			return false
		} catch {
			return true
		}
	}

	private resetModeList() {
		this._modeList = []
		this._modeMap = new Map()
	}

	/**
	 * 获取第一个模式标识
	 * @returns
	 */
	get firstModeIdentifier() {
		return this._modeList?.[0]?.mode?.identifier as TopicMode
	}

	/**
	 * 获取模式列表
	 * @returns
	 */
	get modeList() {
		return this._modeList
	}

	get isModeListLoading() {
		return this._isModeListLoading
	}

	/**
	 * 获取模式分组列表
	 * @param mode 模式标识
	 * @param agentCode custom_agent 时与 featured mode.identifier 一致
	 * @returns
	 */
	getModelGroupsByMode(mode: string, agentCode?: string | null) {
		const key = resolveModeMapKey(mode, agentCode)
		return this._modeMap.get(key)?.groups
	}

	/**
	 * 获取模式模型列表
	 * @param mode
	 * @param agentCode custom_agent 时与 featured mode.identifier 一致
	 * @returns
	 */
	getModelListByMode(mode: string, agentCode?: string | null) {
		const key = resolveModeMapKey(mode, agentCode)
		return this._modeMap.get(key)?.groups.flatMap((item) => item.models ?? []) ?? []
	}

	/**
	 * 获取模式生图模型分组列表
	 * @param mode 模式标识
	 * @param agentCode custom_agent 时与 featured mode.identifier 一致
	 * @returns
	 */
	getImageModelGroupsByMode(mode: string, agentCode?: string | null) {
		const key = resolveModeMapKey(mode, agentCode)
		const groups = this._modeMap.get(key)?.groups
		if (!groups) return undefined
		return groups.map((item) => ({
			...item,
			models: item.image_models || [],
		}))
	}

	/**
	 * 获取模式生图模型列表
	 * @param mode
	 * @param agentCode custom_agent 时与 featured mode.identifier 一致
	 * @returns
	 */
	getImageModelListByMode(mode: string, agentCode?: string | null) {
		const key = resolveModeMapKey(mode, agentCode)
		return this._modeMap.get(key)?.groups.flatMap((item) => item.image_models || []) ?? []
	}

	/**
	 * 获取模式视频模型分组列表
	 * @param mode 模式标识
	 * @param agentCode custom_agent 时与 featured mode.identifier 一致
	 * @returns
	 */
	getVideoModelGroupsByMode(mode: string, agentCode?: string | null) {
		const key = resolveModeMapKey(mode, agentCode)
		const groups = this._modeMap.get(key)?.groups
		if (!groups) return undefined
		return groups.map((item) => ({
			...item,
			models: item.video_models || [],
		}))
	}

	/**
	 * 获取模式视频模型列表
	 * @param mode
	 * @param agentCode custom_agent 时与 featured mode.identifier 一致
	 * @returns
	 */
	getVideoModelListByMode(mode: string, agentCode?: string | null) {
		const key = resolveModeMapKey(mode, agentCode)
		return this._modeMap.get(key)?.groups.flatMap((item) => item.video_models || []) ?? []
	}

	private getOfficialModelListByType(
		mode: string,
		modelType: ModeModelType,
		agentCode?: string | null,
	): ModelItem[] {
		if (modelType === "image") return this.getImageModelListByMode(mode, agentCode)
		if (modelType === "video") return this.getVideoModelListByMode(mode, agentCode)
		return this.getModelListByMode(mode, agentCode)
	}

	async resolveModelByMode({
		mode,
		modelId,
		modelType,
		agentCode,
	}: {
		mode: string
		modelId?: string | null
		modelType: ModeModelType
		agentCode?: string | null
	}): Promise<ModelItem | null> {
		if (!modelId) return null

		if (modelType !== "video") {
			const customModel = await superMagicCustomModelService.findMyModelById({
				modelId,
				modelType: modelType === "image" ? MODEL_TYPE_IMAGE : MODEL_TYPE_LLM,
			})
			if (customModel) {
				return superMagicCustomModelService.toModelItem(customModel)
			}
		}

		const officialModel = this.getOfficialModelListByType(mode, modelType, agentCode).find(
			(model) => model.model_id === modelId,
		)
		return officialModel ?? null
	}

	async resolveLanguageModelByMode(
		mode: string,
		modelId?: string | null,
		agentCode?: string | null,
	) {
		return this.resolveModelByMode({
			mode,
			modelId,
			modelType: "language",
			agentCode,
		})
	}

	async resolveImageModelByMode(
		mode: string,
		modelId?: string | null,
		agentCode?: string | null,
	) {
		return this.resolveModelByMode({
			mode,
			modelId,
			modelType: "image",
			agentCode,
		})
	}

	async resolveVideoModelByMode(
		mode: string,
		modelId?: string | null,
		agentCode?: string | null,
	) {
		return this.resolveModelByMode({
			mode,
			modelId,
			modelType: "video",
			agentCode,
		})
	}

	/**
	 * Check if a mode supports image model configuration
	 * @param mode - Mode identifier
	 * @param agentCode - custom_agent 时与 featured mode.identifier 一致
	 * @returns true if the mode supports image models
	 */
	supportsImageModel(mode: string, agentCode?: string | null): boolean {
		const imageModelList = this.getImageModelListByMode(mode, agentCode)
		return imageModelList.length > 0
	}

	/**
	 * Check if a mode supports video model configuration
	 * @param mode - Mode identifier
	 * @param agentCode - custom_agent 时与 featured mode.identifier 一致
	 * @returns true if the mode supports video models
	 */
	supportsVideoModel(mode: string, agentCode?: string | null): boolean {
		const videoModelList = this.getVideoModelListByMode(mode, agentCode)
		return videoModelList.length > 0
	}

	/**
	 * 设置模式列表
	 * @param modeList 模式列表
	 */
	setModeList(modeList: ModeItem[]) {
		this._modeList = modeList
	}

	/**
	 * 验证模式是否有效
	 * @param mode 模式标识
	 * @param agentCode custom_agent 时必填以匹配 featured
	 * @returns
	 */
	isModeValid(mode: string, agentCode?: string | null) {
		if (mode === TopicMode.CustomAgent) {
			if (!agentCode?.trim()) return false
			const key = resolveModeMapKey(mode, agentCode)
			const ok = this._modeMap.has(key)
			if (interfaceStore.isMobile) return ok && key !== TopicMode.Chat
			return ok
		}

		const isValid =
			this._modeMap.has(mode) ||
			[
				TopicMode.Default,
				TopicMode.CrewCreator,
				TopicMode.SkillCreator,
				TopicMode.MagiClaw,
			].includes(mode as TopicMode)
		if (interfaceStore.isMobile) {
			return isValid && mode !== TopicMode.Chat
		}
		return isValid
	}

	/**
	 * Clean up retry timer
	 */
	cleanup() {
		if (this._retryTimer) {
			clearTimeout(this._retryTimer)
			this._retryTimer = null
		}
	}

	/**
	 * Get the current fetch promise
	 * Can be used to wait for the fetch to complete externally
	 */
	get fetchPromise() {
		return this._modeListRequestState.promise
	}

	/**
	 * Best-effort featured mode refresh.
	 *
	 * Resolves with the current cached list on failure.
	 * Retryable failures continue in the background.
	 * The returned promise does not cover the retry chain.
	 */
	fetchModeList({
		retryCount = 0,
		force = false,
	}: { retryCount?: number; force?: boolean } = {}): Promise<ModeItem[]> {
		const requestContext = this.resolveCurrentModeListContext()
		if (!requestContext) {
			this.resetModeList()
			this._isModeListLoading = false
			return Promise.resolve(this._modeList)
		}

		// Reuse in-flight request to avoid duplicate fetches (unless forcing a refresh)
		if (
			!force &&
			this._modeListRequestState.promise &&
			this._modeListRequestState.contextKey === requestContext.contextKey
		) {
			return this._modeListRequestState.promise
		}

		if (
			force &&
			this._modeListRequestState.promise &&
			this._modeListRequestState.contextKey === requestContext.contextKey
		) {
			return this._modeListRequestState.promise.then(() =>
				this.fetchModeList({ retryCount, force: true }),
			)
		}

		if (
			!force &&
			retryCount === 0 &&
			this._modeList.length > 0 &&
			this.hasFreshDataForCurrentContext(this._modeListFreshnessState)
		) {
			return Promise.resolve(this._modeList)
		}

		// Clear previous retry timer
		this.cleanup()
		this._isModeListLoading = true

		// Wait for persisted locale / i18n sync before language-scoped featured API.
		// No need to block on the rest of public-config initialization here.
		const fetchPromise = (async () => {
			await waitForLanguageReady()
			return await SuperMagicApi.getCrewList()
		})()
			.then((res) => {
				if (requestContext.contextKey !== this.currentContextKey) {
					logger.log("Discard stale mode list response", {
						requestContextKey: requestContext.contextKey,
						currentContextKey: this.currentContextKey,
					})
					return this._modeList
				}

				this._modeList = res.list.map((item) => ({
					...item,
					groups: item.groups.map((group) => {
						const modelIds = group.model_ids ?? []
						const imageModelIds = group.image_model_ids ?? []
						const videoModelIds = group.video_model_ids ?? []

						return {
							...group,
							model_ids: modelIds,
							image_model_ids: imageModelIds,
							video_model_ids: videoModelIds,
							models: modelIds.map((modelId) => res.models[modelId]).filter(Boolean),
							image_models: imageModelIds
								.map((modelId) => res.models[modelId])
								.filter(Boolean),
							video_models: videoModelIds
								.map((modelId) => res.models[modelId])
								.filter(Boolean),
						}
					}),
				}))
				// Default entry is owned by fetchDefaultModeModelList; preserve it
				// across featured-list rebuilds to avoid a window where the UI reads
				// an empty list while the cached Default data is still valid.
				const preservedDefaultEntry = this._modeMap.get(TopicMode.Default) ?? null
				this._modeMap = buildModeMapFromModeList(this._modeList)
				if (preservedDefaultEntry) {
					this._modeMap.set(TopicMode.Default, preservedDefaultEntry)
				}

				if (this._modeList.length > 0) {
					this.fetchDefaultModeModelList()
				}

				void this.persistToStorage(this._modeList, requestContext.storageKey)
				this._modeListFreshnessState = this.markFreshForContext(requestContext.contextKey)
				// Clear retry timer on success
				this.cleanup()
				return this._modeList
			})
			.catch((err) => {
				logger.error("fetchModeList error", err)
				if (requestContext.contextKey !== this.currentContextKey) {
					logger.log("Ignore stale mode list error", {
						requestContextKey: requestContext.contextKey,
						currentContextKey: this.currentContextKey,
					})
					return this._modeList
				}

				const shouldRetry =
					retryCount < MAX_RETRY_COUNT &&
					// 如果请求被取消，则不进行兜底处理
					err?.name !== "AbortError" &&
					// 如果账号无权限，则不进行兜底处理
					err?.code !== BUSINESS_API_ERROR_CODE.ACCOUNT_NO_PERMISSION
				if (shouldRetry) {
					// Schedule retry without extending this promise chain.
					this._retryTimer = setTimeout(
						() => {
							this.fetchModeList({ retryCount: retryCount + 1, force })
						},
						RETRY_DELAY_BASE * (retryCount + 1),
					)
				}
				if (!shouldRetry) this._isModeListLoading = false
				// Fall back to cached data for this attempt.
				return this._modeList
			})
			.finally(() => {
				if (this._modeListRequestState.promise !== fetchPromise) return
				// Clear the promise reference after completion
				this._modeListRequestState = createEmptyRequestState<ModeItem[]>()
				if (!this._retryTimer) this._isModeListLoading = false
			})

		this._modeListRequestState = {
			promise: fetchPromise,
			contextKey: requestContext.contextKey,
		}

		return fetchPromise
	}

	/**
	 * True when user/org/lang identity is hydrated; avoids firing with unknown-* keys.
	 */
	private get isContextReady() {
		const { organizationCode, userInfo } = userStore.user
		return Boolean(organizationCode && userInfo?.user_id && configStore.i18n.displayLanguage)
	}

	/**
	 * Fetch default-mode model list for TopicMode.Default.
	 * @param force Bypass freshness short-circuit; refetch (e.g. edit page + SW cache)
	 */
	fetchDefaultModeModelList({ force = false }: { force?: boolean } = {}): Promise<void> {
		if (!this.isContextReady) {
			return Promise.resolve()
		}

		const requestContextKey = this.currentContextKey

		if (
			!force &&
			this._defaultModeModelRequestState.promise &&
			this._defaultModeModelRequestState.contextKey === requestContextKey
		) {
			return this._defaultModeModelRequestState.promise
		}

		if (
			force &&
			this._defaultModeModelRequestState.promise &&
			this._defaultModeModelRequestState.contextKey === requestContextKey
		) {
			return this._defaultModeModelRequestState.promise.then(() =>
				this.fetchDefaultModeModelList({ force: true }),
			)
		}

		if (
			!force &&
			this._defaultModeModelList &&
			this.hasFreshDataForCurrentContext(this._defaultModeModelFreshnessState)
		) {
			return Promise.resolve()
		}

		const fetchPromise = (async () => {
			await waitForLanguageReady()
			return await SuperMagicApi.getDefaultModeModelList()
		})()
			.then((res) => {
				if (requestContextKey !== this.currentContextKey) {
					logger.log("Discard stale default mode model response", {
						requestContextKey,
						currentContextKey: this.currentContextKey,
					})
					return
				}

				const groups = res.groups.map((group) => ({
					...group,
					models: (group.model_ids ?? [])
						.map((modelId) => res.models[modelId])
						.filter(Boolean),
					image_models: (group.image_model_ids ?? []).map(
						(modelId) => res.models[modelId],
					),
					video_models: (group.video_model_ids ?? []).map(
						(modelId) => res.models[modelId],
					),
				}))

				this._defaultModeModelList = groups
				this._defaultModeModelFreshnessState = this.markFreshForContext(requestContextKey)
				this._modeMap.set(TopicMode.Default, {
					...res,
					groups,
				})
			})
			.finally(() => {
				if (this._defaultModeModelRequestState.promise !== fetchPromise) return
				this._defaultModeModelRequestState = createEmptyRequestState<void>()
			})

		this._defaultModeModelRequestState = {
			promise: fetchPromise,
			contextKey: requestContextKey,
		}

		return fetchPromise
	}

	/**
	 * 等待模式列表获取完成
	 * @returns
	 */
	waitForFetchPromise() {
		return this._modeListRequestState.promise
			? this._modeListRequestState.promise.then(() => true)
			: Promise.resolve(true)
	}

	/**
	 * 获取模式配置
	 * @param mode 模式
	 * @param agentCode custom_agent 时与 featured mode.identifier 一致
	 * @returns
	 */
	getModeConfigWithLegacy(
		mode: string,
		t?: TFunction,
		_isMobile: boolean = false,
		agentCode?: string | null,
	) {
		const key = resolveModeMapKey(mode, agentCode)
		const modeItem = this._modeMap.get(key)
		if (modeItem) {
			return modeItem
		}
		// Legacy mode config is currently disabled
		// const legacyModeConfig = this.getLegacyModeConfig(mode)
		// if (legacyModeConfig) {
		// 	return {
		// 		mode: {
		// 			name: t(legacyModeConfig.mode.translationKey),
		// 			icon: legacyModeConfig.mode.icon,
		// 			color: legacyModeConfig.mode.color,
		// 			identifier: mode,
		// 			placeholder: _isMobile
		// 				? legacyModeConfig.mode.mobilePlaceholder
		// 				: legacyModeConfig.mode.placeholder,
		// 			sort: 0,
		// 		},
		// 		groups: [],
		// 	}
		// }
		return null
	}

	/**
	 * 获取模式配置
	 * @param mode 模式
	 * @param t 翻译函数
	 * @param isMobile 是否是移动端
	 * @returns
	 */
	getModePlaceholderWithLegacy(
		mode: string,
		t: TFunction,
		isMobile: boolean = false,
		agentCode?: string | null,
	) {
		const legacyModeConfig = this.getModeConfigWithLegacy(mode, t, isMobile, agentCode)
		return legacyModeConfig?.mode.placeholder
	}

	/**
	 * 获取模式配置
	 * @param _mode 模式
	 * @returns
	 */
	getLegacyModeConfig(_mode: string) {
		// return this.LEGACY_MODE_CONFIG[mode as keyof typeof this.LEGACY_MODE_CONFIG]
		return undefined
	}

	/**
	 * Destroy service and cleanup all timers
	 */
	destroy() {
		this.cleanup()
		this.modeListReaction?.()

		// Remove event listener
		if (typeof window !== "undefined") {
			window.removeEventListener("beforeunload", () => this.destroy())
		}

		logger.log("SuperMagicModeService destroyed")
	}
}

const superMagicModeService = new SuperMagicModeService()

export default superMagicModeService
