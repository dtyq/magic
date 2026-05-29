import {
	MOBILE_PROJECT_ACTION_ORDER,
	SHELL_RECENT_CHAT_ACTION_KEYS,
} from "@/pages/superMagicMobile/utils/mobileProjectActionOrder"

export { MOBILE_PROJECT_ACTION_ORDER, SHELL_RECENT_CHAT_ACTION_KEYS }

/**
 * Whitelist for sidebar recent project rows (prototype 6 items, no pin / copy link).
 */
export function useMobileShellVisibleActionKeys() {
	return MOBILE_PROJECT_ACTION_ORDER
}
