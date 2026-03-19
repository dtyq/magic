// Tools 调节器
export enum ToolsAdjust {
	// 创意
	Creativity = 1,
	// 平衡
	Balanced = 2,
	// 精准
	Precise = 3,

	// 加载预设
	default = 4,
}

// Tools 调节器值映射
export const ToolsAdjustMap = {
	[ToolsAdjust.Creativity]: {
		temperature: 0.8,
		auto_memory: true,
		// top_p: {
		// 	open: true,
		// 	value: 0.9,
		// },
		// exist_penalty: {
		// 	open: true,
		// 	value: 0.1,
		// },
		// frequency_penalty: {
		// 	open: true,
		// 	value: 0.1,
		// },
		// max_tags: {
		// 	open: false,
		// 	value: 512,
		// },
	},
	[ToolsAdjust.Balanced]: {
		temperature: 0.5,
		auto_memory: true,
		// top_p: {
		// 	open: true,
		// 	value: 0.85,
		// },
		// exist_penalty: {
		// 	open: true,
		// 	value: 0.2,
		// },
		// frequency_penalty: {
		// 	open: true,
		// 	value: 0.3,
		// },
		// max_tags: {
		// 	open: false,
		// 	value: 512,
		// },
	},
	[ToolsAdjust.Precise]: {
		temperature: 0.2,
		auto_memory: true,
		// top_p: {
		// 	open: true,
		// 	value: 0.75,
		// },
		// exist_penalty: {
		// 	open: true,
		// 	value: 0.5,
		// },
		// frequency_penalty: {
		// 	open: true,
		// 	value: 0.5,
		// },
		// max_tags: {
		// 	open: false,
		// 	value: 512,
		// },
	},
}
