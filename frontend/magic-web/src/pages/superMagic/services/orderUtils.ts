/** Resolves the local insertion index from optional predecessor/successor anchors. */
export function getInsertIndexByAnchors(
	orderedIds: string[],
	predecessorId?: string | null,
	successorId?: string | null,
): number | null {
	if (predecessorId != null) {
		const predecessorIndex = orderedIds.indexOf(predecessorId)
		if (predecessorIndex !== -1) return predecessorIndex + 1
		return null
	}

	if (successorId != null) {
		const successorIndex = orderedIds.indexOf(successorId)
		if (successorIndex !== -1) return successorIndex
		return null
	}

	return orderedIds.length
}

/** Returns whether two ID arrays represent the same order. */
export function isSameOrder(currentIds: string[], expectedIds: string[]): boolean {
	return (
		currentIds.length === expectedIds.length &&
		currentIds.every((id, index) => id === expectedIds[index])
	)
}
