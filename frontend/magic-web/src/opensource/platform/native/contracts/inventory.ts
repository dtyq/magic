export const nativeSdkUsageInventory = {
	appLifecycle: ["nativeCallUpdateAppActiveState"],
	navigation: ["nativeCallGoBack", "changeBottomTab"],
	locale: ["getLanguages", "changeLanguage"],
	account: ["syncAccountInfo"],
	recording: [
		"isAIRecordingExist",
		"finishAIRecording",
		"nativeRecordingSummary",
		"nativeCallRecordingStatusUpdated",
		"getCurrentRecordingStatus",
	],
	sharing: ["nativeCallReceivedSharedData", "readyForSuperMagic"],
	payment: [
		"startInAppPurchase",
		"nativeCallPurchaseStatusChanged",
		"restorePurchases",
		"popupHtmlView",
		"closeHtmlView",
	],
	auth: ["thirdPartyLogin", "nativeCallThirdPartyLoginResult"],
	environment: ["changeEnv", "getEnv", "webHasNewVersionToUpdate"],
	ui: ["getSafeArea"],
} as const

export type NativeDomainKey = keyof typeof nativeSdkUsageInventory
