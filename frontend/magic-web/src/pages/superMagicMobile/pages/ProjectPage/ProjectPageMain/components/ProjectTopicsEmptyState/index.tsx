import { memo } from "react"
import { cn } from "@/lib/utils"
import { DataEmptyState } from "@/pages/superMagicMobile/components/DataEmptyState"

interface ProjectTopicsEmptyStateProps {
	className?: string
}

/**
 * Topic list empty state aligned with prototype: icon, title, and composer hint (not brand hero).
 */
function ProjectTopicsEmptyState({ className }: ProjectTopicsEmptyStateProps) {
	return (
		<DataEmptyState
			variant="topic"
			className={cn("flex-1 px-6", className)}
			testId="project-topics-empty-state"
		/>
	)
}

export default memo(ProjectTopicsEmptyState)
