import type { Canvas } from "../../core/Canvas"
import type { UserAction } from "../types"

/**
 * Keep a non-empty selection actionable long enough for AlignmentManager to
 * explain an invalid scope (mixed parents, a container mixed with peers, or a
 * single ordinary node). Empty and read-only selections remain disabled here.
 */
export function canRequestAlignment(canvas: Canvas): boolean {
	const canWrite =
		typeof canvas.permissionManager?.can === "function"
			? canvas.permissionManager.can("document.write")
			: true
	if (!canWrite) return false

	// Scope validation intentionally remains in AlignmentManager. Keeping a
	// non-empty request executable lets keyboard/action callers receive the same
	// explicit invalid-selection or insufficient-node feedback as the toolbar.
	return canvas.selectionManager.getSelectedIds().length > 0
}

export function canRequestArrangement(canvas: Canvas): boolean {
	// Keep scope and node-count validation in the manager so requests produce the
	// same feedback regardless of whether they came from a shortcut or toolbar.
	return canRequestAlignment(canvas)
}

export function canRequestSpacing(canvas: Canvas): boolean {
	// The manager owns scope validation and the historical three-node minimum.
	return canRequestAlignment(canvas)
}

/**
 * 对齐操作相关的用户动作
 */
export const alignActions: UserAction[] = [
	{
		id: "align.left",
		category: "align",
		canExecute: canRequestAlignment,
		execute: (canvas) => {
			canvas.alignmentManager.align("left")
		},
	},
	{
		id: "align.horizontal-center",
		category: "align",
		canExecute: canRequestAlignment,
		execute: (canvas) => {
			canvas.alignmentManager.align("horizontal-center")
		},
	},
	{
		id: "align.right",
		category: "align",
		canExecute: canRequestAlignment,
		execute: (canvas) => {
			canvas.alignmentManager.align("right")
		},
	},
	{
		id: "align.top",
		category: "align",
		canExecute: canRequestAlignment,
		execute: (canvas) => {
			canvas.alignmentManager.align("top")
		},
	},
	{
		id: "align.vertical-center",
		category: "align",
		canExecute: canRequestAlignment,
		execute: (canvas) => {
			canvas.alignmentManager.align("vertical-center")
		},
	},
	{
		id: "align.bottom",
		category: "align",
		canExecute: canRequestAlignment,
		execute: (canvas) => {
			canvas.alignmentManager.align("bottom")
		},
	},
]
