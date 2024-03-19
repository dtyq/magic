import { Folder } from "lucide-react"
import { memo } from "react"
import { cn } from "@/opensource/lib/utils"

interface ProjectIconProps {
	className?: string
	iconClassName?: string
}

function ProjectIcon({ className, iconClassName }: ProjectIconProps) {
	return (
		<div
			className={cn(
				"flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-sm bg-sidebar-foreground",
				className,
			)}
		>
			<Folder size={16} className={cn("text-primary-foreground", iconClassName)} />
		</div>
	)
}

export default memo(ProjectIcon)
