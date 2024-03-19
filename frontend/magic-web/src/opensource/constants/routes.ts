export const enum RoutePath {
	Initialization = "/initialization",
	ApprovalDetailFull = "/approval/:id",
	ApprovalFilePreview = "/approval/file/preview",
	Home = "/home",
	Chat = "/chat",
	Login = "/login",
	Invite = "/login/invite",
	/** 弹窗登录回调页 */
	LoginPopupCallback = "/login-popup-callback",
	Accounts = "/accounts",
	NotFound = "*",
	NotAuth = "/no-authorized",
	/**
	 * @description 应用(微前端)
	 */
	Applications = "/applications",
	MicroApplication = "/application/*",
	/**
	 * @description 云盘
	 */
	Drive = "/drive",
	/** 常用云盘 */
	DriveRecent = "/drive/recent",
	/** 个人云盘 */
	DriveMe = "/drive/me",
	/** 企业云盘 */
	DriveShared = "/drive/shared",
	/** 我创建的 */
	DriveCreated = "/drive/mine",
	/** 回收站 */
	DriveTrash = "/drive/trash",
	/** 文件夹 */
	DriveFolder = "/drive/folder/:folderId/:spaceType",
	/** 文档 */
	BiTable = "/base",
	/** 知识库 */
	Knowledge = "/knowledge",
	/** 知识库 - 首页展示 */
	KnowledgeWiki = "/wiki",
	/** 审批 */
	Approval = "/approval",
	/** 审批 - 发起审批 */
	ApprovalInitiate = "/approval/initiate",
	/** 审批 - 审批中心 */
	ApprovalCenter = "/approval/center",
	/** 审批 - 智能委托 */
	ApprovalDelegate = "/approval/delegate",
	/** 审批 - 审批代理 */
	ApprovalAgent = "/approval/agent",
	ApprovalTemplate = "/approval/template/:code",
	ApprovalLayout = "/approval/list",
	ApprovalList = "/approval/list/:type",
	/** 任务 */
	Tasks = "/tasks",
	/** 任务 */
	TaskDetails = "/tasks/details/:taskId",
	/** 收藏 */
	Favorites = "/favorites",
	/** 设置 */
	Settings = "/settings",
	/** 通讯录 */
	Contacts = "/contacts",
	ContactsOrganization = "/contacts/organization",
	ContactsAiAssistant = "/contacts/ai-assistant",
	ContactsMyFriends = "/contacts/my-friends",
	ContactsMyGroups = "/contacts/my-groups",
	Application = "/app",
	Workspace = "/workspace",
	AssistantList = "/flow/assistant",
	Flow = "/flow",
	MCP = "/flow/mcp/list",
	Flows = "/flow/:type/list",
	VectorKnowledge = "/vector-knowledge",
	VectorKnowledgeCreate = "/vector-knowledge/create",
	VectorKnowledgeDetail = "/vector-knowledge/detail",
	AgentList = "/flow/agent/list",
	Explore = "/explore",
	FlowKnowledgeDetail = "/flow/vector-knowledge/detail/:id",
	FlowKnowledgeList = "/flow/vector-knowledge/list",
	FlowDetail = "/flow/:type/detail/:id",
	Calendar = "/calendar",
	SuperMagic = "/super-magic",
	SuperDashboard = "/dashboard",
	SuperMagicWorkspace = "/super-magic/workspace",
	SuperMagicArchived = "/super-magic/archived",
	SuperMagicFiles = "/super-magic/files",
	SuperMagicReplay = "/super-magic-replay",
	SuperWorkspace = "/super/workspace",
	Super = "/super",
	SuperWorkspaceState = "/super/workspace/:workspaceId",
	SuperWorkspaceProjectState = "/super/:projectId",
	SuperWorkspaceProjectTopicState = "/super/:projectId/:topicId",
	SuperAssistant = "/super/assistant",
	CrewMarket = "/market",
	CrewMarketCrew = "/market/crew",
	CrewMarketSkills = "/market/skills",
	CrewEdit = "/crew/:id",
	MySkills = "/my-skills",
	MyCrew = "/my-crew",
	MagiClaw = "/magi-claw",
	SuperMagicFileShare = "/share/:topicId/file/:fileId",
	SuperMagicTopicShare = "/share/:topicId",
	SuperMagicFilesShare = "/share/files/:resourceId",
	SuperMagicTopicShareNew = "/share/topic/:resourceId",
	SuperMagicShare = "/share/*",
	Dashboard = "/dashboard",
	MagicShare = "/magic-share/:projectId/:topicId",
	/** 授权回调页面 */
	AuthLayout = "/auth",
	AuthCallback = "/auth/callback/:provider",
	Activation = "/activation",

	/** 协作邀请 */
	CollaborationInvite = "/collaboration-invite/:inviteId",

	// admin routes
	Admin = "/admin",
	AdminHome = "/admin/home",
	AdminNoAuthorized = "/admin/no-authorized",
	AdminApplicationManager = "/admin/application/management",
	AdminApprovalDesign = "/admin/approval/design",
	AdminApproval = "/admin/approval/*",
}

export const enum RoutePathMobile {
	UserDetail = "/user-detail/:userId",
	ChatCurrent = "/chat/current",
	ChatSetting = "/chat/setting",
	ExploreSearch = "/explore/search",
	ApprovalSetting = "/approval/setting",
	ApprovalRecord = "/approval/record",
	ApprovalDetail = "/approval/detail/:id",
	ApprovalTemplate = "/approval/template/:code",
	/** 个人中心 主路由 */
	Profile = "/profile",
	/** 个人中心 子路由 - 积分明细 */
	ProfilePointsList = "/profile/points-list",
	/** 个人中心 子路由 - 订阅账单 */
	ProfileSubscriptionBill = "/profile/subscription-bill",
	/** 个人中心 子路由 - 个人信息 */
	ProfileInfo = "/profile/info",
	/** 个人中心 子路由 - 账户安全 */
	ProfileAccountSecurity = "/profile/account-security",
	/** 个人中心 子路由 - 登录设备 */
	ProfileLoginDevices = "/profile/login-devices",
	/** 个人中心 子路由 - 设置 */
	ProfileSettings = "/profile/settings",
	/** 个人中心 子路由 - 设置 - 语言 */
	ProfileSettingsLanguage = "/profile/settings/language",
	/** 个人中心 子路由 - 设置 - 时区 */
	ProfileSettingsTimezone = "/profile/settings/timezone",
	SuperMagicNavigate = "/super/navigate",
	MobileTabs = "/mobile-tabs",
	/** 信息完善页 */
	ImproveInformation = "/improve-information",
}
