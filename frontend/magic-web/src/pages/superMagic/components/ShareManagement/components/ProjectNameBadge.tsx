import { memo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { Badge } from "@/components/shadcn-ui/badge"
import superMagicService from "@/pages/superMagic/services"
import { projectStore } from "@/pages/superMagic/stores/core"
import { cn } from "@/utils/cn"

interface ProjectNameBadgeProps {
	projectId?: string
	projectName?: string
	className?: string
	variant?: "default" | "secondary" | "outline" | "destructive"
	clickable?: boolean
}

function ProjectNameBadge({
	projectId,
	projectName,
	className = "",
	variant = "secondary",
	clickable = true,
}: ProjectNameBadgeProps) {
	const { t } = useTranslation("super")

	const handleClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			if (projectId && projectId !== projectStore.selectedProject?.id) {
				superMagicService.switchProjectById(projectId)
			}
		},
		[projectId],
	)

	const displayName = projectName || t("common.untitledProject")
	const isClickable = clickable && !!projectId

	return (
		<Badge
			variant={variant}
			className={cn(
				"min-w-0 max-w-[200px] shrink rounded-full px-2 py-1 text-xs leading-none",
				isClickable && "cursor-pointer hover:opacity-80",
				className,
			)}
			onClick={isClickable ? handleClick : undefined}
		>
			<span className="flex min-w-0 items-center gap-1">
				<span className="truncate" title={displayName}>
					{displayName}
				</span>
			</span>
		</Badge>
	)
}

export default memo(observer(ProjectNameBadge))
