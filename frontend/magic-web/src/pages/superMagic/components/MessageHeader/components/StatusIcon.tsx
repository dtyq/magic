import type { ProjectStatus, WorkspaceStatus } from "../../../pages/Workspace/types"
import { TaskStatus } from "../../../pages/Workspace/types"
import { cn } from "@/lib/utils"
import { Circle, CircleCheck, Loader, TriangleAlert } from "lucide-react"

interface StatusIconProps {
	status?: WorkspaceStatus | ProjectStatus | TaskStatus
	size?: number
	className?: string
	customFill?: boolean
}

const baseIcon = "inline-flex shrink-0 items-center justify-center overflow-visible text-foreground"

function StatusIcon({ status, size = 16, className, customFill = false }: StatusIconProps) {
	// Figma 16px Lucide：偏细描边；更小尺寸略加厚保证可读
	const strokeWidth = size <= 12 ? 2 : 1.5
	const normalizedStatus = status === TaskStatus.WAITING_FOR_USER ? TaskStatus.RUNNING : status

	switch (normalizedStatus) {
		case "running":
			return (
				<Loader
					size={size}
					strokeWidth={strokeWidth}
					className={cn(baseIcon, "animate-spin-slow opacity-90", className)}
					aria-hidden
				/>
			)
		case "finished":
			return (
				<CircleCheck
					size={size}
					strokeWidth={strokeWidth}
					className={cn(baseIcon, "opacity-90", className)}
					aria-hidden
				/>
			)
		case "error":
			return (
				<TriangleAlert
					size={size}
					strokeWidth={strokeWidth}
					className={cn(baseIcon, "opacity-90", className)}
					aria-hidden
				/>
			)
		case "suspended":
		case "waiting":
		default:
			return (
				<Circle
					size={size}
					strokeWidth={strokeWidth}
					className={cn(
						baseIcon,
						// 设计稿「未开始」为线框圆；TimeoutTips 等通过父级 !important 注入填充时不再强制 fill-none
						customFill ? "opacity-90" : "fill-none opacity-90",
						className,
					)}
					aria-hidden
				/>
			)
	}
}

export default StatusIcon
