import type { MobileSettingsConfig } from "./types"

/**
 * 设置页只声明当前版本真实可达的入口；缺少的条目即表示该能力不对外暴露。
 */
export const mobileSettingsConfig: MobileSettingsConfig = {
	sections: [
		{
			key: "points",
			items: ["pointsPurchase"],
		},
		{
			key: "account",
			items: ["profile", "accountSecurity", "loginDevices"],
		},
		{
			key: "application",
			items: ["appSettings", "feedback"],
		},
		{
			key: "logout",
			items: ["logout"],
		},
	],
}
