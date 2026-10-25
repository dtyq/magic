import { handleRecordingCompletionFailure } from "./recordingCompletionFailure"
import recordSummaryStore from "@/stores/recordingSummary"
import { VoiceToTextService } from "@/services/voiceToText"
import type { VoiceResultParams } from "@/services/voiceToText"
import { reaction, toJS } from "mobx"
import { MediaRecorderService } from "./MediaRecorderService"
import { RecordingPersistence } from "./RecordingPersistence"
import { RecordingSessionManager } from "./RecordingSessionManager"
import {
	ChunkUploader,
	PLACEHOLDER_UPLOAD_MAX_FAILED_CHUNKS,
	type PlaceholderUploadProgress,
	type SessionUploadProgress,
} from "./ChunkUploader"
import {
	TabCoordinator,
	type RecordingDataSyncData,
	type TabStatus,
	TabLockReleaseType,
	LOCK_PRIORITY_BACKGROUND,
} from "./TabCoordinator"
import { getTabCoordinator, registerTabCoordinatorCallbacks } from "./tabCoordinatorInstance"
import { shouldSkipRecordingSessionRestoreOnCurrentRoute } from "./recordingRestoreRouteGuard"
import { WakeLockManager } from "./WakeLockManager"
import { RecordingContentFileManager } from "./RecordingContentFileManager"
import { RecordingBatchSaveReporter } from "./RecordingBatchSaveReporter"
import type {
	RecordingSession,
	AudioSourceConfig,
	AudioSourceType,
	MediaRecorderConfig,
} from "@/types/recordSummary"
import i18n from "i18next"
import {
	FinishRecordingTaskResponse,
	GetRecordingSummaryResultResponse,
} from "@/apis/modules/superMagic/recordSummary"
import { Topic, Workspace, ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { ReportFileUploadsResponse } from "@/apis/modules/file"
import { superMagicUploadTokenService } from "@/pages/superMagic/components/MessageEditor/services/UploadTokenService"
import { UploadSource } from "@/pages/superMagic/components/MessageEditor/hooks/useFileUpload"
import RecordStatusChecker from "./RecordStatusChecker"
import { VoiceResultUtterance } from "@/components/business/VoiceInput/services/VoiceClient/types"
import { userStore } from "@/models/user"
import { StoredAudioChunk, AudioChunkDB } from "./MediaRecorderService/AudioChunkDB"
import { RECORDING_HISTORY_RETENTION_DAYS } from "./RecordingSessionHistoryDB"
import { formatDuration } from "./utils/format"
import { createRecordingLogger } from "./utils/RecordingLogger"
import { DEFAULT_RECORDING_CONFIG } from "./utils/config"
import { RECORD_SUMMARY_EVENT_CALLBACK, RECORD_SUMMARY_EVENTS } from "./const/events"
import { TypedEventEmitter } from "./utils/TypedEventEmitter"
import {
	ERROR_CODES,
	getBusinessErrorCode,
	isOverrideSummaryAlreadySettled,
	isTaskEndError,
	defaultErrorManager,
} from "./RecordingErrorManager"
import { imageMigrationService } from "./ImageMigrationService"
import { RecordingStatusReporter, RecordingSummaryStatus } from "./RecordingStatusReporter"
import MagicModal from "@/components/base/MagicModal"
import { SuperMagicApi } from "@/apis"
import { analyticsService } from "@/services/analytics"
import VoiceTimeoutChecker from "./VoiceTimeoutChecker"
import SilenceDetector from "./SilenceDetector"
import { DurationTracker } from "./DurationTracker"
import { getSummaryMessageService, SummaryStage } from "./SummaryMessageService"
import { UploadQueueWatchdog } from "./uploadQueueWatchdog"
import { runTaskEndCleanup } from "./taskEndCleanup"
import {
	runForceOverrideFinalization,
	type RecordingOverrideContext,
} from "./recordingOverrideLifecycle"
import magicToast from "@/components/base/MagicToaster/utils"
import { Button } from "@/components/shadcn-ui/button"
import type { RecordingEncodingSnapshot } from "./MediaRecorderService/types/RecorderTypes"
import {
	createRecordingEncodingSnapshot,
	inferLegacyRecordingAudioProfile,
	normalizeRecordingEncodingSnapshot,
} from "./MediaRecorderService/utils/RecordingEncodingProfile"

const logger = createRecordingLogger("Main")

const PERSIST_INTERVAL_MS = 5000
// 最大录制时长 12小时
const MAX_RECORDING_DURATION_MS = 12 * 60 * 60 * 1000
// const MAX_RECORDING_DURATION_MS = 10 * 1000

type UploadFailureDecision = "retry" | "ignore"

interface EnsureUploadOptions {
	topicId?: string
	projectId?: string
	allowUserDecision?: boolean
	maxWaitTimeouts?: number
}

const MAX_UPLOAD_WAIT_TIMEOUTS = 3
const FORCE_OVERRIDE_MAX_UPLOAD_WAIT_TIMEOUTS = 1
const FORCE_OVERRIDE_REQUEST_TIMEOUT_MS = 130_000

class RecordSummaryService {
	// Duration tracking (using reliable AudioContext-based tracker)
	private durationTracker: DurationTracker
	private durationUpdateTimer: NodeJS.Timeout | null = null
	private lastPersistTime = 0
	private isDurationLimitExceeded = false

	// Prevent concurrent session restoration attempts
	private isRestoringSession = false
	// 用于页面刷新拦截
	private isBeforeUnloadListenerAdded = false
	// 用于监听用户登出
	private userLogoutReactionDisposer?: () => void

	// 用于语音转文字
	private voiceToTextService: VoiceToTextService
	// 用于录制音频分片
	private mediaRecorderService: MediaRecorderService
	// 用于持久化录音会话
	private recordingPersistence: RecordingPersistence
	// 用于管理录音会话
	private sessionManager: RecordingSessionManager
	// 用于上传音频分片
	private chunkUploader: ChunkUploader
	// 用于管理多标签协同，避免状态不一致
	public tabCoordinator: TabCoordinator
	// 用于在背后检测录音状态，避免异常情况导致状态不一致
	private recordStatusChecker: RecordStatusChecker
	// 用于管理唤醒锁，避免设备休眠
	private wakeLockManager: WakeLockManager
	// 用于上报录音状态到服务器
	private statusReporter: RecordingStatusReporter
	// 用于管理笔记和转文本文件的上传
	private contentFileManager: RecordingContentFileManager
	// 用于上报上传文件到 batch-save
	private batchSaveReporter: RecordingBatchSaveReporter
	// 用于检测语音识别超时
	private voiceTimeoutChecker: VoiceTimeoutChecker
	// 用于检测静音状态
	private silenceDetector: SilenceDetector
	// 静音提示的 message key
	private silenceMessageKey = "recording-silence-detected"

	/** 将录音器实际选择的处理模式同步到面板状态。 */
	private syncProcessingMode(): void {
		recordSummaryStore.setProcessingMode(
			this.mediaRecorderService.getStatus().adapterStatus?.processingMode,
		)
	}

	/** Seed the recorder with a persisted compressed/WAV format during session recovery. */
	private restoreEncodingSnapshot(session: RecordingSession): void {
		const persistedSnapshot = session.metadata.recordingEncoding
		if (persistedSnapshot) {
			this.mediaRecorderService.setEncodingSnapshot(
				session.id,
				normalizeRecordingEncodingSnapshot(persistedSnapshot, session.metadata.sampleRate),
			)
			return
		}

		// Older sessions recorded by recorder-core were labeled webm even though
		// their persisted chunks are WAV; keep those sessions on the legacy path.
		const format =
			session.metadata.audioFormat === "webm" ? "wav" : session.metadata.audioFormat
		const supportedFormats: RecordingEncodingSnapshot["format"][] = ["wav", "pcm", "ogg-opus"]
		if (supportedFormats.includes(format as RecordingEncodingSnapshot["format"])) {
			const profile = inferLegacyRecordingAudioProfile(
				session.metadata.audioFormat,
				session.metadata.sampleRate,
			)
			this.mediaRecorderService.setEncodingSnapshot(
				session.id,
				createRecordingEncodingSnapshot(
					format as RecordingEncodingSnapshot["format"],
					profile,
				),
			)
		}
	}

	/**
	 * Build the server-side finish-recording title without depending on list-only display helpers.
	 * Prefer persisted project/topic names first, then fall back to a stable localized placeholder.
	 */
	private resolveFinishRecordingTitle(
		project: ProjectListItem | null,
		topic: Topic | null,
	): string {
		const projectName = project?.project_name?.trim()
		if (projectName) return projectName

		const topicName = topic?.topic_name?.trim()
		if (topicName) return topicName

		return i18n.t("detail.untitled", { ns: "audioRecordings" })
	}

	/**
	 * Completes backend audio merge for manual-summary recorded sessions after all chunks settle.
	 */
	private async finishRecordedTaskAfterUpload({
		taskKey,
		project,
		topic,
		asrStreamContent,
		fileShardCount,
	}: {
		taskKey: string
		project: ProjectListItem
		topic: Topic
		asrStreamContent: string
		fileShardCount?: number
	}): Promise<FinishRecordingTaskResponse> {
		const response = await SuperMagicApi.finishRecordingTask({
			task_key: taskKey,
			generated_title: this.resolveFinishRecordingTitle(project, topic),
			asr_stream_content: asrStreamContent,
			file_shard_count: fileShardCount,
		})

		if (response.phase !== "merging") {
			throw new Error(
				`finish-recording returned unexpected phase: ${response.phase ?? "unknown"}`,
			)
		}

		return response
	}

	/**
	 * Starts realtime transcription against the active recorder stream.
	 * Audio capture can run without ASR, so this helper is shared by initial start and mid-session enablement.
	 */
	private async startRealtimeTranscription(recordingId: string): Promise<void> {
		await this.voiceToTextService.waitForWorkerReady(5000)
		const streamForVoice = this.mediaRecorderService.getMediaRecorderStream()?.clone()
		if (!streamForVoice) {
			throw new Error("No media stream available for realtime transcription")
		}
		await this.voiceToTextService.startRecording({
			recordingId,
			mediaStream: streamForVoice,
		})
		this.voiceTimeoutChecker.start()
		this.startSilenceDetection()
	}

	/** Stops realtime transcription resources without touching the media recorder. */
	private async stopRealtimeTranscription(): Promise<void> {
		await this.voiceToTextService.stopRecording().catch((error) => {
			logger.error({
				eventKey: "stop_voice_recording_failed",
				errorKind: "unknown",
				error,
				message: "Failed to stop voice recording",
			})
		})

		this.voiceTimeoutChecker.stop()
		this.silenceDetector.stop()

		try {
			this.voiceToTextService.disconnect()
		} catch (error) {
			logger.error({
				eventKey: "release_voice_resources_failed",
				errorKind: "unknown",
				error,
				message: "Failed to release voice resources",
			})
		}
	}

	/**
	 * Updates realtime transcription for the current recording after the user changes it.
	 */
	setTranscriptionEnabledForCurrentSession = async (enabled: boolean): Promise<void> => {
		const currentSession = this.sessionManager.getCurrentSession()
		if (!currentSession || recordSummaryStore.status === "init") {
			throw new Error("No active recording session")
		}
		const isTranscriptionStateUnchanged = currentSession.transcriptionEnabled === enabled
		if (isTranscriptionStateUnchanged) {
			recordSummaryStore.setTranscriptionEnabled(enabled)
		} else {
			if (recordSummaryStore.isPaused) {
				// Paused sessions have no active ASR flow to start or stop; resume uses this flag.
			} else if (enabled) {
				await this.startRealtimeTranscription(currentSession.id)
			} else {
				await this.stopRealtimeTranscription()
			}

			if (!enabled) recordSummaryStore.markLastMessageDefinite()

			const updatedSession = this.sessionManager.updateTranscriptionEnabled(enabled)
			if (updatedSession) {
				this.recordingPersistence.saveSession(updatedSession)
			}
			recordSummaryStore.setTranscriptionEnabled(enabled)
			if (enabled) recordSummaryStore.clearVoiceError()
		}
		if (!enabled && isTranscriptionStateUnchanged) recordSummaryStore.markLastMessageDefinite()
	}

	/** Keeps the existing enable-only API for other recording entry points. */
	enableTranscriptionForCurrentSession = async (): Promise<void> => {
		await this.setTranscriptionEnabledForCurrentSession(true)
	}
	// 用于管理总结过程中的消息提示
	private summaryMessageService = getSummaryMessageService()
	// 分片生产监控定时器，用于检测录音是否正常产出分片
	private chunkProductionWatchdog: NodeJS.Timeout | null = null
	private uploadQueueWatchdog: UploadQueueWatchdog | null = null
	private uploadRetryContext: { sessionId: string; topicId: string; projectId: string } | null =
		null
	private uploadRetryInFlight = false
	private forceOverridePreparation: Promise<boolean> | null = null
	// 录音开始后是否已收到第一个分片
	private hasReceivedFirstChunk = false
	// 是否已尝试过自动恢复
	private hasAttemptedChunkRecovery = false
	constructor() {
		logger.log("RecordSummaryService constructor")

		// Initialize duration tracker (AudioContext-based)
		this.durationTracker = new DurationTracker()

		/**
		 * Voice recognition config optimized for meeting scenarios with natural pauses
		 * 针对会议场景优化的配置，允许说话中的自然停顿，避免过度分句
		 */
		const voiceRequestConfig = {
			resultType: "single" as const, // Full results to reduce boundary loss
			endWindowSize: 1600, // 1.6s silence to reduce early splits
			forceToSpeechTime: 2000, // 2s min speech before sentence breaks
			enableAccelerateText: false, // Keep first-word accuracy stable
			accelerateScore: 0, // No acceleration when disabled
			enableNonstream: false, // Disable dual-pass to reduce latency
			enableDdc: false, // Disable semantic smoothing for faster processing
			vadSegmentDuration: 2500, // Ignored when endWindowSize is set
		}
		this.voiceToTextService = new VoiceToTextService({
			config: {
				request: voiceRequestConfig,
			},
			onResult: this.handleVoiceResult,
			onError: this.handleVoiceError,
			onConnect: this.handleConnect,
			retry: {
				maxRetries: 3,
				retryDelay: 1000,
				exponentialBackoff: true,
			},
		})
		this.mediaRecorderService = new MediaRecorderService(
			DEFAULT_RECORDING_CONFIG.mediaRecorder,
			{
				onRecordingError: this.handleMediaRecorderError,
				onDataAvailable: this.handleDataAvailable,
				onMediaRecorderNotSupported: this.handleMediaRecorderNotSupported,
				onAudioSourceFallback: this.handleAudioSourceFallback,
			},
		)
		this.recordingPersistence = new RecordingPersistence(DEFAULT_RECORDING_CONFIG.persistence)
		this.sessionManager = new RecordingSessionManager(DEFAULT_RECORDING_CONFIG.sessionRestore)

		// Fire-and-forget cleanup of expired session history.
		// 过期会话清理后，同步清理对应的音频分片
		void this.sessionManager
			.getHistoryDB()
			.cleanupExpired()
			.then(async (expiredSessionIds) => {
				if (expiredSessionIds.length === 0) return
				const chunkDB = new AudioChunkDB()
				for (const sessionId of expiredSessionIds) {
					await chunkDB.deleteAllSessionChunks(sessionId)
				}
				logger.log("已清理过期会话关联的音频分片", {
					sessionCount: expiredSessionIds.length,
					retentionDays: RECORDING_HISTORY_RETENTION_DAYS,
				})
			})
			.catch((error) => {
				logger.error({
					eventKey: "cleanup_session_audio_chunk_failed",
					errorKind: "lifecycle",
					error: error,
					message: "清理过期会话历史或音频分片失败",
				})
			})
		this.batchSaveReporter = new RecordingBatchSaveReporter()
		this.chunkUploader = new ChunkUploader(
			DEFAULT_RECORDING_CONFIG.upload,
			this.batchSaveReporter,
			{
				onProgress: this.handleUploadProgress,
				onSuccess: this.handleUploadSuccess,
				onError: this.handleUploadError,
				onRetry: this.handleUploadRetry,
				onTaskEnd: this.handleTaskEnd,
				onNetworkOffline: this.handleNetworkOffline,
				onNetworkOnline: this.handleNetworkOnline,
				onMaxRetriesReached: this.handleMaxRetriesReached,
			},
		)
		this.recordStatusChecker = new RecordStatusChecker(this.checkRecordStatus)
		this.wakeLockManager = new WakeLockManager(this.handleWakeLockRelease)
		this.tabCoordinator = getTabCoordinator()
		registerTabCoordinatorCallbacks({
			onStatusChange: this.handleTabStatusChange,
			onRecordingDataSync: this.handleRecordingDataSync,
			// onLockAcquired 由 tabCoordinatorInstance 统一负责 intent 分发
			// 不在此处注册，避免覆盖意图路由逻辑
			onLockReleased: this.handleLockReleased,
		})
		this.statusReporter = new RecordingStatusReporter({
			onReportError: this.handleStatusReportError,
			getFileShardCount: () => this.sessionManager.getCurrentSession()?.currentChunkIndex,
		})
		this.contentFileManager = new RecordingContentFileManager(
			this.chunkUploader.getTokenManager(),
			this.batchSaveReporter,
			{
				onUploadSuccess: this.handleContentFileUploadSuccess,
				onUploadError: this.handleContentFileUploadError,
			},
		)
		this.voiceTimeoutChecker = new VoiceTimeoutChecker({
			timeoutMs: 60 * 1000, // 1分钟无语音结果则认为超时
			onTimeout: this.handleVoiceTimeout,
		})
		this.silenceDetector = new SilenceDetector({
			threshold: 0.03, // 静音阈值 3%（降低阈值，减少误判）
			soundThreshold: 0.05, // 有声阈值 5%（用于滞后区间，避免频繁切换）
			checkInterval: 300, // 每 300ms 检测一次（增加间隔，减少检测频率）
			confirmCount: 3, // 需要连续 3 次检测到相同状态才切换（防抖机制）
			messageKey: this.silenceMessageKey,
			isRecording: () => recordSummaryStore.isRecording,
		})

		// Register error handler for task end events
		defaultErrorManager.onTaskEnd((error) => {
			return this.handleTaskEnd(error.sessionId, error.code)
		})

		// 监听用户登出事件
		this.userLogoutReactionDisposer = this.setupUserLogoutListener()
	}

	private eventEmitter = new TypedEventEmitter<RECORD_SUMMARY_EVENT_CALLBACK>()
	private handlingTaskEndSessions = new Map<string, Promise<void>>()

	/**
	 * 监听事件
	 * @param eventName 事件名称
	 * @param callback 事件回调
	 * @returns 取消订阅函数
	 */
	public on = this.eventEmitter.on.bind(this.eventEmitter)

	/**
	 * 触发事件
	 * @param eventName 事件名称
	 * @param args 事件参数
	 */
	public emit = this.eventEmitter.emit.bind(this.eventEmitter)

	/**
	 * 设置用户登出监听器
	 * Monitor user logout to handle recording interruption
	 */
	private setupUserLogoutListener() {
		// 使用 MobX reaction 监听 userStore.user.authorization 变化
		return reaction(
			() => userStore.user.authorization,
			(currentAuth, previousAuth) => {
				// 当 authorization 从有值变为 null，表示用户登出
				if (previousAuth && !currentAuth) {
					logger.log("检测到用户登出，处理录音中断")
					this.handleUserLogout()
				}
			},
		)
	}

	/**
	 * 处理用户登出
	 * Handle user logout during recording
	 */
	private handleUserLogout = async () => {
		const currentSession = this.sessionManager.getCurrentSession()

		// 如果没有活跃会话，无需处理
		if (!currentSession || currentSession.status === "init") {
			return
		}

		logger.log("用户登出时正在录音，保存当前状态", {
			sessionId: currentSession.id,
			status: currentSession.status,
			duration: currentSession.totalDuration,
		})

		try {
			// 1. 停止录音服务（不等待上传完成，让上传在后台继续）
			await this.stopRecordingServices("user_logout")

			// 2. 保存最终会话状态（包含 userId 和组织信息）
			this.sessionManager.updateSessionStatus("paused") // 标记为暂停状态
			this.saveFinalSessionState()

			// 3. 释放资源
			this.wakeLockManager.releaseWakeLock()
			this.wakeLockManager.removeVisibilityChangeListener()
			this.removeBeforeUnloadListener()

			// 4. 停止定期上报
			this.statusReporter.stopPeriodicReport()

			// 5. 上报用户登出导致的暂停状态
			try {
				await this.statusReporter.reportStatus({
					task_key: currentSession.id,
					status: RecordingSummaryStatus.Paused,
					model_id: currentSession.model?.model_id || "",
					file_shard_count: currentSession.currentChunkIndex,
					note: recordSummaryStore.note,
					asr_stream_content: this.getLatestAsrContent(),
				})
			} catch (error) {
				logger.error({
					eventKey: "report_logout_status_failed",
					errorKind: "unknown",
					error: error,
					message: "上报登出状态失败",
				})
			}

			// 6. 重置 UI 状态但不清除持久化数据
			recordSummaryStore.reset()

			logger.log("用户登出处理完成，数据已保存")
		} catch (error) {
			logger.error({
				eventKey: "process_user_logout_failed",
				errorKind: "unknown",
				error: error,
				message: "处理用户登出失败",
			})
		}
	}

	/**
	 * 开始录音
	 */
	startRecording = async ({
		workspace,
		model,
		project,
		topic,
		chatTopic,
		audioSource,
		sessionId,
		transcriptionEnabled = true,
	}: {
		/** Allow starting without a workspace when the recordings entry is on All / Ungrouped */
		workspace: Workspace | null
		model: ModelItem
		project: ProjectListItem
		topic?: Topic | null
		chatTopic?: Topic | null
		audioSource?: AudioSourceConfig
		sessionId?: string
		transcriptionEnabled?: boolean
	}) => {
		// Guard: prevent concurrent startRecording calls
		if (recordSummaryStore.isStartingRecord) {
			logger.warn("startRecording：已在启动中，忽略重复请求")
			return
		}

		try {
			recordSummaryStore.setIsStartingRecord(true)

			// 检查是否存在可恢复的历史数据（不区分用户）
			const hasRecoverableData = this.recordingPersistence.hasRecoverableData()
			if (hasRecoverableData) {
				const restorationData = await this.recordingPersistence.getRestorationData()
				const session = restorationData.currentSession

				if (session) {
					logger.log("检测到可恢复的历史录音数据，提示用户确认覆盖", {
						sessionId: session.id,
						sessionStatus: session.status,
						duration: session.totalDuration,
						chunkCount: session.currentChunkIndex,
						textContentLength: session.textContent?.length || 0,
					})

					// 只要有历史数据就提示，不区分用户
					// 触发确认覆盖事件，等待用户确认
					const confirmed = await new Promise<boolean>((resolve) => {
						this.emit(RECORD_SUMMARY_EVENTS.CONFIRM_OVERWRITE_SESSION, {
							session,
							onConfirm: () => resolve(true),
							onCancel: () => resolve(false),
						})
					})

					if (!confirmed) {
						logger.report("用户取消覆盖历史录音数据", {
							sessionId: session.id,
							sessionStatus: session.status,
							duration: session.totalDuration,
							chunkCount: session.currentChunkIndex,
						})
						return
					}

					// 用户确认覆盖，清除历史数据
					logger.report("用户确认覆盖历史录音数据", {
						sessionId: session.id,
						sessionStatus: session.status,
						duration: session.totalDuration,
						chunkCount: session.currentChunkIndex,
						textContentLength: session.textContent?.length || 0,
					})
					this.recordingPersistence.clearAll()
					logger.log("历史录音数据已清除")
				}
			}

			// 请求录音权限
			const hasPermission = await this.tabCoordinator.requestLock()
			if (!hasPermission) {
				throw new Error("其他标签正在录音，无法开始录音")
			}

			// Create new recording session
			const session = this.sessionManager.createSession({
				workspace: workspace,
				project: project,
				topic: topic,
				chatTopic: chatTopic,
				model: model,
				userId: userStore.user.userInfo?.user_id || "",
				audioSource: audioSource,
				sessionId: sessionId,
				transcriptionEnabled,
			})

			logger.report("开始录音", {
				workspace: workspace?.name,
				project: project.project_name,
				audioSource: audioSource?.source,
			})

			// 预加载 upload tokens，确保后续上传和状态上报时凭证已准备好
			try {
				await this.chunkUploader
					.getTokenManager()
					.getToken(session.id, session.topic?.id || "")
				logger.log(`会话 ${session.id} 的上传凭证预加载成功`)
			} catch (error) {
				logger.error({
					eventKey: "upload_token_preload_failed",
					errorKind: "unknown",
					error: error,
					message: "获取上传凭证失败",
				})
				throw new Error("无法获取上传凭证，录音启动失败")
			}

			// Update audio source config if provided
			if (audioSource) {
				this.mediaRecorderService.updateConfig({ audioSource })
			}

			try {
				// 开始录制音频
				await this.mediaRecorderService.startRecording(session.id)
				this.syncProcessingMode()
				const initialEncoding = this.mediaRecorderService.getEncodingSnapshot()
				if (initialEncoding) {
					this.sessionManager.updateSessionEncodingSnapshot(initialEncoding)
				}

				// 更新音频源配置(如果音频源发生变化)
				const currentAudioSource = this.mediaRecorderService.getAudioSource()
				if (currentAudioSource && currentAudioSource?.source !== audioSource?.source) {
					audioSource = currentAudioSource
					this.recordingPersistence.updateSessionAudioSource(audioSource)
				}

				// 启动分片生产监控：如果 30s 内没有收到任何分片，记录错误
				this.startChunkProductionWatchdog(session.id)
			} catch (error) {
				this.handleMediaRecorderError(error as Error)
				return
			}

			// 启动UI状态
			recordSummaryStore.startRecording({
				workspace: workspace,
				topic: topic,
				chatTopic: chatTopic,
				project: project,
				model: model,
				userId: session.userId,
				audioSource: audioSource,
				transcriptionEnabled,
				processingMode: recordSummaryStore.processingMode ?? undefined,
			})

			// Start duration tracking with AudioContext
			const audioContext = this.mediaRecorderService.getAudioContext()
			this.durationTracker.start(audioContext, 0)

			// Start UI update timer (1 second interval)
			this.startDurationUpdateTimer()

			// 开始上传任何挂起的分片
			this.chunkUploader.uploadSession(
				session.id,
				session.topic?.id || "",
				session.project?.id || "",
			)
			this.startUploadQueueWatchdog(
				session.id,
				session.topic?.id || "",
				session.project?.id || "",
			)

			if (transcriptionEnabled) {
				try {
					await this.startRealtimeTranscription(session.id)
				} catch (error) {
					this.handleVoiceError(error as Error)
				}
			}

			// Save session to persistence
			this.recordingPersistence.saveSession(session)

			// 开始检查录音状态
			this.recordStatusChecker.start()
			// 添加页面刷新拦截
			this.addBeforeUnloadListener()
			// 请求唤醒锁，避免设备休眠
			this.wakeLockManager.requestWakeLock()
			// 添加可见性变化监听器，处理标签焦点变化
			this.wakeLockManager.addVisibilityChangeListener()

			// 上报开始录音状态
			this.statusReporter.reportStatus({
				task_key: session.id,
				status: RecordingSummaryStatus.Start,
				model_id: model.model_id,
				file_shard_count: session.currentChunkIndex,
				note: recordSummaryStore.note,
				asr_stream_content: this.getLatestAsrContent(),
			})

			// 启动定期上报
			this.statusReporter.startPeriodicReport(session.id)

			// 初始化内容文件管理器
			try {
				await this.contentFileManager.initialize(
					session.id,
					session.topic?.id || "",
					session.project?.id || "",
				)
			} catch (error) {
				logger.error({
					eventKey: "initialize_content_file_manager_failed",
					errorKind: "unknown",
					error: error,
					message: "初始化内容文件管理器失败",
				})
				// Don't block recording on content file initialization failure
			}
		} catch (error) {
			logger.error({
				eventKey: "start_recording_failed",
				errorKind: "unknown",
				error: error,
				message: "启动录音失败",
			})

			// 重置服务（await 确保 reset 完成后再处理错误，避免并发竞态）
			await this.reset()

			this.handleMediaRecorderError(error as Error)
		} finally {
			recordSummaryStore.setIsStartingRecord(false)
		}
	}

	updateProject = async (project: ProjectListItem) => {
		const currentSession = this.sessionManager.updateProject(project)

		if (!currentSession) return

		this.recordingPersistence.saveSession(currentSession)

		recordSummaryStore.setProject(project)
	}

	updateTopic = async (topic: Topic) => {
		const currentSession = this.sessionManager.updateTopic(topic)

		if (!currentSession) return

		this.recordingPersistence.saveSession(currentSession)

		recordSummaryStore.setTopic(topic)
	}

	updateChatTopic = async (chatTopic: Topic) => {
		const currentSession = this.sessionManager.updateChatTopic(chatTopic)

		if (!currentSession) return

		this.recordingPersistence.saveSession(currentSession)

		recordSummaryStore.setChatTopic(chatTopic)
	}

	updateWorkspace = async (workspace: Workspace) => {
		const currentSession = this.sessionManager.updateWorkspace(workspace)

		if (!currentSession) return

		this.recordingPersistence.saveSession(currentSession)

		recordSummaryStore.setWorkspace(workspace)
	}

	updateModel = async (model: ModelItem | null) => {
		const currentSession = this.sessionManager.updateModel(model)

		if (!currentSession) return

		this.recordingPersistence.saveSession(currentSession)

		// 调用保存话题模型
		SuperMagicApi.saveSuperMagicTopicModel({
			cache_id: currentSession.topic?.id || "",
			model_id: model?.model_id || "",
		})

		recordSummaryStore.setModel(model)
	}

	/**
	 * 更新笔记内容
	 * Update note content (throttled)
	 */
	updateNote = (content: string, fileExtension: string = "md") => {
		// 1. Update store state
		recordSummaryStore.updateNoteContent(content)

		// 2. Update session and persist
		const currentSession = this.sessionManager.getCurrentSession()
		if (currentSession) {
			currentSession.note = {
				content,
				file_extension: fileExtension,
			}
			this.recordingPersistence.saveSession(currentSession)
			this.sessionManager.flushHistoryImmediate()
		}

		// 3. Trigger file upload (throttled)
		this.contentFileManager.updateNote(content)
	}

	flushNoteUpdate = (currentContent?: string) => {
		this.contentFileManager.flushNoteUpdate(currentContent)
	}

	/**
	 * Cancel pending note update
	 * 取消待处理的笔记更新
	 */
	cancelNoteUpdate = () => {
		this.contentFileManager.cancelNoteUpdate()
	}

	flushTranscriptUpdate = () => {
		this.contentFileManager.flushTranscriptUpdate()
	}

	/**
	 * Sync preset files to session for persistence
	 * 同步预设文件信息到会话以持久化
	 */
	private syncPresetFilesToSession = () => {
		const currentSession = this.sessionManager.getCurrentSession()
		if (!currentSession) {
			return
		}

		const presetFiles = this.chunkUploader.getTokenManager().getPresetFiles(currentSession.id)
		if (presetFiles) {
			currentSession.presetFiles = presetFiles
			this.recordingPersistence.saveSession(currentSession)
			logger.log("Preset files synced to session", presetFiles)
		}
	}

	/**
	 * Sync directories to session for persistence
	 * 同步目录信息到会话以持久化
	 */
	private syncDirectoriesToSession = () => {
		const currentSession = this.sessionManager.getCurrentSession()
		if (!currentSession) {
			return
		}

		const directories = this.chunkUploader.getTokenManager().getDirectories(currentSession.id)
		if (directories) {
			currentSession.directories = directories
			this.recordingPersistence.saveSession(currentSession)
			logger.log("Directories synced to session", directories)
		}
	}

	/**
	 * Get note file information for current session
	 * 获取当前会话的笔记文件信息
	 */
	getNoteFile = () => {
		const currentSession = this.sessionManager.getCurrentSession()
		if (!currentSession) {
			return undefined
		}

		// Priority 1: Get from session (persisted)
		if (currentSession.presetFiles?.note_file) {
			return currentSession.presetFiles.note_file
		}

		// Priority 2: Get from token manager (memory cache)
		const noteFile = this.chunkUploader.getTokenManager().getNoteFile(currentSession.id)

		// If found in token manager but not in session, sync to session
		if (noteFile) {
			this.syncPresetFilesToSession()
		}

		return noteFile
	}

	/**
	 * Get transcript file information for current session
	 * 获取当前会话的转写文件信息
	 */
	getTranscriptFile = () => {
		const currentSession = this.sessionManager.getCurrentSession()
		if (!currentSession) {
			return undefined
		}

		// Priority 1: Get from session (persisted)
		if (currentSession.presetFiles?.transcript_file) {
			return currentSession.presetFiles.transcript_file
		}

		// Priority 2: Get from token manager (memory cache)
		const transcriptFile = this.chunkUploader
			.getTokenManager()
			.getTranscriptFile(currentSession.id)

		// If found in token manager but not in session, sync to session
		if (transcriptFile) {
			this.syncPresetFilesToSession()
		}

		return transcriptFile
	}

	/**
	 * Get preset files information for current session
	 * 获取当前会话的预设文件信息
	 */
	getPresetFiles = () => {
		const currentSession = this.sessionManager.getCurrentSession()
		if (!currentSession) {
			return undefined
		}

		// Priority 1: Get from session (persisted)
		if (currentSession.presetFiles) {
			return currentSession.presetFiles
		}

		// Priority 2: Get from token manager (memory cache)
		const presetFiles = this.chunkUploader.getTokenManager().getPresetFiles(currentSession.id)

		// If found in token manager but not in session, sync to session
		if (presetFiles) {
			this.syncPresetFilesToSession()
		}

		return presetFiles
	}

	getAsrDisplayDir = () => {
		const currentSession = this.sessionManager.getCurrentSession()
		if (!currentSession) {
			return undefined
		}

		// Priority 1: Get from session (persisted)
		if (currentSession.directories?.asr_display_dir) {
			return currentSession.directories.asr_display_dir
		}

		// Priority 2: Get from token manager (memory cache)
		const directories = this.chunkUploader.getTokenManager().getDirectories(currentSession.id)

		// If found in token manager but not in session, sync to session
		if (directories) {
			this.syncDirectoriesToSession()
		}

		return directories?.asr_display_dir
	}

	/**
	 * Update note file last updated timestamp
	 * 更新笔记文件的最后更新时间戳
	 */
	updateNoteLastUpdatedAt = (updatedAt: string) => {
		const currentSession = this.sessionManager.getCurrentSession()
		if (!currentSession) {
			return
		}

		currentSession.noteLastUpdatedAt = updatedAt
		this.recordingPersistence.saveSession(currentSession)
		logger.log("Note last updated at updated", updatedAt)
	}

	/**
	 * Get note file last updated timestamp
	 * 获取笔记文件的最后更新时间戳
	 */
	getNoteLastUpdatedAt = (): string | undefined => {
		const currentSession = this.sessionManager.getCurrentSession()
		if (!currentSession) {
			return undefined
		}

		return currentSession.noteLastUpdatedAt
	}

	getNoteLastSyncedContent = (): string | undefined => {
		return this.contentFileManager.getNoteLastUploadedContent()
	}

	/**
	 * 暂停录音
	 * @returns
	 */
	pauseRecording = async () => {
		recordSummaryStore.setIsPausing(true)

		try {
			this.mediaRecorderService.requestData()

			// 停止录音并完全清理资源
			// Stop recording and fully cleanup resources
			await this.mediaRecorderService.stopRecordingAndCleanup({ source: "pause_recording" })

			// 暂停语音识别
			await this.voiceToTextService.stopRecording().catch((error) => {
				logger.error({
					eventKey: "stop_voice_recording_failed",
					errorKind: "unknown",
					error: error,
					message: "Failed to stop voice recording",
				})
			})

			// 停止语音超时检测
			this.voiceTimeoutChecker.stop()

			// 停止静音检测（会自动关闭静音提示）
			this.silenceDetector.stop()

			// 释放所有音频流和资源
			// Release all audio streams and resources
			try {
				this.voiceToTextService.disconnect()
				logger.log("All audio resources released during pause")
			} catch (error) {
				logger.error({
					eventKey: "release_resources_failed",
					errorKind: "unknown",
					error: error,
					message: "Failed to release resources",
				})
			}

			// Pause duration tracking and save accumulated duration
			const currentDuration = this.durationTracker.pause()
			this.stopDurationUpdateTimer()

			const currentSession = this.sessionManager.getCurrentSession()
			if (!currentSession) return

			// Update session with paused duration
			currentSession.status = "paused"
			currentSession.totalDuration = currentDuration
			this.recordingPersistence.saveSession(currentSession)

			// 上报暂停状态
			this.statusReporter.reportStatus({
				task_key: currentSession.id,
				status: RecordingSummaryStatus.Paused,
				model_id: currentSession.model?.model_id || "",
				file_shard_count: currentSession.currentChunkIndex,
				note: recordSummaryStore.note,
				asr_stream_content: this.getLatestAsrContent(),
			})

			// 停止定期上报
			this.statusReporter.stopPeriodicReport()

			recordSummaryStore.setIsPaused(true)
		} catch (error) {
			logger.error({
				eventKey: "pause_recording_failed",
				errorKind: "unknown",
				error: error,
				message: "Failed to pause recording",
			})
		} finally {
			recordSummaryStore.setIsPausing(false)
		}
	}

	/**
	 * 继续录音
	 * @returns
	 */
	continueRecording = async () => {
		recordSummaryStore.setIsContinuing(true)

		try {
			const currentSession = this.sessionManager.getCurrentSession()
			if (!currentSession) return

			// Pre-request system audio permission if needed (MUST be called in user gesture context)
			// 如果需要系统音频，预先请求权限（必须在用户手势上下文中调用）
			let preauthorizedDisplayMedia: MediaStream | null = null
			const audioSource = currentSession.audioSource?.source
			if (audioSource === "system" || audioSource === "both") {
				try {
					logger.log("Pre-requesting display media permission for resume", {
						audioSource,
					})
					preauthorizedDisplayMedia = await navigator.mediaDevices.getDisplayMedia({
						video: {
							displaySurface: "monitor",
						},
						audio: {
							echoCancellation: false,
							noiseSuppression: false,
							autoGainControl: false,
							suppressLocalAudioPlayback: false,
						},
						preferCurrentTab: false,
						selfBrowserSurface: "exclude",
						systemAudio: "include",
						surfaceSwitching: "include",
						monitorTypeSurfaces: "include",
					} as MediaStreamConstraints & {
						preferCurrentTab?: boolean
						selfBrowserSurface?: string
						systemAudio?: string
						surfaceSwitching?: string
						monitorTypeSurfaces?: string
					})
					logger.log("Display media pre-authorized successfully")
				} catch (error) {
					logger.error({
						eventKey: "pre_authorize_display_media_failed",
						errorKind: "permission",
						error: error,
						message: "Failed to pre-authorize display media",
					})
					recordSummaryStore.setIsContinuing(false)
					const errorMessage = i18n.t(
						"recordSummary:audioSource.errors.resumePermissionDenied",
					)
					magicToast.error(errorMessage)
					throw new Error(errorMessage)
				}
			}

			// Pass pre-authorized stream to recorder service
			// 将预授权的流传递给录音服务
			if (preauthorizedDisplayMedia) {
				// Store it temporarily for the recorder to use
				this.mediaRecorderService.setPreauthorizedDisplayMedia(preauthorizedDisplayMedia)
			}
			this.restoreEncodingSnapshot(currentSession)

			// 重新开始录音（需要重新授权音频源）
			// Restart recording (requires re-authorization of audio source)
			await this.mediaRecorderService.startRecording(
				currentSession.id,
				currentSession.currentChunkIndex,
			)
			this.syncProcessingMode()
			const resumedEncoding = this.mediaRecorderService.getEncodingSnapshot()
			if (resumedEncoding) {
				this.sessionManager.updateSessionEncodingSnapshot(resumedEncoding)
			}

			// Clean up preauthorized stream reference after use
			// 使用后清理预授权流引用
			if (preauthorizedDisplayMedia) {
				this.mediaRecorderService.clearPreauthorizedDisplayMedia()
			}

			if (currentSession.transcriptionEnabled !== false) {
				// Keep ASR disabled across pause/resume when the user started this session without transcription.
				await this.startRealtimeTranscription(currentSession.id)
				logger.log("Voice recognition restarted with recording ID", currentSession.id)
			}

			// Resume duration tracking with new AudioContext
			// IMPORTANT: Use session.totalDuration to restore accumulated time
			// (DurationTracker is a new instance after page refresh)
			const audioContext = this.mediaRecorderService.getAudioContext()
			const previousDuration = currentSession.totalDuration || 0
			this.durationTracker.start(audioContext, previousDuration)

			// Restart UI update timer
			this.startDurationUpdateTimer()

			currentSession.status = "recording"
			this.recordingPersistence.saveSession(currentSession)

			// 恢复 presetFiles 并初始化内容文件管理器
			await this.restoreContentFileManager(currentSession)

			// 上报继续录音状态
			this.statusReporter.reportStatus({
				task_key: currentSession.id,
				status: RecordingSummaryStatus.Recording,
				model_id: currentSession.model?.model_id || "",
				file_shard_count: currentSession.currentChunkIndex,
				note: recordSummaryStore.note,
				asr_stream_content: this.getLatestAsrContent(),
			})

			// 重新启动定期上报
			this.statusReporter.startPeriodicReport(currentSession.id)

			recordSummaryStore.setIsPaused(false)
		} catch (error) {
			logger.error({
				eventKey: "continue_recording_failed",
				errorKind: "unknown",
				error: error,
				message: "Failed to continue recording",
			})
			// 恢复失败时，确保状态一致
			recordSummaryStore.setIsPaused(true)
			throw error
		} finally {
			recordSummaryStore.setIsContinuing(false)
		}
	}

	/**
	 * Switch audio source during recording
	 * 录制期间切换音频源
	 */
	switchAudioSource = async (newSource: AudioSourceType) => {
		if (!recordSummaryStore.isRecording && !recordSummaryStore.isPaused) {
			logger.warn("Cannot switch audio source when not recording")
			return
		}

		try {
			logger.log("Switching audio source", { newSource })

			const audioSourceConfig: AudioSourceConfig = {
				source: newSource,
			}

			// Handle paused state: only update config, no actual audio source switch
			// 暂停状态：仅更新配置，不进行实际的音频源切换
			if (recordSummaryStore.isPaused) {
				logger.log("Recording is paused, updating config only", { newSource })

				// Update media recorder service config for next resume
				this.mediaRecorderService.updateConfig({ audioSource: audioSourceConfig })

				// Update session and store
				const currentSession = this.sessionManager.getCurrentSession()
				if (currentSession) {
					currentSession.audioSource = audioSourceConfig
					this.recordingPersistence.saveSession(currentSession)
					recordSummaryStore.setAudioSource(audioSourceConfig)
				}

				logger.log("Audio source config updated for paused recording", { newSource })
				return
			}

			// Handle recording state: perform actual audio source switch
			// 录制状态：执行实际的音频源切换
			await this.mediaRecorderService.switchAudioSource(newSource)

			// CRITICAL: Update DurationTracker with new AudioContext
			// When switching audio source, MediaRecorder creates a new AudioContext
			// We must update the reference to continue accurate time tracking
			const newAudioContext = this.mediaRecorderService.getAudioContext()
			if (newAudioContext) {
				this.durationTracker.updateAudioContext(newAudioContext)
				logger.log("DurationTracker updated with new AudioContext after source switch")
			} else {
				logger.warn("No AudioContext available after audio source switch")
			}

			// Get the new media stream for voice recognition
			const newMediaStream = this.mediaRecorderService.getMediaRecorderStream()

			const currentSession = this.sessionManager.getCurrentSession()
			if (newMediaStream && currentSession?.transcriptionEnabled !== false) {
				// Switch audio source in voice to text service
				await this.voiceToTextService.switchAudioSource(newMediaStream)
			} else {
				logger.warn("No media stream available after switching audio source")
			}

			if (currentSession?.transcriptionEnabled !== false) {
				// Restart silence detection only when realtime transcription is active.
				this.silenceDetector.stop()
				this.startSilenceDetection()
			}

			// Update session and store with new audio source
			if (currentSession) {
				currentSession.audioSource = audioSourceConfig
				this.recordingPersistence.saveSession(currentSession)
				recordSummaryStore.setAudioSource(audioSourceConfig)
			}

			logger.log("Audio source switched successfully", { newSource })
		} catch (error) {
			logger.error({
				eventKey: "switch_audio_source_failed",
				errorKind: "unknown",
				error: error,
				message: "Failed to switch audio source",
			})
			throw error
		}
	}

	/**
	 * Switch microphone device without changing the audio source type.
	 * Uses the same auto-pause → switch → auto-resume strategy as switchAudioSource.
	 * Updates store and persisted session so the new deviceId survives page reload.
	 * 切换麦克风设备（不改变音频源类型，自动暂停-切换-恢复）
	 */
	switchMicrophoneDevice = async (deviceId: string): Promise<void> => {
		if (!recordSummaryStore.isRecording && !recordSummaryStore.isPaused) {
			logger.warn("Cannot switch microphone device when not recording")
			return
		}

		try {
			logger.log("Switching microphone device", { deviceId })

			// Delegate to MediaRecorderService (handles pause/resume internally)
			await this.mediaRecorderService.switchMicrophoneDevice(deviceId)

			// Update voice-to-text service with the new media stream
			const currentSession = this.sessionManager.getCurrentSession()
			const newMediaStream = this.mediaRecorderService.getMediaRecorderStream()
			if (newMediaStream && currentSession?.transcriptionEnabled !== false) {
				await this.voiceToTextService.switchAudioSource(newMediaStream)
			}

			// Update DurationTracker AudioContext in case it was recreated
			const newAudioContext = this.mediaRecorderService.getAudioContext()
			if (newAudioContext) {
				this.durationTracker.updateAudioContext(newAudioContext)
			}

			// Persist updated deviceId in session + store
			const currentAudioSource = recordSummaryStore.getAudioSource()
			const updatedAudioSource: AudioSourceConfig = {
				source: currentAudioSource?.source ?? "microphone",
				microphoneGain: currentAudioSource?.microphoneGain,
				systemGain: currentAudioSource?.systemGain,
				microphoneConstraints: {
					...currentAudioSource?.microphoneConstraints,
					deviceId,
				},
			}
			if (currentSession) {
				currentSession.audioSource = updatedAudioSource
				this.recordingPersistence.saveSession(currentSession)
			}
			recordSummaryStore.setAudioSource(updatedAudioSource)
			recordSummaryStore.setSelectedMicrophoneDeviceId(deviceId)

			logger.log("Microphone device switched successfully", { deviceId })
		} catch (error) {
			logger.error({
				eventKey: "switch_microphone_device_failed",
				errorKind: "unknown",
				error: error,
				message: "Failed to switch microphone device",
			})
			throw error
		}
	}

	/**
	 * 恢复录音（用于页面刷新后继续录音）
	 */
	private resumeRecording = async (session: RecordingSession) => {
		try {
			// 获取当前会话传递给媒体录制器
			if (!session) {
				throw new Error("没有当前会话可用于恢复录音")
			}

			// Set session ID for all subsequent logs
			logger.setSessionId(session.id)

			// Pre-check token before resuming recording
			// If task has ended (error code 43200), stop and don't resume
			try {
				const topicId = session.topic?.id || ""
				if (!topicId) {
					logger.warn(`会话 ${session.id} 缺少 topicId，无法验证 token`)
				} else {
					await this.chunkUploader.getTokenManager().getToken(session.id, topicId)
					logger.log(`Token 验证成功，可以恢复录音会话 ${session.id}`)
				}
			} catch (error) {
				// Check if error is task end error (code 43200)
				if (isTaskEndError(error)) {
					logger.warn(`恢复录音前检测到任务已结束，停止恢复会话 ${session.id}`)
					// Handle task end: stop local instances and reset state
					await this.handleTaskEnd(session.id, error.code)
					return
				}
				// If it's not a task end error, log but continue with resume
				logger.warn(`Token 验证失败，但继续尝试恢复录音:`, error)
			}

			// Restore audio source configuration if available
			const audioSource = session.audioSource || { source: "microphone" }
			logger.log("恢复音频源配置", { audioSource })

			// Update media recorder config with saved audio source
			this.mediaRecorderService.updateConfig({ audioSource })
			this.restoreEncodingSnapshot(session)

			// 恢复音频录制，传递会话ID和当前分片索引
			await this.mediaRecorderService.startRecording(
				session.id,
				session.currentChunkIndex || 0,
			)
			this.syncProcessingMode()
			const restoredEncoding = this.mediaRecorderService.getEncodingSnapshot()
			if (restoredEncoding) {
				this.sessionManager.updateSessionEncodingSnapshot(restoredEncoding)
			}

			// 更新音频源配置(如果音频源发生变化)
			const currentAudioSource = this.mediaRecorderService.getAudioSource()
			if (currentAudioSource && currentAudioSource?.source !== audioSource?.source) {
				this.recordingPersistence.updateSessionAudioSource(currentAudioSource)
				recordSummaryStore.setAudioSource(currentAudioSource)
			}

			if (session.transcriptionEnabled !== false) {
				try {
					await this.startRealtimeTranscription(session.id)
				} catch (error) {
					this.handleVoiceError(error as Error)
				}
			}

			// Resume duration tracking from previous duration
			const audioContext = this.mediaRecorderService.getAudioContext()
			this.durationTracker.start(audioContext, session.totalDuration)

			// Start UI update timer
			this.startDurationUpdateTimer()

			// 添加页面刷新拦截
			this.addBeforeUnloadListener()
			// 请求唤醒锁，避免设备休眠
			await this.wakeLockManager.requestWakeLock()
			// 添加可见性变化监听器
			this.wakeLockManager.addVisibilityChangeListener()

			// 上报恢复录音状态（页面刷新后恢复）
			this.statusReporter.reportStatus({
				task_key: session.id,
				status: RecordingSummaryStatus.Recording,
				model_id: session.model?.model_id || "",
				file_shard_count: session.currentChunkIndex,
				note: recordSummaryStore.note,
				asr_stream_content: this.getLatestAsrContent(),
			})

			// 启动定期上报
			this.statusReporter.startPeriodicReport(session.id)

			// 恢复录音时会自动上传会话分片
			this.chunkUploader.uploadSession(
				session.id,
				session.topic?.id || "",
				session.project?.id || "",
			)
			this.startUploadQueueWatchdog(
				session.id,
				session.topic?.id || "",
				session.project?.id || "",
			)

			// 恢复 presetFiles 并初始化内容文件管理器
			await this.restoreContentFileManager(session)

			logger.log("录音恢复成功", {
				previousDuration: session.totalDuration,
				formattedDuration: formatDuration(session.totalDuration),
				recordingId: session.id,
				audioSource: audioSource.source,
			})
		} catch (error) {
			logger.error({
				eventKey: "resume_recording_failed",
				errorKind: "unknown",
				error: error,
				message: "Failed to resume recording",
			})
			this.handleMediaRecorderError(error as Error)
		}
	}

	/**
	 * Restore preset files and initialize content file manager
	 * 恢复预设文件并初始化内容文件管理器
	 */
	private async restoreContentFileManager(session: RecordingSession): Promise<void> {
		// 恢复 presetFiles 到 tokenManager 缓存（如果 session 中有）
		if (session.presetFiles) {
			this.chunkUploader.getTokenManager().restorePresetFiles(session.id, session.presetFiles)
			logger.log("Preset files restored to token manager from session", session.presetFiles)
		}

		// 恢复 directories 到 tokenManager 缓存（如果 session 中有）
		if (session.directories) {
			this.chunkUploader.getTokenManager().restoreDirectories(session.id, session.directories)
			logger.log("Directories restored to token manager from session", session.directories)
		}

		// 初始化或恢复内容文件管理器
		if (!this.contentFileManager.isInitialized()) {
			try {
				// Format existing transcript content
				const existingTranscript = this.formatTranscriptContent(session.textContent || [])
				// Get existing note content from session (preferred) or store
				const existingNote = session.note?.content || recordSummaryStore.note?.content || ""

				await this.contentFileManager.initialize(
					session.id,
					session.topic?.id || "",
					session.project?.id || "",
					{
						existingNote,
						existingTranscript,
					},
				)
			} catch (error) {
				logger.error({
					eventKey: "initialize_content_file_manager_failed",
					errorKind: "unknown",
					error: error,
					message: "初始化内容文件管理器失败",
				})
				// Don't block recording on content file initialization failure
			}
		}
	}

	/**
	 * Format transcript content to markdown (helper method)
	 * 将转文本内容格式化为 Markdown（辅助方法）
	 */
	private formatTranscriptContent(
		textContent: (VoiceResultUtterance & { add_time: number; id: string })[],
	): string {
		if (!textContent || textContent.length === 0) {
			return ""
		}

		// Format as markdown with timestamps
		return textContent
			.map((utterance) => {
				const timestamp = new Date(utterance.add_time).toLocaleTimeString("zh-CN", {
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
				})
				return `[${timestamp}] ${utterance.text}`
			})
			.join("\n\n")
	}

	/**
	 * 取消录音
	 * @param waitForUploadComplete 是否等待上传完成，默认为true
	 */
	cancelRecording = async (
		options: {
			waitForUploadComplete?: boolean
			notifyServer?: boolean
			source?: string
		} = {
			waitForUploadComplete: true,
			notifyServer: true,
		},
	) => {
		const {
			waitForUploadComplete = true,
			notifyServer = true,
			source = "user_cancel",
		} = options
		const activeSession = this.sessionManager.getCurrentSession()

		logger.report("取消录音", {
			sessionId: activeSession?.id,
			previousStatus: activeSession?.status,
			previousChunkIndex: activeSession?.currentChunkIndex,
			waitForUploadComplete,
			notifyServer,
			source,
		})
		this.stopUploadQueueWatchdog()

		// Stop duration tracking
		this.durationTracker.stop()
		this.stopDurationUpdateTimer()

		// 停止语音超时检测
		this.voiceTimeoutChecker.stop()

		// 停止静音检测（会自动关闭静音提示）
		this.silenceDetector.stop()

		// 停止语音服务
		try {
			await this.voiceToTextService.stopRecording()
			// 完全清理音频资源，包括音频流
			this.voiceToTextService.disconnect()
		} catch (error) {
			logger.error({
				eventKey: "stop_voice_recording_failed",
				errorKind: "unknown",
				error: error,
				message: "Failed to stop voice recording",
			})
		}

		// 停止媒体录制器并请求最终分片
		try {
			// 请求最终数据分片
			this.mediaRecorderService.requestData()
			await this.mediaRecorderService.stopRecording({ source: `cancel:${source}` })
			logger.log("Recording media capture stopped during cancellation", {
				sessionId: activeSession?.id,
				source,
			})
		} catch (error) {
			logger.error({
				eventKey: "stop_media_recorder_failed",
				errorKind: "unknown",
				error: error,
				message: "Failed to stop media recorder",
				context: { sessionId: activeSession?.id, source },
			})
		}

		const session = this.sessionManager.getCurrentSession()

		if (session) {
			// 等待上传完成（如果需要）
			if (waitForUploadComplete) {
				try {
					// 显示上传等待状态
					recordSummaryStore.showWaitingUpload()
					logger.log("等待剩余分片上传完成...")

					// Calculate dynamic timeout based on pending chunks
					// Base timeout: 30s, +10s per pending chunk (max 120s)
					const queueStatus = await this.chunkUploader.getQueueStatus(session.id)
					const pendingCount = queueStatus.pending || 0
					const dynamicTimeout = Math.min(30000 + pendingCount * 10000, 120000) // 30s base + 10s/chunk, max 120s
					logger.log("Cancellation upload wait started", {
						sessionId: session.id,
						source,
						queueStatus,
						pendingCount,
						dynamicTimeout,
					})
					await this.chunkUploader.waitForAllUploadsCompleted(session.id, dynamicTimeout)

					logger.log("Cancellation upload wait completed", {
						sessionId: session.id,
						source,
						queueStatus: await this.chunkUploader.getQueueStatus(session.id),
					})
				} catch (error) {
					logger.warn("Cancellation upload wait failed", {
						sessionId: session.id,
						source,
						errorMessage: error instanceof Error ? error.message : String(error),
					})
					// 即使上传失败也继续取消流程
				} finally {
					try {
						await this.chunkUploader.clearSessionChunks(session.id, `cancel:${source}`)
					} catch (error) {
						logger.error({
							eventKey: "cancel_chunk_cleanup_failed",
							errorKind: "storage",
							error,
							message: "取消录音时清理待上传分片失败",
							context: { sessionId: session.id, source },
						})
					}
					// 隐藏上传等待状态
					recordSummaryStore.hideWaitingUpload()
				}
			} else {
				// 如果不等待上传完成，则暂停所有上传
				logger.log("Cancellation clearing pending chunks without waiting", {
					sessionId: session.id,
					source,
				})
				try {
					await this.chunkUploader.clearSessionChunks(session.id, `cancel:${source}`)
				} catch (error) {
					logger.error({
						eventKey: "cancel_chunk_cleanup_failed",
						errorKind: "storage",
						error,
						message: "取消录音时清理待上传分片失败",
						context: { sessionId: session.id, source },
					})
				}
			}

			if (notifyServer) {
				// 上报取消状态
				logger.log("Recording cancellation status report requested", {
					sessionId: session.id,
					source,
					status: RecordingSummaryStatus.Canceled,
				})
				this.statusReporter.reportStatus({
					task_key: session.id,
					status: RecordingSummaryStatus.Canceled,
					model_id: session.model?.model_id || "",
					file_shard_count: session.currentChunkIndex,
					note: recordSummaryStore.note,
					asr_stream_content: this.getLatestAsrContent(),
				})
			}

			// 停止定期上报
			this.statusReporter.stopPeriodicReport()
		}

		// Cancel current session and clean up persistence data
		const cancelledSession = this.sessionManager.cancelSession()
		logger.log("Recording cancellation completed", {
			sessionId: cancelledSession?.id || activeSession?.id,
			source,
			finalStatus: cancelledSession?.status,
			finalChunkIndex: cancelledSession?.currentChunkIndex,
			finalDuration: cancelledSession?.totalDuration,
		})

		// 重置媒体录制器
		this.mediaRecorderService.reset()
		// 清除所有持久化数据
		this.recordingPersistence.clearAll()

		// 更新UI状态
		recordSummaryStore.cancelRecording()

		// 释放唤醒锁
		this.wakeLockManager.releaseWakeLock()
		// 移除可见性变化监听器
		this.wakeLockManager.removeVisibilityChangeListener()
		// 移除页面刷新拦截
		this.removeBeforeUnloadListener()
		// 释放录音权限
		this.tabCoordinator.releaseLock({
			type: "finish",
			data: {
				message: [],
				duration: "00:00:00",
				isRecording: false,
				sessionId: "",
			},
		})

		return cancelledSession
	}

	/**
	 * Stop the active recorder for an explicit override, summarize the session,
	 * then release it while keeping its IndexedDB chunks available for audit/export.
	 */
	forceStopRecordingForOverride = async (expectedSessionId?: string): Promise<boolean> => {
		const activeSession = this.sessionManager.getCurrentSession()
		if (!activeSession || (expectedSessionId && activeSession.id !== expectedSessionId)) {
			return false
		}

		logger.report("用户强制发起新录音，停止上一段录音", {
			sessionId: activeSession.id,
			duration: activeSession.totalDuration,
			chunkCount: activeSession.currentChunkIndex,
			source: "force_override",
			previousIssue: {
				hasRecordingError: recordSummaryStore.errorState.hasRecordingError,
				hasChunkError: recordSummaryStore.errorState.hasChunkError,
				hasVoiceError: recordSummaryStore.errorState.hasVoiceError,
				recordingError: recordSummaryStore.errorState.recordingError?.message,
				retryCount: recordSummaryStore.errorState.retryInfo.current,
			},
		})

		this.stopChunkProductionWatchdog()
		this.recordStatusChecker.stop()

		let overrideSummaryResult: GetRecordingSummaryResultResponse | null = null
		try {
			await runForceOverrideFinalization({
				stopRecordingServices: () =>
					this.stopRecordingServices("force_override", {
						throwOnMediaRecorderError: true,
					}),
				flushSessionUploads: () => this.flushSessionUploadsBeforeOverride(activeSession),
				summarizeSession: async () => {
					this.statusReporter.stopPeriodicReport()
					this.stopUploadQueueWatchdog()

					const { project, topic } = await this.ensureProjectAndTopic(activeSession)
					try {
						overrideSummaryResult = await this.processSummaryForSession(
							activeSession,
							project.id,
							topic.id,
							{
								note: activeSession.note ?? recordSummaryStore.note,
								asr_stream_content: this.getLatestAsrContent(),
							},
						)
					} catch (error) {
						if (!isOverrideSummaryAlreadySettled(error)) throw error

						logger.report("总结接口返回会话已在总结中或已结束，视为上一段已结束", {
							sessionId: activeSession.id,
							errorCode: getBusinessErrorCode(error),
						})
					}
				},
				completeSession: () => {
					// Summary has been accepted by the server; complete only the old local
					// session and leave its IndexedDB audio chunks available for audit/export.
					this.cleanupAfterSessionComplete()
					this.recordingPersistence.deleteSession(activeSession.id)
					this.emit(RECORD_SUMMARY_EVENTS.UPDATE_EMPTY_WORKSPACE_PANEL_PROJECTS, {
						topicId: activeSession.topic?.id || "",
						projectId: activeSession.project?.id || "",
						workspaceId: activeSession.workspace?.id || "",
					})
					this.emit(RECORD_SUMMARY_EVENTS.RECORDING_COMPLETE, { session: activeSession })
					logger.report("强制发起前上一段录音总结已触发", {
						sessionId: activeSession.id,
						taskKey: overrideSummaryResult?.task_key,
					})
				},
			})
		} catch (error) {
			this.statusReporter.stopPeriodicReport()
			this.stopUploadQueueWatchdog()
			logger.error({
				eventKey: "force_override_summary_failed",
				errorKind: "unknown",
				error,
				message: "强制发起时上一段录音总结失败，保留原录音锁",
				context: { sessionId: activeSession.id },
			})
			return false
		}
		return true
	}

	private flushSessionUploadsBeforeOverride = async (
		session: RecordingSession,
	): Promise<void> => {
		const topicId = session.topic?.id || ""
		const projectId = session.project?.id || ""
		const progress = await this.chunkUploader.getSessionUploadProgress(session.id)

		if (progress.failed > 0) {
			await this.chunkUploader.retryFailedChunks(session.id, topicId, projectId)
		}

		this.startUploadQueueWatchdog(session.id, topicId, projectId)
		await this.chunkUploader.uploadSession(session.id, topicId, projectId)
		await this.ensureSessionUploadComplete(session, {
			topicId,
			projectId,
			allowUserDecision: false,
			maxWaitTimeouts: FORCE_OVERRIDE_MAX_UPLOAD_WAIT_TIMEOUTS,
		})

		logger.report("强制发起前上一段录音分片已全部上传", {
			sessionId: session.id,
			chunkCount: session.currentChunkIndex,
		})
	}

	/** Describe the recording that must finish before a new one can start. */
	getRecordingOverrideContext = async (): Promise<RecordingOverrideContext | null> => {
		const currentSession = this.sessionManager.getCurrentSession()
		if (currentSession) {
			return {
				sessionId: currentSession.id,
				duration: formatDuration(currentSession.totalDuration || 0),
				source: "currentTab",
				status: currentSession.status === "paused" ? "paused" : "recording",
				startContext: {
					workspace: currentSession.workspace,
					project: currentSession.project,
					topic: currentSession.topic ?? null,
					model: currentSession.model,
				},
			}
		}

		const hasOtherTabRecording =
			recordSummaryStore.isOtherTabRecording ||
			(this.tabCoordinator.isAnyTabRecording() &&
				!this.tabCoordinator.hasRecordingPermission())
		if (hasOtherTabRecording) {
			return {
				sessionId: recordSummaryStore.multiTabState.activeTabData.sessionId,
				duration: recordSummaryStore.multiTabState.activeTabData.duration,
				source: "otherTab",
				status: "recording",
			}
		}

		if (!this.recordingPersistence.hasRecoverableData()) return null
		const historicalSession = (await this.recordingPersistence.getRestorationData())
			.currentSession
		if (!historicalSession) return null

		return {
			sessionId: historicalSession.id,
			duration: formatDuration(historicalSession.totalDuration || 0),
			source: "history",
			status: historicalSession.status === "paused" ? "paused" : "recording",
			startContext: {
				workspace: historicalSession.workspace,
				project: historicalSession.project,
				topic: historicalSession.topic ?? null,
				model: historicalSession.model,
			},
		}
	}

	/** Prepare a new recording after explicitly taking over an existing session. */
	prepareRecordingOverride = async (expectedSessionId?: string): Promise<boolean> => {
		if (this.forceOverridePreparation) return this.forceOverridePreparation

		this.forceOverridePreparation = this.prepareRecordingOverrideInternal(expectedSessionId)
		try {
			return await this.forceOverridePreparation
		} finally {
			this.forceOverridePreparation = null
		}
	}

	private prepareRecordingOverrideInternal = async (
		expectedSessionId?: string,
	): Promise<boolean> => {
		const currentSession = this.sessionManager.getCurrentSession()
		if (currentSession) {
			const stopped = await this.forceStopRecordingForOverride(
				expectedSessionId ?? currentSession.id,
			)
			if (!stopped) return false
		}

		const hasOtherTabRecording =
			recordSummaryStore.isOtherTabRecording ||
			(this.tabCoordinator.isAnyTabRecording() &&
				!this.tabCoordinator.hasRecordingPermission())
		if (hasOtherTabRecording) {
			const overridden = await this.tabCoordinator.requestRecordingOverride(
				expectedSessionId ?? recordSummaryStore.multiTabState.activeTabData.sessionId,
				FORCE_OVERRIDE_REQUEST_TIMEOUT_MS,
			)
			if (!overridden) {
				logger.warn("未能确认其他标签已停止录音", { source: "force_override" })
				return false
			}

			return this.tabCoordinator.requestLock()
		}

		if (!this.recordingPersistence.hasRecoverableData()) return true
		const historicalSession = (await this.recordingPersistence.getRestorationData())
			.currentSession
		if (
			!historicalSession ||
			(expectedSessionId && historicalSession.id !== expectedSessionId)
		) {
			return false
		}

		// Historical sessions have no active recorder, but restoring the session lets
		// the same upload, summary, completion, and persistence path handle them.
		if (!this.sessionManager.restoreSession(historicalSession)) return false
		return this.forceStopRecordingForOverride(historicalSession.id)
	}

	/** Release the confirmed session so a new recording can start without a summary. */
	releaseOverrideSessionForForceStart = async (expectedSessionId?: string): Promise<boolean> => {
		const activeSession = this.sessionManager.getCurrentSession()
		if (activeSession) {
			if (expectedSessionId && activeSession.id !== expectedSessionId) {
				logger.warn("仍要发起已取消：当前会话已变化", {
					expectedSessionId,
					currentSessionId: activeSession.id,
				})
				return false
			}

			const recorderStopped = await this.stopLeftoverRecordingServicesForForceStart()
			if (!recorderStopped) {
				logger.warn("仍要发起已取消：旧录音器仍在运行", {
					sessionId: activeSession.id,
				})
				return false
			}

			this.cleanupAfterSessionComplete()
			this.recordingPersistence.deleteSession(activeSession.id)
			this.emit(RECORD_SUMMARY_EVENTS.UPDATE_EMPTY_WORKSPACE_PANEL_PROJECTS, {
				topicId: activeSession.topic?.id || "",
				projectId: activeSession.project?.id || "",
				workspaceId: activeSession.workspace?.id || "",
			})
			this.emit(RECORD_SUMMARY_EVENTS.RECORDING_COMPLETE, { session: activeSession })
			logger.report("用户选择仍要发起，已释放上一段录音锁", {
				sessionId: activeSession.id,
			})
			return true
		}

		const otherTabHoldsLock =
			this.tabCoordinator.isAnyTabRecording() && !this.tabCoordinator.hasRecordingPermission()
		const otherTabSessionId = recordSummaryStore.multiTabState.activeTabData.sessionId
		if (
			expectedSessionId &&
			otherTabHoldsLock &&
			otherTabSessionId &&
			otherTabSessionId !== expectedSessionId
		) {
			logger.warn("仍要发起已取消：其他标签会话已变化", {
				expectedSessionId,
				otherTabSessionId,
			})
			return false
		}

		this.recordingPersistence.clearAll()
		recordSummaryStore.completeRecording()

		if (otherTabHoldsLock) {
			this.tabCoordinator.forceAcquireLock()
			logger.report("用户选择仍要发起，已强制接管其他标签的录音锁")
			return true
		}

		this.tabCoordinator.releaseLock({
			type: "finish",
			data: {
				message: [],
				duration: "00:00:00",
				isRecording: false,
				sessionId: "",
			},
		})
		logger.report("用户选择仍要发起，已清理可恢复的历史录音指针")
		return true
	}

	private stopLeftoverRecordingServicesForForceStart = async (): Promise<boolean> => {
		try {
			await this.stopRecordingServices("force_override_release")
		} catch (error) {
			logger.error({
				eventKey: "force_override_release_stop_failed",
				errorKind: "unknown",
				error,
				message: "强制发起前停止旧录音服务失败",
			})
		}
		return !this.mediaRecorderService.getStatus().isRecording
	}

	/**
	 * 完成录音
	 */
	completeRecording = async ({
		onSuccess,
		onError,
		workspace,
		topic,
		project,
		model_id,
		note,
		asr_stream_content,
		skipSummary = false,
	}: {
		onSuccess: (
			res: GetRecordingSummaryResultResponse & {
				model_id: string
				workspace_id: string
				project_name: string
				/** Post-finish merge/summary phase from finish-recording API (skipSummary path) */
				current_phase?: string
				phase_status?: string
			},
		) => void
		onError: (error: Error) => void
		workspace: Workspace | null
		topic: Topic | null
		project: ProjectListItem | null
		model_id: string
		note?: {
			content: string
			file_extension: string
		}
		asr_stream_content?: string
		skipSummary?: boolean
	}) => {
		logger.report(skipSummary ? "完成录音，等待手动总结" : "完成录音，开始生成总结")

		// Show starting message only when summary will run automatically.
		if (!skipSummary) {
			this.summaryMessageService.showStageMessage(SummaryStage.Starting)
		}

		// 如果正在等待总结，则不进行总结
		if (recordSummaryStore.isWaitingSummarize) {
			this.summaryMessageService.destroy()
			return
		}

		// 检查组织一致性
		const currentSession = this.sessionManager.getCurrentSession()
		const currentOrganizationCode = userStore.user.organizationCode || ""
		const sessionOrganizationCode = currentSession?.organizationCode || ""

		// 如果组织不一致，重置录制并提示用户
		if (
			currentSession &&
			sessionOrganizationCode &&
			currentOrganizationCode &&
			sessionOrganizationCode !== currentOrganizationCode
		) {
			logger.warn(
				`Organization mismatch detected. Session org: ${sessionOrganizationCode}, Current org: ${currentOrganizationCode}`,
			)

			// 重置录制（不清理持久化数据）
			await this.resetRecordingWithoutPersistence()

			// 获取组织名称用于提示
			const sessionOrganizationName =
				currentSession.organizationName || sessionOrganizationCode
			const currentOrganization = userStore.user.getOrganization()
			const currentOrganizationName =
				currentOrganization?.organization_name || currentOrganizationCode

			// 提示用户切换到对应组织
			this.summaryMessageService.destroy()
			const organizationError = new Error(
				`Organization mismatch: Recording was started in organization "${sessionOrganizationName}" but current organization is "${currentOrganizationName}"`,
			)
			MagicModal.warning({
				title: i18n.t("recordingSummary.organizationMismatch.title", { ns: "super" }),
				content: i18n.t("recordingSummary.organizationMismatch.content", {
					ns: "super",
					sessionOrganizationName,
					currentOrganizationName,
				}),
				okText: i18n.t("button.confirm", { ns: "interface" }),
				cancelText: i18n.t("button.cancel", { ns: "interface" }),
				onOk: () => {
					onError(organizationError)
				},
			})

			onError(organizationError)
			return
		}

		if (!skipSummary) {
			recordSummaryStore.showWaitingSummarize()
		}

		const handleError = (error: Error) =>
			handleRecordingCompletionFailure({
				error,
				isCurrentSession: () =>
					Boolean(currentSession) &&
					this.sessionManager.getCurrentSession()?.id === currentSession?.id,
				clearSummaryMessage: () => this.summaryMessageService.destroy(),
				terminateSession: () =>
					this.handleTaskEnd(currentSession?.id || "", ERROR_CODES.PROJECT_NOT_FOUND),
				pauseSession: async () => {
					recordSummaryStore.hideWaitingSummarize()
					await this.pauseRecording()
				},
				onError,
			})

		// 停止录音服务
		this.summaryMessageService.showStageMessage(SummaryStage.StoppingRecording)
		await this.stopRecordingServices("finish_recording")

		const sessionId = this.sessionManager.getCurrentSession()?.id || ""
		const sessionForProjectLogic = {
			workspace: workspace,
			project: project,
			topic: topic,
			id: sessionId,
		} as RecordingSession

		let finalProject: ProjectListItem | null = null
		let finalTopic: Topic | null = null

		try {
			this.summaryMessageService.showStageMessage(SummaryStage.ProcessingProject)
			const ensured = await this.ensureProjectAndTopic(sessionForProjectLogic)
			finalProject = ensured.project
			finalTopic = ensured.topic
		} catch (err) {
			logger.error({
				eventKey: "process_project_failed",
				errorKind: "unknown",
				error: err,
				message: "处理项目和话题失败",
			})
			this.summaryMessageService.showError(
				i18n.t("recordingSummary.message.missingRequiredParams", { ns: "super" }),
			)
			await handleError(err as Error)
			return
		}

		if (!finalProject || !finalTopic) {
			const error = new Error("projectId, topic_id is required")
			this.summaryMessageService.showError(
				i18n.t("recordingSummary.message.missingRequiredParams", { ns: "super" }),
			)
			await handleError(error)
			return
		}

		try {
			if (sessionId) {
				logger.log("等待所有分片上传完成")
				this.startUploadQueueWatchdog(sessionId, finalTopic.id, finalProject.id)
				this.summaryMessageService.showStageMessage(SummaryStage.UploadingChunks)

				// 触发上传会话分片
				await this.chunkUploader.uploadSession(sessionId, finalTopic.id, finalProject.id)

				await this.ensureSessionUploadComplete(
					{ id: sessionId, topic: finalTopic, project: finalProject } as RecordingSession,
					{
						topicId: finalTopic.id,
						projectId: finalProject.id,
						allowUserDecision: true,
					},
				)
				logger.report("所有分片上传完成")
			}
		} catch (err) {
			logger.error({
				eventKey: "chunk_upload_completion_wait_failed",
				errorKind: "unknown",
				error: err,
				message: `${sessionId} 等待所有分片上传完成失败`,
			})
			this.summaryMessageService.showError(
				i18n.t("recordingSummary.message.uploadChunksPreparingError", { ns: "super" }),
			)
			await handleError(err as Error)
			return
		}

		// 等待分片都上传完之后，才停止上报
		if (sessionId && model_id) {
			// 20251205：改为后端判断 summary 接口调用则认为停止

			// this.statusReporter.reportStatus({
			// 	task_key: sessionId,
			// 	status: RecordingSummaryStatus.Stopped,
			// 	model_id: model_id,
			// 	note: note,
			// 	asr_stream_content: asr_stream_content || this.getLatestAsrContent(),
			// })

			// 停止定期上报
			this.statusReporter.stopPeriodicReport()
		}

		const modelId = model_id
		const taskKey = sessionId

		// 如果在项目内，则需要获取队列列表
		const shouldFetchQueueList =
			Boolean(sessionForProjectLogic.workspace?.id) &&
			Boolean(sessionForProjectLogic.project?.id)

		if (!taskKey || !finalProject || !finalTopic || !modelId) {
			const error = new Error(
				"projectId, topic_id, modelId is required, projectId: " +
					finalProject?.id +
					", topicId: " +
					finalTopic?.id +
					", modelId: " +
					modelId,
			)
			logger.error({
				eventKey: "recording_summary_parameters_missing",
				errorKind: "invalid_state",
				error: error,
				message: "Missing required parameters for summary",
			})
			this.summaryMessageService.showError(
				i18n.t("recordingSummary.message.missingRequiredParams", { ns: "super" }),
			)
			onError(error)
			return
		}

		// Manual-summary mode: finish upload/merge only; list card shows Generate Summary CTA.
		if (skipSummary) {
			let finishRecordingResponse: FinishRecordingTaskResponse
			try {
				finishRecordingResponse = await this.finishRecordedTaskAfterUpload({
					taskKey,
					project: finalProject,
					topic: finalTopic,
					asrStreamContent: asr_stream_content || "",
					fileShardCount: this.sessionManager.getCurrentSession()?.currentChunkIndex,
				})
			} catch (err) {
				logger.error({
					eventKey: "finish_recording_task_failed",
					errorKind: "unknown",
					error: err,
					message: "finish recording task failed",
				})
				this.summaryMessageService.showError(
					i18n.t("recordingSummary.message.summaryGenerationFailed", { ns: "super" }),
				)
				await handleError(err as Error)
				return
			}

			this.summaryMessageService.destroy()

			this.emit(RECORD_SUMMARY_EVENTS.UPDATE_EMPTY_WORKSPACE_PANEL_PROJECTS, {
				topicId: finalTopic.id,
				projectId: finalProject.id,
				workspaceId: workspace?.id || "",
			})

			onSuccess({
				success: true,
				task_key: taskKey,
				project_id: finalProject.id,
				topic_id: finalTopic.id,
				project_name: finalProject.project_name,
				project_mode: finalProject.project_mode,
				chat_topic_id: finalTopic.id,
				conversation_id: "",
				workspace_name: workspace?.name || "",
				model_id: modelId,
				workspace_id: workspace?.id || "",
				current_phase: finishRecordingResponse.phase,
				phase_status: finishRecordingResponse.status,
			})

			this.cleanupAfterSessionComplete()
			recordSummaryStore.hideWaitingSummarize()
			recordSummaryStore.completeRecording()

			if (shouldFetchQueueList) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				this.emit(RECORD_SUMMARY_EVENTS.RECORDING_COMPLETE, {} as any)
			}
			return
		}

		try {
			// Get model from store or find by model_id
			const model = recordSummaryStore.businessData.model || this.findModelById(model_id)

			const currentChunkIndex = this.sessionManager.getCurrentSession()?.currentChunkIndex
			const sessionForSummary = {
				id: taskKey,
				model: model,
				textContent: recordSummaryStore.message,
				...(currentChunkIndex !== undefined ? { currentChunkIndex } : {}),
			} as RecordingSession

			// Migrate storage images to project images if asr_stream_content exists
			if (note?.content) {
				try {
					// this.summaryMessageService.showStageMessage(SummaryStage.MigratingImages)
					logger.log("Starting storage image migration for asr_stream_content")
					note.content = await imageMigrationService.migrateStorageImagesToProject(
						note?.content,
						finalProject?.id,
						// 虚构一个文档路径
						"/docs/recordSummary.md",
					)
					logger.log("Storage image migration completed")
				} catch (migrationError) {
					logger.error({
						eventKey: "recording_storage_image_migration_failed",
						errorKind: "storage",
						error: migrationError,
						message: "Failed to migrate storage images, using original content",
					})
				}
			}

			this.summaryMessageService.showStageMessage(SummaryStage.Completing)
			const res = await this.processSummaryForSession(
				sessionForSummary,
				finalProject?.id,
				finalTopic?.id,
				{
					note,
					asr_stream_content,
				},
			)

			// 销毁总结消息
			this.summaryMessageService.destroy()

			this.emit(RECORD_SUMMARY_EVENTS.UPDATE_EMPTY_WORKSPACE_PANEL_PROJECTS, {
				topicId: finalTopic?.id,
				projectId: finalProject?.id,
				workspaceId: workspace?.id || "",
			})

			onSuccess({
				...res,
				project_mode: res.project_mode ?? finalProject?.project_mode,
				model_id: modelId,
				workspace_id: workspace?.id || "",
			})
		} catch (err) {
			logger.error({
				eventKey: "get_recording_summary_result_failed",
				errorKind: "unknown",
				error: err,
				message: "get recording summary result failed",
			})
			this.summaryMessageService.showError(
				i18n.t("recordingSummary.message.summaryGenerationFailed", { ns: "super" }),
			)
			await handleError(err as Error)
			return
		}

		// 清理会话状态（总结成功后）
		this.cleanupAfterSessionComplete()

		recordSummaryStore.hideWaitingSummarize()

		// 更新UI状态
		recordSummaryStore.completeRecording()

		this.recordingPersistence.deleteSession(sessionId)

		// 更新队列列表
		if (shouldFetchQueueList) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			this.emit(RECORD_SUMMARY_EVENTS.RECORDING_COMPLETE, {} as any)
		}
	}

	/**
	 * 完成录音并总结
	 */
	completeRecordingWithSummary = ({
		onSuccess,
		onError,
		skipSummary,
	}: {
		onSuccess: (
			res: GetRecordingSummaryResultResponse & {
				model_id: string
				workspace_id: string
			},
		) => void
		onError: (error: Error) => void
		skipSummary?: boolean
	}) => {
		// Workspace may be null for All / Ungrouped audio recordings; project + topic are enough.
		if (
			!recordSummaryStore.businessData.topic ||
			!recordSummaryStore.businessData.project ||
			!recordSummaryStore.businessData.model
		) {
			onError(new Error("topic, project, model is required"))
			return
		}

		// 将录音总结流式内容限制在 8000 字符以内
		const asrStreamContent = recordSummaryStore.message.reduce((acc, curr) => {
			const currentText = curr?.text ?? ""
			if (acc.length + currentText.length <= 10000) {
				return acc + currentText
			}
			return acc
		}, "")

		this.completeRecording({
			onSuccess,
			onError,
			workspace: recordSummaryStore.businessData.workspace,
			topic: recordSummaryStore.businessData.topic,
			project: recordSummaryStore.businessData.project,
			model_id: recordSummaryStore.businessData.model.model_id,
			note: recordSummaryStore.note,
			asr_stream_content: asrStreamContent,
			skipSummary,
		})
	}

	uploadFileWithSummary = async ({
		fileResult,
		workspaceId,
		topicId,
		projectId,
		model,
		onSuccess,
		onError,
	}: {
		fileResult: ReportFileUploadsResponse
		workspaceId: string
		topicId: string
		projectId: string
		model: ModelItem
		onSuccess: (
			res: GetRecordingSummaryResultResponse & {
				model_id: string
				workspace_id: string
				project_name: string
			},
		) => void
		onError: (error: Error) => void
	}) => {
		if (!workspaceId || !model) {
			onError(new Error("workspaceId, model is required"))
			return
		}

		if (!projectId || !model) {
			onError(new Error("projectId, chatTopicId, model is required"))
			return
		}
		try {
			const saveRes = await superMagicUploadTokenService.saveFileToProject({
				project_id: projectId,
				file_key: fileResult.file_key,
				file_name: fileResult.file_name,
				file_size: fileResult.file_size,
				file_type: "user_upload",
				storage_type: "workspace",
				source: UploadSource.Home,
			})

			if (!saveRes) {
				onError(new Error("save file to project failed"))
				return
			}

			const sessionForSummary = {
				id: "file-upload-" + Date.now(),
				model: model,
				textContent: [],
			} as unknown as RecordingSession

			const res = await this.processSummaryForSession(sessionForSummary, projectId, topicId, {
				file_id: saveRes.file_id,
			})

			logger.log("get recording summary result success", res)

			this.emit(RECORD_SUMMARY_EVENTS.UPDATE_EMPTY_WORKSPACE_PANEL_PROJECTS, {
				topicId: topicId,
				projectId: projectId,
				workspaceId: workspaceId,
			})

			onSuccess({
				...res,
				workspace_id: workspaceId,
				model_id: model.model_id,
			})
		} catch (err) {
			logger.error({
				eventKey: "get_recording_summary_result_failed",
				errorKind: "unknown",
				error: err,
				message: "get recording summary result failed",
			})
			onError(err as Error)
		}

		// 更新队列列表
		this.emit(RECORD_SUMMARY_EVENTS.RECORDING_COMPLETE, {} as any)
	}

	/**
	 * 完成目标录音会话
	 * @param session 要完成的录音会话
	 * @returns Promise<GetRecordingSummaryResultResponse & { model_id: string; workspace_id: string; project_name: string }>
	 */
	async completeTargetRecordingSession(session: RecordingSession): Promise<
		GetRecordingSummaryResultResponse & {
			model_id: string
			workspace_id: string
			project_name: string
		}
	> {
		// 参数验证
		if (!session) {
			throw new Error("录音会话不能为空")
		}

		// Workspace can be null when the recording started from All / Ungrouped.
		if (!session.model) {
			throw new Error("会话中缺少必需的 model")
		}

		logger.log("开始完成目标录音会话", {
			sessionId: session.id,
			workspace: session.workspace,
			project: session.project,
			topic: session.topic,
			modelId: session.model?.model_id,
			status: session.status,
		})

		try {
			// 1. 检查会话状态，如果是当前活跃会话且正在录音，需要先停止录音
			const isCurrentSession = this.sessionManager.getCurrentSession()?.id === session.id
			const needsRecordingStop = isCurrentSession && session.status === "recording"

			if (needsRecordingStop) {
				logger.log("目标会话是当前活跃的录音会话，先停止录音")
				await this.stopRecordingServices("complete_existing_session")
			}

			// 2. 处理项目和话题创建逻辑，先确保上传分片能 batch-save 到后端
			const { project: finalProject, topic: finalTopic } =
				await this.ensureProjectAndTopic(session)

			// 3. 等待分片上传完成和一致性检查
			this.startUploadQueueWatchdog(session.id, finalTopic.id, finalProject.id)
			await this.chunkUploader.uploadSession(session.id, finalTopic.id, finalProject.id)
			await this.ensureSessionUploadComplete(session, {
				topicId: finalTopic.id,
				projectId: finalProject.id,
				allowUserDecision: true,
			})

			// 4. 调用总结API
			const result = await this.processSummaryForSession(
				session,
				finalProject?.id,
				finalTopic?.id,
			)

			// 5. 清理会话状态（如果是当前活跃会话）
			if (isCurrentSession) {
				this.cleanupAfterSessionComplete()
			}

			// 6. 删除持久化的会话数据
			this.recordingPersistence.deleteSession(session.id)
			this.batchSaveReporter.clearSession(session.id)

			// 7. 触发完成事件
			this.emit(RECORD_SUMMARY_EVENTS.UPDATE_EMPTY_WORKSPACE_PANEL_PROJECTS, {
				topicId: finalTopic?.id,
				projectId: finalProject?.id,
				workspaceId: session.workspace?.id || "",
			})

			this.emit(RECORD_SUMMARY_EVENTS.RECORDING_COMPLETE, { session })

			logger.log("目标录音会话完成成功", {
				sessionId: session.id,
				responseId: (result as any).task_id,
			})

			return {
				...result,
				model_id: session.model?.model_id || "",
				workspace_id: session.workspace?.id || "",
				project_name: session.project?.project_name || "",
			}
		} catch (error) {
			logger.error({
				eventKey: "recording_session_complete_failed",
				errorKind: "unknown",
				error: error,
				message: "目标录音会话完成失败",
				context: { sessionId: session.id },
			})
			throw error
		}
	}

	/**
	 * 下载录音文件
	 */
	downloadRecording({ task_key }: { task_key: string }) {
		return SuperMagicApi.downloadRecording({ task_key })
	}

	/**
	 * 重置录音（不清理持久化数据）
	 * Reset recording without clearing persisted data
	 */
	private resetRecordingWithoutPersistence = async () => {
		this.stopUploadQueueWatchdog()
		// 停止语音服务
		if (this.voiceToTextService) {
			await this.voiceToTextService.stopRecording()
			// 完全清理音频资源，包括音频流
			this.voiceToTextService.disconnect()
		}

		// 停止语音超时检测
		this.voiceTimeoutChecker.stop()

		// 停止静音检测（会自动关闭静音提示）
		this.silenceDetector.stop()

		// Stop media recorder
		if (this.mediaRecorderService) {
			await this.mediaRecorderService.stopRecording({
				source: "reset_without_persistence",
			})
		}

		// Stop duration tracking and UI updates
		this.durationTracker.reset()
		this.stopDurationUpdateTimer()

		// Release wake lock
		await this.wakeLockManager.releaseWakeLock()
		this.wakeLockManager.removeVisibilityChangeListener()

		// 移除页面刷新拦截
		this.removeBeforeUnloadListener()

		// Cancel current session
		this.sessionManager.cancelSession()

		// Reset media recorder service
		this.mediaRecorderService.reset()

		// 注意：不清理持久化数据
		// Note: Do not clear persistence data

		// 停止状态上报
		this.statusReporter.stopPeriodicReport()

		// 重置状态
		this.isDurationLimitExceeded = false

		// 释放录音权限
		this.tabCoordinator.releaseLock({ type: "reset" })

		// 更新UI状态
		recordSummaryStore.reset()

		logger.log("Recording reset without persistence")
	}

	/**
	 * 重置录音
	 */
	reset = async () => {
		const currentSessionId = this.sessionManager.getCurrentSession()?.id

		// 停止分片生产监控
		this.stopChunkProductionWatchdog()
		this.stopUploadQueueWatchdog()

		// 停止语音服务
		if (this.voiceToTextService) {
			await this.voiceToTextService.stopRecording()
			// 完全清理音频资源，包括音频流
			this.voiceToTextService.disconnect()
		}

		// 停止语音超时检测
		this.voiceTimeoutChecker.stop()

		// 停止静音检测（会自动关闭静音提示）
		this.silenceDetector.stop()

		// Stop media recorder
		if (this.mediaRecorderService) {
			await this.mediaRecorderService.stopRecording({ source: "reset" })
		}

		// Stop duration tracking
		this.durationTracker.reset()
		this.stopDurationUpdateTimer()

		// Release wake lock
		await this.wakeLockManager.releaseWakeLock()
		this.wakeLockManager.removeVisibilityChangeListener()

		// 移除页面刷新拦截
		this.removeBeforeUnloadListener()

		// Cancel current session
		this.sessionManager.cancelSession()

		// Reset media recorder service
		this.mediaRecorderService.reset()

		// Clear persistence data
		this.recordingPersistence.clearAll()

		// 停止状态上报
		this.statusReporter.stopPeriodicReport()

		// 重置状态
		this.isDurationLimitExceeded = false

		// 释放录音权限
		this.tabCoordinator.releaseLock({ type: "reset" })

		// 更新UI状态
		recordSummaryStore.reset()
		if (currentSessionId) {
			this.batchSaveReporter.clearSession(currentSessionId)
		}

		logger.log("Recording reset")
	}

	/**
	 * 处理语音识别结果
	 */
	private handleVoiceResult = (params: VoiceResultParams) => {
		const { result } = params
		// Ignore final packets that arrive after the user has disabled realtime transcription.
		if (recordSummaryStore.businessData.transcriptionEnabled === false) return

		// 记录语音结果并重置超时检测
		this.voiceTimeoutChecker.recordVoiceResult()

		// 如果当前有语音错误状态，自动清除
		if (recordSummaryStore.errorState.hasVoiceError) {
			logger.log("接收到语音识别结果，自动清除语音错误状态")
			recordSummaryStore.setVoiceError(false)
		}

		// 如果显示静音提示，关闭它（因为接收到语音识别结果说明有声音）
		this.silenceDetector.clearMessage()

		const voiceMessage = recordSummaryStore.updateMessage(result)
		// 同步更新会话文本并节流持久化
		this.sessionManager.updateSessionText(voiceMessage)
		void this.persistSessionIfNeeded()

		// 更新转文本文件（节流）
		this.contentFileManager.updateTranscript(voiceMessage)

		// 广播录音数据到其他 tab
		this.broadcastRecordingData()
	}

	/**
	 * 处理语音识别超时
	 */
	private handleVoiceTimeout = () => {
		// 检查是否正在录音
		if (!recordSummaryStore.isRecording) {
			return
		}

		// 检查是否静音
		if (this.silenceDetector.isSilent()) {
			logger.log("语音识别服务超时，但检测到静音状态，不设置错误状态")
			// 静音提示已在实时检测中显示，不需要设置错误状态
			return
		}

		// logger.warn("语音识别服务超时，自动设置错误状态")
		// 自动设置语音错误状态
		// recordSummaryStore.setVoiceError(true)
	}

	/**
	 * 处理数据可用事件
	 */
	private handleDataAvailable = (
		storedChunk: StoredAudioChunk,
		chunkIndex: number,
		indexdbSaveSuccess: boolean,
	) => {
		logger.log("Audio chunk persistence result received", {
			sessionId: storedChunk.sessionId,
			chunkId: storedChunk.id,
			chunkIndex,
			size: storedChunk.size,
			uploadStatus: storedChunk.uploadStatus,
			indexdbSaveSuccess,
		})

		// 标记已收到第一个分片，清除生产监控
		if (!this.hasReceivedFirstChunk) {
			this.hasReceivedFirstChunk = true
			this.stopChunkProductionWatchdog()
			// 如果之前触发了分片异常提示，收到数据后清除
			if (recordSummaryStore.errorState.hasChunkError) {
				recordSummaryStore.setChunkError(false)
				magicToast.destroy("recording-chunk-production-failed")
			}
		}

		// 触发上传检查
		const currentSession = this.sessionManager.getCurrentSession()
		if (currentSession) {
			// 更新会话分片索引
			this.sessionManager.updateSessionChunkIndex(chunkIndex + 1) // +1 because MediaRecorder increments after emitting
			this.handleAudioChunkSaved(storedChunk, indexdbSaveSuccess)
		}
	}

	/**
	 * 启动分片生产监控
	 * 录音启动后如果一段时间内没有收到音频分片：
	 * 1. 第一次超时：尝试自动重启 MediaRecorder 进行恢复
	 * 2. 恢复后仍无分片：通过录音面板常驻错误条提示用户
	 */
	private startChunkProductionWatchdog(sessionId: string) {
		this.hasReceivedFirstChunk = false
		this.hasAttemptedChunkRecovery = false
		this.stopChunkProductionWatchdog()

		// 20s 超时 (chunkDuration 10s 的 2 倍)
		const WATCHDOG_TIMEOUT_MS = 20000
		this.chunkProductionWatchdog = setTimeout(() => {
			this.handleChunkProductionTimeout(sessionId, WATCHDOG_TIMEOUT_MS)
		}, WATCHDOG_TIMEOUT_MS)
	}

	/**
	 * 处理分片生产超时
	 */
	private async handleChunkProductionTimeout(sessionId: string, timeoutMs: number) {
		if (this.hasReceivedFirstChunk) return

		const currentSession = this.sessionManager.getCurrentSession()
		if (!currentSession || currentSession.id !== sessionId) return

		if (!this.hasAttemptedChunkRecovery) {
			// 第一次超时：尝试自动恢复
			this.hasAttemptedChunkRecovery = true
			logger.warn("分片生产监控：首次超时，尝试自动重启录音器", {
				sessionId,
				timeoutMs,
			})

			try {
				// 停止并重启 MediaRecorder，保留同一 session
				await this.mediaRecorderService.stopRecording({
					source: "chunk_production_watchdog_recovery",
				})
				this.mediaRecorderService.reset()
				await this.mediaRecorderService.startRecording(sessionId, 0)
				this.syncProcessingMode()

				logger.log("分片生产监控：录音器已重启，等待分片产出")

				// 重启后再等 20s 观察
				this.chunkProductionWatchdog = setTimeout(() => {
					this.handleChunkProductionTimeout(sessionId, timeoutMs)
				}, timeoutMs)
			} catch (error) {
				logger.error({
					eventKey: "chunk_recording_failed",
					errorKind: "unknown",
					error: error,
					message: "分片生产监控：自动重启录音器失败",
				})
				this.notifyUserChunkProductionFailed()
			}
		} else {
			// 恢复尝试后仍无分片，通知用户
			logger.error({
				eventKey: "restored_recording_chunk_production_failed",
				errorKind: "unknown",
				message: "分片生产监控：自动恢复失败，录音器无法正常产出分片",
				context: { sessionId },
			})
			this.notifyUserChunkProductionFailed()
		}
	}

	/**
	 * 通知用户录音分片生产异常（常驻 toast，不自动消失，带停止按钮）
	 */
	private notifyUserChunkProductionFailed() {
		recordSummaryStore.setChunkError(true)
		magicToast.warning({
			content: (
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<span>
						{i18n.t("recordingSummary.chunkProduction.failed", { ns: "super" })}
					</span>
					<button
						type="button"
						onClick={() => {
							magicToast.destroy("recording-chunk-production-failed")
							this.cancelRecording({
								notifyServer: true,
								source: "chunk_production_watchdog",
							})
						}}
						style={{
							flexShrink: 0,
							padding: "2px 8px",
							fontSize: 12,
							borderRadius: 4,
							border: "1px solid currentColor",
							background: "transparent",
							color: "inherit",
							cursor: "pointer",
							whiteSpace: "nowrap",
						}}
					>
						{i18n.t("recordingSummary.actions.stopRecording", { ns: "super" })}
					</button>
				</div>
			),
			duration: 0,
			key: "recording-chunk-production-failed",
		})
	}

	/**
	 * 停止分片生产监控
	 */
	private stopChunkProductionWatchdog() {
		if (this.chunkProductionWatchdog) {
			clearTimeout(this.chunkProductionWatchdog)
			this.chunkProductionWatchdog = null
		}
	}

	private startUploadQueueWatchdog(sessionId: string, topicId: string, projectId: string) {
		this.uploadRetryContext = { sessionId, topicId, projectId }
		this.summaryMessageService.setUploadRetryHandler(this.retryStuckChunkUploads)
		this.uploadQueueWatchdog?.stop()
		this.uploadQueueWatchdog = new UploadQueueWatchdog({
			inspect: () => this.chunkUploader.inspectQueueHealth(sessionId),
			resume: () => {
				const ctx = this.uploadRetryContext
				if (!ctx) return Promise.resolve()
				return this.chunkUploader.resumeStalledSessionUploads(
					ctx.sessionId,
					ctx.topicId,
					ctx.projectId,
					{ force: true },
				)
			},
			onRecovered: (health) => {
				logger.report("Upload queue watchdog recovered stalled uploads", {
					sessionId,
					...health,
				})
			},
			onError: (error) => {
				logger.error({
					eventKey: "upload_queue_watchdog_failed",
					errorKind: "unknown",
					error,
					message: "Upload queue watchdog check failed",
					context: { sessionId },
				})
			},
		})
		this.uploadQueueWatchdog.start()
	}

	private stopUploadQueueWatchdog() {
		this.uploadQueueWatchdog?.stop()
		this.uploadQueueWatchdog = null
		this.uploadRetryContext = null
		this.summaryMessageService.setUploadRetryHandler(null)
	}

	private retryStuckChunkUploads = async () => {
		const ctx = this.uploadRetryContext
		if (!ctx || this.uploadRetryInFlight) return

		this.uploadRetryInFlight = true
		try {
			const health = await this.chunkUploader.inspectQueueHealth(ctx.sessionId)
			logger.report("User retried audio chunk uploads", {
				sessionId: ctx.sessionId,
				...health,
			})
			await this.chunkUploader.resumeStalledSessionUploads(
				ctx.sessionId,
				ctx.topicId,
				ctx.projectId,
				{ force: true },
			)
			const progress = await this.chunkUploader.getSessionUploadProgress(ctx.sessionId)
			this.summaryMessageService.updateProgress(this.formatUploadProgress(progress))
		} catch (error) {
			logger.error({
				eventKey: "resume_stalled_chunk_upload_failed",
				errorKind: "unknown",
				error,
				message: "Failed to resume stalled chunk uploads",
				context: { sessionId: ctx.sessionId },
			})
		} finally {
			this.uploadRetryInFlight = false
		}
	}

	/**
	 * 处理音频源回退事件
	 */
	private handleAudioSourceFallback = (
		requestedSource: AudioSourceType,
		fallbackSource: AudioSourceType,
		reason: string,
	) => {
		logger.log("音频源回退事件", { requestedSource, fallbackSource, reason })
		const currentSession = this.sessionManager.getCurrentSession()
		if (currentSession) {
			currentSession.audioSource = {
				source: fallbackSource,
			}
			this.recordingPersistence.saveSession(currentSession)
			recordSummaryStore.setAudioSource({ source: fallbackSource })

			const sourceLabel = i18n.t(`recordSummary:audioSource.${fallbackSource}.label`)
			magicToast.warning(
				i18n.t("recordSummary:audioSource.fallback", { source: sourceLabel }),
			)
		}
	}

	/**
	 * 处理媒体录制服务不支持事件
	 */
	private handleMediaRecorderNotSupported = () => {
		recordSummaryStore.setMediaRecorderNotSupportedError()
	}

	/**
	 * 处理语音识别服务错误
	 * 语音识别错误不应该干扰录制服务，只在UI上显示错误和重试选项
	 */
	private handleVoiceError = (error: Error) => {
		logger.error({
			eventKey: "speech_recognition_service_failed",
			errorKind: "unknown",
			error: error,
			message: "语音识别服务错误",
		})

		// 获取重试信息
		const retryInfo = this.voiceToTextService.getRetryInfo()

		// 如果已经超过最大重试次数，显示重试按钮供用户手动重试
		if (retryInfo.hasExceededRetries) {
			logger.error({
				eventKey: "speech_recognition_retry_exhausted",
				errorKind: "unknown",
				message: "语音识别重试已经超过最大重试次数，用户可以手动重试",
			})
			// UI 会显示重试按钮，用户可以点击调用 retryVoiceToTextService 方法
		}

		// 更新UI错误状态，但不中断录制
		recordSummaryStore.setVoiceError(true)
	}

	/**
	 * 处理语音识别服务状态变化
	 */
	private handleConnect = () => {
		if (recordSummaryStore.errorState.hasVoiceError) {
			recordSummaryStore.setVoiceError(false)
		}
	}

	/**
	 * 处理媒体录制服务错误
	 * 媒体录制错误需要重置整个录制服务状态
	 */
	private handleMediaRecorderError = (error: Error) => {
		const activeSession = this.sessionManager.getCurrentSession()
		logger.error({
			eventKey: "media_recorder_service_failed",
			errorKind: "unknown",
			error: error,
			message: "Media recorder service error",
			context: {
				sessionId: activeSession?.id,
				status: activeSession?.status,
				chunkIndex: activeSession?.currentChunkIndex,
				totalDuration: activeSession?.totalDuration,
			},
		})

		// 设置录制错误状态
		recordSummaryStore.setRecordingError(error)

		// Release wake lock immediately on error to prevent resource waste
		this.wakeLockManager.releaseWakeLock()
		this.wakeLockManager.removeVisibilityChangeListener()

		// 执行完整的取消录音流程，但不等待上传完成（因为是错误情况）
		this.cancelRecording({ notifyServer: false, source: "media_recorder_error" })
			.then((cancelledSession) => {
				if (cancelledSession) {
					this.emit(RECORD_SUMMARY_EVENTS.RECORDING_ERROR, { session: cancelledSession })
				}
			})
			.catch((cancelError) => {
				logger.error({
					eventKey: "cancel_recording_after_media_recorder_failed",
					errorKind: "unknown",
					error: cancelError,
					message: "Failed to cancel recording after media recorder error",
				})
			})
	}

	/**
	 * 处理状态上报错误
	 * 状态上报错误不应该影响录制流程，仅记录日志
	 */
	private handleStatusReportError = async (error: Error, sessionId: string) => {
		logger.error({
			eventKey: "status_report_failed",
			errorKind: "unknown",
			error: error,
			message: "状态上报失败",
		})
		// Silent failure - does not affect recording functionality
		// Check if error is task end error
		if (isTaskEndError(error)) {
			if (sessionId) await this.handleTaskEnd(sessionId, getBusinessErrorCode(error))
		}
	}

	/**
	 * 处理内容文件上传成功
	 */
	private handleContentFileUploadSuccess = (
		fileType: string,
		_fileId: string,
		filePath: string,
	) => {
		logger.log(`Content file uploaded successfully: ${fileType}, path: ${filePath}`)
	}

	/**
	 * 处理内容文件上传错误
	 * 内容文件上传错误不应该影响录制流程，仅记录日志
	 */
	private handleContentFileUploadError = (fileType: string, error: Error) => {
		logger.error({
			eventKey: "content_file_upload_failed",
			errorKind: "unknown",
			error: error,
			message: `Content file upload failed: ${fileType}`,
		})
		// Silent failure - does not affect recording functionality
	}

	/**
	 * 获取最新的 ASR 内容（限制在10000字符内）
	 */
	private getLatestAsrContent(): string {
		return recordSummaryStore.message.reduce((acc, curr) => {
			const currentText = curr?.text ?? ""
			if (acc.length + currentText.length <= 10000) {
				return acc + currentText
			}
			return acc
		}, "")
	}

	/**
	 * 重试已经被取消的录音会话
	 */
	public resetCancelledRecordingSession(session: RecordingSession) {
		this.reset()

		// 更新会话状态
		session.status = "recording"
		// 保存会话
		this.recordingPersistence.saveSession(session)

		// 尝试恢复之前的会话
		this.tryRestorePreviousSession()
	}

	/**
	 * 手动重试语音识别服务（供UI调用）
	 */
	retryVoiceToTextService = async () => {
		try {
			recordSummaryStore.setRetryingState(true)

			// 使用 VoiceToTextService 的手动重试方法
			await this.voiceToTextService.retry()
			recordSummaryStore.clearVoiceError()
		} catch (error) {
			logger.error({
				eventKey: "retry_speech_recognition_service_failed",
				errorKind: "unknown",
				error: error,
				message: "手动重试语音识别服务失败",
			})
			recordSummaryStore.setVoiceError(true)
		} finally {
			recordSummaryStore.setRetryingState(false)
		}
	}

	/**
	 * Start UI update timer (not for duration calculation, only for UI updates)
	 * Duration calculation is handled by DurationTracker using AudioContext.currentTime
	 * 启动 UI 更新定时器（不用于时长计算，仅用于 UI 更新）
	 * 时长计算由 DurationTracker 使用 AudioContext.currentTime 处理
	 */
	private startDurationUpdateTimer() {
		if (this.durationUpdateTimer) {
			clearInterval(this.durationUpdateTimer)
		}

		this.isDurationLimitExceeded = false

		this.durationUpdateTimer = setInterval(() => {
			if (!recordSummaryStore.isRecording) {
				this.stopDurationUpdateTimer()
				return
			}

			// Get current duration from DurationTracker (AudioContext-based)
			const currentDuration = this.durationTracker.getCurrentDuration()

			// Check duration limit
			if (!this.isDurationLimitExceeded && currentDuration >= MAX_RECORDING_DURATION_MS) {
				this.handleRecordingDurationExceeded()
				return
			}

			// Update session duration (for persistence)
			this.sessionManager.updateSessionDuration(currentDuration)

			// Update UI only if duration changed (prevent redundant updates)
			if (this.durationTracker.hasChanged()) {
				const formattedDuration = this.durationTracker.getFormattedDuration()
				recordSummaryStore.updateDuration(formattedDuration)
				this.broadcastRecordingData()
			}

			// Throttled persistence
			void this.persistSessionIfNeeded()
		}, 1000) // Update UI every second
	}

	/**
	 * Stop UI update timer
	 * 停止 UI 更新定时器
	 */
	private stopDurationUpdateTimer() {
		if (this.durationUpdateTimer) {
			clearInterval(this.durationUpdateTimer)
			this.durationUpdateTimer = null
		}
	}

	/**
	 * Handle recording duration exceeded limit
	 * 处理录音时长超出限制
	 */
	private async handleRecordingDurationExceeded() {
		if (this.isDurationLimitExceeded) return

		this.isDurationLimitExceeded = true

		const currentDuration = this.durationTracker.getCurrentDuration()
		logger.warn("Recording duration exceeded limit, auto cancelling session", {
			duration: currentDuration,
			formatted: formatDuration(currentDuration),
			limit: MAX_RECORDING_DURATION_MS,
		})

		const cancelledSession: RecordingSession | null = this.sessionManager.getCurrentSession()
		try {
			this.completeRecordingWithSummary({
				onSuccess: () => {
					if (cancelledSession) {
						this.emit(RECORD_SUMMARY_EVENTS.RECORDING_DURATION_EXCEEDED, {
							session: cancelledSession,
						})
					}
				},
				onError: (error) => {
					logger.error({
						eventKey: "complete_recording_duration_limit_exceeded",
						errorKind: "timeout",
						error: error,
						message: "Failed to complete recording after duration limit exceeded",
						context: { cancelledSession },
					})
				},
			})
		} catch (error) {
			logger.error({
				eventKey: "cancel_recording_duration_limit_exceeded",
				errorKind: "timeout",
				error: error,
				message: "Failed to cancel recording after duration limit exceeded",
			})
		} finally {
			this.isDurationLimitExceeded = false
		}
	}

	/**
	 * 手动连接语音服务
	 */
	connect = async () => {
		await this.voiceToTextService.connect()
		logger.log("Voice service connected manually")
	}

	/**
	 * 手动断开语音服务
	 */
	disconnect = () => {
		if (this.voiceToTextService) {
			this.voiceToTextService.disconnect()
		}
		logger.log("Voice service disconnected manually")
	}

	/**
	 * 检查当前会话的 chunkIndex 一致性（供外部调用）
	 * Check chunkIndex consistency for current session (for external use)
	 */
	checkChunkIndexConsistency = async (): Promise<{
		isConsistent: boolean
		actualChunkCount: number
		sessionChunkIndex: number
		fixed: boolean
	} | null> => {
		const currentSession = this.sessionManager.getCurrentSession()
		if (!currentSession) {
			logger.warn("No current session available for consistency check")
			return null
		}

		return await this.validateChunkIndexConsistency(currentSession.id)
	}

	/**
	 * 获取当前录音状态信息
	 */
	getStatus = async () => {
		const voiceStatus = this.voiceToTextService
			? {
					isRecording: this.voiceToTextService.getIsRecording(),
					isConnected: this.voiceToTextService.getIsConnected(),
					status: this.voiceToTextService.getStatus(),
					recordingId: this.voiceToTextService.getCurrentRecordingId(),
				}
			: {
					isRecording: false,
					isConnected: false,
					status: "idle" as const,
					recordingId: null,
				}

		const sessionSummary = this.sessionManager.getSessionSummary()
		const mediaRecorderStatus = this.mediaRecorderService.getStatus()
		const uploadStatus = await this.chunkUploader.getQueueStatus(
			sessionSummary?.id || undefined,
		)
		const wakeLockStatus = this.wakeLockManager.getStatus()

		// Get chunk consistency information if there's a current session
		let chunkConsistency = null
		if (sessionSummary?.id) {
			try {
				chunkConsistency = await this.validateChunkIndexConsistency(sessionSummary.id)
			} catch (error) {
				logger.error({
					eventKey: "get_chunk_consistency_failed",
					errorKind: "unknown",
					error: error,
					message: "Failed to get chunk consistency in getStatus",
				})
			}
		}

		return {
			...voiceStatus,
			session: sessionSummary,
			mediaRecorder: mediaRecorderStatus,
			upload: {
				queue: uploadStatus,
			},
			wakeLock: wakeLockStatus,
			retryInfo: this.voiceToTextService.getRetryInfo(),
			chunkConsistency: chunkConsistency,
			durationTracker: this.durationTracker.getStatus(),
		}
	}

	/**
	 * 清理资源
	 */
	destroy = async () => {
		const currentSessionId = this.sessionManager.getCurrentSession()?.id

		// 停止所有录音相关操作
		if (this.voiceToTextService) {
			await this.voiceToTextService.stopRecording()
			this.voiceToTextService.disconnect()
		}

		// Stop duration tracking
		this.durationTracker.reset()
		this.stopDurationUpdateTimer()

		// 停止静音检测（会自动关闭静音提示）
		this.silenceDetector.stop()

		// Clean up wake lock manager
		this.wakeLockManager.dispose()

		// 移除页面刷新拦截
		this.removeBeforeUnloadListener()

		// Save current session state before destroying
		this.saveFinalSessionState()

		// Reset components
		this.mediaRecorderService.dispose()

		this.sessionManager.clearSession()
		this.stopUploadQueueWatchdog()
		this.chunkUploader.pauseAll()

		// Cleanup tab coordinator
		this.tabCoordinator.cleanup()

		// 清理状态上报器
		this.statusReporter.dispose()

		// 清理内容文件管理器（上传待处理的更新）
		await this.contentFileManager.dispose()
		if (currentSessionId) {
			this.batchSaveReporter.clearSession(currentSessionId)
		}

		// 清理语音超时检测器
		this.voiceTimeoutChecker.dispose()

		// 清理用户登出监听器
		if (this.userLogoutReactionDisposer) {
			this.userLogoutReactionDisposer()
			this.userLogoutReactionDisposer = undefined
		}

		logger.log("RecordSummaryService 销毁")
	}

	/**
	 * 验证 chunkIndex 数据一致性
	 * Validate chunkIndex data consistency between session and actual chunks
	 */
	private validateChunkIndexConsistency = async (
		sessionId: string,
	): Promise<{
		isConsistent: boolean
		actualChunkCount: number
		sessionChunkIndex: number
		fixed: boolean
	}> => {
		try {
			// 获取会话分片
			const sessionChunks = await this.mediaRecorderService.getSessionChunks(sessionId)

			// 获取会话
			const session = this.sessionManager.getCurrentSession()

			if (!session) {
				return {
					isConsistent: false,
					actualChunkCount: sessionChunks.length,
					sessionChunkIndex: 0,
					fixed: false,
				}
			}

			// 实际分片数量
			const actualChunkCount = sessionChunks.length
			// 会话分片索引
			const sessionChunkIndex = session.currentChunkIndex || 0
			// 是否一致
			const isConsistent = actualChunkCount === sessionChunkIndex

			if (!isConsistent) {
				logger.warn(`${sessionId} 分片索引不一致`, {
					sessionId: sessionId,
					actualChunkCount: actualChunkCount,
					sessionChunkIndex: sessionChunkIndex,
					difference: actualChunkCount - sessionChunkIndex,
				})

				// 自动修复: 使用实际分片数量作为正确的索引
				this.sessionManager.updateSessionChunkIndex(actualChunkCount)
				await this.persistSessionIfNeeded(true) // 强制持久化

				return {
					isConsistent: false,
					actualChunkCount: actualChunkCount,
					sessionChunkIndex: sessionChunkIndex,
					fixed: true,
				}
			}

			return {
				isConsistent: true,
				actualChunkCount: actualChunkCount,
				sessionChunkIndex: sessionChunkIndex,
				fixed: false,
			}
		} catch (error) {
			logger.error({
				eventKey: "validate_chunk_index_failed",
				errorKind: "unknown",
				error: error,
				message: `${sessionId} 验证分片索引一致性失败`,
			})
			return {
				isConsistent: false,
				actualChunkCount: 0,
				sessionChunkIndex: 0,
				fixed: false,
			}
		}
	}

	/**
	 * 尝试恢复之前的会话
	 * Try to restore previous session
	 */
	tryRestorePreviousSession = async () => {
		if (shouldSkipRecordingSessionRestoreOnCurrentRoute()) {
			logger.log("Skip record summary restore on share route")
			return
		}

		// Prevent concurrent restoration attempts
		if (this.isRestoringSession) {
			logger.log("Session restoration already in progress, skipping duplicate call")
			return
		}

		this.isRestoringSession = true
		console.log("尝试恢复之前的会话")

		try {
			// 是否有可恢复的数据
			const hasRecoverableData = this.recordingPersistence.hasRecoverableData()
			if (!hasRecoverableData) {
				recordSummaryStore.reset()
				logger.log("没有可恢复的会话")
				return
			}

			const restorationData = await this.recordingPersistence.getRestorationData()
			if (!restorationData.currentSession) {
				logger.log("没有当前会话需要恢复")
				return
			}

			const session = restorationData.currentSession
			const currentUserId = userStore.user.userInfo?.user_id

			// 验证用户身份：如果会话的用户ID与当前用户ID不匹配，忽略该会话
			if (session.userId && currentUserId && session.userId !== currentUserId) {
				logger.log("会话用户与当前用户不匹配，忽略恢复", {
					sessionUserId: session.userId,
					currentUserId,
				})
				// 重置 UI 状态，但不清除持久化数据
				recordSummaryStore.reset()
				return
			}

			// 如果会话没有 userId（旧数据），也忽略不恢复
			if (!session.userId) {
				logger.log("会话缺少用户标识，忽略恢复")
				recordSummaryStore.reset()
				return
			}

			// 用户匹配，继续恢复会话
			if (this.sessionManager.shouldRestoreSession(session)) {
				// 如果会话是录音状态，先尝试获取锁（后台恢复使用低优先级，可被用户操作抢占）
				if (session.status !== "init") {
					const hasPermission = await this.tabCoordinator.requestLock(
						session.id,
						LOCK_PRIORITY_BACKGROUND,
					)
					if (!hasPermission) {
						// 恢复为非录音状态，允许用户手动请求权限
						this.restoreAsInactiveSession(session)
						return
					}
				}

				const restored = this.sessionManager.restoreSession(session)
				console.log("需要恢复的会话", restored)

				if (restored) {
					// 验证和修复分片索引一致性
					// PS: 暂时关闭分片索引一致性验证和修复，导致分片索引被重置，而出现问题
					//
					// const consistencyResult = await this.validateChunkIndexConsistency(session.id)
					// if (consistencyResult.fixed) {
					// 	logger.warn("分片索引一致性修复", {
					// 		sessionId: session.id,
					// 		previousIndex: consistencyResult.sessionChunkIndex,
					// 		correctedIndex: consistencyResult.actualChunkCount,
					// 	})
					// }

					console.log("恢复之前的会话", session)

					// 恢复UI状态基于会话状态
					recordSummaryStore.restoreUIState(session)

					// 如果会话是录音状态且我们有权限，则恢复录音
					if (
						session.status === "recording" &&
						this.tabCoordinator.hasRecordingPermission()
					) {
						await this.resumeRecording(session)
					}
				}
			}
		} catch (error) {
			logger.error({
				eventKey: "restore_previous_session_failed",
				errorKind: "unknown",
				error: error,
				message: "恢复之前的会话失败",
			})
		} finally {
			this.isRestoringSession = false
		}
	}

	/**
	 * Save final session state before destroying
	 * 保存最终会话状态（销毁前）
	 */
	private saveFinalSessionState = async () => {
		try {
			const currentSession = this.sessionManager.getCurrentSession()
			if (currentSession) {
				// Update session with final state
				this.sessionManager.updateSessionText(recordSummaryStore.message)

				// Get current duration from DurationTracker
				const finalDuration = this.durationTracker.getCurrentDuration()
				this.sessionManager.updateSessionDuration(finalDuration)

				// Save to persistence
				this.recordingPersistence.saveSession(currentSession)
				logger.log("Final session state saved", {
					duration: finalDuration,
					formatted: formatDuration(finalDuration),
				})
			}
		} catch (error) {
			logger.error({
				eventKey: "save_final_session_state_failed",
				errorKind: "unknown",
				error: error,
				message: "Failed to save final session state",
			})
		}
	}
	/**
	 * 处理音频分片已保存事件（替代原来的分片合并）
	 */
	private handleAudioChunkSaved = (
		storedChunk: StoredAudioChunk,
		indexdbSaveSuccess: boolean,
	) => {
		// 更新会话状态
		this.sessionManager.updateSessionStatus("recording")

		// 触发周期性持久化
		void this.persistSessionIfNeeded()

		// 如果保存成功，则触发上传检查
		if (indexdbSaveSuccess) {
			this.triggerPeriodicUpload()
		} else {
			// Keep the fallback chunk registered in the workspace even when local persistence fails.
			this.chunkUploader.uploadChunkAndSave(storedChunk).catch(() => undefined)
		}
	}

	/**
	 * 定期触发上传检查
	 */
	private triggerPeriodicUpload = () => {
		const currentSession = this.sessionManager.getCurrentSession()
		if (!currentSession) return

		// Trigger upload for current session
		this.chunkUploader
			.uploadSession(
				currentSession.id,
				currentSession.topic?.id || "",
				currentSession.project?.id || "",
			)
			.catch((error) => {
				logger.error({
					eventKey: "trigger_session_upload_failed",
					errorKind: "unknown",
					error: error,
					message: "Failed to trigger session upload",
				})
			})
	}

	/**
	 * 节流持久化当前会话
	 */
	private persistSessionIfNeeded = async (force: boolean = false) => {
		try {
			const now = Date.now()
			if (!force && now - this.lastPersistTime < PERSIST_INTERVAL_MS) return

			const currentSession = this.sessionManager.getCurrentSession()
			if (!currentSession) return

			this.recordingPersistence.saveSession(currentSession)
			this.lastPersistTime = now
			logger.log("Session state persisted")
		} catch (error) {
			logger.error({
				eventKey: "persist_session_state_failed",
				errorKind: "storage",
				error: error,
				message: "Failed to persist session state",
			})
		}
	}

	/**
	 * 页面刷新拦截处理函数
	 */
	private handleBeforeUnload = (event: BeforeUnloadEvent) => {
		console.log("handleBeforeUnload")
		// 只有在正在录制时才拦截
		if (recordSummaryStore.isRecording) {
			// 获取当前录制时长用于提示
			const duration = recordSummaryStore.duration || "00:00"
			const message = i18n.t("super:recordingSummary.pageRefresh.confirmMessage", {
				duration,
			})

			event.preventDefault()
			event.returnValue = message // 标准做法
			return message // 兼容某些浏览器
		}
	}

	private handleUnload = (event: BeforeUnloadEvent) => {
		console.log("handleUnload")
		// 只有在正在录制时才拦截
		if (recordSummaryStore.isRecording) {
			event.preventDefault()

			this.mediaRecorderService.dispose()
		}
	}

	/**
	 * 添加页面刷新拦截
	 */
	private addBeforeUnloadListener() {
		if (typeof window !== "undefined" && !this.isBeforeUnloadListenerAdded) {
			window.addEventListener("beforeunload", this.handleBeforeUnload)
			window.addEventListener("unload", this.handleUnload)
			this.isBeforeUnloadListenerAdded = true
			logger.log("Page refresh interception enabled")
		}
	}

	/**
	 * 移除页面刷新拦截
	 */
	private removeBeforeUnloadListener() {
		if (typeof window !== "undefined" && this.isBeforeUnloadListenerAdded) {
			window.removeEventListener("beforeunload", this.handleBeforeUnload)
			window.removeEventListener("unload", this.handleUnload)
			this.isBeforeUnloadListenerAdded = false
			logger.log("Page refresh interception disabled")
		}
	}

	/**
	 * 处理上传进度事件
	 */
	private handleUploadProgress = (taskId: string, progress: number) => {
		logger.log("Upload progress", { taskId, progress })
		// TODO: Update UI with upload progress
	}

	/**
	 * 处理上传成功事件
	 */
	private handleUploadSuccess = (taskId: string, url: string) => {
		logger.log("Upload successful", {
			taskId,
			hasUploadPath: Boolean(url),
			isAbsoluteUrl: /^https?:\/\//i.test(url),
		})

		// Update session activity
		this.sessionManager.updateSessionStatus("recording")

		// TODO: Save successful upload to persistence
		// TODO: Update UI with success status
	}

	/**
	 * 处理上传错误事件
	 */
	private handleUploadError = (taskId: string, error: Error) => {
		logger.report({
			namespace: "recordingUpload",
			data: {
				event: "callback_failed",
				taskId,
				errorName: error.name,
			},
		})

		// TODO: Update UI with error status
		// TODO: Save failed upload for retry
	}

	/**
	 * 处理上传重试事件
	 */
	private handleUploadRetry = (taskId: string, retryCount: number) => {
		logger.log("Upload retry", { taskId, retryCount })

		// TODO: Update UI with retry status
	}

	/**
	 * Handle network offline event
	 * 处理网络离线事件
	 */
	private handleNetworkOffline = (sessionId: string, pendingChunksCount: number) => {
		logger.warn("Network offline detected during recording", {
			sessionId,
			pendingChunksCount,
		})

		// Show notification to user
		magicToast.warning({
			content: i18n.t("recordingSummary.network.offline_notification", {
				ns: "super",
			}),
			duration: 5000,
			key: "recording-network-offline",
		})
	}

	/**
	 * Handle network online event
	 * 处理网络恢复在线事件
	 */
	private handleNetworkOnline = (sessionId: string, pendingChunksCount: number) => {
		logger.report("Network restored, resuming uploads", {
			sessionId,
			pendingChunksCount,
		})

		// Show notification to user with pending chunks count
		magicToast.success({
			content: i18n.t("recordingSummary.network.online_notification", {
				count: pendingChunksCount,
				ns: "super",
			}),
			duration: 3000,
			key: "recording-network-online",
		})
	}

	/**
	 * Handle max retries reached event
	 * 处理达到最大重试次数事件
	 */
	private handleMaxRetriesReached = (chunkId: string, retryCount: number) => {
		logger.error({
			eventKey: "chunk_upload_max_retries_failed",
			errorKind: "unknown",
			message: "Chunk upload failed after max retries",
			context: { chunkId, retryCount },
		})

		// Show error notification to user
		magicToast.error({
			content: i18n.t("recordingSummary.network.max_retries_reached", {
				ns: "super",
			}),
			duration: 8000,
			key: "recording-max-retries",
		})
	}

	/**
	 * Handle server-side task termination events.
	 * 处理服务端结束任务事件。
	 * 服务端状态已经结束，只需要强制停止本地的录制相关实例
	 */
	private handleTaskEnd = (sessionId: string, errorCode?: number | string): Promise<void> => {
		const pending = this.handlingTaskEndSessions.get(sessionId)
		if (pending) return pending
		// Token, batch-save, and status errors can arrive together. Every caller awaits one cleanup.
		const cleanup = Promise.resolve()
			.then(() => this.cleanupEndedSession(sessionId, errorCode))
			.finally(() => this.handlingTaskEndSessions.delete(sessionId))
		this.handlingTaskEndSessions.set(sessionId, cleanup)
		return cleanup
	}

	private cleanupEndedSession = async (sessionId: string, errorCode?: number | string) => {
		const currentSession = this.sessionManager.getCurrentSession()
		// Never stop a different recording session because of a stale event.
		if (!currentSession || currentSession.id !== sessionId) {
			logger.log(`任务结束事件针对的会话 ${sessionId} 不是当前活跃会话，忽略`)
			return
		}

		const numericErrorCode =
			typeof errorCode === "string" && errorCode.trim() === "" ? undefined : Number(errorCode)
		const normalizedErrorCode = Number.isFinite(numericErrorCode) ? numericErrorCode : undefined
		const terminationSource =
			normalizedErrorCode === ERROR_CODES.TASK_IS_SUMMARIZING
				? "server_auto_summary"
				: "server_task_ended"

		let sessionPreserved = false
		await runTaskEndCleanup({
			stopRecordingServices: () => this.stopRecordingServices("task_end"),
			stopSessionUploads: () => this.chunkUploader.stopSessionUploads(sessionId, "task_end"),
			stopStatusReporter: () => {
				this.stopChunkProductionWatchdog()
				this.stopUploadQueueWatchdog()
				this.statusReporter.stopPeriodicReport()
				this.batchSaveReporter.clearSession(sessionId)
			},
			stopRecordStatusChecker: () => this.recordStatusChecker.stop(),
			releaseWakeLock: () => this.wakeLockManager.releaseWakeLock(),
			removeVisibilityChangeListener: () =>
				this.wakeLockManager.removeVisibilityChangeListener(),
			removeBeforeUnloadListener: () => this.removeBeforeUnloadListener(),
			releaseRecordingLock: () =>
				this.tabCoordinator.releaseLock({
					type: "finish",
					data: {
						message: [],
						duration: "00:00:00",
						isRecording: false,
						sessionId,
					},
				}),
			preserveSession: async () => {
				if (this.sessionManager.getCurrentSession()?.id !== sessionId) return
				const cancelledSession = this.sessionManager.markServerCancelledSession(
					normalizedErrorCode,
					terminationSource,
				)
				if (!cancelledSession) return

				try {
					this.recordingPersistence.saveSession(cancelledSession)
					sessionPreserved = true
				} catch (error) {
					// Keep IndexedDB history/chunks, but never restore stale active metadata.
					this.recordingPersistence.deleteSession(sessionId)
					throw error
				}
				const queueStatus = await this.chunkUploader.getQueueStatus(sessionId)
				logger.report("服务端自动总结后保留本地录音数据", {
					sessionId,
					errorCode: normalizedErrorCode,
					status: cancelledSession.status,
					queueStatus,
					chunkIndex: cancelledSession.currentChunkIndex,
				})
			},
			resetStore: () => {
				const activeSession = this.sessionManager.getCurrentSession()
				if (!activeSession || activeSession.id === sessionId) recordSummaryStore.reset()
			},
			reportError: (stage, error) => {
				logger.error({
					eventKey: "task_end_cleanup_failed",
					errorKind: "unknown",
					error,
					message: `任务结束清理阶段失败：${stage}`,
					context: { sessionId, errorCode: normalizedErrorCode },
				})
			},
		})

		if (normalizedErrorCode === ERROR_CODES.PROJECT_NOT_FOUND) {
			magicToast.warning({
				key: `recording-project-missing-${sessionId}`,
				content: sessionPreserved
					? i18n.t("recordingSummary.projectDeletion.projectMissing", { ns: "super" })
					: i18n.t("recordingSummary.projectDeletion.projectMissingSaveFailed", {
							ns: "super",
						}),
			})
		}
		logger.log("任务结束，本地录制实例已停止", { sessionId, sessionPreserved })
	}
	// ==== Wake Lock 相关处理方法 ====

	/**
	 * 处理 wake lock 被释放的情况
	 */
	private handleWakeLockRelease = () => {
		logger.warn("Wake lock was released by system or user action")

		// If recording is still active, try to re-acquire wake lock
		if (recordSummaryStore.isRecording && this.tabCoordinator.hasRecordingPermission()) {
			logger.log("Attempting to re-acquire wake lock after system release")

			// Use setTimeout to avoid blocking the event handler
			setTimeout(async () => {
				try {
					const reacquired = await this.wakeLockManager.reacquireIfNeeded()
					if (reacquired) {
						logger.log("Successfully re-acquired wake lock")
					} else {
						logger.warn("Failed to re-acquire wake lock, recording may be affected")
						// Could potentially show a notification to user about potential recording interruption
					}
				} catch (error) {
					logger.error({
						eventKey: "re_acquire_wake_lock_failed",
						errorKind: "unknown",
						error: error,
						message: "Error while trying to re-acquire wake lock",
					})
				}
			}, 100)
		}
	}

	// ==== Tab 协调相关处理方法 ====

	/**
	 * 处理 tab 状态变化
	 */
	private handleTabStatusChange = (status: TabStatus) => {
		recordSummaryStore.updateTabStatus(status)
	}

	/**
	 * 处理录音数据同步（从其他 tab）
	 */

	private handleRecordingDataSync = (data: RecordingDataSyncData) => {
		recordSummaryStore.syncActiveTabData(data)

		// 如果其他 tab 正在录音, 且当前 tab 也在录音, 则开始检查录音状态
		if (
			data.isRecording &&
			recordSummaryStore.isRecording &&
			!this.recordStatusChecker.isRunning
		) {
			this.recordStatusChecker.start()
		}
	}

	/**
	 * 处理释放录音权限
	 */
	private handleLockReleased = (data?: {
		type: TabLockReleaseType
		data?: RecordingDataSyncData
	}) => {
		// 权限释放时的处理逻辑
		if (data && data.data) {
			recordSummaryStore.syncActiveTabData(data.data)
		}
	}

	/**
	 * 广播录音数据到其他 tab
	 */
	private broadcastRecordingData() {
		if (this.tabCoordinator.hasRecordingPermission()) {
			const syncData: RecordingDataSyncData = {
				message: toJS(recordSummaryStore.message),
				duration: recordSummaryStore.duration,
				isRecording: recordSummaryStore.status !== "init",
				sessionId: this.sessionManager.getCurrentSession()?.id,
			}
			this.tabCoordinator.broadcastRecordingData(syncData)
		}
	}

	/**
	 * 恢复为非活跃会话（当无法获得录音权限时）
	 */
	private restoreAsInactiveSession(session: {
		id: string
		textContent?: (VoiceResultUtterance & { add_time: number; id: string })[]
		totalDuration?: number
	}) {
		try {
			// 更新UI store，显示已有的录音数据
			recordSummaryStore.setMessage(session.textContent || [])
			if (session.totalDuration && session.totalDuration > 0) {
				const formattedDuration = formatDuration(session.totalDuration)
				recordSummaryStore.updateDuration(formattedDuration)
			}

			// 通过同步活跃tab数据来显示当前正在录音的信息
			recordSummaryStore.syncActiveTabData({
				message: session.textContent || [],
				duration: formatDuration(session.totalDuration || 0),
				isRecording: true, // 假设其他tab正在录音
				sessionId: session.id,
			})
		} catch (error) {
			logger.error({
				eventKey: "restore_session_as_inactive_failed",
				errorKind: "unknown",
				error: error,
				message: "Failed to restore session as inactive",
			})
		}
	}

	getMediaRecorderStream = () => {
		return this.mediaRecorderService.getMediaRecorderStream()
	}

	/**
	 * 用户选择「放弃录音」时调用：清除持久化数据并重置 UI，无需持有锁。
	 */
	discardHistoricalSession = () => {
		logger.report("用户放弃历史录音会话")
		this.recordingPersistence.clearAll()
		this.sessionManager.clearSession()
		recordSummaryStore.reset()
	}

	/**
	 * 用户选择「总结录音」时调用：加载历史会话并直接生成总结，不恢复录音。
	 * 将 session 数据填入 store 后复用 completeRecordingWithSummary 完整路径。
	 */
	finishHistoricalSession = async () => {
		if (this.isRestoringSession) {
			logger.log("Session restoration already in progress, skipping finishHistoricalSession")
			return
		}

		this.isRestoringSession = true

		try {
			const hasRecoverableData = this.recordingPersistence.hasRecoverableData()
			if (!hasRecoverableData) {
				logger.log("finishHistoricalSession: no recoverable data")
				return
			}

			const restorationData = await this.recordingPersistence.getRestorationData()
			const session = restorationData.currentSession
			if (!session) {
				logger.log("finishHistoricalSession: no session found")
				return
			}
			if (session.status === "server_cancelled") {
				logger.log("finishHistoricalSession: server-cancelled sessions are export-only", {
					sessionId: session.id,
				})
				return
			}

			const currentUserId = userStore.user.userInfo?.user_id
			if (session.userId && currentUserId && session.userId !== currentUserId) {
				logger.warn("finishHistoricalSession: user mismatch, ignoring", {
					sessionUserId: session.userId,
					currentUserId,
				})
				return
			}

			// Null workspace is valid for ungrouped recordings; only model is required here.
			if (!session.model) {
				logger.warn("finishHistoricalSession: session missing model")
				return
			}

			logger.report("总结历史录音会话", {
				sessionId: session.id,
				duration: session.totalDuration,
			})

			// 将历史 session 数据静默填入 store（不显示浮窗）
			// restoreUIState 会设置 isVisible=true，随后立即覆盖为 false
			recordSummaryStore.restoreUIState(session)
			recordSummaryStore.isVisible = false

			// 将 session 设为当前 session，让 completeRecording 能找到 sessionId
			this.sessionManager.restoreSession(session)

			// 复用完整的 completeRecordingWithSummary 路径
			this.completeRecordingWithSummary({
				onSuccess: async (res) => {
					const { onSummarizeSuccessDefaultCallback } =
						await import("@/components/business/RecordingSummary/utils/callback")
					onSummarizeSuccessDefaultCallback(res)
				},
				onError: (error) => {
					logger.error({
						eventKey: "finish_historical_session_summarize_failed",
						errorKind: "unknown",
						error: error,
						message: "finishHistoricalSession summarize failed",
					})
					recordSummaryStore.reset()
				},
			})
		} catch (error) {
			logger.error({
				eventKey: "finish_historical_session_failed",
				errorKind: "unknown",
				error: error,
				message: "finishHistoricalSession 失败",
			})
			recordSummaryStore.reset()
		} finally {
			this.isRestoringSession = false
		}
	}

	getMediaRecorderConfig = () => {
		return this.mediaRecorderService.getConfig()
	}

	updateMediaRecorderConfig = (config: Partial<MediaRecorderConfig>) => {
		this.mediaRecorderService.updateConfig(config)
	}

	private checkRecordStatus = () => {
		let shouldStopChecker = false

		if (!this.recordingPersistence.hasRecoverableData()) {
			recordSummaryStore.reset()
			shouldStopChecker = true
		}
		return shouldStopChecker
	}

	/**
	 * 启动静音检测
	 * Start silence detection
	 */
	private startSilenceDetection(): void {
		const silenceDetectionStream = this.mediaRecorderService.getMediaStream()
		if (silenceDetectionStream) {
			this.silenceDetector.start(silenceDetectionStream)
			logger.log("Silence detection started")
		} else {
			logger.warn("Failed to start silence detection: no media stream available")
		}
	}

	/**
	 * 停止录音服务
	 */
	private async stopRecordingServices(
		source: string = "service",
		options: { throwOnMediaRecorderError?: boolean } = {},
	): Promise<void> {
		const session = this.sessionManager.getCurrentSession()
		logger.log("Recording services stop requested", {
			sessionId: session?.id,
			source,
			previousStatus: session?.status,
			previousChunkIndex: session?.currentChunkIndex,
		})
		// 停止语音服务
		try {
			await this.voiceToTextService.stopRecording()
			this.voiceToTextService.disconnect()
		} catch (error) {
			logger.error({
				eventKey: "stop_speech_recognition_service_failed",
				errorKind: "unknown",
				error: error,
				message: "停止语音识别服务失败",
			})
		}

		// 停止语音超时检测
		this.voiceTimeoutChecker.stop()

		// 停止静音检测（会自动关闭静音提示）
		this.silenceDetector.stop()

		// 停止媒体录制器并请求最终分片
		try {
			this.mediaRecorderService.requestData()
			await this.mediaRecorderService.stopRecording({ source })
			this.mediaRecorderService.reset()
			logger.log("Recording services stopped", {
				sessionId: session?.id,
				source,
				sessionStatusAfterStop: this.sessionManager.getCurrentSession()?.status,
				mediaRecorderStateAfterStop:
					this.mediaRecorderService.getStatus().mediaRecorderState,
				chunkIndexAfterStop: this.sessionManager.getCurrentSession()?.currentChunkIndex,
			})
		} catch (error) {
			logger.error({
				eventKey: "stop_media_recorder_failed",
				errorKind: "unknown",
				error: error,
				message: "停止媒体录制器失败",
				context: { sessionId: session?.id, source },
			})
			if (options.throwOnMediaRecorderError) throw error
		} finally {
			// Terminal cleanup must release capture resources even when stop fails.
			if (source === "task_end") this.mediaRecorderService.reset()
			// Keep duration even when the media recorder fails to stop.
			this.durationTracker.pause()
			this.stopDurationUpdateTimer()
		}
	}

	/**
	 * 确保会话的分片上传完成
	 */
	private async ensureSessionUploadComplete(
		session: RecordingSession,
		options: EnsureUploadOptions = {},
	): Promise<void> {
		try {
			// 验证分片索引一致性并修复
			const consistencyResult = await this.validateChunkIndexConsistency(session.id)
			if (consistencyResult.fixed) {
				logger.warn(`${session.id} 分片索引一致性修复`, {
					sessionId: session.id,
					previousIndex: consistencyResult.sessionChunkIndex,
					correctedIndex: consistencyResult.actualChunkCount,
				})
			}

			// 等待所有分片上传完成
			if (session.id) {
				const topicId = options.topicId ?? session.topic?.id ?? ""
				const projectId = options.projectId ?? session.project?.id ?? ""
				this.uploadRetryContext = { sessionId: session.id, topicId, projectId }
				this.summaryMessageService.setUploadRetryHandler(this.retryStuckChunkUploads)
				let shouldWaitForUploads = true
				let stalledTimeouts = 0
				let lastUploadedCount = -1

				while (shouldWaitForUploads) {
					logger.log(`${session.id} 等待分片上传结束...`)
					// Calculate dynamic timeout based on IndexedDB pending chunks.
					// Base timeout: 30s, +10s per pending chunk (max 120s)
					const queueStatus = await this.chunkUploader.getQueueStatus(session.id)
					const pendingCount = queueStatus.pending || 0
					const dynamicTimeout = Math.min(30000 + pendingCount * 10000, 120000)
					logger.log(
						`${session.id} 剩余分片数: ${pendingCount}, 超时时间: ${dynamicTimeout}ms`,
					)

					let progress: SessionUploadProgress
					try {
						progress = await this.chunkUploader.waitForSessionUploadsSettled(
							session.id,
							dynamicTimeout,
							(uploadProgress) => {
								this.summaryMessageService.updateProgress(
									this.formatUploadProgress(uploadProgress),
								)
							},
						)
					} catch (error) {
						const isTimeout = error instanceof Error && error.message.includes("超时")
						if (!isTimeout) throw error

						const health = await this.chunkUploader.inspectQueueHealth(session.id)
						const timeoutProgress = await this.chunkUploader.getSessionUploadProgress(
							session.id,
						)
						stalledTimeouts =
							timeoutProgress.uploaded === lastUploadedCount ? stalledTimeouts + 1 : 1
						lastUploadedCount = timeoutProgress.uploaded

						logger.warn(`${session.id} 等待分片上传超时`, {
							sessionId: session.id,
							pendingCount,
							stalledTimeouts,
							uploaded: timeoutProgress.uploaded,
							queueReason: health.reason,
						})

						if (
							stalledTimeouts >= (options.maxWaitTimeouts ?? MAX_UPLOAD_WAIT_TIMEOUTS)
						) {
							throw error
						}
						if (health.stalled) {
							await this.chunkUploader.resumeStalledSessionUploads(
								session.id,
								topicId,
								projectId,
							)
						}
						continue
					}

					this.summaryMessageService.updateProgress(this.formatUploadProgress(progress))

					if (progress.failed === 0) {
						logger.log(`${session.id} 所有分片上传成功`)
						return
					}

					logger.warn(`${session.id} 存在上传失败分片`, progress)

					if (!options.allowUserDecision) {
						throw new Error(
							i18n.t("recordingSummary.message.uploadChunksPreparingError", {
								ns: "super",
							}),
						)
					}

					const decision = await this.showUploadFailureDecisionModal(progress)

					if (decision === "retry") {
						this.summaryMessageService.showStageMessage(SummaryStage.UploadingChunks)
						this.summaryMessageService.updateProgress(
							i18n.t("recordingSummary.message.retryingAudioChunks", {
								ns: "super",
							}),
						)
						await this.chunkUploader.retryFailedChunks(session.id, topicId, projectId)
						continue
					}

					this.summaryMessageService.showStageMessage(SummaryStage.UploadingChunks)
					this.summaryMessageService.updateProgress(
						i18n.t("recordingSummary.message.continuingSummaryAfterAudioCheck", {
							ns: "super",
						}),
					)
					if (progress.failed > PLACEHOLDER_UPLOAD_MAX_FAILED_CHUNKS) {
						throw new Error(
							i18n.t("recordingSummary.message.placeholderUploadTooManyFailed", {
								ns: "super",
								count: progress.failed,
								limit: PLACEHOLDER_UPLOAD_MAX_FAILED_CHUNKS,
							}),
						)
					}

					const placeholderAbortController = new AbortController()
					const placeholderProgressModal = this.showPlaceholderUploadProgressModal(
						progress.failed,
						placeholderAbortController,
					)
					try {
						await this.chunkUploader.uploadEmptyPlaceholdersForFailedChunks(
							session.id,
							topicId,
							projectId,
							{
								signal: placeholderAbortController.signal,
								onProgress: (placeholderProgress) => {
									this.summaryMessageService.updateProgress(
										this.formatPlaceholderUploadProgress(placeholderProgress),
									)
									placeholderProgressModal.update(placeholderProgress)
								},
							},
						)
					} catch (error) {
						throw new Error(
							this.getPlaceholderUploadErrorMessage(error, progress.failed),
						)
					} finally {
						placeholderProgressModal.destroy()
					}

					const finalProgress = await this.chunkUploader.getSessionUploadProgress(
						session.id,
					)
					this.summaryMessageService.updateProgress(
						this.formatUploadProgress(finalProgress),
					)

					if (!finalProgress.completed) {
						throw new Error(
							i18n.t("recordingSummary.message.uploadChunksCompletingError", {
								ns: "super",
							}),
						)
					}

					logger.warn(`${session.id} 用户选择忽略失败分片并上传空占位分片`, {
						placeholderCount: progress.failed,
					})
					shouldWaitForUploads = false
				}
			}
		} catch (error) {
			logger.error({
				eventKey: "wait_chunk_upload_complete_failed",
				errorKind: "unknown",
				error: error,
				message: `${session.id} 等待分片上传完成失败`,
			})
			throw new Error(
				`等待分片上传完成失败: ${error instanceof Error ? error.message : String(error)}`,
			)
		} finally {
			this.stopUploadQueueWatchdog()
		}
	}

	private formatUploadProgress(progress: SessionUploadProgress): string {
		const percent =
			progress.total > 0 ? Math.round((progress.uploaded / progress.total) * 100) : 100

		if (progress.failed > 0) {
			return i18n.t("recordingSummary.message.uploadProgressNeedsDecision", {
				ns: "super",
				percent,
			})
		}

		return i18n.t("recordingSummary.message.uploadProgress", {
			ns: "super",
			percent,
			pending: progress.pending,
		})
	}

	private formatPlaceholderUploadProgress(progress: PlaceholderUploadProgress): string {
		const percent =
			progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 100
		const remaining = Math.max(progress.total - progress.completed, 0)
		return i18n.t("recordingSummary.message.placeholderUploadProgress", {
			ns: "super",
			percent,
			remaining,
		})
	}

	private getPlaceholderUploadErrorMessage(error: unknown, failedCount: number): string {
		const message = error instanceof Error ? error.message : String(error)
		if (message.includes("Too many failed placeholder chunks")) {
			return i18n.t("recordingSummary.message.placeholderUploadTooManyFailed", {
				ns: "super",
				count: failedCount,
				limit: PLACEHOLDER_UPLOAD_MAX_FAILED_CHUNKS,
			})
		}
		if (message.includes("cancelled")) {
			return i18n.t("recordingSummary.message.placeholderUploadCancelled", {
				ns: "super",
			})
		}
		if (message.includes("timed out")) {
			return i18n.t("recordingSummary.message.placeholderUploadTimeout", {
				ns: "super",
			})
		}
		return message
	}

	private showPlaceholderUploadProgressModal(
		total: number,
		abortController: AbortController,
	): {
		update: (progress: PlaceholderUploadProgress) => void
		destroy: () => void
	} {
		const modalRef: { current?: ReturnType<typeof MagicModal.confirm> } = {}
		let destroyed = false
		const buildConfig = (progress: PlaceholderUploadProgress) => ({
			title: i18n.t("recordingSummary.message.placeholderUploadProgressTitle", {
				ns: "super",
			}),
			content: (
				<div className="space-y-2 text-sm text-muted-foreground">
					<div>{this.formatPlaceholderUploadProgress(progress)}</div>
				</div>
			),
			closable: false,
			maskClosable: false,
			footer: (
				<div className="flex items-center justify-end gap-2 border-t border-border bg-muted/50 p-2">
					<Button
						variant="outline"
						onClick={() => {
							abortController.abort()
							destroyed = true
							modalRef.current?.destroy()
						}}
					>
						{i18n.t("recordingSummary.message.placeholderUploadCancel", {
							ns: "super",
						})}
					</Button>
				</div>
			),
		})
		modalRef.current = MagicModal.confirm(
			buildConfig({
				total,
				completed: 0,
				failed: 0,
				active: 0,
			}),
		)

		return {
			update: (progress) => {
				if (destroyed) return
				modalRef.current?.update(buildConfig(progress))
			},
			destroy: () => {
				destroyed = true
				modalRef.current?.destroy()
			},
		}
	}

	private showUploadFailureDecisionModal(
		progress: SessionUploadProgress,
	): Promise<UploadFailureDecision> {
		this.summaryMessageService.destroy()

		return new Promise((resolve) => {
			const modalRef: { current?: ReturnType<typeof MagicModal.confirm> } = {}
			const closeWith = (decision: UploadFailureDecision) => {
				resolve(decision)
				modalRef.current?.destroy()
			}

			modalRef.current = MagicModal.confirm({
				title: i18n.t("recordingSummary.message.uploadFailureDecisionTitle", {
					ns: "super",
				}),
				content: i18n.t("recordingSummary.message.uploadFailureDecisionContent", {
					ns: "super",
					failed: progress.failed,
					total: progress.total,
				}),
				footer: (
					<div className="flex items-center justify-end gap-2 border-t border-border bg-muted/50 p-2">
						<Button variant="outline" onClick={() => closeWith("retry")}>
							{i18n.t("recordingSummary.message.retryUploadChunks", {
								ns: "super",
							})}
						</Button>
						<Button variant="destructive" onClick={() => closeWith("ignore")}>
							{i18n.t("recordingSummary.message.continueSummary", {
								ns: "super",
							})}
						</Button>
					</div>
				),
				closable: false,
				maskClosable: false,
				onCancel: () => closeWith("retry"),
			})
		})
	}

	/**
	 * 确保项目和话题存在
	 */
	public async ensureProjectAndTopic(
		session: {
			project: ProjectListItem | null
			workspace: Workspace | null
			topic?: Topic | null
		},
		options?: { workdir?: string; topicMode?: TopicMode },
	): Promise<{
		project: ProjectListItem
		workspaceId: string
		topic: Topic
	}> {
		const workspaceId = session.workspace?.id || ""

		// Create a project only when a real workspace is available; ungrouped
		// recordings must already carry a project created at start.
		if (!session.project && workspaceId) {
			analyticsService.report("project_create_attempted", {
				workspaceId,
				sceneOverride: "ai_recording",
				mode: options?.topicMode || TopicMode.RecordSummary,
			})
			const res = await SuperMagicApi.createProject({
				workspace_id: workspaceId,
				project_name: "",
				project_description: "",
				project_mode: options?.topicMode || TopicMode.RecordSummary,
				...(options?.workdir && { workdir: options.workdir }),
			})
			session.project = res.project
			session.topic = res.topic
		}
		// Topic creation only needs project_id; allow null workspace (ungrouped).
		else if (session.project && !session.topic) {
			analyticsService.report("topic_create_attempted", {
				projectId: session.project.id,
				workspaceId: session.project.workspace_id || workspaceId,
				sceneOverride: "ai_recording",
			})
			const res = await SuperMagicApi.createTopic({
				// workspace_id: workspaceId,
				project_id: session.project.id,
				topic_name: "",
				project_mode: TopicMode.RecordSummary,
			})
			session.topic = res
		}

		if (!session.project || !session.topic) {
			throw new Error(
				`项目ID或话题ID缺失, project: ${session.project}, topic: ${session.topic}`,
			)
		}

		return { project: session.project, topic: session.topic, workspaceId }
	}

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

	/**
	 * 处理会话总结
	 */
	private async processSummaryForSession(
		session: RecordingSession,
		projectId: string,
		topicId: string,
		options?: {
			note?: {
				content: string
				file_extension: string
			}
			asr_stream_content?: string
			file_id?: string
		},
	): Promise<GetRecordingSummaryResultResponse> {
		// 将会话文本内容转换为 asr_stream_content 格式
		const asrStreamContent =
			options?.asr_stream_content ||
			session.textContent?.reduce((acc, curr) => {
				if (acc.length + curr.text.length <= 10000) {
					return acc + curr.text
				}
				return acc
			}, "") ||
			""

		logger.log(`${session.id} 开始处理总结`, {
			projectId,
			topicId,
			modelId: session.model?.model_id,
			asrContentLength: asrStreamContent.length,
		})

		// 保存超级麦吉话题模型配置
		SuperMagicApi.saveSuperMagicTopicModel({
			cache_id: topicId,
			model_id: session.model?.model_id || "",
		})

		// 调用总结API
		const result = await SuperMagicApi.getRecordingSummaryResult({
			task_key: session.id,
			project_id: projectId,
			topic_id: topicId,
			model_id: session.model?.model_id || "",
			asr_stream_content: asrStreamContent,
			...(typeof session.currentChunkIndex === "number" && {
				file_shard_count: session.currentChunkIndex,
			}),
			...(options?.note && { note: options.note }),
			...(options?.file_id && { file_id: options.file_id }),
		})

		logger.log(`${session.id} 总结处理完成`, {
			responseId: (result as any).task_id,
		})

		return result
	}

	/**
	 * 清理会话完成后的状态
	 */
	private cleanupAfterSessionComplete() {
		const currentSessionId = this.sessionManager.getCurrentSession()?.id

		// 释放唤醒锁
		this.wakeLockManager.releaseWakeLock()
		this.wakeLockManager.removeVisibilityChangeListener()

		// 移除页面刷新拦截
		this.removeBeforeUnloadListener()

		// 释放录音权限
		const currentSession = this.sessionManager.getCurrentSession()
		this.tabCoordinator.releaseLock({
			type: "finish",
			data: {
				message: [],
				duration: "00:00:00",
				isRecording: false,
				sessionId: currentSession?.id || "",
			},
		})

		// 保存会话状态
		const completedSession = this.sessionManager.completeSession()
		if (completedSession) {
			this.recordingPersistence.saveSession(completedSession)
		}

		// 重置媒体录制器
		this.mediaRecorderService.reset()

		// 更新UI状态
		recordSummaryStore.completeRecording()
		if (currentSessionId) {
			this.batchSaveReporter.clearSession(currentSessionId)
		}

		logger.log("会话完成后的清理操作已完成")
	}

	/**
	 * 获取当前会话的 task_key
	 */
	public getCurrentSessionTaskKey = () => {
		const currentSession = this.sessionManager.getCurrentSession()
		if (!currentSession) {
			return ""
		}
		return currentSession.id
	}

	/**
	 * Get frequency data for visualization from shared AnalyserNode
	 * Returns a Uint8Array with frequency data (0-255 values)
	 * 从共享的 AnalyserNode 获取频率数据用于可视化
	 * 返回包含频率数据的 Uint8Array（0-255 的值）
	 */
	public getFrequencyData = (): Uint8Array | null => {
		return this.mediaRecorderService.getFrequencyData()
	}

	/**
	 * Get AnalyserNode for advanced visualization use cases
	 * 获取 AnalyserNode 用于高级可视化场景
	 */
	public getAnalyserNode = (): AnalyserNode | null => {
		return this.mediaRecorderService.getAnalyserNode()
	}
}

export { RecordSummaryService }
