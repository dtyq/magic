import { SuperMagicApi } from "@/apis"
import { runInAction } from "mobx"
import projectStore from "@/pages/superMagic/stores/core/project"
import workspaceStore from "@/pages/superMagic/stores/core/workspace"
import type {
	SuperAgentScopedStatusItem,
	SuperAgentTopicStatusItem,
} from "@/apis/modules/superMagic"

const DEFAULT_POLLING_INTERVAL_MS = 60000

interface TopicStatusPollingOptions {
	pollerId: string
	getTopicIds: () => string[]
	onResult: (items: SuperAgentTopicStatusItem[]) => void
}

interface TopicStatusPollingTask extends TopicStatusPollingOptions {
	intervalId: number
	isInFlight: boolean
	requestVersion: number
}

class StatusPollingService {
	private resourcePollingSubscriberCount = 0
	private resourcePollingIntervalId: number | null = null
	private resourcePollingInFlight = false
	private resourcePollingRequestVersion = 0
	private topicStatusPollingTasks = new Map<string, TopicStatusPollingTask>()
	private isPausedByVisibility = false

	constructor() {
		if (typeof document !== "undefined") {
			document.addEventListener("visibilitychange", this.handleVisibilityChange)
		}
	}

	private handleVisibilityChange = () => {
		if (document.hidden) {
			this.isPausedByVisibility = true
			this.pauseAllPolling()
		} else {
			this.isPausedByVisibility = false
			this.resumeAllPolling()
		}
	}

	private pauseAllPolling() {
		if (this.resourcePollingIntervalId !== null) {
			window.clearInterval(this.resourcePollingIntervalId)
			this.resourcePollingIntervalId = null
		}
		this.topicStatusPollingTasks.forEach((task) => {
			window.clearInterval(task.intervalId)
			task.intervalId = -1
		})
	}

	private resumeAllPolling() {
		if (this.resourcePollingSubscriberCount > 0) {
			this.startResourceStatusPolling()
		}
		this.topicStatusPollingTasks.forEach((task) => {
			if (task.intervalId === -1) {
				task.intervalId = window.setInterval(() => {
					void this.pollTopicStatusTask(task)
				}, DEFAULT_POLLING_INTERVAL_MS)
				void this.pollTopicStatusTask(task)
			}
		})
	}

	subscribeResourceStatusPolling() {
		this.resourcePollingSubscriberCount += 1
		if (this.resourcePollingSubscriberCount === 1) this.startResourceStatusPolling()

		return () => {
			this.resourcePollingSubscriberCount = Math.max(
				0,
				this.resourcePollingSubscriberCount - 1,
			)
			if (this.resourcePollingSubscriberCount === 0) this.stopResourceStatusPolling()
		}
	}

	startTopicStatusPolling(options: TopicStatusPollingOptions) {
		this.stopTopicStatusPolling(options.pollerId)
		const task: TopicStatusPollingTask = {
			...options,
			intervalId: -1,
			isInFlight: false,
			requestVersion: 0,
		}

		task.intervalId = window.setInterval(() => {
			void this.pollTopicStatusTask(task)
		}, DEFAULT_POLLING_INTERVAL_MS)

		this.topicStatusPollingTasks.set(options.pollerId, task)
		void this.pollTopicStatusTask(task)
	}

	/** 立即触发一次资源状态查询（供手动刷新按钮使用）。 */
	async refreshResourceStatus() {
		await this.pollResourceStatus()
	}

	/** 立即触发指定话题轮询任务（供手动刷新按钮使用）。 */
	async refreshTopicStatus(pollerId: string) {
		const task = this.topicStatusPollingTasks.get(pollerId)
		if (!task) return
		await this.pollTopicStatusTask(task)
	}

	stopTopicStatusPolling(pollerId: string) {
		const task = this.topicStatusPollingTasks.get(pollerId)
		if (!task) return

		window.clearInterval(task.intervalId)
		this.topicStatusPollingTasks.delete(pollerId)
	}

	private startResourceStatusPolling() {
		if (this.resourcePollingIntervalId !== null) return

		this.resourcePollingIntervalId = window.setInterval(() => {
			void this.pollResourceStatus()
		}, DEFAULT_POLLING_INTERVAL_MS)

		void this.pollResourceStatus()
	}

	private stopResourceStatusPolling() {
		if (this.resourcePollingIntervalId !== null) {
			window.clearInterval(this.resourcePollingIntervalId)
			this.resourcePollingIntervalId = null
		}
		this.resourcePollingInFlight = false
	}

	/** 收集 sidebar 已加载的工作区与项目 id，作为全局资源状态轮询范围。 */
	private getLoadedResourceIds() {
		const workspaceIds = Array.from(
			new Set(workspaceStore.workspaces.map((workspace) => workspace.id).filter(Boolean)),
		)
		const projectIds = new Set<string>()

		projectStore.projects.forEach((project) => {
			if (project.id) projectIds.add(project.id)
		})
		projectStore.projectsByWorkspace.forEach((projects) => {
			projects.forEach((project) => {
				if (project.id) projectIds.add(project.id)
			})
		})
		projectStore.receivedCollaborationProjects.forEach((project) => {
			if (project.id) projectIds.add(project.id)
		})
		if (projectStore.selectedProject?.id) {
			projectIds.add(projectStore.selectedProject.id)
		}

		return {
			workspaceIds,
			projectIds: Array.from(projectIds),
		}
	}

	/** 将资源状态响应标准化为补丁数组，兼容接口字段缺失时的兜底返回。 */
	private normalizeResourceStatusItems(items?: SuperAgentScopedStatusItem[]) {
		return Array.isArray(items) ? items : []
	}

	private async pollResourceStatus() {
		if (this.resourcePollingInFlight) return

		this.resourcePollingInFlight = true
		const requestVersion = this.resourcePollingRequestVersion + 1
		this.resourcePollingRequestVersion = requestVersion

		try {
			const { workspaceIds, projectIds } = this.getLoadedResourceIds()
			if (workspaceIds.length === 0 && projectIds.length === 0) return

			const response = await SuperMagicApi.getMyResourceStatus({
				workspace_ids: workspaceIds,
				project_ids: projectIds,
			})
			if (requestVersion !== this.resourcePollingRequestVersion) return

			runInAction(() => {
				workspaceStore.applyWorkspaceStatusPatches(
					this.normalizeResourceStatusItems(response.workspaces),
				)
				projectStore.applyProjectStatusPatches(
					this.normalizeResourceStatusItems(response.projects),
				)
			})
		} catch (error) {
			console.warn("轮询资源运行态失败:", error)
		} finally {
			if (requestVersion === this.resourcePollingRequestVersion)
				this.resourcePollingInFlight = false
		}
	}

	private async pollTopicStatusTask(task: TopicStatusPollingTask) {
		if (task.isInFlight) return

		const topicIds = Array.from(new Set(task.getTopicIds().filter(Boolean)))
		if (topicIds.length === 0) return

		task.isInFlight = true
		task.requestVersion += 1
		const requestVersion = task.requestVersion

		try {
			const response = await SuperMagicApi.getTopicsStatus({ topic_ids: topicIds })
			if (!this.topicStatusPollingTasks.has(task.pollerId)) return
			if (requestVersion !== task.requestVersion) return
			task.onResult(response.topics || response.list || [])
		} catch (error) {
			console.warn("轮询话题状态失败:", error)
		} finally {
			const activeTask = this.topicStatusPollingTasks.get(task.pollerId)
			if (activeTask && requestVersion === activeTask.requestVersion) {
				activeTask.isInFlight = false
			}
		}
	}
}

const statusPollingService = new StatusPollingService()

export default statusPollingService
