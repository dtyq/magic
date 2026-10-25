import type { DeviceDefinition } from "./types"

// 官方参数核对于 2026-09-14；各机型来源见记录旁的链接。
// 视口按物理像素 / 假定 3 倍换算并取整（720px 宽入门屏按 2 倍）；均为参考值，非浏览器实测。
// 同屏幕的存储、配色与联名版本共用预设；内外屏分别保留长宽比。
const phone = {
	kind: "phone",
	profile: "punch-hole",
	brand: "Xiaomi 小米",
	reference: true,
} as const

export const XIAOMI_DEVICE_PRESETS = [
	// https://www.mi.com/prod/xiaomi-17-pro-max/specs
	{
		...phone,
		id: "xiaomi-17-pro-max",
		name: "Xiaomi 17 Pro Max",
		width: 400,
		height: 869,
		common: true,
	},
	// https://www.mi.com/prod/xiaomi-17-ultra/specs
	{
		...phone,
		id: "xiaomi-17-ultra",
		name: "Xiaomi 17 Ultra",
		width: 400,
		height: 869,
		common: true,
	},
	// https://www.mi.com/prod/xiaomi-17-pro/specs
	{
		...phone,
		id: "xiaomi-17-pro",
		name: "Xiaomi 17 Pro",
		width: 407,
		height: 885,
	},
	// https://www.mi.com/prod/xiaomi-17/specs
	{
		...phone,
		id: "xiaomi-17",
		name: "Xiaomi 17",
		width: 407,
		height: 885,
	},
	// https://www.mi.com/prod/xiaomi-17-max/specs
	{
		...phone,
		id: "xiaomi-17-max",
		name: "Xiaomi 17 Max",
		width: 400,
		height: 869,
	},
	// https://www.mi.com/prod/xiaomi-17t-pro/specs
	{
		...phone,
		id: "xiaomi-17t-pro",
		name: "Xiaomi 17T Pro",
		width: 427,
		height: 924,
	},
	// https://www.mi.com/prod/xiaomi-17t/specs
	{
		...phone,
		id: "xiaomi-17t",
		name: "Xiaomi 17T",
		width: 423,
		height: 919,
	},
	// https://www.mi.com/prod/xiaomi-15-ultra/specs
	{
		...phone,
		id: "xiaomi-15-ultra",
		name: "Xiaomi 15 Ultra",
		width: 480,
		height: 1067,
	},
	// https://www.mi.com/prod/xiaomi-15s-pro/specs
	{
		...phone,
		id: "xiaomi-15s-pro",
		name: "Xiaomi 15S Pro",
		width: 480,
		height: 1067,
	},
	// https://www.mi.com/prod/xiaomi-15-pro/specs
	{
		...phone,
		id: "xiaomi-15-pro",
		name: "Xiaomi 15 Pro",
		width: 480,
		height: 1067,
	},
	// https://www.mi.com/prod/xiaomi-15/specs
	{
		...phone,
		id: "xiaomi-15",
		name: "Xiaomi 15",
		width: 400,
		height: 890,
	},
	// https://www.mi.com/prod/xiaomi-14-ultra/specs
	{
		...phone,
		id: "xiaomi-14-ultra",
		name: "Xiaomi 14 Ultra",
		width: 480,
		height: 1067,
	},
	// https://www.mi.com/in/product/xiaomi-14/specs/
	{
		...phone,
		id: "xiaomi-14",
		name: "Xiaomi 14",
		width: 400,
		height: 890,
	},
	// https://www.mi.com/prod/xiaomi-civi-5-pro/specs
	{
		...phone,
		id: "xiaomi-civi-5-pro",
		name: "Xiaomi Civi 5 Pro",
		width: 412,
		height: 917,
	},
	// https://www.mi.com/prod/xiaomi-civi-4-pro/specs
	{
		...phone,
		id: "xiaomi-civi-4-pro",
		name: "Xiaomi Civi 4 Pro",
		width: 412,
		height: 917,
	},
	// https://www.mi.com/prod/xiaomi-18-fold/specs
	{
		...phone,
		id: "xiaomi-18-fold",
		name: "Xiaomi 18 Fold",
		width: 788,
		height: 557,
		kind: "foldable",
		profile: "foldable",
		folded: { width: 389, height: 571 },
		common: true,
	},
	// https://www.mi.com/prod/xiaomi-mix-fold-4/specs
	{
		...phone,
		id: "xiaomi-mix-fold-4",
		name: "Xiaomi MIX Fold 4",
		width: 741,
		height: 829,
		kind: "foldable",
		profile: "foldable",
		folded: { width: 360, height: 840 },
	},
	// https://www.mi.com/prod/xiaomi-mix-flip2/specs
	{
		...phone,
		id: "xiaomi-mix-flip-2",
		name: "Xiaomi MIX Flip 2",
		width: 408,
		height: 971,
		kind: "foldable",
		profile: "flip",
		folded: { width: 403, height: 464 },
	},
	// https://www.mi.com/global/product/xiaomi-mix-flip/specs/
	{
		...phone,
		id: "xiaomi-mix-flip",
		name: "Xiaomi MIX Flip",
		width: 408,
		height: 971,
		kind: "foldable",
		profile: "flip",
		folded: { width: 403, height: 464 },
	},
] as const satisfies readonly DeviceDefinition[]
