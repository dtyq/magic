/**
 * Z-Index Management for HTML Editor
 * Centralized z-index values to maintain clear visual hierarchy
 *
 * Layer Structure (from bottom to top):
 * 1. Base Layer (1-99): Basic UI elements
 * 2. Toolbar Layer (100-899): Edit toolbars and panels
 * 3. Fullscreen Layer (900): PPT fullscreen containers
 * 4. Editor Chrome (910-980): Context toolbar, selection overlay, editor popovers
 * 5. App Modal Layer (1000): Dialogs such as PPT export
 * 6. Iframe Internal Layer (1000-1999): Elements inside iframe (V2 editing mechanism)
 * 7. Overlay Layer (9000-9999): Selection highlights inside the overlay stacking context
 *
 * @note The old V1 editing script (utils/editing-script.ts) is deprecated and not managed here.
 * It uses hardcoded z-index values (999, 1001, 1002, etc.) for backward compatibility.
 */

/** Matches --z-index-modal / --z-index-popup in src/index.css. */
export const APP_MODAL_Z_INDEX = 1000

export const HTML_EDITOR_Z_INDEX = {
	// Base Layer (1-99)
	// Basic UI elements that should stay behind most content
	BASE: {
		/** SelectionOverlay root. Keep below app dialogs such as PPT export. */
		SELECTION_OVERLAY_ROOT: 930,
		/** PPT Sidebar and its buttons */
		SIDEBAR: 10,
		/**
		 * PPT sidebar width drag strip.
		 * Stay at/above the sidebar, but below the canvas so
		 * selection handles (fixed overlay in the canvas stack)
		 * receive pointer events on the divider.
		 */
		SIDEBAR_RESIZE: 10,
		/** PPT canvas column. Above sidebar so selection chrome is visible. */
		SLIDE_CANVAS: 11,
	},

	// Toolbar Layer (100-899)
	// Edit toolbars and control panels
	TOOLBAR: {
		/** StylePanel - floating toolbar for style editing */
		STYLE_PANEL: 100,
	},

	// Iframe Internal Layer (1000-1999)
	// Elements rendered inside the iframe (editing-script.ts)
	IFRAME_INTERNAL: {
		/** Resize handles container */
		RESIZE_HANDLES_CONTAINER: 1000,
		/** Individual resize handles and color picker */
		RESIZE_HANDLES: 1010,
		/** Drag handle for moving elements */
		DRAG_HANDLE: 1020,
	},

	// Overlay Layer (9000-9999)
	// Selection and hover highlights rendered in parent window
	OVERLAY: {
		/** Hovered element highlight border */
		HOVER_HIGHLIGHT: 9000,
		/** Selected element highlight with handles */
		SELECTION_HIGHLIGHT: 9100,
		/** Text style toolbar (above selection) */
		TEXT_STYLE_TOOLBAR: 9200,
	},

	// Fullscreen Layer (~900)
	// Stay below editor chrome so the context toolbar remains usable.
	FULLSCREEN: {
		/** PPT Render fullscreen container */
		CONTAINER: 900,
	},

	/**
	 * Floating controls rendered by the HTML editor in the parent document.
	 * Stay above fullscreen PPT, but below the app modal stack (1000).
	 */
	EDITOR_FLOATING: {
		DOM_TREE: 910,
		CONTEXT_PANEL: 920,
		POPOVER: 940,
		SELECT: 950,
		TOOLTIP: 960,
		CONTEXT_MENU: 970,
		DROPDOWN: 980,
	},
} as const

/**
 * Pre-generated Tailwind z-index classes for all defined values
 * This ensures Tailwind's JIT compiler can properly detect and generate these classes
 */
export const TAILWIND_Z_INDEX_CLASSES = {
	BASE: {
		SELECTION_OVERLAY_ROOT: "z-[930]",
		SIDEBAR: "z-[10]",
		SIDEBAR_RESIZE: "z-[10]",
		SLIDE_CANVAS: "z-[11]",
	},
	TOOLBAR: {
		STYLE_PANEL: "z-[100]",
	},
	IFRAME_INTERNAL: {
		RESIZE_HANDLES_CONTAINER: "z-[1000]",
		RESIZE_HANDLES: "z-[1010]",
		DRAG_HANDLE: "z-[1020]",
	},
	OVERLAY: {
		HOVER_HIGHLIGHT: "z-[9000]",
		SELECTION_HIGHLIGHT: "z-[9100]",
		TEXT_STYLE_TOOLBAR: "z-[9200]",
	},
	FULLSCREEN: {
		CONTAINER: "z-[900]",
	},
	EDITOR_FLOATING: {
		DOM_TREE: "!z-[910]",
		CONTEXT_PANEL: "!z-[920]",
		POPOVER: "!z-[940]",
		SELECT: "!z-[950]",
		TOOLTIP: "!z-[960]",
		CONTEXT_MENU: "!z-[970]",
		DROPDOWN: "!z-[980]",
	},
} as const

/**
 * Helper function to get Tailwind z-index class
 * @deprecated Use TAILWIND_Z_INDEX_CLASSES directly for better type safety and Tailwind JIT compatibility
 * @param value - z-index numeric value
 * @returns Tailwind class string (e.g., "z-[100]")
 */
export function getTailwindZIndex(value: number): string {
	return `z-[${value}]`
}

/**
 * Helper function to get inline style z-index (recommended for dynamic values)
 * @param value - z-index numeric value
 * @returns Inline style object
 */
export function getInlineZIndex(value: number): { zIndex: number } {
	return { zIndex: value }
}

/**
 * Helper function to get z-index string for iframe internal elements
 * @param value - z-index numeric value
 * @returns String value for style.zIndex assignment
 */
export function getIframeZIndex(value: number): string {
	return String(value)
}
