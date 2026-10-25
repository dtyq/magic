import type { MobileSettingsRootItemAction, MobileSettingsRootItemKey } from "./types"

/** Resolve a root menu key into the panel or side effect handled by the settings stack. */
export function getMobileSettingsRootItemAction(
	itemKey: MobileSettingsRootItemKey,
): MobileSettingsRootItemAction {
	switch (itemKey) {
		case "pointsPurchase":
			return { type: "panel", panel: "pointsPurchase" }
		case "teamPoints":
			return { type: "panel", panel: "teamPoints" }
		case "personalQuota":
			return { type: "panel", panel: "personalQuota" }
		case "pointsDetail":
			return { type: "panel", panel: "pointsDetail" }
		case "orderHistory":
			return { type: "panel", panel: "orderHistory" }
		case "profile":
			return { type: "panel", panel: "profile" }
		case "accountSecurity":
			return { type: "panel", panel: "accountSecurity" }
		case "loginDevices":
			return { type: "panel", panel: "loginDevices" }
		case "appSettings":
			return { type: "panel", panel: "appSettings" }
		case "feedback":
			return { type: "panel", panel: "feedback" }
		case "logout":
			return { type: "effect", effect: "logout" }
	}
}
