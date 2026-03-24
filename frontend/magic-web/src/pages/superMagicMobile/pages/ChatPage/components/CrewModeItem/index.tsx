import { cn } from "@/lib/utils"
import type { CrewItem } from "@/pages/superMagic/pages/Workspace/types"
import ModeAvatar from "@/pages/superMagic/components/ModeAvatar"
import { useTranslation } from "react-i18next"

const CREW_AVATAR_PX = 28

interface CrewModeItemProps {
	crew: CrewItem
	isActive: boolean
	onClick: (crew: CrewItem) => void
}

export default function CrewModeItem({ crew, isActive, onClick }: CrewModeItemProps) {
	const { t } = useTranslation("crew/create")

	return (
		<div
			className={cn(
				"relative flex h-[40px] w-full min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-full bg-background py-1.5 pl-1.5 pr-4",
			)}
			onClick={() => onClick(crew)}
			data-testid={`crew-mode-item-${crew.mode.identifier}`}
		>
			<div
				className={cn(
					"pointer-events-none absolute rounded-full border-solid shadow-xs",
					isActive
						? "inset-0 border-2 border-foreground"
						: "inset-[1px] border border-border",
				)}
			/>
			{/* Selected: subtle dot texture without remount flicker */}
			<div
				className={cn(
					"pointer-events-none absolute inset-0 opacity-0 transition-opacity",
					isActive && "opacity-[0.06]",
				)}
				style={{
					backgroundImage:
						"radial-gradient(circle, rgb(var(--foreground-rgb) / 1) 1px, transparent 1px)",
					backgroundSize: "4px 4px",
					backgroundPosition: "0 0",
				}}
			/>

			<ModeAvatar
				mode={crew.mode}
				iconSize={CREW_AVATAR_PX}
				className="relative z-[1] size-7 shrink-0"
				data-testid={`crew-mode-item-avatar-${crew.mode.identifier}`}
			/>

			<div
				className={cn(
					"relative z-[1] min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-5 text-foreground",
					isActive ? "font-medium" : "font-normal",
				)}
			>
				{crew.mode.name || t("untitledCrew")}
			</div>
		</div>
	)
}
