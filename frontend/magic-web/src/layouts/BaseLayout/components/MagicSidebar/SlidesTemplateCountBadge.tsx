import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import slidesTemplateFireIcon from "@/assets/resources/icons/fire.webp"
import slidesTemplateSparklesIcon from "@/assets/resources/icons/sparkles.webp"
import { cn } from "@/utils/cn"
import { AnimatedNumberText } from "@/pages/superMagic/components/AnimatedNumberText"
import { formatNumber } from "@/utils/format"

type BadgeView = "today" | "total"

const COUNT_MARKER = "__SLIDES_TEMPLATE_COUNT__"

interface SlidesTemplateCountBadgeProps {
	count: number
	todayAdded?: number
	testId?: string
	onStackedChange?: (stacked: boolean) => void
}

interface BadgeContentProps {
	view: BadgeView
	count: number
	todayAdded: number
	prefix: string
	suffix: string
	measure?: boolean
	iconPosition?: "before" | "after"
	iconClassName?: string
}

export const SLIDES_TEMPLATE_BADGE_ROTATION_INTERVAL = 3000
const BADGE_TRANSITION_DURATION = 0.28

const contentVariants: Variants = {
	enter: (direction: number) => ({
		y: direction * 10,
		opacity: 0,
		filter: "blur(1px)",
	}),
	center: {
		y: 0,
		opacity: 1,
		filter: "blur(0px)",
	},
	exit: (direction: number) => ({
		y: direction * -10,
		opacity: 0,
		filter: "blur(1px)",
	}),
}

export function isValidTemplateCountTodayGrowth(value: number | undefined): value is number {
	return typeof value === "number" && Number.isFinite(value) && value >= 0
}

export function shouldStackSlidesTemplateCount({
	availableWidth,
	titleWidth,
	countWidth,
	gap,
}: {
	availableWidth: number
	titleWidth: number
	countWidth: number
	gap: number
}) {
	return titleWidth + countWidth + gap > availableWidth + 1
}

function splitCountLabel(label: string) {
	const markerIndex = label.indexOf(COUNT_MARKER)
	if (markerIndex < 0) return { prefix: label.trim(), suffix: "" }

	return {
		prefix: label.slice(0, markerIndex).trim(),
		suffix: label.slice(markerIndex + COUNT_MARKER.length).trim(),
	}
}

function BadgeContent({
	view,
	count,
	todayAdded,
	prefix,
	suffix,
	measure = false,
	iconPosition = "before",
	iconClassName,
}: BadgeContentProps) {
	const value = view === "today" ? todayAdded : count
	const icon = view === "today" ? slidesTemplateSparklesIcon : slidesTemplateFireIcon
	const iconElement = (
		<img
			src={icon}
			alt=""
			aria-hidden="true"
			draggable={false}
			className={cn("h-4 w-4 shrink-0 object-contain", iconClassName)}
		/>
	)

	return (
		<>
			{iconPosition === "before" ? iconElement : null}
			<span
				className="inline-flex items-center gap-1 whitespace-nowrap leading-none"
				data-slides-template-badge-text
			>
				{prefix ? <span>{prefix}</span> : null}
				{measure ? (
					<span className="tabular-nums">{formatNumber(value)}</span>
				) : (
					<AnimatedNumberText value={value} className="leading-none" />
				)}
				{suffix ? <span>{suffix}</span> : null}
			</span>
			{iconPosition === "after" ? iconElement : null}
		</>
	)
}

/** 在今日新增与模板总数间轮播；单行保留 Tag，换行时改为紧凑纯文本。 */
export function SlidesTemplateCountBadge({
	count,
	todayAdded,
	testId,
	onStackedChange,
}: SlidesTemplateCountBadgeProps) {
	const { t } = useTranslation("sidebar")
	const hasTodayAdded = isValidTemplateCountTodayGrowth(todayAdded)
	const prefersReducedMotion = Boolean(useReducedMotion())
	const badgeRef = useRef<HTMLSpanElement>(null)
	const todayMeasureRef = useRef<HTMLSpanElement>(null)
	const totalMeasureRef = useRef<HTMLSpanElement>(null)
	const hadTodayAddedRef = useRef(hasTodayAdded)
	const [view, setView] = useState<BadgeView>(hasTodayAdded ? "today" : "total")
	const [stacked, setStacked] = useState(false)
	const todayContent = splitCountLabel(
		t("slidesTemplates.todayAddedCount", { value: COUNT_MARKER }),
	)
	const totalContent = splitCountLabel(
		t("slidesTemplates.templateTotalCount", { value: COUNT_MARKER }),
	)

	useEffect(() => {
		const hadTodayAdded = hadTodayAddedRef.current
		hadTodayAddedRef.current = hasTodayAdded

		if (!hasTodayAdded) {
			setView("total")
		} else if (!hadTodayAdded) {
			setView("today")
		}
	}, [hasTodayAdded])

	useEffect(() => {
		if (!hasTodayAdded) return

		const timer = window.setTimeout(() => {
			setView((current) => (current === "today" ? "total" : "today"))
		}, SLIDES_TEMPLATE_BADGE_ROTATION_INTERVAL)

		return () => window.clearTimeout(timer)
	}, [count, hasTodayAdded, todayAdded, view])

	useLayoutEffect(() => {
		const badge = badgeRef.current
		const todayMeasure = todayMeasureRef.current
		const totalMeasure = totalMeasureRef.current
		const content = badge?.closest<HTMLElement>("[data-slides-template-content]")
		const title = content?.querySelector<HTMLElement>("[data-slides-template-label]")
		const titleMeasure =
			content?.querySelector<HTMLElement>("[data-slides-template-label-measure]") ?? title
		if (!badge || !todayMeasure || !totalMeasure || !content || !titleMeasure) return

		const updateLayout = () => {
			const contentStyle = window.getComputedStyle(content)
			const gap = Number.parseFloat(contentStyle.columnGap || contentStyle.gap) || 0
			const countWidth = Math.max(
				Math.ceil(todayMeasure.getBoundingClientRect().width),
				Math.ceil(totalMeasure.getBoundingClientRect().width),
			)

			const nextStacked = shouldStackSlidesTemplateCount({
				availableWidth: content.clientWidth,
				titleWidth: titleMeasure.scrollWidth,
				countWidth,
				gap,
			})

			if (nextStacked !== stacked) {
				setStacked(nextStacked)
				onStackedChange?.(nextStacked)
			}
		}

		updateLayout()
		if (typeof ResizeObserver === "undefined") return

		const observer = new ResizeObserver(updateLayout)
		observer.observe(content)
		observer.observe(titleMeasure)

		return () => observer.disconnect()
	}, [
		count,
		hasTodayAdded,
		onStackedChange,
		stacked,
		todayAdded,
		todayContent.prefix,
		todayContent.suffix,
		totalContent.prefix,
		totalContent.suffix,
	])

	const activeView = hasTodayAdded ? view : "total"
	const activeLabel =
		activeView === "today"
			? t("slidesTemplates.todayAddedCount", { value: formatNumber(todayAdded ?? 0) })
			: t("slidesTemplates.templateTotalCount", { value: formatNumber(count) })
	const activeContent = activeView === "today" ? todayContent : totalContent
	const direction = activeView === "total" ? 1 : -1

	return (
		<span
			ref={badgeRef}
			className={cn(
				"relative inline-flex min-w-0 shrink-0 items-center font-medium tabular-nums text-[#ff6a1f]",
				stacked
					? "basis-full text-[9px] leading-3"
					: "h-6 justify-center rounded-full bg-[#fff2ec] px-2 text-sm leading-none",
			)}
			aria-label={activeLabel}
			data-slides-template-stacked={stacked ? "true" : undefined}
			data-testid={testId}
		>
			<AnimatePresence initial={false} custom={direction} mode="popLayout">
				<motion.span
					key={activeView}
					custom={direction}
					variants={contentVariants}
					initial={prefersReducedMotion ? false : "enter"}
					animate="center"
					exit={prefersReducedMotion ? undefined : "exit"}
					transition={{
						duration: prefersReducedMotion ? 0 : BADGE_TRANSITION_DURATION,
						ease: [0.22, 1, 0.36, 1],
					}}
					className="inline-flex items-center gap-1 whitespace-nowrap"
					data-testid={testId ? `${testId}-value` : undefined}
				>
					<BadgeContent
						view={activeView}
						count={count}
						todayAdded={todayAdded ?? 0}
						prefix={activeContent.prefix}
						suffix={activeContent.suffix}
						iconPosition={stacked ? "after" : "before"}
						iconClassName={stacked ? "h-[9px] w-[9px]" : undefined}
					/>
				</motion.span>
			</AnimatePresence>

			<span
				ref={todayMeasureRef}
				aria-hidden="true"
				className="pointer-events-none invisible absolute left-0 top-0 inline-flex items-center gap-1 whitespace-nowrap px-2 text-sm"
			>
				<BadgeContent
					view="today"
					count={count}
					todayAdded={todayAdded ?? 0}
					prefix={todayContent.prefix}
					suffix={todayContent.suffix}
					measure
				/>
			</span>
			<span
				ref={totalMeasureRef}
				aria-hidden="true"
				className="pointer-events-none invisible absolute left-0 top-0 inline-flex items-center gap-1 whitespace-nowrap px-2 text-sm"
			>
				<BadgeContent
					view="total"
					count={count}
					todayAdded={todayAdded ?? 0}
					prefix={totalContent.prefix}
					suffix={totalContent.suffix}
					measure
				/>
			</span>
		</span>
	)
}
