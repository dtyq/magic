import MagicIcon from "@/components/base/MagicIcon"
import { IconChevronRight, IconDots } from "@tabler/icons-react"
import { memo } from "react"
import { cn } from "@/lib/utils"
import type { WorkspaceListItemProps } from "./types"
import { useMemoizedFn } from "ahooks"
import WorkspaceIcon from "../WorkspaceIcon"

function WorkspaceListItem({
	workspace,
	isSelected,
	onSelect,
	onActionClick,
	onNavigate,
	emptyText,
}: WorkspaceListItemProps) {
	const handleNavigate = useMemoizedFn((e: React.MouseEvent<HTMLDivElement>) => {
		e.stopPropagation()
		e.preventDefault()
		onNavigate(workspace)
	})

	return (
		<div
			className={cn(
				"relative mx-2.5 mb-0.5 flex h-11 cursor-pointer overflow-hidden rounded-lg bg-background px-3 py-3 pl-2 transition-all duration-200 last:mb-0",
				isSelected && "bg-primary-10",
			)}
			onClick={() => onSelect(workspace)}
		>
			<div className="flex w-full flex-1 items-center justify-between">
				<div className="flex w-full min-w-0 items-center gap-2">
					<WorkspaceIcon />
					<div className="min-w-0 items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-normal text-foreground">
						{workspace.name || emptyText}
					</div>
				</div>
				<div className="ml-0 flex items-center gap-3.5">
					<MagicIcon
						size={18}
						component={IconDots}
						onClick={(e) => {
							e.stopPropagation()
							onActionClick(workspace)
						}}
					/>
					<div className="flex items-center justify-center" onClick={handleNavigate}>
						<MagicIcon
							size={18}
							component={IconChevronRight}
							className="text-muted-foreground/60 transition-all duration-200 hover:translate-x-0.5 hover:text-muted-foreground"
						/>
					</div>
				</div>
			</div>
		</div>
	)
}

export default memo(WorkspaceListItem)
