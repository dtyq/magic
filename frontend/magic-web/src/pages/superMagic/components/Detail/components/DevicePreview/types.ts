import type { DeviceId } from "./devices"
import type { PhoneShellProfile } from "../SelfMediaRootRender/components/phoneShellGeometry"

export type DeviceKind = "phone" | "tablet" | "foldable"
export type DevicePosture = "folded" | "unfolded"
export type DevicePreviewZoom = "fit" | 0.25 | 0.5 | 0.75 | 1 | 1.5

export interface DeviceDimensions {
	width: number
	height: number
}

interface DevicePreviewBase extends DeviceDimensions {
	preset: "custom" | DeviceId
	profile: PhoneShellProfile
	zoom: DevicePreviewZoom
	showFrame: boolean
}

export type DevicePreviewConfig = DevicePreviewBase &
	(
		| { kind: "phone" | "tablet"; fold: null }
		| {
				kind: "foldable"
				fold: {
					posture: DevicePosture
					rotated: boolean
					other: DeviceDimensions
				}
		  }
	)

interface DeviceDefinitionBase extends DeviceDimensions {
	id: string
	name: string
	brand: string
	profile: PhoneShellProfile
	common?: boolean
	reference?: boolean
}

export type DeviceDefinition = DeviceDefinitionBase &
	({ kind: "phone" | "tablet" } | { kind: "foldable"; folded: DeviceDimensions })

export interface DevicePreviewControls {
	config: DevicePreviewConfig
	setConfig: (config: DevicePreviewConfig) => void
	active: boolean
	identity: string
}
