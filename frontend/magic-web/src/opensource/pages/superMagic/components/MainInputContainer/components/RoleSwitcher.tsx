import { useMemo } from "react"
import { useModeList } from "../../MessagePanel/hooks/usePatternTabs"
import IconComponent from "../../IconViewComponent"
import { TopicMode } from "../../../pages/Workspace/types"
import TemplateGroupSelector from "../panels/TemplateGroupSelector"
import type { OptionGroup } from "../panels/types"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { RouteName } from "@/opensource/routes/constants"

interface ModeSwitcherProps {
	role: TopicMode
	onActionClick?: (modeIdentifier: TopicMode) => void
	onPlaybookClick?: () => void
}

// const AgentDesigner = lazy(() => import("../../AgentDesigner"))

const DESKTOP_ICON_SIZE = 16

function RoleSwitcher({ role, onActionClick }: ModeSwitcherProps) {
	const { t } = useTranslation("crew/create")
	const navigate = useNavigate()

	const { modeList } = useModeList({ includeGeneral: true, includeChat: false })
	// const [agentDesignerVisible, setAgentDesignerVisible] = useState(false)
	// const handleAgentDesignerClose = useMemoizedFn(() => {
	// 	superMagicModeService.fetchModeList()
	// })

	const modeGroups = useMemo<OptionGroup[]>(
		() =>
			modeList.map((mode) => ({
				group_key: mode.mode.identifier,
				group_name: mode.mode.name || t("untitledCrew"),
			})),
		[modeList, t],
	)
	const modeMap = useMemo(
		() => new Map(modeList.map((mode) => [mode.mode.identifier, mode])),
		[modeList],
	)

	function renderGroupIcon(group: OptionGroup) {
		const mode = modeMap.get(group.group_key)
		if (!mode) return null

		if (mode.mode.icon_url)
			return (
				<img
					src={mode.mode.icon_url}
					alt={mode.mode.name}
					width={DESKTOP_ICON_SIZE}
					height={DESKTOP_ICON_SIZE}
					className="shrink-0"
				/>
			)

		return (
			<IconComponent
				selectedIcon={mode.mode.icon}
				size={DESKTOP_ICON_SIZE}
				iconColor={mode.mode.color}
			/>
		)
	}

	return (
		<>
			<div
				className="flex w-auto min-w-0 max-w-full items-center gap-2"
				data-testid="role-switcher"
			>
				<TemplateGroupSelector
					className="min-w-0 flex-1"
					groups={modeGroups}
					selectedGroupKey={role}
					onGroupChange={(groupKey) => onActionClick?.(groupKey as TopicMode)}
					renderGroupIcon={renderGroupIcon}
					data-testid="role-switcher-mode-selector"
				/>
				<Button
					variant="outline"
					size="icon"
					className="size-9 flex-shrink-0 rounded-full"
					data-testid="role-switcher-add-button"
					onClick={() => {
						navigate({
							name: RouteName.MyCrew,
						})
					}}
				>
					<Plus className="size-4" />
				</Button>
			</div>
			{/* {agentDesignerVisible && (
				<Suspense fallback={null}>
					<AgentDesigner
						agentDesignerVisible={agentDesignerVisible}
						setAgentDesignerVisible={setAgentDesignerVisible}
						onClose={handleAgentDesignerClose}
					/>
				</Suspense>
			)} */}
		</>
	)
}

export default RoleSwitcher
