export interface InspectorDetailAttrs {
	/** Title paragraph content (context description shown above detail) */
	title: string
	/** CSS selector path */
	selector: string
	/** Element tag name (e.g. "div", "button") */
	tagName: string
	/** Formatted size string (e.g. "120 × 40 px") */
	size: string
	/** JSON-serialized computed style key-value pairs */
	computedStyles: string
	/** Number of non-trivial style properties */
	styleCount: number
	/** Truncated text content preview */
	textContent: string
}

export interface InspectorDetailOptions {}

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		inspectorDetail: {
			insertInspectorDetail: (attrs: InspectorDetailAttrs) => ReturnType
		}
	}
}
