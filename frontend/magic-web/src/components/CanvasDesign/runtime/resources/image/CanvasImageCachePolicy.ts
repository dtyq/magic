const MIB = 1024 * 1024

export interface CanvasImageDecodedCacheBudgets {
	lowBytes: number
	previewBytes: number
	fullBytes: number
	totalSoftBytes: number
	totalHardBytes: number
}

function getDeviceMemory(): number | undefined {
	if (typeof globalThis.navigator === "undefined") return undefined
	const deviceMemory = (globalThis.navigator as Navigator & { deviceMemory?: number })
		.deviceMemory
	return typeof deviceMemory === "number" && Number.isFinite(deviceMemory)
		? deviceMemory
		: undefined
}

export function resolveCanvasImageDecodedCacheBudgets(): CanvasImageDecodedCacheBudgets {
	const deviceMemory = getDeviceMemory()
	if (deviceMemory !== undefined && deviceMemory <= 4) {
		return {
			lowBytes: 48 * MIB,
			previewBytes: 48 * MIB,
			fullBytes: 64 * MIB,
			totalSoftBytes: 128 * MIB,
			totalHardBytes: 160 * MIB,
		}
	}
	if (deviceMemory !== undefined && deviceMemory >= 16) {
		return {
			lowBytes: 128 * MIB,
			previewBytes: 128 * MIB,
			fullBytes: 256 * MIB,
			totalSoftBytes: 320 * MIB,
			totalHardBytes: 384 * MIB,
		}
	}
	return {
		lowBytes: 80 * MIB,
		previewBytes: 80 * MIB,
		fullBytes: 128 * MIB,
		totalSoftBytes: 160 * MIB,
		totalHardBytes: 224 * MIB,
	}
}
