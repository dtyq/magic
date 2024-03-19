// 话题相关行为
import pubsub from "@/opensource/utils/pubsub"
import type { TiptapMentionAttributes } from "@/opensource/components/business/MentionPanel/tiptap-plugin"
import {
	DirectoryMentionData,
	MentionItemType,
	ProjectFileMentionData,
} from "@/opensource/components/business/MentionPanel/types"
import { AttachmentItem } from "../components/TopicFilesButton/hooks"
import type {
	Topic,
	Workspace,
	ProjectListItem,
} from "@/opensource/pages/superMagic/pages/Workspace/types"
import { SuperMagicApi } from "@/opensource/apis"
import SuperMagicService from "../services"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

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
			data: {
				directory_id: fileItem.file_id,
				directory_name:
					fileItem.file_name || fileItem.filename || fileItem.display_filename,
				directory_path: fileItem.file_path || fileItem.relative_file_path,
				directory_metadata: fileItem.metadata,
			} as DirectoryMentionData,
		}
	}
	return {
		type: MentionItemType.PROJECT_FILE,
		data: {
			file_id: fileItem.file_id,
			file_name: fileItem.file_name || fileItem.filename || fileItem.display_filename,
			file_path: fileItem.file_path || fileItem.relative_file_path,
			file_extension: fileItem.file_extension,
		} as ProjectFileMentionData,
	}
}

/**
 * 添加文件到当前对话
 */
export function addFileToCurrentChat(options: AddToCurrentChatOptions) {
	const { fileItem, isNewTopic = false, autoFocus = false } = options

	// 转换为mention格式
	const mentionItem = convertFileToMention(fileItem)

	// 发布事件，通知MessageEditor添加文件并插入到编辑器
	// 注意：super_magic_add_file_to_chat 事件的处理函数会自动插入到编辑器
	pubsub.publish("super_magic_add_file_to_chat", {
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

	// 转换为mention格式
	const mentionItems = fileItems.map(convertFileToMention)

	// 发布事件，通知MessageEditor添加多个文件并插入到编辑器
	// 注意：super_magic_add_file_to_chat 事件的处理函数会自动插入到编辑器
	pubsub.publish("super_magic_add_file_to_chat", {
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
