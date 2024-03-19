import { observer } from "mobx-react-lite"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { useDebounceFn } from "ahooks"
import { Input } from "@/opensource/components/shadcn-ui/input"
import { Label } from "@/opensource/components/shadcn-ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/opensource/components/shadcn-ui/select"
import type { StyleSectionProps } from "../types"

const FLEX_DIRECTIONS = ["row", "row-reverse", "column", "column-reverse"]
const JUSTIFY_CONTENT = [
	"flex-start",
	"center",
	"flex-end",
	"space-between",
	"space-around",
	"space-evenly",
]
const ALIGN_ITEMS = ["flex-start", "center", "flex-end", "stretch", "baseline"]
const FLEX_WRAP = ["nowrap", "wrap", "wrap-reverse"]
const GRID_ALIGN = ["start", "center", "end", "stretch"]

/**
 * Flex/Grid Layout configuration section
 * Shows different controls based on display type
 */
const FlexGridSection = observer(function FlexGridSection({
	selectedElement,
	editorRef,
	onStyleChange,
}: StyleSectionProps) {
	const { t } = useTranslation("super")
	const computedStyles = selectedElement?.computedStyles

	// Get current display type
	const currentDisplay = computedStyles?.display || "block"

	// Flex properties
	const currentFlexDirection = computedStyles?.flexDirection || "row"
	const currentJustifyContent = computedStyles?.justifyContent || "flex-start"
	const currentAlignItems = computedStyles?.alignItems || "stretch"
	const currentFlexWrap = computedStyles?.flexWrap || "nowrap"
	const currentGap = computedStyles?.gap || "0px"

	// Grid properties
	const currentGridTemplateColumns = computedStyles?.gridTemplateColumns || "none"
	const currentGridTemplateRows = computedStyles?.gridTemplateRows || "none"
	const currentJustifyItems = computedStyles?.justifyItems || "stretch"

	// Local state
	const [gap, setGap] = useState(currentGap)
	const [gridTemplateColumns, setGridTemplateColumns] = useState(currentGridTemplateColumns)
	const [gridTemplateRows, setGridTemplateRows] = useState(currentGridTemplateRows)

	// Debounce for input changes
	const { run: onStyleChangeDebounced } = useDebounceFn(
		(property: string, value: string) => {
			onStyleChange?.(property, value)
		},
		{ wait: 300 },
	)

	/**
	 * Handle flex direction change
	 */
	const handleFlexDirectionChange = useCallback(
		(value: string) => {
			onStyleChange?.("flexDirection", value)
		},
		[onStyleChange],
	)

	/**
	 * Handle justify content change
	 */
	const handleJustifyContentChange = useCallback(
		(value: string) => {
			onStyleChange?.("justifyContent", value)
		},
		[onStyleChange],
	)

	/**
	 * Handle align items change
	 */
	const handleAlignItemsChange = useCallback(
		(value: string) => {
			onStyleChange?.("alignItems", value)
		},
		[onStyleChange],
	)

	/**
	 * Handle flex wrap change
	 */
	const handleFlexWrapChange = useCallback(
		(value: string) => {
			onStyleChange?.("flexWrap", value)
		},
		[onStyleChange],
	)

	/**
	 * Handle gap change
	 */
	const handleGapChange = useCallback(
		(value: string) => {
			setGap(value)
			if (value.trim()) {
				onStyleChangeDebounced("gap", value)
			}
		},
		[onStyleChangeDebounced],
	)

	/**
	 * Handle grid template columns change
	 */
	const handleGridTemplateColumnsChange = useCallback(
		(value: string) => {
			setGridTemplateColumns(value)
			if (value.trim()) {
				onStyleChangeDebounced("gridTemplateColumns", value)
			}
		},
		[onStyleChangeDebounced],
	)

	/**
	 * Handle grid template rows change
	 */
	const handleGridTemplateRowsChange = useCallback(
		(value: string) => {
			setGridTemplateRows(value)
			if (value.trim()) {
				onStyleChangeDebounced("gridTemplateRows", value)
			}
		},
		[onStyleChangeDebounced],
	)

	/**
	 * Handle justify items change (grid)
	 */
	const handleJustifyItemsChange = useCallback(
		(value: string) => {
			onStyleChange?.("justifyItems", value)
		},
		[onStyleChange],
	)

	// Render Flex layout controls
	if (currentDisplay === "flex") {
		return (
			<div className="space-y-4">
				<div className="space-y-2">
					<h5 className="text-xs font-medium text-muted-foreground">
						{t("stylePanel.flexboxLayout")}
					</h5>
				</div>

				{/* Flex Direction */}
				<div className="space-y-2">
					<Label htmlFor="flex-direction" className="text-xs">
						{t("stylePanel.direction")}
					</Label>
					<Select value={currentFlexDirection} onValueChange={handleFlexDirectionChange}>
						<SelectTrigger id="flex-direction">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{FLEX_DIRECTIONS.map((dir) => (
								<SelectItem key={dir} value={dir}>
									{dir}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Justify Content */}
				<div className="space-y-2">
					<Label htmlFor="justify-content" className="text-xs">
						{t("stylePanel.justifyContent")}
					</Label>
					<Select
						value={currentJustifyContent}
						onValueChange={handleJustifyContentChange}
					>
						<SelectTrigger id="justify-content">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{JUSTIFY_CONTENT.map((justify) => (
								<SelectItem key={justify} value={justify}>
									{justify}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Align Items */}
				<div className="space-y-2">
					<Label htmlFor="align-items" className="text-xs">
						{t("stylePanel.alignItems")}
					</Label>
					<Select value={currentAlignItems} onValueChange={handleAlignItemsChange}>
						<SelectTrigger id="align-items">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ALIGN_ITEMS.map((align) => (
								<SelectItem key={align} value={align}>
									{align}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Flex Wrap */}
				<div className="space-y-2">
					<Label htmlFor="flex-wrap" className="text-xs">
						{t("stylePanel.wrap")}
					</Label>
					<Select value={currentFlexWrap} onValueChange={handleFlexWrapChange}>
						<SelectTrigger id="flex-wrap">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{FLEX_WRAP.map((wrap) => (
								<SelectItem key={wrap} value={wrap}>
									{wrap}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Gap */}
				<div className="space-y-2">
					<Label htmlFor="gap" className="text-xs">
						{t("stylePanel.gap")}
					</Label>
					<Input
						id="gap"
						type="text"
						value={gap}
						onChange={(e) => handleGapChange(e.target.value)}
						placeholder={t("stylePanel.gapPlaceholder")}
						className="font-mono text-xs"
					/>
				</div>
			</div>
		)
	}

	// Render Grid layout controls
	if (currentDisplay === "grid") {
		return (
			<div className="space-y-4">
				<div className="space-y-2">
					<h5 className="text-xs font-medium text-muted-foreground">
						{t("stylePanel.gridLayout")}
					</h5>
				</div>

				{/* Grid Template Columns */}
				<div className="space-y-2">
					<Label htmlFor="grid-template-columns" className="text-xs">
						{t("stylePanel.templateColumns")}
					</Label>
					<Input
						id="grid-template-columns"
						type="text"
						value={gridTemplateColumns}
						onChange={(e) => handleGridTemplateColumnsChange(e.target.value)}
						placeholder={t("stylePanel.templateColumnsPlaceholder")}
						className="font-mono text-xs"
					/>
					<p className="text-xs text-muted-foreground">
						{t("stylePanel.templateColumnsHint")}
					</p>
				</div>

				{/* Grid Template Rows */}
				<div className="space-y-2">
					<Label htmlFor="grid-template-rows" className="text-xs">
						{t("stylePanel.templateRows")}
					</Label>
					<Input
						id="grid-template-rows"
						type="text"
						value={gridTemplateRows}
						onChange={(e) => handleGridTemplateRowsChange(e.target.value)}
						placeholder={t("stylePanel.templateRowsPlaceholder")}
						className="font-mono text-xs"
					/>
					<p className="text-xs text-muted-foreground">
						{t("stylePanel.templateRowsHint")}
					</p>
				</div>

				{/* Gap */}
				<div className="space-y-2">
					<Label htmlFor="grid-gap" className="text-xs">
						{t("stylePanel.gap")}
					</Label>
					<Input
						id="grid-gap"
						type="text"
						value={gap}
						onChange={(e) => handleGapChange(e.target.value)}
						placeholder={t("stylePanel.gapPlaceholder")}
						className="font-mono text-xs"
					/>
				</div>

				{/* Justify Items */}
				<div className="space-y-2">
					<Label htmlFor="justify-items" className="text-xs">
						{t("stylePanel.justifyItems")}
					</Label>
					<Select value={currentJustifyItems} onValueChange={handleJustifyItemsChange}>
						<SelectTrigger id="justify-items">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{GRID_ALIGN.map((align) => (
								<SelectItem key={align} value={align}>
									{align}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Align Items */}
				<div className="space-y-2">
					<Label htmlFor="grid-align-items" className="text-xs">
						{t("stylePanel.alignItems")}
					</Label>
					<Select value={currentAlignItems} onValueChange={handleAlignItemsChange}>
						<SelectTrigger id="grid-align-items">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{GRID_ALIGN.map((align) => (
								<SelectItem key={align} value={align}>
									{align}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>
		)
	}

	// Show message for other display types
	return (
		<div className="space-y-2">
			<p className="text-xs text-muted-foreground">{t("stylePanel.flexGridLayoutHint")}</p>
		</div>
	)
})

export default FlexGridSection
