import { IconType } from "../AgentSelector/types"
import { cn } from "@/lib/utils"
import CrewFallbackAvatar from "../CrewFallbackAvatar"
// import IconComponent from "../IconViewComponent"

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
	const hasIcon = Boolean(mode.icon)
	const fallbackIconSize = Math.max(iconSize - 4, 12)

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
				// hasIcon ? (
				// 	<IconComponent
				// 		iconType={mode.icon_type}
				// 		iconUrl={mode.icon_url}
				// 		selectedIcon={mode.icon}
				// 		size={iconSize}
				// 		iconColor={mode.color}
				// 		showBorder={false}
				// 	/>
				// ) :
				<CrewFallbackAvatar iconSize={fallbackIconSize} />
			)}
		</span>
	)
}

export default ModeAvatar
