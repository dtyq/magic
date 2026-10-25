/**
 * Start inline rename after the current event finishes.
 * Radix menus restore trigger focus on close; delaying avoids that blur cancelling the new input.
 * Returns a cancel function so closing the panel can drop the pending start.
 */
export function scheduleFileManagerRename(start: () => void): () => void {
	const timer = window.setTimeout(start, 0)
	return () => window.clearTimeout(timer)
}
