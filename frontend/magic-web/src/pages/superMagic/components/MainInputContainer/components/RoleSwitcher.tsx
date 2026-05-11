import { useCallback } from "react"
import { useMount } from "ahooks"
import { observer } from "mobx-react-lite"
import { TopicMode } from "../../../pages/Workspace/types"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"
import { Button } from "@/components/shadcn-ui/button"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { cn } from "@/lib/utils"
import ModeAvatar from "../../ModeAvatar"
import { Plus } from "lucide-react"
import { RouteName } from "@/routes/constants"
import useNavigate from "@/routes/hooks/useNavigate"
import { useTranslation } from "react-i18next"
import { CREW_OVERFLOW_THRESHOLD, RoleSwitcherOverflowMenu } from "./RoleSwitcherOverflowMenu"
import { useCenteredHorizontalScroll } from "../hooks/useCenteredHorizontalScroll"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { GuideTourElementId } from "@/pages/superMagic/components/LazyGuideTour"
import pubsub, { PubSubEvents } from "@/utils/pubsub"

interface ModeSwitcherProps {
	role: TopicMode
	onActionClick?: (modeIdentifier: TopicMode) => void
	onPlaybookClick?: () => void
}

function RoleSwitcher({ role, onActionClick }: ModeSwitcherProps) {
	const modeList = superMagicModeService.modeList
	const isModeListLoading = superMagicModeService.isModeListLoading
	const { scrollContainerRef, setItemRef } = useCenteredHorizontalScroll({
		activeKey: role,
		itemCount: modeList.length,
	})
	const navigate = useNavigate()
	const { t } = useTranslation("crew/create")

	const modeCount = modeList.length
	const showOverflowMenu = modeCount >= CREW_OVERFLOW_THRESHOLD
	const shouldShowLoading = isModeListLoading && modeCount <= 0

	useMount(() => {
		pubsub.publish(PubSubEvents.GuideTourElementReady, GuideTourElementId.RoleSwitcher)
	})

	const handleNavigateMyCrew = useCallback(() => {
		navigate({
			name: RouteName.MyCrew,
		})
	}, [navigate])

	if (shouldShowLoading) {
		return <RoleSwitcherSkeleton />
	}

	return (
		<div
			id={GuideTourElementId.RoleSwitcher}
			className="flex w-auto min-w-0 max-w-full items-center gap-2"
			data-testid="role-switcher"
		>
			<HeadlessHorizontalScroll
				className="min-w-0 flex-1"
				data-testid="role-switcher-mode-selector"
				scrollContainerClassName="no-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto overflow-y-hidden"
				scrollContainerRef={scrollContainerRef}
			>
				{modeList.map((modeItem) => {
					const isSelected = modeItem.mode.identifier === role

					return (
						<div
							key={modeItem.mode.identifier}
							ref={(element) => setItemRef(modeItem.mode.identifier, element)}
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

			{showOverflowMenu ? (
				<RoleSwitcherOverflowMenu
					modeList={modeList}
					role={role}
					onSelectMode={(modeIdentifier) => onActionClick?.(modeIdentifier)}
				/>
			) : (
				<Button
					variant="outline"
					size="icon"
					className="size-9 shrink-0 rounded-full"
					data-testid="role-switcher-add-button"
					onClick={handleNavigateMyCrew}
				>
					<Plus className="size-4" />
				</Button>
			)}
		</div>
	)
}

function RoleSwitcherSkeleton() {
	return (
		<div
			id={GuideTourElementId.RoleSwitcher}
			className="flex w-auto min-w-0 max-w-full items-center gap-2"
			data-testid="role-switcher"
		>
			<div
				className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden"
				data-testid="role-switcher-loading"
			>
				{Array.from({ length: 4 }).map((_, index) => (
					<div
						key={`role-switcher-skeleton-${index}`}
						className="shrink-0"
						data-testid="role-switcher-mode-selector-skeleton"
					>
						<div className="flex h-10 items-center gap-2 rounded-full border border-border bg-background/80 p-[4px] pr-4">
							<Skeleton className="size-7 rounded-full" />
							<Skeleton className="h-4 w-16 rounded-full" />
						</div>
					</div>
				))}
			</div>
			<Skeleton
				className="size-9 shrink-0 rounded-full"
				data-testid="role-switcher-add-button-skeleton"
			/>
		</div>
	)
}

export default observer(RoleSwitcher)
