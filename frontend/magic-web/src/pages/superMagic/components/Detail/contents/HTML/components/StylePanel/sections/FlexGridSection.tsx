import { observer } from "mobx-react-lite"
import { createElement, useCallback, useEffect, useState } from "react"
import { useStylePanelStore } from "../../../iframe-bridge/contexts/StylePanelContext"
import { useTranslation } from "react-i18next"
import {
	AlignHorizontalDistributeCenter,
	AlignHorizontalJustifyCenter,
	AlignHorizontalJustifyEnd,
	AlignHorizontalJustifyStart,
	AlignHorizontalSpaceAround,
	AlignHorizontalSpaceBetween,
	AlignVerticalDistributeCenter,
	AlignVerticalJustifyCenter,
	AlignVerticalJustifyEnd,
	AlignVerticalJustifyStart,
	AlignVerticalSpaceAround,
	AlignVerticalSpaceBetween,
	ArrowDown,
	ArrowLeft,
	ArrowRight,
	ArrowUp,
	Grid2X2,
	Link2,
	StretchHorizontal,
	StretchVertical,
	type LucideIcon,
	Unlink2,
} from "lucide-react"
import { useDebounceFn } from "ahooks"
import { Input } from "@/components/shadcn-ui/input"
import { LayoutConstraintHintCard, NumericDragInput } from "../controls"
import { getLayoutConstraintHints } from "../utils/layoutConstraintHint"
import { Label } from "@/components/shadcn-ui/label"
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn-ui/select"
import { cn } from "@/utils/cn"
import type { StyleSectionProps } from "../types"
import { STYLE_PANEL_STYLES } from "../styles"
import { EditorSelectContent } from "../../EditorFloating"

const DIRECTIONS = [
	{ value: "row", icon: ArrowRight },
	{ value: "column", icon: ArrowDown },
	{ value: "row-reverse", icon: ArrowLeft },
	{ value: "column-reverse", icon: ArrowUp },
] as const
const ALIGN_CONTENT_VALUES = [
	"flex-start",
	"center",
	"flex-end",
	"space-between",
	"space-around",
	"stretch",
]
const WRAP_VALUES = ["nowrap", "wrap", "wrap-reverse"]
const GRID_ALIGN_VALUES = ["start", "center", "end", "stretch"]
const GRID_AUTO_FLOW_VALUES = ["row", "column", "dense", "row dense", "column dense"]
const SELF_ALIGN_VALUES = ["auto", "start", "center", "end", "stretch"]
const VALUE_LABEL_KEYS: Record<string, string> = {
	row: "row",
	column: "column",
	"row-reverse": "rowReverse",
	"column-reverse": "columnReverse",
	"flex-start": "flexStart",
	"flex-end": "flexEnd",
	center: "center",
	"space-between": "spaceBetween",
	"space-around": "spaceAround",
	"space-evenly": "spaceEvenly",
	stretch: "stretch",
	nowrap: "nowrap",
	wrap: "wrap",
	"wrap-reverse": "wrapReverse",
	start: "start",
	end: "end",
	auto: "auto",
	dense: "dense",
	"row dense": "flowRowDense",
	"column dense": "flowColumnDense",
}
const ALIGNMENT_ICONS: Record<"horizontal" | "vertical", Record<string, LucideIcon>> = {
	horizontal: {
		"flex-start": AlignHorizontalJustifyStart,
		center: AlignHorizontalJustifyCenter,
		"flex-end": AlignHorizontalJustifyEnd,
		stretch: StretchHorizontal,
	},
	vertical: {
		"flex-start": AlignVerticalJustifyStart,
		center: AlignVerticalJustifyCenter,
		"flex-end": AlignVerticalJustifyEnd,
		stretch: StretchVertical,
	},
}
const DISTRIBUTION_ICONS: Record<"horizontal" | "vertical", Record<string, LucideIcon>> = {
	horizontal: {
		start: AlignHorizontalJustifyStart,
		center: AlignHorizontalJustifyCenter,
		end: AlignHorizontalJustifyEnd,
		"space-between": AlignHorizontalSpaceBetween,
		"space-around": AlignHorizontalSpaceAround,
		"space-evenly": AlignHorizontalDistributeCenter,
		stretch: StretchHorizontal,
	},
	vertical: {
		start: AlignVerticalJustifyStart,
		center: AlignVerticalJustifyCenter,
		end: AlignVerticalJustifyEnd,
		"space-between": AlignVerticalSpaceBetween,
		"space-around": AlignVerticalSpaceAround,
		"space-evenly": AlignVerticalDistributeCenter,
		stretch: StretchVertical,
	},
}

function SegmentedControl({
	value,
	options,
	onChange,
	getLabel = (option) => option,
	disabled = false,
}: {
	value: string
	options: readonly string[]
	onChange: (value: string) => void
	getLabel?: (option: string) => string
	disabled?: boolean
}) {
	return (
		<div
			className={cn(
				"flex min-w-0 flex-wrap gap-0.5 rounded-md border border-border/70 bg-muted/35 p-0.5",
				disabled && "cursor-not-allowed opacity-50",
			)}
		>
			{options.map((option) => (
				<button
					key={option}
					type="button"
					aria-label={getLabel(option)}
					title={getLabel(option)}
					aria-pressed={value === option}
					disabled={disabled}
					onClick={() => onChange(option)}
					className={cn(
						"min-h-6 flex-1 rounded-sm px-1.5 text-[10px] font-medium leading-5 text-muted-foreground transition-[background-color,color,box-shadow] duration-150 hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
						value === option &&
							"bg-background text-foreground shadow-sm ring-1 ring-border/70",
						disabled &&
							"cursor-not-allowed hover:bg-transparent hover:text-muted-foreground",
					)}
				>
					{getLabel(option)}
				</button>
			))}
		</div>
	)
}

function GridOptionControl({
	value,
	options,
	onChange,
	getLabel,
	axis,
}: {
	value: string
	options: readonly string[]
	onChange: (value: string) => void
	getLabel: (value: string) => string
	axis: "horizontal" | "vertical"
}) {
	const iconMap = DISTRIBUTION_ICONS[axis]

	return (
		<div
			className="grid gap-1 rounded-md border border-border/70 bg-muted/35 p-1"
			style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
		>
			{options.map((option) => {
				const IconComponent = iconMap[option]
				return (
					<button
						key={option}
						type="button"
						aria-label={getLabel(option)}
						title={getLabel(option)}
						aria-pressed={value === option}
						onClick={() => onChange(option)}
						className={cn(
							"flex min-h-10 min-w-0 flex-col items-center justify-center gap-0.5 rounded-sm px-1 text-center text-[10px] font-medium leading-4 text-muted-foreground transition-[background-color,color,box-shadow] duration-150 hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
							value === option &&
								"bg-background text-foreground shadow-sm ring-1 ring-border/70",
						)}
					>
						{IconComponent
							? createElement(IconComponent, { className: "h-3.5 w-3.5 shrink-0" })
							: null}
						<span className="line-clamp-2">{getLabel(option)}</span>
					</button>
				)
			})}
		</div>
	)
}

function DirectionControl({
	value,
	onChange,
	getLabel,
}: {
	value: string
	onChange: (value: string) => void
	getLabel: (value: string) => string
}) {
	return (
		<div className="grid grid-cols-4 gap-0.5 rounded-md border border-border/70 bg-muted/35 p-0.5">
			{DIRECTIONS.map(({ value: direction, icon: Icon }) => (
				<button
					key={direction}
					type="button"
					aria-label={getLabel(direction)}
					title={getLabel(direction)}
					aria-pressed={value === direction}
					onClick={() => onChange(direction)}
					className={cn(
						"flex h-7 items-center justify-center rounded-sm text-muted-foreground transition-[background-color,color,box-shadow] duration-150 hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
						value === direction &&
							"bg-background text-foreground shadow-sm ring-1 ring-border/70",
					)}
				>
					<Icon className="h-3.5 w-3.5" />
				</button>
			))}
		</div>
	)
}

function AlignmentControl({
	value,
	onChange,
	getLabel,
	axis,
	values = ["flex-start", "center", "flex-end"],
}: {
	value: string
	onChange: (value: string) => void
	getLabel: (value: string) => string
	axis: "horizontal" | "vertical"
	values?: readonly string[]
}) {
	const iconMap = ALIGNMENT_ICONS[axis]

	return (
		<div
			className="grid gap-0.5 rounded-md border border-border/70 bg-muted/35 p-1"
			style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}
		>
			{values.map((item) => {
				const IconComponent = iconMap[item]
				return (
					<button
						key={item}
						type="button"
						aria-label={getLabel(item)}
						title={getLabel(item)}
						aria-pressed={value === item}
						onClick={() => onChange(item)}
						className={cn(
							"flex h-6 items-center justify-center rounded-sm text-muted-foreground transition-[background-color,color,box-shadow] duration-150 hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
							value === item &&
								"bg-background text-foreground shadow-sm ring-1 ring-border/70",
						)}
					>
						{IconComponent
							? createElement(IconComponent, { className: "h-3.5 w-3.5" })
							: null}
					</button>
				)
			})}
		</div>
	)
}

function CompactField({
	id,
	label,
	value,
	onChange,
	onCommit,
	hint,
	numeric = false,
	numericUnit = "px",
	numericMin,
}: {
	id: string
	label: string
	value: string
	onChange: (value: string) => void
	onCommit?: (value: string) => void
	hint?: string
	numeric?: boolean
	numericUnit?: string
	numericMin?: number
}) {
	// CSS shorthands such as `40px 30px` are valid for `gap`, but the
	// control edits one numeric value at a time. Only use the first token's
	// unit so the rest of a shorthand value cannot leak into the suffix.
	const numericValue = value.trim().match(/^(-?\d*\.?\d+)\s*([a-zA-Z%]+)?/)
	const numberPart = numericValue?.[1] || ""
	const unitPart = numericValue?.[2] || numericUnit
	const handleNumericChange = useCallback(
		(nextValue: string) => onChange(nextValue ? `${nextValue}${unitPart}` : ""),
		[onChange, unitPart],
	)
	const handleNumericCommit = useCallback(
		(nextValue: string) => onCommit?.(nextValue ? `${nextValue}${unitPart}` : ""),
		[onCommit, unitPart],
	)

	return (
		<div className="min-w-0 space-y-1">
			<Label htmlFor={id} className="text-[10px] font-medium leading-4 text-muted-foreground">
				{label}
			</Label>
			{numeric ? (
				<div className="relative min-w-0">
					<NumericDragInput
						id={id}
						value={numberPart}
						onChange={handleNumericChange}
						onCommit={onCommit ? handleNumericCommit : undefined}
						onBlur={
							onCommit
								? (event) => handleNumericCommit(event.currentTarget.value)
								: undefined
						}
						min={numericMin}
						aria-label={label}
						className="h-8 w-full min-w-0 rounded-md border-border/70 bg-background px-2.5 pr-8 font-mono text-[12px] tabular-nums transition-[background-color,border-color,box-shadow] duration-150 hover:border-primary/45 hover:bg-primary/5 focus-visible:border-primary/70 focus-visible:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/20"
					/>
					<span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] font-medium text-muted-foreground">
						{unitPart}
					</span>
				</div>
			) : (
				<Input
					id={id}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					className="h-7 rounded-md px-2 font-mono text-[11px]"
				/>
			)}
			{hint ? <p className="truncate text-[9px] text-muted-foreground/75">{hint}</p> : null}
		</div>
	)
}

function getGapAxisValue(value: string | undefined, axis: 0 | 1): string {
	const tokens = value?.trim().split(/\s+/).filter(Boolean) ?? []
	const token = tokens[axis] || tokens[0]

	return token && /^-?\d*\.?\d+[a-zA-Z%]*$/.test(token) ? token : "0px"
}

const FlexGridSection = observer(function FlexGridSection({
	selectedElement,
	editorRef,
	onStyleChange,
}: StyleSectionProps) {
	const { t } = useTranslation("super")
	const stylePanelStore = useStylePanelStore()
	const isGapLinked = stylePanelStore.gapAxesLinked
	const styles = selectedElement?.computedStyles
	const display = styles?.display || "block"
	const parentDisplay = styles?.parentDisplay
	const isFlex = display === "flex"
	const isGrid = display === "grid"
	const isFlexItem = parentDisplay === "flex"
	const isGridItem = parentDisplay === "grid"
	// `gap` is still a valid fallback for older inline styles, but the UI edits
	// the explicit row/column properties so linking never relies on shorthand parsing.
	const initialRowGap = getGapAxisValue(styles?.rowGap ?? styles?.gap, 0)
	const initialColumnGap = getGapAxisValue(styles?.columnGap ?? styles?.gap, 1)
	const [rowGap, setRowGap] = useState(initialRowGap)
	const [columnGap, setColumnGap] = useState(initialColumnGap)
	const [columns, setColumns] = useState(styles?.gridTemplateColumns || "none")
	const [rows, setRows] = useState(styles?.gridTemplateRows || "none")

	useEffect(() => {
		const nextRowGap = getGapAxisValue(styles?.rowGap ?? styles?.gap, 0)
		const nextColumnGap = getGapAxisValue(styles?.columnGap ?? styles?.gap, 1)
		setRowGap(nextRowGap)
		setColumnGap(nextColumnGap)
		setColumns(styles?.gridTemplateColumns || "none")
		setRows(styles?.gridTemplateRows || "none")
	}, [
		selectedElement?.selector,
		styles?.columnGap,
		styles?.gap,
		styles?.gridTemplateColumns,
		styles?.gridTemplateRows,
		styles?.rowGap,
	])

	const { run: applyDebounced } = useDebounceFn(
		(changes: Record<string, string>) => {
			Object.entries(changes).forEach(([property, value]) => onStyleChange?.(property, value))
		},
		{ wait: 250 },
	)
	const updateInput = useCallback(
		(property: string, value: string, setValue: (value: string) => void) => {
			setValue(value)
			if (value.trim()) applyDebounced({ [property]: value })
		},
		[applyDebounced],
	)
	const updateGapInput = useCallback((axis: "row" | "column", value: string) => {
		if (axis === "row") {
			setRowGap(value)
		} else {
			setColumnGap(value)
		}
	}, [])
	// Preview both fields during editing, then submit the final value only from
	// NumericDragInput's commit callback (pointer release, keyboard nudge, or blur).
	const commitGapInput = useCallback(
		(axis: "row" | "column", value: string) => {
			if (!value.trim()) return
			if (isGapLinked) {
				applyDebounced({ rowGap: value, columnGap: value })
			} else {
				applyDebounced({ [axis === "row" ? "rowGap" : "columnGap"]: value })
			}
		},
		[applyDebounced, isGapLinked],
	)
	const getValueLabel = useCallback(
		(value: string) => t(`stylePanel.layoutValues.${VALUE_LABEL_KEYS[value] || value}`, value),
		[t],
	)
	const flexDirection = styles?.flexDirection || "row"
	const isVerticalFlexDirection = flexDirection.includes("column")
	const flexWrap = styles?.flexWrap || "nowrap"
	const canAlignMultipleLines = flexWrap !== "nowrap"
	const sectionTitle = t(
		isFlex
			? "stylePanel.flexboxLayout"
			: isGrid
				? "stylePanel.gridLayout"
				: isFlexItem
					? "stylePanel.flexItem"
					: "stylePanel.gridItem",
	)
	const sectionSubtitle = t(
		isFlex
			? "stylePanel.layoutValues.flexContainer"
			: isGrid
				? "stylePanel.layoutValues.gridContainer"
				: isFlexItem
					? "stylePanel.layoutValues.flexItem"
					: "stylePanel.layoutValues.gridItem",
	)
	if (!isFlex && !isGrid && !isFlexItem && !isGridItem) {
		return (
			<p className="text-[11px] leading-4 text-muted-foreground">
				{t("stylePanel.flexGridLayoutHint")}
			</p>
		)
	}

	return (
		<div className="min-w-0 space-y-2" data-testid="html-style-panel-flex-grid-section">
			<div className={STYLE_PANEL_STYLES.subsectionTitle}>
				<span className="flex h-6 w-6 items-center justify-center rounded-sm border border-border/70 bg-muted/35 text-muted-foreground">
					<Grid2X2 className="h-3.5 w-3.5" />
				</span>
				<div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
					<h5 className="min-w-0 truncate text-xs font-semibold" title={sectionTitle}>
						{sectionTitle}
					</h5>
					<p className="min-w-0 shrink truncate text-right text-[9px] text-muted-foreground">
						{sectionSubtitle}
					</p>
				</div>
			</div>

			{isFlex ? (
				<>
					<div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
						<Label className="text-[10px] text-muted-foreground">
							{t("stylePanel.direction")}
						</Label>
						<DirectionControl
							value={styles?.flexDirection || "row"}
							getLabel={getValueLabel}
							onChange={(value) => onStyleChange?.("flexDirection", value)}
						/>
					</div>
					<div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
						<Label className="text-[10px] text-muted-foreground">
							{t("stylePanel.justifyContent")}
						</Label>
						<AlignmentControl
							value={styles?.justifyContent || "flex-start"}
							getLabel={getValueLabel}
							axis={isVerticalFlexDirection ? "vertical" : "horizontal"}
							onChange={(value) => onStyleChange?.("justifyContent", value)}
						/>
					</div>
					<div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
						<Label className="text-[10px] text-muted-foreground">
							{t("stylePanel.alignItems")}
						</Label>
						<AlignmentControl
							value={styles?.alignItems || "flex-start"}
							getLabel={getValueLabel}
							axis={isVerticalFlexDirection ? "horizontal" : "vertical"}
							values={["flex-start", "center", "flex-end", "stretch"]}
							onChange={(value) => onStyleChange?.("alignItems", value)}
						/>
					</div>
					<div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
						<Label className="text-[10px] text-muted-foreground">
							{t("stylePanel.wrap")}
						</Label>
						<SegmentedControl
							value={styles?.flexWrap || "nowrap"}
							options={WRAP_VALUES}
							getLabel={getValueLabel}
							onChange={(value) => onStyleChange?.("flexWrap", value)}
						/>
					</div>
				</>
			) : isGrid ? (
				<>
					<CompactField
						id="grid-template-columns"
						label={t("stylePanel.templateColumns")}
						value={columns}
						onChange={(value) => updateInput("gridTemplateColumns", value, setColumns)}
						hint={t("stylePanel.templateColumnsHint")}
					/>
					<CompactField
						id="grid-template-rows"
						label={t("stylePanel.templateRows")}
						value={rows}
						onChange={(value) => updateInput("gridTemplateRows", value, setRows)}
						hint={t("stylePanel.templateRowsHint")}
					/>
					<div className="space-y-2">
						<CompactField
							id="grid-auto-columns"
							label={t("stylePanel.gridAutoColumns")}
							value={styles?.gridAutoColumns || "auto"}
							onChange={(value) => onStyleChange?.("gridAutoColumns", value)}
						/>
						<CompactField
							id="grid-auto-rows"
							label={t("stylePanel.gridAutoRows")}
							value={styles?.gridAutoRows || "auto"}
							onChange={(value) => onStyleChange?.("gridAutoRows", value)}
						/>
					</div>
					<div className="space-y-1">
						<Label className="text-[10px] font-medium text-muted-foreground">
							{t("stylePanel.gridAutoFlow")}
						</Label>
						<Select
							value={styles?.gridAutoFlow || "row"}
							onValueChange={(value) => onStyleChange?.("gridAutoFlow", value)}
						>
							<SelectTrigger className="h-7 rounded-md px-2 text-[11px]">
								<SelectValue />
							</SelectTrigger>
							<EditorSelectContent>
								{GRID_AUTO_FLOW_VALUES.map((value) => (
									<SelectItem key={value} value={value}>
										{getValueLabel(value)}
									</SelectItem>
								))}
							</EditorSelectContent>
						</Select>
					</div>
				</>
			) : null}

			{isFlex || isGrid ? (
				<>
					{/* Keep the link action beside the two controls without adding another panel layer. */}
					<div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
						<CompactField
							id="layout-row-gap"
							label={t("stylePanel.rowGap")}
							value={rowGap}
							onChange={(value) => updateGapInput("row", value)}
							onCommit={(value) => commitGapInput("row", value)}
							numeric
							numericMin={0}
						/>
						<CompactField
							id="layout-column-gap"
							label={t("stylePanel.columnGap")}
							value={columnGap}
							onChange={(value) => updateGapInput("column", value)}
							onCommit={(value) => commitGapInput("column", value)}
							numeric
							numericMin={0}
						/>
						<button
							type="button"
							data-testid="layout-gap-link-toggle"
							aria-label={
								isGapLinked ? t("stylePanel.unlinkGaps") : t("stylePanel.linkGaps")
							}
							title={
								isGapLinked ? t("stylePanel.unlinkGaps") : t("stylePanel.linkGaps")
							}
							aria-pressed={isGapLinked}
							onClick={() => stylePanelStore.setGapAxesLinked(!isGapLinked)}
							className={cn(
								"mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]",
								isGapLinked && "bg-muted text-foreground",
							)}
						>
							{isGapLinked ? (
								<Link2 className="h-3.5 w-3.5" />
							) : (
								<Unlink2 className="h-3.5 w-3.5" />
							)}
						</button>
					</div>
					{getLayoutConstraintHints(styles || {})
						.filter((hint) => hint.kind === "distributed-alignment")
						.map((hint) => (
							<LayoutConstraintHintCard
								key={hint.kind}
								hint={hint}
								selector={selectedElement?.selector}
								editorRef={editorRef}
								onApply={(nextStyles) => {
									Object.entries(nextStyles).forEach(([property, value]) => {
										onStyleChange?.(property, value)
									})
								}}
							/>
						))}

					{isGrid ? (
						<div className="space-y-2">
							<div className="space-y-1">
								<Label className="text-[10px] font-medium text-muted-foreground">
									{t("stylePanel.justifyContent")}
								</Label>
								<GridOptionControl
									value={styles?.justifyContent || "start"}
									options={[
										"start",
										"center",
										"end",
										"space-between",
										"space-around",
										"space-evenly",
									]}
									getLabel={getValueLabel}
									axis="horizontal"
									onChange={(value) => onStyleChange?.("justifyContent", value)}
								/>
							</div>
							<div className="space-y-1">
								<Label className="text-[10px] font-medium text-muted-foreground">
									{t("stylePanel.alignContent")}
								</Label>
								<GridOptionControl
									value={styles?.alignContent || "start"}
									options={[
										"start",
										"center",
										"end",
										"space-between",
										"space-around",
										"stretch",
									]}
									getLabel={getValueLabel}
									axis="vertical"
									onChange={(value) => onStyleChange?.("alignContent", value)}
								/>
							</div>
						</div>
					) : null}
					{isFlex ? (
						<div className="space-y-1">
							<div className="flex items-center justify-between gap-2">
								<Label className="text-[10px] font-medium text-muted-foreground">
									{t("stylePanel.alignContent")}
								</Label>
								{!canAlignMultipleLines ? (
									<span className="truncate text-[9px] text-muted-foreground/75">
										{t("stylePanel.alignContentRequiresWrap")}
									</span>
								) : null}
							</div>
							<SegmentedControl
								value={
									styles?.alignContent === "normal"
										? "stretch"
										: styles?.alignContent || "stretch"
								}
								options={ALIGN_CONTENT_VALUES}
								getLabel={getValueLabel}
								disabled={!canAlignMultipleLines}
								onChange={(value) => onStyleChange?.("alignContent", value)}
							/>
						</div>
					) : null}
				</>
			) : null}

			{isFlexItem ? (
				<div className="space-y-2 border-t border-border/60 pt-2">
					<h6 className="text-[10px] font-semibold text-muted-foreground">
						{t("stylePanel.flexItem")}
					</h6>
					<div className="grid grid-cols-2 gap-2">
						<CompactField
							id="flex-order"
							label={t("stylePanel.order")}
							value={styles?.order || "0"}
							onChange={(value) => onStyleChange?.("order", value)}
							numeric
							numericUnit=""
						/>
						<CompactField
							id="flex-basis"
							label={t("stylePanel.flexBasis")}
							value={styles?.flexBasis || "auto"}
							onChange={(value) => onStyleChange?.("flexBasis", value)}
						/>
					</div>
					<div className="grid grid-cols-2 gap-2">
						<CompactField
							id="flex-grow"
							label={t("stylePanel.flexGrow")}
							value={styles?.flexGrow || "0"}
							onChange={(value) => onStyleChange?.("flexGrow", value)}
							numeric
							numericUnit=""
							numericMin={0}
						/>
						<CompactField
							id="flex-shrink"
							label={t("stylePanel.flexShrink")}
							value={styles?.flexShrink || "1"}
							onChange={(value) => onStyleChange?.("flexShrink", value)}
							numeric
							numericUnit=""
							numericMin={0}
						/>
					</div>
					<div className="space-y-1">
						<Label className="text-[10px] font-medium text-muted-foreground">
							{t("stylePanel.alignSelf")}
						</Label>
						<Select
							value={styles?.alignSelf || "auto"}
							onValueChange={(value) => onStyleChange?.("alignSelf", value)}
						>
							<SelectTrigger className="h-7 rounded-md px-2 text-[11px]">
								<SelectValue />
							</SelectTrigger>
							<EditorSelectContent>
								{SELF_ALIGN_VALUES.map((value) => (
									<SelectItem key={value} value={value}>
										{getValueLabel(value)}
									</SelectItem>
								))}
							</EditorSelectContent>
						</Select>
					</div>
				</div>
			) : null}

			{isGridItem ? (
				<div className="space-y-2 border-t border-border/60 pt-2">
					<h6 className="text-[10px] font-semibold text-muted-foreground">
						{t("stylePanel.gridItem")}
					</h6>
					<div className="grid grid-cols-2 gap-2">
						<CompactField
							id="grid-column"
							label={t("stylePanel.gridColumn")}
							value={styles?.gridColumn || "auto"}
							onChange={(value) => onStyleChange?.("gridColumn", value)}
						/>
						<CompactField
							id="grid-row"
							label={t("stylePanel.gridRow")}
							value={styles?.gridRow || "auto"}
							onChange={(value) => onStyleChange?.("gridRow", value)}
						/>
					</div>
					<div className="grid grid-cols-2 gap-2">
						<div className="space-y-1">
							<Label className="text-[10px] font-medium text-muted-foreground">
								{t("stylePanel.justifySelf")}
							</Label>
							<Select
								value={styles?.justifySelf || "auto"}
								onValueChange={(value) => onStyleChange?.("justifySelf", value)}
							>
								<SelectTrigger className="h-7 rounded-md px-2 text-[11px]">
									<SelectValue />
								</SelectTrigger>
								<EditorSelectContent>
									{SELF_ALIGN_VALUES.map((value) => (
										<SelectItem key={value} value={value}>
											{getValueLabel(value)}
										</SelectItem>
									))}
								</EditorSelectContent>
							</Select>
						</div>
						<div className="space-y-1">
							<Label className="text-[10px] font-medium text-muted-foreground">
								{t("stylePanel.alignSelf")}
							</Label>
							<Select
								value={styles?.alignSelf || "auto"}
								onValueChange={(value) => onStyleChange?.("alignSelf", value)}
							>
								<SelectTrigger className="h-7 rounded-md px-2 text-[11px]">
									<SelectValue />
								</SelectTrigger>
								<EditorSelectContent>
									{SELF_ALIGN_VALUES.map((value) => (
										<SelectItem key={value} value={value}>
											{getValueLabel(value)}
										</SelectItem>
									))}
								</EditorSelectContent>
							</Select>
						</div>
					</div>
				</div>
			) : null}

			{isGrid ? (
				<div className="space-y-2">
					<div className="space-y-1">
						<Label className="text-[10px] font-medium text-muted-foreground">
							{t("stylePanel.justifyItems")}
						</Label>
						<GridOptionControl
							value={styles?.justifyItems || "stretch"}
							options={GRID_ALIGN_VALUES}
							getLabel={getValueLabel}
							axis="horizontal"
							onChange={(value) => onStyleChange?.("justifyItems", value)}
						/>
					</div>
					<div className="space-y-1">
						<Label className="text-[10px] font-medium text-muted-foreground">
							{t("stylePanel.alignItems")}
						</Label>
						<GridOptionControl
							value={styles?.alignItems || "stretch"}
							options={GRID_ALIGN_VALUES}
							getLabel={getValueLabel}
							axis="vertical"
							onChange={(value) => onStyleChange?.("alignItems", value)}
						/>
					</div>
				</div>
			) : null}
		</div>
	)
})

export default FlexGridSection
