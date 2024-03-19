/* eslint-disable no-template-curly-in-string */

export const RequestUrl = {
	/** 获取天书 用户信息 */
	getTeamshareUserInfo: "/v4/users/info",
	/** 获取企业信息 */
	getEnterpriseInfo: "/v4/console/enterprise/info",

	/** 获取组织架构 */
	getOrganization: "/api/v1/contact/departments/${id}/children",
	/** 【新版本】获取部门用户列表 */
	getDepartmentUsers: "/api/v1/contact/departments/${id}/users",
	/** 搜索用户 */
	searchUser: "/api/v2/magic/contact/user/searchForSelect",

	/** 获取天书组织架构 */
	getTeamshareOrganization: "api/organization/chart/queries",
	/** 获取子管理员权限列表 */
	getSubAdminPermissions: "/v4/console/sub-admin/permissions",
	/** 获取组织当前订阅的套餐 */
	getSubscriptionInfo: "/api/v1/admin/subscription",

	/** AI管理 */
	/** AI管理 - 模型管理 */
	/** 获取服务提供商（非官方数据） */
	getServiceProvider: "/api/v1/admin/service-providers/non-official/queries",
	/** 非官方组织获取服务提供商 */
	getServiceProviderNonOfficial:
		"/api/v1/organization/admin/service-providers/non-official/queries",
	/** 官方组织获取服务商列表 */
	getServiceProviderList: "/api/v1/admin/service-providers",
	/** 非官方组织获取服务商列表 */
	getServiceProviderListNonOfficial: "/api/v1/organization/admin/service-providers",
	/** 获取服务商详细信息 */
	getServiceProviderDetail: "/api/v1/admin/service-providers/${id}",
	/** 非官方组织获取服务商详细信息 */
	getServiceProviderDetailNonOfficial: "/api/v1/organization/admin/service-providers/${id}",

	/** 激活/取消模型 */
	updateModelStatus: "/api/v1/admin/service-providers/models/${id}/status",
	/** 非官方组织激活/取消模型 */
	updateModelStatusNonOfficial:
		"/api/v1/organization/admin/service-providers/models/${id}/status",
	/** 添加模型 */
	addModel: "/api/v1/admin/service-providers/models",
	/** 非官方组织添加模型 */
	addModelNonOfficial: "/api/v1/organization/admin/service-providers/models",
	/** 删除模型 */
	deleteModel: "/api/v1/admin/service-providers/models/${id}",
	/** 非官方组织删除模型 */
	deleteModelNonOfficial: "/api/v1/organization/admin/service-providers/models/${id}",
	/** 连通性测试 */
	testConnection: "/api/v1/admin/service-providers/connectivity-test",
	/** 非官方组织连通性测试 */
	testConnectionNonOfficial: "/api/v1/organization/admin/service-providers/connectivity-test",

	/** 获取模型标识列表 */
	getOriginalModelList: "/api/v1/admin/service-providers/original-models",
	/** 非官方组织获取原始模型列表 */
	getOriginalModelListNonOfficial: "/api/v1/organization/admin/service-providers/original-models",
	/** 删除模型标识 */
	deleteModalId: "/api/v1/admin/service-providers/model-ids/${id}",
	/** 非官方组织删除模型标识 */
	deleteModalIdNonOfficial: "/api/v1/organization/admin/service-providers/model-ids/${id}",
	/** 添加模型标识 */
	addModalId: "/api/v1/admin/service-providers/model-id",
	/** 非官方组织添加模型标识 */
	addModalIdNonOfficial: "/api/v1/organization/admin/service-providers/model-id",
	/** 判断当前组织是否是官方组织 */
	isOfficialOrg: "/api/v1/admin/service-providers/office-info",

	/** 获取默认图标 */
	getDefaultIcon: "/api/v1/file/business-file",
	/** 文件上传 */
	uploadFile: "/api/v1/file/upload-business-file",
	/** 获取上传凭证 */
	getUploadCredentials: "/api/v1/file/temporary-credential",
	/** 删除文件 */
	deleteFile: "/api/v1/file/delete-business-file",
	/** 获取文件临时链接 */
	getFileTemporaryLink: "/api/v1/file-utils/temporary-urls/queries",
	/** 获取官方服务商积分统计 */
	getOfficialPointsStatistics: "/api/v1/quota/points/statistics",
	/** 获取商品列表并携带sku */
	getProductListWithSku: "/api/v1/official/admin/products/details",

	/** AI管理 - 助理管理 */
	/** 获取企业内部助理列表 */
	getAgentList: "/org/admin/agents",
	/** 获取助理详情 */
	updateAgentStatus: "/org/admin/agents/update-status",
	/** 保存助理 */
	saveAgent: "/api/v2/magic/bot/save",
	/** 获取企业内助理创建人 */
	getAgentCreator: "/org/admin/agents/creator",

	/** AI管理 - 功能配置 */
	/** 获取已发布助理列表 */
	getPublishList: "/api/v1/admin/agents/published",
	/** AI助理全局设置 */
	agentGlobalSettings: "/api/v1/admin/globals/agents/settings",

	/** AI管理 - 管控策略 */
	/** 积分组织管控规则 */
	getOrgControlRule: "/api/v1/quota/points/control",
	/** 查询管控目标已用积分 */
	getControlTargetUsedPoints: "/api/v1/quota/points/control/points-used/queries",

	/** 功能管理 */
	/** —————— 功能管理 - OA审批 —————— */
	/** 审批数据查看 */
	oaApprovalData: "/api/admin/oa-approval/instances/queries",
	/** 审批实例导出 */
	exportApproval: "/api/admin/oa-approval/instances/export",
	/** 审批实例附件导出 */
	exportApprovalAttachment: "/api/admin/oa-approval/instances/export-attachments",
	/** 审批实例导出重试 */
	exportApprovalRetry: "/api/admin/oa-approval/instances/exports/${id}/retry",
	/** 审批导出列表 */
	exportApprovalList: "/api/admin/oa-approval/instances/exports/queries",
	/** 获取审批模版列表 */
	getApprovalTemplateList: "/api/admin/oa-approval/templates/queries",
	/** 获取待交接审批列表 */
	getTransferList: "/api/admin/oa-approval/transfers/queries",
	/** 获取制定模版选项列表 */
	getApprovalTemplateOptions: "/api/admin/oa-approval/templates/options",
	/** 获取交接记录列表 */
	getTransferRecordList: "/api/admin/oa-approval/transfers/records/queries",
	/** 批次统计 */
	getBatchStatistics: "/api/admin/oa-approval/transfers/batch-stat",
	/** 发起新交接 */
	initiateNewTransfer: "/api/admin/oa-approval/transfers/staff-transfer",
	/** 审批单+批量交接 */
	approveTransfer: "/api/admin/oa-approval/transfers",
	/** 获取离职人员列表 */
	getResignedUserList: "/api/v2/users/resignations/queries",
	/** 获取审批模板交接列表 */
	getTemplateTransferList: "/api/admin/oa-approval/template-transfers/queries",
	/** 审批模板交接 */
	approveTemplateTransfer: "/api/admin/oa-approval/template-transfers",
	/** 后台-审批模板分组列表 */
	getAllGroupList: "/api/admin/oa-approval/categories/queries",
	/** 前台-审批模板分组列表 */
	getGroupList: "/api/oa-approval/templates/groups",
	/** 获取制定审批模版 */
	getApprovalTemplate: "/api/admin/oa-approval/templates/${code}",
	/** 更新审批摸板名称和描述 */
	updateApprovalTemplateInfo: "/api/admin/oa-approval/templates/${code}/info",
	/** 更新审批摸板分类 */
	updateApprovalTemplateCategory: "/api/admin/oa-approval/templates/${code}/category",
	/** 更新审批摸板可见范围 */
	updateApprovalTemplateVisibility: "/api/admin/oa-approval/templates/${code}/visibility",
	/** 更新审批模版启用停用状态 */
	updateApprovalTemplateStatus: "/api/admin/oa-approval/templates/${code}/toggle",
	/** 保存审批模板 */
	saveApprovalTemplate: "/api/admin/oa-approval/templates",
	/** 创建审批分组 */
	createGroup: "/api/admin/oa-approval/categories",
	/** 修改审批分组 */
	updateGroup: "/api/admin/oa-approval/categories/${code}",
	/** 审批分组排序 */
	reorderGroup: "/api/admin/oa-approval/categories/re-order",
	/** 限时审批模板列表 */
	getTimeLimitTemplateList: "/api/admin/oa-approval/time-limited/templates",
	/** 限时审批模板启/停用 */
	timeLimitTemplateStatus: "/api/admin/oa-approval/time-limited/templates/${code}/status",
	/** 规则组列表 */
	getRuleGroupList: "/api/admin/oa-approval/time-limited/rule-groups",
	/** 编辑规则组 */
	editRuleGroup: "/api/admin/oa-approval/time-limited/rule-groups/${code}/rename",
	/** 删除规则组 */
	deleteRuleGroup: "/api/admin/oa-approval/time-limited/rule-groups/${code}",
	/** 规则详情 */
	getRuleDetail: "/api/admin/oa-approval/time-limited/rule-groups/${code}/rules/${id}",
	/** 创建规则 */
	createRule: "/api/admin/oa-approval/time-limited/rule-groups/${code}/rules",
	/** 统计限时审批模版数量 */
	getTimeLimitTemplateStatistics: "/api/admin/oa-approval/time-limited/statistics",
	/** 不计时时间配置 */
	timeLimitConfig: "/api/admin/oa-approval/time-limited/configs/skip-timing",
	/** 人员时效列表 */
	getUserTimeValidityList: "/api/admin/oa-approval/statistics/users",
	/** 人员时效详情 */
	getUserTimeValidityDetail: "/api/admin/oa-approval/statistics/users/${id}",
	/** 审批时效列表 */
	getTemplateTimeValidityList: "/api/admin/oa-approval/statistics/templates",
	/** 审批时效详情 */
	getTemplateTimeValidityDetail: "/api/admin/oa-approval/statistics/templates/${code}",
	/** 导出审批时效列表 */
	exportTemplateTimeValidityList: "/api/admin/oa-approval/statistics/templates/export",
	/** 导出人员时效列表 */
	exportUserTimeValidityList: "/api/admin/oa-approval/statistics/users/export",
	/** 导出审批时效详情 */
	exportTemplateTimeValidityDetail: "/api/admin/oa-approval/statistics/templates/${code}/export",
	/** 导出人员时效详情 */
	exportUserTimeValidityDetail: "/api/admin/oa-approval/statistics/users/${id}/export",
	/** 获取麦吉子流程下拉列表 */
	getMagicSubFlowOptions: "/api/magic/sub-flows/options",
	/** 审批图标上传 */
	uploadApprovalIcon: "/v4/file/public/token",
	/** 获取多语言数据 */
	getMultiLangData: "/api/admin/oa-approval/templates/${code}/translations",

	/** 企业管理 */
	/** 企业管理 - 组织架构 */
	/** 获取组织架构树 */
	getOrganizationTree: "/v4/console/organizations/departments/tree",
	/** 获取部门下的成员 */
	getDeptUsers: "/v4/console/organizations/departments/users",
	/** 查询成员 */
	getUsers: "/v4/console/organizations/users",
	/** 新增部门 */
	addDepartment: "/v4/console/organizations/departments",
	/** 编辑部门 */
	updateDepartment: "/v4/console/organizations/departments/${id}",
	/** 更新/删除用户组 */
	getUserGroup: "/v4/console/user-groups",
	/** 获取用户组列表 */
	getUserGroupList: "/v4/console/user-groups",
	/** 获取用户组成员 */
	getUserGroupMember: "/v4/console/user-groups/${id}/users",
	/** 获取激活内容 */
	getActivateContent: "/v4/users/activation-sms-content",
	/** 短信激活用户 */
	activateUserBySms: "/v4/users/send_activation_sms",
	/** 批量短信激活用户 */
	batchActivateUserBySms: "/v4/users/batch/send_activation_sms",
	/** 批量启用用户 */
	enableUsers: "/v4/console/organizations/users/status/enable",
	/** 批量禁用用户 */
	disableUsers: "/v4/console/organizations/users/status/disable",
	/** 创建用户 */
	createUser: "/v4/console/organizations/users",
	/** 更新用户 */
	updateUser: "/v4/console/organizations/users/${id}",

	/** 平台套餐 */
	/** —————— 平台管理 - 套餐管理 —————— */
	getPackageList: "/api/v1/official/admin/products",
	/** 添加套餐 */
	addPackage: "/api/v1/official/admin/products",
	/** 套餐详情 */
	getPackageDetail: "/api/v1/official/admin/products/${id}",
	/** 修改套餐状态 */
	updatePackageStatus: "/api/v1/official/admin/products/${id}/status",
	/** 获取套餐下可用的模型 */
	getPackageAvailableModels: "/api/v1/official/admin/products/${id}/available-models",
	/** 获取套餐常量可选项 */
	getPackageOptions: "/api/v1/official/admin/products/plan/options",
	/** 获取订单列表 */
	getOrderList: "/api/v1/official/admin/orders/queries",
	/** 获取订单商品 */
	getOrderProduct: "/api/v1/official/admin/products/query/option",
	/** —————— 平台管理 - 模式管理 —————— */
	/** 获取模式列表 */
	getModeList: "/api/v1/official/admin/modes",
	/** 获取默认模式 */
	getDefaultMode: "/api/v1/official/admin/modes/default",
	/** 获取模式详情 */
	getModeDetail: "/api/v1/official/admin/modes/${id}",
	/** 修改模式状态 */
	updateModeStatus: "/api/v1/official/admin/modes/${id}/status",
	/** 保存模式配置 */
	saveModeConfig: "/api/v1/official/admin/modes/${id}/config",
	/** 获取所有模型列表 */
	getAllModelList: "/api/v1/admin/service-providers/models/queries",
	/** 创建分组 */
	createModeGroup: "/api/v1/official/admin/mode-groups",
	/** 修改分组 */
	updateModeGroup: "/api/v1/official/admin/mode-groups/${id}",
	/** 获取模式原始信息 */
	getModeOriginalInfo: "/api/v1/official/admin/modes/origin/${id}",
	/** 员工详情  */
	getAgentDetail: "/api/v2/admin/super-magic/agents/${code}",
	/** —————— 平台管理 - 组织管理 —————— */
	/** 获取组织列表 */
	getOrgList: "/api/v1/admin/organizations",
	/** 创建组织 */
	createOrganization: "/api/v1/official/admin/organizations/creation",
	/** 获取组织信息 */
	getOrganizationInfo: "/api/v1/official/admin/organizations/info",
	/** 获取组织积分列表 */
	getOrgPointsList: "/api/v1/super-agent/admin/billing-manager/organizations",
	/** 获取组织积分明细 */
	getOrgPointsDetail: "/api/v1/super-agent/admin/billing-manager/points",
	/** 添加组织积分 */
	addOrgPoints: "/api/v1/super-agent/admin/billing-manager/organization-credits",
	/** 绑定套餐 */
	bindPackage: "/api/v1/super-agent/admin/billing-manager/organizations-package",
	/** —————— 平台管理 - AI管理 —————— */
	/** 获取AI能力列表 */
	getAiPowerList: "/api/v1/admin/ai-abilities",
	/** 更改/AI能力详情 */
	updateAiPower: "/api/v1/admin/ai-abilities/${code}",
	/** —————— 平台管理 - 代理服务器 —————— */
	/** 获取代理列表 */
	getProxyServerList: "/api/v1/admin/proxy-servers/queries",
	/** 获取单个可用代理 */
	getAvailableProxy: "/api/v1/admin/proxy-servers/${id}",
	/** 更新代理 */
	updateProxy: "/api/v1/admin/proxy-servers/${id}",
	/** 创建代理 */
	createProxy: "/api/v1/admin/proxy-servers",
	/** 启停用代理 */
	updateProxyStatus: "/api/v1/admin/proxy-servers/${id}/status",
	/** 测试代理连通性 */
	testProxyConnection: "/api/v1/admin/proxy-servers/${id}/test",
	/** 获取所有代理配置（仅ID和名称） */
	getAllProxyList: "/api/v1/admin/proxy-servers/all",
	/** 获取全局配置 */
	getGlobalConfig: "/api/v1/settings/global",

	/** 安全管控 */
	/** 安全管控 - 管理员权限 */
	/** 获取组织管理员列表 */
	getAdminList: "/api/v1/admin/organization-admin/list",
	/** 管理员操作日志 */
	getAdminOperationLogs: "/api/v1/admin/operation-logs",
	/** 启用组织管理员 */
	enableAdmin: "/api/v1/admin/organization-admin/${id}/enable",
	/** 禁用组织管理员 */
	disableAdmin: "/api/v1/admin/organization-admin/${id}/disable",
	/** 删除管理员 */
	deleteAdmin: "/api/v1/admin/organization-admin/${id}",
	/** 授予用户超级管理员权限 */
	grantSuperAdmin: "/api/v1/admin/organization-admin/grant",
	/** 转让组织创建人 */
	transferOrganizationCreator: "/api/v1/admin/organization-admin/transfer-owner",
	/** 获取权限资源树 */
	getPermissionTree: "/api/v1/admin/roles/permissions/tree",
	/** 获取子管理员列表 */
	getSubAdminList: "/api/v1/admin/roles/sub-admins",
	/** 查看子管理员 */
	getSubAdmin: "/api/v1/admin/roles/sub-admins/${id}",
	/** 获取我的权限列表 */
	getMyPermissionList: "/api/v1/permissions/me",
	/** AI审查的话题列表 */
	getAiAuditList: "/api/v1/admin/ai/content-audit/topics",
	/** 识别风险 */
	identifyRisk: "/api/v1/admin/ai/content-audit/topic/${id}/risk",
	/** 取消话题风险 */
	revokeRisk: "/api/v1/admin/ai/content-audit/topic/${id}/risk",
	/** 获取话题风险 */
	getRisk: "/api/v1/admin/ai/content-audit/topic/${id}/risk",

	/** 平台信息 */
	/** 获取平台信息 */
	getPlatformInfo: "/api/v1/platform/setting",
	/** 修改平台信息 */
	updatePlatformInfo: "/api/v1/platform/setting",

	/** 应用菜单 */
	/** 分页查询应用菜单列表 */
	getAppMenuList: "/api/v1/admin/applications/queries",
	/** 保存应用菜单（新增/编辑，有 id 则编辑，无 id 则新增） */
	saveAppMenu: "/api/v1/admin/applications/save",
	/** 删除应用菜单 */
	deleteAppMenu: "/api/v1/admin/applications/delete",
	/** 设置应用菜单状态（启用/禁用） */
	updateAppMenuStatus: "/api/v1/admin/applications/status",

	/** File */
	/** 检查文件上传状态 */
	checkFileUploadStatus: "/api/v1/file-utils/upload-verifications",
	/** 上报文件上传 */
	reportFileUpload: "/api/v1/im/files",
	/** 获取文件下载链接 */
	getFileDownloadLink: "/api/v1/file/publicFileDownload",
	/** 获取上传token */
	getUploadToken: "/api/v1/file-utils/upload-token",

	/** 审批 */
	/** 获取审批详情 */
	getApprovalInstance: "/api/oa-approval/instances/${id}",
	/** 获取下一单审批 */
	getNextApproval: "/api/oa-approval/instances/next-pending",
	/** 审批分享 */
	approvalShare: "/api/oa-approval/instances/${id}/share",
	/** 重置审批分享链接 */
	resetShareLink: "/api/oa-approval/instances/${id}/user-share/reset",
	/** 创建审批分享链接 */
	createShareLink: "/api/oa-approval/instances/${id}/user-share",
	/** 通过分享链接获取访问记录 */
	getShareLinkAccessRecord: "/api/oa-approval/instances/${id}/user-share/access-logs",
	/** 获取分享链接 */
	getShareLink: "/api/oa-approval/instances/${id}/user-share",
	/** 激活审批分享链接 */
	activeShareLink: "/api/oa-approval/instances/${id}/user-share/status",
}
