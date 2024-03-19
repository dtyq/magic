import { cn } from "@/opensource/lib/utils"
import type { SidebarFooterProps } from "./types"
import { ActionButtons, UserInfoCard } from "./components"

function SidebarFooter({ collapsed }: SidebarFooterProps) {
	return (
		<div
			data-testid="sidebar-footer-root"
			className={cn(
				"flex w-full shrink-0 flex-col p-2",
				collapsed ? "items-center" : "items-start",
			)}
		>
			<ActionButtons collapsed={collapsed} />
			<UserInfoCard collapsed={collapsed} />
		</div>
	)
}

export default SidebarFooter
