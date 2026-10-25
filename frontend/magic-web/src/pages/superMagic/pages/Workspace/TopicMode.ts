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
	/** 后端项目列表中的数字员工资源项目模式。 */
	AgentCreator = "agent_creator",

	/**
	 * 技能主导模式
	 * 不会在列表中存在，只用于创建技能时使用
	 */
	SkillCreator = "skill-creator",
	/** 后端项目列表中的技能资源项目模式。 */
	SkillProjectCreator = "skill_creator",

	/**
	 * 超级龙虾模式
	 * 不会在列表中存在，只用于超级龙虾页面对话使用
	 */
	MagiClaw = "magiclaw",

	/**
	 * 自定义agent模式
	 */
	CustomAgent = "custom_agent",
	/** 自定义技能项目模式。 */
	CustomSkill = "custom_skill",

	/**
	 * 微应用开发
	 * 用于微应用开发模式
	 */
	MicroApp = "micro-app",

	/**
	 * AI 画布项目模式
	 * 只用于识别 ai-canvas 专属工作区里的项目并跳转到 AI 画布页；
	 * 对话仍使用 Design 话题模式（design 数字员工）。
	 */
	AiCanvas = "ai-canvas",

	/**
	 * AI 消费者研究
	 * 不会在模式列表中存在，只用于 AI 研究独立页面的话题
	 */
	PersonaResearch = "persona_research",

	/**
	 * 默认模式
	 * 用于获取默认模式模型列表
	 */
	Default = "default",
}
