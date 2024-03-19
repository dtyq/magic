import type {
	ProjectListItem,
	Topic,
	Workspace,
} from "@/opensource/pages/superMagic/pages/Workspace/types"

export interface HierarchicalWorkspacePopupRef {
	/** 关闭Popup */
	close: () => void
	/** 显示Popup */
	show: () => void
	/** 显示并导航到指定工作区的项目列表 */
	showAndNavigateToWorkspace?: (
		workspace: Workspace,
		options?: { hideBackButton?: boolean },
	) => void
	/** 打开创建工作区弹窗 */
	openCreateWorkspaceModal?: () => void
	/** 为指定工作区创建项目 */
	createProjectInWorkspace?: (workspaceId: string) => Promise<void>
}

export interface HierarchicalWorkspacePopupProps {
	/** 设置用户选择详情 */
	setUserSelectDetail?: (detail: unknown) => void
}

/** 导航状态 */
export interface NavigationState {
	/** 当前层级 */
	level: "workspace" | "project" | "topic"
	/** 当前选中的工作区（在话题层级时使用） */
	currentWorkspace?: Workspace | null
	/** 当前选中的项目（在话题层级时使用） */
	currentProject?: ProjectListItem
	/** 是否隐藏返回按钮（用于独立入口场景） */
	hideBackButton?: boolean
}

/** 当前操作项 */
export interface CurrentActionItem {
	/** 操作类型 */
	type: "workspace" | "project" | "topic"
	/** 工作区 */
	workspace?: Workspace
	/** 项目 */
	project?: ProjectListItem
	/** 话题 */
	topic?: Topic
}

/** 工作区操作类型 */
export enum WorkspaceAction {
	RENAME = "rename",
	ARCHIVE = "archive",
	DELETE = "delete",
}

/** 话题操作类型 */
export enum TopicAction {
	RENAME = "rename",
	SHARE = "share",
	FILE = "file",
	DELETE = "delete",
}

/** 工作区操作字符串类型 */
export type WorkspaceActionString = "rename" | "archive" | "delete"

/** 话题操作字符串类型 */
export type TopicActionString = "rename" | "share" | "file" | "delete"
