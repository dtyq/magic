import type { NativePort } from "../native-bridge"

function createNoopDestroy() {
	return () => {}
}

export const noopNativePort: NativePort = {
	appLifecycle: {
		observeAppActiveState() {
			return createNoopDestroy()
		},
	},
	navigation: {
		observeGoBack() {
			return createNoopDestroy()
		},
		changeBottomTab() {
			return Promise.resolve(undefined)
		},
	},
	locale: {
		getLanguages() {
			return Promise.resolve({
				language: "en",
				languageList: [],
			})
		},
		changeLanguage() {
			return Promise.resolve(undefined)
		},
	},
	account: {
		syncAccountInfo() {
			return Promise.resolve(undefined)
		},
	},
	recording: {
		isAIRecordingExist() {
			return Promise.resolve({ isExist: false })
		},
		finishAIRecording() {
			return Promise.resolve(undefined)
		},
		nativeRecordingSummary() {
			return Promise.resolve({
				state: 0,
				data: {},
				message: "",
			})
		},
		observeRecordingStatusUpdated() {
			return createNoopDestroy()
		},
		getCurrentRecordingStatus() {
			return Promise.resolve({
				status: "canceled",
				interval: 0,
				volume: 0,
				workspaceId: "",
				projectId: "",
				topicId: "",
			})
		},
	},
	sharing: {
		observeReceivedSharedData() {
			return createNoopDestroy()
		},
		readyForSuperMagic() {
			return Promise.resolve()
		},
	},
	payment: {
		startInAppPurchase() {
			return Promise.resolve(undefined)
		},
		observePurchaseStatusChanged() {
			return createNoopDestroy()
		},
		restorePurchases() {
			return Promise.resolve(undefined)
		},
		popupHtmlView() {
			return Promise.resolve(undefined)
		},
		closeHtmlView() {
			return Promise.resolve(undefined)
		},
	},
	auth: {
		thirdPartyLogin() {
			return Promise.resolve({})
		},
		observeThirdPartyLoginResult() {
			return createNoopDestroy()
		},
	},
	environment: {
		changeEnv() {
			return Promise.resolve(undefined)
		},
		getEnv() {
			return Promise.resolve({
				env: "released",
				screenOrientation: "portrait",
				region: "CN",
				language: "en",
				"User-Agent": navigator.userAgent,
				script: "Hans",
				is_review_progress: false,
			})
		},
		webHasNewVersionToUpdate() {
			return Promise.resolve(undefined)
		},
	},
	ui: {
		getSafeArea() {
			return Promise.reject()
		},
	},
}
