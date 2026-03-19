import { cn } from "@/lib/utils"
import type { CrewItem } from "@/pages/superMagic/pages/Workspace/types"
import IconComponent from "@/pages/superMagic/components/IconViewComponent/index"
import { IconType } from "@/pages/superMagic/components/AgentSelector/types"
import { useTranslation } from "react-i18next"

const CREW_ICON_SIZE = 20

interface CrewModeItemProps {
	crew: CrewItem
	isActive: boolean
	onClick: (crew: CrewItem) => void
}

export default function CrewModeItem({ crew, isActive, onClick }: CrewModeItemProps) {
	const { t } = useTranslation("crew/create")

	// const isImage = crew.mode.icon_type === IconType.Image

	return (
		<div
			className={cn(
				"relative flex h-9 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full border border-solid px-4 py-2 shadow-xs",
				isActive
					? "border-2 border-foreground bg-background"
					: "border-border bg-background",
			)}
			onClick={() => onClick(crew)}
			data-testid={`crew-mode-item-${crew.mode.identifier}`}
		>
			{/* 选中状态的点阵背景 */}
			{isActive && (
				<div
					className="absolute inset-0 opacity-[0.05]"
					style={{
						backgroundImage: "radial-gradient(circle, #0a0a0a 1px, transparent 1px)",
						backgroundSize: "4px 4px",
						backgroundPosition: "0 0, 2px 2px",
					}}
				/>
			)}

			{/* Icon */}
			<div className="flex size-5 shrink-0 items-center justify-center">
				{crew.mode.icon_url ? (
					<img
						src={crew.mode.icon_url}
						alt="icon"
						width={CREW_ICON_SIZE}
						height={CREW_ICON_SIZE}
						draggable={false}
					/>
				) : (
					<IconComponent
						selectedIcon={crew.mode.icon}
						size={CREW_ICON_SIZE}
						iconColor={crew.mode.color}
					/>
				)}
			</div>

			{/* Title */}
			<div
				className={cn(
					"max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-5 text-foreground",
					isActive && "font-medium",
				)}
			>
				{crew.mode.name || t("untitledCrew")}
			</div>
		</div>
	)
}
