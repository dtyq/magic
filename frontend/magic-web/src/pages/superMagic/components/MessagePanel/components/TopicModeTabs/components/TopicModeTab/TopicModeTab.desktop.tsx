import { cva } from "class-variance-authority"
import { TopicMode, type ModeItem } from "../../../../../../pages/Workspace/types"
import IconComponent from "@/pages/superMagic/components/IconViewComponent/index"
import SmartTooltip from "@/components/other/SmartTooltip"
import { IconBackground } from "../../icons"
import { getModeBgColor } from "@/pages/superMagic/components/TopicMode/modeColor"
import { IconType } from "../../../../../AgentSelector/types"
import { cn } from "@/lib/utils"

const DESKTOP_ICON_SIZE = 28

// Style variants using CVA
const tabContainerVariants = cva(
	"flex h-full min-w-[100px] flex-col items-center gap-2 rounded-lg px-2 pb-0 pt-2",
	{
		variants: {
			isActive: {
				true: "cursor-default",
				false: "cursor-pointer",
			},
		},
		defaultVariants: {
			isActive: false,
		},
	},
)

const tabIconVariants = cva("relative z-10 flex items-center justify-center", {
	variants: {
		size: {
			desktop: "h-[50px] w-[50px]",
			mobile: "size-6",
		},
	},
	defaultVariants: {
		size: "desktop",
	},
})

const tabTitleVariants = cva(
	"overflow-hidden text-ellipsis text-center text-sm leading-5 text-[color:var(--magic-color-text-1)]",
	{
		variants: {
			isActive: {
				true: "font-semibold text-[color:var(--magic-color-text-0)]",
				false: "font-normal",
			},
		},
		defaultVariants: {
			isActive: false,
		},
	},
)

const activeIndicatorVariants = cva("h-1 w-6 rounded bg-primary", {
	variants: {
		isActive: {
			true: "visible",
			false: "invisible",
		},
	},
	defaultVariants: {
		isActive: false,
	},
})

interface TopicModeTabDesktopProps {
	tab: ModeItem
	isActive: boolean
	onModeChange: (topicMode: TopicMode) => void
}

function TopicModeTabDesktop({ tab, isActive, onModeChange }: TopicModeTabDesktopProps) {
	const getModeIcon = () => {
		const isImage = tab.mode.icon_type === IconType.Image
		return isImage && tab.mode.icon_url ? (
			<img
				src={tab.mode.icon_url}
				alt="icon"
				width={DESKTOP_ICON_SIZE}
				height={DESKTOP_ICON_SIZE}
			/>
		) : (
			<IconComponent
				selectedIcon={tab.mode.icon}
				size={DESKTOP_ICON_SIZE}
				iconColor={tab.mode.color}
			/>
		)
	}

	const getModeIconBgColor = () => {
		return tab.mode.icon_type === IconType.Image
			? tab.mode.color
			: getModeBgColor(tab.mode.color, 0.1)
	}

	return (
		<div
			className={cn(tabContainerVariants({ isActive }))}
			onClick={() => onModeChange(tab.mode.identifier as TopicMode)}
			data-testid={`topic-mode-tab-${tab.mode.identifier}`}
			data-active={isActive}
		>
			{/* Icon Wrapper */}
			<div className="relative">
				{/* Icon */}
				<div className={cn(tabIconVariants({ size: "desktop" }))}>{getModeIcon()}</div>
				{/* Icon Background */}
				<div
					className="absolute inset-0 flex items-center justify-center"
					style={{ color: getModeIconBgColor() }}
				>
					<IconBackground />
				</div>
			</div>

			{/* Title */}
			<SmartTooltip
				className={cn(tabTitleVariants({ isActive }))}
				data-testid={`topic-mode-tab-title-${tab.mode.identifier}`}
				maxWidth={90}
				maxLines={2}
			>
				{tab.mode.name}
			</SmartTooltip>

			{/* Active Indicator */}
			<div className={cn(activeIndicatorVariants({ isActive }))} />
		</div>
	)
}

export default TopicModeTabDesktop
