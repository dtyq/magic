import { useEffect, useRef } from "react"
import { useModeList } from "../../MessagePanel/hooks/usePatternTabs"
import { TopicMode } from "../../../pages/Workspace/types"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import ModeAvatar from "../../ModeAvatar"
import { Plus } from "lucide-react"
import { RouteName } from "@/routes/constants"
import useNavigate from "@/routes/hooks/useNavigate"
import { useTranslation } from "react-i18next"

interface ModeSwitcherProps {
	role: TopicMode
	onActionClick?: (modeIdentifier: TopicMode) => void
	onPlaybookClick?: () => void
}

// const AgentDesigner = lazy(() => import("../../AgentDesigner"))

function RoleSwitcher({ role, onActionClick }: ModeSwitcherProps) {
	const { modeList } = useModeList({ includeGeneral: true, includeChat: false })
	const optionRefs = useRef<Record<string, HTMLDivElement | null>>({})
	const navigate = useNavigate()
	const { t } = useTranslation("crew/create")

	useEffect(() => {
		const activeOption = optionRefs.current[role]
		if (!activeOption) return

		activeOption.scrollIntoView({
			behavior: "smooth",
			inline: "center",
			block: "nearest",
		})
	}, [role])

	return (
		<div
			className="flex w-auto min-w-0 max-w-full items-center gap-2"
			data-testid="role-switcher"
		>
			<HeadlessHorizontalScroll
				className="min-w-0 flex-1"
				data-testid="role-switcher-mode-selector"
				scrollContainerClassName="no-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto overflow-y-hidden"
			>
				{modeList.map((modeItem) => {
					const isSelected = modeItem.mode.identifier === role

					return (
						<div
							key={modeItem.mode.identifier}
							ref={(element) => {
								optionRefs.current[modeItem.mode.identifier] = element
							}}
							className="shrink-0"
						>
							<Button
								type="button"
								variant={isSelected ? "outline" : "secondary"}
								size="default"
								className={cn(
									"relative h-10 gap-[calc(0.5rem-3px)] overflow-hidden rounded-full border p-[3px] pr-4 text-sm font-medium text-foreground transition-colors",
									isSelected
										? "border-2 border-foreground bg-background shadow-xs hover:bg-background"
										: "bg-background/80 shadow-none hover:bg-secondary",
								)}
								data-testid={`role-switcher-mode-selector-option-${modeItem.mode.identifier}`}
								onClick={() =>
									onActionClick?.(modeItem.mode.identifier as TopicMode)
								}
							>
								{isSelected && (
									<span
										aria-hidden
										className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_1px_1px,rgba(10,10,10,0.12)_1px,transparent_0)] bg-[length:6px_6px] opacity-40"
									/>
								)}
								<ModeAvatar
									mode={modeItem.mode}
									className={cn(
										"relative",
										isSelected ? "border-2" : "border-[3px]",
									)}
									iconSize={28}
								/>
								<span className="relative whitespace-nowrap leading-5">
									{modeItem.mode.name || t("untitledCrew")}
								</span>
							</Button>
						</div>
					)
				})}
			</HeadlessHorizontalScroll>
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
	)
}

export default RoleSwitcher
