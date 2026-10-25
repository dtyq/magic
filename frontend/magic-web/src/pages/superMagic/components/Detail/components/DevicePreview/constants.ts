import type { DevicePreviewConfig, DevicePreviewZoom } from "./types"
import { getDefaultDevicePreset } from "./devices"

export const MIN_PREVIEW_DIMENSION = 160
export const MAX_PREVIEW_DIMENSION = 2560
export const DEVICE_PREVIEW_PADDING = 24
export const DEVICE_PREVIEW_ZOOMS: readonly DevicePreviewZoom[] = ["fit", 0.25, 0.5, 0.75, 1, 1.5]

const defaultDevice = getDefaultDevicePreset()

export const DEFAULT_DEVICE_PREVIEW: DevicePreviewConfig = {
	preset: defaultDevice.id,
	kind: "phone",
	profile: defaultDevice.profile,
	fold: null,
	width: defaultDevice.width,
	height: defaultDevice.height,
	zoom: "fit",
	showFrame: true,
}

export function isValidDeviceDimension(value: number): boolean {
	return (
		Number.isInteger(value) && value >= MIN_PREVIEW_DIMENSION && value <= MAX_PREVIEW_DIMENSION
	)
}
