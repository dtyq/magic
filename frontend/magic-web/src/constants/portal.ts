/**
 * Portal DOM element IDs used throughout the application
 * Centralized management to prevent ID conflicts and improve maintainability
 */
export const PORTAL_IDS = {
	/** Super Magic mobile header right collaboration button portal */
	SUPER_MAGIC_MOBILE_HEADER_RIGHT_COLLABORATION_BUTTON:
		"super-magic-mobile-header-right-collaboration",
	/** Super Magic mobile header right create button portal */
	SUPER_MAGIC_MOBILE_HEADER_RIGHT_CREATE_BUTTON: "super-magic-mobile-header-right-create-button",
	/** Super Magic desktop header left section portal */
	SUPER_MAGIC_HEADER_LEFT: "super-magic-header-left",
	/** Super Magic message list fallback topic examples portal */
	SUPER_MAGIC_MESSAGE_LIST_FALLBACK_TOPIC_EXAMPLES:
		"super-magic-message-list-fallback-topic-examples",
} as const

export type PortalId = (typeof PORTAL_IDS)[keyof typeof PORTAL_IDS]
