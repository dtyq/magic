import { useRef, useState, type DragEvent, type MouseEvent, type RefObject } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import { Button } from "@/components/shadcn-ui/button"
import type { ModeItem } from "@/pages/superMagic/pages/Workspace/types"
import ModeAvatar from "../../ModeAvatar"
import pptSlide1 from "./assets/ppt-slide-1.png"
import pptSlide2 from "./assets/ppt-slide-2.png"
import pptSlide3 from "./assets/ppt-slide-3.png"
import { useSlidesTemplateStatistics } from "@/pages/superMagic/hooks/useSlidesTemplateTotal"
import { useAnimatedNumberPulse } from "@/pages/superMagic/hooks/useAnimatedNumber"
import { useElementVisibility } from "@/pages/superMagic/hooks/useElementVisibility"
import { AnimatedNumberText } from "@/pages/superMagic/components/AnimatedNumberText"
import { isPrivateDeployment } from "@/utils/env"
import {
	SLIDES_TEMPLATE_RANDOM_DRAG_END_EVENT,
	SLIDES_TEMPLATE_RANDOM_DRAG_START_EVENT,
	SLIDES_TEMPLATE_RANDOM_DRAG_TYPE,
} from "../constants"
import styles from "./PptModeSwitcherCard.module.css"

// Local fallback preview slides shown behind the PPT crew pill.
const PPT_PREVIEW_IMAGES = [pptSlide1, pptSlide2, pptSlide3] as const
const DELIVERED_COUNT_MARKER = "__DELIVERED_COUNT__"
const PPT_PREVIEW_EDGE_INSET_PX = 32
const PPT_PREVIEW_MIN_INTERSECTION_RATIO = 0.8
const PPT_PREVIEW_VISIBILITY_THRESHOLDS = [0, PPT_PREVIEW_MIN_INTERSECTION_RATIO, 1]

interface PptModeSwitcherCardProps {
	modeItem: ModeItem
	isSelected: boolean
	onSelect: () => void
	scrollContainerRef?: RefObject<HTMLDivElement | null>
}

/**
 * PPT is the only built-in crew with a presentation preview in the design.
 * The preview is positioned above the pill without changing the role list height.
 */
export default function PptModeSwitcherCard({
	modeItem,
	isSelected,
	onSelect,
	scrollContainerRef,
}: PptModeSwitcherCardProps) {
	const { t } = useTranslation("crew/market")
	const [isHovered, setIsHovered] = useState(false)
	const [isFocused, setIsFocused] = useState(false)
	const cardRef = useRef<HTMLDivElement>(null)
	const isVisible = useElementVisibility(cardRef)
	const isPreviewInSafeArea = useElementVisibility(cardRef, {
		enabled: Boolean(scrollContainerRef),
		initialVisible: true,
		minimumIntersectionRatio: PPT_PREVIEW_MIN_INTERSECTION_RATIO,
		rootMargin: `0px -${PPT_PREVIEW_EDGE_INSET_PX}px`,
		rootRef: scrollContainerRef,
		threshold: PPT_PREVIEW_VISIBILITY_THRESHOLDS,
	})
	const slidesTemplateStatistics = useSlidesTemplateStatistics({ enabled: isVisible })
	const templateTotalUsageCount = slidesTemplateStatistics?.templateTotalUsageCount
	const isUsageCountPulsing = useAnimatedNumberPulse(templateTotalUsageCount)
	const isExpanded = isSelected || isHovered || isFocused
	const isPreviewHidden = !isPreviewInSafeArea
	const isPreviewExpanded = isExpanded && !isPreviewHidden
	const pillAccentState = isHovered ? "hovered" : isSelected ? "selected" : "idle"
	const modeName = modeItem.mode.name || t("detailDialog.emptyName")
	const deliveredText = isPrivateDeployment()
		? t("pptEmployee.deliveredPrivate", { marker: DELIVERED_COUNT_MARKER })
		: t("pptEmployee.delivered", { marker: DELIVERED_COUNT_MARKER })
	const deliveredMarkerIndex = deliveredText.indexOf(DELIVERED_COUNT_MARKER)
	const deliveredPrefix =
		deliveredMarkerIndex >= 0 ? deliveredText.slice(0, deliveredMarkerIndex).trim() : ""
	const deliveredSuffix =
		deliveredMarkerIndex >= 0
			? deliveredText.slice(deliveredMarkerIndex + DELIVERED_COUNT_MARKER.length).trim()
			: deliveredText

	function stopPreviewClick(event: MouseEvent<HTMLButtonElement>) {
		event.stopPropagation()
		onSelect()
	}

	function handlePreviewDragStart(event: DragEvent<HTMLSpanElement>, index: number) {
		event.dataTransfer.effectAllowed = "copy"
		event.dataTransfer.setData(SLIDES_TEMPLATE_RANDOM_DRAG_TYPE, String(index))
		window.dispatchEvent(new Event(SLIDES_TEMPLATE_RANDOM_DRAG_START_EVENT))
	}

	function handlePreviewDragEnd() {
		window.dispatchEvent(new Event(SLIDES_TEMPLATE_RANDOM_DRAG_END_EVENT))
	}

	return (
		<div
			ref={cardRef}
			className="relative flex h-10 shrink-0 items-end justify-center"
			data-expanded={isExpanded}
			data-preview-hidden={isPreviewHidden}
			data-testid="ppt-mode-switcher-card"
		>
			<div
				className={cn(
					"absolute bottom-9 left-1/2 h-[30px] w-[112px] origin-bottom -translate-x-1/2 transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none",
					isPreviewHidden
						? "pointer-events-none translate-y-5 scale-[0.56] opacity-0"
						: isPreviewExpanded
							? "translate-y-0.5 scale-100 opacity-100"
							: "translate-y-1 scale-[0.78] opacity-70",
				)}
				aria-hidden
				data-testid="ppt-mode-switcher-preview"
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
			>
				<div className="relative h-full w-full">
					{PPT_PREVIEW_IMAGES.map((src, index) => (
						<span
							key={src}
							className={cn(
								styles.previewFrame,
								isPreviewExpanded && styles.previewFrameExpanded,
								"absolute top-0 h-7 w-[50px] cursor-grab transition-transform duration-300 ease-out active:cursor-grabbing",
								index === 0 &&
									(isPreviewExpanded
										? "left-0 top-px -translate-x-2 -rotate-[18deg]"
										: "left-0 top-px -rotate-[12.69deg]"),
								index === 1 &&
									(isPreviewExpanded
										? "left-[25.69px] translate-x-[3px] rotate-0"
										: "left-[25.69px] rotate-[15deg]"),
								index === 2 &&
									(isPreviewExpanded
										? "left-[57px] top-px translate-x-2 rotate-[18deg]"
										: "left-[57px] top-px -rotate-[12.69deg]"),
							)}
							data-active={isPreviewExpanded}
							data-preview-index={index}
							data-testid="ppt-mode-switcher-preview-frame"
							draggable
							onDragEnd={handlePreviewDragEnd}
							onDragStart={(event) => handlePreviewDragStart(event, index)}
						>
							<img
								src={src}
								alt=""
								className="h-full w-full rounded-[2px] border-[0.5px] border-[#e5e5e5] object-cover"
								draggable={false}
								loading="lazy"
							/>
						</span>
					))}
				</div>
			</div>

			<Button
				type="button"
				variant={isSelected ? "outline" : "secondary"}
				size="default"
				className={cn(
					"group relative isolate z-10 h-10 gap-[calc(0.5rem-3px)] rounded-full border p-[3px] pr-4 text-sm font-medium shadow-none transition-colors",
					styles.pillAccent,
					isSelected && styles.pillAccentSelected,
					isHovered && styles.pillAccentHovered,
					isSelected
						? "border-2 border-foreground bg-foreground text-background hover:bg-foreground hover:text-background"
						: "bg-background text-foreground hover:border-foreground hover:bg-foreground hover:text-background",
				)}
				aria-label={modeName}
				aria-pressed={isSelected}
				data-accent-state={pillAccentState}
				data-testid="ppt-mode-switcher-trigger"
				onClick={stopPreviewClick}
				onFocus={() => setIsFocused(true)}
				onBlur={() => setIsFocused(false)}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
			>
				<ModeAvatar
					mode={modeItem.mode}
					iconSize={26}
					className={cn("relative z-10", isSelected ? "border-2" : "border-[3px]")}
				/>
				<span className="relative z-10 flex min-w-0 flex-col justify-center">
					<span className="truncate whitespace-nowrap leading-5">{modeName}</span>
					{typeof templateTotalUsageCount === "number" &&
						Number.isFinite(templateTotalUsageCount) &&
						templateTotalUsageCount >= 0 && (
							<span
								className={cn(
									"inline-block origin-center text-[10px] tabular-nums leading-3 transition-[max-height,opacity,color,transform,filter] duration-1000 ease-out",
									isSelected
										? "text-background/70"
										: "text-[#737373] group-hover:text-background/70",
									isExpanded
										? "max-h-[1.3em] overflow-visible opacity-100"
										: "max-h-0 overflow-hidden opacity-0",
									isUsageCountPulsing &&
										"scale-[1.04] text-[#ff6a1f] drop-shadow-[0_0_5px_rgba(255,106,31,0.35)]",
								)}
								data-testid="ppt-mode-switcher-delivered-count"
							>
								<span className="inline-flex h-[1.3em] items-center gap-1 leading-none">
									{deliveredPrefix && (
										<span className="inline-flex h-full items-center">
											{deliveredPrefix}
										</span>
									)}
									<strong className="inline-flex h-full items-center font-semibold">
										<AnimatedNumberText
											value={templateTotalUsageCount}
											isEmphasized={isUsageCountPulsing}
										/>
									</strong>
									{deliveredSuffix && (
										<span className="inline-flex h-full items-center">
											{deliveredSuffix}
										</span>
									)}
								</span>
							</span>
						)}
				</span>
			</Button>
		</div>
	)
}
