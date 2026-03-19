import { BUSINESS_API_ERROR_CODE } from "@/constants/api"
import { MODEL_TYPE_IMAGE, MODEL_TYPE_LLM } from "@/apis/modules/org-ai-model-provider"
import { userStore } from "@/models/user"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/types"
import { ModeItem, TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import superMagicCustomModelService from "./SuperMagicCustomModelService"
import { IconType } from "@/pages/superMagic/components/AgentSelector/types"
import { logger as Logger } from "@/utils/log"
import { platformKey } from "@/utils/storage"
import { t, TFunction } from "i18next"
import { makeAutoObservable, reaction } from "mobx"
import { SuperMagicApi } from "@/apis"
import { configStore } from "@/models/config"
import { interfaceStore } from "@/stores/interface"

const logger = Logger.createLogger("SuperMagicModeService")

// Configuration constants
const REFRESH_INTERVAL = 15 * 60 * 1000 // 10 minute in milliseconds
const MAX_RETRY_COUNT = 3
const RETRY_DELAY_BASE = 1000 // Base delay for retry in milliseconds

/**
 * Super Magic 模式服务
 * 用于管理 Super Magic 模式列表
 * 提供模式列表的获取、设置、验证等功能
 */
class SuperMagicModeService {
	_modeList: ModeItem[] = []

	_modeMap: Map<string, ModeItem> = new Map()

	_retryTimer: ReturnType<typeof setTimeout> | null = null

	_refreshTimer: ReturnType<typeof setInterval> | null = null

	_fetchPromise: Promise<ModeItem[]> | null = null

	modeListReaction: ReturnType<typeof reaction> | null = null

	// LEGACY_MODE_CONFIG = {
	// 	[TopicMode.DataAnalysis]: {
	// 		mode: {
	// 			icon: "IconChartBarPopular",
	// 			translationKey: "common.dataAnalysis",
	// 			color: "#32C436",
	// 			placeholder: "messageEditor.placeholderDataAnalysis",
	// 			mobilePlaceholder: "messageEditor.placeholderDataAnalysisMobile",
	// 		},
	// 	},
	// 	[TopicMode.PPT]: {
	// 		mode: {
	// 			icon: "IconPresentation",
	// 			translationKey: "common.pptMode",
	// 			color: "#FF7D00",
	// 			placeholder: "messageEditor.placeholderPPT",
	// 			mobilePlaceholder: "messageEditor.placeholderPPTMobile",
	// 		},
	// 	},
	// 	[TopicMode.Summary]: {
	// 		mode: {
	// 			icon: "IconFileDescription",
	// 			translationKey: "common.meetingMode",
	// 			color: "#6431E5",
	// 			placeholder: "messageEditor.placeholderMeeting",
	// 			mobilePlaceholder: "messageEditor.placeholderMeetingMobile",
	// 		},
	// 	},
	// 	[TopicMode.Report]: {
	// 		mode: {
	// 			icon: "IconMicroscope",
	// 			translationKey: "common.reportMode",
	// 			color: "#009990",
	// 			placeholder: "messageEditor.placeholderReport",
	// 			mobilePlaceholder: "messageEditor.placeholderReportMobile",
	// 		},
	// 	},
	// 	[TopicMode.General]: {
	// 		mode: {
	// 			icon: "IconSuperMagic",
	// 			translationKey: "common.generalMode",
	// 			color: "#315CEC",
	// 			placeholder: "messageEditor.placeholderTask",
	// 			mobilePlaceholder: "messageEditor.placeholderTaskMobile",
	// 		},
	// 	},
	// }

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
		this.loadFromLocalStorage()

		// Auto cleanup on page unload
		if (typeof window !== "undefined") {
			window.addEventListener("beforeunload", this.destroy)
		}

		this.modeListReaction = reaction(
			() => [
				configStore.i18n.language,
				userStore.user.organizationCode,
				userStore.user.userInfo?.user_id,
			],
			([_, organizationCode, userId]) => {
				if (organizationCode && userId) {
					this.startRefreshTimer()
					this.fetchModeList()
				} else {
					this.stopRefreshTimer()
				}
			},
		)
	}

	get globalTopicModeLocaleStorageKey() {
		const organizationCode = userStore.user.organizationCode
		const userId = userStore.user.userInfo?.user_id
		return platformKey(`super_magic/mode_list/${organizationCode}/${userId}`)
	}

	/**
	 * Load mode list from local storage with error handling
	 */
	loadFromLocalStorage() {
		try {
			const mode = window.localStorage.getItem(this.globalTopicModeLocaleStorageKey)
			if (mode) {
				const parsedData = JSON.parse(mode)
				// Validate parsed data is an array
				if (Array.isArray(parsedData)) {
					this._modeList = parsedData
					this._modeMap = new Map(parsedData.map((item) => [item.mode.identifier, item]))
					logger.log("Successfully loaded mode list from local storage")
				} else {
					logger.warn("Invalid mode list data in local storage, expected array")
				}
			}
		} catch (error) {
			logger.error("Failed to load mode list from local storage", error)
			// Keep default empty state on error
			this._modeList = []
			this._modeMap = new Map()
		}
	}

	/**
	 * 保存模式列表到本地存储
	 * @param modeList 模式列表
	 */
	saveToLocalStorage(modeList: ModeItem[]) {
		window.localStorage.setItem(this.globalTopicModeLocaleStorageKey, JSON.stringify(modeList))
	}

	/**
	 * 获取第一个模式标识
	 * @returns
	 */
	get firstModeIdentifier() {
		// 移动端不能使用聊天模式
		if (interfaceStore.isMobile) {
			return this._modeList.find((item) => item.mode.identifier === "chat")?.mode
				?.identifier as TopicMode
		}

		return this._modeList?.[0]?.mode?.identifier as TopicMode
	}

	/**
	 * 获取模式列表
	 * @returns
	 */
	get modeList() {
		return this._modeList
	}

	/**
	 * 获取模式分组列表
	 * @param mode 模式标识
	 * @returns
	 */
	getModelGroupsByMode(mode: string) {
		return this._modeMap.get(mode)?.groups
	}

	/**
	 * 获取模式模型列表
	 * @param mode
	 * @returns
	 */
	getModelListByMode(mode: string) {
		return this._modeMap.get(mode)?.groups.flatMap((item) => item.models) ?? []
	}

	/**
	 * 获取模式生图模型分组列表
	 * @param mode 模式标识
	 * @returns
	 */
	getImageModelGroupsByMode(mode: string) {
		const groups = this._modeMap.get(mode)?.groups
		if (!groups) return undefined
		return groups.map((item) => ({
			...item,
			models: item.image_models || [],
		}))
	}

	/**
	 * 获取模式生图模型列表
	 * @param mode
	 * @returns
	 */
	getImageModelListByMode(mode: string) {
		return this._modeMap.get(mode)?.groups.flatMap((item) => item.image_models || []) ?? []
	}

	private getOfficialModelListByType(
		mode: string,
		modelType: typeof MODEL_TYPE_LLM | typeof MODEL_TYPE_IMAGE,
	): ModelItem[] {
		if (modelType === MODEL_TYPE_IMAGE) return this.getImageModelListByMode(mode)
		return this.getModelListByMode(mode)
	}

	async resolveModelByMode({
		mode,
		modelId,
		modelType,
	}: {
		mode: string
		modelId?: string | null
		modelType: typeof MODEL_TYPE_LLM | typeof MODEL_TYPE_IMAGE
	}): Promise<ModelItem | null> {
		if (!modelId) return null

		const customModel = await superMagicCustomModelService.findMyModelById({
			modelId,
			modelType,
		})
		if (customModel) {
			return superMagicCustomModelService.toModelItem(customModel)
		}

		const officialModel = this.getOfficialModelListByType(mode, modelType).find(
			(model) => model.model_id === modelId,
		)
		return officialModel ?? null
	}

	async resolveLanguageModelByMode(mode: string, modelId?: string | null) {
		return this.resolveModelByMode({
			mode,
			modelId,
			modelType: MODEL_TYPE_LLM,
		})
	}

	async resolveImageModelByMode(mode: string, modelId?: string | null) {
		return this.resolveModelByMode({
			mode,
			modelId,
			modelType: MODEL_TYPE_IMAGE,
		})
	}

	/**
	 * Check if a mode supports image model configuration
	 * @param mode - Mode identifier
	 * @returns true if the mode supports image models
	 */
	supportsImageModel(mode: string): boolean {
		const imageModelList = this.getImageModelListByMode(mode)
		return imageModelList.length > 0
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
	 * @returns
	 */
	isModeValid(mode: string) {
		const isValid = this._modeMap.has(mode)
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
	 * Start refresh timer to fetch mode list every minute
	 */
	startRefreshTimer() {
		// Clear existing timer if any
		this.stopRefreshTimer()

		// Set up interval to fetch mode list every minute
		this._refreshTimer = setInterval(() => {
			this.fetchModeList().catch((error) => {
				logger.error("Auto refresh failed", error)
			})
		}, REFRESH_INTERVAL)

		logger.log("Started refresh timer for mode list")
	}

	/**
	 * Stop refresh timer
	 */
	stopRefreshTimer() {
		if (this._refreshTimer) {
			clearInterval(this._refreshTimer)
			this._refreshTimer = null
			logger.log("Stopped refresh timer for mode list")
		}
	}

	/**
	 * Check if refresh timer is running
	 */
	get isRefreshTimerRunning() {
		return this._refreshTimer !== null
	}

	/**
	 * Get the current fetch promise
	 * Can be used to wait for the fetch to complete externally
	 */
	get fetchPromise() {
		return this._fetchPromise
	}

	/**
	 * 获取模式列表
	 * @returns
	 */
	fetchModeList({ retryCount = 0 }: { retryCount?: number } = {}) {
		// Reuse in-flight request to avoid duplicate fetches
		if (this._fetchPromise) return this._fetchPromise

		// Clear previous retry timer
		this.cleanup()

		// Create and store the promise
		this._fetchPromise = SuperMagicApi.getCrewList()
			.then((res) => {
				if (res.list.length > 0) {
					this._modeList = res.list.map((item) => ({
						...item,
						groups: item.groups.map((group) => ({
							...group,
							models: group.model_ids
								.map((modelId) => res.models[modelId])
								.filter(Boolean),
							image_models: group.image_model_ids.map(
								(modelId) => res.models[modelId],
							),
						})),
					}))
					this._modeMap = new Map(
						this._modeList.map((item) => [item.mode.identifier, item]),
					)
					this.saveToLocalStorage(this._modeList)
					// Clear retry timer on success
					this.cleanup()
					// 成功后停止刷新定时器
					this.stopRefreshTimer()
					return this._modeList
				} else {
					throw new Error("模式列表为空")
				}
			})
			.catch((err) => {
				logger.error("fetchModeList error", err)
				// 如果模式列表为空，才进行兜底处理
				if (this._modeList.length <= 0) {
					// 兜底处理
					const defaultModeList = [
						{
							mode: {
								id: "general",
								name: t("common.generalMode", { ns: "super" }),
								placeholder: t("messageEditor.placeholderTask", { ns: "super" }),
								identifier: "general",
								icon: "IconSuperMagic",
								color: "#315CEC",
								icon_url: "",
								icon_type: IconType.Icon,
								sort: 0,
								playbooks: [],
							},
							agent: {
								type: 1,
								category: "frequent",
							},
							groups: [],
						},
						{
							mode: {
								id: "chat",
								name: t("common.chatMode", { ns: "super" }),
								placeholder: "",
								identifier: "chat",
								icon: "IconMessages",
								color: "#00A8FF",
								icon_url: "",
								icon_type: IconType.Icon,
								sort: 0,
							},
							agent: {
								type: 1,
								category: "frequent",
							},
							groups: [],
						},
					] as ModeItem[]
					this._modeList = defaultModeList
					this._modeMap = new Map(
						defaultModeList.map((item) => [item.mode.identifier, item]),
					)
					this.saveToLocalStorage(defaultModeList)
				}

				if (
					retryCount < MAX_RETRY_COUNT &&
					// 如果请求被取消，则不进行兜底处理
					err?.name !== "AbortError" &&
					// 如果账号无权限，则不进行兜底处理
					err?.code !== BUSINESS_API_ERROR_CODE.ACCOUNT_NO_PERMISSION
				) {
					// 兜底处理: 使用线性退避策略
					this._retryTimer = setTimeout(
						() => {
							this.fetchModeList({ retryCount: retryCount + 1 })
						},
						RETRY_DELAY_BASE * (retryCount + 1),
					)
				}
				return this._modeList
			})
			.finally(() => {
				// Clear the promise reference after completion
				this._fetchPromise = null
			})

		return this._fetchPromise
	}

	/**
	 * 等待模式列表获取完成
	 * @returns
	 */
	waitForFetchPromise() {
		return this._fetchPromise ? this._fetchPromise.then(() => true) : Promise.resolve(true)
	}

	/**
	 * 获取模式配置
	 * @param mode 模式
	 * @returns
	 */
	getModeConfigWithLegacy(mode: string, t?: TFunction, isMobile: boolean = false) {
		const modeItem = this._modeMap.get(mode)
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
		// 			placeholder: isMobile
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
	getModePlaceholderWithLegacy(mode: string, t: TFunction, isMobile: boolean = false) {
		const legacyModeConfig = this.getModeConfigWithLegacy(mode, t, isMobile)
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
		this.stopRefreshTimer()
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
