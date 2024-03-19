import { memo } from "react"
import { LayoutGrid, LayoutList } from "lucide-react"
import { cn } from "@/opensource/lib/utils"
import { type ViewToggleProps } from "../types"
import { ViewMode } from "@/opensource/pages/superMagic/components/EmptyWorkspacePanel/components/ProjectItem"

function ViewToggleComponent({ value, onChange }: ViewToggleProps) {
	return (
		<div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
			<button
				type="button"
				className={cn(
					"flex h-[26px] w-[34px] cursor-pointer items-center justify-center rounded-lg transition-all duration-200",
					"text-[rgb(var(--muted-foreground-rgb))]",
					"hover:bg-[rgb(var(--muted-rgb))]",
					value === ViewMode.GRID &&
						"bg-white text-[rgb(var(--foreground-rgb))] shadow-[0px_4px_14px_0px_rgba(0,0,0,0.1),0px_0px_1px_0px_rgba(0,0,0,0.3)]",
				)}
				onClick={() => onChange(ViewMode.GRID)}
				data-testid="super-view-toggle-grid"
				aria-label="Grid view"
			>
				<LayoutGrid className="size-[18px]" />
			</button>
			<button
				type="button"
				className={cn(
					"flex h-[26px] w-[34px] cursor-pointer items-center justify-center rounded-lg transition-all duration-200",
					"text-[rgb(var(--muted-foreground-rgb))]",
					"hover:bg-[rgb(var(--muted-rgb))]",
					value === ViewMode.LIST &&
						"bg-white text-[rgb(var(--foreground-rgb))] shadow-[0px_4px_14px_0px_rgba(0,0,0,0.1),0px_0px_1px_0px_rgba(0,0,0,0.3)]",
				)}
				onClick={() => onChange(ViewMode.LIST)}
				data-testid="super-view-toggle-list"
				aria-label="List view"
			>
				<LayoutList className="size-[18px]" />
			</button>
		</div>
	)
}

export default memo(ViewToggleComponent)
