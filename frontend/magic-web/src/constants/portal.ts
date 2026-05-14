/**
 * Portal DOM element IDs used throughout the application
 * Centralized management to prevent ID conflicts and improve maintainability
 */
export const PORTAL_IDS = {
	/** Super Magic mobile project header collaboration portal, used for the project collaboration management button. */
	SUPER_MAGIC_MOBILE_HEADER_RIGHT_COLLABORATION_BUTTON:
		"super-magic-mobile-header-right-collaboration",
	/** Super Magic mobile project header more portal, used for the Ellipsis Action Sheet entry. */
	SUPER_MAGIC_MOBILE_HEADER_RIGHT_MORE_BUTTON: "super-magic-mobile-header-right-more-button",
	/** Super Magic mobile chat header files button portal */
	SUPER_MAGIC_MOBILE_CHAT_HEADER_RIGHT_FILES_BUTTON:
		"super-magic-mobile-chat-header-right-files-button",
	/** Super Magic mobile chat header share button portal */
	SUPER_MAGIC_MOBILE_CHAT_HEADER_RIGHT_SHARE_BUTTON:
		"super-magic-mobile-chat-header-right-share-button",
	/** Super Magic mobile chat header more button portal */
	SUPER_MAGIC_MOBILE_CHAT_HEADER_RIGHT_MORE_BUTTON:
		"super-magic-mobile-chat-header-right-more-button",
	/** Super Magic desktop header left section portal */
	SUPER_MAGIC_HEADER_LEFT: "super-magic-header-left",
	/** Super Magic message list fallback topic examples portal */
	SUPER_MAGIC_MESSAGE_LIST_FALLBACK_TOPIC_EXAMPLES:
		"super-magic-message-list-fallback-topic-examples",
} as const

export type PortalId = (typeof PORTAL_IDS)[keyof typeof PORTAL_IDS]
