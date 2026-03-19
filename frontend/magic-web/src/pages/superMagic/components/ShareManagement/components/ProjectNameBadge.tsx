import { memo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { Badge } from "@/components/shadcn-ui/badge"
import { IconExternalLink } from "@tabler/icons-react"
import superMagicService from "@/pages/superMagic/services"
import { projectStore } from "@/pages/superMagic/stores/core"

interface ProjectNameBadgeProps {
	projectId?: string
	projectName?: string
	className?: string
	variant?: "default" | "secondary" | "outline" | "destructive"
	showIcon?: boolean // 是否显示外部链接图标
	clickable?: boolean // 是否可点击跳转，默认为 true
}

function ProjectNameBadge({
	projectId,
	projectName,
	className = "",
	variant = "secondary",
	showIcon = true,
	clickable = true,
}: ProjectNameBadgeProps) {
	const { t } = useTranslation("super")

	const handleClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation() // 阻止事件冒泡，避免触发父元素的点击事件
			if (projectId && projectId !== projectStore.selectedProject?.id) {
				superMagicService.switchProjectById(projectId)
			}
		},
		[projectId],
	)

	const displayName = projectName || t("common.untitledProject")

	// 如果 clickable 为 false，或者没有 projectId，则不可点击
	const isClickable = clickable && !!projectId

	return (
		<Badge
			variant={variant}
			className={`flex-shrink-0 rounded-full px-2 py-1 text-xs leading-none ${isClickable ? "cursor-pointer hover:opacity-80" : ""
				} ${className}`}
			onClick={isClickable ? handleClick : undefined}
		>
			<span className="flex items-center gap-1">
				{displayName}
				{/* {isClickable && showIcon && (
					<IconExternalLink size={12} className="flex-shrink-0" />
				)} */}
			</span>
		</Badge>
	)
}

export default memo(observer(ProjectNameBadge))
