import { cva } from "class-variance-authority"
import { TopicMode, type ModeItem } from "../../../../../../pages/Workspace/types"
import IconComponent from "@/opensource/pages/superMagic/components/IconViewComponent/index"
import { IconBackground } from "../../icons"
import { getModeBgColor } from "@/opensource/pages/superMagic/components/TopicMode/modeColor"
import { IconType } from "../../../../../AgentSelector/types"
import { cn } from "@/opensource/lib/utils"

const MOBILE_ICON_SIZE = 20

// Style variants using CVA
const mobileTabContainerVariants = cva(
	"inline-flex h-[36px] w-fit shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full border border-solid py-2 pl-2 pr-3.5",
	{
		variants: {
			isActive: {
				true: "border-blue-500 bg-blue-500/10 dark:border-blue-600 dark:bg-blue-500/20",
				false: "border-border bg-sidebar",
			},
		},
		defaultVariants: {
			isActive: false,
		},
	},
)

const mobileTabIconWrapperVariants = cva(
	"relative flex shrink-0 items-center justify-center overflow-clip rounded-[5px]",
	{
		variants: {
			size: {
				default: "size-6",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
)

const mobileTabIconVariants = cva("relative z-10 flex size-full items-center justify-center")

const mobileTabTitleVariants = cva("mb-0 shrink-0 text-sm leading-5", {
	variants: {
		isActive: {
			true: "font-medium text-foreground",
			false: "font-normal text-foreground",
		},
	},
	defaultVariants: {
		isActive: false,
	},
})

interface TopicModeTabMobileProps {
	tab: ModeItem
	isActive: boolean
	onModeChange: (topicMode: TopicMode) => void
}

function TopicModeTabMobile({ tab, isActive, onModeChange }: TopicModeTabMobileProps) {
	const getModeIcon = () => {
		const isImage = tab.mode.icon_type === IconType.Image
		return isImage && tab.mode.icon_url ? (
			<img
				src={tab.mode.icon_url}
				alt="icon"
				width={MOBILE_ICON_SIZE}
				height={MOBILE_ICON_SIZE}
			/>
		) : (
			<IconComponent
				selectedIcon={tab.mode.icon}
				size={MOBILE_ICON_SIZE}
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
			className={cn(mobileTabContainerVariants({ isActive }))}
			onClick={() => onModeChange(tab.mode.identifier as TopicMode)}
			data-testid={`topic-mode-tab-${tab.mode.identifier}`}
			data-active={isActive}
		>
			{/* Icon Wrapper with Background */}
			<div className={cn(mobileTabIconWrapperVariants())}>
				{/* Icon Background Layer */}
				<div
					className="absolute inset-0 flex items-center justify-center"
					style={{ color: getModeIconBgColor() }}
				>
					<IconBackground />
				</div>
				{/* Icon Layer */}
				<div className={cn(mobileTabIconVariants())}>{getModeIcon()}</div>
			</div>

			{/* Title */}
			<p
				className={cn(mobileTabTitleVariants({ isActive }))}
				data-testid={`topic-mode-tab-title-${tab.mode.identifier}`}
			>
				{tab.mode.name}
			</p>
		</div>
	)
}

export default TopicModeTabMobile
