import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

export function RecycleBinSidebar({ tabs, activeTabId, onTabChange }: RecycleBinSidebarProps) {
	const { t } = useTranslation("super")

	return (
		<div
			className="flex w-[200px] shrink-0 flex-col gap-1"
			role="tablist"
			aria-label={t("recycleBin.sidebarAriaLabel")}
		>
			<div
				className={cn(
					"flex h-8 shrink-0 items-stretch justify-stretch gap-[129px] rounded-md px-2 text-xs font-medium text-muted-foreground opacity-70",
				)}
			>
				{t("recycleBin.sidebarDeleted")}
			</div>
			{tabs.map((tab) => {
				const isActive = tab.id === activeTabId

				return (
					<button
						key={tab.id}
						type="button"
						role="tab"
						aria-selected={isActive}
						tabIndex={isActive ? 0 : -1}
						className={cn(
							"flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm leading-none",
							isActive
								? "bg-muted font-medium text-foreground"
								: "font-normal text-foreground hover:bg-muted/60",
						)}
						onClick={() => onTabChange(tab.id)}
					>
						{t(tab.labelKey, { count: tab.count })}
					</button>
				)
			})}
		</div>
	)
}

interface RecycleBinSidebarProps {
	tabs: RecycleBinTab[]
	activeTabId: string
	onTabChange: (tabId: string) => void
}

interface RecycleBinTab {
	id: string
	labelKey: string
	count: number
}
