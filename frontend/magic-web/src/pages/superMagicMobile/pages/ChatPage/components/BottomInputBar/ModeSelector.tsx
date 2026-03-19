import { useState } from "react"
import { ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import IconComponent from "@/pages/superMagic/components/IconViewComponent/index"
import { IconType } from "@/pages/superMagic/components/AgentSelector/types"
import { roleStore } from "@/pages/superMagic/stores/RoleStore"
import CrewSelectModal from "../CrewSelectModal"
import { useMemoizedFn } from "ahooks"
import { ModeItem, TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { observer } from "mobx-react-lite"

const crewIconWrapperVariants = "flex shrink-0 items-center justify-center size-5"

interface ModeSelectorProps {
	className?: string
	showBorder?: boolean
	iconSize?: number
}

export default observer(function ModeSelector({
	className,
	showBorder = false,
	iconSize = 16,
}: ModeSelectorProps) {
	const currentCrew = roleStore.currentRole

	const selectedMode = superMagicModeService.getModeConfigWithLegacy(currentCrew)

	const [modeSelectOpen, setModeSelectOpen] = useState(false)

	const handleCrewSelect = useMemoizedFn((mode: ModeItem) => {
		roleStore.setCurrentRole(mode.mode.identifier as TopicMode)
	})

	const handleClick = useMemoizedFn(() => {
		setModeSelectOpen(true)
	})

	return (
		<>
			<div
				className={cn(
					"flex h-10 shrink-0 items-center gap-1 px-2.5",
					showBorder && "rounded-full border border-foreground",
					className,
				)}
				onClick={handleClick}
			>
				{selectedMode && (
					<div className={cn(crewIconWrapperVariants)}>
						{selectedMode.mode.icon_url ? (
							<img
								src={selectedMode.mode.icon_url}
								alt="icon"
								width={iconSize}
								height={iconSize}
								draggable={false}
							/>
						) : (
							<IconComponent
								selectedIcon={selectedMode.mode.icon || ""}
								size={iconSize}
								iconColor={selectedMode.mode.color || "#000"}
							/>
						)}
					</div>
				)}
				<ChevronsUpDown size={16} />
			</div>

			{/* 角色选择弹窗 */}
			<CrewSelectModal
				visible={modeSelectOpen}
				modes={superMagicModeService.modeList}
				selectedCrew={currentCrew}
				onClose={() => setModeSelectOpen(false)}
				onSelectCrew={handleCrewSelect}
			/>
		</>
	)
})
