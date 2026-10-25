import { makeAutoObservable, runInAction } from "mobx"
import { createMentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import { ProjectFilesStore } from "@/stores/projectFiles"
import { AppConversationStore } from "./conversation-store"
import { SuperMagicApi } from "@/apis"
import type { ProjectListItem } from "../../Workspace/types"

export type MicroAppConversationType = "development" | "usage"

const RUNTIME_PROJECT_LOAD_SUPERSEDED = "Runtime project load superseded"

export class AppRootStore {
	projectId: string | null = null
	initLoading = false
	initError: string | null = null

	readonly developmentConversation: AppConversationStore
	readonly usageConversation: AppConversationStore
	conversationType: MicroAppConversationType = "development"
	runtimeProject: ProjectListItem | null = null
	runtimeProjectState: "unknown" | "absent" | "ready" = "unknown"
	runtimeProjectPromise: Promise<{
		selectedProject: ProjectListItem
		topicStore: AppConversationStore["topicStore"]
	}> | null = null
	runtimeProjectPromiseAppId: string | null = null
	runtimeProjectAppId: string | null = null
	runtimeProjectRequestId = 0
	readonly projectFilesStore: ProjectFilesStore
	readonly mentionPanelStore: ReturnType<typeof createMentionPanelStore>
	readonly runtimeProjectFilesStore: ProjectFilesStore
	readonly runtimeMentionPanelStore: ReturnType<typeof createMentionPanelStore>

	constructor() {
		this.developmentConversation = new AppConversationStore()
		this.usageConversation = new AppConversationStore()
		this.projectFilesStore = new ProjectFilesStore()
		this.mentionPanelStore = createMentionPanelStore(this.projectFilesStore)
		this.runtimeProjectFilesStore = new ProjectFilesStore()
		this.runtimeMentionPanelStore = createMentionPanelStore(this.runtimeProjectFilesStore)

		makeAutoObservable(
			this,
			{
				developmentConversation: false,
				usageConversation: false,
				runtimeProjectPromise: false,
				runtimeProjectPromiseAppId: false,
				runtimeProjectAppId: false,
				runtimeProjectRequestId: false,
				projectFilesStore: false,
				mentionPanelStore: false,
				runtimeProjectFilesStore: false,
				runtimeMentionPanelStore: false,
			},
			{ autoBind: true },
		)
	}

	get conversation(): AppConversationStore {
		return this.conversationType === "usage"
			? this.usageConversation
			: this.developmentConversation
	}

	setConversationType(type: MicroAppConversationType) {
		this.conversationType = type
	}

	resetRuntimeProjectContext() {
		// Invalidate pending runtime hydration before clearing state during app or organization changes.
		this.runtimeProjectRequestId += 1
		this.runtimeProject = null
		this.runtimeProjectAppId = null
		this.runtimeProjectState = "unknown"
		this.runtimeProjectPromise = null
		this.runtimeProjectPromiseAppId = null
		this.runtimeProjectFilesStore.setSelectedProject(null)
		this.usageConversation.reset()
		if (this.conversationType === "usage") this.conversationType = "development"
	}

	async loadRuntimeProject(appId: string): Promise<void> {
		if (this.runtimeProject && this.runtimeProjectAppId === appId) return
		// A new app invalidates every callback from the previous runtime load.
		const requestId = ++this.runtimeProjectRequestId
		const isCurrent = () => this.runtimeProjectRequestId === requestId
		this.runtimeProject = null
		this.runtimeProjectAppId = null
		this.runtimeProjectState = "unknown"
		this.usageConversation.reset()
		// Clear stale file attachments immediately so that while the new project's
		// files are loading, consumers do not see the previous app's file list.
		this.runtimeProjectFilesStore.setSelectedProject(null)
		try {
			const result = await SuperMagicApi.getMicroAppRuntimeProject(appId, {
				enableErrorMessagePrompt: false,
			})
			if (!isCurrent()) return
			if (result.exists && result.project) {
				await this.usageConversation.loadProjectContext(result.project.id, { isCurrent })
				if (!isCurrent()) return
				const loadedProject = this.usageConversation.selectedProject
				if (!loadedProject) throw new Error("Runtime project could not be loaded")
				runInAction(() => {
					this.runtimeProject = loadedProject
					this.runtimeProjectAppId = appId
					this.runtimeProjectState = "ready"
				})
			} else {
				runInAction(() => {
					this.runtimeProject = null
					this.runtimeProjectState = "absent"
				})
			}
		} catch {
			if (!isCurrent()) return
			runInAction(() => {
				this.runtimeProject = null
				this.runtimeProjectAppId = null
				this.runtimeProjectState = "absent"
			})
		}
	}

	async ensureUsageProject(appId: string): Promise<{
		selectedProject: ProjectListItem
		topicStore: AppConversationStore["topicStore"]
	}> {
		if (this.runtimeProjectPromise && this.runtimeProjectPromiseAppId === appId) {
			return this.runtimeProjectPromise
		}
		if (this.runtimeProject && this.runtimeProjectAppId === appId) {
			this.conversationType = "usage"
			return {
				selectedProject: this.runtimeProject,
				topicStore: this.usageConversation.topicStore,
			}
		}
		const requestId = ++this.runtimeProjectRequestId
		// Ensure and load operations share one version so explicit usage wins over
		// a background lookup instead of allowing the two hydrations to race.
		const isCurrent = () => this.runtimeProjectRequestId === requestId
		this.runtimeProject = null
		this.runtimeProjectAppId = null
		this.runtimeProjectState = "unknown"
		this.usageConversation.reset()
		// Clear stale files before the next runtime project hydrates.
		this.runtimeProjectFilesStore.setSelectedProject(null)
		const promise = (async () => {
			const result = await SuperMagicApi.ensureMicroAppRuntimeProject(appId)
			if (!isCurrent()) throw new Error(RUNTIME_PROJECT_LOAD_SUPERSEDED)
			await this.usageConversation.loadProjectContext(result.project.id, { isCurrent })
			if (!isCurrent()) throw new Error(RUNTIME_PROJECT_LOAD_SUPERSEDED)
			const loadedProject = this.usageConversation.selectedProject
			if (!loadedProject) throw new Error("Runtime project could not be loaded")
			runInAction(() => {
				this.runtimeProject = loadedProject
				this.runtimeProjectAppId = appId
				this.runtimeProjectState = "ready"
				this.conversationType = "usage"
			})
			return {
				selectedProject: loadedProject,
				topicStore: this.usageConversation.topicStore,
			}
		})()
		this.runtimeProjectPromise = promise
		this.runtimeProjectPromiseAppId = appId
		try {
			return await promise
		} finally {
			if (this.runtimeProjectPromise === promise) {
				this.runtimeProjectPromise = null
				this.runtimeProjectPromiseAppId = null
			}
		}
	}

	async initFromProjectId(projectId: string): Promise<void> {
		if (this.initLoading) return

		this.initLoading = true
		this.initError = null
		this.projectId = projectId

		try {
			await this.developmentConversation.loadProjectContext(projectId)

			runInAction(() => {
				this.projectFilesStore.setSelectedProject(
					this.developmentConversation.selectedProject,
				)
			})
		} catch (error) {
			runInAction(() => {
				this.initError = error instanceof Error ? error.message : "Failed to load project"
			})
		} finally {
			runInAction(() => {
				this.initLoading = false
			})
		}
	}

	reset() {
		this.projectId = null
		this.initLoading = false
		this.initError = null
		this.developmentConversation.reset()
		this.usageConversation.reset()
		this.conversationType = "development"
		this.runtimeProject = null
		this.runtimeProjectAppId = null
		this.runtimeProjectState = "unknown"
		this.runtimeProjectPromise = null
		this.runtimeProjectPromiseAppId = null
		this.runtimeProjectRequestId += 1
		this.projectFilesStore.setSelectedProject(null)
		this.runtimeProjectFilesStore.setSelectedProject(null)
	}

	dispose() {
		this.reset()
	}
}
