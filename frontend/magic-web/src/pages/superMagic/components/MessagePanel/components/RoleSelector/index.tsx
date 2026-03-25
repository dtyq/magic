import { useMemo } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { TopicMode, type CrewItem } from "@/pages/superMagic/pages/Workspace/types"
import { IconType } from "@/pages/superMagic/components/AgentSelector/types"
import IconComponent from "@/pages/superMagic/components/IconViewComponent"
import { cn } from "@/lib/utils"
import { Button } from "@/components/shadcn-ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { useModeList } from "../../hooks/usePatternTabs"

interface RoleSelectorProps {
	role: TopicMode
	onActionClick?: (modeIdentifier: TopicMode) => void
}

const ICON_SIZE = 16

function RoleSelector({ role, onActionClick }: RoleSelectorProps) {
	const { modeList } = useModeList({ includeGeneral: true, includeChat: false })

	const currentMode = useMemo(
		() => modeList.find((modeItem) => modeItem.mode.identifier === role) ?? modeList[0],
		[modeList, role],
	)

	const renderRoleIcon = (mode: CrewItem["mode"]) => {
		if (mode.icon_type === IconType.Image && mode.icon_url) {
			return (
				<img
					src={mode.icon_url}
					alt={mode.name}
					width={ICON_SIZE}
					height={ICON_SIZE}
					className="shrink-0"
				/>
			)
		}

		return <IconComponent selectedIcon={mode.icon} size={ICON_SIZE} iconColor={mode.color} />
	}

	if (!currentMode) return null

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="outline"
					className="h-7 gap-2 rounded-md border-input bg-background px-4 py-2 text-sm font-medium leading-5 text-foreground shadow-xs hover:bg-background"
					data-testid="super-message-panel-role-selector-trigger"
					data-role={currentMode.mode.identifier}
				>
					{renderRoleIcon(currentMode.mode)}
					<span className="truncate whitespace-nowrap">{currentMode.mode.name}</span>
					<ChevronsUpDown className="size-4 shrink-0 text-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="z-dropdown min-w-[220px] p-1"
				sideOffset={4}
			>
				{modeList.map((modeItem) => {
					const isSelected = modeItem.mode.identifier === currentMode.mode.identifier

					return (
						<DropdownMenuItem
							key={modeItem.mode.identifier}
							className={cn(
								"flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium leading-5",
								isSelected && "bg-accent",
							)}
							onSelect={() => onActionClick?.(modeItem.mode.identifier as TopicMode)}
						>
							{renderRoleIcon(modeItem.mode)}
							<span className="flex-1 truncate">{modeItem.mode.name}</span>
							{isSelected && <Check className="size-4 shrink-0 text-primary" />}
						</DropdownMenuItem>
					)
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export default RoleSelector
