const DISTRIBUTED_JUSTIFY = new Set(["space-between", "space-around", "space-evenly"])

export type LayoutConstraintHint =
	| {
			kind: "distributed-alignment"
			justifyContent: string
			fix: { justifyContent: "flex-start" }
	  }
	| {
			kind: "parent-owned-size"
			axis: "width" | "height"
			fix: Record<string, string>
	  }

interface LayoutHintStyles {
	display?: string
	justifyContent?: string
	flexDirection?: string
	width?: string
	height?: string
	declaredWidth?: string
	declaredHeight?: string
	parentDisplay?: string
	parentFlexDirection?: string
	parentAlignItems?: string
	flexGrow?: string
	flexShrink?: string
	alignSelf?: string
}

function isFlexOrGrid(display?: string): boolean {
	return (
		display === "flex" ||
		display === "inline-flex" ||
		display === "grid" ||
		display === "inline-grid"
	)
}

function isVerticalFlex(direction?: string): boolean {
	return (direction || "row").includes("column")
}

function parseGrow(value?: string): number {
	const parsed = Number.parseFloat(value || "0")
	return Number.isFinite(parsed) ? parsed : 0
}

/** Stretch only owns a cross size that is still auto. */
function isDeclaredAutoSize(value?: string): boolean {
	if (value == null) return false
	const trimmed = value.trim().toLowerCase()
	return trimmed === "" || trimmed === "auto"
}

export function getLayoutConstraintHints(styles: LayoutHintStyles): LayoutConstraintHint[] {
	const hints: LayoutConstraintHint[] = []
	const justifyContent = styles.justifyContent || ""

	if (isFlexOrGrid(styles.display) && DISTRIBUTED_JUSTIFY.has(justifyContent)) {
		hints.push({
			kind: "distributed-alignment",
			justifyContent,
			fix: { justifyContent: "flex-start" },
		})
	}

	if (styles.parentDisplay !== "flex" && styles.parentDisplay !== "inline-flex") {
		return hints
	}

	const parentVertical = isVerticalFlex(styles.parentFlexDirection)
	const alignSelf = styles.alignSelf || "auto"
	const parentAlign = styles.parentAlignItems
	const stretches = alignSelf === "stretch" || (alignSelf === "auto" && parentAlign === "stretch")

	if (parseGrow(styles.flexGrow) > 0) {
		const axis = parentVertical ? "height" : "width"
		const used = axis === "width" ? styles.width : styles.height
		if (used) {
			hints.push({
				kind: "parent-owned-size",
				axis,
				fix: {
					flexGrow: "0",
					flexShrink: "0",
					[axis]: used,
				},
			})
		}
	}

	if (stretches) {
		const axis = parentVertical ? "width" : "height"
		const used = axis === "width" ? styles.width : styles.height
		const declared = axis === "width" ? styles.declaredWidth : styles.declaredHeight
		if (used && isDeclaredAutoSize(declared)) {
			hints.push({
				kind: "parent-owned-size",
				axis,
				fix: {
					alignSelf: "flex-start",
					[axis]: used,
				},
			})
		}
	}

	return hints
}
