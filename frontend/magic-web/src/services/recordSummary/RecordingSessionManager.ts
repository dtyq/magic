import type { RecordingSession, SessionRestoreOptions } from "@/types/recordSummary"
import type { VoiceResultUtterance } from "@/components/business/VoiceInput/services/VoiceClient/types"
import {
	ProjectListItem,
	Topic,
	Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import { userStore } from "@/models/user"
import { recordingLogger } from "./utils/RecordingLogger"

const logger = recordingLogger.namespace("Session")

/**
 * Recording session manager for handling session lifecycle
 * 录制会话管理器，负责会话生命周期管理
 */
export class RecordingSessionManager {
	private currentSession: RecordingSession | null = null
	private restoreOptions: SessionRestoreOptions

	constructor(restoreOptions: SessionRestoreOptions) {
		this.restoreOptions = restoreOptions
	}

	/**
	 * Create new recording session
	 * 创建新的录制会话
	 */
	createSession({
		workspace,
		model,
		userId,
		project,
		topic,
		chatTopic,
		audioSource,
	}: {
		workspace: Workspace | null
		model: ModelItem | null
		userId: string
		project: ProjectListItem | null
		topic?: Topic | null
		chatTopic?: Topic | null
		audioSource?: import("@/types/recordSummary").AudioSourceConfig
	}): RecordingSession {
		// 获取当前组织信息
		const organizationCode = userStore.user.organizationCode || ""
		const currentOrganization = userStore.user.getOrganization()
		const organizationName = currentOrganization?.organization_name || ""

		const session: RecordingSession = {
			id: this.generateSessionId(),
			startTime: Date.now(),
			lastActivityTime: Date.now(),
			totalDuration: 0,
			status: "recording",
			textContent: [],
			currentChunkIndex: 0,
			metadata: {
				userAgent: navigator.userAgent,
				audioFormat: "webm",
				deviceInfo: this.getDeviceInfo(),
			},
			userId: userId,
			organizationCode: organizationCode,
			organizationName: organizationName,
			workspace: workspace,
			topic: topic,
			chatTopic: chatTopic ?? null,
			project: project,
			model: model,
			audioSource: audioSource,
		}

		this.currentSession = session

		// Set session ID for all subsequent logs
		logger.setSessionId(session.id)

		logger.report("创建新的录音会话", {
			userId: session.userId,
			organizationCode: session.organizationCode,
			workspaceName: workspace?.name,
			projectName: project?.project_name,
			topicId: topic?.id,
			audioSource: audioSource?.source,
		})

		return session
	}

	updateProject = (project: ProjectListItem) => {
		if (!this.currentSession) return

		this.currentSession.project = project
		this.currentSession.lastActivityTime = Date.now()

		logger.log("更新会话项目", {
			projectId: project.id,
			projectName: project.project_name,
		})

		return this.currentSession
	}

	updateTopic = (topic: Topic) => {
		if (!this.currentSession) return

		this.currentSession.topic = topic
		this.currentSession.lastActivityTime = Date.now()

		logger.log("更新会话主题", {
			topicId: topic.id,
			topicName: topic.topic_name,
		})

		return this.currentSession
	}

	updateChatTopic = (chatTopic: Topic) => {
		if (!this.currentSession) return

		this.currentSession.chatTopic = chatTopic
		this.currentSession.lastActivityTime = Date.now()
		return this.currentSession
	}

	updateWorkspace = (workspace: Workspace) => {
		if (!this.currentSession) return

		this.currentSession.workspace = workspace
		this.currentSession.lastActivityTime = Date.now()
		return this.currentSession
	}

	updateModel = (model: ModelItem | null) => {
		if (!this.currentSession) return

		this.currentSession.model = model
		this.currentSession.lastActivityTime = Date.now()
		return this.currentSession
	}

	/**
	 * Get current session
	 * 获取当前会话
	 */
	getCurrentSession(): RecordingSession | null {
		return this.currentSession
	}

	/**
	 * Update session status
	 * 更新会话状态
	 */
	updateSessionStatus(status: RecordingSession["status"]): void {
		if (!this.currentSession) return

		const previousStatus = this.currentSession.status
		this.currentSession.status = status
		this.currentSession.lastActivityTime = Date.now()

		if (previousStatus !== status) {
			logger.report("会话状态变更", {
				previousStatus,
				newStatus: status,
			})
		}
	}

	/**
	 * Update session duration
	 * 更新会话时长
	 */
	updateSessionDuration(duration: number): void {
		if (!this.currentSession) return

		this.currentSession.totalDuration = duration
		this.currentSession.lastActivityTime = Date.now()
	}

	/**
	 * Update session text content
	 * 更新会话文本内容
	 */
	updateSessionText(text: (VoiceResultUtterance & { add_time: number; id: string })[]): void {
		if (!this.currentSession) return

		this.currentSession.textContent = text ?? []
		this.currentSession.lastActivityTime = Date.now()
	}

	/**
	 * Update session chunk index
	 * 更新会话分片索引
	 */
	updateSessionChunkIndex(chunkIndex: number): void {
		if (!this.currentSession) return

		this.currentSession.currentChunkIndex = chunkIndex
		this.currentSession.lastActivityTime = Date.now()
	}

	/**
	 * Restore session from saved data
	 * 从保存的数据恢复会话
	 */
	restoreSession(session: RecordingSession): boolean {
		if (!this.validateSession(session)) {
			logger.warn("会话验证失败，无法恢复")
			return false
		}

		// Check if session is too old
		const ageInHours = (Date.now() - session.lastActivityTime) / (1000 * 60 * 60)
		if (ageInHours > 24) {
			logger.warn("会话过期，无法恢复", {
				ageInHours: ageInHours.toFixed(2),
			})
			return false
		}

		this.currentSession = {
			...session,
			lastActivityTime: Date.now(),
		}

		logger.report("恢复录音会话", {
			status: session.status,
			duration: session.totalDuration,
			chunkIndex: session.currentChunkIndex,
			textContentLength: session.textContent.length,
			ageInHours: ageInHours.toFixed(2),
		})

		return true
	}

	/**
	 * Complete current session
	 * 完成当前会话
	 */
	completeSession(): RecordingSession | null {
		if (!this.currentSession) return null

		this.currentSession.status = "init"
		this.currentSession.lastActivityTime = Date.now()

		const completedSession = { ...this.currentSession }

		logger.report("完成录音会话", {
			duration: completedSession.totalDuration,
			chunkCount: completedSession.currentChunkIndex,
			textContentLength: completedSession.textContent.length,
		})

		this.currentSession = null

		return completedSession
	}

	/**
	 * Cancel current session
	 * 取消当前会话
	 */
	cancelSession(): RecordingSession | null {
		if (!this.currentSession) return null

		this.currentSession.status = "init"
		this.currentSession.lastActivityTime = Date.now()

		const cancelledSession = { ...this.currentSession }

		logger.report("取消录音会话", {
			duration: cancelledSession.totalDuration,
			chunkCount: cancelledSession.currentChunkIndex,
		})

		this.currentSession = null

		return cancelledSession
	}

	/**
	 * Pause current session
	 * 暂停当前会话
	 */
	pauseSession(): void {
		if (!this.currentSession) return

		this.currentSession.status = "paused"
		this.currentSession.lastActivityTime = Date.now()

		logger.report("暂停录音会话", {
			duration: this.currentSession.totalDuration,
		})
	}

	/**
	 * Resume current session
	 * 恢复当前会话
	 */
	resumeSession(): void {
		if (!this.currentSession) return

		this.currentSession.status = "recording"
		this.currentSession.lastActivityTime = Date.now()

		logger.report("恢复录音会话", {
			duration: this.currentSession.totalDuration,
		})
	}

	/**
	 * Check if session is active
	 * 检查会话是否活跃
	 */
	isSessionActive(): boolean {
		return (
			this.currentSession !== null &&
			(this.currentSession.status === "recording" || this.currentSession.status === "paused")
		)
	}

	/**
	 * Check if session needs restoration
	 * 检查会话是否需要恢复
	 */
	shouldRestoreSession(session: RecordingSession): boolean {
		if (!this.restoreOptions.autoRestore) return false
		if (!this.validateSession(session)) return false

		// Check if session is in recoverable state
		return session.status === "recording" || session.status === "paused"
	}

	/**
	 * Get session summary
	 * 获取会话摘要
	 */
	getSessionSummary(): {
		id: string | null
		status: string | null
		duration: number
		textLength: number
		isActive: boolean
	} {
		if (!this.currentSession) {
			return {
				id: null,
				status: null,
				duration: 0,
				textLength: 0,
				isActive: false,
			}
		}

		return {
			id: this.currentSession.id,
			status: this.currentSession.status,
			duration: this.currentSession.totalDuration,
			textLength: this.currentSession.textContent.length,
			isActive: this.isSessionActive(),
		}
	}

	/**
	 * Clear current session
	 * 清除当前会话
	 */
	clearSession(): void {
		this.currentSession = null
	}

	/**
	 * Private: Generate unique session ID
	 * 私有方法：生成唯一会话ID
	 */
	private generateSessionId(): string {
		const timestamp = Date.now()
		const random = Math.random().toString(36).substr(2, 9)
		return `session_${timestamp}_${random}`
	}

	/**
	 * Private: Get device information
	 * 私有方法：获取设备信息
	 */
	private getDeviceInfo(): string {
		const { userAgent } = navigator
		const platform = navigator.platform || "unknown"
		return `${platform} / ${userAgent.split(" ").slice(-2).join(" ")}`
	}

	/**
	 * Private: Validate session data
	 * 私有方法：验证会话数据
	 */
	private validateSession(session: unknown): session is RecordingSession {
		if (!session || typeof session !== "object" || session === null) {
			return false
		}

		const obj = session as Record<string, unknown>
		return (
			typeof obj.id === "string" &&
			typeof obj.startTime === "number" &&
			typeof obj.lastActivityTime === "number" &&
			typeof obj.totalDuration === "number" &&
			typeof obj.status === "string" &&
			["recording", "paused", "completed", "cancelled"].includes(obj.status as string)
		)
	}
}
