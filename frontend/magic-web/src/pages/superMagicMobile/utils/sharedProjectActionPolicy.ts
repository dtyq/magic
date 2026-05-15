import { isOtherCollaborationProject } from "@/pages/superMagic/constants"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { isReadOnlyProject } from "@/pages/superMagic/utils/permission"

export type SharedProjectVisibleActionKey = "setCollaborators"

interface SharedProjectActionPolicy {
	showShareButton: boolean
	showMoreButton: boolean
	visibleActionKeys?: SharedProjectVisibleActionKey[]
	useSimplifiedSharedProjectActions: boolean
}

/**
 * 他人共享项目在移动端走轻量化动作集：有权限时仅保留分享和协作者，没权限时头部与菜单留空。
 * 自己共享出去的项目保持现有项目详情策略，不在这里做额外裁剪。
 */
export function buildSharedProjectActionPolicy(
	project?: ProjectListItem | null,
): SharedProjectActionPolicy {
	const isReadonly = isReadOnlyProject(project?.user_role)
	const isReceivedSharedProject = isOtherCollaborationProject(project)

	if (!isReceivedSharedProject) {
		return {
			showShareButton: !isReadonly,
			showMoreButton: true,
			visibleActionKeys: undefined,
			useSimplifiedSharedProjectActions: false,
		}
	}

	if (isReadonly) {
		return {
			showShareButton: false,
			showMoreButton: false,
			visibleActionKeys: [],
			useSimplifiedSharedProjectActions: true,
		}
	}

	return {
		showShareButton: true,
		showMoreButton: true,
		visibleActionKeys: ["setCollaborators"],
		useSimplifiedSharedProjectActions: true,
	}
}