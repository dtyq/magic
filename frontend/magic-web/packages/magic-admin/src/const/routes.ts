export enum RoutePath {
	Admin = "/admin",
	AdminHome = "/admin/home",
	AdminNoAuthorized = "/admin/no-authorized",
	AdminApplicationManager = "/admin/application/management",

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
	PlatformSlidesTemplate = "/admin/platform/agent/slides-template",
	PlatformManage = "/admin/platform/manage",
	PlatformInfoManagement = "/admin/platform/manage/platform-info",
	PlatformAppMenu = "/admin/platform/manage/app-menu",
}

export enum RouteName {
	/** ====== AI 模块 ====== */
	Admin = "AdminLayout",
	AdminHome = "AdminHome",
	AdminApplicationManager = "AdminApplicationManager",
	AdminKeewood = "AdminKeewood",

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
	/** 智能体增强 - PPT模板 */
	AdminSlidesTemplate = "AdminSlidesTemplate",

	/** 平台管理 */
	AdminPlatformManage = "AdminPlatformManage",
	/** 平台管理 - 平台信息 */
	AdminPlatformInfoManagement = "AdminPlatformInfoManagement",
	/** 平台管理 - 应用菜单 */
	AdminAppMenu = "AdminAppMenu",
}
