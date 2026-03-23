import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CrewItem } from "@/pages/superMagic/pages/Workspace/types"
import IconComponent from "@/pages/superMagic/components/IconViewComponent/index"
import { useTranslation } from "react-i18next"

const ICON_SIZE = 25

interface CrewListItemProps {
	crew: CrewItem
	isActive: boolean
	onClick: (crew: CrewItem) => void
}

export default function CrewListItem({ crew, isActive, onClick }: CrewListItemProps) {
	const { t } = useTranslation("crew/create")
	const crewName = crew.mode.name || t("untitledCrew")
	const crewDescription = crew.mode.description || t("noDescription")
	const crewIdentifier = crew.mode.identifier || crew.mode.id || crewName

	return (
		<button
			type="button"
			data-testid={`crew-select-modal-crew-item-${crewIdentifier}`}
			aria-label={crewName}
			aria-pressed={isActive}
			className="flex w-full cursor-pointer items-start gap-2.5 overflow-hidden rounded-md border border-border bg-card p-2.5 text-left active:opacity-70"
			onClick={() => onClick(crew)}
		>
			<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sidebar">
				<div className="flex size-[30px] items-center justify-center">
					{crew.mode.icon_url ? (
						<img
							src={crew.mode.icon_url}
							alt={crewName}
							width={ICON_SIZE}
							height={ICON_SIZE}
							draggable={false}
						/>
					) : (
						<IconComponent
							selectedIcon={crew.mode.icon}
							size={ICON_SIZE}
							iconColor={crew.mode.color}
						/>
					)}
				</div>
			</div>

			<div className="flex min-w-0 flex-1 flex-col justify-center gap-2 leading-none">
				<div className="flex items-start gap-2">
					<div className="flex min-w-0 flex-1 flex-col gap-2">
						<div className="text-sm font-semibold leading-none text-foreground">
							{crewName}
						</div>
						<div className="line-clamp-2 text-xs leading-none text-muted-foreground">
							{crewDescription}
						</div>
					</div>
					<div
						data-testid={`crew-select-modal-crew-checkmark-${crewIdentifier}`}
						className={cn(
							"flex size-4 shrink-0 items-center justify-center rounded-[4px]",
							isActive && "border border-foreground bg-foreground shadow-xs",
						)}
					>
						{isActive && (
							<Check size={10} className="text-background" strokeWidth={3} />
						)}
					</div>
				</div>
			</div>
		</button>
	)
}
