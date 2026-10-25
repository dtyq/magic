import type { ArrangeActionOptions, UserAction } from "../types"
import { canRequestArrangement, canRequestSpacing } from "./alignActions"

/**
 * 分布操作相关的用户动作
 */
export const distributeActions = [
	{
		id: "distribute.horizontal",
		category: "distribute",
		canExecute: canRequestSpacing,
		execute: (canvas) => {
			canvas.alignmentManager.distribute("horizontal-spacing")
		},
	},
	{
		id: "distribute.vertical",
		category: "distribute",
		canExecute: canRequestSpacing,
		execute: (canvas) => {
			canvas.alignmentManager.distribute("vertical-spacing")
		},
	},
	{
		id: "distribute.auto-layout",
		category: "distribute",
		canExecute: canRequestArrangement,
		execute: (canvas) => {
			canvas.alignmentManager.arrange("smart")
		},
	},
	{
		id: "distribute.arrange",
		category: "distribute",
		canExecute: canRequestArrangement,
		execute: (canvas, options?: ArrangeActionOptions) => {
			canvas.alignmentManager.arrange(options?.mode ?? "smart")
		},
	} satisfies UserAction<"distribute.arrange", ArrangeActionOptions>,
] satisfies UserAction[]
