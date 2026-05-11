import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

type ModelTab = "language" | "image" | "video"

interface ModelTabSwitcherProps {
	activeTab: ModelTab
	onTabChange: (tab: ModelTab) => void
	showImageTab?: boolean
	showVideoTab?: boolean
	isMobile?: boolean
}

export function ModelTabSwitcher({
	activeTab,
	onTabChange,
	showImageTab = true,
	showVideoTab = true,
	isMobile = false,
}: ModelTabSwitcherProps) {
	const { t } = useTranslation("super")
	const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
	const [indicatorStyle, setIndicatorStyle] = useState({ left: 3, width: 0 })

	const tabs = useMemo(
		() =>
			[
				{
					key: "language" as const,
					label: t("messageEditor.modelSwitch.languageModel"),
					visible: true,
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
		[t, showImageTab, showVideoTab],
	)

	const updateIndicator = useCallback(() => {
		const activeIndex = tabs.findIndex((tab) => tab.key === activeTab)
		const activeTabElement = tabRefs.current[activeIndex]
		if (!activeTabElement) return

		const parentLeft = (activeTabElement.offsetParent as HTMLElement | null)?.offsetLeft ?? 0
		setIndicatorStyle({
			left: parentLeft + activeTabElement.offsetLeft,
			width: activeTabElement.offsetWidth,
		})
	}, [activeTab, tabs])

	useLayoutEffect(() => {
		updateIndicator()
	}, [updateIndicator])

	useEffect(() => {
		window.addEventListener("resize", updateIndicator)
		return () => window.removeEventListener("resize", updateIndicator)
	}, [updateIndicator])

	if (!isMobile) {
		return (
			<div className="flex flex-col gap-1.5 self-stretch px-4 pb-2.5">
				<div className="flex items-stretch justify-stretch gap-0 rounded-[10px] bg-sidebar p-[3px]">
					{tabs.map((tab) => (
						<button
							key={tab.key}
							type="button"
							onClick={() => onTabChange(tab.key)}
							className={cn(
								"flex flex-1 items-center justify-center gap-1.5 px-2 py-1",
								"cursor-pointer rounded-md border-none bg-transparent",
								"text-sm font-medium leading-5 text-foreground transition-all duration-200",
								"hover:bg-accent",
								activeTab === tab.key &&
									"bg-card shadow-[0px_1px_2px_-1px_rgba(0,0,0,0.1),0px_1px_3px_0px_rgba(0,0,0,0.1)]",
							)}
							data-testid={`model-tab-switcher-${tab.key}`}
						>
							{tab.label}
						</button>
					))}
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
						transition:
							"left 0.35s cubic-bezier(0.4, 0, 0.2, 1), width 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
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
