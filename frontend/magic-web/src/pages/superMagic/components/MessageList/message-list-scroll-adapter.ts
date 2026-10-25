export interface MessageListScrollRange {
	startIndex: number
	endIndex: number
}

export interface MessageListScrollToIndexOptions {
	align?: "start" | "end" | "center"
	smooth?: boolean
}

/**
 * Projection of virtua's `VirtualizerHandle` used by the scroll controller. Every value is served
 * from the virtualizer's measurement cache, so reading it never forces a synchronous layout the
 * way the previous `getBoundingClientRect` based adapter did.
 *
 * All addressing is by item index. Key-based lookup existed only for the history anchor
 * restoration loop, which the virtualizer's own `shift` compensation replaces.
 */
export interface MessageListScrollAdapter {
	range?: MessageListScrollRange
	/**
	 * Item count currently backing the virtualizer, including the footer row. Zero until the
	 * virtualizer mounts, which makes this the readiness signal for any index-addressed write:
	 * the adapter is published one commit earlier, while the scroll element it needs is still
	 * null, and writes issued in that window are dropped.
	 */
	readonly itemCount: number
	/** Current scrollTop of the owning scroll element. */
	readonly scrollOffset: number
	/** Current scrollHeight of the owning scroll element. */
	readonly scrollSize: number
	/** Current offsetHeight of the owning scroll element. */
	readonly viewportSize: number
	/** Nearest item index for an offset measured from the start of the scroll container. */
	findItemIndex: (offset: number) => number
	getItemOffset: (index: number) => number
	getItemSize: (index: number) => number
	scrollTo: (offset: number) => void
	scrollToIndex: (index: number, options?: MessageListScrollToIndexOptions) => void
}
