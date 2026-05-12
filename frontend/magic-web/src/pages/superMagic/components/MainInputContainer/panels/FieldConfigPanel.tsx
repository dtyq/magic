import { useMemo, useEffect, type MouseEvent } from "react"
import type { JSONContent } from "@tiptap/core"
import { X } from "lucide-react"
import { observer } from "mobx-react-lite"
import { TemplatePanelStore } from "../stores/TemplatePanelStore"
import { useOptionalSceneStateStore } from "../stores"
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
	onTemplateSelect?: (template: OptionItem | null) => void
	onFilterChange?: (filters: FieldItem[]) => void
	/** Called when concatenated preset content changes (options configured) */
	onPresetContentChange?: (content: JSONContent | undefined) => void
	readOnly?: boolean
	variant?: ScenePanelVariant
}

const FieldConfigPanel = observer(
	({
		config,
		onTemplateSelect,
		onFilterChange,
		onPresetContentChange,
		readOnly = false,
		variant,
	}: FieldConfigPanelProps) => {
		const lt = useLocaleText()
		const { t } = useTranslation("crew/create")

		// Create store instance for this component
		const store = useMemo(() => new TemplatePanelStore(), [])
		const sceneStateStore = useOptionalSceneStateStore()
		const inputScopeKey = sceneStateStore?.inputScopeKey ?? ""

		// Initialize store when config or input scope changes
		useEffect(() => {
			store.initialize(config)
		}, [config, store, inputScopeKey])

		// Clear selection after send
		const sendCount = sceneStateStore?.sendCount
		useEffect(() => {
			if (!sendCount) return
			store.clearSelection()
		}, [sendCount, store])

		// Notify parent when concatenated preset content changes
		const concatenatedContent = store.concatenatedPresetContent
		useEffect(() => {
			if (readOnly) return

			onPresetContentChange?.(concatenatedContent)
		}, [concatenatedContent, onPresetContentChange, readOnly])

		const handleFilterChange = (filterId: string, value: string) => {
			if (readOnly) return

			store.setFilterValue(filterId, value)
			onFilterChange?.(store.field_items)
		}

		const handleTemplateClick = (template: OptionItem) => {
			if (readOnly) return

			store.setSelectedTemplate(template)
			onTemplateSelect?.(template)
			onFilterChange?.(store.field_items)
		}

		const handleTemplateClear = (event: MouseEvent<HTMLButtonElement>) => {
			if (readOnly) return

			event.preventDefault()
			event.stopPropagation()
			store.setSelectedTemplate(null)
			onTemplateSelect?.(null)
			onFilterChange?.(store.field_items)
		}

		const handleGroupChange = (groupKey: string) => {
			store.setCurrentGroupKey(groupKey)
		}

		if (config.field?.items.length === 0) {
			return null
		}

		// Conditional rendering: render Panel mode or flat mode
		if (
			(store.viewType == OptionViewType.GRID ||
				store.viewType == OptionViewType.SLIDES_PRESET) &&
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
								<span
									className={
										store.selectedTemplate
											? "inline-flex flex-shrink-0 items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium leading-none text-primary shadow-sm"
											: "inline-flex flex-shrink-0 items-center rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium leading-none text-muted-foreground"
									}
								>
									{store.selectedTemplate ? (
										<>
											<span className="mr-1 text-primary/70">
												{t("playbook.edit.presets.selected")}
											</span>
											{lt(store.selectedTemplate.label) ??
												lt(store.selectedTemplate.value) ??
												String(store.selectedTemplate.value)}
											<button
												type="button"
												aria-label={t(
													"playbook.edit.presets.clearSelection",
												)}
												data-testid="field-config-panel-template-clear-button"
												className="ml-1 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-primary/70 transition-colors hover:bg-primary/15 hover:text-primary"
												onClick={handleTemplateClear}
											>
												<X className="size-3" />
											</button>
										</>
									) : (
										t("playbook.edit.presets.unselected")
									)}
								</span>
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
