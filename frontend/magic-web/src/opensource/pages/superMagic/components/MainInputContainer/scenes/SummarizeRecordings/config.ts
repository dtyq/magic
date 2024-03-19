import { SkillPanelType, OptionViewType, type SkillPanelConfig } from "../../panels/types"

/**
 * Default summarize recordings panel configuration
 */
export const defaultSummarizeRecordingsConfig: SkillPanelConfig[] = [
	{
		type: SkillPanelType.GUIDE,
		title: { zh_CN: "快速开始", en_US: "Quick Start" },
		expandable: true,
		default_expanded: true,
		guide: {
			items: [
				{
					key: "live-record-summarize",
					title: { zh_CN: "实时录音与总结", en_US: "Live Record & Summarize" },
					description: {
						zh_CN: "实时转写与 AI 总结",
						en_US: "Real-time transcription and AI summaries.",
					},
					icon: "Mic",
				},
				{
					key: "upload-transcribe",
					title: { zh_CN: "上传与转写", en_US: "Upload & Transcribe" },
					description: {
						zh_CN: "提取关键要点，生成格式化报告",
						en_US: "Extract key takeaways into formatted reports.",
					},
					icon: "Upload",
				},
				{
					key: "structured-reports",
					title: { zh_CN: "结构化 AI 报告", en_US: "Structured AI Reports" },
					description: {
						zh_CN: "使用智能模板快速获取洞察",
						en_US: "Use smart templates for instant insights.",
					},
					icon: "FileBarChart",
				},
			],
		},
	},
	{
		type: SkillPanelType.FIELD,
		title: { zh_CN: "场景", en_US: "Scenario" },
		expandable: true,
		default_expanded: true,
		field: {
			items: [
				{
					data_key: "scenario",
					label: { zh_CN: "场景", en_US: "Scenario" },
					default_value: "auto",
					option_view_type: OptionViewType.CAPSULE,
					options: [
						{
							value: "auto",
							label: { zh_CN: "自动", en_US: "Auto" },
							icon_url: "Shuffle",
						},
						{
							value: "meeting",
							label: { zh_CN: "会议", en_US: "Meeting" },
							icon_url: "Presentation",
						},
						{
							value: "screening",
							label: { zh_CN: "放映", en_US: "Screening" },
							icon_url: "FileUser",
						},
						{
							value: "press_interview",
							label: { zh_CN: "媒体采访", en_US: "Press Interview" },
							icon_url: "MicVocal",
						},
						{
							value: "learning",
							label: { zh_CN: "学习", en_US: "Learning" },
							icon_url: "School",
						},
						{
							value: "communication",
							label: { zh_CN: "沟通", en_US: "Communication" },
							icon_url: "MessagesSquare",
						},
						{
							value: "talk",
							label: { zh_CN: "演讲", en_US: "Talk" },
							icon_url: "Speech",
						},
					],
				},
			],
		},
	},
]
