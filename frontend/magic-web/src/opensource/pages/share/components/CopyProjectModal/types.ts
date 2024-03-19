import { Workspace } from "@/opensource/pages/superMagic/pages/Workspace/types"

export interface CopyProjectModalProps {
	open: boolean
	onCancel: () => void
	/** 项目数据，从share页面传入 */
	projectData: {
		/** 原项目作者 */
		originalAuthor: string
		/** 原项目名称 */
		originalProjectName: string
		/** 项目ID，用于复制（旧接口） */
		projectId: string
		/** 新项目名称，默认值 */
		defaultNewProjectName: string
		/** 资源ID，用于新接口 */
		resourceId?: string
		/** 访问密码，用于新接口 */
		password?: string
	}
	/** 复制成功后的回调 */
	onCopySuccess?: (copiedProject: CopiedProjectResponse, selectedWorkspaceId: string) => void
}

export interface WorkspaceOption extends Workspace {
	/** 是否是新建的工作区选项 */
	isCreateNew?: boolean
}

export interface CopyProjectRequest {
	/** 原项目ID */
	source_project_id: string
	/** 目标工作区ID */
	target_workspace_id: string
	/** 新项目名称 */
	target_project_name: string
}

export interface CopiedProjectResponse {
	/** 复制后的项目ID */
	project_id: string
	/** 复制后的项目名称 */
	project_name: string
	/** 目标工作区ID */
	workspace_id: string
	/** 目标工作区名称 */
	workspace_name: string
}
