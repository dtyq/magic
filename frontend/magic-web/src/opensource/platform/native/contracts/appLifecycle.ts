import type { NativeDestroyFn } from "./types"

export interface NativeAppActiveState {
	isActive?: boolean
	active?: boolean
}

export interface NativeGoBackState {
	code: number
	status: string
}

export interface AppLifecyclePort {
	observeAppActiveState(
		callback: (payload: NativeAppActiveState | boolean) => unknown,
		uniqueId?: string,
	): NativeDestroyFn | undefined
}
