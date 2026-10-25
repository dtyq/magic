/**
 * Floating Canvas surfaces are owned by one selected element. Keep this check
 * in one place so positioning and lifecycle code cannot drift apart.
 */
export function isOnlySelectedElement(
	selectedElementIds: readonly string[],
	elementId: string | null,
): boolean {
	return (
		Boolean(elementId) && selectedElementIds.length === 1 && selectedElementIds[0] === elementId
	)
}
