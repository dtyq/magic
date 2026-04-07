import { makeAutoObservable, runInAction } from "mobx"
import { MagicClawApi, SuperMagicApi } from "@/apis"
import type { MagicClawItem } from "@/apis"
import { createMentionPanelStore } from "@/components/business/MentionPanel/store"
import { TopicStore } from "@/pages/superMagic/stores/core/topic"
import { ProjectFilesStore } from "@/stores/projectFiles"
import type { ProjectListItem, TaskStatus, Workspace } from "../../Workspace/types"

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

			runInAction(() => {
				this.magicClaw = magicClaw
				this.projectStore.setProjects([project])
				this.projectStore.setSelectedProject(project)
				this.workspaceStore.setWorkspaces(workspace ? [workspace] : [])
				this.workspaceStore.setSelectedWorkspace(workspace)
				this.topicStore.setTopics(topics)
				this.topicStore.setSelectedTopic(selectedTopic)
				this.loading = false
			})
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
		this.isConversationGenerating = false
		this.magicClaw = null
		this.projectStore.reset()
		this.workspaceStore.reset()
		this.topicStore.reset()
	}

	dispose() {
		this.currentProjectId = null
		this.currentClawCode = null
		this.loading = false
		this.error = null
		this.resetData()
	}
}
