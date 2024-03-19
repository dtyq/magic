import { useMemo, useEffect } from "react"
import { observer } from "mobx-react-lite"
import { TemplatePanelStore } from "../stores/TemplatePanelStore"
import CollapsiblePanel from "./CollapsiblePanel"
import FilterBar from "./FilterBar"
import TemplateViewSwitcher from "./TemplateViewSwitcher"
import TemplateGroupSelector from "./TemplateGroupSelector"
import { useLocaleText } from "./hooks/useLocaleText"
import { type FieldPanelConfig, type FieldItem, type OptionItem, OptionViewType } from "./types"
import { ScenePanelVariant } from "../components/LazyScenePanel/types"
import { useTranslation } from "react-i18next"
import FilterCapsuleItem from "./FilterCapsuleItem"

interface FieldConfigPanelProps {
	config: FieldPanelConfig
	onTemplateSelect?: (template: OptionItem) => void
	onFilterChange?: (filters: FieldItem[]) => void
	/** Called when concatenated preset content changes (options configured) */
	onPresetContentChange?: (content: string) => void
	variant?: ScenePanelVariant
}

const FieldConfigPanel = observer(
	({
		config,
		onTemplateSelect,
		onFilterChange,
		onPresetContentChange,
		variant,
	}: FieldConfigPanelProps) => {
		const lt = useLocaleText()
		const { t } = useTranslation("crew/create")

		// Create store instance for this component
		const store = useMemo(() => new TemplatePanelStore(), [])

		// Initialize store when config changes
		useEffect(() => {
			store.initialize(config)
		}, [config, store])

		// Notify parent when concatenated preset content changes
		const concatenatedContent = store.concatenatedPresetContent
		useEffect(() => {
			onPresetContentChange?.(concatenatedContent)
		}, [concatenatedContent, onPresetContentChange])

		const handleFilterChange = (filterId: string, value: string) => {
			store.setFilterValue(filterId, value)
			onFilterChange?.(store.field_items)
		}

		const handleTemplateClick = (template: OptionItem) => {
			store.setSelectedTemplate(template)
			onTemplateSelect?.(template)
		}

		const handleGroupChange = (groupKey: string) => {
			store.setCurrentGroupKey(groupKey)
		}

		if (config.field?.items.length === 0) {
			return null
		}

		// Conditional rendering: render Panel mode or flat mode
		if (
			store.viewType == OptionViewType.GRID &&
			variant &&
			[ScenePanelVariant.HomePage].includes(variant)
		) {
			// Has complex field → render full Panel mode
			return (
				<CollapsiblePanel
					expandable={config.expandable}
					defaultExpanded={config.default_expanded}
					expanded={store.isExpanded}
					onExpandedChange={(open) => store.setExpanded(open)}
					header={
						<div className="flex flex-1 items-center justify-between">
							<div className="flex shrink-0 items-center gap-2 [&:empty]:hidden">
								{lt(config.title) ||
									(t("playbook.edit.presets.title") && (
										<span className="font-medium">
											{lt(config.title) || t("playbook.edit.presets.title")}
										</span>
									))}
								{store.selectedTemplate && (
									<span className="flex-shrink-0 rounded-md bg-primary px-2 py-0.5 text-xs text-primary-foreground">
										{lt(store.selectedTemplate.label) ??
											lt(store.selectedTemplate.value) ??
											String(store.selectedTemplate.value)}
									</span>
								)}
							</div>
							<FilterBar
								filters={store.simpleFields}
								onFilterChange={handleFilterChange}
								variant={variant}
								scrollContainerClassName="justify-end"
							/>
						</div>
					}
				>
					{/* Template Group Selector - only show when more than 1 group */}
					{store.hasMultipleGroups && (
						<TemplateGroupSelector
							groups={store.templateGroups}
							selectedGroupKey={store.currentGroupKey}
							onGroupChange={handleGroupChange}
						/>
					)}
					<TemplateViewSwitcher
						viewType={store.viewType}
						selectedTemplate={store.selectedTemplate ?? undefined}
						items={store.filteredTemplates}
						onTemplateClick={handleTemplateClick}
					/>
				</CollapsiblePanel>
			)
		}

		if (
			store.viewType == OptionViewType.CAPSULE &&
			variant &&
			[ScenePanelVariant.HomePage].includes(variant)
		) {
			return (
				<div className="flex flex-col gap-4">
					{store.field_items.map((item) => (
						<FilterCapsuleItem
							key={item.data_key}
							filter={item}
							onFilterChange={handleFilterChange}
						/>
					))}
				</div>
			)
		}

		return (
			<FilterBar
				filters={store.field_items}
				onFilterChange={handleFilterChange}
				variant={variant}
			/>
		)
	},
)

FieldConfigPanel.displayName = "FieldConfigPanel"

export default FieldConfigPanel
