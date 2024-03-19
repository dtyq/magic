import type { NativeDestroyFn } from "./types"
import type { NativeGoBackState } from "./appLifecycle"

export interface NativeChangeBottomTabParams {
	tab: "super" | "chat" | "approval" | "contacts" | "profile" | "ai_recording" | string
	bottomTabHeight: number
}

export interface NavigationPort {
	observeGoBack(callback: (payload: NativeGoBackState) => unknown): NativeDestroyFn | undefined
	changeBottomTab(params: NativeChangeBottomTabParams): Promise<unknown>
}
