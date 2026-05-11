// 话题相关行为
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { MentionItemType, ProjectFileMentionData } from "@/components/business/MentionPanel/types"
import { getFolderMentionData } from "@/components/business/MentionPanel/utils/directoryMention"
import { AttachmentItem } from "../components/TopicFilesButton/hooks"
import type { Topic, Workspace, ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { SuperMagicApi } from "@/apis"
import SuperMagicService from "../services"
import magicToast from "@/components/base/MagicToaster/utils"

interface CreateTopicOptions {
	selectedWorkspace?: { id: string }
	selectedProject?: { id: string }
	setSelectedTopic?: (topic: any) => void
	t: (key: string) => string
}

interface AddToCurrentChatOptions {
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

/**
 * 创建新话题
 */
export function handleNewTopic(options: CreateTopicOptions): Promise<any> {
	const { selectedWorkspace, selectedProject, setSelectedTopic, t } = options

	if (!selectedWorkspace?.id || !selectedProject?.id || !setSelectedTopic) {
		return Promise.reject(new Error("Missing required parameters"))
	}

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
function convertFileToMention(fileItem: AttachmentItem): TiptapMentionAttributes {
	if (fileItem.is_directory) {
		return {
			type: MentionItemType.FOLDER,
			data: getFolderMentionData({
				directoryId: fileItem.file_id,
				directoryName: fileItem.file_name || fileItem.filename || fileItem.display_filename,
				directoryPath: fileItem.relative_file_path,
				directoryMetadata: fileItem.display_config,
			}),
		}
	}
	return {
		type: MentionItemType.PROJECT_FILE,
		data: {
			file_id: fileItem.file_id,
			file_name: fileItem.file_name || fileItem.filename || fileItem.display_filename,
			file_path: fileItem.relative_file_path,
			file_extension: fileItem.file_extension,
		} as ProjectFileMentionData,
	}
}

/**
 * 添加文件到当前对话
 */
export function addFileToCurrentChat(options: AddToCurrentChatOptions) {
	const { fileItem, isNewTopic = false, autoFocus = false } = options

	// 转换为 mention 格式并发布事件，由 MessageEditor 统一插入（仅此一条链路，避免与 insert_drag_data 重复插入）
	const mentionItem = convertFileToMention(fileItem)
	pubsub.publish(PubSubEvents.Add_File_To_Chat, {
		items: [mentionItem],
		is_new_topic: isNewTopic,
		autoFocus,
	})
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

	try {
		// 先创建新话题
		await SuperMagicService.handleCreateTopic({
			selectedProject,
			onSuccess: () => {
				// 话题创建成功并导航完成后，添加文件到新创建的对话
				setTimeout(() => {
					addFileToCurrentChat({ fileItem, isNewTopic: true, autoFocus })
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
 * 添加多个文件到当前对话
 */
export function addMultipleFilesToCurrentChat(options: AddMultipleFilesToCurrentChatOptions) {
	const { fileItems, autoFocus = false } = options

	// 转换为 mention 格式并发布事件，由 MessageEditor 统一插入（仅此一条链路，避免与 insert_drag_data 重复插入）
	const mentionItems = fileItems.map(convertFileToMention)
	pubsub.publish(PubSubEvents.Add_File_To_Chat, {
		items: mentionItems,
		is_new_topic: false,
		autoFocus,
	})
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

	try {
		// 先创建新话题
		await SuperMagicService.handleCreateTopic({
			selectedProject,
			onSuccess: () => {
				// 话题创建成功并导航完成后，添加文件到新创建的对话
				setTimeout(() => {
					addMultipleFilesToCurrentChat({ fileItems, autoFocus })
					afterAddFileToNewTopic?.()
				}, 500)
			},
		})
	} catch (error) {
		console.error("创建新话题失败:", error)
		magicToast.error("创建新话题失败")
	}
}
