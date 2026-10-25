import type { DeviceDefinition } from "./types"
import { XIAOMI_DEVICE_PRESETS } from "./xiaomiDevices"
import { REDMI_DEVICE_PRESETS } from "./redmiDevices"

// 常规预设取自 Chrome DevTools EmulatedDevices.ts（2026-09-14）。
// 新 iPhone 仅按 Apple 物理分辨率 / 假定 3 倍比例提供参考视口，不能当作 Safari 实测值。
// https://www.apple.com/iphone-duo/specs/  https://www.apple.com/iphone-18-pro/specs/
// https://www.apple.com/iphone-17-pro/specs/
const definitions = [
	{
		id: "iphone-duo",
		name: "iPhone Duo",
		brand: "Apple 苹果",
		kind: "foldable",
		width: 890,
		height: 626,
		folded: { width: 466, height: 678 },
		profile: "foldable",
		reference: true,
		common: true,
	},
	{
		id: "iphone-18-pro-max",
		name: "iPhone 18 Pro Max",
		brand: "Apple 苹果",
		kind: "phone",
		width: 440,
		height: 956,
		profile: "modern",
		reference: true,
		common: true,
	},
	{
		id: "iphone-18-pro",
		name: "iPhone 18 Pro",
		brand: "Apple 苹果",
		kind: "phone",
		width: 402,
		height: 874,
		profile: "modern",
		reference: true,
	},
	{
		id: "iphone-17-pro-max",
		name: "iPhone 17 Pro Max",
		brand: "Apple 苹果",
		kind: "phone",
		width: 440,
		height: 956,
		profile: "modern",
		reference: true,
	},
	{
		id: "iphone-se",
		name: "iPhone SE",
		brand: "Apple 苹果",
		kind: "phone",
		width: 375,
		height: 667,
		profile: "home-button",
	},
	{
		id: "iphone-14",
		name: "iPhone 14",
		brand: "Apple 苹果",
		kind: "phone",
		width: 390,
		height: 844,
		profile: "notch",
	},
	{
		id: "iphone-14-pro",
		name: "iPhone 14 Pro",
		brand: "Apple 苹果",
		kind: "phone",
		width: 393,
		height: 852,
		profile: "modern",
	},
	{
		id: "iphone-14-pro-max",
		name: "iPhone 14 Pro Max",
		brand: "Apple 苹果",
		kind: "phone",
		width: 430,
		height: 932,
		profile: "modern",
	},
	{
		id: "iphone-15",
		name: "iPhone 15",
		brand: "Apple 苹果",
		kind: "phone",
		width: 393,
		height: 852,
		profile: "modern",
	},
	{
		id: "iphone-16",
		name: "iPhone 16",
		brand: "Apple 苹果",
		kind: "phone",
		width: 393,
		height: 852,
		profile: "modern",
	},
	{
		id: "iphone-16-plus",
		name: "iPhone 16 Plus",
		brand: "Apple 苹果",
		kind: "phone",
		width: 430,
		height: 932,
		profile: "modern",
	},
	{
		id: "iphone-16-pro",
		name: "iPhone 16 Pro",
		brand: "Apple 苹果",
		kind: "phone",
		width: 402,
		height: 874,
		profile: "modern",
	},
	{
		id: "iphone-16-pro-max",
		name: "iPhone 16 Pro Max",
		brand: "Apple 苹果",
		kind: "phone",
		width: 440,
		height: 956,
		profile: "modern",
	},
	...XIAOMI_DEVICE_PRESETS,
	...REDMI_DEVICE_PRESETS,
	{
		id: "pixel-7",
		name: "Pixel 7",
		brand: "Google 谷歌",
		kind: "phone",
		width: 412,
		height: 915,
		profile: "punch-hole",
	},
	{
		id: "pixel-9",
		name: "Pixel 9",
		brand: "Google 谷歌",
		kind: "phone",
		width: 412,
		height: 924,
		profile: "punch-hole",
	},
	{
		id: "pixel-10",
		name: "Pixel 10",
		brand: "Google 谷歌",
		kind: "phone",
		width: 412,
		height: 924,
		profile: "punch-hole",
	},
	{
		id: "galaxy-a55",
		name: "Galaxy A55",
		brand: "Samsung 三星",
		kind: "phone",
		width: 360,
		height: 800,
		profile: "punch-hole",
	},
	{
		id: "ipad-mini",
		name: "iPad mini",
		brand: "Apple 苹果",
		kind: "tablet",
		width: 768,
		height: 1024,
		profile: "tablet",
	},
	{
		id: "ipad-pro-13",
		name: "iPad Pro 13",
		brand: "Apple 苹果",
		kind: "tablet",
		width: 1032,
		height: 1376,
		profile: "tablet",
		common: true,
	},
	{
		id: "surface-pro-7",
		name: "Surface Pro 7",
		brand: "Microsoft 微软",
		kind: "tablet",
		width: 912,
		height: 1368,
		profile: "tablet",
	},
	{
		id: "surface-pro-10",
		name: "Surface Pro 10",
		brand: "Microsoft 微软",
		kind: "tablet",
		width: 960,
		height: 1440,
		profile: "tablet",
		common: true,
	},
	{
		id: "galaxy-tab-s4",
		name: "Galaxy Tab S4",
		brand: "Samsung 三星",
		kind: "tablet",
		width: 712,
		height: 1138,
		profile: "tablet",
	},
] as const satisfies readonly DeviceDefinition[]

export type DeviceId = (typeof definitions)[number]["id"]
export type DevicePreset = DeviceDefinition & { id: DeviceId }
export const DEVICE_PRESETS: readonly DevicePreset[] = definitions

export function getDefaultDevicePreset(): DevicePreset {
	// 目录中的 iphone-<代数>-pro-max 是稳定机型 ID；新增一代后自动成为默认，不复制尺寸。
	const latest = DEVICE_PRESETS.filter(
		(device) => device.kind === "phone" && /^iphone-\d+-pro-max$/.test(device.id),
	).sort((left, right) => right.id.localeCompare(left.id, "en", { numeric: true }))[0]
	if (!latest) throw new Error("The device catalog must include an iPhone Pro Max preset.")
	return latest
}

export function getDevicePreset(id: DeviceId | "custom"): DevicePreset | undefined {
	return DEVICE_PRESETS.find((device) => device.id === id)
}
