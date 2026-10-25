import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"

type ModelTab = "language" | "image" | "video"

interface ModelTabSwitcherProps {
	activeTab: ModelTab
	onTabChange: (tab: ModelTab) => void
	showImageTab?: boolean
	showLanguageTab?: boolean
	showVideoTab?: boolean
	isMobile?: boolean
}

/** 选中块的滑动曲线：先快后缓，和移动端分段器保持同一手感。 */
const INDICATOR_EASING = "cubic-bezier(0.4, 0, 0.2, 1)"
const INDICATOR_DURATION_MS = 260

/**
 * 分段式 Tab。选中态是一块独立的白色指示块，在 Tab 之间平滑滑动，
 * 而不是每个按钮各自切换背景（那样会看到旧块消失、新块出现的跳变）。
 * 桌面与移动端共用同一套测量和动画，只有尺寸、圆角和配色不同。
 */
export function ModelTabSwitcher({
	activeTab,
	onTabChange,
	showImageTab = true,
	showLanguageTab = true,
	showVideoTab = true,
	isMobile = false,
}: ModelTabSwitcherProps) {
	const { t } = useTranslation("super")
	const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
	const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
	// 首次测量前不做过渡，避免面板打开时指示块从 0 宽度“长出来”。
	const [indicatorReady, setIndicatorReady] = useState(false)

	const tabs = useMemo(
		() =>
			[
				{
					key: "language" as const,
					label: t("messageEditor.modelSwitch.languageModel"),
					visible: showLanguageTab,
				},
				{
					key: "image" as const,
					label: t("messageEditor.modelSwitch.imageModel"),
					visible: showImageTab,
				},
				{
					key: "video" as const,
					label: t("messageEditor.modelSwitch.videoModel"),
					visible: showVideoTab,
				},
			].filter((item) => item.visible),
		[t, showLanguageTab, showImageTab, showVideoTab],
	)

	const updateIndicator = useCallback(() => {
		const activeIndex = tabs.findIndex((tab) => tab.key === activeTab)
		const activeTabElement = tabRefs.current[activeIndex]
		if (!activeTabElement) return

		// 按钮排在带 relative 的内层容器里，它相对外层轨道有 3px 内边距偏移，
		// 指示块是以外层轨道定位的，所以要把这段偏移加回去。
		const parentLeft = (activeTabElement.offsetParent as HTMLElement | null)?.offsetLeft ?? 0
		setIndicatorStyle({
			left: parentLeft + activeTabElement.offsetLeft,
			width: activeTabElement.offsetWidth,
		})
		setIndicatorReady(true)
	}, [activeTab, tabs])

	useLayoutEffect(() => {
		updateIndicator()
	}, [updateIndicator])

	useEffect(() => {
		window.addEventListener("resize", updateIndicator)
		return () => window.removeEventListener("resize", updateIndicator)
	}, [updateIndicator])

	const indicatorTransition = indicatorReady
		? `left ${INDICATOR_DURATION_MS}ms ${INDICATOR_EASING}, width ${INDICATOR_DURATION_MS}ms ${INDICATOR_EASING}`
		: "none"

	if (!isMobile) {
		return (
			<div className="flex flex-col gap-1.5 self-stretch px-2 pb-1.5 pt-2">
				<div
					className="relative w-full rounded-lg bg-sidebar p-[3px]"
					data-testid="model-tab-switcher"
				>
					<div
						className="pointer-events-none absolute bottom-[3px] top-[3px] rounded-md bg-card shadow-[0px_1px_2px_-1px_rgba(0,0,0,0.1),0px_1px_3px_0px_rgba(0,0,0,0.1)]"
						style={{
							left: indicatorStyle.left,
							width: indicatorStyle.width,
							transition: indicatorTransition,
						}}
						aria-hidden
					/>
					<div className="relative z-[1] flex h-7">
						{tabs.map((tab, index) => (
							<button
								key={tab.key}
								ref={(element) => {
									tabRefs.current[index] = element
								}}
								type="button"
								onClick={() => onTabChange(tab.key)}
								className={cn(
									"flex flex-1 items-center justify-center rounded-md px-2",
									"whitespace-nowrap text-sm leading-5 outline-none transition-colors duration-200",
									"focus-visible:ring-2 focus-visible:ring-ring",
									activeTab === tab.key
										? "font-medium text-foreground"
										: "font-normal text-muted-foreground hover:text-foreground",
								)}
								aria-pressed={activeTab === tab.key}
								data-testid={`model-tab-switcher-${tab.key}`}
							>
								{tab.label}
							</button>
						))}
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-1.5 self-stretch px-4 pb-2.5">
			<div
				className="relative w-full rounded-full bg-foreground/[0.06] p-[3px]"
				data-testid="model-tab-switcher"
			>
				<div
					className="pointer-events-none absolute bottom-[3px] top-[3px] rounded-full bg-card"
					style={{
						left: indicatorStyle.left,
						width: indicatorStyle.width,
						boxShadow: "0px 8px 25px 0px rgba(0,0,0,0.10)",
						transition: indicatorTransition,
					}}
					aria-hidden
				/>
				<div className="relative z-[1] flex h-[30px]">
					{tabs.map((tab, index) => (
						<button
							key={tab.key}
							ref={(element) => {
								tabRefs.current[index] = element
							}}
							type="button"
							onClick={() => onTabChange(tab.key)}
							className={cn(
								"flex flex-1 items-center justify-center rounded-full px-4",
								"whitespace-nowrap text-[14px] leading-5 transition-colors duration-200",
								activeTab === tab.key
									? "font-medium text-foreground"
									: "font-normal text-muted-foreground",
							)}
							aria-pressed={activeTab === tab.key}
							data-testid={`model-tab-switcher-${tab.key}`}
						>
							{tab.label}
						</button>
					))}
				</div>
			</div>
		</div>
	)
}
