import type { LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@magic-admin-v2/components/ui/button"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import { Skeleton } from "@magic-admin-v2/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@magic-admin-v2/components/ui/tabs"
import { cn } from "@magic-admin-v2/utils/cn"

export type SectionNavigationItem<T extends string> = {
	/** section 的稳定值，同时作为 Select、Tabs 和导航按钮的 value。 */
	id: T
	/** i18n 文案 key。 */
	titleKey: string
	/** section 对应的图标组件。 */
	icon: LucideIcon
}

export type SectionNavigationMode = "nav" | "select" | "tabs" | "responsive"

/** 支持导航、下拉、Tabs 以及三者响应式切换的公共配置。 */
export type SectionNavigationProps<T extends string> = {
	/** 指定展示形态；默认在移动端使用 select、中等屏幕使用 tabs、大屏使用 nav。 */
	mode?: SectionNavigationMode
	/** 可展示的 section 列表。 */
	sections: readonly SectionNavigationItem<T>[]
	/** Stable selector prefix for the rendered navigation controls. */
	testIdPrefix?: string
	/** 当前选中的 section。 */
	value: T
	/** section 变化回调。 */
	onValueChange: (value: T) => void
	/** 将 UI 层字符串值转换成业务侧 section 值。 */
	parseValue?: (value: string) => T
}

/** SectionNavigationSkeleton 的布局配置。 */
export type SectionNavigationSkeletonProps<T extends string> = {
	/** 与 SectionNavigation 对应的展示形态。 */
	mode?: SectionNavigationMode
	/** 用于决定导航骨架项数量和稳定 key 的 section 列表。 */
	sections: readonly SectionNavigationItem<T>[]
}

function resolveSection<T extends string>(sections: readonly SectionNavigationItem<T>[], value: T) {
	return sections.find((item) => item.id === value) ?? sections[0]
}

function resolveValue<T extends string>(
	sections: readonly SectionNavigationItem<T>[],
	value: string,
) {
	return sections.some((item) => item.id === value) ? (value as T) : sections[0]?.id
}

export function SectionNavigation<T extends string>({
	mode = "responsive",
	sections,
	testIdPrefix,
	value,
	onValueChange,
	parseValue,
}: SectionNavigationProps<T>) {
	const { t } = useTranslation()
	const currentItem = resolveSection(sections, value)
	const CurrentIcon = currentItem?.icon
	const parse = parseValue ?? ((nextValue: string) => resolveValue(sections, nextValue) as T)

	if (!currentItem || !CurrentIcon) return null

	return (
		<>
			{mode === "select" || mode === "responsive" ? (
				<div className={mode === "responsive" ? "md:hidden" : undefined}>
					<Select
						value={value}
						onValueChange={(nextValue) => onValueChange(parse(nextValue))}
					>
						<SelectTrigger
							className="w-full"
							data-testid={
								testIdPrefix ? `${testIdPrefix}-select-trigger` : undefined
							}
						>
							<SelectValue>
								<span className="inline-flex items-center gap-2">
									<CurrentIcon className="size-4" aria-hidden="true" />
									{t(currentItem.titleKey)}
								</span>
							</SelectValue>
						</SelectTrigger>
						<SelectContent data-testid="section-navigation-filter-content">
							{sections.map((item) => {
								const Icon = item.icon

								return (
									<SelectItem
										data-testid={
											testIdPrefix ? `${testIdPrefix}-${item.id}-option` : undefined
										}
										key={item.id}
										value={item.id}
									>
										<span className="inline-flex items-center gap-2">
											<Icon className="size-4" aria-hidden="true" />
											{t(item.titleKey)}
										</span>
									</SelectItem>
								)
							})}
						</SelectContent>
					</Select>
				</div>
			) : null}

			{mode === "tabs" || mode === "responsive" ? (
				<div className={mode === "responsive" ? "hidden md:block lg:hidden" : undefined}>
					<Tabs
						value={value}
						onValueChange={(nextValue) => onValueChange(parse(nextValue))}
					>
						<TabsList>
							{sections.map((item) => {
								const Icon = item.icon

								return (
									<TabsTrigger
										className="gap-2"
										data-testid={
											testIdPrefix ? `${testIdPrefix}-${item.id}-tab-trigger` : undefined
										}
										key={item.id}
										value={item.id}
									>
										<Icon className="size-4" aria-hidden="true" />
										{t(item.titleKey)}
									</TabsTrigger>
								)
							})}
						</TabsList>
					</Tabs>
				</div>
			) : null}

			{mode === "nav" || mode === "responsive" ? (
				<nav
					className={cn(
						"flex flex-col space-y-1",
						mode === "responsive" && "hidden lg:flex",
					)}
				>
					{sections.map((item) => {
						const Icon = item.icon
						const isActive = value === item.id

						return (
							<Button
								className={cn(
									"w-full justify-start gap-2",
									isActive
										? "bg-muted hover:bg-muted"
										: "hover:bg-transparent hover:underline",
								)}
								data-testid={
									testIdPrefix ? `${testIdPrefix}-${item.id}-button` : undefined
								}
								key={item.id}
								onClick={() => onValueChange(item.id)}
								type="button"
								variant="ghost"
							>
								<Icon className="size-4" aria-hidden="true" />
								{t(item.titleKey)}
							</Button>
						)
					})}
				</nav>
			) : null}
		</>
	)
}

export function SectionNavigationSkeleton<T extends string>({
	mode = "responsive",
	sections,
}: SectionNavigationSkeletonProps<T>) {
	return (
		<>
			{mode === "select" || mode === "responsive" ? (
				<div className={mode === "responsive" ? "md:hidden" : undefined}>
					<Skeleton className="h-10 w-full" />
				</div>
			) : null}

			{mode === "tabs" || mode === "responsive" ? (
				<div className={mode === "responsive" ? "hidden md:block lg:hidden" : undefined}>
					<Skeleton className="h-10 w-64" />
				</div>
			) : null}

			{mode === "nav" || mode === "responsive" ? (
				<div
					className={cn(
						"flex flex-col space-y-1",
						mode === "responsive" && "hidden lg:flex",
					)}
				>
					{sections.map((section) => (
						<Skeleton className="h-9 w-full" key={section.id} />
					))}
				</div>
			) : null}
		</>
	)
}
