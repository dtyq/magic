import type { DeviceDefinition } from "./types"

// 官方参数核对于 2026-09-14；各机型来源见记录旁的链接。
// 视口按物理像素 / 假定 3 倍换算并取整（720px 宽入门屏按 2 倍）；均为参考值，非浏览器实测。
// 同屏幕的存储、配色与联名版本共用预设；内外屏分别保留长宽比。
const phone = {
	kind: "phone",
	profile: "punch-hole",
	brand: "REDMI 红米 Xiaomi 小米",
	reference: true,
} as const

export const REDMI_DEVICE_PRESETS = [
	// https://www.mi.com/prod/redmi-k100-pro-max/specs
	{
		...phone,
		id: "redmi-k100-pro-max",
		name: "REDMI K100 Pro Max",
		width: 400,
		height: 869,
		common: true,
	},
	// https://www.mi.com/prod/redmi-k100-pro/specs
	{
		...phone,
		id: "redmi-k100-pro",
		name: "REDMI K100 Pro",
		width: 385,
		height: 837,
	},
	// https://www.mi.com/prod/redmi-k90-pro-max/specs
	{
		...phone,
		id: "redmi-k90-pro-max",
		name: "REDMI K90 Pro Max",
		width: 400,
		height: 869,
	},
	// https://www.mi.com/prod/redmi-k90-max/specs
	{
		...phone,
		id: "redmi-k90-max",
		name: "REDMI K90 Max",
		width: 427,
		height: 924,
	},
	// https://www.mi.com/prod/redmi-k90-ultra/specs
	{
		...phone,
		id: "redmi-k90-ultra",
		name: "REDMI K90 Ultra",
		width: 427,
		height: 924,
	},
	// https://www.mi.com/prod/redmi-k90/specs
	{
		...phone,
		id: "redmi-k90",
		name: "REDMI K90",
		width: 385,
		height: 837,
	},
	// https://www.mi.com/prod/redmi-k80-ultra/specs
	{
		...phone,
		id: "redmi-k80-ultra",
		name: "REDMI K80 Ultra",
		width: 427,
		height: 924,
	},
	// https://www.mi.com/prod/redmi-k80-pro/specs
	{
		...phone,
		id: "redmi-k80-pro",
		name: "REDMI K80 Pro",
		width: 480,
		height: 1067,
	},
	// https://www.mi.com/prod/redmi-k80/specs
	{
		...phone,
		id: "redmi-k80",
		name: "REDMI K80",
		width: 480,
		height: 1067,
	},
	// https://www.mi.com/prod/redmi-turbo-5-max/specs
	{
		...phone,
		id: "redmi-turbo-5-max",
		name: "REDMI Turbo 5 Max",
		width: 427,
		height: 924,
	},
	// https://www.mi.com/prod/redmi-turbo-5/specs
	{
		...phone,
		id: "redmi-turbo-5",
		name: "REDMI Turbo 5",
		width: 423,
		height: 919,
	},
	// https://www.mi.com/prod/redmi-turbo-4-pro/specs
	{
		...phone,
		id: "redmi-turbo-4-pro",
		name: "REDMI Turbo 4 Pro",
		width: 427,
		height: 924,
	},
	// https://www.mi.com/prod/redmi-turbo-4/specs
	{
		...phone,
		id: "redmi-turbo-4",
		name: "REDMI Turbo 4",
		width: 407,
		height: 904,
	},
	// https://www.mi.com/prod/redmi-note-17-pro/specs
	{
		...phone,
		id: "redmi-note-17-pro",
		name: "REDMI Note 17 Pro",
		width: 427,
		height: 924,
		common: true,
	},
	// https://www.mi.com/prod/redmi-note-17/specs
	{
		...phone,
		id: "redmi-note-17",
		name: "REDMI Note 17",
		width: 360,
		height: 799,
	},
	// https://www.mi.com/prod/redmi-note-15-pro+/specs
	{
		...phone,
		id: "redmi-note-15-pro-plus",
		name: "REDMI Note 15 Pro+",
		width: 427,
		height: 924,
	},
	// https://www.mi.com/prod/redmi-note-15-pro/specs
	{
		...phone,
		id: "redmi-note-15-pro",
		name: "REDMI Note 15 Pro",
		width: 427,
		height: 924,
	},
	// https://www.mi.com/prod/redmi-note-15/specs
	{
		...phone,
		id: "redmi-note-15",
		name: "REDMI Note 15",
		width: 360,
		height: 797,
	},
	// https://www.mi.com/prod/redmi-note-14-pro+/specs
	{
		...phone,
		id: "redmi-note-14-pro-plus",
		name: "REDMI Note 14 Pro+",
		width: 407,
		height: 904,
	},
	// https://www.mi.com/prod/redmi-note-14-pro/specs
	{
		...phone,
		id: "redmi-note-14-pro",
		name: "REDMI Note 14 Pro",
		width: 407,
		height: 904,
	},
	// https://www.mi.com/prod/redmi-note-14/specs
	{
		...phone,
		id: "redmi-note-14",
		name: "REDMI Note 14",
		width: 360,
		height: 800,
	},
	// https://www.mi.com/prod/redmi-17-5g/specs
	{
		...phone,
		id: "redmi-17-5g",
		name: "REDMI 17 5G",
		width: 360,
		height: 800,
	},
] as const satisfies readonly DeviceDefinition[]
