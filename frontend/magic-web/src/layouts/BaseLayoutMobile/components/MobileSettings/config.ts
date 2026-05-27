import { MOBILE_SETTINGS_SHOW_ACCOUNT_SECURITY_ENTRY } from "./constants"
import type { MobileSettingsConfig, MobileSettingsRootItemKey } from "./types"

/**
 * 共享基线只声明不依赖 enterprise 能力的入口；积分、反馈等依赖 enterprise 注入的入口由企业版 config 补齐。
 */
export function getMobileSettingsConfig(): MobileSettingsConfig {
	const accountItems: MobileSettingsRootItemKey[] = ["profile", "loginDevices"]
	if (MOBILE_SETTINGS_SHOW_ACCOUNT_SECURITY_ENTRY) {
		accountItems.splice(1, 0, "accountSecurity")
	}

	return {
		sections: [
			{
				key: "account",
				items: accountItems,
			},
			{
				key: "application",
				items: ["appSettings"],
			},
			{
				key: "logout",
				items: ["logout"],
			},
		],
	}
}
