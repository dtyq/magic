/**
 * The message list marks its actual ScrollArea viewport so virtualizer and descendant scroll
 * operations share the same element. Share pages may host rows in their own ScrollArea without
 * that marker, so descendants must also accept the shared viewport slot.
 */
export const MESSAGE_LIST_VIEWPORT_ATTRIBUTE = "data-message-list-viewport"

export const MESSAGE_LIST_VIEWPORT_SELECTOR =
	'[data-message-list-viewport], [data-slot="scroll-area-viewport"]'

export function findMessageListViewport(element: Element | null): HTMLElement | null {
	return element?.closest<HTMLElement>(MESSAGE_LIST_VIEWPORT_SELECTOR) ?? null
}
