/** Route alias */
export enum RouteName {
	/** 管理后台根路由 */
	AdminPlatform = "AdminPlatform",
	/** API 平台根路由 */
	APIPlatform = "APIPlatform",
	/** 麦吉应用 根路由 */
	MagicPlatform = "MagicPlatform",
	/** 审批 - 文件预览 */
	TeamshareApprovalFilePreview = "TeamshareApprovalFilePreview",
	/** 全局布局 */
	GlobalLayout = "GlobalLayout",
	/** 超级麦吉 - 案例分享 */
	SuperMagicShare = "SuperMagicShare",
	/** 超级麦吉 - 文件分享 */
	SuperMagicFileShare = "SuperMagicFileShare",
	/** 超级麦吉 - 分享(团队专用) */
	MagicShare = "MagicShare",
	/** 超级麦吉 - 看板 */
	SuperDashboard = "SuperDashboard",
	/** 超级麦吉 - 首页 */
	Super = "Super",
	/**  */
	SuperWorkspaceState = "SuperWorkspaceState",
	/**  */
	SuperWorkspaceProjectState = "SuperWorkspaceProjectState",
	/**  */
	SuperWorkspaceProjectTopicState = "SuperWorkspaceProjectTopicState",
	/** 协作邀请 */
	CollaborationInvite = "CollaborationInvite",
	/** 用户 - 个人中心（移动端） */
	Profile = "Profile",
	/** 用户 - 个人中心 - 积分明细列表（移动端） */
	ProfilePointsList = "ProfilePointsList",
	/** 用户 - 个人中心 - 订阅账单列表（移动端） */
	ProfileSubscriptionBill = "ProfileSubscriptionBill",
	/** 用户 - 个人中心 - 个人信息（移动端） */
	ProfileInfo = "ProfileInfo",
	/** 用户 - 个人中心 - 账户安全（移动端） */
	ProfileAccountSecurity = "ProfileAccountSecurity",
	/** 用户 - 个人中心 - 登录设备（移动端） */
	ProfileLoginDevices = "ProfileLoginDevices",
	/** 用户 - 个人中心 - 设置（移动端） */
	ProfileSettings = "ProfileSettings",
	/** 用户 - 个人中心 - 设置 - 语言（移动端） */
	ProfileSettingsLanguage = "ProfileSettingsLanguage",
	/** 用户 - 个人中心 - 设置 - 时区（移动端） */
	ProfileSettingsTimezone = "ProfileSettingsTimezone",
	/** 移动端统一 Tabs 容器 */
	MobileTabs = "MobileTabs",
	/** 移动端 Tabs - 超级麦吉工作区 */
	MobileTabsSuperWorkspace = "MobileTabsSuperWorkspace",
	/** 移动端 Tabs - 超级麦吉项目 */
	MobileTabsSuperProject = "MobileTabsSuperProject",
	/** 移动端 Tabs - 超级麦吉话题 */
	MobileTabsSuperTopic = "MobileTabsSuperTopic",
	/** 移动端 Tabs - AI 录音总结 */
	MobileTabsRecording = "MobileTabsRecording",
	/** 回收站（移动端占位页） */
	/**  */
	SuperMagicNavigate = "SuperMagicNavigate",
	SuperAssistant = "SuperAssistant",
	/** Crew Market - 员工市场（入口，重定向到 Crew 子页） */
	CrewMarket = "CrewMarket",
	/** Crew Market - Crew 子页 */
	CrewMarketCrew = "CrewMarketCrew",
	/** Crew Market - Skills 子页 */
	CrewMarketSkills = "CrewMarketSkills",
	/** Crew Edit - 编辑 Crew（创建后跳转或编辑现有） */
	CrewEdit = "CrewEdit",
	/** My Skills - 我的技能 */
	MySkills = "MySkills",
	/** My Crew - 我的员工 */
	MyCrew = "MyCrew",
	/** MagiClaw - 超级龙虾 */
	MagiClaw = "MagiClaw",
	/** 超级麦吉 - 首页(旧版本) */
	SuperMagic = "SuperMagic",
	/**
	 * @description 超级麦吉 - 话题分享
	 * @params {string} topicId 话题Id
	 */
	SuperMagicTopicShare = "SuperMagicTopicShare",
	/** 超级麦吉 - 工作区(旧版本) */
	SuperMagicWorkspace = "SuperMagicWorkspace",
	/** 超级麦吉 - 文件(旧版本) */
	SuperMagicFiles = "SuperMagicFiles",
	/** 超级麦吉 - 工作区 */
	SuperWorkspace = "SuperWorkspace",
	/** 授权模块 - 布局 */
	AuthLayout = "AuthLayout",
	/** 授权模块 - 授权结果回调 */
	AuthCallback = "AuthCallback",
	/** 应用模块 - 子应用（微前端） */
	MicroApplication = "MicroApplication",
	/** 应用列表 */
	Applications = "Applications",
	/** 登录模块 - 布局 */
	SSOLayout = "SSOLayout",
	/** 登录模块 - 第三方平台账号 */
	ThirdPartyAccount = "ThirdPartyAccount",
	/** 登录模块 - 第三方平台账号 - 苹果授权回调 */
	ThirdPartyAccountAppleCallback = "ThirdPartyAccountAppleCallback",
	/** 登录模块 - 首页 */
	Login = "Login",
	/** 登录模块 - 邀请码 */
	Invite = "Invite",
	/** 状态页 - 找不到对应资源 */
	NotFound = "NotFound",
	/** 状态页 - 没有登录 */
	NotAuth = "NotAuth",
	/** 系统初始化流程 */
	Initialization = "Initialization",
	/** Chat模块 - 首页 */
	Chat = "Chat",
	/** Chat模块 - 对话页面 */
	ChatConversation = "ChatConversation",
	/** Chat模块 - 设置 */
	ChatSetting = "ChatSetting",
	/** 用户模块 - 用户详情 */
	UserInfoDetails = "UserInfoDetails",
	/** AI助理 - 助理市场 */
	Explore = "Explore",
	/** AI助理 - 详情(内聚流程、工具集、向量知识库) */
	FlowDetail = "FlowDetail",
	/** AI助理 - AI助理列表 */
	AgentList = "AgentList",
	/** AI助理 - MCP列表 */
	MCP = "MCP",
	/** AI助理 - 列表管理(内聚流程、工具集、向量知识库) */
	Flows = "Flows",
	/** 向量知识库 - 创建 */
	VectorKnowledgeCreate = "VectorKnowledgeCreate",
	/** 向量知识库 - 详情 */
	VectorKnowledgeDetail = "VectorKnowledgeDetail",
	/** 日程 */
	Calendar = "Calendar",
	/** 设置 */
	Settings = "Settings",
	/** 通讯录 - 首页 */
	Contacts = "Contacts",
	/** 通讯录 - 组织架构 */
	ContactsOrganization = "ContactsOrganization",
	/** 通讯录 - 我的朋友 */
	ContactsMyFriends = "ContactsMyFriends",
	/** 通讯录 - 我的分组 */
	ContactsMyGroups = "ContactsMyGroups",
	/** 通讯录 - AI助理 */
	ContactsAiAssistant = "ContactsAiAssistant",
	/** 工作台 */
	Workspace = "Workspace",
	/** 审批 */
	MagicApproval = "MagicApproval",
	/** 审批 - 发起审批 */
	MagicApprovalInitiate = "MagicApprovalInitiate",
	/** 审批 - 审批中心 */
	MagicApprovalCenter = "MagicApprovalCenter",
	/** 审批 - 智能委托 */
	MagicApprovalDelegate = "MagicApprovalDelegate",
	/** 审批 - 审批代理 */
	MagicApprovalAgent = "MagicApprovalAgent",
	/** 审批 - 详情 */
	MagicApprovalDetail = "MagicApprovalDetail",
	/** 审批详情 */
	MagicApprovalDetailFull = "MagicApprovalDetailFull",
	/** 审批 - 审批模版 */
	MagicApprovalTemplate = "MagicApprovalTemplate",
	/** 审批 - 设置 */
	MagicApprovalSetting = "MagicApprovalSetting",
	/** 审批 - 详情/记录(移动端) */
	MagicApprovalRecord = "MagicApprovalRecord",
	/** 审批 - 列表(待处理、已处理、已发起、我收到的) */
	MagicApprovalList = "MagicApprovalList",
	/** 旧版版知识库 */
	FlowKnowledgeDetail = "FlowKnowledgeDetail",
	/** 信息完善页（移动端） */
	ImproveInformation = "ImproveInformation",
	/**
	 * ======================== ========================
	 *                      Admin
	 * ======================== ========================
	 */
	/** ====== AI 模块 ====== */
	Admin = "AdminLayout",
	AdminHome = "AdminHome",
	AdminApplicationManager = "AdminApplicationManager",
	AdminKeewood = "AdminKeewood",
	/** 管理后台 - AI管理布局 */
	AdminAILayout = "AdminAILayout",
	AdminAI = "AdminAI",
	/** 管理后台 - 管控策略 */
	AdminAIControl = "AdminAIControl",

	/** ====== 功能管理模块 ====== */
	/** 管理后台 - 功能管理布局 */
	AdminCapabilityLayout = "AdminCapabilityLayout",
	/** 管理后台 - 功能管理 - OA审批 */
	AdminOAApproval = "AdminOAApproval",
	/** 管理后台 - 审批设计 */
	AdminApprovalDesign = "AdminApprovalDesign",
	/** 管理后台 - 功能管理 - OA审批 - 审批管理 */
	AdminOAApprovalManage = "AdminOAApprovalManage",
	/** 管理后台 - 功能管理 - OA审批 - 数据视图 */
	AdminOAApprovalDataView = "AdminOAApprovalDataView",
	/** 管理后台 - 功能管理 - OA审批 - 流程交接 */
	AdminOAApprovalWorkflowHandover = "AdminOAApprovalWorkflowHandover",
	/** 管理后台 - 功能管理 - OA审批 - 模板交接 */
	AdminOAApprovalTemplateHandover = "AdminOAApprovalTemplateHandover",
	/** 管理后台 - 功能管理 - OA审批 - 限时审批 */
	AdminOAApprovalLimitedTime = "AdminOAApprovalLimitedTime",

	/** ====== 套餐模块 ====== */
	/** 管理后台 - 平台套餐布局 */
	AdminPlatformLayout = "AdminPlatformLayout",
	/** 管理后台 - 付费套餐 */
	AdminPackagePaid = "AdminPackagePaid",
	/** 管理后台 - 套餐管理 */
	AdminPackageManage = "AdminPackageManage",
	/** 管理后台 - 套餐详情 */
	AdminPackageDetail = "AdminPackageDetail",
	/** 管理后台 - 订单管理 */
	AdminPackageOrder = "AdminPackageOrder",
	/** 管理后台 - 模式管理 */
	AdminPackageMode = "AdminPackageMode",
	/** 管理后台 - 系统设置 */
	AdminSystemSetting = "AdminSystemSetting",
	/** 管理后台 - 平台信息管理 */
	PlatformInfoManagement = "PlatformInfoManagement",
	/** 管理后台 - 维护信息管理 */
	AdminInfoManagement = "AdminInfoManagement",
	/** 管理后台 - AI 管理 */
	AdminPlatformAI = "AdminPlatformAI",
	/** 管理后台 - 大模型管理 */
	AdminAIModel = "AdminAIModel",
	/** 管理后台 - 大模型详情 */
	AdminAIModelDetails = "AdminAIModelDetails",
	/** 管理后台 - 智能绘图管理 */
	AdminAIDrawing = "AdminAIDrawing",
	/** 管理后台 - 智能绘图详情 */
	AdminAIDrawingDetails = "AdminAIDrawingDetails",
	/** 管理后台 - 能力管理 */
	AdminAIPower = "AdminAIPower",
	/** 管理后台 - 能力详情 */
	AdminAIPowerDetails = "AdminAIPowerDetails",
	/** 管理后台 - AI审查 */
	AIAudit = "AIAudit",
	/** 管理后台 - 组织管理 */
	AdminOrganization = "AdminOrganization",
	/** 管理后台 - 组织管理 - 组织列表 */
	AdminOrganizationList = "AdminOrganizationList",
	/** 管理后台 - 组织管理 - 组织积分 */
	AdminOrganizationPoints = "AdminOrganizationPoints",
	/** 管理后台 - 代理服务器 */
	AdminProxyServer = "AdminProxyServer",

	/** ====== 企业管理模块 ====== */
	AdminEnterpriseLayout = "AdminEnterpriseLayout",
	/** 管理后台 - 企业组织架构 */
	AdminEnterpriseOrganization = "AdminEnterpriseOrganization",
	/** 管理后台 - 企业组织架构 - 部门 */
	AdminEnterpriseDepartment = "AdminEnterpriseDepartment",
	/** 管理后台 - 企业组织架构 - 用户组 */
	AdminEnterpriseUserGroup = "AdminEnterpriseUserGroup",
	/** 管理后台 - AI 管理 */
	AdminEnterpriseAI = "AdminEnterpriseAI",

	/** ====== 安全管控模块 ====== */
	AdminSecurityLayout = "AdminSecurityLayout",
	/** 管理后台 - 权限管控 */
	AdminAuthorityControl = "AdminAuthorityControl",
	/** 管理后台 - 管理员权限 */
	AdminAuthority = "AdminAuthority",
	/** 管理后台 - 管理员日志 */
	AdminAuthorityLog = "AdminAuthorityLog",

	/** 回收站（侧边栏入口） */
	RecycleBin = "RecycleBin",

	/**
	 * ======================== ========================
	 *           Magic Platform - 模型分发平台
	 * ======================== ========================
	 */
	/** 模型分发平台 - 平台套餐布局 */
	PlatformLayout = "PlatformLayout",
	/** 模型分发平台 - 首页 */
	PlatformHome = "PlatformHome",
	/** 模型分发平台 - 可用模型 */
	PlatformModel = "PlatformModel",
	/** 模型分发平台 - 模型详情 */
	PlatformModelDetail = "PlatformModelDetail",
	/** 模型分发平台 - 用户页 */
	PlatformUser = "PlatformUser",
	/** 模型分发平台 - 用户帐号设置 */
	PlatformUserAccount = "PlatformUserAccount",
	/** 模型分发平台 - API密钥 */
	PlatformAPIKey = "PlatformAPIKey",
	/** 模型分发平台 - 帐户余额 */
	PlatformAccountBalance = "PlatformAccountBalance",
	/** 模型分发平台 - 模型使用统计 */
	PlatformModelStatistics = "PlatformModelStatistics",
	/** 模型分发平台 - 图片使用统计 */
	PlatformImageStatistics = "PlatformImageStatistics",
	/** 模型分发平台 - 消费账单 */
	PlatformConsumptionBill = "PlatformConsumptionBill",
	/** 模型分发平台 - 导出数据 */
	PlatformExportData = "PlatformExportData",
	/** 模型分发平台 - 使用说明 */
	PlatformDocumentation = "PlatformDocumentation",
	/** 模型分发平台 - 水印管理 */
	PlatformWatermarkManagement = "PlatformWatermarkManagement",

	/**
	 * ======================== ========================
	 *                      Teamshare
	 * ======================== ========================
	 */
	/** 站点首页 */
	HomePage = "HomePage",
	/** Office文档布局 */
	OfficeLayout = "OfficeLayout",
	/** Office文档 */
	OfficeFile = "OfficeFile",
	/** Office文档预览 */
	OfficePreview = "OfficePreview",
	/** 审批 - 布局 */
	ApprovalLayout = "ApprovalLayout",
	/** 审批 */
	Approval = "Approval",
	/** 审批 - 第三方跳转 */
	ApprovalBlank = "ApprovalBlank",
	/** 审批 - 列表 */
	ApprovalList = "ApprovalList",
	/** 审批 - 详情 */
	ApprovalDetails = "ApprovalDetails",
	/** 审批 - 详情（旧版本） */
	ApprovalDetailsOld = "ApprovalDetailsOld",
	/** 审批 - 模版 */
	ApprovalTemplate = "ApprovalTemplate",
	/** 审批 - 详情(旧版本) */
	ApprovalOld = "ApprovalOld",
	/** 任务 - 布局 */
	TasksLayout = "TasksLayout",
	/** 任务 */
	Tasks = "Tasks",
	/** 任务 - 详情 */
	TaskDetails = "TaskDetails",
	/** 任务 - 创建 */
	TaskCreate = "TaskCreate",
	/** 云盘布局 */
	DriveLayout = "DriveLayout",
	/** 云盘 - 常用文档 */
	DriveRecent = "DriveRecent",
	/** 云盘 - 个人云盘 */
	DriveMe = "DriveMe",
	/** 云盘 - 企业云盘 */
	DriveShared = "DriveShared",
	/** 云盘 - 个人创建的 */
	DriveCreated = "DriveCreated",
	/** 云盘 - 回收站 */
	DriveTrash = "DriveTrash",
	/** 云盘 - 文件夹 */
	DriveFolder = "DriveFolder",
	/** 多维表格布局 */
	BiTableLayout = "BiTableLayout",
	/** 多维表格 */
	BiTable = "BiTable",
	/** 表单分享 */
	FormSubmit = "FormSubmit",
	/** 多维表格历史纪录 */
	BiTableHistory = "BiTableHistory",
	/** 知识库(布局) */
	KnowledgeLayout = "KnowledgeLayout",
	/** 知识库 */
	Knowledge = "Knowledge",
	/** 知识库 - 首页布局 */
	KnowledgeWikiLayout = "KnowledgeWikiLayout",
	/** 知识库 - 设置 */
	KnowledgeManage = "KnowledgeManage",
	/**
	 * @description 知识库 - 目录
	 * @params {string} knowledgeId 知识库Id
	 */
	KnowledgeDirectory = "KnowledgeDirectory",
	/** 知识库 - 文件预览 */
	KnowledgePreview = "KnowledgePreview",
	/** 收藏 - 布局 */
	FavoritesLayout = "FavoritesLayout",
	/** 收藏 */
	Favorites = "Favorites",
	/** 云盘模版搜索（移动端） */
	DriveTemplateSearch = "DriveTemplateSearch",
	/** 云盘模版（移动端） */
	DriveTemplate = "DriveTemplate",
	/** 云盘模版预览（移动端） */
	DriveTemplatePreview = "DriveTemplatePreview",
	/** 画板布局 */
	WhiteboardLayout = "WhiteboardLayout",
	/** 画板 */
	Whiteboard = "Whiteboard",
	/** 文件布局 */
	FileLayout = "FileLayout",
	/** 文件 */
	File = "File",
	/** 云文档布局(旧版本) */
	DocsLayout = "DocsLayout",
	/**
	 * @description 云文档(旧版本)
	 * @params {string} fileId 文档Id
	 */
	Docs = "Docs",
	/** 云文档布局(新版本) */
	DocxLayout = "DocxLayout",
	/** 云文档历史纪录 */
	DocxHistory = "DocxHistory",
	/**
	 * @description 云文档(新版本)
	 * @params {string} fileId 文档Id
	 */
	Docx = "Docx",
	/** 登录 */
	SignIn = "SignIn",
	/** 成员激活/合作伙伴激活 */
	ActivationLayout = "ActivationLayout",
	Activation = "Activation",
}
