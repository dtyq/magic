import { platformKey } from "@/utils/storage"

export const NUMERIC_DRAG_HINT_STORAGE_KEY = platformKey("htmlEditor_numericDragHint_seen_v2")

let hintClaimed = false

function readSeenFlag(): boolean {
	try {
		return globalThis.localStorage?.getItem(NUMERIC_DRAG_HINT_STORAGE_KEY) === "1"
	} catch {
		return true
	}
}

export function hasSeenNumericDragHint(): boolean {
	return readSeenFlag()
}

export function markNumericDragHintSeen(): void {
	hintClaimed = true
	try {
		globalThis.localStorage?.setItem(NUMERIC_DRAG_HINT_STORAGE_KEY, "1")
	} catch {
		// Private mode or disabled storage should not block the editor.
	}
}

export function claimNumericDragHint(): boolean {
	if (hintClaimed || readSeenFlag()) return false
	hintClaimed = true
	return true
}

export function resetNumericDragHintState(): void {
	hintClaimed = false
	try {
		globalThis.localStorage?.removeItem(NUMERIC_DRAG_HINT_STORAGE_KEY)
	} catch {
		// Ignore storage cleanup failures in tests and private mode.
	}
}
