import { useRef, useLayoutEffect, useState, useCallback, memo } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/shadcn-ui/tooltip"
import { useThrottledCallback } from "@/hooks/use-throttled-callback"

interface Tab<T = string> {
	value: T
	label: string
	icon?: React.ReactNode
	/** Tooltip 提示文本 */
	tooltip?: string
}

type IndicatorVariant = "underline" | "background"

interface SmoothTabsProps<T = string> {
	tabs: Tab<T>[]
	value: T
	onChange: (value: T) => void
	className?: string
	/** 指示器样式变体，默认为 underline（底部边框） */
	variant?: IndicatorVariant
	/** 自定义指示器类名 */
	indicatorClassName?: string
	/** 自定义按钮类名 */
	buttonClassName?: string
	/** 是否显示 Tooltip，默认为 true（当 tab.tooltip 存在时） */
	showTooltip?: boolean
}

function SmoothTabsComponent<T = string>({
	tabs,
	value,
	onChange,
	className,
	variant = "underline",
	indicatorClassName,
	buttonClassName,
	showTooltip = true,
}: SmoothTabsProps<T>) {
	const [indicatorStyle, setIndicatorStyle] = useState({
		left: 0,
		width: 0,
		shouldAnimate: false,
		initialized: false,
	})
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
	const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
	const containerRef = useRef<HTMLDivElement>(null)

	const updateIndicator = useCallback(() => {
		const activeIndex = tabs.findIndex((tab) => tab.value === value)
		const activeTab = tabRefs.current[activeIndex]

		if (activeTab && containerRef.current) {
			const containerRect = containerRef.current.getBoundingClientRect()
			const tabRect = activeTab.getBoundingClientRect()
			const left = tabRect.left - containerRect.left
			const width = tabRect.width

			setIndicatorStyle((prev) => {
				const shouldAnimate = prev.initialized
				return { left, width, shouldAnimate, initialized: true }
			})
		}
	}, [value, tabs])

	// 节流处理 resize 回调，避免频繁触发重排
	const throttledUpdateIndicator = useThrottledCallback(
		updateIndicator,
		16, // ~60fps
		[updateIndicator],
	)

	useLayoutEffect(() => {
		updateIndicator()

		const container = containerRef.current
		if (!container) return

		const resizeObserver = new ResizeObserver(() => {
			throttledUpdateIndicator()
		})

		resizeObserver.observe(container)

		return () => {
			resizeObserver.disconnect()
			throttledUpdateIndicator.cancel()
		}
	}, [updateIndicator, throttledUpdateIndicator])

	const handleTabClick = useCallback(
		(tabValue: T) => {
			onChange(tabValue)
		},
		[onChange],
	)

	const handleMouseEnter = useCallback((index: number) => {
		setHoveredIndex(index)
	}, [])

	const handleMouseLeave = useCallback(() => {
		setHoveredIndex(null)
	}, [])

	const renderTabButton = useCallback(
		(tab: Tab<T>, index: number) => {
			const isActive = tab.value === value
			const isHovered = hoveredIndex === index

			return (
				<button
					key={String(tab.value)}
					ref={(el) => (tabRefs.current[index] = el)}
					onClick={() => handleTabClick(tab.value)}
					onMouseEnter={() => handleMouseEnter(index)}
					onMouseLeave={handleMouseLeave}
					className={cn(
						"relative z-10 flex h-full flex-1 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-lg px-3.5 py-1 text-sm font-medium transition-colors",
						"focus-visible:outline-none",
						"disabled:pointer-events-none disabled:opacity-50",
						variant === "background"
							? isActive
								? "text-gray-900 dark:text-gray-100"
								: "text-gray-600 dark:text-gray-400"
							: isActive
								? "text-neutral-900 dark:text-neutral-100"
								: "text-neutral-500 dark:text-neutral-400",
						buttonClassName,
					)}
				>
					{/* 悬停背景 */}
					{!isActive && variant === "background" && (
						<motion.div
							className="absolute inset-0 rounded-lg bg-white/50 dark:bg-gray-700/50"
							initial={{ opacity: 0 }}
							animate={{
								opacity: isHovered ? 1 : 0,
							}}
							transition={{ duration: 0.2 }}
						/>
					)}
					{!isActive && variant === "underline" && (
						<motion.div
							className="absolute inset-0 rounded-[8px] bg-neutral-200/50 dark:bg-neutral-700/50"
							initial={{ opacity: 0 }}
							animate={{
								opacity: isHovered ? 1 : 0,
							}}
						/>
					)}

					{/* 图标 */}
					{tab.icon && (
						<motion.span
							className="relative z-10 flex items-center justify-center"
							initial={false}
							animate={
								variant === "underline"
									? {
										opacity: isActive ? 1 : isHovered ? 0.85 : 0.7,
									}
									: undefined
							}
						>
							{tab.icon}
						</motion.span>
					)}

					{/* 文本 */}
					{tab.label && (
						<motion.span
							className="relative z-10 leading-none"
							initial={false}
							animate={
								variant === "underline"
									? {
										opacity: isActive ? 1 : isHovered ? 0.85 : 0.7,
										y: isActive ? 0 : 0,
									}
									: undefined
							}
						>
							{tab.label}
						</motion.span>
					)}
				</button>
			)
		},
		[
			value,
			hoveredIndex,
			variant,
			buttonClassName,
			handleTabClick,
			handleMouseEnter,
			handleMouseLeave,
		],
	)

	return (
		<div
			ref={containerRef}
			className={cn("relative inline-flex h-10 items-center rounded-[10px] p-0", className)}
		>
			{indicatorStyle.initialized && (
				<motion.div
					className={cn(
						"absolute z-0",
						variant === "background"
							? "inset-y-0 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
							: "bottom-0 h-[2px] rounded-full bg-neutral-900 dark:bg-neutral-100",
						indicatorClassName,
					)}
					initial={{
						left: indicatorStyle.left,
						width: indicatorStyle.width,
					}}
					animate={{
						left: indicatorStyle.left,
						width: indicatorStyle.width,
					}}
					transition={
						!indicatorStyle.shouldAnimate
							? { duration: 0 }
							: variant === "background"
								? {
									type: "spring",
									stiffness: 300,
									damping: 30,
								}
								: undefined
					}
				/>
			)}

			{showTooltip ? (
				<TooltipProvider>
					{tabs.map((tab, index) => {
						if (tab.tooltip) {
							return (
								<Tooltip key={String(tab.value)}>
									<TooltipTrigger asChild>
										{renderTabButton(tab, index)}
									</TooltipTrigger>
									<TooltipContent>
										<p>{tab.tooltip}</p>
									</TooltipContent>
								</Tooltip>
							)
						}
						return renderTabButton(tab, index)
					})}
				</TooltipProvider>
			) : (
				tabs.map((tab, index) => renderTabButton(tab, index))
			)}
		</div>
	)
}

// 使用 memo 优化，避免父组件重渲染导致的不必要渲染
const SmoothTabs = memo(SmoothTabsComponent) as typeof SmoothTabsComponent

export { SmoothTabs }
export type { SmoothTabsProps, Tab }
