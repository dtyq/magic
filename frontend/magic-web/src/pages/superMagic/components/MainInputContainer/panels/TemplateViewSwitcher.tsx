import { lazy, Suspense } from "react"
import type { OptionItem, OptionViewType } from "./types"
import { OptionViewType as ViewType } from "./types"
import { EditableGrid } from "./grid/EditableGrid"
import { EditableWaterfall } from "./waterfall/EditableWaterfall"
import { EditableTextList } from "./textList/EditableTextList"
import { EditableCapsule } from "./capsule/EditableCapsule"

// Lazy load view-mode components (with framer-motion animations)
const TemplateGrid = lazy(() => import("./grid/TemplateGrid"))
const TemplateWaterfall = lazy(() => import("./waterfall/TemplateWaterfall"))
const TemplateTextList = lazy(() => import("./textList/TemplateTextList"))
const TemplateCapsule = lazy(() => import("./capsule/TemplateCapsule"))
const SlidesPresetGrid = lazy(() => import("./slides-preset/SlidesPresetGrid"))

type ViewModeProps = {
	mode?: "view"
	selectedTemplate?: OptionItem
	onTemplateClick: (item: OptionItem) => void
	className?: string
}

type EditModeProps = {
	mode: "edit"
	selectedKeys: Set<string>
	onSelect: (value: string, checked: boolean) => void
	onEdit: (item: OptionItem) => void
	onDelete: (value: string) => void
	onReorder?: (items: OptionItem[]) => void
}

type TemplateViewSwitcherProps = {
	viewType?: OptionViewType
	items: OptionItem[]
} & (ViewModeProps | EditModeProps)

/**
 * Unified template view switcher.
 * - mode="view" (default): single-select via click, lazy-loaded with animations.
 * - mode="edit": multi-select via checkbox with Edit/Delete CRUD actions.
 */
function TemplateViewSwitcher(props: TemplateViewSwitcherProps) {
	const { viewType, items } = props

	if (props.mode === "edit") {
		const { selectedKeys, onSelect, onEdit, onDelete, onReorder } = props
		const editProps = { items, selectedKeys, onSelect, onEdit, onDelete }

		if (viewType === ViewType.WATERFALL) return <EditableWaterfall {...editProps} />
		if (viewType === ViewType.TEXT_LIST) return <EditableTextList {...editProps} />
		if (viewType === ViewType.CAPSULE) return <EditableCapsule {...editProps} />
		return <EditableGrid {...editProps} onReorder={onReorder} />
	}

	const { selectedTemplate, onTemplateClick, className } = props as ViewModeProps
	const viewProps = { selectedTemplate, templates: items, onTemplateClick, className }

	let ViewComponent = TemplateGrid
	if (viewType === ViewType.WATERFALL) ViewComponent = TemplateWaterfall
	else if (viewType === ViewType.TEXT_LIST) ViewComponent = TemplateTextList
	else if (viewType === ViewType.CAPSULE) ViewComponent = TemplateCapsule
	else if (viewType === ViewType.SLIDES_PRESET) ViewComponent = SlidesPresetGrid

	return (
		<Suspense fallback={<div className="flex h-32 items-center justify-center" />}>
			<ViewComponent {...viewProps} />
		</Suspense>
	)
}

export default TemplateViewSwitcher
