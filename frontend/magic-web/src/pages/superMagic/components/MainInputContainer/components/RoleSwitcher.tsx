import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"
import { Button } from "@/components/shadcn-ui/button"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { cn } from "@/utils/cn"
import ModeAvatar from "../../ModeAvatar"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { RouteName } from "@/routes/constants"
import useNavigate from "@/routes/hooks/useNavigate"
import { useTranslation } from "react-i18next"
import { CREW_OVERFLOW_THRESHOLD, RoleSwitcherOverflowMenu } from "./RoleSwitcherOverflowMenu"
import { useCenteredHorizontalScroll } from "../hooks/useCenteredHorizontalScroll"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import PptModeSwitcherCard from "./PptModeSwitcherCard"
import { isModeVisibleToCurrentUser } from "../../TopicMode/modeVisibility"
import styles from "./RoleSwitcher.module.css"

interface ModeSwitcherProps {
	role: TopicMode
	onActionClick?: (modeIdentifier: TopicMode) => void
	onPlaybookClick?: () => void
}

interface RoleSwitcherScrollControlProps {
	direction: "left" | "right"
	onClick: () => void
}

function RoleSwitcherScrollControl({ direction, onClick }: RoleSwitcherScrollControlProps) {
	const isLeft = direction === "left"
	const Icon = isLeft ? ChevronLeft : ChevronRight

	return (
		<div
			className={cn(
				"pointer-events-none absolute w-14 overflow-hidden",
				isLeft ? "left-0" : "right-0",
			)}
		>
			<div
				className={cn(
					styles.scrollControlCornerCover,
					isLeft
						? styles.scrollControlCornerCoverLeft
						: styles.scrollControlCornerCoverRight,
				)}
			/>
			<div
				className={cn(
					styles.scrollControlFade,
					isLeft ? styles.scrollControlFadeLeft : styles.scrollControlFadeRight,
				)}
			/>
			<div
				className={cn(
					"relative flex h-full items-center",
					isLeft ? "justify-start pl-2" : "justify-end pr-2",
				)}
			>
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="pointer-events-auto !size-4 shrink-0 rounded-full border-muted-foreground/50 text-muted-foreground/50 shadow-xs [&_svg]:size-3"
					onClick={onClick}
				>
					<Icon />
				</Button>
			</div>
		</div>
	)
}

function RoleSwitcher({ role, onActionClick }: ModeSwitcherProps) {
	const availableModeList = superMagicModeService.modeList
	const modeList = useMemo(
		() => availableModeList.filter(isModeVisibleToCurrentUser),
		[availableModeList],
	)
	const isModeListLoading = superMagicModeService.isModeListLoading
	const { scrollContainerRef, setItemRef } = useCenteredHorizontalScroll({
		activeKey: role,
		itemCount: modeList.length,
	})
	const [isModeListScrolled, setIsModeListScrolled] = useState(false)
	const isModeListScrolledRef = useRef(false)

	useEffect(() => {
		const container = scrollContainerRef.current
		if (!container) return

		const updateScrollState = () => {
			const nextIsScrolled = container.scrollLeft > 1
			if (nextIsScrolled === isModeListScrolledRef.current) return

			isModeListScrolledRef.current = nextIsScrolled
			setIsModeListScrolled(nextIsScrolled)
		}

		updateScrollState()
		container.addEventListener("scroll", updateScrollState, { passive: true })
		window.addEventListener("resize", updateScrollState)

		return () => {
			container.removeEventListener("scroll", updateScrollState)
			window.removeEventListener("resize", updateScrollState)
		}
	}, [scrollContainerRef, modeList.length])
	const navigate = useNavigate()
	const { t } = useTranslation("crew/create")

	const modeCount = modeList.length
	const showOverflowMenu = modeCount >= CREW_OVERFLOW_THRESHOLD
	const shouldShowLoading = isModeListLoading && modeCount <= 0

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
			className="flex h-11 w-auto min-w-0 max-w-full items-end gap-2"
			data-testid="role-switcher"
			data-guide-anchor="role-switcher"
		>
			<HeadlessHorizontalScroll
				className="-mt-8 h-[76px] min-w-0 flex-1 rounded-none [&>div.absolute]:!top-auto [&>div.absolute]:bottom-0 [&>div.absolute]:z-20 [&>div.absolute]:h-10"
				data-testid="role-switcher-mode-selector"
				scrollContainerClassName="no-scrollbar flex h-full min-w-0 items-end gap-2 overflow-x-auto overflow-y-hidden"
				scrollContainerRef={scrollContainerRef}
				renderLeftControl={({ scroll }) => (
					<RoleSwitcherScrollControl direction="left" onClick={() => scroll("left")} />
				)}
				renderRightControl={({ scroll }) => (
					<RoleSwitcherScrollControl direction="right" onClick={() => scroll("right")} />
				)}
			>
				{modeList.map((modeItem) => {
					const isSelected = modeItem.mode.identifier === role
					if (modeItem.mode.identifier === TopicMode.PPT) {
						return (
							<div
								key={modeItem.mode.identifier}
								ref={(element) => setItemRef(modeItem.mode.identifier, element)}
								className="shrink-0"
							>
								<PptModeSwitcherCard
									modeItem={modeItem}
									isSelected={isSelected}
									scrollContainerRef={scrollContainerRef}
									onSelect={() =>
										onActionClick?.(modeItem.mode.identifier as TopicMode)
									}
								/>
							</div>
						)
					}

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
					isScrolled={isModeListScrolled}
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
