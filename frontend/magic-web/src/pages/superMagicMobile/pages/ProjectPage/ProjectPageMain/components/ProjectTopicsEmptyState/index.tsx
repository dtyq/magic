import { memo } from "react"
import { cn } from "@/lib/utils"
import MobileBrandHero from "@/pages/superMagicMobile/components/MobileBrandHero"

interface ProjectTopicsEmptyStateProps {
	className?: string
}

/**
 * 话题空态与移动端对话空态复用同一品牌欢迎区，避免首页/对话/话题三处长期分叉。
 */
function ProjectTopicsEmptyState({ className }: ProjectTopicsEmptyStateProps) {
	return (
		<MobileBrandHero
			className={cn("px-6", className)}
			imageClassName="size-[76px] rounded-[26px]"
			dataTestId="project-topics-empty-state"
		/>
	)
}

export default memo(ProjectTopicsEmptyState)
