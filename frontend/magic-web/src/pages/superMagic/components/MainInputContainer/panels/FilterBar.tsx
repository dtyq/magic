import { useState } from "react"
import { Button } from "@/components/shadcn-ui/button"
import { Label } from "@/components/shadcn-ui/label"
import MagicDropdown from "@/components/base/MagicDropdown"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"
import { useTranslation } from "react-i18next"
import TemplateGroupSelector from "./TemplateGroupSelector"
import TemplateViewSwitcher from "./TemplateViewSwitcher"
import FilterSelectItem from "./FilterSelectItem"
import { useLocaleText } from "./hooks/useLocaleText"
import { type FieldItem, type OptionItem, type OptionGroup } from "./types"
import { isOptionGroup, isComplexField, localeTextToDisplayString } from "./utils"
import { observer } from "mobx-react-lite"
import { ChevronDown, CircleX, X } from "lucide-react"
import { ScenePanelVariant } from "../components/LazyScenePanel/types"
import { cn } from "@/lib/utils"

function getOptionValue(option: OptionItem): string {
	return localeTextToDisplayString(option.value)
}

function hasOptionValue(option: OptionItem): boolean {
	return Boolean(getOptionValue(option))
}

interface FilterBarProps {
	filters: FieldItem[]
	onFilterChange?: (filterId: string, value: string) => void
	variant?: ScenePanelVariant
	scrollContainerClassName?: string
	compact?: boolean
}

function FilterBar({
	filters,
	onFilterChange,
	variant,
	scrollContainerClassName,
	compact = false,
}: FilterBarProps) {
	const lt = useLocaleText()
	const { t } = useTranslation()
	const placeholder = t("shadcn-ui:select.placeholder")
	const clearText = t("shadcn-ui:select.clear")
	const emptyText = t("shadcn-ui:select.empty")
	const [openComplexFilterKey, setOpenComplexFilterKey] = useState<string | null>(null)
	const [groupSelectionMap, setGroupSelectionMap] = useState<Record<string, string>>({})
	const isMobile = variant === ScenePanelVariant.Mobile
	const isCompactMobile = compact && variant === ScenePanelVariant.Mobile

	const getComplexFieldState = (filter: FieldItem) => {
		const groups = filter.options.filter(isOptionGroup) as OptionGroup[]
		const templates = groups.length
			? groups.flatMap((group) => group.children || [])
			: (filter.options.filter((option) => !isOptionGroup(option)) as OptionItem[])
		const selectedTemplateOption =
			templates.find((template) => getOptionValue(template) === filter.current_value) || null
		const selectedTemplateGroup = groups.find((group) =>
			group.children?.some((item) => getOptionValue(item) === filter.current_value),
		)
		const fallbackGroupKey =
			filter.default_group_key ||
			selectedTemplateGroup?.group_key ||
			groups[0]?.group_key ||
			""
		const selectedGroupKey = groupSelectionMap[filter.data_key] || fallbackGroupKey
		const selectedGroup =
			groups.find((group) => group.group_key === selectedGroupKey) || groups[0]
		const visibleTemplates = groups.length ? selectedGroup?.children || [] : templates

		return {
			groups,
			visibleTemplates,
			selectedTemplateOption,
			selectedGroupKey,
		}
	}

	const handleComplexTemplateSelect = (filter: FieldItem, template: OptionItem) => {
		const groups = filter.options.filter(isOptionGroup) as OptionGroup[]
		const templateGroup = groups.find((group) =>
			group.children?.some((item) => getOptionValue(item) === getOptionValue(template)),
		)
		if (templateGroup) {
			setGroupSelectionMap((prev) => ({
				...prev,
				[filter.data_key]: templateGroup.group_key,
			}))
		}
		onFilterChange?.(filter.data_key, getOptionValue(template))
		setOpenComplexFilterKey(null)
	}

	const handleClearComplexTemplate = (filter: FieldItem) => {
		onFilterChange?.(filter.data_key, "")
		setOpenComplexFilterKey(null)
	}

	return (
		<HeadlessHorizontalScroll
			className="w-full"
			scrollContainerClassName={cn(
				"flex w-full min-w-0 items-center justify-between overflow-x-auto overflow-y-hidden",
				isCompactMobile ? "no-scrollbar gap-2" : "gap-4",
				variant !== ScenePanelVariant.Mobile && "px-2.5",
				scrollContainerClassName,
			)}
		>
			{filters.length > 0 && (
				<div
					className={cn(
						"flex shrink-0 items-center",
						isCompactMobile ? "gap-2" : "gap-4",
					)}
				>
					{filters.map((filter) => {
						if (isComplexField(filter)) {
							const {
								groups,
								visibleTemplates,
								selectedTemplateOption,
								selectedGroupKey,
							} = getComplexFieldState(filter)
							const availableTemplates = visibleTemplates.filter(hasOptionValue)
							const isOpen = openComplexFilterKey === filter.data_key
							const popupTitle = lt(filter.label)
							const templatePopupContent = (
								<div
									className={cn(
										"flex flex-col gap-3 overflow-hidden",
										isMobile ? "h-full min-h-0" : "h-[60vh] min-h-[300px]",
									)}
								>
									{groups.length > 1 && (
										<TemplateGroupSelector
											groups={groups}
											selectedGroupKey={selectedGroupKey}
											onGroupChange={(groupKey) =>
												setGroupSelectionMap((prev) => ({
													...prev,
													[filter.data_key]: groupKey,
												}))
											}
											leftControlClassName={cn(isMobile && "from-secondary")}
											rightControlClassName={cn(isMobile && "to-secondary")}
										/>
									)}
									{availableTemplates.length > 0 ? (
										<TemplateViewSwitcher
											viewType={filter.option_view_type}
											selectedTemplate={selectedTemplateOption || undefined}
											items={availableTemplates}
											onTemplateClick={(template) =>
												handleComplexTemplateSelect(filter, template)
											}
										/>
									) : (
										<div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
											{emptyText}
										</div>
									)}
								</div>
							)
							const triggerNode = (
								<Button
									id={`${filter.data_key}-dropdown`}
									type="button"
									variant="outline"
									size="sm"
									className={cn(
										"group h-8 max-w-[220px] justify-start rounded-full bg-background px-3 font-normal shadow-xs dark:bg-card",
										!selectedTemplateOption && "text-muted-foreground",
										isCompactMobile &&
											"h-8 min-h-8 shrink-0 gap-1 border-border bg-card pl-2.5 pr-2 text-foreground shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] dark:bg-card",
									)}
									aria-label={popupTitle}
									data-testid="mobile-scene-panel-filter-trigger"
									onClick={
										isMobile
											? () => setOpenComplexFilterKey(filter.data_key)
											: undefined
									}
								>
									<span className="flex min-w-0 items-center gap-2 truncate">
										{filter.has_leading_icon && filter.leading_icon && (
											<LucideLazyIcon
												icon={filter.leading_icon}
												size={16}
												className="text-muted-foreground"
											/>
										)}
										{isCompactMobile ? (
											<>
												<span className="whitespace-nowrap text-[11px] text-muted-foreground">
													{popupTitle}
												</span>
												<span className="whitespace-nowrap text-[13px] font-medium text-foreground">
													{lt(selectedTemplateOption?.label) ||
														lt(selectedTemplateOption?.value) ||
														placeholder}
												</span>
											</>
										) : (
											lt(selectedTemplateOption?.label) ||
											lt(selectedTemplateOption?.value) ||
											placeholder
										)}
									</span>
									<span className="relative inline-flex size-4 shrink-0 items-center justify-center">
										{selectedTemplateOption && !isCompactMobile ? (
											<span
												role="button"
												tabIndex={0}
												aria-label={clearText}
												onPointerDown={(event) => {
													event.preventDefault()
													event.stopPropagation()
												}}
												onClick={(event) => {
													event.preventDefault()
													event.stopPropagation()
													handleClearComplexTemplate(filter)
												}}
											>
												<CircleX className="size-4 text-muted-foreground opacity-50" />
											</span>
										) : (
											<ChevronDown className="size-4 text-muted-foreground opacity-50 transition-opacity" />
										)}
									</span>
								</Button>
							)

							return (
								<div
									key={filter.data_key}
									className={cn(
										"flex items-center gap-2",
										variant &&
											[ScenePanelVariant.Mobile].includes(variant) &&
											"flex-col items-start gap-1",
										isCompactMobile && "block",
									)}
								>
									{isCompactMobile ? null : (
										<Label
											htmlFor={`${filter.data_key}-dropdown`}
											className={cn(
												"text-sm font-normal text-foreground",
												variant &&
													[ScenePanelVariant.Mobile].includes(variant) &&
													"text-xs font-medium text-muted-foreground",
											)}
										>
											{lt(filter.label)}
										</Label>
									)}
									{isMobile ? (
										<>
											{triggerNode}
											<MagicPopup
												visible={isOpen}
												onClose={() => setOpenComplexFilterKey(null)}
												className="rounded-t-[14px] border-0 bg-muted"
												bodyClassName="rounded-t-[14px] border-0 bg-muted p-0 overflow-hidden"
												handlerClassName="bg-muted-foreground mb-1.5 h-1 w-20 rounded-full"
												title={popupTitle}
											>
												<div
													className="flex h-[min(640px,calc(100vh-var(--safe-area-inset-top)-var(--safe-area-inset-bottom)-44px))] min-h-0 flex-col gap-2 overflow-hidden  bg-muted"
													data-testid="mobile-scene-panel-template-popup"
												>
													<div className="relative flex h-14 shrink-0 flex-row items-center justify-center">
														<button
															type="button"
															onClick={() =>
																setOpenComplexFilterKey(null)
															}
															className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-card"
															style={{
																boxShadow:
																	"0px 8px 25px 0px rgba(0,0,0,0.10)",
															}}
															aria-label={clearText}
															data-testid="mobile-scene-panel-template-popup-close-button"
														>
															<X className="h-[22px] w-[22px] text-foreground" />
														</button>
														<div
															className="max-w-[247px] truncate text-center text-lg font-semibold leading-none text-foreground"
															data-testid="mobile-scene-panel-template-popup-title"
														>
															{popupTitle}
														</div>
													</div>

													<div className="min-h-0 flex-1 overflow-hidden px-2 pb-4">
														{templatePopupContent}
													</div>
												</div>
											</MagicPopup>
										</>
									) : (
										<MagicDropdown
											trigger={["click"]}
											open={isOpen}
											onOpenChange={(open) =>
												setOpenComplexFilterKey(
													open ? filter.data_key : null,
												)
											}
											popupRender={() => templatePopupContent}
											overlayClassName="w-[min(90vw,720px)] min-w-[320px] rounded-lg border border-border bg-popover p-3"
										>
											<span>{triggerNode}</span>
										</MagicDropdown>
									)}
								</div>
							)
						}

						return (
							<FilterSelectItem
								key={filter.data_key}
								filter={filter}
								onFilterChange={onFilterChange}
								variant={variant}
								compact={compact}
							/>
						)
					})}
				</div>
			)}
		</HeadlessHorizontalScroll>
	)
}

export default observer(FilterBar)
