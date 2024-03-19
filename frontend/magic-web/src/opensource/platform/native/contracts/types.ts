export type NativeDestroyFn = (ignoreState: boolean) => void

export type NativeNoopDestroyFn = () => void

export interface NativeLanguageItem {
	key: string
	label: string
	label2: string
}

export interface NativeLanguagePack {
	language: string
	languageList: NativeLanguageItem[]
}

export interface NativeSafeArea {
	safeAreaInsetTop: number
	safeAreaInsetBottom: number
	safeAreaInsetLeft: number
	safeAreaInsetRight: number
	dpi: number
}

export type NativeEnvType = "saas_release" | "saas_test" | "internation"

export interface NativeEnvResult {
	env: "test" | "pre" | "released"
	screenOrientation: "portrait" | "landscape"
	region: "CN" | "US"
	language: "zh" | "en"
	"User-Agent": string
	script: "Hans" | "Hant"
	is_review_progress: boolean
}
