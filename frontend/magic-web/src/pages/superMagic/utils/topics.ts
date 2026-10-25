// 话题相关行为
import type { FileMentionTargetScope } from "../events/message"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { AttachmentItem } from "../components/TopicFilesButton/hooks"
import type { Topic, Workspace, ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { SuperMagicApi } from "@/apis"
import SuperMagicService from "../services"
import magicToast from "@/components/base/MagicToaster/utils"
import i18n from "i18next"
import projectFilesStore from "@/stores/projectFiles"
import { createFileReferenceMention } from "@/components/business/MentionPanel/utils/fileReferenceMention"
import { getFileReferenceIdentityKey } from "@/pages/superMagic/services/userFileReferenceResolver"
import { analyticsService } from "@/services/analytics"

interface CreateTopicOptions {
	selectedWorkspace?: { id: string }
	selectedProject?: { id: string; project_mode?: string | null }
	setSelectedTopic?: (topic: any) => void
	t: (key: string) => string
}

interface AddToCurrentChatOptions {
	targetScope?: FileMentionTargetScope
	fileItem: AttachmentItem
	isNewTopic?: boolean
	/** 是否自动聚焦输入框，默认为 false */
	autoFocus?: boolean
}

interface AddToNewChatOptions extends AddToCurrentChatOptions {
	selectedWorkspace: Workspace | null | undefined
	selectedProject: ProjectListItem | null | undefined
	afterAddFileToNewTopic?: () => void
}

interface AddMultipleFilesToCurrentChatOptions {
	fileItems: AttachmentItem[]
	/** 是否自动聚焦输入框，默认为 false */
	autoFocus?: boolean
}

interface AddMultipleFilesToNewChatOptions extends AddMultipleFilesToCurrentChatOptions {
	selectedWorkspace: Workspace | null | undefined
	selectedProject: ProjectListItem | null | undefined
	afterAddFileToNewTopic?: () => void
}

interface AddMentionsToCurrentChatOptions {
	targetScope?: FileMentionTargetScope
	items: TiptapMentionAttributes[]
	isNewTopic?: boolean
	autoFocus?: boolean
}

interface AddMentionsToNewChatOptions extends AddMentionsToCurrentChatOptions {
	selectedProject: ProjectListItem | null | undefined
	afterAddFileToNewTopic?: () => void
}

interface AddTextToCurrentChatOptions {
	content: string
}

interface AddTextToNewChatOptions extends AddTextToCurrentChatOptions {
	selectedProject: ProjectListItem | null | undefined
	afterAddContentToNewTopic?: () => void
}

/**
 * 创建新话题
 */
export function handleNewTopic(options: CreateTopicOptions): Promise<any> {
	const { selectedWorkspace, selectedProject, setSelectedTopic, t } = options

	if (!selectedWorkspace?.id || !selectedProject?.id || !setSelectedTopic) {
		return Promise.reject(new Error("Missing required parameters"))
	}

	analyticsService.report("topic_create_attempted", {
		projectId: selectedProject.id,
		workspaceId: selectedWorkspace.id,
		mode: selectedProject.project_mode,
	})
	return SuperMagicApi.createTopic({
		topic_name: "",
		// workspace_id: selectedWorkspace.id,
		project_id: selectedProject.id,
	})
		.then((res: any) => {
			// 获取最新的话题列表
			return SuperMagicApi.getTopicsByProjectId({
				id: selectedProject.id,
				page: 1,
				page_size: 999,
			})
				.then((topicsRes: any) => {
					const newTopic = topicsRes?.list.find((topic: Topic) => topic?.id === res?.id)
					if (newTopic) {
						setSelectedTopic(newTopic)
					}

					return newTopic
				})
				.catch((err) => {
					console.error("获取话题列表失败:", err)
					throw err
				})
		})
		.catch((err) => {
			console.error("创建话题失败:", err)
			throw err
		})
}

/**
 * 将文件项转换为mention格式
 */
async function convertFilesToMentions(files: AttachmentItem[]): Promise<TiptapMentionAttributes[]> {
	const identity = getFileReferenceIdentityKey()
	const projectId = projectFilesStore.currentSelectedProject?.id
	const items = await Promise.all(
		files.map(async (file) => {
			try {
				return await createFileReferenceMention(file, {
					getFolderData: (id) => projectFilesStore.getFolderData(id),
					workspaceFilesList: projectFilesStore.workspaceFilesList,
				})
			} catch {
				return null
			}
		}),
	)
	if (
		identity !== getFileReferenceIdentityKey() ||
		projectId !== projectFilesStore.currentSelectedProject?.id
	)
		return []
	if (items.some((item) => !item))
		magicToast.error(i18n.t("super:common.fileNotFoundOrLoadFailed"))
	return items.filter((item): item is TiptapMentionAttributes => item !== null)
}

/** 将纯文本内容转换为消息编辑器可插入的文档结构。 */
function buildTextContent(content: string): JSONContent {
	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: [
					{ type: "text", text: content },
					{ type: "text", text: " " },
				],
			},
		],
	}
}

/** 添加纯文本到当前对话输入框。 */
export function addTextToCurrentChat(options: AddTextToCurrentChatOptions) {
	const content = options.content.trim()
	if (!content) return

	pubsub.publish(PubSubEvents.Add_Content_To_Chat, {
		content: buildTextContent(content),
		extraData: {
			focusAtEnd: true,
		},
	})
}

/** 创建新话题后，将纯文本添加到新对话输入框。 */
export async function addTextToNewChat(options: AddTextToNewChatOptions) {
	const { content, selectedProject, afterAddContentToNewTopic } = options
	if (!selectedProject) {
		magicToast.error("创建新话题功能不可用")
		return
	}

	try {
		await SuperMagicService.handleCreateTopic({
			selectedProject,
			onSuccess: () => {
				setTimeout(() => {
					addTextToCurrentChat({ content })
					afterAddContentToNewTopic?.()
				}, 500)
			},
		})
	} catch (error) {
		console.error("创建新话题失败:", error)
		magicToast.error("创建新话题失败")
	}
}

/** 全局上传浮窗只查询当前范围的输入能力，不保存编辑器实例或注册第二份编辑器。 */
export function canAddFileToCurrentChat(targetScope: FileMentionTargetScope): boolean {
	let editable = false
	pubsub.publish(PubSubEvents.Add_File_To_Chat, {
		items: [],
		is_new_topic: false,
		targetScope,
		checkEditable: (value) => {
			editable ||= value
		},
	})
	return editable
}

/**
 * 添加文件到当前对话
 */
export async function addFileToCurrentChat(options: AddToCurrentChatOptions) {
	const { fileItem, isNewTopic = false, autoFocus = false, targetScope } = options

	// 转换为 mention 格式并发布事件，由 MessageEditor 统一插入（仅此一条链路，避免与 insert_drag_data 重复插入）
	const items = await convertFilesToMentions([fileItem])
	addMentionsToCurrentChat({ items, isNewTopic, autoFocus, targetScope })
}

/** 将已构造的 mention 添加到当前对话。 */
export function addMentionsToCurrentChat(options: AddMentionsToCurrentChatOptions) {
	const { items, isNewTopic = false, autoFocus = false, targetScope } = options
	if (items.length === 0) return

	pubsub.publish(PubSubEvents.Add_File_To_Chat, {
		items,
		is_new_topic: isNewTopic,
		autoFocus,
		targetScope,
	})
}

/** 创建新话题后，将已构造的 mention 添加到输入框。 */
export async function addMentionsToNewChat(options: AddMentionsToNewChatOptions) {
	const { items, selectedProject, afterAddFileToNewTopic, autoFocus = false } = options

	if (items.length === 0) return
	if (!selectedProject) {
		magicToast.error("创建新话题功能不可用")
		return
	}

	try {
		await SuperMagicService.handleCreateTopic({
			selectedProject,
			onSuccess: () => {
				setTimeout(() => {
					addMentionsToCurrentChat({ items, isNewTopic: true, autoFocus })
					afterAddFileToNewTopic?.()
				}, 500)
			},
		})
	} catch (error) {
		console.error("创建新话题失败:", error)
		magicToast.error("创建新话题失败")
	}
}

/**
 * 添加文件到新对话
 */
export async function addFileToNewChat(options: AddToNewChatOptions) {
	const {
		fileItem,
		selectedWorkspace,
		selectedProject,
		afterAddFileToNewTopic,
		autoFocus = false,
	} = options

	if (!selectedWorkspace || !selectedProject) {
		magicToast.error("创建新话题功能不可用")
		return
	}

	return addMentionsToNewChat({
		items: await convertFilesToMentions([fileItem]),
		selectedProject,
		afterAddFileToNewTopic,
		autoFocus,
	})
}

/**
 * 添加多个文件到当前对话
 */
export async function addMultipleFilesToCurrentChat(options: AddMultipleFilesToCurrentChatOptions) {
	const { fileItems, autoFocus = false } = options

	// 转换为 mention 格式并发布事件，由 MessageEditor 统一插入（仅此一条链路，避免与 insert_drag_data 重复插入）
	const mentionItems = await convertFilesToMentions(fileItems)
	addMentionsToCurrentChat({ items: mentionItems, autoFocus })
}

/**
 * 添加多个文件到新对话
 */
export async function addMultipleFilesToNewChat(options: AddMultipleFilesToNewChatOptions) {
	const {
		fileItems,
		selectedWorkspace,
		selectedProject,
		afterAddFileToNewTopic,
		autoFocus = false,
	} = options

	if (!selectedWorkspace || !selectedProject) {
		magicToast.error("创建新话题功能不可用")
		return
	}

	return addMentionsToNewChat({
		items: await convertFilesToMentions(fileItems),
		selectedProject,
		afterAddFileToNewTopic,
		autoFocus,
	})
}
