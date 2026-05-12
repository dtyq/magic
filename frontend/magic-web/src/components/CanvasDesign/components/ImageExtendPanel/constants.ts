export interface ImageExtendPresetItem {
	label: string
	description?: string
}

export interface ImageExtendPresetGroup {
	label: string
	value: string
	children: ImageExtendPresetItem[]
}

export const extendPresetOptions: ImageExtendPresetGroup[] = [
	{
		label: "通用",
		value: "common",
		children: [
			{ label: "原始比例" },
			{ label: "1:1" },
			{ label: "3:4" },
			{ label: "2:3" },
			{ label: "9:16" },
			{ label: "4:3" },
			{ label: "3:2" },
			{ label: "16:9" },
			{ label: "4:5" },
			{ label: "5:4" },
		],
	},
	{
		label: "Instagram",
		value: "instagram",
		children: [
			{
				label: "1:1",
				description: "正方形",
			},
			{
				label: "9:16",
				description: "快拍",
			},
			{
				label: "4:5",
				description: "竖版",
			},
			{
				label: "1.91:1",
				description: "横版",
			},
			{
				label: "1:1",
				description: "头像",
			},
		],
	},
	{
		label: "Facebook",
		value: "facebook",
		children: [
			{
				label: "9:16",
				description: "快拍",
			},
			{
				label: "1.91:1",
				description: "帖子",
			},
			{
				label: "1:1",
				description: "头像",
			},
		],
	},
	{
		label: "Tiktok",
		value: "tiktok",
		children: [
			{
				label: "9:16",
				description: "视频",
			},
		],
	},
	{
		label: "LinkedIn",
		value: "linkedin",
		children: [
			{
				label: "1.91:1",
				description: "帖子",
			},
			{
				label: "1:1",
				description: "头像",
			},
		],
	},
	{
		label: "Twitter",
		value: "twitter",
		children: [
			{
				label: "3:1",
				description: "封面照片",
			},
			{
				label: "2:1",
				description: "横版",
			},
			{
				label: "1:1",
				description: "头像",
			},
		],
	},
]

export interface ImageExtendScaleOption {
	label: string
	value: number
}

export const scaleOptions: ImageExtendScaleOption[] = [
	{ label: "1x", value: 1 },
	{ label: "1.5x", value: 1.5 },
	{ label: "2x", value: 2 },
	{ label: "3x", value: 3 },
]
