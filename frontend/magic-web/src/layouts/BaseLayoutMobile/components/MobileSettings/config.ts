import type { MobileSettingsConfig } from "./types"

/**
 * 共享基线只声明不依赖 enterprise 能力的入口；积分、反馈等依赖 enterprise 注入的入口由企业版 config 补齐。
 */
export function getMobileSettingsConfig(): MobileSettingsConfig {
	return {
		sections: [
			{
				key: "account",
				items: ["profile", "accountSecurity", "loginDevices"],
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
