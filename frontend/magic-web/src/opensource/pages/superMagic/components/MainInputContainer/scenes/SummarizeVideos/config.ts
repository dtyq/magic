import { SkillPanelType, OptionViewType, type SkillPanelConfig } from "../../panels/types"

/**
 * Default summarize videos panel configuration
 */
export const defaultSummarizeVideosPanelConfig: SkillPanelConfig[] = [
	{
		type: SkillPanelType.GUIDE,
		title: { zh_CN: "快速开始", en_US: "Quick Start" },
		guide: {
			items: [
				{
					key: "youtube-url",
					title: { zh_CN: "YouTube 链接", en_US: "YouTube Url" },
					description: {
						zh_CN: "粘贴链接即可快速获取总结",
						en_US: "Paste a URL for an instant summary.",
					},
					icon: "Youtube",
				},
				{
					key: "upload-video",
					title: { zh_CN: "上传视频", en_US: "Upload Video" },
					description: {
						zh_CN: "上传本地文件即可快速获取总结",
						en_US: "Upload local files for an instant summary.",
					},
					icon: "Upload",
				},
				{
					key: "contextual-summary",
					title: { zh_CN: "上下文总结", en_US: "Contextual Summary" },
					description: {
						zh_CN: "结合你的文档对视频进行总结",
						en_US: "Summarize videos alongside your own documents.",
					},
					icon: "FileText",
				},
			],
		},
	},
	{
		type: SkillPanelType.DEMO,
		title: { zh_CN: "灵感探索", en_US: "Inspiration Exploration" },
		expandable: true,
		default_expanded: true,
		demo: {
			view_type: OptionViewType.TEXT_LIST,
			groups: [
				{
					group_key: "video-summaries",
					group_name: { zh_CN: "视频总结", en_US: "Video Summaries" },
					children: [
						{
							value: "wwdc-2025",
							label: { zh_CN: "WWDC 2025 总结", en_US: "Summary of WWDC 2025" },
						},
						{
							value: "nvidia-ces",
							label: {
								zh_CN: "英伟达 CES 主题演讲总结",
								en_US: "Summary of Nvidia's CES Keynote",
							},
						},
						{
							value: "alibaba-dingtalk",
							label: {
								zh_CN: "阿里钉钉 11 AI 新品发布会总结",
								en_US: "Summary of Alibaba's AI-Powered DingTalk 11 New Product Launch",
							},
						},
						{
							value: "apple-event",
							label: {
								zh_CN: "苹果春季发布会 2026 重点公告",
								en_US: "Apple Spring Event 2026 Key Announcements",
							},
						},
						{
							value: "google-io",
							label: {
								zh_CN: "Google I/O 开发者大会亮点",
								en_US: "Google I/O Developer Conference Highlights",
							},
						},
						{
							value: "meta-connect",
							label: {
								zh_CN: "Meta Connect VR/AR 产品发布总结",
								en_US: "Meta Connect VR/AR Product Launch Summary",
							},
						},
						{
							value: "tesla-battery",
							label: {
								zh_CN: "特斯拉电池日技术突破",
								en_US: "Tesla Battery Day Technology Breakthroughs",
							},
						},
						{
							value: "microsoft-build",
							label: {
								zh_CN: "微软 Build 开发者大会回顾",
								en_US: "Microsoft Build Developer Conference Recap",
							},
						},
						{
							value: "aws-reinvent",
							label: {
								zh_CN: "AWS re:Invent 云计算更新",
								en_US: "AWS re:Invent Cloud Computing Updates",
							},
						},
						{
							value: "samsung-unpacked",
							label: {
								zh_CN: "三星 Unpacked 新设备发布",
								en_US: "Samsung Unpacked New Device Announcements",
							},
						},
					],
				},
			],
		},
	},
]
