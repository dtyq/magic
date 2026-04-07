import { SuperMagicApi } from "@/apis"
import { ProjectStorage } from "@/components/Agent/MCP/service/MCPStorageService"
import type { MessageEditorRef } from "@/pages/superMagic/components/MessageEditor/MessageEditor"
import { mentionItemsProcessor } from "@/pages/superMagic/components/MessageEditor/services/MentionItemsProcessor"
import { superMagicUploadTokenService } from "@/pages/superMagic/components/MessageEditor/services/UploadTokenService"
import type {
	HandleSendParams,
	SendRuntimeContext,
} from "@/pages/superMagic/services/messageSendFlowService"
import type { TopicStore } from "@/pages/superMagic/stores/core/topic"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import {
	DEFAULT_TOPIC_ID,
	superMagicTopicModelCacheService,
	superMagicTopicModelService,
} from "@/services/superMagic/topicModel"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import TopicService from "./topicService"
import SuperMagicService from "./index"
import type {
	CreatedProject,
	ProjectListItem,
	Topic,
	TopicMode,
	Workspace,
} from "../pages/Workspace/types"

interface CreateProjectParams {
	projectMode: TopicMode
	workdir?: string
}

interface CreateTopicParams {
	selectedProject?: ProjectListItem | null
}

export interface MessageSendPreparationContext {
	selectedProject?: ProjectListItem | null
	selectedTopic?: Topic | null
	selectedWorkspace?: Workspace | null
	setSelectedProject?: (project: ProjectListItem | null) => void
	setSelectedTopic?: (topic: Topic | null) => void
	setSelectedWorkspace?: (workspace: Workspace | null) => void
	topicStore?: TopicStore
	updateTopicName?: (topicId: string, topicName: string) => void | Promise<void>
	renameProject?: (
		projectId: string,
		projectName: string,
		workspaceId: string,
	) => void | Promise<void>
	createProject?: (params: CreateProjectParams) => Promise<CreatedProject | null>
	createTopic?: (params: CreateTopicParams) => Promise<Topic | null>
}

interface ResolvedPreparationContext extends SendRuntimeContext {
	setSelectedProject: (project: ProjectListItem | null) => void
	setSelectedTopic: (topic: Topic | null) => void
	setSelectedWorkspace: (workspace: Workspace | null) => void
	createProject: (params: CreateProjectParams) => Promise<CreatedProject | null>
	createTopic: (params: CreateTopicParams) => Promise<Topic | null>
}

export interface PreparePanelSendParams {
	params: HandleSendParams
	context?: MessageSendPreparationContext
	tabPattern: TopicMode
	editorRef?: MessageEditorRef | null
	messagesLength: number
}

export interface PreparedPanelSendResult {
	context: SendRuntimeContext
	params: HandleSendParams
	currentProject: ProjectListItem | null
	currentTopic: Topic | null
}

export function resolveMessageSendContext(
	context?: MessageSendPreparationContext,
): ResolvedPreparationContext {
	const selectedProject = context?.selectedProject ?? projectStore.selectedProject
	const selectedTopic =
		context?.selectedTopic ?? context?.topicStore?.selectedTopic ?? topicStore.selectedTopic
	const selectedWorkspace =
		context?.selectedWorkspace ??
		workspaceStore.selectedWorkspace ??
		workspaceStore.firstWorkspace

	const setSelectedProject = context?.setSelectedProject ?? projectStore.setSelectedProject
	const setSelectedTopic =
		context?.setSelectedTopic ??
		context?.topicStore?.setSelectedTopic ??
		topicStore.setSelectedTopic
	const setSelectedWorkspace =
		context?.setSelectedWorkspace ?? workspaceStore.setSelectedWorkspace

	const updateTopicName =
		context?.updateTopicName ??
		context?.topicStore?.updateTopicName ??
		(context?.selectedTopic && context?.setSelectedTopic
			? (topicId: string, topicName: string) => {
					if (context.selectedTopic?.id === topicId) {
						context.setSelectedTopic?.({
							...context.selectedTopic,
							topic_name: topicName,
						})
					}
				}
			: undefined) ??
		topicStore.updateTopicName

	const renameProject =
		context?.renameProject ??
		((projectId: string, projectName: string, workspaceId: string) =>
			SuperMagicService.project.renameProject(projectId, projectName, workspaceId))

	const createProject =
		context?.createProject ??
		((params: CreateProjectParams) =>
			createProjectForContext({
				params,
				selectedWorkspace,
				setSelectedProject,
				setSelectedTopic,
			}))

	const createTopic =
		context?.createTopic ??
		((params: CreateTopicParams) =>
			createTopicForContext({
				selectedProject: params.selectedProject ?? selectedProject,
				topicStore: context?.topicStore,
				setSelectedTopic,
			}))

	return {
		selectedProject,
		selectedTopic,
		selectedWorkspace,
		workspaceId: selectedWorkspace?.id ?? selectedProject?.workspace_id,
		updateTopicName,
		renameProject,
		setSelectedProject,
		setSelectedTopic,
		setSelectedWorkspace,
		createProject,
		createTopic,
	}
}

export async function preparePanelSend({
	params,
	context,
	tabPattern,
	editorRef,
	messagesLength,
}: PreparePanelSendParams): Promise<PreparedPanelSendResult | null> {
	const resolvedContext = resolveMessageSendContext(context)
	let currentProject = resolvedContext.selectedProject
	let currentTopic = resolvedContext.selectedTopic
	let nextMentionItems = [...params.mentionItems]
	let nextContent = params.value

	if (!nextContent) {
		return null
	}

	if (!currentProject?.id) {
		const createdProject = await resolvedContext.createProject({
			projectMode: tabPattern,
			workdir: superMagicUploadTokenService.getLastWorkDir(),
		})

		if (!createdProject?.project || !createdProject.topic) {
			return null
		}

		currentProject = createdProject.project
		currentTopic = {
			...createdProject.topic,
			topic_mode: params.topicMode ?? tabPattern,
		}

		resolvedContext.setSelectedProject(currentProject)
		resolvedContext.setSelectedTopic(currentTopic)

		await migrateMcpCache(currentProject.id)

		const result = await mentionItemsProcessor.processMentionItems(
			nextContent,
			nextMentionItems,
			currentProject.id,
			currentTopic.id,
		)
		nextMentionItems = result.mentionItems
		nextContent = result.content
	}

	if (!currentProject?.id) {
		return null
	}

	if (!currentTopic?.id) {
		const createdTopic = await resolvedContext.createTopic({
			selectedProject: currentProject,
		})
		if (!createdTopic) {
			return null
		}
		currentTopic = {
			...createdTopic,
			topic_mode: params.topicMode ?? tabPattern,
		}
	} else {
		currentTopic = {
			...currentTopic,
			topic_mode: params.topicMode ?? tabPattern,
		}
	}

	resolvedContext.setSelectedTopic(currentTopic)

	if (
		params.selectedModel?.model_id &&
		(!resolvedContext.selectedTopic?.id || messagesLength === 0)
	) {
		editorRef?.saveSuperMagicTopicModel({
			selectedTopic: currentTopic,
			model: params.selectedModel,
			imageModel: params.selectedImageModel || null,
		})
	}

	return {
		context: {
			selectedProject: currentProject,
			selectedTopic: currentTopic,
			selectedWorkspace: resolvedContext.selectedWorkspace,
			workspaceId: resolvedContext.workspaceId,
			updateTopicName: resolvedContext.updateTopicName,
			renameProject: resolvedContext.renameProject,
		},
		params: {
			...params,
			value: nextContent,
			mentionItems: nextMentionItems,
		},
		currentProject,
		currentTopic,
	}
}

export async function createTopicForMessageContext(
	context?: MessageSendPreparationContext,
): Promise<Topic | null> {
	const resolvedContext = resolveMessageSendContext(context)
	const currentProject = resolvedContext.selectedProject
	if (!currentProject) {
		return null
	}

	const nextTopic = await resolvedContext.createTopic({
		selectedProject: currentProject,
	})

	if (!nextTopic) {
		return null
	}

	resolvedContext.setSelectedTopic(nextTopic)
	return nextTopic
}

async function createProjectForContext({
	params,
	selectedWorkspace,
	setSelectedProject,
	setSelectedTopic,
}: {
	params: CreateProjectParams
	selectedWorkspace: Workspace | null
	setSelectedProject: (project: ProjectListItem | null) => void
	setSelectedTopic: (topic: Topic | null) => void
}): Promise<CreatedProject | null> {
	if (!selectedWorkspace?.id) {
		return null
	}

	const createdProject = await SuperMagicApi.createProject({
		workspace_id: selectedWorkspace.id,
		project_name: "",
		project_description: "",
		project_mode: params.projectMode,
		workdir: params.workdir,
	})

	if (!createdProject?.project || !createdProject.topic) {
		return null
	}

	await copyGlobalModelConfiguration({
		projectMode: params.projectMode,
		createdProject,
	})

	setSelectedProject(createdProject.project)
	setSelectedTopic(createdProject.topic)

	return createdProject
}

async function createTopicForContext({
	selectedProject,
	topicStore: localTopicStore,
	setSelectedTopic,
}: {
	selectedProject?: ProjectListItem | null
	topicStore?: TopicStore
	setSelectedTopic: (topic: Topic | null) => void
}): Promise<Topic | null> {
	if (!selectedProject?.id) {
		return null
	}

	if (localTopicStore) {
		return new TopicService({ store: localTopicStore }).createTopic({
			projectId: selectedProject.id,
			topicName: "",
		})
	}

	if (setSelectedTopic === topicStore.setSelectedTopic) {
		return SuperMagicService.handleCreateTopic({
			selectedProject,
			onSuccess: (topic) => {
				setSelectedTopic(topic)
			},
		})
	}

	const newTopic = await SuperMagicApi.createTopic({
		project_id: selectedProject.id,
		topic_name: "",
	})

	if (newTopic?.id) {
		SuperMagicApi.preWarmSandbox({
			topic_id: newTopic.id,
		})
		setSelectedTopic(newTopic)
	}

	return newTopic
}

async function migrateMcpCache(projectId: string) {
	const mcpCacheStorage = new ProjectStorage()
	const mcpCache = await mcpCacheStorage.getMCP()
	const storageStrategy = new ProjectStorage(projectId)

	if (mcpCache?.length > 0) {
		await storageStrategy.saveMCP(mcpCache)
		await mcpCacheStorage.saveMCP([])
	}
}

async function copyGlobalModelConfiguration({
	projectMode,
	createdProject,
}: {
	projectMode: TopicMode
	createdProject: CreatedProject
}) {
	const globalModelCache = await superMagicTopicModelCacheService.getTopicModel(DEFAULT_TOPIC_ID)

	if (!globalModelCache?.languageModelId && !globalModelCache?.imageModelId) {
		return
	}

	const languageModel = globalModelCache.languageModelId
		? await superMagicModeService.resolveLanguageModelByMode(
				projectMode,
				globalModelCache.languageModelId,
			)
		: null

	const imageModel = globalModelCache.imageModelId
		? await superMagicModeService.resolveImageModelByMode(
				projectMode,
				globalModelCache.imageModelId,
			)
		: null

	if (languageModel || imageModel) {
		await superMagicTopicModelService.saveModel(
			createdProject.topic.id,
			createdProject.project.id,
			languageModel,
			imageModel,
		)
	}
}
