import { lazy, Suspense, useCallback, useState } from "react"
import { Button } from "@/components/shadcn-ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/lib/utils"
import ModeAvatar from "../../ModeAvatar"
import {
	ChevronDown,
	ChevronRight,
	ChevronUp,
	CirclePlus,
	Loader2,
	SlidersHorizontal,
} from "lucide-react"
import { RouteName } from "@/routes/constants"
import useNavigate from "@/routes/hooks/useNavigate"
import { useTranslation } from "react-i18next"
import { FUNCTION_PERMISSION_CODE } from "@/apis"
import { useFunctionPermission } from "@/hooks/useFunctionPermission"
import { crewService } from "@/services/crew/CrewService"
import type { ModeItem } from "../../../pages/Workspace/types"
import type { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"

export const CREW_OVERFLOW_THRESHOLD = 6

const MyCrewManageSortingDialog = lazy(() =>
	import("@/pages/superMagic/pages/MyCrewPage/components/MyCrewManageSortingDialog").then(
		(module) => ({
			default: module.MyCrewManageSortingDialog,
		}),
	),
)

interface RoleSwitcherOverflowMenuProps {
	modeList: ModeItem[]
	role: TopicMode
	onSelectMode: (modeIdentifier: TopicMode) => void
}

export function RoleSwitcherOverflowMenu({
	modeList,
	role,
	onSelectMode,
}: RoleSwitcherOverflowMenuProps) {
	const navigate = useNavigate()
	const { t } = useTranslation("crew/create")
	const { t: tMarket } = useTranslation("crew/market")

	const [isPopoverOpen, setIsPopoverOpen] = useState(false)
	const [isSortingDialogOpen, setIsSortingDialogOpen] = useState(false)
	const [isCreatingCrew, setIsCreatingCrew] = useState(false)
	const { isAllowed: canCreateAgent } = useFunctionPermission(
		FUNCTION_PERMISSION_CODE.AgentCreate,
	)

	const handleNavigateMyCrew = useCallback(() => {
		setIsPopoverOpen(false)
		navigate({
			name: RouteName.MyCrew,
		})
	}, [navigate])

	const handleOpenSorting = useCallback(() => {
		setIsPopoverOpen(false)
		setIsSortingDialogOpen(true)
	}, [])

	const handleCreateCrew = useCallback(async () => {
		if (isCreatingCrew) return
		setIsCreatingCrew(true)
		try {
			const { code } = await crewService.createDefaultAgent()
			setIsPopoverOpen(false)
			navigate({ name: RouteName.CrewEdit, params: { id: code } })
		} catch {
			// Error handled by service / UI
		} finally {
			setIsCreatingCrew(false)
		}
	}, [isCreatingCrew, navigate])

	const handleSelectModeFromPopover = useCallback(
		(modeIdentifier: TopicMode) => {
			onSelectMode(modeIdentifier)
			setIsPopoverOpen(false)
		},
		[onSelectMode],
	)

	return (
		<>
			<Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
				<PopoverTrigger asChild>
					<span>
						<Button
							type="button"
							variant="outline"
							size="icon"
							className="size-9 shrink-0 rounded-full"
							data-testid="role-switcher-overflow-trigger"
							aria-expanded={isPopoverOpen}
						>
							{isPopoverOpen ? (
								<ChevronUp className="size-4" />
							) : (
								<ChevronDown className="size-4" />
							)}
						</Button>
					</span>
				</PopoverTrigger>
				<PopoverContent
					align="end"
					sideOffset={8}
					className={cn(
						"flex max-h-[min(90vh,var(--radix-popover-content-available-height))] w-[min(100vw-2rem,420px)] max-w-[min(100vw-2rem,420px)] flex-col overflow-hidden rounded-xl border bg-card p-0 shadow-2xl",
					)}
					data-testid="role-switcher-overflow-popover"
				>
					<div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
						<button
							type="button"
							className="flex min-w-0 flex-1 items-center gap-1 text-left text-xl font-medium leading-none text-foreground hover:opacity-90"
							data-testid="role-switcher-overflow-go-my-crew"
							aria-label={tMarket("myCrewPage.roleSwitcherPopover.goToMyCrewAria")}
							onClick={handleNavigateMyCrew}
						>
							<span className="truncate">{tMarket("myCrewPage.title")}</span>
							<ChevronRight className="size-5 shrink-0" aria-hidden />
						</button>
						<div className="flex shrink-0 items-center gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-8 gap-2 px-3 shadow-xs"
								data-testid="role-switcher-overflow-sorting"
								onClick={handleOpenSorting}
							>
								<SlidersHorizontal className="size-4" />
								<span className="text-xs font-medium">
									{tMarket("myCrewPage.roleSwitcherPopover.sorting")}
								</span>
							</Button>
							{canCreateAgent ? (
								<Button
									type="button"
									variant="default"
									size="sm"
									className="h-8 gap-2 px-3 shadow-xs"
									disabled={isCreatingCrew}
									data-testid="role-switcher-overflow-create"
									onClick={() => void handleCreateCrew()}
								>
									{isCreatingCrew ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<CirclePlus className="size-4" />
									)}
									<span className="text-xs font-medium">
										{tMarket("createCrew")}
									</span>
								</Button>
							) : null}
						</div>
					</div>
					{/* Radix viewport is h-full; Root needs definite height — max-h alone breaks % height */}
					<ScrollArea className="h-[min(70vh,360px)] w-full">
						<div
							className="grid grid-cols-2 gap-2.5 px-4 py-3"
							data-testid="role-switcher-overflow-mode-grid"
						>
							{modeList.map((modeItem) => {
								const isSelected = modeItem.mode.identifier === role
								return (
									<Button
										key={modeItem.mode.identifier}
										type="button"
										variant="secondary"
										className={cn(
											"relative h-auto justify-start gap-2 overflow-hidden rounded-full border p-[3px] pr-4 text-left text-sm font-medium shadow-xs",
											isSelected
												? "border-2 border-foreground bg-background hover:bg-background"
												: "border-border bg-background/80 hover:bg-secondary",
										)}
										data-testid={`role-switcher-overflow-mode-${modeItem.mode.identifier}`}
										onClick={() =>
											handleSelectModeFromPopover(
												modeItem.mode.identifier as TopicMode,
											)
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
											iconSize={34}
										/>
										<span className="relative min-w-0 truncate">
											{modeItem.mode.name || t("untitledCrew")}
										</span>
									</Button>
								)
							})}
						</div>
					</ScrollArea>
				</PopoverContent>
			</Popover>
			{isSortingDialogOpen ? (
				<Suspense fallback={null}>
					<MyCrewManageSortingDialog
						open={isSortingDialogOpen}
						onOpenChange={setIsSortingDialogOpen}
					/>
				</Suspense>
			) : null}
		</>
	)
}
