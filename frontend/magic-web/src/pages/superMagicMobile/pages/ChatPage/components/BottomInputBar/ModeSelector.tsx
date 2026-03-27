import { useState } from "react"
import { ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import ModeAvatar from "@/pages/superMagic/components/ModeAvatar"
import { roleStore } from "@/pages/superMagic/stores/RoleStore"
import CrewSelectModal from "../CrewSelectModal"
import { useMemoizedFn } from "ahooks"
import { CrewItem, TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { observer } from "mobx-react-lite"

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

	const selectedCrew = superMagicModeService.getModeConfigWithLegacy(currentCrew)

	const [crewSelectOpen, setCrewSelectOpen] = useState(false)

	const handleCrewSelect = useMemoizedFn((crew: CrewItem) => {
		roleStore.setCurrentRole(crew.mode.identifier as TopicMode)
	})

	const handleClick = useMemoizedFn(() => {
		setCrewSelectOpen(true)
	})

	return (
		<>
			<div
				className={cn(
					"flex h-10 shrink-0 items-center",
					showBorder
						? "gap-1 rounded-full border-2 border-foreground bg-background px-1 py-1 shadow-sm"
						: "gap-1 pl-1.5 pr-2.5",
					className,
				)}
				data-testid="mobile-mode-selector-trigger"
				onClick={handleClick}
			>
				{selectedCrew && (
					<ModeAvatar
						mode={selectedCrew.mode}
						iconSize={iconSize}
						data-testid="mobile-mode-selector-avatar"
					/>
				)}
				<ChevronsUpDown size={16} className="text-foreground" />
			</div>

			{/* 角色选择弹窗 */}
			<CrewSelectModal
				visible={crewSelectOpen}
				modes={superMagicModeService.modeList}
				selectedCrew={currentCrew}
				onClose={() => setCrewSelectOpen(false)}
				onSelectCrew={handleCrewSelect}
			/>
		</>
	)
})
