import { memo, useMemo, useState } from "react"
import { SmoothTabs } from "@/components/shadcn-ui/smooth-tabs"
import { HomeOnboardingAnchor } from "@/pages/superMagic/components/LazyGuideTour/GuideTourManager"
import { ProjectSiderProps } from "./types"
import { cn } from "@/utils/cn"

export default memo(function ProjectSider(props: ProjectSiderProps) {
	const { items, width, className, value, onValueChange, headerTrailingAction } = props

	// 过滤掉不可见的 items
	const visibleItems = useMemo(() => items?.filter((item) => item.visible ?? true) || [], [items])

	// 使用受控模式或内部状态
	const [internalValue, setInternalValue] = useState(() => visibleItems[0]?.key || "")

	// 转换为 SmoothTabs 需要的格式
	const tabs = useMemo(
		() =>
			visibleItems.map((item) => ({
				value: item.key,
				label: "", // 不显示文本，只显示图标
				icon: item.icon ? (
					<span className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-foreground">
						{item.icon}
					</span>
				) : undefined,
				tooltip: item.title, // 添加 tooltip 显示标题
			})),
		[visibleItems],
	)

	const currentValue = value ?? internalValue
	const currentContent = useMemo(
		() => visibleItems.find((item) => item.key === currentValue)?.content,
		[visibleItems, currentValue],
	)

	const handleChange = (newValue: string) => {
		if (!value) {
			setInternalValue(newValue)
		}
		onValueChange?.(newValue)
	}

	// 如果没有可见的 items，返回空
	if (visibleItems.length === 0) {
		return null
	}

	// 如果只有一个 item，直接显示内容，不显示 tabs
	if (visibleItems.length === 1) {
		return (
			<div
				className={cn("relative flex flex-none flex-col border-border", className)}
				style={width ? { width } : undefined}
				/*
				 * The new-user guide points at this panel, so the anchor is published on either
				 * shape this component can take. Without it a sidebar that happens to have a single
				 * tab would be a page with no project files area as far as the guide can tell — see
				 * `HomeOnboardingAnchor.ProjectSider`.
				 */
				data-guide-anchor={HomeOnboardingAnchor.ProjectSider}
			>
				{visibleItems[0].content}
			</div>
		)
	}

	return (
		<div
			className={cn("relative flex flex-none flex-col border-border", className)}
			style={width ? { width } : undefined}
			data-guide-anchor={HomeOnboardingAnchor.ProjectSider}
		>
			<div className="flex h-full flex-col gap-1">
				{/* Header - 横向 Tabs */}
				<div className="m-2 mb-0 flex flex-shrink-0 items-center gap-1">
					<div className="min-w-0 flex-1">
						<SmoothTabs
							tabs={tabs}
							value={currentValue}
							onChange={handleChange}
							variant="background"
							className="h-auto w-full bg-muted p-[3px]"
							buttonClassName="py-0 h-[28px]"
							indicatorClassName="h-[28px] inset-y-[3px]"
						/>
					</div>
					{headerTrailingAction}
				</div>

				{/* Content */}
				<div className="m-0 flex-1 overflow-hidden">{currentContent}</div>
			</div>
		</div>
	)
})
