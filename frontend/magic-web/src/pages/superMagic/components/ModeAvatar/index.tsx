import { IconType } from "../AgentSelector/types"
import { cn } from "@/lib/utils"
import CrewFallbackAvatar from "../CrewFallbackAvatar"

interface ModeAvatarData {
	name: string
	icon: string
	color: string
	icon_url: string
	icon_type: IconType
}

interface ModeAvatarProps {
	mode: ModeAvatarData
	className?: string
	iconSize?: number
	imageClassName?: string
	"data-testid"?: string
}

export function ModeAvatar({
	mode,
	className,
	iconSize = 16,
	imageClassName,
	"data-testid": dataTestId,
}: ModeAvatarProps) {
	const isImage = Boolean(mode.icon_url)

	return (
		<span
			className={cn(
				"relative flex shrink-0 items-center justify-center rounded-full border-2 border-popover shadow-sm",
				isImage ? "bg-muted" : "bg-secondary",
				className,
			)}
			style={{
				width: iconSize + 4,
				height: iconSize + 4,
			}}
			data-testid={dataTestId}
		>
			{isImage ? (
				<img
					src={mode.icon_url}
					alt={mode.name}
					width={iconSize}
					height={iconSize}
					draggable={false}
					className={cn("size-full rounded-full object-cover", imageClassName)}
				/>
			) : (
				// <IconComponent
				// 	selectedIcon={mode.icon}
				// 	size={iconSize - 8}
				// 	iconColor={mode.color}
				// />
				<CrewFallbackAvatar iconSize={iconSize - 16} />
			)}
		</span>
	)
}

export default ModeAvatar
