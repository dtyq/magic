export interface PresetOptionItem {
	label: string
	value?: string
}

export interface PresetOption {
	label: string
	value: string
	children: PresetOptionItem[]
}

export const presetOptions: PresetOption[] = [
	{
		label: "通用",
		value: "common",
		children: [
			{
				label: "1:1",
			},
			{
				label: "3:4",
			},
			{
				label: "2:3",
			},
			{
				label: "9:16",
			},
			{
				label: "4:3",
			},
			{
				label: "3:2",
			},
			{
				label: "16:9",
			},
		],
	},
	{
		label: "Instagram",
		value: "instagram",
		children: [
			{
				label: "Square",
				value: "1080x1080",
			},
			{
				label: "Story",
				value: "1080x1920",
			},
			{
				label: "Portrait",
				value: "1080x1350",
			},
			{
				label: "Landscape",
				value: "1080x566",
			},
			{
				label: "Profile photo",
				value: "320x320",
			},
		],
	},
	{
		label: "Facebook",
		value: "facebook",
		children: [
			{
				label: "Story",
				value: "1080x1920",
			},
			{
				label: "Post",
				value: "1200x630",
			},
			{
				label: "Profile photo",
				value: "170x170",
			},
		],
	},
	{
		label: "TikTok",
		value: "tiktok",
		children: [
			{
				label: "Clip",
				value: "1080x1920",
			},
		],
	},
	{
		label: "YouTube",
		value: "youtube",
		children: [
			{
				label: "Thumbnail",
				value: "1280x720",
			},
		],
	},
	{
		label: "LinkedIn",
		value: "linkedin",
		children: [
			{
				label: "LinkedIn",
				value: "1200x627",
			},
			{
				label: "Profile photo",
				value: "400x400",
			},
		],
	},
	{
		label: "Twitter",
		value: "twitter",
		children: [
			{
				label: "Cover photo",
				value: "1500x500",
			},
			{
				label: "Landscape",
				value: "1024x512",
			},
			{
				label: "Profile photo",
				value: "400x400",
			},
		],
	},
]
