export enum RoutePath {
	// AI Management paths

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

	// Enterprise Management paths
	Enterprise = "/admin/enterprise",
	EnterpriseOrganization = "/admin/enterprise/organization",
	EnterpriseDepartment = "/admin/enterprise/organization/department",
	EnterpriseOrganizationGroup = "/admin/enterprise/organization/group",
	EnterpriseUsageControl = "/admin/enterprise/usage",
	EnterpriseAIControl = "/admin/enterprise/usage/ai-control",
	EnterpriseSecurity = "/admin/enterprise/security",
	EnterpriseSecurityAdmin = "/admin/enterprise/security/admin",
	EnterpriseSecurityAdminLog = "/admin/enterprise/security/log",
	// Enterprise OA Approval paths
	OAApproval = "/admin/enterprise/approval",
	OAApprovalManage = "/admin/enterprise/approval/manage",
	OAApprovalMultiLang = "/admin/enterprise/approval/manage/lang",
	OAApprovalDataView = "/admin/enterprise/approval/data-view",
	OAApprovalWorkflowHandover = "/admin/enterprise/approval/workflow-handover",
	OAApprovalTemplateHandover = "/admin/enterprise/approval/template-handover",
	OAApprovalLimitedTime = "/admin/enterprise/approval/limited-time",
	OAApprovalDesign = "/admin/approval-design",

	// Capability Management paths
	Capability = "/admin/capability",

	// Platform Package paths
	Platform = "/admin/platform",
	PlatformPaidPackage = "/admin/platform/package",
	PlatformPaidPackageManage = "/admin/platform/package/manage",
	PlatformPaidPackageDetail = "/admin/platform/package/manage/detail",
	PlatformPaidPackageOrder = "/admin/platform/package/order",
	PlatformModel = "/admin/platform/model",
	PlatformAIModel = "/admin/platform/model/llm",
	PlatformAIModelDetail = "/admin/platform/model/llm/:id",
	PlatformAIDrawing = "/admin/platform/model/vlm",
	PlatformAIDrawingDetail = "/admin/platform/model/vlm/:id",
	PlatformAgent = "/admin/platform/agent",
	PlatformAgentMode = "/admin/platform/agent/mode",
	PlatformAgentSkill = "/admin/platform/agent/skill",
	PlatformAgentEmployeeReview = "/admin/platform/agent/employee-review",
	PlatformAgentSkillMarket = "/admin/platform/agent/skill-market",
	PlatformAgentEmployeeMarket = "/admin/platform/agent/employee-market",
	PlatformCapability = "/admin/platform/agent/capability",
	PlatformCapabilityDetail = "/admin/platform/agent/capability/:code",
	PlatformTenant = "/admin/platform/tenant",
	PlatformTenantList = "/admin/platform/tenant/list",
	PlatformTenantPoints = "/admin/platform/tenant/points",
	PlatformManage = "/admin/platform/manage",
	PlatformInfoManagement = "/admin/platform/manage/platform-info",
	PlatformAppMenu = "/admin/platform/manage/app-menu",
	PlatformMaintenance = "/admin/platform/manage/maintenance",
	PlatformProxyServer = "/admin/platform/manage/proxy-server",
	PlatformAIAudit = "/admin/platform/manage/audit",

	// Security Control paths

	Teamshare = "/admin/home",
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

	/** ====== 平台管理模块 ====== */
	/** 平台套餐布局 */
	AdminPlatformLayout = "AdminPlatformLayout",
	/** 平台套餐 */
	AdminPlatformPackage = "AdminPlatformPackage",
	/** 平台套餐 - 订阅套餐管理 */
	AdminPackageManage = "AdminPackageManage",
	/** 平台套餐 - 订阅套餐详情 */
	AdminPackageDetail = "AdminPackageDetail",
	/** 平台套餐 - 订单管理 */
	AdminPackageOrder = "AdminPackageOrder",

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

	/** 平台租户管理 */
	AdminTenant = "AdminTenant",
	/** 平台租户管理 - 租户列表 */
	AdminTenantList = "AdminTenantList",
	/** 平台租户管理 - 租户积分 */
	AdminTenantPoints = "AdminTenantPoints",

	/** 平台管理 */
	AdminPlatformManage = "AdminPlatformManage",
	/** 平台管理 - 代理服务器 */
	AdminProxyServer = "AdminProxyServer",
	/** 平台管理 - 平台维护 */
	AdminPlatformMaintenance = "AdminPlatformMaintenance",
	/** 平台管理 - 平台信息 */
	AdminPlatformInfoManagement = "AdminPlatformInfoManagement",
	/** 平台管理 - 应用菜单 */
	AdminAppMenu = "AdminAppMenu",
	/** 平台管理 - AI审查 */
	AdminAIAudit = "AdminAIAudit",

	/** ====== 企业管理模块 ====== */
	AdminEnterpriseLayout = "AdminEnterpriseLayout",
	/** 企业组织架构 */
	AdminEnterpriseOrganization = "AdminEnterpriseOrganization",
	/** 企业组织架构 - 部门 */
	AdminEnterpriseDepartment = "AdminEnterpriseDepartment",
	/** 企业组织架构 - 用户组 */
	AdminEnterpriseUserGroup = "AdminEnterpriseUserGroup",
	/** 用量管控 */
	AdminUsageControl = "AdminUsageControl",
	/** 用量管控 - AI 消耗管控 */
	AdminAIControl = "AdminAIControl",
	/** 权限管控 */
	AdminAuthorityControl = "AdminAuthorityControl",
	/** 权限管控 - 管理员权限 */
	AdminAuthority = "AdminAuthority",
	/** 权限管控 - 管理员日志 */
	AdminAuthorityLog = "AdminAuthorityLog",

	/** ====== 功能管理模块 ====== */
	/** OA审批 */
	AdminOAApproval = "AdminOAApproval",
	/** 审批设计 */
	AdminApprovalDesign = "AdminApprovalDesign",
	/** OA审批 - 审批管理 */
	AdminOAApprovalManage = "AdminOAApprovalManage",
	/** OA审批 - 多语言设置 */
	AdminOAApprovalMultiLang = "AdminOAApprovalMultiLang",
	/** OA审批 - 数据视图 */
	AdminOAApprovalDataView = "AdminOAApprovalDataView",
	/** OA审批 - 流程交接 */
	AdminOAApprovalWorkflowHandover = "AdminOAApprovalWorkflowHandover",
	/** OA审批 - 模板交接 */
	AdminOAApprovalTemplateHandover = "AdminOAApprovalTemplateHandover",
	/** OA审批 - 限时审批 */
	AdminOAApprovalLimitedTime = "AdminOAApprovalLimitedTime",
}
