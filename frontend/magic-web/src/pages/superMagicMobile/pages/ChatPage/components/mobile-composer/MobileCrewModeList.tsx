import { useEffect, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { Check, ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import ModeAvatar from "@/pages/superMagic/components/ModeAvatar"
import { partitionModesByVisibility } from "@/pages/superMagic/components/TopicMode/modeVisibility"
import type { CrewItem } from "@/pages/superMagic/pages/Workspace/types"
import { DataEmptyState } from "@/pages/superMagicMobile/components/DataEmptyState"

interface MobileCrewModeListProps {
	open: boolean
	modes: CrewItem[]
	selectedModeIdentifier?: string | null
	onSelectCrew: (crew: CrewItem) => void
}

function MobileCrewModeList({
	open,
	modes,
	selectedModeIdentifier,
	onSelectCrew,
}: MobileCrewModeListProps) {
	const { t } = useTranslation("super")
	const [hiddenModesExpanded, setHiddenModesExpanded] = useState(false)
	const visibleListRef = useRef<HTMLDivElement>(null)
	const hiddenListRef = useRef<HTMLDivElement>(null)
	const selectedItemRef = useRef<HTMLButtonElement>(null)

	const { visibleModes, hiddenModes } = partitionModesByVisibility(modes)
	const selectedModeIsHidden = hiddenModes.some(
		(crew) => crew.mode.identifier === selectedModeIdentifier,
	)

	useEffect(() => {
		setHiddenModesExpanded(open && selectedModeIsHidden)
	}, [open, selectedModeIsHidden])

	useEffect(() => {
		if (!open) return

		// 等待抽屉动画和隐藏列表展开完成，再在对应滚动区域内定位当前员工。
		const timer = window.setTimeout(() => {
			const container = selectedModeIsHidden ? hiddenListRef.current : visibleListRef.current
			const selectedItem = selectedItemRef.current
			if (!container || !selectedItem) return

			const containerRect = container.getBoundingClientRect()
			const itemRect = selectedItem.getBoundingClientRect()
			const targetScrollTop =
				container.scrollTop +
				(itemRect.top - containerRect.top) -
				(containerRect.height - itemRect.height) / 2

			container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: "smooth" })
		}, 200)

		return () => {
			window.clearTimeout(timer)
		}
	}, [modes.length, open, selectedModeIdentifier, selectedModeIsHidden])

	const renderModeItem = (crew: CrewItem) => {
		const isActive = crew.mode.identifier === selectedModeIdentifier

		return (
			<button
				key={crew.mode.identifier}
				type="button"
				ref={isActive ? selectedItemRef : null}
				onClick={() => onSelectCrew(crew)}
				className={cn(
					"flex h-12 w-full items-center gap-3 rounded-full transition-colors active:opacity-60",
					isActive && "bg-card",
				)}
				style={{
					paddingLeft: 7,
					paddingRight: 16,
					...(isActive
						? {
								boxShadow:
									"0px 1px 3px 0px rgba(0,0,0,0.10), 0px 1px 2px 0px rgba(0,0,0,0.10)",
							}
						: {}),
				}}
				data-testid="mobile-composer-mode-selector-item"
				data-mode={crew.mode.identifier}
				data-selected={isActive}
			>
				<ModeAvatar
					mode={crew.mode}
					iconSize={34}
					data-testid={`mobile-composer-mode-selector-avatar-${crew.mode.identifier}`}
				/>
				<span className="flex-1 truncate text-left text-base font-medium leading-5 text-foreground">
					{crew.mode.name}
				</span>
				{isActive ? (
					<Check className="h-4 w-4 shrink-0 text-foreground" strokeWidth={2} />
				) : null}
			</button>
		)
	}

	return (
		<div
			className="flex max-h-[388px] min-h-0 flex-1 flex-col overflow-hidden"
			data-testid="mobile-composer-mode-selector-crew-container"
		>
			{/* 可见员工与隐藏员工分别滚动，隐藏区域始终保留在员工区域底部。 */}
			<div
				ref={visibleListRef}
				className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 py-2.5"
				data-testid="mobile-composer-mode-selector-list"
			>
				{visibleModes.length || hiddenModes.length ? (
					<div className="flex flex-col gap-1.5">{visibleModes.map(renderModeItem)}</div>
				) : (
					<DataEmptyState variant="crew" compact className="h-full py-8" />
				)}
			</div>

			{hiddenModes.length ? (
				<div
					className="shrink-0 border-t border-border"
					data-testid="mobile-composer-mode-selector-hidden-section"
				>
					<button
						type="button"
						className="flex h-12 w-full items-center gap-2 px-5 text-left text-base font-medium text-muted-foreground transition-colors active:bg-card active:text-foreground"
						aria-expanded={hiddenModesExpanded}
						aria-controls="mobile-composer-mode-selector-hidden-list"
						data-testid="mobile-composer-mode-selector-hidden-trigger"
						onClick={() => setHiddenModesExpanded((expanded) => !expanded)}
					>
						<span className="flex-1">{t("modeToggle.hiddenCrew")}</span>
						<span className="text-sm tabular-nums">{hiddenModes.length}</span>
						<ChevronDown
							className={cn(
								"size-4 transition-transform",
								hiddenModesExpanded && "rotate-180",
							)}
						/>
					</button>

					{hiddenModesExpanded ? (
						<div
							ref={hiddenListRef}
							id="mobile-composer-mode-selector-hidden-list"
							className="scrollbar-y-thin max-h-[156px] overflow-y-auto overscroll-contain px-3.5 pb-2.5"
							data-testid="mobile-composer-mode-selector-hidden-list"
						>
							<div className="flex flex-col gap-1.5">
								{hiddenModes.map(renderModeItem)}
							</div>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	)
}

export default observer(MobileCrewModeList)
