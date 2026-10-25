import { SuperMagicApi } from "@/apis"
import { ProjectStorage } from "@/components/Agent/MCP/service/MCPStorageService"
import type { MessageEditorRef } from "@/pages/superMagic/components/MessageEditor/MessageEditor"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import { mentionItemsProcessor } from "@/pages/superMagic/components/MessageEditor/services/MentionItemsProcessor"
import { collectMentionItemsFromContent } from "@/pages/superMagic/components/MessageEditor/services/uploadMentionService"
import { htmlScreenshotUploadService } from "@/pages/superMagic/components/MessageEditor/services/HtmlScreenshotUploadService"
import { stripProjectResourceMentionDisplayMetadata } from "@/pages/superMagic/components/MessageEditor/utils/mention"
import { superMagicUploadTokenService } from "@/pages/superMagic/components/MessageEditor/services/UploadTokenService"
import type {
	HandleSendParams,
	SendRuntimeContext,
} from "@/pages/superMagic/services/messageSendFlowService"
import type { TopicStore } from "@/pages/superMagic/stores/core/topic"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import {
	DEFAULT_TOPIC_ID,
	superMagicTopicModelCacheService,
	superMagicTopicModelService,
} from "@/services/superMagic/topicModel"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { resolveAgentSelection } from "@/services/superMagic/DefaultAgentSelectionService"
import { shouldCreateFreshTopicForProject } from "./topicProjectConsistency"
import TopicService from "./topicService"
import SuperMagicService from "./index"
import type { CreatedProject, ProjectListItem, Topic, Workspace } from "../pages/Workspace/types"
import type { TopicMode } from "../pages/Workspace/TopicMode"
import { analyticsService } from "@/services/analytics"

interface CreateProjectParams {
	projectMode: TopicMode
	workdir?: string
}

interface CreateTopicParams {
	selectedProject?: ProjectListItem | null
}

export interface MessageSendPreparationContext {
	/** Consume only the active composer's temporary uploads when creating its project. */
	getTemporaryWorkdir?: () => string | undefined
	selectedProject?: ProjectListItem | null
	selectedTopic?: Topic | null
	selectedWorkspace?: Workspace | null
	/** Explicit business entry for creation analytics, independent of the selected agent mode. */
	creationScene?: string
	setSelectedProject?: (project: ProjectListItem | null) => void
	setSelectedTopic?: (topic: Topic | null) => void
	setSelectedWorkspace?: (workspace: Workspace | null) => void
	topicStore?: TopicStore
	updateTopicName?: (topicId: string, topicName: string) => void | Promise<void>
	refreshProjectAfterTopicRename?: boolean
	renameProject?: (
		projectId: string,
		projectName: string,
		workspaceId: string,
	) => void | Promise<void>
	createProject?: (params: CreateProjectParams) => Promise<CreatedProject | null>
	createTopic?: (params: CreateTopicParams) => Promise<Topic | null>
	/**
	 * Mentions the host page binds to every message once the project exists.
	 * Example: the AI canvas page returns its canvas folder so the design agent always
	 * receives the exact canvas path instead of initializing another canvas.
	 */
	getImplicitMentionItems?: (
		project: ProjectListItem,
	) => MentionListItem[] | Promise<MentionListItem[]>
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

export interface EnsuredMessageProjectResult {
	currentProject: ProjectListItem
	currentTopic: Topic | null
}

function getMentionIdentity(item: MentionListItem): string {
	const data = (item.attrs.data ?? {}) as Record<string, unknown>
	const path = data.directory_path ?? data.file_path ?? data.file_id ?? data.directory_id ?? ""
	// Compare paths without edge slashes: "/Canvas/" and "Canvas" are the same folder.
	return `${item.attrs.type}:${String(path).replace(/^\/+|\/+$/g, "")}`
}

/**
 * Prepends host-required mentions that the user has not referenced yet.
 *
 * | Message already contains        | Result                                   |
 * | nothing                         | `@canvas` + " " + original first line    |
 * | the same mention (same path)    | unchanged                                |
 *
 * The mention node is inserted at the start of the first paragraph (or a new one) so history
 * renders it like a user-inserted reference and the model sees it before the prompt text.
 */
export function prependImplicitMentions(
	content: JSONContent,
	mentionItems: MentionListItem[],
	implicitMentionItems: MentionListItem[],
): { content: JSONContent; mentionItems: MentionListItem[] } {
	const existing = new Set(mentionItems.map(getMentionIdentity))
	const missing = implicitMentionItems.filter((item) => {
		const identity = getMentionIdentity(item)
		if (existing.has(identity)) return false
		existing.add(identity)
		return true
	})
	if (missing.length === 0) return { content, mentionItems }

	const mentionNodes: JSONContent[] = missing.flatMap((item) => [
		{ type: "mention", attrs: item.attrs },
		{ type: "text", text: " " },
	])
	const blocks = content.content ?? []
	const [firstBlock, ...restBlocks] = blocks
	const nextBlocks =
		firstBlock?.type === "paragraph"
			? [
					{ ...firstBlock, content: [...mentionNodes, ...(firstBlock.content ?? [])] },
					...restBlocks,
				]
			: [{ type: "paragraph", content: mentionNodes }, ...blocks]

	return {
		content: { ...content, content: nextBlocks },
		mentionItems: [...missing, ...mentionItems],
	}
}

export async function processMessageMentions(
	content: JSONContent,
	projectId: string,
	topicId?: string,
): Promise<JSONContent> {
	const mentionItems = collectMentionItemsFromContent(content)
	if (mentionItems.length === 0) return content

	const result = await mentionItemsProcessor.processMentionItems(
		content,
		mentionItems,
		projectId,
		topicId,
	)
	return stripProjectResourceMentionDisplayMetadata(result.content, result.mentionItems).content
}

export function releaseHtmlScreenshotsAfterSend(
	mentionItems: HandleSendParams["mentionItems"],
): void {
	void Promise.resolve(
		htmlScreenshotUploadService.releaseStoredScreenshots(
			htmlScreenshotUploadService.collectStorageIds(mentionItems),
		),
	).catch(() => undefined)
}

export function resolveMessageSendContext(
	context?: MessageSendPreparationContext,
): ResolvedPreparationContext {
	// Local blank composers deliberately pass null to exclude the previous global conversation.
	const selectedProject =
		context?.selectedProject !== undefined
			? context.selectedProject
			: projectStore.selectedProject
	const selectedTopic =
		context?.selectedTopic !== undefined
			? context.selectedTopic
			: (context?.topicStore?.selectedTopic ?? topicStore.selectedTopic)
	const selectedWorkspace =
		context?.selectedWorkspace !== undefined
			? context.selectedWorkspace
			: (workspaceStore.selectedWorkspace ?? workspaceStore.firstWorkspace)

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
				creationScene: context?.creationScene,
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
		topicStore: context?.topicStore ?? topicStore,
		workspaceId: selectedWorkspace?.id ?? selectedProject?.workspace_id,
		updateTopicName,
		refreshProjectAfterTopicRename: context?.refreshProjectAfterTopicRename,
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
	let currentTopic = params.targetTopic ?? resolvedContext.selectedTopic
	let nextMentionItems = [...params.mentionItems]
	let nextContent = params.value
	const selection = resolveAgentSelection(
		params.topicMode ?? tabPattern,
		resolveAgentCode(params),
	)
	const agentCode = selection.agentCode
	const normalizedParams = applyAgentSelectionToParams(params, selection)

	if (!nextContent) {
		return null
	}

	if (!currentProject?.id) {
		const createdProject = await resolvedContext.createProject({
			projectMode: tabPattern,
			workdir: (
				context?.getTemporaryWorkdir ??
				(() => superMagicUploadTokenService.getLastWorkDir())
			)(),
		})

		if (!createdProject?.project || !createdProject.topic) {
			return null
		}

		currentProject = createdProject.project
		currentTopic = {
			...createdProject.topic,
			topic_mode: selection.topicPattern,
			agent_code: agentCode,
		}

		resolvedContext.setSelectedProject(currentProject)
		resolvedContext.setSelectedTopic(currentTopic)

		await migrateMcpCache(currentProject.id)
	}

	if (!currentProject?.id) {
		return null
	}

	// 移动端 chat 项目页可能暂时挂着旧项目的话题，这里在发送前统一兜底，避免消息写入错误会话。
	if (shouldCreateFreshTopicForProject(currentProject, currentTopic)) {
		currentTopic = null
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
			topic_mode: selection.topicPattern,
			agent_code: agentCode,
		}
	} else {
		currentTopic = {
			...currentTopic,
			topic_mode: selection.topicPattern,
			agent_code: agentCode,
		}
	}

	resolvedContext.setSelectedTopic(currentTopic)

	if (context?.getImplicitMentionItems) {
		const implicitMentionItems = await context.getImplicitMentionItems(currentProject)
		const withImplicit = prependImplicitMentions(
			nextContent,
			nextMentionItems,
			implicitMentionItems,
		)
		nextContent = withImplicit.content
		nextMentionItems = withImplicit.mentionItems
	}

	const result = await mentionItemsProcessor.processMentionItems(
		nextContent,
		nextMentionItems,
		currentProject.id,
		currentTopic.id,
	)
	nextMentionItems = result.mentionItems
	nextContent = result.content
	const sanitizedMentions = stripProjectResourceMentionDisplayMetadata(
		nextContent,
		nextMentionItems,
	)
	nextMentionItems = sanitizedMentions.mentionItems
	nextContent = sanitizedMentions.content

	if (
		params.selectedModel?.model_id &&
		(!resolvedContext.selectedTopic?.id || messagesLength === 0)
	) {
		editorRef?.saveSuperMagicTopicModel({
			selectedTopic: currentTopic,
			model: params.selectedModel,
			imageModel: params.selectedImageModel || null,
			videoModel: params.selectedVideoModel || null,
		})
	}

	return {
		context: {
			selectedProject: currentProject,
			selectedTopic: currentTopic,
			selectedWorkspace: resolvedContext.selectedWorkspace,
			// Preserve the scoped store so dispatchMessage can update the visible Topic immediately.
			topicStore: resolvedContext.topicStore,
			workspaceId: resolvedContext.workspaceId ?? currentProject.workspace_id,
			updateTopicName: resolvedContext.updateTopicName,
			refreshProjectAfterTopicRename: resolvedContext.refreshProjectAfterTopicRename,
			renameProject: resolvedContext.renameProject,
		},
		params: {
			...normalizedParams,
			value: nextContent,
			mentionItems: nextMentionItems,
		},
		currentProject,
		currentTopic,
	}
}

export async function ensureProjectForMessageContext({
	context,
	tabPattern,
}: {
	context?: MessageSendPreparationContext
	tabPattern: TopicMode
}): Promise<EnsuredMessageProjectResult | null> {
	const resolvedContext = resolveMessageSendContext(context)
	let currentProject = resolvedContext.selectedProject
	let currentTopic = resolvedContext.selectedTopic

	if (currentProject?.id) {
		return {
			currentProject,
			currentTopic,
		}
	}

	const createdProject = await resolvedContext.createProject({
		projectMode: tabPattern,
		workdir: superMagicUploadTokenService.getLastWorkDir(),
	})

	if (!createdProject?.project || !createdProject.topic) {
		return null
	}

	currentProject = createdProject.project
	const selection = resolveAgentSelection(tabPattern)
	currentTopic = {
		...createdProject.topic,
		topic_mode: selection.topicPattern,
		agent_code: selection.agentCode,
	}

	resolvedContext.setSelectedProject(currentProject)
	resolvedContext.setSelectedTopic(currentTopic)

	await migrateMcpCache(currentProject.id)

	return {
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
	creationScene,
	setSelectedProject,
	setSelectedTopic,
}: {
	params: CreateProjectParams
	selectedWorkspace: Workspace | null
	creationScene?: string
	setSelectedProject: (project: ProjectListItem | null) => void
	setSelectedTopic: (topic: Topic | null) => void
}): Promise<CreatedProject | null> {
	if (!selectedWorkspace?.id) {
		return null
	}

	analyticsService.report("project_create_attempted", {
		workspaceId: selectedWorkspace.id,
		sceneOverride: creationScene,
		mode: params.projectMode,
	})
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
			workspaceId: selectedProject.workspace_id,
			mode: selectedProject.project_mode,
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

	analyticsService.report("topic_create_attempted", {
		projectId: selectedProject.id,
		workspaceId: selectedProject.workspace_id,
		mode: selectedProject.project_mode,
	})
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

function resolveAgentCode(params: HandleSendParams): string | undefined {
	const agentCode = params.extra?.agent_code
	if (typeof agentCode !== "string") return undefined
	return agentCode.trim() || undefined
}

function applyAgentSelectionToParams(
	params: HandleSendParams,
	selection: ReturnType<typeof resolveAgentSelection>,
): HandleSendParams {
	const extra = { ...(params.extra ?? {}) }
	delete extra.agent_code
	const normalizedExtra = selection.agentCode
		? { ...extra, agent_code: selection.agentCode }
		: Object.keys(extra).length > 0
			? extra
			: undefined

	return {
		...params,
		topicMode: selection.topicPattern,
		extra: normalizedExtra,
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
