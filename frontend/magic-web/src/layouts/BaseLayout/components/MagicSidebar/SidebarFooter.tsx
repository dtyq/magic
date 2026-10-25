import { cn } from "@/utils/cn"
import type { SidebarFooterProps } from "./types"
import { ActionButtons, UserInfoCard } from "./components"

function SidebarFooter({ collapsed, onBusyChange }: SidebarFooterProps) {
	return (
		<div
			data-testid="sidebar-footer-root"
			className={cn(
				"flex w-full shrink-0 flex-col p-2",
				collapsed ? "items-center" : "items-start",
			)}
		>
			<ActionButtons collapsed={collapsed} />
			<div
				role="separator"
				className={cn(
					"my-1 border-t border-sidebar-border/60",
					collapsed ? "w-full" : "mx-2 self-stretch",
				)}
			/>
			<UserInfoCard collapsed={collapsed} onOpenChange={onBusyChange} />
		</div>
	)
}

export default SidebarFooter
