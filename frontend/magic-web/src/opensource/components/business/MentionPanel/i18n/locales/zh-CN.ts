import type { I18nTexts } from "../types"

export const zhCN: I18nTexts = {
	// Select path modal
	selectPathItemDescription: {
		rootDirectory: "根目录",
	},

	// Search related
	searchPlaceholder: "搜索",
	projectFilesSearchPlaceholder: "搜索项目文件",
	searchResults: "搜索结果",
	searchHint: "正在搜索",
	clearSearch: "清除搜索",
	searchPrefix: "搜索:",

	// Status messages
	loading: "加载中...",
	error: "加载失败",
	retry: "重试",
	empty: "暂无数据",

	// Hints
	mcpHint: "@插件仅单次生效",
	skillHint: "@技能仅单次生效",

	// Panel titles
	panelTitles: {
		default: "",
		search: "搜索项目文件",
		folder: "文件夹",
		mcp: "MCP 扩展",
		agent: "智能体",
		skills: "技能",
	},

	// Default items
	defaultItems: {
		personalDrive: "个人云盘",
		enterpriseDrive: "企业云盘",
		projectFiles: "当前项目文件",
		mcpExtensions: "插件",
		agents: "智能体",
		skills: "技能",
		tools: "工具",
		uploadFiles: "上传的文件",
		projectFiles2: "项目文件",
	},

	// Mobile specific
	selectItem: "选择引用内容",

	// Error messages
	errorMessages: {
		loadFailed: "加载失败，请重试",
		searchFailed: "搜索失败，请检查网络连接",
		networkError: "网络连接异常",
		unknownError: "未知错误",
	},

	// Keyboard shortcuts
	keyboardHints: {
		navigate: "切换选择",
		confirm: "Enter 确认",
		goBack: "返回上一层",
		goForward: "进入下一层",
		exitSearch: "退出",
	},

	// Accessibility labels
	ariaLabels: {
		panel: "提及面板",
		menuItem: "菜单项",
		searchInput: "搜索输入框",
		retryButton: "重试按钮",
		goBackButton: "返回上一层",
		closeButton: "关闭",
	},

	// History and tabs related
	historyActions: {
		viewAllOpenFiles: "查看全部打开的文件",
		viewAllMentionedFiles: "查看所有@过的文件",
		recentMentionedFiles: "最近@的文件",
		currentOpenFiles: "当前打开的文件",
		smartRecommendations: "智能推荐",
	},
}
