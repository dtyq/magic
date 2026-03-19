import { useCallback } from "react"
import superMagicService from "@/pages/superMagic/services"

interface NavigateToProjectItem {
	project_id?: string
	workspace_id?: string
	topic_id?: string // 可选的 topic_id，用于话题分享跳转
}

interface UseNavigateToProjectOptions {
	onClose?: () => void // 跳转后的回调，通常用于关闭弹层
}

/**
 * 跳转到项目的 hook
 * 统一处理分享管理列表中的项目跳转逻辑
 * 如果传入 topic_id，则会直接定位到对应的话题
 */
export function useNavigateToProject(options?: UseNavigateToProjectOptions) {
	const { onClose } = options || {}

	const navigateToProject = useCallback(
		(item: NavigateToProjectItem) => {
			const projectId = item.project_id
			const topicId = item.topic_id

			// 如果项目ID不存在，则不跳转
			if (!projectId) {
				return
			}

			// 传递 topic_id 给 switchProjectById（如果存在）
			superMagicService.switchProjectById(projectId, undefined, topicId)

			// 跳转后关闭弹层
			if (onClose) {
				onClose()
			}
		},
		[onClose],
	)

	return { navigateToProject }
}
