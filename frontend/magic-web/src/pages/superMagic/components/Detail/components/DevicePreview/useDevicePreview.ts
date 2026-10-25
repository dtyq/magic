import { useCallback, useState } from "react"
import { DEFAULT_DEVICE_PREVIEW } from "./constants"
import type { DevicePreviewConfig } from "./types"
import type { DevicePreset } from "./devices"

/** 每个现有文件预览实例持有自己的设备设置；不把配置写入附件或全局标签缓存。 */
export function useDevicePreview(projectId: string, fileId: string) {
	const [state, setState] = useState({ projectId, fileId, config: DEFAULT_DEVICE_PREVIEW })
	let config = state.config
	if (state.projectId !== projectId || state.fileId !== fileId) {
		config = DEFAULT_DEVICE_PREVIEW
		setState({ projectId, fileId, config })
	}

	const setConfig = useCallback(
		(next: DevicePreviewConfig) => setState({ projectId, fileId, config: next }),
		[projectId, fileId],
	)

	return { config, setConfig, identity: `${projectId}/${fileId}` }
}

export function selectDevice(
	config: DevicePreviewConfig,
	device: DevicePreset,
): DevicePreviewConfig {
	const common = {
		...config,
		preset: device.id,
		profile: device.profile,
		width: device.width,
		height: device.height,
	}
	return device.kind === "foldable"
		? {
				...common,
				kind: "foldable",
				fold: { posture: "unfolded", rotated: false, other: { ...device.folded } },
			}
		: { ...common, kind: device.kind, fold: null }
}

export function selectCustomDevice(
	config: DevicePreviewConfig,
	kind: "phone" | "tablet",
): DevicePreviewConfig {
	return {
		...config,
		preset: "custom",
		kind,
		fold: null,
		...(kind === config.kind
			? {}
			: kind === "tablet"
				? { width: 820, height: 1180, profile: "tablet" as const }
				: { width: 390, height: 844, profile: "modern" as const }),
	}
}

export function rotateDevice(config: DevicePreviewConfig): DevicePreviewConfig {
	const dimensions = { width: config.height, height: config.width }
	return config.kind === "foldable"
		? {
				...config,
				...dimensions,
				fold: {
					...config.fold,
					rotated: !config.fold.rotated,
					other: { width: config.fold.other.height, height: config.fold.other.width },
				},
			}
		: { ...config, ...dimensions }
}

export function toggleDevicePosture(config: DevicePreviewConfig): DevicePreviewConfig {
	if (config.kind !== "foldable") return config
	// 当前尺寸只存一份，另一屏只保存不活跃的尺寸；往返切换不会覆盖用户的修改。
	return {
		...config,
		...config.fold.other,
		fold: {
			...config.fold,
			posture: config.fold.posture === "folded" ? "unfolded" : "folded",
			other: { width: config.width, height: config.height },
		},
	}
}
