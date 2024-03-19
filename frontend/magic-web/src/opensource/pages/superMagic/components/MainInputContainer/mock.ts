import { SceneItem, SceneEditorKey } from "../../types/skill"
import colors from "tailwindcss/colors"
import { SkillConfig } from "./panels"
import { defaultSlidesPanelConfig } from "./scenes/Slides/config"
import { defaultDesignPanelConfig } from "./scenes/Design/config"
import { defaultSummarizeRecordingsConfig } from "./scenes/SummarizeRecordings/config"
import { defaultAnalyzeDataPanelConfig } from "./scenes/AnalyzeData/config"
import { defaultSummarizeVideosPanelConfig } from "./scenes/SummarizeVideos/config"

/**
 * Skill配置映射
 */
export const SKILL_CONFIGS_MAP: Record<string, SceneItem & { config: SkillConfig }> = {
	[SceneEditorKey.Slides]: {
		key: SceneEditorKey.Slides,
		name: "Slides",
		description: "Slides",
		icon: "Presentation",
		color: colors.orange["500"],
		config: {
			panels: defaultSlidesPanelConfig,
			placeholder: {
				zh_CN: "描述你想要生成的 PPT 主题和内容...",
				en_US: "Describe your presentation idea...",
			},
		},
	},
	[SceneEditorKey.Design]: {
		key: SceneEditorKey.Design,
		name: "Design",
		description: "Design",
		icon: "Banana",
		color: colors.yellow["500"],
		config: {
			panels: defaultDesignPanelConfig,
			placeholder: {
				zh_CN: "描述你想要创建的设计...",
				en_US: "Describe the design you want to create...",
			},
		},
	},
	[SceneEditorKey.RecordSummary]: {
		key: SceneEditorKey.RecordSummary,
		name: "Summarize Recordings",
		description: "Summarize Recordings",
		icon: "Presentation",
		color: colors.cyan["500"],
		config: {
			panels: defaultSummarizeRecordingsConfig,
			placeholder: {
				zh_CN: "上传或粘贴你的录音链接...",
				en_US: "Upload or paste your recording link...",
			},
		},
	},
	[SceneEditorKey.AnalyzeData]: {
		key: SceneEditorKey.AnalyzeData,
		name: "Analyze Data",
		description: "Analyze Data",
		icon: "ChartLine",
		color: colors.blue["500"],
		config: {
			panels: defaultAnalyzeDataPanelConfig,
			placeholder: {
				zh_CN: "上传数据文件或描述分析需求...",
				en_US: "Upload your data file or describe the analysis...",
			},
		},
	},
	[SceneEditorKey.SummarizeVideos]: {
		key: SceneEditorKey.SummarizeVideos,
		name: "Summarize Videos",
		description: "Summarize Videos",
		icon: "Video",
		color: colors.pink["500"],
		config: {
			panels: defaultSummarizeVideosPanelConfig,
			placeholder: {
				zh_CN: "粘贴视频链接或上传视频...",
				en_US: "Paste video URL or upload a video...",
			},
		},
	},
}
