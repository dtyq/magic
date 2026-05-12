import { Box, FolderDot } from "lucide-react"
import { cn } from "@/lib/utils"
import StatusIcon from "@/pages/superMagic/components/MessageHeader/components/StatusIcon"
import { ProjectStatus, WorkspaceStatus } from "@/pages/superMagic/pages/Workspace/types"

interface NavigationStatusIconProps {
	itemType: "workspace" | "project"
	status?: WorkspaceStatus | ProjectStatus
	className?: string
	/** 为 false 时仅在 `running` 时渲染状态图标；非 running 不展示默认 Box/FolderDot，且无占位 */
	showDefaultIcon?: boolean
}

function NavigationStatusIcon({
	itemType,
	status,
	className,
	showDefaultIcon = true,
}: NavigationStatusIconProps) {
	if (status === "running") {
		return (
			<span
				className={cn("flex size-4 shrink-0 items-center justify-center", className)}
				data-testid="navigation-status-icon-root"
			>
				<span
					className="flex size-4 items-center justify-center leading-none"
					data-testid="navigation-status-icon-running"
				>
					<StatusIcon status={WorkspaceStatus.RUNNING} className="block" />
				</span>
			</span>
		)
	}

	if (!showDefaultIcon) return null

	return (
		<span
			className={cn("flex size-4 shrink-0 items-center justify-center", className)}
			data-testid="navigation-status-icon-root"
		>
			<span data-testid="navigation-status-icon-default" data-icon-kind={itemType}>
				{itemType === "workspace" ? <Box size={16} /> : <FolderDot size={16} />}
			</span>
		</span>
	)
}

export default NavigationStatusIcon
