import { MessageSquare } from "lucide-react"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/shadcn-ui/empty"
import { cn } from "@/lib/utils"

interface ProjectTopicsEmptyStateProps {
	className?: string
}

/**
 * Project detail topics tab empty state: centered icon, title, and hint toward the composer below.
 */
function ProjectTopicsEmptyState({ className }: ProjectTopicsEmptyStateProps) {
	const { t } = useTranslation("super")

	return (
		<Empty
			className={cn("shrink-0 gap-0 border-0 bg-transparent p-0 md:p-0", className)}
			data-testid="project-topics-empty-state"
		>
			<EmptyHeader className="max-w-[280px] gap-3">
				<EmptyMedia
					variant="icon"
					className="mb-0 size-14 rounded-full border-0 bg-muted text-muted-foreground [&_svg]:size-7"
				>
					<MessageSquare className="size-7 stroke-[1.5]" aria-hidden />
				</EmptyMedia>
				<EmptyTitle className="text-base font-medium tracking-normal">
					{t("projectDetail.topicsEmptyState.title")}
				</EmptyTitle>
				<EmptyDescription className="text-sm leading-5 text-muted-foreground">
					{t("projectDetail.topicsEmptyState.description")}
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	)
}

export default memo(ProjectTopicsEmptyState)
