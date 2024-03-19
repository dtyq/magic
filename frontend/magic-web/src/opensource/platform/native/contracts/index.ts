import type { AccountPort } from "./account"
import type { AppLifecyclePort } from "./appLifecycle"
import type { AuthPort } from "./auth"
import type { EnvironmentPort } from "./environment"
import type { LocalePort } from "./locale"
import type { NavigationPort } from "./navigation"
import type { PaymentPort } from "./payment"
import type { RecordingPort } from "./recording"
import type { SharingPort } from "./sharing"
import type { UiPort } from "./ui"

export interface NativeBridge {
	appLifecycle: AppLifecyclePort
	navigation: NavigationPort
	locale: LocalePort
	account: AccountPort
	recording: RecordingPort
	sharing: SharingPort
	payment: PaymentPort
	auth: AuthPort
	environment: EnvironmentPort
	ui: UiPort
}

export type { AccountPort, NativeSyncAccountInfoParams } from "./account"
export type { AppLifecyclePort, NativeAppActiveState, NativeGoBackState } from "./appLifecycle"
export type { AuthPort, NativeThirdPartyLoginParams, NativeThirdPartyLoginResult } from "./auth"
export type { EnvironmentPort } from "./environment"
export type { LocalePort } from "./locale"
export type { NavigationPort, NativeChangeBottomTabParams } from "./navigation"
export type {
	PaymentPort,
	NativePurchaseStatusPayload,
	NativeStartInAppPurchaseParams,
} from "./payment"
export type {
	RecordingPort,
	NativeAIRecordingExistResult,
	NativeRecordingStatus,
	NativeRecordingStatusPayload,
	NativeRecordingSummaryParams,
	NativeRecordingSummaryResult,
} from "./recording"
export type {
	SharingPort,
	NativeSharedDataPayload,
	NativeSharedDataType,
	NativeStreamStatus,
	NativeSharedStreamData,
} from "./sharing"
export type { UiPort } from "./ui"
export type {
	NativeDestroyFn,
	NativeNoopDestroyFn,
	NativeLanguageItem,
	NativeLanguagePack,
	NativeSafeArea,
	NativeEnvResult,
	NativeEnvType,
} from "./types"
export { nativeSdkUsageInventory } from "./inventory"
