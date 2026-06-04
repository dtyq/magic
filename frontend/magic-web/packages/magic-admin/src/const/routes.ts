export enum RoutePath {
	Admin = "/admin",
	AdminHome = "/admin/home",
	AdminNoAuthorized = "/admin/no-authorized",
	AdminApplicationManager = "/admin/application/management",

	// AI Management paths
	AI = "/admin/ai",
	AICustomModel = "/admin/ai/custom",
	AIModel = "/admin/ai/custom/llm",
	AIModelDetail = "/admin/ai/custom/llm/:id",
	AIDrawing = "/admin/ai/custom/vlm",
	AIDrawingDetail = "/admin/ai/custom/vlm/:id",
	AIVideo = "/admin/ai/custom/video",
	AIVideoDetail = "/admin/ai/custom/video/:id",
	AIInternalEmployeeSkill = "/admin/ai/internal-employee-skill",
	AIEmployeeReview = "/admin/ai/internal-employee-skill/employee-review",
	AISkillReview = "/admin/ai/internal-employee-skill/skill-review",

	// Platform Package paths
	Platform = "/admin/platform",
	PlatformModel = "/admin/platform/model",
	PlatformAIModel = "/admin/platform/model/llm",
	PlatformAIModelDetail = "/admin/platform/model/llm/:id",
	PlatformAIDrawing = "/admin/platform/model/vlm",
	PlatformAIDrawingDetail = "/admin/platform/model/vlm/:id",
	PlatformVideoModel = "/admin/platform/model/video",
	PlatformVideoModelDetail = "/admin/platform/model/video/:id",
	PlatformAgent = "/admin/platform/agent",
	PlatformAgentMode = "/admin/platform/agent/mode",
	PlatformAgentSkill = "/admin/platform/agent/skill",
	PlatformAgentEmployeeReview = "/admin/platform/agent/employee-review",
	PlatformAgentSkillMarket = "/admin/platform/agent/skill-market",
	PlatformAgentEmployeeMarket = "/admin/platform/agent/employee-market",
	PlatformCapability = "/admin/platform/agent/capability",
	PlatformCapabilityDetail = "/admin/platform/agent/capability/:code",
	PlatformManage = "/admin/platform/manage",
	PlatformInfoManagement = "/admin/platform/manage/platform-info",
	PlatformProviderAccess = "/admin/platform/manage/provider-access",
	PlatformAppMenu = "/admin/platform/manage/app-menu",
	PlatformMaintenance = "/admin/platform/manage/maintenance",
}

export enum RouteName {
	/** ====== AI 模块 ====== */
	Admin = "AdminLayout",
	AdminHome = "AdminHome",
	AdminApplicationManager = "AdminApplicationManager",
	AdminKeewood = "AdminKeewood",

	/** ====== AI 管理模块 ====== */
	/** AI 管理布局 */
	AdminAILayout = "AdminAILayout",
	/** 自定义大模型 */
	AdminAICustomModel = "AdminAICustomModel",
	/** 自定义大模型 - 文本大模型 */
	AdminAIModel = "AdminAIModel",
	/** 自定义大模型 - 生图大模型 */
	AdminAIDrawing = "AdminAIDrawing",
	/** 自定义大模型 - 文本大模型详情 */
	AdminAIModelDetails = "AdminAIModelDetails",
	/** 自定义大模型 - 生图大模型详情 */
	AdminAIDrawingDetails = "AdminAIDrawingDetails",
	/** 自定义大模型 - 视频大模型 */
	AdminAIVideo = "AdminAIVideo",
	/** 自定义大模型 - 视频大模型详情 */
	AdminAIVideoDetails = "AdminAIVideoDetails",
	/** 内部员工及技能 */
	AdminAIInternalEmployeeSkill = "AdminAIInternalEmployeeSkill",
	/** 内部员工及技能 - 员工发布审核 */
	AdminAIEmployeeReview = "AdminAIEmployeeReview",
	/** 内部员工及技能 - 技能发布审核 */
	AdminAISkillReview = "AdminAISkillReview",

	/** ====== 平台管理模块 ====== */
	/** 平台套餐布局 */
	AdminPlatformLayout = "AdminPlatformLayout",

	/** 平台模型 */
	AdminPlatformModel = "AdminPlatformModel",
	/** 平台模型 - 文本大模型管理 */
	AdminPlatformAIModel = "AdminPlatformAIModel",
	/** 平台模型 - 文本大模型详情 */
	AdminPlatformAIModelDetails = "AdminPlatformAIModelDetails",
	/** 平台模型 - 生图大模型管理 */
	AdminPlatformAIDrawing = "AdminPlatformAIDrawing",
	/** 平台模型 - 生图大模型详情 */
	AdminPlatformAIDrawingDetails = "AdminPlatformAIDrawingDetails",
	/** 平台模型 - 视频大模型管理 */
	AdminPlatformVideoModel = "AdminPlatformVideoModel",
	/** 平台模型 - 视频大模型详情 */
	AdminPlatformVideoModelDetails = "AdminPlatformVideoModelDetails",

	/** 智能体增强 */
	AdminAgentEnhancement = "AdminAgentEnhancement",
	/** 智能体增强 - 系统智能体 */
	AdminSystemAgent = "AdminSystemAgent",
	/** 智能体增强 - Skill管理 */
	AdminSystemSkill = "AdminSystemSkill",
	/** 智能体增强 - 员工审核 */
	AdminEmployeeReview = "AdminEmployeeReview",
	/** 智能体增强 - Skill 市场 */
	AdminSkillMarket = "AdminSkillMarket",
	/** 智能体增强 - 员工市场 */
	AdminEmployeeMarket = "AdminEmployeeMarket",
	/** 智能体增强 - 能力管理 */
	AdminSystemCapability = "AdminSystemCapability",
	/** 智能体增强 - 能力详情 */
	AdminSystemCapabilityDetail = "AdminSystemCapabilityDetail",

	/** 平台管理 */
	AdminPlatformManage = "AdminPlatformManage",
	/** 平台管理 - 平台维护 */
	AdminPlatformMaintenance = "AdminPlatformMaintenance",
	/** 平台管理 - 平台信息 */
	AdminPlatformInfoManagement = "AdminPlatformInfoManagement",
	/** 平台管理 - 运营管控 */
	AdminPlatformProviderAccess = "AdminPlatformProviderAccess",
	/** 平台管理 - 应用菜单 */
	AdminAppMenu = "AdminAppMenu",
}
