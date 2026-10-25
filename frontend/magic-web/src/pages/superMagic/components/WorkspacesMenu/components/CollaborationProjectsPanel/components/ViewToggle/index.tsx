import { memo } from "react"
import { useTranslation } from "react-i18next"
import { LayoutGrid, LayoutList } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { cn } from "@/utils/cn"
import { type ViewToggleProps } from "../types"
import { ViewMode } from "@/pages/superMagic/components/EmptyWorkspacePanel/components/ProjectItem"

function ViewToggleComponent({ value, onChange }: ViewToggleProps) {
	const { t } = useTranslation("super")
	return (
		<div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
			<Tooltip>
				<TooltipTrigger asChild>
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
						aria-label={t("project.gridView")}
						aria-pressed={value === ViewMode.GRID}
					>
						<LayoutGrid className="size-[18px]" />
					</button>
				</TooltipTrigger>
				<TooltipContent>{t("project.gridView")}</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger asChild>
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
						aria-label={t("project.listView")}
						aria-pressed={value === ViewMode.LIST}
					>
						<LayoutList className="size-[18px]" />
					</button>
				</TooltipTrigger>
				<TooltipContent>{t("project.listView")}</TooltipContent>
			</Tooltip>
		</div>
	)
}

export default memo(ViewToggleComponent)
