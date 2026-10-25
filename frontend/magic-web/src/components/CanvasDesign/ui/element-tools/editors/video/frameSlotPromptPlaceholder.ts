import type { TFunction } from "../../../../public/i18n-types"

export type FrameSlotRole = "start" | "end"

export function resolveFrameRoleForSlotIndex(
	slotIndex: number,
	supportsStartFrame: boolean,
	supportsEndFrame: boolean,
): FrameSlotRole {
	if (supportsStartFrame && slotIndex === 0) return "start"
	return supportsEndFrame ? "end" : "start"
}

export function formatFrameSlotPromptPlaceholder(role: FrameSlotRole, t: TFunction): string {
	const label =
		role === "start"
			? t("videoEditor.slotLabelFirstFrame", "首帧")
			: t("videoEditor.slotLabelLastFrame", "尾帧")
	return `[${label}]`
}

/**
 * Pads `[首帧]` / `[尾帧]` with surrounding spaces, except at the start/end of the
 * insertion (and skips a side when the neighbor already provides whitespace).
 */
export function padFrameSlotPromptPlaceholder(
	placeholder: string,
	context: {
		isFirst: boolean
		isLast: boolean
		previousEndsWithWhitespace?: boolean
		nextStartsWithWhitespace?: boolean
	},
): string {
	let result = placeholder
	if (!context.isFirst && !context.previousEndsWithWhitespace) {
		result = ` ${result}`
	}
	if (!context.isLast && !context.nextStartsWithWhitespace) {
		result = `${result} `
	}
	return result
}

export interface FrameSlotPromptPlaceholderAllocatorOptions {
	/** Snapshot of current frame slots at paste start (path presence = occupied). */
	frameSlots: Array<string | { path?: string } | undefined | null>
	maxFrameImages?: number
	supportsStartFrame: boolean
	supportsEndFrame: boolean
	/** Set only when the selected resource slot is a frame slot. */
	selectedFrameSlotIndex?: number | null
	t: TFunction
}

function resolveOccupiedPath(
	slot: string | { path?: string } | undefined | null,
): string | undefined {
	if (!slot) return undefined
	if (typeof slot === "string") return slot
	return slot.path
}

/**
 * Allocates display-only `[首帧]` / `[尾帧]` tokens for one paste batch.
 * Reserves slots locally so consecutive assets map to real start/end roles.
 */
export function createFrameSlotPromptPlaceholderAllocator(
	options: FrameSlotPromptPlaceholderAllocatorOptions,
): (input: { destination: "frame" | "selected-slot" }) => string | null {
	const reserved: Array<{ path?: string } | undefined> = options.frameSlots.map((slot) => {
		const path = resolveOccupiedPath(slot)
		return path ? { path } : undefined
	})

	return ({ destination }) => {
		if (destination === "selected-slot") {
			if (options.selectedFrameSlotIndex == null) return null
			const slotIndex = options.selectedFrameSlotIndex
			reserved[slotIndex] = { path: "__reserved__" }
			return formatFrameSlotPromptPlaceholder(
				resolveFrameRoleForSlotIndex(
					slotIndex,
					options.supportsStartFrame,
					options.supportsEndFrame,
				),
				options.t,
			)
		}

		const firstEmpty = reserved.findIndex((slot) => !slot?.path)
		const slotIndex = firstEmpty >= 0 ? firstEmpty : reserved.length
		if (options.maxFrameImages !== undefined && slotIndex >= options.maxFrameImages) {
			return null
		}
		reserved[slotIndex] = { path: "__reserved__" }
		return formatFrameSlotPromptPlaceholder(
			resolveFrameRoleForSlotIndex(
				slotIndex,
				options.supportsStartFrame,
				options.supportsEndFrame,
			),
			options.t,
		)
	}
}
