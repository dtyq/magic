import { isMagicApp } from "@/utils/devices"
import { noopNativePort } from "./adapters/noopAdapter"
import type { NativePort } from "./native-bridge"

export class NativePortRegistry {
	private static provider: () => NativePort = () => noopNativePort

	static getPort(): NativePort {
		if (!isMagicApp) return noopNativePort
		return NativePortRegistry.provider()
	}

	static setPort(nativePort: NativePort): void {
		NativePortRegistry.provider = () => nativePort
	}

	static setProvider(provider: () => NativePort): void {
		NativePortRegistry.provider = provider
	}
}

export function getNativePort(): NativePort {
	return NativePortRegistry.getPort()
}

export function injectNativePort(nativePort: NativePort): void {
	NativePortRegistry.setPort(nativePort)
}

export function injectNativePortProvider(provider: () => NativePort): void {
	NativePortRegistry.setProvider(provider)
}
