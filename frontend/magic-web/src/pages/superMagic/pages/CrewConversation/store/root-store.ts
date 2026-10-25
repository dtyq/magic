import { makeAutoObservable, runInAction } from "mobx"
import { CrewApi, SuperMagicApi } from "@/apis"
import { crewService, type AgentDetailView } from "@/services/crew/CrewService"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { createMentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import { ProjectFilesStore } from "@/stores/projectFiles"
import { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"
import { TopicStore } from "@/pages/superMagic/stores/core/topic"
import { AttachmentDataProcessor } from "@/pages/superMagic/utils/attachmentDataProcessor"
import type {
	ProjectListItem,
	TaskStatus,
	Topic,
	Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import { WorkspaceStatus } from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { analyticsService } from "@/services/analytics"

export type CrewConversationStatus =
	"idle" | "loading" | "ready" | "invalid" | "unavailable" | "error"

export interface CrewConversationBootstrapOptions {
	autoHire?: boolean
}

type WidgetAgentResolution =
	| { kind: "ready"; agent: AgentDetailView }
	| { kind: "invalid" }
	| { kind: "unavailable" }
	| { kind: "cancelled" }

interface CrewConversationHydration {
	project: ProjectListItem | null
	topics: Topic[]
	attachments: AttachmentItem[]
	attachmentList: AttachmentItem[]
}

export class CrewConversationStore {
	status: CrewConversationStatus = "idle"
	agentCode = ""
	agent: AgentDetailView | null = null
	selectedProject: ProjectListItem | null = null
	selectedWorkspace: Workspace | null = null
	error: unknown = null
	attachments: AttachmentItem[] = []
	attachmentList: AttachmentItem[] = []
	isCreatingTopic = false
	isConversationGenerating = false
	private bootstrapGeneration = 0
	private lastBootstrapRequest: {
		code: string | undefined
		options: CrewConversationBootstrapOptions
	} | null = null
	private readonly inFlightHireRequests = new Map<string, Promise<void>>()

	readonly topicStore = new TopicStore()
	readonly projectFilesStore = new ProjectFilesStore()
	readonly topicModelStore = createSuperMagicTopicModelStore()
	readonly mentionPanelStore = createMentionPanelStore(this.projectFilesStore)

	constructor() {
		makeAutoObservable(
			this,
			{
				bootstrapGeneration: false,
				lastBootstrapRequest: false,
				inFlightHireRequests: false,
				topicStore: false,
				projectFilesStore: false,
				topicModelStore: false,
				mentionPanelStore: false,
			},
			{ autoBind: true },
		)
	}

	get selectedTopic() {
		return this.topicStore.selectedTopic
	}

	get topicList() {
		return this.topicStore.topics
	}

	/** Initializes one Crew conversation with an immutable auto-hire decision snapshot. */
	async bootstrap(
		rawCode: string | undefined,
		options: CrewConversationBootstrapOptions = {},
	): Promise<void> {
		const generation = ++this.bootstrapGeneration
		this.lastBootstrapRequest = { code: rawCode, options: { ...options } }
		const nextAgentCode = rawCode?.trim() ?? ""
		this.resetRuntimeState()

		if (!nextAgentCode) {
			this.status = "invalid"
			return
		}

		this.status = "loading"
		this.agentCode = nextAgentCode
		const isWidgetBootstrap = options.autoHire !== undefined

		try {
			let agent: AgentDetailView
			if (isWidgetBootstrap) {
				const resolution = await this.resolveWidgetAgent(
					nextAgentCode,
					options.autoHire === true,
					generation,
				)
				if (resolution.kind === "cancelled") return
				if (resolution.kind !== "ready") {
					runInAction(() => {
						this.status = resolution.kind
						this.clearProjectContext()
					})
					return
				}
				agent = resolution.agent
			} else {
				agent = await crewService.getAgentDetail(nextAgentCode)
			}
			if (!this.isCurrentBootstrap(generation)) return

			const validatedAgentCode = agent?.id?.trim() ?? ""

			if (!validatedAgentCode) {
				runInAction(() => {
					this.status = "invalid"
					this.error = new Error("crew-conversation-invalid-agent")
				})
				return
			}

			runInAction(() => {
				this.agent = agent
				this.agentCode = validatedAgentCode
			})

			const [{ project, is_existing: isExistingProject }] = await Promise.all([
				SuperMagicApi.getSpecialProject({ key: validatedAgentCode }),
				superMagicModeService.fetchDefaultModeModelList(),
			])
			if (!this.isCurrentBootstrap(generation)) return

			if (!project?.id) {
				runInAction(() => {
					this.status = "error"
					this.error = new Error("crew-conversation-missing-project")
				})
				return
			}

			const hydration = await this.loadProjectContext(project.id)
			if (!this.isCurrentBootstrap(generation)) return

			void isExistingProject

			runInAction(() => {
				this.hydrate(hydration)
				this.status = "ready"
			})
		} catch (error) {
			if (!this.isCurrentBootstrap(generation)) return
			runInAction(() => {
				this.status = isWidgetBootstrap || this.agent ? "error" : "invalid"
				this.error = error
				this.clearProjectContext()
			})
		}
	}

	/** Repeats the latest bootstrap request without losing its Widget configuration snapshot. */
	async retryBootstrap(): Promise<void> {
		if (!this.lastBootstrapRequest) return
		await this.bootstrap(this.lastBootstrapRequest.code, this.lastBootstrapRequest.options)
	}

	/** Resolves Widget access and performs at most one hire without exception-based state flow. */
	private async resolveWidgetAgent(
		code: string,
		autoHire: boolean,
		generation: number,
	): Promise<WidgetAgentResolution> {
		const access = await crewService.checkAgentAccess(code)
		if (!this.isCurrentBootstrap(generation)) return { kind: "cancelled" }
		if (!access.exists) return { kind: "invalid" }
		if (access.canUse) {
			return { kind: "ready", agent: await crewService.getAgentDetail(access.code) }
		}
		if (!autoHire) return { kind: "unavailable" }

		try {
			await this.hireAgentOnce(access.code)
		} catch {
			if (!this.isCurrentBootstrap(generation)) return { kind: "cancelled" }
			return { kind: "unavailable" }
		}
		if (!this.isCurrentBootstrap(generation)) return { kind: "cancelled" }

		// Refresh the cached mode list so the newly hired agent is usable before rendering.
		await superMagicModeService.fetchModeList({ force: true })
		if (!this.isCurrentBootstrap(generation)) return { kind: "cancelled" }
		return { kind: "ready", agent: await crewService.getAgentDetail(access.code) }
	}

	/** Reuses a pending hire request so remounts cannot create duplicate side effects. */
	private hireAgentOnce(code: string): Promise<void> {
		const pending = this.inFlightHireRequests.get(code)
		if (pending) return pending

		const request = CrewApi.hireStoreAgent({ code }, { enableErrorMessagePrompt: false })
			.then(() => undefined)
			.finally(() => {
				if (this.inFlightHireRequests.get(code) === request) {
					this.inFlightHireRequests.delete(code)
				}
			})
		this.inFlightHireRequests.set(code, request)
		return request
	}

	/** Prevents an obsolete route or configuration request from replacing newer state. */
	private isCurrentBootstrap(generation: number): boolean {
		return generation === this.bootstrapGeneration
	}

	async loadProjectContext(projectId: string): Promise<CrewConversationHydration> {
		this.mentionPanelStore.initLoadAttachments(projectId)

		try {
			const project = await SuperMagicApi.getProjectDetail({ id: projectId })
			if (!project?.id) {
				return {
					project: null,
					topics: [],
					attachments: [],
					attachmentList: [],
				}
			}

			const [topicsResponse, attachmentsResponse] = await Promise.all([
				SuperMagicApi.getTopicsByProjectId({
					id: project.id,
					page: 1,
					page_size: 999,
				}),
				SuperMagicApi.getAttachmentsByProjectId({
					projectId: project.id,
					temporaryToken: "",
				}).catch(() => ({ tree: [] as AttachmentItem[], list: [] as AttachmentItem[] })),
			])

			const processedData = AttachmentDataProcessor.processAttachmentData(attachmentsResponse)

			return {
				project,
				topics: Array.isArray(topicsResponse?.list) ? topicsResponse.list : [],
				attachments: processedData.tree,
				attachmentList: processedData.list,
			}
		} finally {
			this.mentionPanelStore.finishLoadAttachmentsPromise(projectId)
		}
	}

	hydrate({ project, topics, attachments, attachmentList }: CrewConversationHydration) {
		this.selectedProject = project
		this.selectedWorkspace = project ? this.createWorkspaceFromProject(project) : null
		this.projectFilesStore.setSelectedProject(project)
		const dedicatedTopics = topics.map(this.withCrewTopicFields)
		this.topicStore.setTopics(dedicatedTopics)
		this.topicStore.setSelectedTopic(this.pickInitialTopic(project, dedicatedTopics))
		this.setAttachments(attachments, attachmentList)
	}

	setAttachments(tree: AttachmentItem[], list: AttachmentItem[]) {
		this.attachments = tree
		this.attachmentList = list
		this.projectFilesStore.setWorkspaceFileTree(tree)
		if (list.length > 0 && this.projectFilesStore.workspaceFilesList.length === 0) {
			this.projectFilesStore.workspaceFilesList = list
		}
	}

	setSelectedTopic(topic: Topic | null) {
		this.topicStore.setSelectedTopic(topic)
	}

	setSelectedProject(project: ProjectListItem | null) {
		this.selectedProject = project
		this.projectFilesStore.setSelectedProject(project)
	}

	setSelectedWorkspace(workspace: Workspace | null) {
		this.selectedWorkspace = workspace
	}

	setConversationGenerating(isGenerating: boolean) {
		this.isConversationGenerating = isGenerating
	}

	updateTopicStatus(topicId: string, status: TaskStatus) {
		this.topicStore.updateTopicStatus(topicId, status)
	}

	async createAndSelectNewTopic(): Promise<Topic | null> {
		const projectId = this.selectedProject?.id
		if (!projectId || this.isCreatingTopic) return null

		this.isCreatingTopic = true
		try {
			analyticsService.report("topic_create_attempted", {
				projectId,
				workspaceId: this.selectedProject?.workspace_id,
				sceneOverride: "crew",
			})
			const newTopic = await SuperMagicApi.createTopic({
				project_id: projectId,
				topic_name: "",
			})
			if (!newTopic?.id) return null
			const topicsResponse = await SuperMagicApi.getTopicsByProjectId({
				id: projectId,
				page: 1,
				page_size: 999,
			})
			const topics = Array.isArray(topicsResponse?.list) ? topicsResponse.list : []
			const dedicatedTopics = topics.map(this.withCrewTopicFields)
			const targetTopic = this.withCrewTopicFields(
				dedicatedTopics.find((topic) => topic.id === newTopic.id) ??
					newTopic ??
					dedicatedTopics[0] ??
					null,
			)

			runInAction(() => {
				this.topicStore.setTopics(
					dedicatedTopics.length > 0 ? dedicatedTopics : [targetTopic],
				)
				this.topicStore.setSelectedTopic(targetTopic)
			})

			return targetTopic
		} finally {
			runInAction(() => {
				this.isCreatingTopic = false
			})
		}
	}

	reset() {
		this.bootstrapGeneration += 1
		this.resetRuntimeState()
		this.status = "idle"
	}

	dispose() {
		this.reset()
	}

	private resetRuntimeState() {
		this.agentCode = ""
		this.agent = null
		this.error = null
		this.isCreatingTopic = false
		this.isConversationGenerating = false
		this.clearProjectContext()
	}

	private clearProjectContext() {
		this.selectedProject = null
		this.selectedWorkspace = null
		this.attachments = []
		this.attachmentList = []
		this.topicStore.reset()
		this.projectFilesStore.setSelectedProject(null)
		this.projectFilesStore.setWorkspaceFileTree([])
		this.topicModelStore.reset()
	}

	private pickInitialTopic(project: ProjectListItem | null, topics: Topic[]): Topic | null {
		if (topics.length === 0) return null
		return topics.find((topic) => topic.id === project?.current_topic_id) ?? topics[0] ?? null
	}

	private createWorkspaceFromProject(project: ProjectListItem): Workspace {
		return {
			id: project.workspace_id,
			name: project.workspace_name,
			is_archived: 0,
			current_topic_id: project.current_topic_id,
			current_project_id: project.id,
			workspace_status: WorkspaceStatus.FINISHED,
			project_count: 1,
		}
	}

	private withCrewTopicFields(topic: Topic): Topic
	private withCrewTopicFields(topic: Topic | null): Topic | null
	private withCrewTopicFields(topic: Topic | null): Topic | null {
		if (!topic) return null

		return {
			...topic,
			topic_mode: TopicMode.CustomAgent,
			agent_code: this.agentCode,
		}
	}
}
