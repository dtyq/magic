import MagicIcon from "@/components/base/MagicIcon"
import { IconLayersLinked } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

interface CollaborationShortCutProps {
	className?: string
}

function CollaborationShortCut({ className }: CollaborationShortCutProps) {
	return (
		<div
			className={cn(
				"flex h-[18px] w-[18px] items-center justify-center rounded-sm border border-border/60 text-muted-foreground",
				className,
			)}
		>
			<MagicIcon
				component={IconLayersLinked}
				size={12}
				className="!h-[12px] !w-[12px]"
				color="currentColor"
			/>
		</div>
	)
}

export default CollaborationShortCut
