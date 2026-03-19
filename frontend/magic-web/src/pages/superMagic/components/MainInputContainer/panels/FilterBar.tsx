import { useState } from "react"
import { Button } from "@/components/shadcn-ui/button"
import { Label } from "@/components/shadcn-ui/label"
import MagicDropdown from "@/components/base/MagicDropdown"
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
import { ChevronDown, CircleX } from "lucide-react"
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
}

function FilterBar({ filters, onFilterChange, variant, scrollContainerClassName }: FilterBarProps) {
	const lt = useLocaleText()
	const { t } = useTranslation()
	const placeholder = t("shadcn-ui:select.placeholder")
	const clearText = t("shadcn-ui:select.clear")
	const emptyText = t("shadcn-ui:select.empty")
	const [openComplexFilterKey, setOpenComplexFilterKey] = useState<string | null>(null)
	const [groupSelectionMap, setGroupSelectionMap] = useState<Record<string, string>>({})

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
				"flex w-full min-w-0 items-center justify-between gap-4 overflow-x-auto overflow-y-hidden",
				variant !== ScenePanelVariant.Mobile && "px-2.5",
				scrollContainerClassName,
			)}
		>
			{filters.length > 0 && (
				<div className="flex shrink-0 items-center gap-4">
					{filters.map((filter) => {
						if (isComplexField(filter)) {
							const {
								groups,
								visibleTemplates,
								selectedTemplateOption,
								selectedGroupKey,
							} = getComplexFieldState(filter)
							const availableTemplates = visibleTemplates.filter(hasOptionValue)

							return (
								<div
									key={filter.data_key}
									className={cn(
										"flex items-center gap-2",
										variant &&
										[ScenePanelVariant.Mobile].includes(variant) &&
										"flex-col items-start gap-1",
									)}
								>
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
									<MagicDropdown
										trigger={["click"]}
										open={openComplexFilterKey === filter.data_key}
										onOpenChange={(open) =>
											setOpenComplexFilterKey(open ? filter.data_key : null)
										}
										popupRender={() => (
											<div className="flex h-[60vh] min-h-[300px] flex-col gap-3 overflow-hidden">
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
														leftControlClassName={cn(
															variant &&
															[ScenePanelVariant.Mobile].includes(
																variant,
															) &&
															"from-secondary",
														)}
														rightControlClassName={cn(
															variant &&
															[ScenePanelVariant.Mobile].includes(
																variant,
															) &&
															"to-secondary",
														)}
													/>
												)}
												{availableTemplates.length > 0 ? (
													<TemplateViewSwitcher
														viewType={filter.option_view_type}
														selectedTemplate={
															selectedTemplateOption || undefined
														}
														items={availableTemplates}
														onTemplateClick={(template) =>
															handleComplexTemplateSelect(
																filter,
																template,
															)
														}
													/>
												) : (
													<div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
														{emptyText}
													</div>
												)}
											</div>
										)}
										overlayClassName="w-[min(90vw,720px)] min-w-[320px] rounded-lg border border-border bg-popover p-3"
									>
										<span>
											<Button
												id={`${filter.data_key}-dropdown`}
												type="button"
												variant="outline"
												size="sm"
												className={cn(
													"shadow-xs group h-8 max-w-[220px] justify-start rounded-full bg-background px-3 font-normal dark:bg-card",
													!selectedTemplateOption &&
													"text-muted-foreground",
												)}
											>
												<span className="flex items-center gap-2 truncate">
													{filter.has_leading_icon &&
														filter.leading_icon && (
															<LucideLazyIcon
																icon={filter.leading_icon}
																size={16}
																className="text-muted-foreground"
															/>
														)}
													{lt(selectedTemplateOption?.label) ??
														lt(selectedTemplateOption?.value) ??
														placeholder}
												</span>
												<span className="relative inline-flex size-4 shrink-0 items-center justify-center">
													<ChevronDown
														className={cn(
															"size-4 text-muted-foreground opacity-50 transition-opacity",
															selectedTemplateOption &&
															"group-focus-within:opacity-0 group-hover:opacity-0",
														)}
													/>
													{selectedTemplateOption && (
														<span
															role="button"
															tabIndex={0}
															aria-label={clearText}
															className="absolute inset-0 inline-flex items-center justify-center text-muted-foreground/70 opacity-0 transition-opacity group-focus-within:opacity-90 group-hover:opacity-90"
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
															<CircleX className="size-4" />
														</span>
													)}
												</span>
											</Button>
										</span>
									</MagicDropdown>
								</div>
							)
						}

						return (
							<FilterSelectItem
								key={filter.data_key}
								filter={filter}
								onFilterChange={onFilterChange}
								variant={variant}
							/>
						)
					})}
				</div>
			)}
		</HeadlessHorizontalScroll>
	)
}

export default observer(FilterBar)
