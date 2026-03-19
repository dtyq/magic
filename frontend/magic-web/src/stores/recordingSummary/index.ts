import { makeAutoObservable } from "mobx"
import FloatPanelStore from "./floatPanelStore"
import type { TabStatus } from "@/services/recordSummary/TabCoordinator"
import {
	VoiceResult,
	VoiceResultUtterance,
} from "@/components/business/VoiceInput/services/VoiceClient/types"
import { last } from "lodash-es"
import { userStore } from "@/models/user"
import {
	AudioSourceConfig,
	RecordingSession,
	RecordingStatus,
} from "@/types/recordSummary"
import { formatDuration } from "@/services/recordSummary/utils/format"
import { nanoid } from "nanoid"
import {
	ProjectListItem,
	Topic,
	TopicMode,
	Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"

/**
 * 录音纪要状态管理
 */
class RecordingSummaryStore {
	/**
	 * 是否已加载浮动面板
	 */
	isFloatPanelLoaded = false

	/**
	 * 设置是否已加载浮动面板
	 * @param isFloatPanelLoaded
	 */
	setIsFloatPanelLoaded(isFloatPanelLoaded: boolean) {
		this.isFloatPanelLoaded = isFloatPanelLoaded
	}

	/**
	 * 浮动面板状态管理
	 */
	floatPanel: FloatPanelStore

	/**
	 * 是否可见
	 */
	isVisible = false

	/**
	 * 是否正在录音
	 */
	status: RecordingStatus = "init"

	/**
	 * 是否正在等待总结
	 */
	isWaitingSummarize = false

	/**
	 * 是否正在等待上传
	 */
	isWaitingUpload = false

	/**
	 * 录音消息
	 */
	message: (VoiceResultUtterance & { add_time: number; id: string })[] = []

	/**
	 * 录音笔记
	 */
	note = {
		content: "",
		file_extension: "md",
	}

	/**
	 * 更新笔记状态
	 */
	updateNoteStatus: "idle" | "saving" | "success" | "error" = "idle"

	/**
	 * 录音时长
	 */
	duration = "00:00:00"

	/** 是否有媒体录制服务不支持错误 */
	isMediaRecorderNotSupported = false

	/**
	 * 错误状态管理
	 */
	errorState: {
		recordingError?: Error
		/** 是否有语音识别错误 */
		hasVoiceError: boolean
		/** 是否有录制错误 */
		hasRecordingError: boolean
		/** 是否正在重试 */
		isRetrying: boolean
		/** 重试次数信息 */
		retryInfo: {
			current: number
			max: number
		}
	} = {
			hasVoiceError: false,
			hasRecordingError: false,
			isRetrying: false,
			retryInfo: {
				current: 0,
				max: 3,
			},
		}

	businessData = {
		/**
		 * 模型实例
		 */
		model: null as ModelItem | null,

		/**
		 * 用户id
		 */
		userId: "",

		/**
		 * 工作空间
		 */
		workspace: null as Workspace | null,

		/**
		 * 项目
		 */
		project: null as ProjectListItem | null,

		/**
		 * 聊天主题
		 */
		topic: null as Topic | null | undefined,

		/**
		 * 聊天话题
		 */
		chatTopic: null as Topic | null | undefined,

		/**
		 * 音频源配置
		 */
		audioSource: undefined as
			| import("@/types/recordSummary").AudioSourceConfig
			| undefined,
	}

	/**
	 * 多 Tab 协调状态
	 */
	multiTabState: {
		/** 当前 tab 状态 */
		tabStatus: TabStatus
		/** 活跃录音 tab 的信息同步 */
		activeTabData: {
			message: VoiceResultUtterance[]
			duration: string
			isRecording: boolean
			sessionId?: string
		}
	} = {
			tabStatus: "inactive",
			activeTabData: {
				message: [],
				duration: "00:00:00",
				isRecording: false,
			},
		}

	// ==== 代理属性和方法，保持向后兼容 ====

	/**
	 * 是否暂停
	 */
	get isPaused() {
		return this.status === "paused"
	}

	/**
	 * 是否正在录音
	 */
	get isRecording() {
		return this.status === "recording"
	}

	/**
	 * 获取音频源
	 */
	get audioSource() {
		return this.businessData.audioSource?.source
	}

	/**
	 * 是否正在暂停
	 */
	isPausing = false

	/**
	 * 是否正在继续
	 */
	isContinuing = false

	/**
	 * 设置是否暂停
	 */
	setIsPaused(isPaused: boolean) {
		this.status = isPaused ? "paused" : "recording"
		const lastMessage = last(this.message)
		// 如果暂停了，且最后一条消息不是确定的，则将最后一条消息的definite设置为true
		if (isPaused && lastMessage && !lastMessage?.definite) {
			lastMessage.definite = true
			this.message[this.message.length - 1].definite = true
		}
	}

	/**
	 * 设置是否正在暂停
	 */
	setIsPausing(isPausing: boolean) {
		this.isPausing = isPausing
	}

	/**
	 * 设置是否正在继续
	 */
	setIsContinuing(isContinuing: boolean) {
		this.isContinuing = isContinuing
	}

	/**
	 * 是否展开
	 */
	get isExpanded() {
		return this.floatPanel.isExpanded
	}

	/**
	 * 组件位置
	 */
	get pcPosition() {
		return this.floatPanel.pcPosition
	}

	/**
	 * 移动端组件位置
	 */
	get mobilePosition() {
		return this.floatPanel.mobilePosition
	}

	get selectProjectDisabled() {
		return Boolean(this.businessData.topic && this.businessData.topic.id !== "default")
	}

	isRecordingTopic(topicId: string) {
		if (!topicId) return false
		return (
			this.businessData.topic?.id === topicId || this.businessData.chatTopic?.id === topicId
		)
	}

	/**
	 * localStorage 存储键
	 */
	private storageKey = "recording-summary-state"

	/**
	 * 根据 model_id 查找 ModelItem
	 */
	private findModelById(modelId: string): ModelItem | null {
		if (!modelId) return null
		const modelGroups =
			superMagicModeService.getModelGroupsByMode(TopicMode.RecordSummary) ?? []
		for (const group of modelGroups) {
			const model = group.models?.find((m) => m.model_id === modelId)
			if (model) return model
		}
		return null
	}

	constructor() {
		// 初始化浮动面板状态管理，使用独立的存储键
		this.floatPanel = new FloatPanelStore("recording-summary-float-panel")
		makeAutoObservable(this, {}, { autoBind: true })
		this.loadFromStorage()
	}

	/**
	 * 设置更新笔记状态
	 * @param status 更新笔记状态
	 */
	setUpdateNoteStatus(status: "idle" | "saving" | "success" | "error") {
		this.updateNoteStatus = status
	}

	setMessage(message: (VoiceResultUtterance & { add_time: number; id: string })[]) {
		this.message = message
	}

	/**
	 * 更新录音消息
	 * @param result
	 */
	updateMessage(result: VoiceResult) {
		const utterances = result.utterances ?? []
		const resultText = result.text ?? ""
		const isAbnormalResultText =
			resultText.startsWith('sult":{"additions') ||
			resultText.includes('"additions"') ||
			resultText.includes('"log_id"')
		if (isAbnormalResultText && utterances.length === 0) {
			return this.message
		}
		if (utterances.length === 0 && result.text) {
			const lastMessage = last(this.message)
			const shouldReplace = Boolean(lastMessage && !lastMessage.definite)
			const nextStartTime = lastMessage?.end_time ?? 0
			if (shouldReplace && lastMessage) {
				this.message[this.message.length - 1] = {
					...lastMessage,
					text: result.text,
					start_time: lastMessage?.start_time ?? nextStartTime,
					end_time: lastMessage?.end_time ?? nextStartTime,
				}
				return this.message
			}
			this.message.push({
				id: nanoid(),
				text: result.text,
				start_time: nextStartTime,
				end_time: nextStartTime,
				definite: false,
				add_time: Date.now(),
			})
			return this.message
		}
		for (const utterance of utterances) {
			const utteranceText = utterance.text ?? ""
			if (
				utteranceText.startsWith('sult":{"additions') ||
				utteranceText.includes('"additions"') ||
				utteranceText.includes('"log_id"')
			) {
				continue
			}
			if (utterance.start_time === -1) {
				continue
			}
			const lastMessage = last(this.message)
			const shouldReplace = this.message.length > 0 && !lastMessage?.definite
			if (shouldReplace) {
				this.message[this.message.length - 1] = {
					...this.message[this.message.length - 1],
					text: utterance.text,
					start_time: utterance.start_time ?? 0,
					end_time: utterance.end_time ?? 0,
					definite: utterance.definite,
				}
			} else {
				this.message.push({
					id: nanoid(),
					text: utterance.text,
					start_time: utterance.start_time ?? 0,
					end_time: utterance.end_time ?? 0,
					definite: utterance.definite,
					add_time: Date.now(),
				})
			}
		}

		return this.message
	}

	/**
	 * 从 localStorage 加载状态
	 */
	private loadFromStorage() {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(this.storageKey)
				if (saved) {
					const state = JSON.parse(saved)
					// 浮动面板相关的状态现在由 floatPanel 管理
					// 恢复消息和时长，但不自动恢复 isVisible 和 isRecording
					// 这些状态需要通过服务层的恢复机制来处理
					if (state.message) {
						this.message = state.message
					}
					if (state.note) {
						this.note = { ...this.note, ...state.note }
					}
					if (state.duration) {
						this.duration = state.duration
					}
					if (state.modelId) {
						// 向后兼容：从 modelId 查找 ModelItem
						this.businessData.model = this.findModelById(state.modelId)
					}
					if (state.userId) {
						this.businessData.userId = state.userId
					}
					if (state.workspace) {
						this.businessData.workspace = state.workspace
					}
					if (state.project) {
						this.businessData.project = state.project
					}
					if (state.topic) {
						this.businessData.topic = state.topic
					}
					if (state.chatTopic) {
						this.businessData.chatTopic = state.chatTopic
					}
					if (state.audioSource) {
						this.businessData.audioSource = state.audioSource
					}
				}
			} catch (error) {
				console.warn("Failed to load recording summary state:", error)
			}
		}
	}

	/**
	 * 保存状态到 localStorage
	 */
	private saveToStorage() {
		if (typeof window !== "undefined") {
			try {
				const state = {
					// 浮动面板相关状态现在由 floatPanel 管理
					// 保存录音相关的状态，用于页面刷新后的潜在恢复
					isVisible: this.isVisible,
					isRecording: this.status,
					message: this.message,
					note: this.note,
					duration: this.duration,
					lastUpdateTime: Date.now(), // 记录最后更新时间
					modelId: this.businessData.model?.model_id || "",
					userId: this.businessData.userId || userStore.user.userInfo?.user_id,
					workspace: this.businessData.workspace,
					project: this.businessData.project,
					topic: this.businessData.topic,
					chatTopic: this.businessData.chatTopic,
					audioSource: this.businessData.audioSource,
				}
				localStorage.setItem(this.storageKey, JSON.stringify(state))
			} catch (error) {
				console.warn("Failed to save recording summary state:", error)
			}
		}
	}

	isStartingRecord = false

	setIsStartingRecord(isStartingRecord: boolean) {
		this.isStartingRecord = isStartingRecord
	}

	/**
	 * 开始录音
	 */
	startRecording({
		workspace,
		project,
		topic,
		chatTopic,
		model,
		userId,
		audioSource,
	}: {
		workspace: Workspace | null
		model: ModelItem
		userId: string
		project: ProjectListItem | null
		topic?: Topic | null
		chatTopic?: Topic | null
		audioSource?: AudioSourceConfig
	}) {
		this.businessData = {
			workspace,
			project,
			topic,
			chatTopic: chatTopic ?? null,
			model,
			userId,
			audioSource,
		}
		this.isVisible = true
		this.status = "recording"
		this.isPausing = false
		this.isContinuing = false
		this.message = []
		this.duration = "00:00:00"
		// 初始化浮动面板位置
		this.floatPanel.initializePosition()
		this.floatPanel.setExpanded(true)
		// PC 端默认展开 AI 聊天，移动端默认收起
		this.floatPanel.setExpandedAiChat(!this.floatPanel.isMobile)
		this.floatPanel.setEnterAnimationStatus(true)

		setTimeout(() => {
			this.floatPanel.setEnterAnimationStatus(false)
		}, 1000)

		this.saveToStorage()
	}

	/**
	 * 停止录音
	 */
	stopRecording() {
		this.reset()
	}

	/**
	 * 取消录音
	 */
	cancelRecording() {
		this.reset()
	}

	/**
	 * 完成录音并生成总结
	 */
	completeRecording() {
		this.reset()
	}

	/**
	 * 更新录音时长
	 */
	updateDuration(duration: string) {
		this.duration = duration
	}

	/**
	 * 隐藏组件
	 */
	hide() {
		this.isVisible = false
		this.saveToStorage()
	}

	/**
	 * 显示组件
	 */
	show() {
		this.isVisible = true
		this.floatPanel.initializePosition()
		this.saveToStorage()
	}

	/**
	 * 从服务层恢复UI状态
	 * 只在确认有可恢复会话时调用
	 */
	restoreUIState(session: RecordingSession) {
		if (typeof window !== "undefined") {
			const sessionStatus = session.status

			try {
				const saved = localStorage.getItem(this.storageKey)
				if (saved) {
					// 根据会话状态决定是否恢复UI状态
					if (sessionStatus === "recording" || sessionStatus === "paused") {
						// 恢复录音中或暂停状态的UI
						this.isVisible = true
						this.status = sessionStatus
						this.businessData.workspace = session.workspace
						this.businessData.project = session.project
						this.businessData.topic = session.topic
						this.businessData.chatTopic = session.chatTopic ?? null
						this.businessData.model = session.model
						this.businessData.userId = session.userId
						this.businessData.audioSource = session.audioSource

						const lastMessage = last(session.textContent)
						if (lastMessage) {
							lastMessage.definite = true
						}
						this.setMessage(session.textContent || [])

						if (session.totalDuration > 0) {
							const formattedDuration = formatDuration(session.totalDuration)
							this.updateDuration(formattedDuration)
						}

						// 恢复笔记内容
						if (session.note) {
							this.note = {
								content: session.note.content,
								file_extension: session.note.file_extension,
							}
						}

						// 初始化浮动面板位置
						this.floatPanel.initializePosition()
						// this.floatPanel.setExpanded(true)

						this.resetMultiTabState()

						console.log("UI state restored:", {
							isVisible: this.isVisible,
							isRecording: this.status,
							sessionStatus,
						})
					} else {
						// 已完成的会话不恢复UI显示
						this.isVisible = false
						this.status = "init"
					}
				}
			} catch (error) {
				console.warn("Failed to restore UI state:", error)
			}
		}
	}

	/**
	 * 重置所有状态
	 */
	reset() {
		this.floatPanel.cleanup()
		this.isVisible = false
		this.status = "init"
		this.isPausing = false
		this.isContinuing = false
		this.businessData.workspace = null
		this.businessData.project = null
		this.businessData.topic = null
		this.businessData.chatTopic = null
		this.businessData.model = null
		this.businessData.audioSource = undefined
		this.message = []
		this.note = {
			content: "",
			file_extension: "md",
		}
		this.duration = "00:00:00"
		this.isWaitingSummarize = false
		this.isWaitingUpload = false
		this.resetErrorState()
		this.resetMultiTabState()
		this.floatPanel.reset()
		this.saveToStorage()
	}

	/**
	 * 显示等待总结
	 */
	showWaitingSummarize() {
		this.isWaitingSummarize = true
	}

	/**
	 * 隐藏等待总结
	 */
	hideWaitingSummarize() {
		this.isWaitingSummarize = false
	}

	/**
	 * 显示等待上传
	 */
	showWaitingUpload() {
		this.isWaitingUpload = true
	}

	/**
	 * 隐藏等待上传
	 */
	hideWaitingUpload() {
		this.isWaitingUpload = false
	}

	// ==== 错误状态管理方法 ====

	/**
	 * 设置语音识别错误
	 */
	setVoiceError(status: boolean) {
		this.errorState.hasVoiceError = status
	}

	/**
	 * 设置媒体录制服务不支持错误
	 */
	setMediaRecorderNotSupportedError() {
		this.isMediaRecorderNotSupported = true
	}

	/**
	 * 设置录制错误
	 */
	setRecordingError(error: Error) {
		this.errorState.hasRecordingError = true
		this.errorState.recordingError = error
	}

	/**
	 * 设置重试状态
	 */
	setRetryingState(isRetrying: boolean) {
		this.errorState.isRetrying = isRetrying
	}

	/**
	 * 清除语音识别错误
	 */
	clearVoiceError() {
		this.errorState.hasVoiceError = false
		this.errorState.isRetrying = false
	}

	/**
	 * 清除录制错误
	 */
	clearRecordingError() {
		this.errorState.hasRecordingError = false
	}

	/**
	 * 重置错误状态
	 */
	resetErrorState() {
		this.errorState.hasVoiceError = false
		this.errorState.hasRecordingError = false
		this.errorState.isRetrying = false
		this.errorState.retryInfo = {
			current: 0,
			max: 3,
		}
	}

	/**
	 * 获取当前错误状态
	 */
	getErrorState() {
		return { ...this.errorState }
	}

	// ==== 笔记管理方法 ====

	/**
	 * 更新笔记内容
	 */
	updateNoteContent(content: string) {
		this.note.content = content
		this.saveToStorage()
	}

	/**
	 * 更新笔记文件类型
	 */
	updateNoteFileType(fileType: string) {
		this.note.file_extension = fileType
		this.saveToStorage()
	}

	/**
	 * 获取当前笔记
	 */
	getNote() {
		return { ...this.note }
	}

	/**
	 * 清空笔记
	 */
	clearNote() {
		this.note = {
			content: "",
			file_extension: "md",
		}
		this.saveToStorage()
	}

	// ==== 多 Tab 协调管理方法 ====

	/**
	 * 更新当前 tab 状态
	 */
	updateTabStatus(status: TabStatus) {
		this.multiTabState.tabStatus = status

		// 如果当前 tab 失去活跃状态，需要处理录音状态同步
		if (status === "inactive") {
			// 如果当前tab之前是录音状态，现在变为非活跃，说明录音已结束
			if (this.status && this.multiTabState.activeTabData.isRecording) {
				this.multiTabState.activeTabData.isRecording = false
			}
		}
	}

	/**
	 * 同步活跃 tab 的录音数据
	 */
	syncActiveTabData(data: {
		message: VoiceResultUtterance[]
		duration: string
		isRecording: boolean
		sessionId?: string
	}) {
		this.multiTabState.activeTabData = { ...data }

		// if (data.isRecording && !this.isVisible) {
		// 	this.isVisible = true
		// }
	}

	/**
	 * 检查当前是否有其他 tab 正在录音
	 */
	get isOtherTabRecording(): boolean {
		return this.multiTabState.activeTabData.isRecording
	}

	/**
	 * 设置项目
	 */
	setProject(project: ProjectListItem | null) {
		this.businessData.project = project
		this.saveToStorage()
	}

	/**
	 * 设置话题
	 */
	setTopic(topic: Topic | null) {
		this.businessData.topic = topic
		this.saveToStorage()
	}

	/**
	 * 设置聊天话题
	 */
	setChatTopic(chatTopic: Topic | null) {
		this.businessData.chatTopic = chatTopic
		this.saveToStorage()
	}

	/**
	 * 设置工作空间
	 */
	setWorkspace(workspace: Workspace | null) {
		this.businessData.workspace = workspace
		this.saveToStorage()
	}

	/**
	 * 设置模型
	 * 注意：应该通过 RecordSummaryService.updateModel 调用，而不是直接调用此方法
	 */
	setModel(model: ModelItem | null) {
		this.businessData.model = model
		this.saveToStorage()
	}

	/**
	 * 重置多 tab 状态
	 */
	resetMultiTabState() {
		this.multiTabState = {
			tabStatus: "inactive",
			activeTabData: {
				message: [],
				duration: "00:00:00",
				isRecording: false,
			},
		}
	}

	/**
	 * 设置音频源
	 */
	setAudioSource(
		audioSource: import("@/types/recordSummary").AudioSourceConfig | undefined,
	) {
		this.businessData.audioSource = audioSource
		this.saveToStorage()
	}

	/**
	 * 获取音频源
	 */
	getAudioSource(): AudioSourceConfig | undefined {
		return this.businessData.audioSource
	}
}

const recordSummaryStore = new RecordingSummaryStore()

export default recordSummaryStore

declare global {
	interface Window {
		recordSummaryStore: RecordingSummaryStore
	}
}

window.recordSummaryStore = recordSummaryStore
