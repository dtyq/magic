import type { FileReferenceSource } from "@/components/business/MentionPanel/utils/fileReferenceMention"
import { useEffect, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import { MousePointerClick } from "lucide-react"
import type { MenuProps } from "antd"
import type { AttachmentItem } from "../../../TopicFilesButton/hooks/types"
import { useAIEdit } from "../PPTRender/hooks/useAIEdit"
import { userStore } from "@/models/user"
import { projectStore, topicStore } from "@/pages/superMagic/stores/core"

interface AIEditMenuOptions {
	attachmentList?: AttachmentItem[]
	fileId?: string
	file?: FileReferenceSource
	enabled: boolean
	maxItems?: number
	onPrimaryAction?: () => void
	isPrimaryActive?: boolean
}

/** 普通文件保留五项 AI 操作；HTML／PPT 保留原三项及独立的多目标编辑入口。 */
export function useAIEditMenuItems({
	attachmentList,
	file,
	fileId,
	enabled,
	maxItems,
	onPrimaryAction,
	isPrimaryActive = false,
}: AIEditMenuOptions): MenuProps["items"] {
	const { t } = useTranslation("super")
	const scopeRef = useRef({ fileId, enabled })
	scopeRef.current = { fileId, enabled }
	const mountedRef = useRef(false)
	useEffect(() => {
		mountedRef.current = true
		return () => {
			mountedRef.current = false
		}
	}, [])
	const userId = userStore.user.userInfo?.magic_id
	const organizationCode = userStore.user.organizationCode
	const projectId = projectStore.selectedProject?.id
	const topicId = topicStore.selectedTopic?.id
	const currentFile = useMemo(
		() => file ?? attachmentList?.find((item) => item.file_id === fileId),
		[file, attachmentList, fileId],
	)
	const { aiEditItems } = useAIEdit({ currentFile })
	return useMemo(() => {
		if (!enabled || !fileId) return []
		// 退出确认会等待用户决定；等待期间切换文件、话题或身份后，旧菜单不能再写入新输入框。
		const currentAction = (action: () => void) => () => {
			if (
				!mountedRef.current ||
				!scopeRef.current.enabled ||
				scopeRef.current.fileId !== fileId ||
				userStore.user.userInfo?.magic_id !== userId ||
				userStore.user.organizationCode !== organizationCode ||
				projectStore.selectedProject?.id !== projectId ||
				topicStore.selectedTopic?.id !== topicId
			)
				return
			action()
		}
		const items = maxItems === undefined ? aiEditItems : aiEditItems.slice(0, maxItems)
		return [
			{
				key: "ai-edit",
				icon: <MousePointerClick size={16} />,
				label: t("topicFiles.AIOptimization"),
				children: [
					...(onPrimaryAction
						? [
								{
									key: "ai-edit-selection",
									icon: <MousePointerClick size={16} />,
									label: t(
										isPrimaryActive
											? "topicFiles.exitMultiSelection"
											: "topicFiles.multiSelection",
									),
									onClick: currentAction(onPrimaryAction),
								},
							]
						: []),
					...items.map((item) => ({
						key: `ai-edit-${item.key}`,
						icon: item.icon,
						disabled: !currentFile,
						label: (
							<div className="flex max-w-72 flex-col gap-1">
								<span>{item.label}</span>
								<span className="whitespace-normal text-xs text-muted-foreground">
									{item.description}
								</span>
							</div>
						),
						onClick: currentAction(item.onClick),
					})),
				],
			},
		]
	}, [
		enabled,
		fileId,
		aiEditItems,
		maxItems,
		onPrimaryAction,
		isPrimaryActive,
		currentFile,
		userId,
		organizationCode,
		projectId,
		topicId,
		t,
	])
}
