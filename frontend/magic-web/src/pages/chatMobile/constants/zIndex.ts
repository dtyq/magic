/**
 * ChatMobile Z-Index Layer Management
 *
 * Defines z-index constants for different UI layers to prevent conflicts
 * and maintain proper stacking order.
 */

export const CHAT_MOBILE_Z_INDEX = {
	// Base content layer
	CHAT_CONTENT: 1,

	// Message list and containers
	PINNED_MESSAGE_LIST: 5,

	// Sticky elements
	PINNED_MESSAGE_HEADER: 10,

	// Navigation and controls
	SEGMENTED_CONTAINER: 15,

	// Modals and overlays
	MODAL_BACKDROP: 100,
	MODAL_CONTENT: 101,

	// Tooltips and popovers
	TOOLTIP: 200,
	POPOVER: 201,

	// Toast notifications
	TOAST: 300,

	// Loading indicators
	LOADING_OVERLAY: 400,
} as const

// Type for z-index values
export type ChatMobileZIndex = (typeof CHAT_MOBILE_Z_INDEX)[keyof typeof CHAT_MOBILE_Z_INDEX]

// Helper function to get z-index value
export const getZIndex = (layer: keyof typeof CHAT_MOBILE_Z_INDEX): number => {
	return CHAT_MOBILE_Z_INDEX[layer]
}
