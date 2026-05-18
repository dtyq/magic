import { memo, useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { CategoryView } from "@/services/crew/CrewService"

const ALL_CATEGORY_ID = "all"

interface CategoryFilterMobileProps {
	categories: CategoryView[]
	activeCategoryId: string
	onCategoryChange: (categoryId: string) => void
}

interface TabItem {
	id: string
	label: string
}

/**
 * Mobile-only sliding pill category filter matching the prototype design.
 * Active item uses a bg-foreground pill with animated position transition.
 * Text color inverts: active = background color, inactive = muted-foreground.
 * Uses --background-rgb / --muted-foreground-rgb CSS variables (project convention).
 */
function CategoryFilterMobile({
	categories,
	activeCategoryId,
	onCategoryChange,
}: CategoryFilterMobileProps) {
	const { t } = useTranslation("crew/market")

	const tabs: TabItem[] = [
		{ id: ALL_CATEGORY_ID, label: t("categories.allCrew") },
		...categories.map((c) => ({ id: c.id, label: c.name })),
	]

	// Track each button's offsetLeft/offsetWidth to drive the sliding pill
	const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
	const [pill, setPill] = useState({ left: 0, width: 0, ready: false })

	useLayoutEffect(() => {
		const el = tabRefs.current[activeCategoryId]
		if (!el) return
		setPill({ left: el.offsetLeft, width: el.offsetWidth, ready: true })
	}, [activeCategoryId, tabs.length])

	return (
		/*
		 * -my-1 py-3: adds vertical breathing room for the pill shadow without
		 *   affecting surrounding layout spacing.
		 * relative: anchor for the absolutely-positioned pill span.
		 * 左右留白由父容器的 px-3 提供，不再用负边距延伸到屏幕边缘，
		 * 避免两侧 tab 文字贴边被截断。
		 */
		<div className="no-scrollbar relative -my-1 flex flex-row overflow-x-auto py-3">
			{/* Animated sliding pill (visual indicator, no pointer events) */}
			<span
				aria-hidden
				className="pointer-events-none absolute top-1/2 h-8 -translate-y-1/2 rounded-full bg-foreground"
				style={{
					left: pill.left,
					width: pill.width,
					boxShadow: "0px 4px 12px 0px rgba(0,0,0,0.15)",
					opacity: pill.ready ? 1 : 0,
					transition:
						"left 220ms cubic-bezier(0.4,0,0.2,1), width 220ms cubic-bezier(0.4,0,0.2,1), opacity 120ms",
				}}
			/>

			{tabs.map((tab, index) => {
				const isActive = activeCategoryId === tab.id
				return (
					<button
						key={tab.id}
						ref={(el) => {
							tabRefs.current[tab.id] = el
						}}
						type="button"
						onClick={() => onCategoryChange(tab.id)}
						// z-10 ensures the button renders above the absolute pill span
						className="relative z-10 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium leading-none transition-colors duration-200"
						style={{
							// Active text must contrast with bg-foreground pill (dark in light mode, light in dark mode)
							// --background-rgb mirrors hsl(--background) as plain RGB for inline style use
							color: isActive
								? "rgb(var(--background-rgb))"
								: "rgb(var(--muted-foreground-rgb))",
							marginLeft: index === 0 ? 0 : 8,
						}}
						data-testid={`category-filter-${tab.id}`}
					>
						{tab.label}
					</button>
				)
			})}
		</div>
	)
}

export default memo(CategoryFilterMobile)
