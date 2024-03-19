import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import {
	SHARE_WORKSPACE_DATA,
	isCollaborationWorkspace,
} from "@/opensource/pages/superMagic/constants"
import SuperMagicService from "@/opensource/pages/superMagic/services"
import type { Workspace } from "@/opensource/pages/superMagic/pages/Workspace/types"

interface UseSharedWorkspaceOptions {
	/**
	 * 是否在移动端弹窗内导航模式
	 * 为 true 时，不会调用 switchWorkspace，而是由调用方自行处理导航逻辑
	 */
	inPopupNavigation?: boolean
}

/**
 * 共享工作区操作的可复用 hook
 * 用于在不同组件中触发共享工作区的导航和项目加载
 */
export function useSharedWorkspace(options: UseSharedWorkspaceOptions = {}) {
	const { inPopupNavigation = false } = options
	const { t } = useTranslation("super")

	/**
	 * 打开共享工作区
	 * 会切换到共享工作区（PC端）或返回共享工作区数据（移动端弹窗内）
	 */
	const openSharedWorkspace = useMemoizedFn(() => {
		const sharedWorkspace = SHARE_WORKSPACE_DATA(t)
		if (!inPopupNavigation) {
			SuperMagicService.switchWorkspace(sharedWorkspace)
		}
		return sharedWorkspace
	})

	/**
	 * 导航到共享工作区（不切换当前工作区，用于弹窗内导航）
	 * @param onNavigate 导航回调，用于在弹窗内切换到项目列表层级
	 */
	const navigateToSharedWorkspace = useMemoizedFn(
		(onNavigate?: (workspace: Workspace) => void) => {
			const sharedWorkspace = SHARE_WORKSPACE_DATA(t)
			if (onNavigate) {
				onNavigate(sharedWorkspace)
			}
		},
	)

	/**
	 * 获取共享工作区数据
	 */
	const getSharedWorkspaceData = useMemoizedFn(() => SHARE_WORKSPACE_DATA(t))

	return {
		openSharedWorkspace,
		navigateToSharedWorkspace,
		getSharedWorkspaceData,
		isCollaborationWorkspace,
	}
}
