import type { FileScope } from "@/apis/modules/fileScope"
import type { FileReference } from "@/apis/modules/superMagic"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import type { ProjectListItem, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import type { AttachmentItem } from "./hooks/types"
import type { Key } from "react"
import type { DirectorySource } from "../SelectPathModal/components/SelectDirectoryModal/types"
import type { UploadTarget } from "./hooks/useUploadWithModal"
import type { UseRenameOptions } from "./hooks/useRename"

/** 用户空间只提供数据与操作边界，交互状态仍由原文件组件持有。 */
export interface TopicFilesDirectorySource extends DirectorySource {
	expandedKeys: Key[]
	onExpandedKeysChange: (keys: Key[]) => void
	loadDirectory: (id: string) => Promise<unknown>
	getPath: (id: string) => AttachmentItem[]
	locateFileId?: string
}

export interface TopicFilesOperations extends Pick<
	UseRenameOptions,
	"isCurrent" | "resolveSiblings" | "beforeRename" | "onRenameSuccess" | "allowDotStart"
> {
	resolveCreateParent: (parentPath?: string) => Promise<string>
	resolveCreateSiblings: (parentPath?: string) => Promise<AttachmentItem[]>
	onNodeCreated: (file: AttachmentItem) => Promise<AttachmentItem>
	resolveDeleteItems: (items: AttachmentItem[]) => Promise<AttachmentItem[]>
	beforeDelete: (ids: string[]) => Promise<boolean>
	onFilesDeleted: (ids: string[]) => void
	onDirectoryMoveComplete: (files: AttachmentItem[], targetId: string) => void
	resolveUploadTarget: (item?: AttachmentItem) => Promise<UploadTarget>
}

/** 文件树在不同空间下可启用的交互能力。 */
export interface TopicFilesCapabilities {
	upload: boolean
	move: boolean
	replace: boolean
	share: boolean
	addToChat: boolean
	crossProject: boolean
	copy: boolean
	importFromOtherProject: boolean
	projectContentCreation: boolean
	multiSelect: boolean
}

/** 特殊文件空间加入对话时使用的上下文与 mention 构造规则。 */
export interface TopicFilesChatContext {
	selectedProject?: ProjectListItem | null
	selectedWorkspace?: Workspace | null
	createAttachmentMention?: (item: AttachmentItem) => Promise<TiptapMentionAttributes | null>
	/** 拖拽只携带文件身份，异步引用查询在接收输入框执行。 */
	fileSpaceType?: FileReference["space_type"]
}

/** 文件树空间配置。 */
export interface TopicFilesSpaceConfig {
	scope?: FileScope
	directorySource?: TopicFilesDirectorySource
	operations?: TopicFilesOperations
	capabilities?: Partial<TopicFilesCapabilities>
	chatContext?: TopicFilesChatContext
}

/** 项目文件默认能力，未传空间配置时保持原有行为。 */
export const DEFAULT_TOPIC_FILES_CAPABILITIES: TopicFilesCapabilities = {
	upload: true,
	move: true,
	replace: true,
	share: true,
	addToChat: true,
	crossProject: true,
	copy: true,
	importFromOtherProject: true,
	projectContentCreation: true,
	multiSelect: true,
}

/** 合并调用方传入的能力配置。 */
export function resolveTopicFilesCapabilities(
	capabilities?: Partial<TopicFilesCapabilities>,
): TopicFilesCapabilities {
	return {
		...DEFAULT_TOPIC_FILES_CAPABILITIES,
		...capabilities,
	}
}
