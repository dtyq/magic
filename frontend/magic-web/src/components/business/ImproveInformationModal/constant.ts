const PROFESSIONAL_IDENTITY_OPTIONS = [
	{ value: "techDev", labelKey: "professionalIdentityOptions.techDev" },
	{ value: "contentCopywriting", labelKey: "professionalIdentityOptions.contentCopywriting" },
	{ value: "designCreative", labelKey: "professionalIdentityOptions.designCreative" },
	{ value: "adminManagement", labelKey: "professionalIdentityOptions.adminManagement" },
	{ value: "educationResearch", labelKey: "professionalIdentityOptions.educationResearch" },
	{ value: "student", labelKey: "professionalIdentityOptions.student" },
	{ value: "marketingSales", labelKey: "professionalIdentityOptions.marketingSales" },
	{ value: "otherProfessionals", labelKey: "professionalIdentityOptions.otherProfessionals" },
]

const DISCOVERY_CHANNEL_GROUPS = [
	{
		groupKey: "discoveryChannelGroups.socialMedia",
		options: [
			{ value: "facebook", labelKey: "discoveryChannelOptions.facebook" },
			{ value: "instagram", labelKey: "discoveryChannelOptions.instagram" },
			{ value: "x", labelKey: "discoveryChannelOptions.x" },
			{ value: "discord", labelKey: "discoveryChannelOptions.discord" },
			{ value: "telegram", labelKey: "discoveryChannelOptions.telegram" },
			{ value: "whatsapp", labelKey: "discoveryChannelOptions.whatsapp" },
			{ value: "wechatPublic", labelKey: "discoveryChannelOptions.wechatPublic" },
			{ value: "weibo", labelKey: "discoveryChannelOptions.weibo" },
			{ value: "rednote", labelKey: "discoveryChannelOptions.rednote" },
			{ value: "zhihu", labelKey: "discoveryChannelOptions.zhihu" },
		],
	},
	{
		groupKey: "discoveryChannelGroups.videoMedia",
		options: [
			{ value: "tiktok", labelKey: "discoveryChannelOptions.tiktok" },
			{ value: "youtube", labelKey: "discoveryChannelOptions.youtube" },
			{ value: "wechatVideo", labelKey: "discoveryChannelOptions.wechatVideo" },
			{ value: "douyin", labelKey: "discoveryChannelOptions.douyin" },
			{ value: "bilibili", labelKey: "discoveryChannelOptions.bilibili" },
		],
	},
	{
		groupKey: "discoveryChannelGroups.other",
		options: [
			{ value: "searchEngine", labelKey: "discoveryChannelOptions.searchEngine" },
			{ value: "friendReferral", labelKey: "discoveryChannelOptions.friendReferral" },
			{ value: "newsMedia", labelKey: "discoveryChannelOptions.newsMedia" },
			{ value: "blogArticle", labelKey: "discoveryChannelOptions.blogArticle" },
			{ value: "other", labelKey: "discoveryChannelOptions.other" },
		],
	},
]

export { PROFESSIONAL_IDENTITY_OPTIONS, DISCOVERY_CHANNEL_GROUPS }
