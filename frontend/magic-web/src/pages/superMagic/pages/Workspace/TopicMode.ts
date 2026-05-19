export enum TopicMode {
	/** 通用模式 */
	General = "general",
	/** 聊天模式 */
	Chat = "chat",
	/** 数据分析 */
	DataAnalysis = "data_analysis",
	/** PPT */
	PPT = "ppt",
	/** 研报模式 */
	Report = "report",
	/** 录音总结 */
	RecordSummary = "summary",

	/** 空模式 */
	Empty = "",
	/** 设计模式 */
	Design = "design",
	/** 员工主导模式
	 * 不会在列表中存在，只用于创建员工时使用
	 */
	CrewCreator = "crew-creator",

	/**
	 * 技能主导模式
	 * 不会在列表中存在，只用于创建技能时使用
	 */
	SkillCreator = "skill-creator",

	/**
	 * 超级龙虾模式
	 * 不会在列表中存在，只用于超级龙虾页面对话使用
	 */
	MagiClaw = "magiclaw",

	/**
	 * 自定义agent模式
	 */
	CustomAgent = "custom_agent",

	/**
	 * 默认模式
	 * 用于获取默认模式模型列表
	 */
	Default = "default",
}
