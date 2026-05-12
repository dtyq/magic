import { makeAutoObservable, runInAction } from "mobx"
import { MagicClawApi, SuperMagicApi } from "@/apis"
import type { MagicClawItem } from "@/apis"
import { MAGIC_CLAW_STATUS, type MagicClawStatus } from "@/apis/modules/magicClaw"
import { createMentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import { TopicStore } from "@/pages/superMagic/stores/core/topic"
import { ProjectFilesStore } from "@/stores/projectFiles"
import type { ProjectListItem, TaskStatus, Workspace } from "../../Workspace/types"

const SANDBOX_VERSION_CHECK_POLL_INTERVAL_MS = 10 * 60 * 1000
const VALID_MAGIC_CLAW_STATUS_SET = new Set<MagicClawStatus>(Object.values(MAGIC_CLAW_STATUS))

class ClawWorkspaceStore {
	workspaces: Workspace[] = []
	selectedWorkspace: Workspace | null = null

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get firstWorkspace(): Workspace | null {
		return this.workspaces[0] || null
	}

	setWorkspaces(workspaces: Workspace[]) {
		this.workspaces = workspaces
	}

	setSelectedWorkspace(workspace: Workspace | null) {
		this.selectedWorkspace = workspace
	}

	reset() {
		this.workspaces = []
		this.selectedWorkspace = null
	}
}

class ClawProjectStore {
	projects: ProjectListItem[] = []
	selectedProject: ProjectListItem | null = null
	private projectFilesStore: ProjectFilesStore

	constructor(projectFilesStore: ProjectFilesStore) {
		this.projectFilesStore = projectFilesStore
		makeAutoObservable(this, {}, { autoBind: true })
	}

	setProjects(projects: ProjectListItem[]) {
		this.projects = projects
	}

	setSelectedProject(project: ProjectListItem | null) {
		this.selectedProject = project
		this.projectFilesStore.setSelectedProject(project)
	}

	reset() {
		this.projects = []
		this.selectedProject = null
		this.projectFilesStore.setSelectedProject(null)
	}
}

export class ClawPlaygroundRootStore {
	readonly topicStore = new TopicStore()
	readonly projectFilesStore = new ProjectFilesStore()
	readonly mentionPanelStore = createMentionPanelStore(this.projectFilesStore)
	readonly projectStore = new ClawProjectStore(this.projectFilesStore)
	readonly workspaceStore = new ClawWorkspaceStore()

	/** Resolved Magic Claw (lobster) detail for the current playground session */
	magicClaw: MagicClawItem | null = null
	currentClawCode: string | null = null
	currentProjectId: string | null = null
	loading = false
	error: string | null = null
	isConversationGenerating = false
	isUpgradingSandbox = false
	sandboxLatestVersion: string | null = null
	private sandboxVersionCheckPollTimer: ReturnType<typeof setInterval> | null = null
	/** Bumps on stop/reset so in-flight sandbox calls ignore stale results */
	private sandboxSessionId = 0
	private isSandboxStatusPolling = false
	private isSandboxVersionChecking = false

	constructor() {
		makeAutoObservable(
			this,
			{
				topicStore: false,
				projectFilesStore: false,
				mentionPanelStore: false,
				projectStore: false,
				workspaceStore: false,
			},
			{ autoBind: true },
		)
	}

	get selectedProject() {
		return this.projectStore.selectedProject
	}

	get selectedWorkspace() {
		return this.workspaceStore.selectedWorkspace
	}

	get selectedTopic() {
		return this.topicStore.selectedTopic
	}

	setConversationGenerating(isGenerating: boolean) {
		this.isConversationGenerating = isGenerating
	}

	updateTopicStatus(topicId: string, status: TaskStatus) {
		this.topicStore.updateTopicStatus(topicId, status)
	}

	setMagicClaw(magicClaw: MagicClawItem | null) {
		this.magicClaw = magicClaw
	}

	async upgradeSandbox() {
		const topicId = this.selectedTopic?.id
		const sessionId = this.sandboxSessionId
		if (!topicId || !this.magicClaw || this.isUpgradingSandbox) return false

		this.isUpgradingSandbox = true

		try {
			await MagicClawApi.upgradeMagicClawSandbox(
				{ topic_id: topicId },
				{ enableErrorMessagePrompt: false },
			)

			runInAction(() => {
				if (!this.shouldApplySandboxResult(topicId, sessionId) || !this.magicClaw) return

				this.magicClaw = {
					...this.magicClaw,
					need_upgrade: false,
				}
			})

			const [statusResult, versionResult] = await Promise.allSettled([
				MagicClawApi.getMagicClawSandboxStatus(
					{ topic_id: topicId },
					{ enableErrorMessagePrompt: false },
				),
				MagicClawApi.checkMagicClawSandboxVersion(
					{ topic_id: topicId },
					{ enableErrorMessagePrompt: false },
				),
			])

			runInAction(() => {
				if (!this.shouldApplySandboxResult(topicId, sessionId) || !this.magicClaw) return

				let nextMagicClaw = this.magicClaw

				if (statusResult.status === "fulfilled") {
					nextMagicClaw = {
						...nextMagicClaw,
						status: this.normalizeMagicClawStatus(statusResult.value?.status),
					}
				}

				if (versionResult.status === "fulfilled") {
					this.sandboxLatestVersion = versionResult.value?.latest_version ?? null
					nextMagicClaw = {
						...nextMagicClaw,
						// Version check can lag right after upgrade API succeeds
						need_upgrade: false,
					}
				}

				this.magicClaw = nextMagicClaw
			})

			return true
		} catch (error) {
			console.error("Failed to upgrade claw sandbox:", error)
			return false
		} finally {
			runInAction(() => {
				this.isUpgradingSandbox = false
			})
		}
	}

	private startSandboxPolling(topicId: string) {
		this.stopSandboxPolling()
		this.sandboxSessionId += 1
		const sessionId = this.sandboxSessionId

		void this.pollSandboxStatus({ topicId, sessionId })
		void this.pollSandboxVersion({ topicId, sessionId })

		this.sandboxVersionCheckPollTimer = setInterval(() => {
			void this.pollSandboxVersion({ topicId, sessionId })
		}, SANDBOX_VERSION_CHECK_POLL_INTERVAL_MS)
	}

	private stopSandboxPolling() {
		if (this.sandboxVersionCheckPollTimer) {
			clearInterval(this.sandboxVersionCheckPollTimer)
			this.sandboxVersionCheckPollTimer = null
		}

		this.sandboxSessionId += 1
		this.isSandboxStatusPolling = false
		this.isSandboxVersionChecking = false
	}

	private shouldApplySandboxResult(topicId: string, sessionId: number) {
		return this.selectedTopic?.id === topicId && this.sandboxSessionId === sessionId
	}

	private normalizeMagicClawStatus(status?: string): MagicClawStatus {
		if (status && VALID_MAGIC_CLAW_STATUS_SET.has(status as MagicClawStatus))
			return status as MagicClawStatus

		return MAGIC_CLAW_STATUS.UNKNOWN
	}

	private async pollSandboxStatus({
		topicId,
		sessionId,
	}: {
		topicId: string
		sessionId: number
	}) {
		if (!this.shouldApplySandboxResult(topicId, sessionId) || this.isSandboxStatusPolling)
			return

		this.isSandboxStatusPolling = true

		try {
			const data = await MagicClawApi.getMagicClawSandboxStatus(
				{ topic_id: topicId },
				{ enableErrorMessagePrompt: false },
			)
			if (!this.shouldApplySandboxResult(topicId, sessionId)) return

			const nextStatus = this.normalizeMagicClawStatus(data?.status)
			if (!this.magicClaw || this.magicClaw.status === nextStatus) return

			runInAction(() => {
				if (!this.magicClaw || !this.shouldApplySandboxResult(topicId, sessionId)) return

				this.magicClaw = {
					...this.magicClaw,
					status: nextStatus,
				}
			})
		} catch (error) {
			console.error("Failed to poll claw sandbox status:", error)
		} finally {
			if (this.sandboxSessionId === sessionId) this.isSandboxStatusPolling = false
		}
	}

	private async pollSandboxVersion({
		topicId,
		sessionId,
	}: {
		topicId: string
		sessionId: number
	}) {
		if (!this.shouldApplySandboxResult(topicId, sessionId) || this.isSandboxVersionChecking)
			return

		this.isSandboxVersionChecking = true

		try {
			const data = await MagicClawApi.checkMagicClawSandboxVersion(
				{ topic_id: topicId },
				{ enableErrorMessagePrompt: false },
			)
			if (!this.shouldApplySandboxResult(topicId, sessionId)) return

			const nextNeedUpgrade = Boolean(data?.needs_update)
			const nextLatestVersion = data?.latest_version ?? null
			const shouldSkipUpdate =
				this.magicClaw?.need_upgrade === nextNeedUpgrade &&
				this.sandboxLatestVersion === nextLatestVersion

			if (shouldSkipUpdate) return

			runInAction(() => {
				if (!this.shouldApplySandboxResult(topicId, sessionId)) return

				this.sandboxLatestVersion = nextLatestVersion

				if (!this.magicClaw) return

				this.magicClaw = {
					...this.magicClaw,
					need_upgrade: nextNeedUpgrade,
				}
			})
		} catch (error) {
			console.error("Failed to poll claw sandbox version:", error)
		} finally {
			if (this.sandboxSessionId === sessionId) this.isSandboxVersionChecking = false
		}
	}

	async init(clawCode: string) {
		if (!clawCode) return
		if (this.loading && this.currentClawCode === clawCode) return

		this.currentClawCode = clawCode
		this.currentProjectId = null
		this.loading = true
		this.error = null
		this.resetData()

		try {
			const magicClaw = await MagicClawApi.getMagicClawByCode(
				{ code: clawCode },
				{ enableErrorMessagePrompt: false },
			)
			if (!magicClaw?.project_id) {
				throw new Error("claw-project-not-found")
			}

			const projectId = magicClaw.project_id
			this.currentProjectId = projectId

			const project = await SuperMagicApi.getProjectDetail({ id: projectId })
			if (!project) {
				throw new Error("project-not-found")
			}

			const workspace = project.workspace_id
				? await SuperMagicApi.getWorkspaceDetail(
						{ id: project.workspace_id },
						{ enableErrorMessagePrompt: false },
					).catch(() => null)
				: null

			const response = await SuperMagicApi.getTopicsByProjectId({
				id: project.id,
				page: 1,
				page_size: 999,
			})

			let topics = response.list ?? []
			let selectedTopic =
				topics.find((topic) => topic.id === project.current_topic_id) ?? topics[0] ?? null

			if (!selectedTopic) {
				selectedTopic = await SuperMagicApi.createTopic({
					project_id: project.id,
					topic_name: "",
				})
				topics = selectedTopic ? [selectedTopic] : []
			}

			let mergedMagicClaw: MagicClawItem = magicClaw
			let initialSandboxLatestVersion: string | null | undefined

			if (selectedTopic) {
				const [statusResult, versionResult] = await Promise.allSettled([
					MagicClawApi.getMagicClawSandboxStatus(
						{ topic_id: selectedTopic.id },
						{ enableErrorMessagePrompt: false },
					),
					MagicClawApi.checkMagicClawSandboxVersion(
						{ topic_id: selectedTopic.id },
						{ enableErrorMessagePrompt: false },
					),
				])

				if (statusResult.status === "fulfilled") {
					mergedMagicClaw = {
						...mergedMagicClaw,
						status: this.normalizeMagicClawStatus(statusResult.value?.status),
					}
				}

				if (versionResult.status === "fulfilled") {
					initialSandboxLatestVersion = versionResult.value?.latest_version ?? null
					mergedMagicClaw = {
						...mergedMagicClaw,
						need_upgrade: Boolean(versionResult.value?.needs_update),
					}
				}
			}

			runInAction(() => {
				this.setMagicClaw(mergedMagicClaw)
				if (initialSandboxLatestVersion !== undefined) {
					this.sandboxLatestVersion = initialSandboxLatestVersion
				}
				this.projectStore.setProjects([project])
				this.projectStore.setSelectedProject(project)
				this.workspaceStore.setWorkspaces(workspace ? [workspace] : [])
				this.workspaceStore.setSelectedWorkspace(workspace)
				this.topicStore.setTopics(topics)
				this.topicStore.setSelectedTopic(selectedTopic)
				this.loading = false
			})
			if (selectedTopic) this.startSandboxPolling(selectedTopic.id)
			// Prefetch @mention skills/agents/MCP; panel stays closed so hook skips preLoad
			void this.mentionPanelStore.preLoadList()
		} catch (error) {
			console.error("Failed to initialize claw playground store:", error)
			runInAction(() => {
				this.loading = false
				this.error = "fetch-failed"
				this.resetData()
			})
		}
	}

	resetData() {
		this.stopSandboxPolling()
		this.isConversationGenerating = false
		this.isUpgradingSandbox = false
		this.magicClaw = null
		this.sandboxLatestVersion = null
		this.projectStore.reset()
		this.workspaceStore.reset()
		this.topicStore.reset()
	}

	dispose() {
		this.stopSandboxPolling()
		this.currentProjectId = null
		this.currentClawCode = null
		this.loading = false
		this.error = null
		this.resetData()
	}
}
